import { useState, useEffect, useCallback } from 'react'
import { X, CheckCircle, XCircle, Info } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'demo'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  dismissed: boolean
}

// ─── Event emitter singleton ──────────────────────────────────────────────────

type ToastListener = (toast: Omit<ToastItem, 'id' | 'dismissed'>) => void

const listeners: Set<ToastListener> = new Set()

function emit(toast: Omit<ToastItem, 'id' | 'dismissed'>) {
  listeners.forEach((l) => l(toast))
}

export function showToast(toast: { type: ToastType; title: string; message?: string }) {
  emit(toast)
}

// ─── Individual Toast ─────────────────────────────────────────────────────────

interface ToastCardProps {
  toast: ToastItem
  onDismiss: (id: string) => void
}

function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    // Trigger slide-in
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  const dismiss = useCallback(() => {
    setLeaving(true)
    setTimeout(() => onDismiss(toast.id), 300)
  }, [toast.id, onDismiss])

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    const t = setTimeout(() => dismiss(), 4000)
    return () => clearTimeout(t)
  }, [dismiss])

  const iconMap = {
    success: <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />,
    error: <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />,
    info: <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />,
    demo: <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />,
  }

  const translateClass = visible && !leaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'

  return (
    <div
      className={`flex items-start gap-3 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-[360px] transition-all duration-300 ease-out ${translateClass}`}
    >
      {iconMap[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-gray-500 mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={dismiss}
        className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Container ────────────────────────────────────────────────────────────────

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const listener: ToastListener = (incoming) => {
      setToasts((prev) => {
        // Keep max 3
        const base = prev.length >= 3 ? prev.slice(prev.length - 2) : prev
        return [
          ...base,
          {
            id: `toast-${Date.now()}-${Math.random()}`,
            type: incoming.type,
            title: incoming.title,
            message: incoming.message,
            dismissed: false,
          },
        ]
      })
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3 items-end pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard toast={t} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  )
}
