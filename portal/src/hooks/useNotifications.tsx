import { useState, useEffect, useRef, useCallback, createContext, useContext, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useDemoMode } from '../context/DemoModeContext'
import type { NotifType } from '../lib/notify'

export interface NotificationItem {
  id: string
  type: NotifType
  title: string
  body: string
  link: string | null
  read: boolean
  createdAt: string
  sortAt: number
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function transform(row: Record<string, unknown>): NotificationItem {
  const created = row.created_at as string
  return {
    id: row.id as string,
    type: (row.type as NotifType) ?? 'system',
    title: row.title as string,
    body: (row.body as string) ?? '',
    link: (row.link as string | null) ?? null,
    read: Boolean(row.read),
    createdAt: created ? relativeTime(created) : '',
    sortAt: created ? new Date(created).getTime() : Date.now(),
  }
}

// Sample feed shown in demo mode (no Supabase round-trip)
const DEMO_NOTIFICATIONS: NotificationItem[] = [
  { id: 'n1', type: 'maintenance', title: 'New maintenance request', body: 'Sarah Mitchell submitted a plumbing request — Unit 1A', link: null, read: false, createdAt: '2m ago', sortAt: Date.now() - 120000 },
  { id: 'n2', type: 'payment', title: 'Rent received', body: 'Robert Kim paid $1,450 — Unit 1B', link: null, read: false, createdAt: '1h ago', sortAt: Date.now() - 3600000 },
  { id: 'n3', type: 'lease', title: 'Lease expiring soon', body: 'Jessica Park, Unit 2A — expires Aug 31, 2026', link: null, read: false, createdAt: '3h ago', sortAt: Date.now() - 10800000 },
  { id: 'n4', type: 'message', title: 'New message', body: 'Emily Chen replied in your conversation', link: null, read: true, createdAt: '1d ago', sortAt: Date.now() - 86400000 },
]

export function useNotifications() {
  const { user } = useAuth()
  const { demoMode } = useDemoMode()
  const [data, setData] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const refetch = useCallback(async () => {
    if (!user) { setData([]); setLoading(false); return }
    setLoading(true)
    const { data: rows } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setData((rows ?? []).map((r) => transform(r as Record<string, unknown>)))
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (demoMode) {
      setData(DEMO_NOTIFICATIONS)
      setLoading(false)
      return
    }
    refetch()
    if (!user) return

    channelRef.current = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setData((prev) => [transform(payload.new as Record<string, unknown>), ...prev])
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const updated = transform(payload.new as Record<string, unknown>)
        setData((prev) => prev.map((n) => n.id === updated.id ? updated : n))
      })
      .subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, user?.id])

  const unreadCount = data.filter((n) => !n.read).length

  const markRead = useCallback(async (id: string) => {
    setData((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    if (!demoMode) await supabase.from('notifications').update({ read: true }).eq('id', id)
  }, [demoMode])

  const markAllRead = useCallback(async () => {
    setData((prev) => prev.map((n) => ({ ...n, read: true })))
    if (!demoMode && user) {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    }
  }, [demoMode, user])

  return { data, loading, unreadCount, markRead, markAllRead, refetch }
}

// ── Context so multiple consumers share one subscription ──────────────────────
type NotificationsValue = ReturnType<typeof useNotifications>
const NotificationsContext = createContext<NotificationsValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const value = useNotifications()
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotificationsContext(): NotificationsValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotificationsContext must be used inside NotificationsProvider')
  return ctx
}
