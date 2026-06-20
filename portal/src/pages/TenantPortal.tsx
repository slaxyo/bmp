import { useState, useRef, useEffect, createContext, useContext } from 'react'
import {
  Home, DollarSign, Wrench, MessageSquare, FileText,
  ChevronRight, Check, X, Plus, Send, Smile, Paperclip,
  Edit2, MoreHorizontal, Upload, CreditCard, Building2, Search, LogOut,
} from 'lucide-react'
import type { Tenant } from '../data/mockData'
import { supabase } from '../lib/supabase'
import { useBranding } from '../context/BrandingContext'
import { BrandLogo } from '../components/BrandLogo'
import { NotificationBell } from '../components/NotificationBell'
import { NotificationsProvider } from '../hooks/useNotifications'
import { notifyUser } from '../lib/notify'
import { useDocuments } from '../hooks/useDocuments'
import { useCurrentTenant } from '../hooks/useTenants'
import { useMaintenanceTickets } from '../hooks/useMaintenanceTickets'
import { useRentRecords } from '../hooks/useRentRecords'
import { useThreads } from '../hooks/useThreads'
import { useMessages } from '../hooks/useMessages'
import { showToast } from '../components/Toast'
import { useAuth } from '../context/AuthContext'
import { useDemoMode } from '../context/DemoModeContext'

// ─── Tenant Context ───────────────────────────────────────────────────────────
const TenantCtx = createContext<{ tenant: Tenant | null; tenantId: string | null; pmId: string | null; unitId: string | null }>({ tenant: null, tenantId: null, pmId: null, unitId: null })

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'maintenance' | 'payments' | 'messages' | 'documents'

interface MaintenanceFormStep1 {
  issueType: string
  location: string
  priority: string
  title: string
  description: string
  startDate: string
  gettingWorse: boolean | null
}

interface MaintenanceFormStep2 {
  entryPermission: string
  preferredTimes: string[]
  contactMethod: string
  photos: string[]
  notes: string
}

interface PaymentRow {
  month: string
  amount: number
  datePaid: string
  method: string
  status: string
}

interface DocItem {
  id: string
  name: string
  type: string
  date: string
  size: string
}

// ─── localStorage helper ──────────────────────────────────────────────────────

function useLocalState<T>(key: string, def: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def } catch { return def }
  })
  function set(v: T) { setVal(v); try { localStorage.setItem(key, JSON.stringify(v)) } catch {} }
  return [val, set]
}

// ─── Timestamp helpers ────────────────────────────────────────────────────────

const DAY_MS = 86400000

function formatSentAt(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  const d = new Date(ms)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Modal Backdrop ───────────────────────────────────────────────────────────

function ModalBackdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>
  )
}

// ─── Maintenance Modal ────────────────────────────────────────────────────────

function MaintenanceModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (data: MaintenanceFormStep1 & MaintenanceFormStep2) => void
}) {
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [ticketId] = useState(`MT-${String(Math.floor(Math.random() * 900) + 100)}`)

  const [step1, setStep1] = useState<MaintenanceFormStep1>({
    issueType: '', location: '', priority: '', title: '', description: '', startDate: '', gettingWorse: null,
  })
  const [step2, setStep2] = useState<MaintenanceFormStep2>({
    entryPermission: '', preferredTimes: [], contactMethod: '', photos: [], notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  function validateStep1() {
    const e: Record<string, string> = {}
    if (!step1.issueType) e.issueType = 'Required'
    if (!step1.location) e.location = 'Required'
    if (!step1.priority) e.priority = 'Required'
    if (!step1.title) e.title = 'Required'
    if (step1.description.length < 20) e.description = 'Please provide at least 20 characters'
    return e
  }

  function nextStep() {
    const e = validateStep1()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setErrors({})
    setStep(2)
  }

  function handleSubmit() {
    setSubmitted(true)
    onSubmit({ ...step1, ...step2 })
    showToast({ type: 'success', title: `Maintenance request ${ticketId} submitted` })
  }

  function toggleTime(t: string) {
    setStep2((prev) => ({
      ...prev,
      preferredTimes: prev.preferredTimes.includes(t)
        ? prev.preferredTimes.filter((x) => x !== t)
        : [...prev.preferredTimes, t],
    }))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4 - step2.photos.length)
    setStep2((prev) => ({ ...prev, photos: [...prev.photos, ...files.map((f) => f.name)].slice(0, 4) }))
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Request Submitted</h2>
          <p className="text-sm text-gray-500 mb-4">
            Ticket ID: <span className="font-mono font-bold text-blue-600">{ticketId}</span>
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 text-sm mb-6">
            <div className="flex justify-between"><span className="text-gray-500">Issue</span><span className="font-semibold">{step1.title}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-semibold">{step1.issueType}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Location</span><span className="font-semibold">{step1.location}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Priority</span><span className="font-semibold">{step1.priority}</span></div>
            <div className="flex justify-between">
              <span className="text-gray-500">Entry</span>
              <span className="font-semibold text-right max-w-[60%]">{step2.entryPermission || 'Not specified'}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-6">
            We'll contact you via {step2.contactMethod || 'In-App'} once a technician is scheduled.
          </p>
          <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900">New Maintenance Request</h2>
            <p className="text-xs text-gray-500">Step {step} of 2</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="px-6 pt-4">
          <div className="w-full h-1.5 bg-gray-100 rounded-full">
            <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: step === 1 ? '50%' : '100%' }} />
          </div>
        </div>
        <div className="p-6 space-y-4">
          {step === 1 ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Issue Type *</label>
                  <select
                    value={step1.issueType}
                    onChange={(e) => setStep1({ ...step1, issueType: e.target.value })}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.issueType ? 'border-red-400' : 'border-gray-200'}`}
                  >
                    <option value="">Select type…</option>
                    {['Plumbing','Electrical','HVAC','Appliance','Structural','Pest Control','Landscaping','Other'].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                  {errors.issueType && <p className="text-xs text-red-500 mt-0.5">{errors.issueType}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Location in Unit *</label>
                  <select
                    value={step1.location}
                    onChange={(e) => setStep1({ ...step1, location: e.target.value })}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.location ? 'border-red-400' : 'border-gray-200'}`}
                  >
                    <option value="">Select location…</option>
                    {['Kitchen','Bathroom (Primary)','Bathroom (Secondary)','Bedroom','Living Room','Hallway/Entry','Balcony/Patio','Outside/Common Area'].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                  {errors.location && <p className="text-xs text-red-500 mt-0.5">{errors.location}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Priority *</label>
                <select
                  value={step1.priority}
                  onChange={(e) => setStep1({ ...step1, priority: e.target.value })}
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.priority ? 'border-red-400' : 'border-gray-200'}`}
                >
                  <option value="">Select priority…</option>
                  <option>Non-Urgent (can wait a few days)</option>
                  <option>Urgent (needs attention within 24h)</option>
                  <option>Emergency (immediate danger — fire/flood/gas)</option>
                </select>
                {errors.priority && <p className="text-xs text-red-500 mt-0.5">{errors.priority}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Issue Title *</label>
                <input
                  value={step1.title}
                  onChange={(e) => setStep1({ ...step1, title: e.target.value })}
                  placeholder="Brief summary of the issue"
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.title ? 'border-red-400' : 'border-gray-200'}`}
                />
                {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description *</label>
                <textarea
                  value={step1.description}
                  onChange={(e) => setStep1({ ...step1, description: e.target.value })}
                  placeholder="Describe the issue in detail (at least 20 characters)"
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none ${errors.description ? 'border-red-400' : 'border-gray-200'}`}
                />
                <div className="flex justify-between">
                  {errors.description ? <p className="text-xs text-red-500">{errors.description}</p> : <span />}
                  <p className="text-xs text-gray-400">{step1.description.length} chars</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">When did it start?</label>
                  <input
                    type="date"
                    value={step1.startDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setStep1({ ...step1, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Is it getting worse?</label>
                  <div className="flex gap-2">
                    {[true, false].map((v) => (
                      <button
                        key={String(v)}
                        onClick={() => setStep1({ ...step1, gettingWorse: v })}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                          step1.gettingWorse === v
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {v ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={nextStep}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Entry Permission *</label>
                <div className="space-y-2">
                  {[
                    'Yes, any time during business hours',
                    'Yes, with 24-hour advance notice',
                    'Schedule with me first',
                  ].map((opt) => (
                    <label key={opt} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="entry"
                        value={opt}
                        checked={step2.entryPermission === opt}
                        onChange={() => setStep2({ ...step2, entryPermission: opt })}
                        className="accent-blue-600"
                      />
                      <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Preferred Time Slots</label>
                <div className="flex flex-wrap gap-2">
                  {['Morning (8am–12pm)','Afternoon (12pm–5pm)','Evening (5pm–8pm)','Weekends'].map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleTime(t)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        step2.preferredTimes.includes(t)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Preferred Contact Method</label>
                <div className="flex gap-2">
                  {['In-App','Email','Phone'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setStep2({ ...step2, contactMethod: m })}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                        step2.contactMethod === m
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Photos <span className="text-gray-400 font-normal">(up to 4)</span>
                </label>
                <div
                  onClick={() => step2.photos.length < 4 && fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">Drag & drop or click to upload</p>
                  <p className="text-xs text-gray-400 mt-0.5">{4 - step2.photos.length} of 4 remaining</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
                {step2.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {step2.photos.map((name, i) => (
                      <div key={i} className="relative">
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                          <p className="text-xs text-gray-500 truncate px-1 text-center">{name}</p>
                        </div>
                        <button
                          onClick={() => setStep2((prev) => ({ ...prev, photos: prev.photos.filter((_, idx) => idx !== i) }))}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-white flex items-center justify-center"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Additional Notes</label>
                <textarea
                  value={step2.notes}
                  onChange={(e) => setStep2({ ...step2, notes: e.target.value })}
                  placeholder="Any additional context for the technician…"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" /> Back
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  Submit Request
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Pay Rent Modal ───────────────────────────────────────────────────────────

function PayRentModal({
  amount,
  onClose,
  onSuccess,
}: {
  amount: number
  onClose: () => void
  onSuccess: (method: string, amt: number, note: string) => void
}) {
  const [payAmount, setPayAmount] = useState(String(amount))
  const [method, setMethod] = useState('Cash')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    setLoading(true)
    await onSuccess(method, Number(payAmount) || amount, note.trim())
    setLoading(false)
    setDone(true)
  }

  if (done) {
    return (
      <ModalBackdrop onClose={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Payment Reported</h2>
          <p className="text-sm text-gray-500 mb-6">Your property manager has been notified and will confirm your payment shortly.</p>
          <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
            Done
          </button>
        </div>
      </ModalBackdrop>
    )
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Report Payment</h2>
            <p className="text-xs text-gray-500 mt-0.5">Let your property manager know you've paid</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Amount ($)</label>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">How did you pay?</label>
            <div className="space-y-2">
              {(['Cash', 'e-Transfer', 'Cheque', 'Bank Transfer', 'Other'] as const).map((m) => (
                <label key={m} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="paymethod"
                    checked={method === m}
                    onChange={() => setMethod(m)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700">{m}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Sent via e-Transfer to manager@example.com"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <button
            onClick={submit}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Submitting…
              </>
            ) : (
              `Report Payment — $${Number(payAmount || amount).toLocaleString()}`
            )}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Receipt Modal ────────────────────────────────────────────────────────────

function ReceiptModal({ row, onClose }: { row: PaymentRow; onClose: () => void }) {
  const { tenant } = useContext(TenantCtx)
  const { companyName, tagline } = useBranding()
  const year = row.datePaid.split(', ')[1] ?? '2026'
  const monthNum =
    ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(
      row.datePaid.split(' ')[0]
    ) + 1
  const rand3 = String(Math.floor(Math.random() * 900) + 100)
  const receiptNo = `RCPT-${year}${String(monthNum).padStart(2, '0')}${rand3}`

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md">
        <div className="bg-blue-600 rounded-t-xl px-6 py-4 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5" />
            <span className="font-bold text-lg">{companyName}</span>
          </div>
          <p className="text-blue-200 text-xs">{tagline}</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Payment Receipt</h2>
            <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full">PAID</span>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Receipt #</span><span className="font-mono font-semibold text-gray-900">{receiptNo}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">From</span><span className="font-semibold text-gray-900">{companyName}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">To</span><span className="font-semibold text-gray-900">{tenant?.name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Unit</span><span className="font-semibold text-gray-900">Unit {tenant?.unit ?? '—'}, {tenant?.property ?? '—'}</span></div>
            <div className="h-px bg-gray-200" />
            <div className="flex justify-between"><span className="text-gray-500">Description</span><span className="font-semibold text-gray-900">Monthly Rent — {row.month}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="text-xl font-black text-gray-900">${row.amount.toLocaleString()}.00</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Date Paid</span><span className="font-semibold text-gray-900">{row.datePaid}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Method</span><span className="font-semibold text-gray-900">{row.method}</span></div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => showToast({ type: 'success', title: 'Printing receipt' })}
              className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Print
            </button>
            <button onClick={onClose} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Doc Preview Modal ────────────────────────────────────────────────────────

function DocPreviewModal({ doc, onClose }: { doc: DocItem; onClose: () => void }) {
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 truncate pr-4">{doc.name}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">{doc.type}</span>
            <span className="text-xs text-gray-500">{doc.date}</span>
            <span className="text-xs text-gray-400">{doc.size}</span>
          </div>
          <div className="bg-gray-100 rounded-xl h-56 flex flex-col items-center justify-center gap-3 text-gray-400">
            <FileText className="w-12 h-12 opacity-40" />
            <p className="text-sm font-medium text-gray-500 text-center px-4">{doc.name}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => showToast({ type: 'info', title: 'Downloading…' })}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Download
            </button>
            <button
              onClick={() => showToast({ type: 'info', title: 'Downloading…' })}
              className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Print
            </button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ onNewTicket }: { onNewTicket: () => void }) {
  const { tenant, tenantId } = useContext(TenantCtx)
  const { data: tickets } = useMaintenanceTickets(undefined, tenantId ?? undefined)
  const openCount = tickets.filter((t) => t.status !== 'resolved').length

  const leaseEndMs = tenant ? new Date(tenant.leaseEnd).getTime() : 0
  const daysRemaining = tenant ? Math.ceil((leaseEndMs - Date.now()) / DAY_MS) : 0
  const leaseBarColor =
    daysRemaining > 180 ? 'bg-green-500' : daysRemaining > 90 ? 'bg-amber-500' : 'bg-red-500'
  const leaseBarPct = Math.max(0, Math.min(100, (daysRemaining / 365) * 100))

  if (!tenant) {
    return (
      <div className="p-5 space-y-5">
        <div className="bg-gray-200 animate-pulse rounded-2xl h-32" />
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-100 animate-pulse rounded-xl h-24" />
          <div className="bg-gray-100 animate-pulse rounded-xl h-24" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-5">
      {/* Greeting card */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
        <h2 className="text-2xl font-black mb-1">Good morning, {tenant.name.split(' ')[0]} 👋</h2>
        <p className="text-blue-200 text-sm mb-4">Unit {tenant.unit} · {tenant.property}</p>
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
            📧 {tenant.email}
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
            📞 {tenant.phone}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Monthly Rent</p>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl font-black text-gray-900">${tenant.rent.toLocaleString()}</span>
          </div>
          <p className="text-xs text-gray-400">Due on the 1st of each month</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Maintenance</p>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl font-black text-gray-900">{openCount}</span>
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${openCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
              {openCount > 0 ? 'Open' : 'All Clear'}
            </span>
          </div>
          <button
            onClick={onNewTicket}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> New Request
          </button>
        </div>
      </div>

      {/* Lease status */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-gray-900">Lease Status</h3>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            daysRemaining > 180 ? 'bg-green-100 text-green-700' :
            daysRemaining > 90 ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>
            {daysRemaining} days left
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <span className="text-gray-500 block text-xs">Lease End</span>
            <span className="font-semibold">{tenant.leaseEnd}</span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs">Move-in</span>
            <span className="font-semibold">{tenant.moveIn}</span>
          </div>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${leaseBarColor}`} style={{ width: `${leaseBarPct}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Lease ends {tenant.leaseEnd}</p>
      </div>

      {/* Open tickets */}
      {openCount > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-base font-bold text-gray-900 mb-3">Open Requests</h3>
          <div className="space-y-2">
            {tickets.filter(t => t.status !== 'resolved').slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Wrench className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                  <p className="text-xs text-gray-400">{t.status === 'in_progress' ? 'In progress' : 'Open'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Maintenance Tab ──────────────────────────────────────────────────────────

function MaintenanceListTab({ onNew }: { onNew: () => void }) {
  const { tenantId } = useContext(TenantCtx)
  const { data: myTickets } = useMaintenanceTickets(undefined, tenantId ?? undefined)

  const timelineSteps = ['Submitted', 'Assigned', 'In Progress', 'Resolved']

  function stepFilled(status: string) {
    if (status === 'open') return 1
    if (status === 'in_progress') return 2
    if (status === 'resolved') return 4
    return 0
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900 text-base">Active Tickets</h2>
        <button
          onClick={onNew}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Request
        </button>
      </div>

      {myTickets.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No maintenance requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {myTickets.map((t) => {
            const filled = stepFilled(t.status)
            return (
              <div
                key={t.id}
                className={`bg-white rounded-xl border shadow-sm p-4 border-l-4 ${
                  t.priority === 'emergency' ? 'border-gray-200 border-l-red-500' :
                  t.priority === 'high' ? 'border-gray-200 border-l-orange-500' :
                  t.priority === 'medium' ? 'border-gray-200 border-l-amber-400' :
                  'border-gray-200 border-l-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-gray-900">{t.title}</p>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                        t.priority === 'emergency' ? 'bg-red-100 text-red-700' :
                        t.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        t.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>{t.priority}</span>
                    </div>
                    <p className="text-xs text-gray-500">{t.id} · {t.category} · Unit {t.unit}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    t.status === 'open' ? 'bg-blue-100 text-blue-700' :
                    t.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {t.status === 'in_progress' ? 'In Progress' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{t.description}</p>

                {/* Horizontal timeline */}
                <div className="flex items-start">
                  {timelineSteps.map((step, idx) => {
                    const done = idx < filled
                    const active = idx === filled - 1
                    return (
                      <div key={step} className="flex items-center flex-1">
                        <div className="flex flex-col items-center">
                          <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                            done || active ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
                          }`} />
                          <p className={`text-[9px] mt-0.5 whitespace-nowrap ${
                            done || active ? 'text-blue-600 font-semibold' : 'text-gray-400'
                          }`}>{step}</p>
                        </div>
                        {idx < timelineSteps.length - 1 && (
                          <div className={`flex-1 h-0.5 mx-1 mb-3 ${idx < filled - 1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                        )}
                      </div>
                    )
                  })}
                </div>

                <p className="text-xs text-gray-400 mt-2">Submitted {t.createdAt}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────

function PaymentsTab() {
  const { tenant, tenantId, pmId } = useContext(TenantCtx)
  const { demoMode } = useDemoMode()
  const { data: rentRecords, refetch: refetchRent } = useRentRecords(tenantId ?? undefined)
  const [autopay, setAutopay] = useState(true)
  const [receiptRow, setReceiptRow] = useState<PaymentRow | null>(null)
  const [showPayRent, setShowPayRent] = useState(false)

  const cashFlowRows: PaymentRow[] = rentRecords.map((r) => ({
    month: r.month,
    amount: r.amount,
    datePaid: r.datePaid || '—',
    method: r.method || 'ACH',
    status: r.status,
  }))

  async function handlePaySuccess(method: string, amt: number, note: string) {
    if (demoMode) { showToast({ type: 'info', title: 'Demo mode — no payment recorded' }); return }
    if (tenantId && pmId) {
      const today = new Date()
      const noteText = [method, note].filter(Boolean).join(' — ')
      await supabase.from('rent_payments').insert({
        pm_id: pmId,
        tenant_id: tenantId,
        amount: amt,
        due_date: today.toISOString().slice(0, 10),
        status: 'pending',
        note: noteText,
      })
      await refetchRent()
    }
    showToast({ type: 'success', title: 'Payment reported', body: 'Your property manager will confirm receipt shortly.' })
  }

  const rentAmount = tenant?.rent ?? 0

  return (
    <div className="p-6 space-y-5">
      {/* Pay Rent CTA */}
      <button
        onClick={() => setShowPayRent(true)}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 rounded-2xl text-base shadow-lg transition-all flex items-center justify-center gap-3"
      >
        <DollarSign className="w-5 h-5" />
        Pay Rent{rentAmount > 0 ? ` — $${rentAmount.toLocaleString()}` : ''}
      </button>

      {/* Current month card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-1">Monthly Rent</p>
            <p className="text-5xl font-black tracking-tight mt-1">${rentAmount.toLocaleString()}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-blue-500">
          <div><p className="text-blue-300 text-xs">Lease Start</p><p className="text-white font-semibold text-sm mt-0.5">{tenant?.moveIn ?? '—'}</p></div>
          <div><p className="text-blue-300 text-xs">Lease End</p><p className="text-white font-semibold text-sm mt-0.5">{tenant?.leaseEnd ?? '—'}</p></div>
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-blue-500">
          <span className="text-sm text-blue-100">
            {autopay ? 'Autopay ON · Bank of America ···4821' : 'Autopay is OFF'}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setAutopay(!autopay); showToast({ type: 'success', title: `Autopay ${!autopay ? 'enabled' : 'disabled'}` }) }}
              className={`relative w-10 h-6 rounded-full transition-colors ${autopay ? 'bg-green-400' : 'bg-blue-400'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autopay ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <button
              onClick={() => showToast({ type: 'info', title: 'Edit autopay settings' })}
              className="text-xs text-blue-200 hover:text-white underline"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Payment History</h3>
        </div>
        {cashFlowRows.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">No payment records yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Month','Amount','Date Paid','Method','Status','Receipt'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cashFlowRows.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{r.month}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-gray-900">${r.amount.toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{r.datePaid}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{r.method}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full ${
                      r.status === 'paid' ? 'bg-green-100 text-green-700 ring-1 ring-green-200' :
                      r.status === 'late' ? 'bg-red-100 text-red-700 ring-1 ring-red-200' :
                      r.status === 'pending' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' :
                      'bg-gray-100 text-gray-600 ring-1 ring-gray-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        r.status === 'paid' ? 'bg-green-500' :
                        r.status === 'late' ? 'bg-red-500' :
                        r.status === 'pending' ? 'bg-amber-500' : 'bg-gray-400'
                      }`} />
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {r.status === 'paid' ? (
                      <button onClick={() => setReceiptRow(r)} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                        Download
                      </button>
                    ) : r.status === 'pending' ? (
                      <span className="text-xs text-amber-600 font-medium">Awaiting confirmation</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom two-col */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Lease Summary</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Lease Term</span>
              <span className="font-semibold">{tenant?.moveIn ?? '—'} – {tenant?.leaseEnd ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Monthly Rent</span>
              <span className="font-semibold text-green-600">${rentAmount.toLocaleString()}</span>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="flex justify-between">
              <span className="text-gray-500">Security Deposit</span>
              <span className="font-semibold">${rentAmount.toLocaleString()} · Held on file</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Payment Methods</h3>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Bank of America Checking</p>
              <p className="text-xs text-gray-500">Account ending ···4821 · Default</p>
            </div>
          </div>
          <button
            onClick={() => showToast({ type: 'info', title: 'Add payment method' })}
            className="w-full border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-500 hover:text-blue-600 text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Payment Method
          </button>
        </div>
      </div>

      {receiptRow && <ReceiptModal row={receiptRow} onClose={() => setReceiptRow(null)} />}
      {showPayRent && (
        <PayRentModal
          amount={rentAmount}
          onClose={() => setShowPayRent(false)}
          onSuccess={handlePaySuccess}
        />
      )}
    </div>
  )
}

// ─── Emoji list ───────────────────────────────────────────────────────────────

const EMOJI_LIST = [
  '😊','😂','❤️','👍','🙏','😍','🎉','😭','😘','💯',
  '✅','🔥','💪','👏','🤔','😅','🙌','😎','💬','📋',
  '🏠','🔑','💰','📅','⚠️','✍️','📞','📧','👋','🤝',
  '😢','😤','🙃','😬','🥲','💡','📝','🗓️','⏰','🚨',
]

// ─── Messages Tab — iMessage style ───────────────────────────────────────────

type Attachment = { name: string; size: string; file: File; previewUrl: string | null }

function isImageUrl(str: string) {
  try { return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(new URL(str).pathname) } catch { return false }
}

function MessageBody({ text, isTenant }: { text: string; isTenant: boolean }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) =>
        isImageUrl(line.trim()) ? (
          <img key={i} src={line.trim()} className="max-w-[260px] rounded-xl mt-1 block" alt="attachment" />
        ) : (
          <span key={i}>{line}{i < lines.length - 1 && '\n'}</span>
        )
      )}
    </>
  )
}

