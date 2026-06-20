import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { ChatMessage } from '../data/mockData'

// threadId is tenant_id (thread ID = tenant ID in the real schema)
function transform(row: Record<string, unknown>): ChatMessage {
  const tenant = row.tenants as Record<string, unknown> | null
  const isFromTenant = row.sender === 'tenant'
  return {
    id: row.id as string,
    threadId: row.tenant_id as string,
    senderId: isFromTenant ? 'tenant' : 'pm',
    senderName: isFromTenant ? ((tenant?.name as string) ?? '') : 'Property Manager',
    text: row.body as string,
    timestamp: '',
    sentAt: new Date(row.created_at as string).getTime(),
    edited: false,
    unsent: false,
  }
}

export function useMessages(threadId: string | null) {
  const [data, setData] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!threadId) { setData([]); return }

    setLoading(true)
    setError(null)

    supabase
      .from('messages')
      .select('*, tenants!tenant_id(name)')
      .eq('tenant_id', threadId)
      .order('created_at', { ascending: true })
      .then(({ data: rows, error: err }) => {
        if (err) setError(err.message)
        else setData((rows ?? []).map((r) => transform(r as Record<string, unknown>)))
        setLoading(false)
      })

    channelRef.current = supabase
      .channel(`messages:${threadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `tenant_id=eq.${threadId}`,
      }, (payload) => {
        const row = payload.new as Record<string, unknown>
        // Fetch with join to get tenant name
        supabase
          .from('messages')
          .select('*, tenants!tenant_id(name)')
          .eq('id', row.id as string)
          .single()
          .then(({ data: fullRow }) => {
            if (fullRow) setData((prev) => [...prev, transform(fullRow as Record<string, unknown>)])
          })
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `tenant_id=eq.${threadId}`,
      }, (payload) => {
        const row = payload.new as Record<string, unknown>
        setData((prev) =>
          prev.map((m) => m.id === row.id ? { ...m, text: row.body as string } : m)
        )
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `tenant_id=eq.${threadId}`,
      }, (payload) => {
        setData((prev) => prev.filter((m) => m.id !== payload.old.id))
      })
      .subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [threadId])

  return { data, setData, loading, error }
}
