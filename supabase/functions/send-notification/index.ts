// supabase/functions/send-notification/index.ts
//
// Supabase Edge Function (Deno) that delivers an email for a portal
// notification via Resend. It is OFF by default — the portal only calls it when
// VITE_FUNCTIONS_URL is set, and it only sends once you add a RESEND_API_KEY
// secret and deploy. See portal/README.md → "Enabling email notifications".
//
// Request body (from portal/src/lib/notify.ts):
//   { userId: string, type: string, title: string, body?: string, link?: string }
//   — the function resolves the recipient's email + preferences server-side.
// Or, for direct sends:
//   { to: string, subject: string, html: string }
//
// Deploy:
//   supabase secrets set RESEND_API_KEY=re_xxx
//   supabase secrets set EMAIL_FROM="Your Co <noreply@yourdomain.com>"
//   supabase functions deploy send-notification

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'Portal <onboarding@resend.dev>'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Map a notification type to the recipient's email-preference flag.
const PREF_KEY: Record<string, string> = {
  maintenance: 'emailMaintenance',
  payment: 'emailRent',
  lease: 'emailLease',
  message: 'emailMessages',
  system: 'emailSystem',
  announcement: 'emailSystem',
}

// Escape user-supplied text before interpolating into the email HTML. Without
// this, a crafted title/body/link injects arbitrary markup into outbound email.
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Only allow http(s) links through; anything else (javascript:, data:, …) is dropped.
function safeUrl(url?: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url, 'https://example.com')
    return u.protocol === 'http:' || u.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function emailHtml(title: string, body: string, link?: string) {
  const safeLink = safeUrl(link)
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f3f4f6;padding:24px">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
      <div style="background:#2563EB;padding:20px 24px"><h1 style="margin:0;color:#fff;font-size:16px">${esc(title)}</h1></div>
      <div style="padding:24px">
        <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">${esc(body)}</p>
        ${safeLink ? `<a href="${esc(safeLink)}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:10px">Open portal</a>` : ''}
      </div>
    </div>
  </body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ skipped: true, reason: 'RESEND_API_KEY not configured' }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.json()
    let to: string | undefined = payload.to
    let subject: string = payload.subject ?? payload.title ?? 'Notification'
    let html: string = payload.html ?? emailHtml(payload.title ?? 'Notification', payload.body ?? '', payload.link)

    // Resolve recipient email + honour their email preference when given a userId
    if (!to && payload.userId) {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
      const { data: userRes } = await admin.auth.admin.getUserById(payload.userId)
      to = userRes?.user?.email ?? undefined

      const { data: profile } = await admin
        .from('profiles').select('notification_preferences').eq('id', payload.userId).maybeSingle()
      const prefs = (profile?.notification_preferences ?? {}) as Record<string, boolean>
      const prefKey = PREF_KEY[payload.type as string] ?? 'emailSystem'
      if (prefs[prefKey] === false) {
        return new Response(JSON.stringify({ skipped: true, reason: 'recipient opted out' }), {
          status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }
      subject = payload.title ?? subject
      html = emailHtml(payload.title ?? 'Notification', payload.body ?? '', payload.link)
    }

    if (!to) {
      return new Response(JSON.stringify({ error: 'No recipient' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    })
    const result = await res.json()
    return new Response(JSON.stringify(result), {
      status: res.ok ? 200 : 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