function TenantMessagesTab() {
  const { tenantId, pmId } = useContext(TenantCtx)
  const { demoMode } = useDemoMode()
  const { companyName } = useBranding()
  const brandInitials = companyName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const { data: dbThreads } = useThreads(tenantId ?? undefined, 'tenant')
  const [selectedThreadId, setSelectedThreadId] = useState<null | string>(null)

  const firstThreadId = dbThreads[0]?.id ?? null
  const activeThreadId = selectedThreadId ?? firstThreadId

  const { data: messages, setData: setMessages } = useMessages(activeThreadId ?? null)

  const [compose, setCompose] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [threadSearch, setThreadSearch] = useState('')
  const [sending, setSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)
  const composeRef = useRef<HTMLTextAreaElement>(null)

  const activeThread = dbThreads.find((t) => t.id === activeThreadId) ?? null
  const threadMessages = messages
  const filteredThreads = dbThreads.filter((t) =>
    t.tenantName.toLowerCase().includes(threadSearch.toLowerCase()) ||
    t.tenantUnit.toLowerCase().includes(threadSearch.toLowerCase())
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMessages.length, activeThreadId])

  useEffect(() => {
    if (demoMode || !activeThreadId || !pmId) return
    supabase.from('messages')
      .update({ read: true })
      .eq('tenant_id', activeThreadId)
      .eq('sender', 'pm')
      .eq('read', false)
      .then(() => {})
  }, [activeThreadId, pmId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmojiPicker(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function sendMessage() {
    if (!compose.trim() && attachments.length === 0) return
    if (demoMode) { showToast({ type: 'info', title: 'Demo mode — message not sent' }); setCompose(''); setAttachments([]); return }
    if (!activeThreadId || !pmId) return

    setSending(true)
    const textParts = [compose.trim()]

    // Upload image attachments to storage
    for (const att of attachments) {
      const ext = att.name.split('.').pop() ?? 'bin'
      const path = `${await auth_uid()}/${crypto.randomUUID()}.${ext}`
      const { data: uploaded, error: upErr } = await supabase.storage
        .from('message-attachments')
        .upload(path, att.file, { contentType: att.file.type, upsert: false })
      if (!upErr && uploaded) {
        const { data: { publicUrl } } = supabase.storage.from('message-attachments').getPublicUrl(uploaded.path)
        textParts.push(publicUrl)
      } else {
        textParts.push(`📎 ${att.name} (${att.size})`)
      }
    }

    const text = textParts.filter(Boolean).join('\n')
    const optimisticId = `opt-${Date.now()}`
    const optimistic = {
      id: optimisticId, threadId: activeThreadId, senderId: 'tenant' as const,
      senderName: '', text, timestamp: '', sentAt: Date.now(), edited: false, unsent: false,
    }
    setMessages((prev) => [...prev, optimistic])
    setCompose('')
    setAttachments([])
    setSending(false)

    const { data: inserted, error } = await supabase.from('messages').insert({
      pm_id: pmId, tenant_id: activeThreadId, sender: 'tenant', body: text, read: false,
    }).select().single()

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      showToast({ type: 'error', title: 'Failed to send message' })
      return
    }
    if (inserted) {
      setMessages((prev) => prev.map((m) => m.id === optimisticId ? { ...m, id: inserted.id as string } : m))
    }
    notifyUser(pmId, {
      type: 'message',
      title: `New message from ${activeThread?.tenantName ?? 'a tenant'}`,
      body: compose.trim() || 'Sent an attachment',
      link: '/admin',
    })
  }

  async function auth_uid(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? 'anon'
  }

  function insertEmoji(emoji: string) {
    const el = composeRef.current
    if (!el) { setCompose((c) => c + emoji); setShowEmojiPicker(false); return }
    const start = el.selectionStart ?? compose.length
    const end = el.selectionEnd ?? compose.length
    const next = compose.slice(0, start) + emoji + compose.slice(end)
    setCompose(next)
    setShowEmojiPicker(false)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const items: Attachment[] = files.map((f) => ({
      name: f.name,
      size: f.size < 1024 * 1024 ? `${Math.round(f.size / 1024)} KB` : `${(f.size / 1024 / 1024).toFixed(1)} MB`,
      file: f,
      previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }))
    setAttachments((prev) => [...prev, ...items])
    e.target.value = ''
  }

  async function unsendMessage(id: string) {
    if (!demoMode) await supabase.from('messages').delete().eq('id', id)
    setMenuOpenId(null)
  }

  return (
    <div className="flex h-full overflow-hidden bg-white">
      {/* Thread list — 280px */}
      <div className="w-[280px] border-r border-gray-200 flex flex-col shrink-0 bg-gray-50">
        <div className="px-4 pt-4 pb-3 border-b border-gray-200">
          <h2 className="font-bold text-gray-900 text-base mb-3">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search messages…"
              value={threadSearch}
              onChange={(e) => setThreadSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredThreads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => {
                setSelectedThreadId(thread.id)
              }}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-white transition-colors ${
                activeThreadId === thread.id ? 'bg-white border-l-2 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {thread.tenantName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-gray-50 rounded-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm truncate ${thread.unread > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                      {thread.tenantName}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0 ml-2">{thread.lastTime}</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{thread.tenantUnit}</p>
                  <p className={`text-xs truncate mt-0.5 ${thread.unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                    {thread.lastMessage}
                  </p>
                </div>
                {thread.unread > 0 && (
                  <span className="mt-1 min-w-[20px] h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold px-1 shrink-0">
                    {thread.unread}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Conversation pane */}
      {activeThread ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3 border-b border-gray-200 bg-white flex items-center gap-3 shadow-sm shrink-0">
            <div className="relative">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">{brandInitials}</div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{companyName}</p>
              <p className="text-xs text-gray-500">{activeThread.tenantUnit} · Active now</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 bg-gray-50">
            {threadMessages.map((msg, idx) => {
              const isTenant = msg.senderId === 'tenant'
              const prevMsg = idx > 0 ? threadMessages[idx - 1] : null
              const showSenderBreak = !prevMsg || prevMsg.senderId !== msg.senderId
              const isLastInGroup = !threadMessages[idx + 1] || threadMessages[idx + 1].senderId !== msg.senderId

              if (msg.unsent) {
                return (
                  <div key={msg.id} className="flex justify-center py-1">
                    <p className="text-xs text-gray-400 italic">Message unsent</p>
                  </div>
                )
              }

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 group ${isTenant ? 'justify-end' : 'justify-start'} ${showSenderBreak ? 'mt-3' : 'mt-0.5'}`}
                >
                  {!isTenant && (
                    <div className="shrink-0 w-7">
                      {isLastInGroup && (
                        <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">{brandInitials}</div>
                      )}
                    </div>
                  )}
                  <div className={`flex flex-col ${isTenant ? 'items-end' : 'items-start'} max-w-[72%]`}>
                    <div className="relative">
                      <div className={`px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                        isTenant
                          ? `bg-blue-600 text-white shadow-sm ${isLastInGroup ? 'rounded-[20px] rounded-br-[5px]' : 'rounded-[20px]'}`
                          : `bg-white text-gray-900 border border-gray-200 shadow-sm ${isLastInGroup ? 'rounded-[20px] rounded-bl-[5px]' : 'rounded-[20px]'}`
                      }`}>
                        <MessageBody text={msg.text} isTenant={isTenant} />
                      </div>
                      {/* Hover actions */}
                      <div className={`absolute top-1/2 -translate-y-1/2 ${isTenant ? '-left-9' : '-right-9'} hidden group-hover:flex`}>
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpenId(menuOpenId === msg.id ? null : msg.id)}
                            className="w-6 h-6 rounded-full bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center shadow-sm"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                          {menuOpenId === msg.id && (
                            <div className={`absolute ${isTenant ? 'right-8' : 'left-8'} top-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 w-28`}>
                              {isTenant ? (
                                <button
                                  onClick={() => unsendMessage(msg.id)}
                                  className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <X className="w-3.5 h-3.5" /> Unsend
                                </button>
                              ) : (
                                <button
                                  onClick={() => { setCompose(`@${msg.senderName} `); setMenuOpenId(null); composeRef.current?.focus() }}
                                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  Reply
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {isLastInGroup && (
                      <p className="text-[10px] text-gray-400 mt-1 mx-1">{formatSentAt(msg.sentAt)}</p>
                    )}
                  </div>
                  {isTenant && <div className="shrink-0 w-7" />}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Attachment strip */}
          {attachments.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 bg-white flex gap-2 flex-wrap shrink-0">
              {attachments.map((a, i) => (
                <div key={i} className="relative group/att">
                  {a.previewUrl ? (
                    <div className="relative">
                      <img src={a.previewUrl} className="w-16 h-16 rounded-xl object-cover border border-gray-200" alt={a.name} />
                      <button
                        onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-800 text-white rounded-full flex items-center justify-center opacity-0 group-hover/att:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs text-blue-700 font-medium">
                      <Paperclip className="w-3 h-3" />
                      <span className="max-w-[140px] truncate">{a.name}</span>
                      <span className="text-blue-400">{a.size}</span>
                      <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="text-blue-400 hover:text-blue-700 ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Compose bar */}
          <div className="px-4 py-3 border-t border-gray-200 bg-white shrink-0">
            <div className={`flex items-end gap-2 bg-gray-50 border rounded-2xl px-3 py-2 transition-all ${
              compose.trim() || attachments.length ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'
            }`}>
              <textarea
                ref={composeRef}
                rows={1}
                className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400 resize-none leading-relaxed max-h-28 overflow-y-auto"
                placeholder={`Message ${companyName}…`}
                value={compose}
                onChange={(e) => {
                  setCompose(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 112) + 'px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                }}
              />
              <div className="flex items-center gap-1 shrink-0 pb-0.5">
                <div ref={emojiRef} className="relative">
                  <button
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    className={`p-1.5 rounded-full transition-colors ${showEmojiPicker ? 'bg-yellow-100 text-yellow-500' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                    title="Emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-10 right-0 bg-white border border-gray-200 rounded-2xl shadow-xl p-3 z-30 w-[240px]">
                      <p className="text-xs font-semibold text-gray-500 mb-2 px-1">Emoji</p>
                      <div className="grid grid-cols-8 gap-1">
                        {EMOJI_LIST.map((e) => (
                          <button
                            key={e}
                            onClick={() => insertEmoji(e)}
                            className="w-7 h-7 text-lg hover:bg-gray-100 rounded-lg flex items-center justify-center transition-colors"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Attach file"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
                <button
                  onClick={sendMessage}
                  disabled={sending || (!compose.trim() && attachments.length === 0)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    compose.trim() || attachments.length
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {sending
                    ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">Press Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
          <MessageSquare className="w-12 h-12 opacity-30 mb-3" />
          <p className="text-sm font-semibold text-gray-600">No messages yet</p>
        </div>
      )}
    </div>
  )
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

function TenantDocumentsTab() {
  const { tenant, tenantId } = useContext(TenantCtx)
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null)
  const { data: realDocs, loading } = useDocuments(tenantId ?? undefined)

  // Sample documents shown in demo mode or before any real docs are uploaded
  const sampleDocs: DocItem[] = [
    { id: 'd-1', name: `Lease Agreement${tenant?.unit ? ` — Unit ${tenant.unit}` : ''}`, type: 'Lease', date: tenant?.moveIn || 'Jan 1, 2026', size: '245 KB' },
    { id: 'd-2', name: 'Move-In Inspection Report', type: 'Inspection', date: tenant?.moveIn || 'Jan 1, 2026', size: '118 KB' },
    { id: 'd-3', name: 'Latest Rent Receipt', type: 'Receipt', date: 'Jun 1, 2026', size: '42 KB' },
  ]

  const docs: DocItem[] = realDocs.length > 0
    ? realDocs.map((d) => ({ id: d.id, name: d.name, type: d.type, date: d.date, size: d.size }))
    : sampleDocs

  if (loading) {
    return (
      <div className="p-5 space-y-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="p-5">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {docs.map((d, i) => (
          <button
            key={d.id}
            onClick={() => setPreviewDoc(d)}
            className={`w-full flex items-center gap-3 px-5 py-4 text-left ${i < docs.length - 1 ? 'border-b border-gray-100' : ''} hover:bg-gray-50 transition-colors`}
          >
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{d.name}</p>
              <p className="text-xs text-gray-500">{d.type} · {d.date} · {d.size}</p>
            </div>
            <span className="text-xs font-semibold text-blue-600 shrink-0">View</span>
          </button>
        ))}
      </div>
      {previewDoc && <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TenantPortal() {
  const { data: tenant, tenantId, pmId, unitId } = useCurrentTenant()
  const { companyName } = useBranding()
  const { signOut } = useAuth()
  const { demoMode } = useDemoMode()
  const [activeTab, setActiveTab] = useLocalState<Tab>('bmp_tenant_tab', 'overview')
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false)

  async function handleTicketSubmit(data: MaintenanceFormStep1 & MaintenanceFormStep2) {
    if (demoMode) { showToast({ type: 'info', title: 'Demo mode — request not submitted' }); setShowMaintenanceModal(false); return }
    if (!tenantId || !pmId) return
    const { error } = await supabase.from('maintenance_requests').insert({
      pm_id: pmId,
      tenant_id: tenantId,
      unit_id: unitId,
      title: data.title,
      description: data.description,
      priority: (data.priority as 'low' | 'medium' | 'high' | 'emergency') || 'medium',
      status: 'open',
    })
    if (!error) {
      // Notify the property manager of the new request
      notifyUser(pmId, {
        type: 'maintenance',
        title: 'New maintenance request',
        body: `${tenant?.name ?? 'A tenant'} submitted "${data.title}"${tenant?.unit ? ` — Unit ${tenant.unit}` : ''}`,
        link: '/admin',
      })
    }
    setShowMaintenanceModal(false)
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Home className="w-4 h-4" /> },
    { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="w-4 h-4" /> },
    { id: 'payments', label: 'Payments', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'messages', label: 'Messages', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
  ]

  const panelFullHeight = activeTab === 'messages'

  return (
    <NotificationsProvider>
    <TenantCtx.Provider value={{ tenant, tenantId, pmId, unitId }}>
    <div className="min-h-screen bg-gray-50 flex">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 sticky top-0 h-screen overflow-y-auto" style={{ background: 'linear-gradient(180deg,#0F172A 0%,#1E293B 100%)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <BrandLogo wrapperClassName="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden" iconClassName="w-4 h-4 text-white" style={{ background: 'linear-gradient(135deg,#3B82F6 0%,#1D4ED8 100%)' }} />
          <div>
            <p className="text-white font-bold text-sm whitespace-nowrap tracking-tight">{companyName}</p>
            <p className="text-slate-500 text-[11px] font-medium uppercase tracking-wide">Tenant Portal</p>
          </div>
        </div>

        {/* Welcome */}
        <div className="px-4 pt-5 pb-3">
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-1">Welcome back</p>
          <p className="text-sm font-semibold text-white truncate">{tenant?.name.split(' ')[0] ?? '…'}</p>
          <p className="text-xs text-slate-500 truncate">{tenant ? `${tenant.property} · Unit ${tenant.unit}` : ''}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 mt-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left ${
                  isActive ? 'text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                }`}
                style={isActive ? { background: 'linear-gradient(135deg,#3B82F6 0%,#2563EB 100%)', boxShadow: '0 4px 12px rgba(59,130,246,0.35)' } : {}}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Profile + sign out */}
        <div className="mx-3 mb-4 mt-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-xs ring-2 ring-blue-500/40" style={{ background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)' }}>
              {tenant ? tenant.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '…'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{tenant?.name ?? '…'}</p>
              <p className="text-[11px] text-slate-500">Tenant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell align="left" />
            <button
              onClick={async () => { await signOut() }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-white/5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile + desktop main area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile header (hidden on desktop) */}
        <header className="md:hidden bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <BrandLogo wrapperClassName="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center overflow-hidden" iconClassName="w-4 h-4 text-white" />
            <div>
              <p className="font-bold text-gray-900 text-sm">{companyName}</p>
              <p className="text-xs text-gray-500">Tenant Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell align="right" />
            <button
              onClick={async () => { await signOut() }}
              className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full border border-gray-200 hover:border-red-200 hover:bg-red-50 transition-all"
            >
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-[10px]">
                {tenant ? tenant.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() : '…'}
              </div>
              <span className="text-xs font-semibold text-gray-700">{tenant ? tenant.name.split(' ')[0] : 'Me'}</span>
            </button>
          </div>
        </header>

        {/* Mobile welcome strip (hidden on desktop) */}
        <div className="md:hidden bg-white border-b border-gray-100 px-5 py-3">
          <p className="text-sm font-semibold text-gray-900">{tenant ? `Good morning, ${tenant.name.split(' ')[0]}` : 'Loading…'}</p>
          <p className="text-xs text-gray-500">{tenant ? `${tenant.property} · Unit ${tenant.unit}` : ''}</p>
        </div>

        {/* Desktop topbar (hidden on mobile) */}
        <header className="hidden md:flex bg-white border-b border-gray-200 px-6 h-[60px] items-center justify-between shrink-0 shadow-sm sticky top-0 z-30">
          <div>
            <h1 className="text-base font-bold text-gray-900 capitalize">
              {tabs.find(t => t.id === activeTab)?.label ?? 'Portal'}
            </h1>
            <p className="text-xs text-gray-500">{tenant ? `${tenant.property} · Unit ${tenant.unit}` : ''}</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-[10px]">
              {tenant ? tenant.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() : '…'}
            </div>
            {tenant?.name ?? '…'}
          </div>
        </header>

        {/* Mobile tab bar (hidden on desktop) */}
        <div className="md:hidden bg-white border-b-2 border-gray-200 px-4 sticky top-[73px] z-20 shadow-sm">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold whitespace-nowrap border-b-2 -mb-0.5 transition-all ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span className={activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div
          className={`flex-1 ${panelFullHeight ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}
          style={panelFullHeight ? { height: 'calc(100vh - 60px)' } : {}}
        >
          {activeTab === 'overview' && <OverviewTab onNewTicket={() => setShowMaintenanceModal(true)} />}
          {activeTab === 'maintenance' && <MaintenanceListTab onNew={() => setShowMaintenanceModal(true)} />}
          {activeTab === 'payments' && <PaymentsTab />}
          {activeTab === 'messages' && <TenantMessagesTab />}
          {activeTab === 'documents' && <TenantDocumentsTab />}
        </div>
      </div>

      {/* Maintenance Modal */}
      {showMaintenanceModal && (
        <MaintenanceModal
          onClose={() => setShowMaintenanceModal(false)}
          onSubmit={handleTicketSubmit}
        />
      )}
    </div>
    </TenantCtx.Provider>
    </NotificationsProvider>
  )
}
