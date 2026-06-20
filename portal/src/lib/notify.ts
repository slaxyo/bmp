import { supabase } from './supabase'

export type NotifType = 'maintenance' | 'payment' | 'lease' | 'message' | 'system' | 'announcement'

export interface NotifyInput {
  type: NotifType
  title: string
  body?: string
  link?: string
}

/**
 * Create an in-app notification for a recipient and (optionally) fire an email.
 * Fire-and-forget: failures are swallowed so notifying never blocks or breaks
 * the primary action that triggered it.
 */
export async function notifyUser(userId: string | null | undefined, input: NotifyInput) {
  if (!userId) return
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: input.type,
      title: input.title,
      body: input.body ?? '',
      link: input.link ?? null,
    })
  } catch {
    // ignore — in-app notification is best-effort
  }
  // Optional email delivery (no-op unless the Edge Function is configured).
  notifyEmail(userId, input).catch(() => {})
}

/**
 * Trigger an outbound email via the `send-notification` Supabase Edge Function.
 * No-ops unless VITE_FUNCTIONS_URL is set AND the function has been deployed
 * with a RESEND_API_KEY secret. The function resolves the recipient's email
 * and honours their notification preferences server-side (service role).
 * See portal/README.md → "Enabling email notifications".
 */
export async function notifyEmail(userId: string, input: NotifyInput) {
  const base = import.meta.env.VITE_FUNCTIONS_URL as string | undefined
  if (!base) return
  const { data: { session } } = await supabase.auth.getSession()
  await fetch(`${base.replace(/\/$/, '')}/send-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ userId, ...input }),
  })
}

/**
 * Send an email directly to an address (e.g. for invite emails where the
 * recipient has no user account yet). No-ops unless VITE_FUNCTIONS_URL is set.
 */
export async function sendDirectEmail(to: string, subject: string, html: string) {
  const base = import.meta.env.VITE_FUNCTIONS_URL as string | undefined
  if (!base) return
  const { data: { session } } = await supabase.auth.getSession()
  await fetch(`${base.replace(/\/$/, '')}/send-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ to, subject, html }),
  })
}
