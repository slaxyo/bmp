// supabase/functions/create-portal/index.ts
//
// Supabase Edge Function (Deno) that onboards a new PM client.
// Only callable by authenticated company admins (verified via is_company_admin() RPC).
//
// Request body: { email, full_name, company_name, primary_color? }
//
// What it does:
//   1. Verifies caller is a company admin
//   2. Creates a new Supabase auth user via admin.inviteUserByEmail() — sends setup email
//   3. Inserts a branding row for the new PM
//   4. Returns { pm_id, email }
//
// Deploy:
//   supabase functions deploy create-portal

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Verify the caller is authenticated
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Use caller's JWT to check company admin status
  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const { data: isAdmin, error: adminCheckError } = await callerClient.rpc('is_company_admin')
  if (adminCheckError || !isAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden: company admins only' }), {
      status: 403,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Parse request body
  let body: { email: string; full_name: string; company_name: string; primary_color?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { email, full_name, company_name, primary_color = '#2563EB', portal_url } = body
  if (!email || !full_name || !company_name) {
    return new Response(JSON.stringify({ error: 'email, full_name, and company_name are required' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Service role client for privileged operations
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // Invite the new PM — Supabase sends a setup email automatically
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      data: { full_name, role: 'admin' },
      ...(portal_url ? { redirectTo: portal_url } : {}),
    }
  )

  if (inviteError || !inviteData?.user) {
    return new Response(JSON.stringify({ error: inviteError?.message ?? 'Failed to create user' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const pmId = inviteData.user.id

  // Seed branding row for the new PM
  const { error: brandingError } = await adminClient.from('branding').insert({
    pm_id: pmId,
    company_name,
    primary_color,
    tagline: null,
    logo_url: null,
    updated_at: new Date().toISOString(),
  })

  if (brandingError) {
    console.error('Failed to seed branding:', brandingError)
    // Non-fatal — PM can set branding later in their Settings
  }

  return new Response(
    JSON.stringify({ pm_id: pmId, email }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
})
