import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Thread } from '../data/mockData'
import { messageThreads as mockThreads } from '../data/mockData'
import { useDemoMode } from '../context/DemoModeContext'

// Synthesizes threads from tenants + messages (no threads table in real schema).
// Thread ID = tenant ID. `viewer` controls whose unread messages are counted:
// the PM counts unread tenant messages, the tenant counts unread PM messages.
export function useThreads(tenantId?: string, viewer: 'pm' | 'tenant' = 'pm') {
  const { demoMode } = useDemoMode()
  const [data, setData] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    setLoading(true)
    setError(null)
    try {
      let tenantQuery = supabase
        .from('tenants')
        .select('id, name, unit_id, units!unit_id(unit_number, property_id, properties!property_id(name))')
        .order('created_at', { ascending: true })
      if (tenantId) tenantQuery = tenantQuery.eq('id', tenantId)

      const { data: tenantRows, error: tErr } = await tenantQuery
      if (tErr) throw tErr

      const tenantIds = (tenantRows ?? []).map((t) => (t as Record<string, unknown>).id as string)

      let msgRows: Record<string, unknown>[] = []
      if (tenantIds.length > 0) {
        const { data: msgs, error: mErr } = await supabase
          .from('messages')
          .select('tenant_id, body, created_at, sender, read')
          .in('tenant_id', tenantIds)
          .order('created_at', { ascending: false })
        if (mErr) throw mErr
        msgRows = (msgs ?? []) as Record<string, unknown>[]
      }

      // Last message and unread count per tenant
      const otherParty = viewer === 'pm' ? 'tenant' : 'pm'
      const lastMsg: Record<string, Record<string, unknown>> = {}
      const unread: Record<string, number> = {}
      for (const msg of msgRows) {
        const tid = msg.tenant_id as string
        if (!lastMsg[tid]) lastMsg[tid] = msg
        if (msg.sender === otherParty && !msg.read) {
          unread[tid] = (unread[tid] ?? 0) + 1
        }
      }

      const threads: Thread[] = (tenantRows ?? []).map((t) => {
        const row = t as Record<string, unknown>
        const unit = row.units as Record<string, unknown> | null
        const property = unit?.properties as Record<string, unknown> | null
        const tid = row.id as string
        const last = lastMsg[tid]
        return {
          id: tid,
          tenantId: tid,
          tenantName: row.name as string,
          tenantUnit: `${property?.name ?? ''} · Unit ${unit?.unit_number ?? ''}`,
          unread: unread[tid] ?? 0,
          lastMessage: last ? (last.body as string) : '',
          lastTime: last
            ? new Date(last.created_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '',
        }
      })

      // Sort: threads with messages first (most recent), then the rest
      threads.sort((a, b) => {
        const aTime = lastMsg[a.tenantId]?.created_at as string ?? ''
        const bTime = lastMsg[b.tenantId]?.created_at as string ?? ''
        return bTime.localeCompare(aTime)
      })

      setData(threads)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load threads')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (demoMode) { setData(mockThreads); setLoading(false); setError(null) }
    else refetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, tenantId, viewer])

  return { data, loading, error, refetch }
}
