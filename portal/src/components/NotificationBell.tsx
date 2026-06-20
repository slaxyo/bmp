import { useState, useRef, useEffect } from 'react'
import { Bell, Wrench, DollarSign, FileText, MessageSquare, Info, Megaphone } from 'lucide-react'
import { useNotificationsContext, type NotificationItem } from '../hooks/useNotifications'
import type { NotifType } from '../lib/notify'

const ICONS: Record<NotifType, React.ReactNode> = {
  maintenance: <Wrench className="w-3.5 h-3.5" />,
  payment: <DollarSign className="w-3.5 h-3.5" />,
  lease: <FileText className="w-3.5 h-3.5" />,
  message: <MessageSquare className="w-3.5 h-3.5" />,
  system: <Info className="w-3.5 h-3.5" />,
  announcement: <Megaphone className="w-3.5 h-3.5" />,
}

const ICON_BG: Record<NotifType, string> = {
  maintenance: 'bg-amber-100 text-amber-600',
  payment: 'bg-green-100 text-green-600',
  lease: 'bg-violet-100 text-violet-600',
  message: 'bg-blue-100 text-blue-600',
  system: 'bg-gray-100 text-gray-500',
  announcement: 'bg-indigo-100 text-indigo-600',
}

export function NotificationBell({
  align = 'right',
  onItemClick,
}: {
  align?: 'left' | 'right'
  /** Optional handler invoked (after mark-as-read) when an item is clicked —
   *  e.g. the admin uses it to switch its internal panel. */
  onItemClick?: (n: NotificationItem) => void
}) {
  const { data, unreadCount, markRead, markAllRead } = useNotificationsContext()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${open ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold px-1 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute top-full mt-2 w-[340px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="min-w-[20px] h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold px-1.5">{unreadCount}</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={() => markAllRead()} className="text-xs text-blue-600 hover:text-blue-800 font-semibold">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {data.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">You're all caught up</p>
              </div>
            ) : data.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.read) markRead(n.id)
                  onItemClick?.(n)
                  setOpen(false)
                }}
                className={`w-full text-left px-5 py-3.5 hover:bg-gray-50 transition-colors flex items-start gap-3 ${!n.read ? 'bg-blue-50/60' : ''}`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${ICON_BG[n.type] ?? ICON_BG.system}`}>
                  {ICONS[n.type] ?? ICONS.system}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${!n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>{n.title}</p>
                  {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">{n.createdAt}</p>
                </div>
                {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
