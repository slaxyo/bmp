import { useState, useRef, useEffect } from 'react'
import {
  Home, DollarSign, Wrench, MessageSquare, FileText, Bell,
  ChevronRight, Check, X, Plus, Send, Smile, Paperclip,
  Edit2, MoreHorizontal, Upload, CreditCard, Building2,
} from 'lucide-react'
import type { ChatMessage } from '../data/mockData'
import { chatMessages, maintenanceTickets } from '../data/mockData'
import { showToast } from '../components/Toast'

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

function MaintenanceModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: MaintenanceFormStep1 & MaintenanceFormStep2) => void }) {
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [ticketId] = useState(`MT-${String(Math.floor(Math.random() * 900) + 100)}`)

  const [step1, setStep1] = useState<MaintenanceFormStep1>({
    issueType: '',
    location: '',
    priority: '',
    title: '',
    description: '',
    startDate: '',
    gettingWorse: null,
  })
  const [step2, setStep2] = useState<MaintenanceFormStep2>({
    entryPermission: '',
    preferredTimes: [],
    contactMethod: '',
    photos: [],
    notes: '',
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
    if (Object.keys(e).length > 0) {
      setErrors(e)
      return
    }
    setErrors({})
    setStep(2)
  }

  function handleSubmit() {
    setSubmitted(true)
    onSubmit({ ...step1, ...step2 })
    showToast({ type: 'demo', title: `Maintenance request ${ticketId} submitted` })
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
    setStep2((prev) => ({
      ...prev,
      photos: [...prev.photos, ...files.map((f) => f.name)].slice(0, 4),
    }))
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Request Submitted</h2>
          <p className="text-sm text-gray-500 mb-4">Ticket ID: <span className="font-mono font-bold text-blue-600">{ticketId}</span></p>
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 text-sm mb-6">
            <div className="flex justify-between"><span className="text-gray-500">Issue</span><span className="font-semibold">{step1.title}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-semibold">{step1.issueType}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Location</span><span className="font-semibold">{step1.location}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Priority</span><span className="font-semibold">{step1.priority}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Entry</span><span className="font-semibold text-right max-w-[60%]">{step2.entryPermission || 'Not specified'}</span></div>
          </div>
          <p className="text-xs text-gray-500 mb-6">We'll contact you via {step2.contactMethod || 'In-App'} once a technician is scheduled.</p>
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900">New Maintenance Request</h2>
            <p className="text-xs text-gray-500">Step {step} of 2</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Progress bar */}
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
                    {['Plumbing', 'Electrical', 'HVAC', 'Appliance', 'Structural', 'Pest Control', 'Landscaping', 'Other'].map(o => <option key={o}>{o}</option>)}
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
                    {['Kitchen', 'Bathroom (Primary)', 'Bathroom (Secondary)', 'Bedroom', 'Living Room', 'Hallway/Entry', 'Balcony/Patio', 'Outside/Common Area'].map(o => <option key={o}>{o}</option>)}
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
                  {['Morning (8am–12pm)', 'Afternoon (12pm–5pm)', 'Evening (5pm–8pm)', 'Weekends'].map((t) => (
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
                  {['In-App', 'Email', 'Phone'].map((m) => (
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

              {/* Photo upload */}
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

// ─── Receipt Modal ────────────────────────────────────────────────────────────

function ReceiptModal({ row, onClose }: { row: PaymentRow; onClose: () => void }) {
  const year = row.datePaid.split(', ')[1] ?? '2026'
  const monthNum = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    .indexOf(row.datePaid.split(' ')[0]) + 1
  const rand3 = String(Math.floor(Math.random() * 900) + 100)
  const receiptNo = `RCPT-${year}${String(monthNum).padStart(2,'0')}${rand3}`

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md">
        {/* BMP header */}
        <div className="bg-blue-600 rounded-t-xl px-6 py-4 text-white">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5" />
            <span className="font-bold text-lg">BMP Central</span>
          </div>
          <p className="text-blue-200 text-xs">Oakwood Property Management</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Payment Receipt</h2>
            <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full">PAID</span>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Receipt #</span>
              <span className="font-mono font-semibold text-gray-900">{receiptNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">From</span>
              <span className="font-semibold text-gray-900">BMP Central</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">To</span>
              <span className="font-semibold text-gray-900">Sarah Mitchell</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Unit</span>
              <span className="font-semibold text-gray-900">Unit 4B, 820 Maple Street</span>
            </div>
            <div className="h-px bg-gray-200" />
            <div className="flex justify-between">
              <span className="text-gray-500">Description</span>
              <span className="font-semibold text-gray-900">Monthly Rent — {row.month}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="text-xl font-black text-gray-900">${row.amount.toLocaleString()}.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date Paid</span>
              <span className="font-semibold text-gray-900">{row.datePaid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Method</span>
              <span className="font-semibold text-gray-900">Bank of America ···4821</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => showToast({ type: 'demo', title: 'Print receipt (demo)' })}
              className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Print
            </button>
            <button onClick={onClose} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Close</button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Add Payment Method Modal ─────────────────────────────────────────────────

function AddPaymentMethodModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'bank' | 'card'>('bank')
  const [bank, setBank] = useState({ bankName: '', accountHolder: '', accountNumber: '', routing: '', accountType: 'Checking' })
  const [card, setCard] = useState({ cardNumber: '', nameOnCard: '', expiry: '', cvv: '' })

  function handleAdd() {
    showToast({ type: 'demo', title: 'Payment method saved. This is a demo — no real account was added.' })
    onClose()
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Add Payment Method</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 border border-gray-200 rounded-xl p-1 bg-gray-50">
            {(['bank', 'card'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t === 'bank' ? 'Bank Account' : 'Credit/Debit Card'}
              </button>
            ))}
          </div>
          {tab === 'bank' ? (
            <div className="space-y-3">
              {([
                { key: 'bankName', label: 'Bank Name' },
                { key: 'accountHolder', label: 'Account Holder Name' },
                { key: 'accountNumber', label: 'Account Number' },
                { key: 'routing', label: 'Routing Number' },
              ] as const).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input
                    value={bank[key]}
                    onChange={(e) => setBank({ ...bank, [key]: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Account Type</label>
                <select
                  value={bank.accountType}
                  onChange={(e) => setBank({ ...bank, accountType: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option>Checking</option>
                  <option>Savings</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {([
                { key: 'cardNumber', label: 'Card Number' },
                { key: 'nameOnCard', label: 'Name on Card' },
                { key: 'expiry', label: 'Expiry (MM/YY)' },
                { key: 'cvv', label: 'CVV' },
              ] as const).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input
                    value={card[key]}
                    onChange={(e) => setCard({ ...card, [key]: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={handleAdd} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Add Method</button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Lease Viewer Modal ───────────────────────────────────────────────────────

function LeaseViewerModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-blue-600 rounded-t-xl px-6 py-4 text-white flex items-center justify-between">
          <div>
            <p className="font-bold text-lg">Residential Lease Agreement</p>
            <p className="text-blue-200 text-xs mt-0.5">BMP Central · Oakwood Property Management</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-blue-500 hover:bg-blue-400 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Landlord</p>
              <p className="font-semibold text-gray-900">BMP Central</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Tenant</p>
              <p className="font-semibold text-gray-900">Sarah Mitchell</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">Property</p>
            <p className="font-semibold text-gray-900">Unit 4B, 820 Maple Street, Austin TX 78701</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Lease Term</p>
              <p className="font-semibold text-gray-900">Jan 1, 2026 – Dec 31, 2026</p>
              <p className="text-xs text-gray-500">12 months</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Monthly Rent</p>
              <p className="font-semibold text-gray-900">$1,450</p>
              <p className="text-xs text-gray-500">Due on the 1st of each month</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">Security Deposit</p>
            <p className="font-semibold text-gray-900">$1,450 — Held on file</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Key Clauses</p>
            <ul className="space-y-2">
              {[
                'No smoking permitted on the premises or within 25 feet of any entrance.',
                'Pets must be approved in writing. A pet deposit of $500 is required per approved pet.',
                'Tenant is responsible for maintaining the unit in a clean and sanitary condition.',
                'Subletting is not permitted without prior written consent from BMP Central.',
              ].map((clause, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-700">
                  <span className="text-blue-600 font-bold shrink-0">{i + 1}.</span>
                  {clause}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => showToast({ type: 'demo', title: 'Lease PDF download (demo)' })}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Download PDF
            </button>
            <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Close</button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────

function PaymentsTab() {
  const [autopay, setAutopay] = useState(true)
  const [receiptRow, setReceiptRow] = useState<PaymentRow | null>(null)
  const [showAddPayment, setShowAddPayment] = useState(false)

  const cashFlowRows: PaymentRow[] = [
    { month: 'Jan 2026', amount: 1450, datePaid: 'Jan 2, 2026', method: 'ACH', status: 'paid' },
    { month: 'Feb 2026', amount: 1450, datePaid: 'Feb 1, 2026', method: 'ACH', status: 'paid' },
    { month: 'Mar 2026', amount: 1450, datePaid: 'Mar 1, 2026', method: 'ACH', status: 'paid' },
    { month: 'Apr 2026', amount: 1450, datePaid: 'Apr 1, 2026', method: 'ACH', status: 'paid' },
    { month: 'May 2026', amount: 1450, datePaid: 'May 1, 2026', method: 'ACH', status: 'paid' },
    { month: 'Jun 2026', amount: 1450, datePaid: 'Jun 1, 2026', method: 'ACH', status: 'paid' },
    { month: 'Dec 2025', amount: 1450, datePaid: 'Dec 1, 2025', method: 'ACH', status: 'paid' },
    { month: 'Nov 2025', amount: 1450, datePaid: 'Nov 1, 2025', method: 'ACH', status: 'paid' },
  ]

  return (
    <div className="p-6 space-y-5">
      {/* Current Payment Card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-blue-200 text-sm font-medium">Current Month</p>
            <p className="text-4xl font-black mt-1">$1,450</p>
          </div>
          <span className="px-3 py-1 bg-green-400 text-green-900 text-xs font-bold rounded-full">
            PAID · June 2026
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-blue-500">
          <div>
            <p className="text-blue-300 text-xs">Due Date</p>
            <p className="text-white font-semibold text-sm mt-0.5">June 15, 2026</p>
          </div>
          <div>
            <p className="text-blue-300 text-xs">Next Payment</p>
            <p className="text-white font-semibold text-sm mt-0.5">July 15, 2026</p>
          </div>
          <div>
            <p className="text-blue-300 text-xs">Amount Due</p>
            <p className="text-white font-semibold text-sm mt-0.5">$1,450</p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-blue-500">
          <div className="flex items-center gap-2">
            <span className="text-sm text-blue-100">{autopay ? 'Autopay ON · Bank of America ···4821' : 'Autopay is OFF'}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setAutopay(!autopay)
                showToast({ type: 'demo', title: `Autopay ${!autopay ? 'enabled' : 'disabled'}` })
              }}
              className={`relative w-10 h-6 rounded-full transition-colors ${autopay ? 'bg-green-400' : 'bg-blue-400'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autopay ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <button
              onClick={() => showToast({ type: 'demo', title: 'Edit autopay settings' })}
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
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Month</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date Paid</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Method</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Receipt</th>
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
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">Paid</span>
                </td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => setReceiptRow(r)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Two-column cards */}
      <div className="grid grid-cols-2 gap-5">
        {/* Lease Summary */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Lease Summary</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Lease Term</span>
              <span className="font-semibold">Jan 1 – Dec 31, 2026</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Paid (6 months)</span>
              <span className="font-semibold text-green-600">$8,700</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Remaining (6 months)</span>
              <span className="font-semibold">$8,700</span>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="flex justify-between">
              <span className="text-gray-500">Security Deposit</span>
              <span className="font-semibold">$1,450 · Held on file</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Lease progress</span>
              <span>50%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: '50%' }} />
            </div>
          </div>
        </div>

        {/* Payment Methods */}
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
            onClick={() => setShowAddPayment(true)}
            className="w-full border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-500 hover:text-blue-600 text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Payment Method
          </button>
        </div>
      </div>

      {receiptRow && <ReceiptModal row={receiptRow} onClose={() => setReceiptRow(null)} />}
      {showAddPayment && <AddPaymentMethodModal onClose={() => setShowAddPayment(false)} />}
    </div>
  )
}

// ─── Messages Tab ─────────────────────────────────────────────────────────────

function TenantMessagesTab() {
  const [messages, setMessages] = useState<ChatMessage[]>(chatMessages.filter((m) => m.threadId === 'thread-1'))
  const [compose, setCompose] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [editedPopoverId, setEditedPopoverId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  function sendMessage() {
    if (!compose.trim()) return
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        threadId: 'thread-1',
        senderId: 'tenant',
        senderName: 'Sarah Mitchell',
        text: compose.trim(),
        timestamp: 'Just now',
        edited: false,
        unsent: false,
      },
    ])
    setCompose('')
    showToast({ type: 'demo', title: 'Message sent' })
  }

  function saveEdit(id: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, edited: true, originalText: m.text, text: editText } : m
      )
    )
    setEditingId(null)
    showToast({ type: 'demo', title: 'Message edited' })
  }

  function unsend(id: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unsent: true } : m)))
    setMenuOpenId(null)
    showToast({ type: 'demo', title: 'Message unsent' })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-200 bg-white flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
          BC
        </div>
        <div>
          <p className="font-semibold text-gray-900">BMP Central</p>
          <p className="text-xs text-gray-500">Property Management</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isTenant = msg.senderId === 'tenant'

          if (msg.unsent) {
            return (
              <div key={msg.id} className="flex justify-center">
                <p className="text-xs text-gray-400 italic line-through">Message unsent</p>
              </div>
            )
          }

          if (editingId === msg.id) {
            return (
              <div key={msg.id} className={`flex ${isTenant ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[70%] space-y-2">
                  <input
                    className="w-full px-3 py-2 text-sm border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(msg.id)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg font-semibold">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 px-3 py-1 rounded-lg border border-gray-200">Cancel</button>
                  </div>
                </div>
              </div>
            )
          }

          return (
            <div key={msg.id} className={`flex items-end gap-2 group ${isTenant ? 'justify-end' : 'justify-start'}`}>
              {!isTenant && (
                <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                  BC
                </div>
              )}
              <div className={`flex flex-col ${isTenant ? 'items-end' : 'items-start'} max-w-[70%]`}>
                {!isTenant && <p className="text-xs text-gray-500 mb-0.5 ml-1">BMP Central</p>}
                <div className="relative">
                  <div className={`px-3 py-2 rounded-2xl text-sm ${isTenant ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm'}`}>
                    {msg.text}
                    {msg.edited && (
                      <span className="relative">
                        <button
                          onClick={() => setEditedPopoverId(editedPopoverId === msg.id ? null : msg.id)}
                          className={`text-xs italic ml-1.5 ${isTenant ? 'text-blue-200' : 'text-gray-400'} hover:underline`}
                        >
                          (edited)
                        </button>
                        {editedPopoverId === msg.id && (
                          <div className="absolute bottom-full left-0 mb-1 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 w-[200px] z-10 shadow-lg">
                            <p className="font-semibold mb-0.5">Original:</p>
                            <p className="opacity-80">{msg.originalText}</p>
                          </div>
                        )}
                      </span>
                    )}
                  </div>
                  {isTenant && (
                    <div className="absolute top-1/2 -translate-y-1/2 -left-8 hidden group-hover:flex">
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === msg.id ? null : msg.id)}
                          className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        {menuOpenId === msg.id && (
                          <div className="absolute right-8 top-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 w-24">
                            <button
                              onClick={() => { setEditingId(msg.id); setEditText(msg.text); setMenuOpenId(null) }}
                              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </button>
                            <button
                              onClick={() => unsend(msg.id)}
                              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <X className="w-3.5 h-3.5" /> Unsend
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{msg.timestamp}</p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose bar */}
      <div className="p-4 border-t border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2">
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
            placeholder="Message BMP Central…"
            value={compose}
            onChange={(e) => setCompose(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          />
          <button onClick={() => showToast({ type: 'info', title: 'Emoji picker coming soon' })} className="text-gray-400 hover:text-gray-600 p-1">
            <Smile className="w-5 h-5" />
          </button>
          <button onClick={() => showToast({ type: 'demo', title: 'File attached (demo)' })} className="text-gray-400 hover:text-gray-600 p-1">
            <Paperclip className="w-5 h-5" />
          </button>
          <button
            onClick={sendMessage}
            disabled={!compose.trim()}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${compose.trim() ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ onNewTicket }: { onNewTicket: () => void }) {
  const myTickets = maintenanceTickets.filter((t) => t.tenantId === 't-1')

  return (
    <div className="p-5 space-y-5">
      {/* Rent card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <p className="text-blue-200 text-sm font-medium">June 2026 Rent</p>
          <span className="px-2.5 py-1 bg-green-400 text-green-900 text-xs font-bold rounded-full">PAID</span>
        </div>
        <p className="text-3xl font-black">$1,450</p>
        <p className="text-blue-200 text-xs mt-1">Next payment: July 15, 2026</p>
      </div>

      {/* Lease info */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Lease Details</h3>
        <div className="space-y-2">
          {[
            { label: 'Unit', value: '1A — 14 Oakwood Drive, Austin TX' },
            { label: 'Lease Term', value: 'Jan 1, 2026 – Dec 31, 2026' },
            { label: 'Monthly Rent', value: '$1,450' },
            { label: 'Move-in Date', value: 'January 1, 2026' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{label}</span>
              <span className="font-semibold text-gray-900">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent tickets */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Maintenance Requests</h3>
          <button
            onClick={onNewTicket}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> New Request
          </button>
        </div>
        {myTickets.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No open maintenance requests</p>
        ) : (
          <div className="space-y-3">
            {myTickets.map((t) => (
              <div key={t.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${t.status === 'open' ? 'bg-blue-500' : t.status === 'in_progress' ? 'bg-amber-500' : 'bg-green-500'}`} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.category} · {t.createdAt}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  t.status === 'open' ? 'bg-blue-100 text-blue-700' :
                  t.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {t.status === 'in_progress' ? 'In Progress' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

function TenantDocumentsTab() {
  const [showLeaseViewer, setShowLeaseViewer] = useState(false)

  const docs = [
    { name: 'Lease Agreement — Unit 1A', type: 'Lease', date: 'Jan 1, 2026', size: '245 KB', isLease: true },
    { name: 'Move-In Inspection Report', type: 'Report', date: 'Jan 1, 2026', size: '1.2 MB', isLease: false },
    { name: 'Community Rules & Regulations', type: 'Policy', date: 'Jan 1, 2026', size: '189 KB', isLease: false },
    { name: 'Rent Receipt — June 2026', type: 'Receipt', date: 'Jun 1, 2026', size: '42 KB', isLease: false },
  ]

  return (
    <div className="p-5">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {docs.map((d, i) => (
          <div key={i} className={`flex items-center gap-3 px-5 py-4 ${i < docs.length - 1 ? 'border-b border-gray-100' : ''} hover:bg-gray-50 transition-colors`}>
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{d.name}</p>
              <p className="text-xs text-gray-500">{d.type} · {d.date} · {d.size}</p>
            </div>
            <button
              onClick={() => {
                if (d.isLease) setShowLeaseViewer(true)
                else showToast({ type: 'demo', title: `Downloading ${d.name}` })
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              {d.isLease ? 'View Lease' : 'Download'}
            </button>
          </div>
        ))}
      </div>
      {showLeaseViewer && <LeaseViewerModal onClose={() => setShowLeaseViewer(false)} />}
    </div>
  )
}

// ─── Maintenance Tab ──────────────────────────────────────────────────────────

function MaintenanceListTab({ onNew }: { onNew: () => void }) {
  const myTickets = maintenanceTickets.filter((t) => t.tenantId === 't-1')

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-900">Your Requests</h2>
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
        <div className="space-y-3">
          {myTickets.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.id} · {t.category} · {t.unit}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                  t.status === 'open' ? 'bg-blue-100 text-blue-700' :
                  t.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {t.status === 'in_progress' ? 'In Progress' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                </span>
              </div>
              <p className="text-sm text-gray-600">{t.description}</p>
              <p className="text-xs text-gray-400 mt-2">Submitted {t.createdAt}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TenantPortal() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false)

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Home className="w-4 h-4" /> },
    { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="w-4 h-4" /> },
    { id: 'payments', label: 'Payments', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'messages', label: 'Messages', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
  ]

  const panelFullHeight = activeTab === 'messages'

  function handleSubmitTicket() {
    setShowMaintenanceModal(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">BMP Central</p>
            <p className="text-xs text-gray-500">Tenant Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center relative transition-colors">
            <Bell className="w-4 h-4 text-gray-500" />
          </button>
          <div className="w-8 h-8 rounded-xl bg-green-500 flex items-center justify-center text-white font-bold text-xs">
            SM
          </div>
        </div>
      </header>

      {/* Welcome strip */}
      <div className="bg-white border-b border-gray-100 px-5 py-3">
        <p className="text-sm font-semibold text-gray-900">Good morning, Sarah</p>
        <p className="text-xs text-gray-500">14 Oakwood Drive · Unit 1A · Austin, TX</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-5 sticky top-[73px] z-20">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 ${panelFullHeight ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}
        style={panelFullHeight ? { height: 'calc(100vh - 148px)' } : {}}>
        {activeTab === 'overview' && <OverviewTab onNewTicket={() => setShowMaintenanceModal(true)} />}
        {activeTab === 'maintenance' && <MaintenanceListTab onNew={() => setShowMaintenanceModal(true)} />}
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'messages' && <TenantMessagesTab />}
        {activeTab === 'documents' && <TenantDocumentsTab />}
      </div>

      {/* Maintenance Modal */}
      {showMaintenanceModal && (
        <MaintenanceModal
          onClose={() => setShowMaintenanceModal(false)}
          onSubmit={handleSubmitTicket}
        />
      )}
    </div>
  )
}
