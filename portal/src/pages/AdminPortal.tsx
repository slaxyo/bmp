import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Users, Wrench, MessageSquare, FileText,
  Settings, ChevronLeft, ChevronRight, Plus, MoreHorizontal, Send,
  Smile, Paperclip, Edit2, Home, DollarSign, Bell, X,
  Eye, EyeOff, Camera, Pencil, CheckCircle, LogOut, HelpCircle,
  Keyboard, TrendingUp, BarChart2, AlertTriangle, Search, ChevronUp, ChevronDown,
  CreditCard, Receipt, AlertCircle, Trash2, Upload, ClipboardList,
  BedDouble, Bath, Maximize2, MapPin, Zap, ImageIcon, Star,
  TrendingDown, ArrowUpRight, ArrowDownLeft, Landmark, PiggyBank,
  Clock, Repeat, Phone, UserCheck, CalendarDays,
  Mail, PhoneCall, StickyNote, UserPlus, ClipboardCheck,
} from 'lucide-react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, BarChart, Bar,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import type { Thread, ChatMessage, Tenant, MaintenanceTicket, Property, RentRecord, ChecklistItem } from '../data/mockData'
import { occupancyData, revenueData, ticketsByMonth, ticketsByType, activityFeed as mockActivityFeed } from '../data/mockData'
import { useDemoMode } from '../context/DemoModeContext'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTenants } from '../hooks/useTenants'
import { useProperties } from '../hooks/useProperties'
import { useMaintenanceTickets } from '../hooks/useMaintenanceTickets'
import { useRentRecords } from '../hooks/useRentRecords'
import { useThreads } from '../hooks/useThreads'
import { useMessages } from '../hooks/useMessages'
import { useDocuments } from '../hooks/useDocuments'
import { showToast } from '../components/Toast'
import { useBranding } from '../context/BrandingContext'
import { BrandLogo } from '../components/BrandLogo'
import { NotificationBell } from '../components/NotificationBell'
import { NotificationsProvider } from '../hooks/useNotifications'
import { notifyUser, sendDirectEmail } from '../lib/notify'

// ─── Sidebar Nav Items ────────────────────────────────────────────────────────

type NavItem = {
  id: string
  label: string
  icon: React.ReactNode
  badge?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function Avatar({ name, photo, size = 'md' }: { name: string; photo?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500', 'bg-rose-500']
  const idx = name.charCodeAt(0) % colors.length
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'
  if (photo) {
    return <img src={photo} alt={name} className={`${sizeClass} rounded-full object-cover shrink-0`} />
  }
  return (
    <div className={`${sizeClass} ${colors[idx]} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}>
      {initials(name)}
    </div>
  )
}

// ─── Modal Backdrop ───────────────────────────────────────────────────────────

// Units are first-class rows in the DB; tenants link via unit_id
async function findOrCreateUnit(propertyId: string, unitNumber: string, rent: number | null): Promise<string | null> {
  const { data: existing } = await supabase
    .from('units')
    .select('id')
    .eq('property_id', propertyId)
    .eq('unit_number', unitNumber)
    .maybeSingle()
  if (existing) return existing.id as string
  const { data: { user } } = await supabase.auth.getUser()
  const { data: created, error } = await supabase
    .from('units')
    .insert({ property_id: propertyId, unit_number: unitNumber, rent_amount: rent, status: 'occupied', pm_id: user?.id })
    .select('id')
    .single()
  if (error) return null
  return created.id as string
}

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

// ─── Invite Tenant Modal ──────────────────────────────────────────────────────

interface InviteTenantModalProps {
  properties: Property[]
  onClose: () => void
  onAdd: (tenant: Tenant) => void
}

function InviteTenantModal({ properties, onClose, onAdd }: InviteTenantModalProps) {
  const { demoMode } = useDemoMode()
  const [form, setForm] = useState({
    name: '', email: '', phone: '', unit: '', property: '', rent: '', leaseStart: '', leaseEnd: '',
    emergencyName: '', emergencyPhone: '', moveIn: '', deposit: '', petPolicy: 'No Pets', parking: '', notes: '',
    rentDueDay: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.email.trim()) e.email = 'Required'
    if (!form.unit.trim()) e.unit = 'Required'
    if (!form.property) e.property = 'Required'
    if (!form.rent || isNaN(Number(form.rent)) || Number(form.rent) < 1) e.rent = 'Required — enter monthly rent'
    return e
  }

  const [submitting, setSubmitting] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  async function handleSubmit() {
    if (demoMode) { showToast({ type: 'info', title: 'Demo mode — no changes saved' }); onClose(); return }
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    setSubmitting(true)
    const selectedProp = properties.find(p => p.id === form.property)
    const { data: { user: pmUser } } = await supabase.auth.getUser()
    const unitId = await findOrCreateUnit(form.property, form.unit.trim(), Number(form.rent))
    const inviteToken = crypto.randomUUID()

    const { data, error } = await supabase.from('tenants').insert({
      id: crypto.randomUUID(),
      pm_id: pmUser!.id,
      unit_id: unitId,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      monthly_rent: Number(form.rent),
      lease_start: form.leaseStart || null,
      lease_end: form.leaseEnd || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      status: 'invited',
      invite_token: inviteToken,
      notes: form.notes.trim() || null,
      rent_due_day: form.rentDueDay ? Number(form.rentDueDay) : null,
    }).select().single()

    setSubmitting(false)
    if (error) { showToast({ type: 'error', title: 'Failed to create invite: ' + error.message }); return }

    const newTenant: Tenant = {
      id: data.id,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      unit: form.unit.trim(),
      property: selectedProp?.name ?? '',
      propertyId: form.property,
      rent: Number(form.rent),
      leaseEnd: form.leaseEnd || 'TBD',
      status: 'invited',
      moveIn: form.leaseStart || '',
    }
    onAdd(newTenant)

    // Build invite link
    const link = `${window.location.origin}/invite?token=${inviteToken}`
    setInviteLink(link)

    // Send invite email via Edge Function (no-op if VITE_FUNCTIONS_URL not set)
    const htmlBody = `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#f3f4f6;padding:24px">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
        <div style="background:#2563EB;padding:20px 24px"><h1 style="margin:0;color:#fff;font-size:16px">You've been invited to your tenant portal</h1></div>
        <div style="padding:24px">
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">
            Your property manager has set up an account for you. Click the button below to create your password and access your portal.
          </p>
          <a href="${link}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:10px">Accept Invite &amp; Create Account</a>
          <p style="color:#9CA3AF;font-size:12px;margin:16px 0 0">Or copy this link: ${link}</p>
        </div>
      </div>
    </body></html>`
    sendDirectEmail(form.email.trim(), 'You\'ve been invited to your tenant portal', htmlBody).catch(() => {})
  }

  const fi = (key: keyof typeof form, label: string, type = 'text', req = false) => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}{req && ' *'}</label>
      <input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[key] ? 'border-red-400' : 'border-gray-200'}`} />
      {errors[key] && <p className="text-xs text-red-500 mt-0.5">{errors[key]}</p>}
    </div>
  )

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Invite Tenant</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-6">
          {/* Photo */}
          <div className="flex items-center gap-4">
            <div className="relative cursor-pointer" onClick={() => photoRef.current?.click()}>
              {photoPreview ? (
                <img src={photoPreview} className="w-16 h-16 rounded-full object-cover" alt="preview" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e => {
                const f = e.target.files?.[0]; if (f) setPhotoPreview(URL.createObjectURL(f))
              }} />
            </div>
            <div><p className="text-sm font-medium text-gray-900">Profile Photo</p><p className="text-xs text-gray-500">Optional · JPG or PNG</p></div>
          </div>

          {/* Tenant Details */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tenant Details</p>
            <div className="grid grid-cols-2 gap-4">
              {fi('name', 'Full Name', 'text', true)}
              {fi('email', 'Email', 'email', true)}
              {fi('phone', 'Phone')}
              {fi('emergencyName', 'Emergency Contact Name')}
              {fi('emergencyPhone', 'Emergency Contact Phone')}
              {fi('unit', 'Unit', 'text', true)}
            </div>
          </div>

          {/* Lease Details */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Lease Details</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Property *</label>
                <select value={form.property} onChange={(e) => setForm({ ...form, property: e.target.value })}
                  className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.property ? 'border-red-400' : 'border-gray-200'}`}>
                  <option value="">Select property…</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {errors.property && <p className="text-xs text-red-500 mt-0.5">{errors.property}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {fi('rent', 'Monthly Rent ($)', 'number', true)}
                {fi('deposit', 'Security Deposit ($)', 'number')}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Rent Due Day <span className="font-normal text-gray-400">(optional)</span></label>
                <select value={form.rentDueDay} onChange={e => setForm({ ...form, rentDueDay: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">No reminder set</option>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of each month</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Tenant sees a "Due Today" reminder on this day each month</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {fi('moveIn', 'Move-in Date', 'date')}
                {fi('leaseStart', 'Lease Start', 'date')}
                {fi('leaseEnd', 'Lease End', 'date')}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Pet Policy</label>
                  <select value={form.petPolicy} onChange={e => setForm({ ...form, petPolicy: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    {['No Pets', 'Cats Only', 'Dogs Only', 'Cats & Dogs', 'Any Pets'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                {fi('parking', 'Parking Spot')}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
          </div>

          {inviteLink ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Invite created!</p>
                  <p className="text-xs text-green-700">Email sent if configured — share this link manually as a backup:</p>
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <p className="text-xs text-gray-700 flex-1 truncate font-mono">{inviteLink}</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(inviteLink); showToast({ type: 'success', title: 'Link copied!' }) }}
                  className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Copy
                </button>
              </div>
              <button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Done</button>
            </div>
          ) : (
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                {submitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {submitting ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Add Property Modal ───────────────────────────────────────────────────────

interface AddPropertyModalProps {
  onClose: () => void
  onAdd: (property: Property) => void
}

function AddPropertyModal({ onClose, onAdd }: AddPropertyModalProps) {
  const { demoMode } = useDemoMode()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    propertyName: '', address: '', city: '', state: '', zip: '', propertyType: 'Apartment Complex', units: '', yearBuilt: '',
    purchasePrice: '', mortgage: '', tax: '', insurance: '', managementFee: '10', targetRent: '',
    amenities: [] as string[], notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const amenityOptions = ['Parking', 'Laundry', 'Pet-Friendly', 'Pool', 'Gym', 'Storage', 'EV Charging', 'Elevator']

  function validateStep1() {
    const e: Record<string, string> = {}
    if (!form.address.trim()) e.address = 'Required'
    if (!form.city.trim()) e.city = 'Required'
    if (!form.units || Number(form.units) < 1) e.units = 'Must be at least 1'
    return e
  }

  function handleNext() {
    if (step === 1) {
      const e = validateStep1()
      if (Object.keys(e).length > 0) { setErrors(e); return }
      setErrors({})
    }
    setStep(s => s + 1)
  }

  async function handleSubmit() {
    if (demoMode) { showToast({ type: 'info', title: 'Demo mode — no changes saved' }); onClose(); return }
    const name = form.propertyName.trim() || form.address.trim()
    const { data: { user: pmUser } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('properties').insert({
      pm_id: pmUser!.id,
      name,
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim() || 'TX',
      zip: form.zip?.trim() || '',
      mortgage_payment: form.mortgage ? Number(form.mortgage) : null,
      tax_monthly: form.tax ? Number(form.tax) : null,
      insurance_monthly: form.insurance ? Number(form.insurance) : null,
    }).select().single()
    if (error) { showToast({ type: 'error', title: 'Failed to add property: ' + error.message }); return }
    // Unit count lives in the units table, not on properties — create one row per unit
    const unitCount = Number(form.units) || 1
    await supabase.from('units').insert(
      Array.from({ length: unitCount }, (_, i) => ({
        property_id: data.id,
        pm_id: pmUser!.id,
        unit_number: String(i + 1),
        rent_amount: form.targetRent ? Number(form.targetRent) : null,
        status: 'vacant',
      }))
    )
    const newProp: Property = {
      id: data.id,
      name,
      address: form.address.trim(),
      city: `${form.city}, ${form.state}`,
      units: Number(form.units),
      occupied: 0,
      monthlyIncome: form.targetRent ? Number(form.targetRent) * Number(form.units) : 0,
      openTickets: 0,
      tenants: [],
    }
    onAdd(newProp)
    showToast({ type: 'success', title: `Property "${newProp.name}" added` })
    onClose()
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Add Property</h2>
            <p className="text-xs text-gray-500">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        {/* Step indicator */}
        <div className="px-6 pt-4 flex gap-2">
          {[1,2,3].map(s => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          ))}
        </div>
        <div className="p-6 space-y-4">
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              {([
                ['propertyName', 'Property Name', 'text'],
                ['address', 'Street Address *', 'text'],
              ] as [keyof typeof form, string, string][]).map(([key, label, type]) => (
                <div key={key as string}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input type={type} value={String(form[key])} onChange={e => setForm({...form, [key]: e.target.value})}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[key as string] ? 'border-red-400' : 'border-gray-200'}`} />
                  {errors[key as string] && <p className="text-xs text-red-500 mt-0.5">{errors[key as string]}</p>}
                </div>
              ))}
              <div className="grid grid-cols-3 gap-3">
                {([['city','City *'],['state','State'],['zip','Zip']] as [keyof typeof form, string][]).map(([k,l]) => (
                  <div key={k as string}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{l}</label>
                    <input value={String(form[k])} onChange={e => setForm({...form, [k]: e.target.value})}
                      className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[k as string] ? 'border-red-400' : 'border-gray-200'}`} />
                    {errors[k as string] && <p className="text-xs text-red-500 mt-0.5">{errors[k as string]}</p>}
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Property Type</label>
                <select value={form.propertyType} onChange={e => setForm({...form, propertyType: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {['Apartment Complex','Multi-Family','Single-Family','Townhouse','Commercial'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Number of Units *</label>
                  <input type="number" min={1} value={form.units} onChange={e => setForm({...form, units: e.target.value})}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.units ? 'border-red-400' : 'border-gray-200'}`} />
                  {errors.units && <p className="text-xs text-red-500 mt-0.5">{errors.units}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Year Built</label>
                  <input type="number" value={form.yearBuilt} onChange={e => setForm({...form, yearBuilt: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              {([
                ['purchasePrice','Purchase Price ($)'],['mortgage','Monthly Mortgage ($)'],
                ['tax','Property Tax (annual $)'],['insurance','Insurance (annual $)'],
                ['managementFee','Management Fee (%)'],['targetRent','Target Monthly Rent per Unit ($)'],
              ] as [keyof typeof form, string][]).map(([k, l]) => (
                <div key={k as string}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{l}</label>
                  <input type="number" value={String(form[k])} onChange={e => setForm({...form, [k]: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Amenities</label>
                <div className="grid grid-cols-2 gap-2">
                  {amenityOptions.map(a => (
                    <label key={a} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={form.amenities.includes(a)}
                        onChange={() => setForm(f => ({...f, amenities: f.amenities.includes(a) ? f.amenities.filter(x=>x!==a) : [...f.amenities, a]}))}
                        className="rounded" />
                      {a}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            {step > 1 ? (
              <button onClick={() => setStep(s => s - 1)} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Back</button>
            ) : (
              <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Cancel</button>
            )}
            {step < 3 ? (
              <button onClick={handleNext} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Next</button>
            ) : (
              <button onClick={handleSubmit} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Add Property</button>
            )}
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── New Ticket Modal ─────────────────────────────────────────────────────────

interface NewTicketModalProps {
  tenants: Tenant[]
  onClose: () => void
  onAdd: (ticket: MaintenanceTicket) => void
}

function NewTicketModal({ tenants, onClose, onAdd }: NewTicketModalProps) {
  const { demoMode } = useDemoMode()
  const [form, setForm] = useState({ tenantId: '', issueType: '', priority: '', summary: '', description: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleSubmit() {
    if (demoMode) { showToast({ type: 'info', title: 'Demo mode — no changes saved' }); onClose(); return }
    const e: Record<string, string> = {}
    if (!form.summary.trim()) e.summary = 'Required'
    if (!form.issueType) e.issueType = 'Required'
    if (!form.priority) e.priority = 'Required'
    if (Object.keys(e).length > 0) { setErrors(e); return }
    const tenant = tenants.find((t) => t.id === form.tenantId)
    const priorityMap: Record<string, MaintenanceTicket['priority']> = {
      Low: 'low', Medium: 'medium', High: 'high', Urgent: 'emergency',
    }
    const { data: { user: pmUser } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('maintenance_requests').insert({
      pm_id: pmUser!.id,
      tenant_id: tenant?.id ?? null,
      title: form.summary.trim(),
      description: form.description.trim(),
      priority: priorityMap[form.priority] ?? 'medium',
      status: 'open',
    }).select().single()
    if (error) { showToast({ type: 'error', title: 'Failed to create ticket: ' + error.message }); return }
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const newTicket: MaintenanceTicket = {
      id: data.id,
      tenantId: tenant?.id ?? '',
      tenantName: tenant?.name ?? 'Unassigned',
      unit: tenant?.unit ?? '-',
      property: tenant?.property ?? '-',
      category: form.issueType,
      title: form.summary.trim(),
      description: form.description.trim(),
      priority: priorityMap[form.priority] ?? 'medium',
      status: 'open',
      createdAt: today,
      updatedAt: today,
    }
    onAdd(newTicket)
    showToast({ type: 'success', title: `Ticket ${data.id} created` })
    onClose()
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New Maintenance Ticket</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tenant</label>
            <select
              value={form.tenantId}
              onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Select tenant (optional)…</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name} — Unit {t.unit}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Issue Type *</label>
            <select
              value={form.issueType}
              onChange={(e) => setForm({ ...form, issueType: e.target.value })}
              className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.issueType ? 'border-red-400' : 'border-gray-200'}`}
            >
              <option value="">Select type…</option>
              {['Plumbing', 'Electrical', 'HVAC', 'Appliance', 'Structural', 'Other'].map((o) => <option key={o}>{o}</option>)}
            </select>
            {errors.issueType && <p className="text-xs text-red-500 mt-0.5">{errors.issueType}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Priority *</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.priority ? 'border-red-400' : 'border-gray-200'}`}
            >
              <option value="">Select priority…</option>
              {['Low', 'Medium', 'High', 'Urgent'].map((o) => <option key={o}>{o}</option>)}
            </select>
            {errors.priority && <p className="text-xs text-red-500 mt-0.5">{errors.priority}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Issue Summary *</label>
            <input
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="Brief description of the issue"
              className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.summary ? 'border-red-400' : 'border-gray-200'}`}
            />
            {errors.summary && <p className="text-xs text-red-500 mt-0.5">{errors.summary}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Additional details…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={handleSubmit} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Create Ticket</button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Log Payment Modal ────────────────────────────────────────────────────────

interface LogPaymentModalProps {
  tenant: Tenant
  onClose: () => void
  onSave: (record: RentRecord) => void
}

function LogPaymentModal({ tenant, onClose, onSave }: LogPaymentModalProps) {
  const today = new Date()
  const months: string[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    months.push(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))
  }
  const todayStr = today.toISOString().slice(0, 10)
  const [form, setForm] = useState({
    month: months[0],
    amount: String(tenant.rent),
    datePaid: todayStr,
    method: 'ACH',
    notes: '',
    status: 'paid' as 'paid' | 'late' | 'pending',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    // Derive a due_date from the selected month string (e.g. "June 2026" → 2026-06-01)
    const parsed = new Date(form.month)
    const dueDate = isNaN(parsed.getTime())
      ? todayStr
      : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-01`

    const { data: { user: pmUser } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('rent_payments').insert({
      pm_id: pmUser!.id,
      tenant_id: tenant.id,
      amount: Number(form.amount),
      due_date: dueDate,
      paid_date: form.status !== 'pending' ? form.datePaid : null,
      status: form.status,
      note: form.notes.trim() || null,
    }).select().single()

    setSaving(false)
    if (error) {
      showToast({ type: 'error', title: 'Failed to log payment: ' + error.message })
      return
    }

    const record: RentRecord = {
      id: data.id,
      tenantId: tenant.id,
      month: form.month,
      amount: Number(form.amount),
      datePaid: form.status !== 'pending' ? new Date(form.datePaid).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
      method: form.method,
      status: form.status,
    }
    onSave(record)
    if (form.status === 'paid') {
      notifyUser(tenant.id, {
        type: 'payment',
        title: 'Payment confirmed',
        body: `Your ${form.month} rent payment of $${Number(form.amount).toLocaleString()} has been confirmed by your property manager.`,
        link: '/tenant',
      })
    }
    showToast({ type: 'success', title: `Payment logged for ${tenant.name} — ${form.month}` })
    onClose()
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Log Rent Payment</h2>
            <p className="text-xs text-gray-500">{tenant.name} · Unit {tenant.unit} · {tenant.property}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <Receipt className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Expected rent: ${tenant.rent.toLocaleString()}/mo</p>
              <p className="text-xs text-blue-600">Lease ends {tenant.leaseEnd}</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Rent Period</label>
            <select value={form.month} onChange={e => setForm({...form, month: e.target.value})}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Amount ($)</label>
              <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date Paid</label>
              <input type="date" value={form.datePaid} onChange={e => setForm({...form, datePaid: e.target.value})}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Payment Method</label>
              <select value={form.method} onChange={e => setForm({...form, method: e.target.value})}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {['ACH', 'Check', 'Cash', 'Venmo', 'Zelle', 'Credit Card', 'Money Order', 'Other'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value as 'paid'|'late'|'pending'})}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="paid">Paid</option>
                <option value="late">Late</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2}
              placeholder="Optional notes about this payment…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} disabled={saving} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
              {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CreditCard className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Log Payment'}
            </button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Property Tickets Modal ───────────────────────────────────────────────────

interface PropertyTicketsModalProps {
  property: Property
  tickets: MaintenanceTicket[]
  onClose: () => void
  onViewTicket: (ticketId: string) => void
}

function PropertyTicketsModal({ property, tickets, onClose, onViewTicket }: PropertyTicketsModalProps) {
  const propTickets = tickets.filter(t => t.property === property.name)
  const open = propTickets.filter(t => t.status === 'open').length
  const inProgress = propTickets.filter(t => t.status === 'in_progress').length

  const priorityColors: Record<string, string> = {
    emergency: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-gray-100 text-gray-600',
  }
  const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-xl max-h-[80vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Maintenance Tickets</h2>
            <p className="text-xs text-gray-500">{property.name} · {property.city}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        {propTickets.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex gap-3">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{open} Open</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{inProgress} In Progress</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{propTickets.length - open - inProgress} Resolved</span>
          </div>
        )}

        <div className="p-4">
          {propTickets.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400">No tickets for this property</p>
            </div>
          ) : (
            <div className="space-y-2">
              {propTickets.map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => { onViewTicket(ticket.id); onClose() }}
                  className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-xs font-mono text-gray-400">{ticket.id}</span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusColors[ticket.status]}`}>
                          {ticket.status === 'in_progress' ? 'In Progress' : ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${priorityColors[ticket.priority]}`}>
                          {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{ticket.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{ticket.tenantName} · Unit {ticket.unit} · {ticket.createdAt}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 shrink-0 mt-1 transition-colors" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2 line-clamp-1">{ticket.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Report Modal ─────────────────────────────────────────────────────────────

function ReportModal({ onClose }: { onClose: () => void }) {
  const { companyName } = useBranding()
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Monthly Report — June 2026</h2>
            <p className="text-xs text-gray-500">{companyName} · Admin Portal</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* Revenue breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Revenue by Property</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Property', 'Units', 'Occupied', 'Income'].map((h) => (
                    <th key={h} className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { name: '14 Oakwood Drive', units: 4, occupied: 4, income: 5800 },
                  { name: '7 Maple Lane', units: 4, occupied: 4, income: 5900 },
                  { name: '12 Elmwood Court', units: 4, occupied: 3, income: 4200 },
                ].map((r) => (
                  <tr key={r.name} className="border-b border-gray-50">
                    <td className="py-2.5 font-medium text-gray-900">{r.name}</td>
                    <td className="py-2.5 text-gray-600">{r.units}</td>
                    <td className="py-2.5 text-gray-600">{r.occupied}</td>
                    <td className="py-2.5 font-semibold text-green-600">${r.income.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-bold">
                  <td className="py-2.5 text-gray-900">Total</td>
                  <td className="py-2.5 text-gray-900">12</td>
                  <td className="py-2.5 text-gray-900">11</td>
                  <td className="py-2.5 text-green-700">$15,900</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Occupancy Rate', value: '11/12 (91.7%)' },
              { label: 'Maintenance Spend', value: '$340' },
              { label: 'Outstanding Rent', value: '$0' },
              { label: 'New Tenants', value: '0' },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-700 mb-1">Notes</p>
            <p className="text-sm text-blue-800">All rents collected. 1 unit vacant at 12 Elmwood Court. AC repair at 7 Maple Lane in progress — est. $220 cost.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => showToast({ type: 'info', title: 'Print report' })}
              className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Print
            </button>
            <button
              onClick={() => showToast({ type: 'info', title: 'PDF download' })}
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

// ─── Announcement Modal ───────────────────────────────────────────────────────

type AnnouncePriority = 'normal' | 'high' | 'urgent'
type AnnounceCategory = 'general' | 'maintenance' | 'policy' | 'event' | 'emergency'

interface AnnouncementModalProps {
  tenants: Tenant[]
  properties: Property[]
  onClose: () => void
  onSent?: (subject: string, count: number) => void
}

const ANNOUNCE_PRIORITIES: { value: AnnouncePriority; label: string; color: string; bg: string; border: string }[] = [
  { value: 'normal', label: 'Normal', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-300' },
  { value: 'high', label: 'High', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-400' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-500' },
]

const ANNOUNCE_CATEGORIES: { value: AnnounceCategory; label: string }[] = [
  { value: 'general', label: 'General Notice' },
  { value: 'maintenance', label: 'Maintenance Notice' },
  { value: 'policy', label: 'Policy Update' },
  { value: 'event', label: 'Community Event' },
  { value: 'emergency', label: 'Emergency' },
]

function AnnouncementModal({ tenants, properties, onClose, onSent }: AnnouncementModalProps) {
  const { companyName } = useBranding()
  const [form, setForm] = useState({
    recipient: 'all' as 'all' | 'property' | 'tenant',
    property: '',
    tenantId: '',
    subject: '',
    message: '',
    priority: 'normal' as AnnouncePriority,
    category: 'general' as AnnounceCategory,
    pinBanner: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleSend() {
    const e: Record<string, string> = {}
    if (!form.subject.trim()) e.subject = 'Required'
    if (!form.message.trim()) e.message = 'Required'
    if (form.recipient === 'property' && !form.property) e.property = 'Select a property'
    if (form.recipient === 'tenant' && !form.tenantId) e.tenant = 'Select a tenant'
    if (Object.keys(e).length > 0) { setErrors(e); return }

    let recipients: Tenant[]
    if (form.recipient === 'all') recipients = tenants
    else if (form.recipient === 'property') recipients = tenants.filter(t => t.property === form.property)
    else recipients = tenants.filter(t => t.id === form.tenantId)

    const count = recipients.length
    const link = `/tenant?p=${form.priority}&c=${form.category}&pin=${form.pinBanner ? '1' : '0'}`
    for (const t of recipients) {
      notifyUser(t.id, { type: 'announcement', title: form.subject, body: form.message, link })
    }
    showToast({ type: 'success', title: `Announcement sent to ${count} tenant${count !== 1 ? 's' : ''}` })
    onSent?.(form.subject, count)
    onClose()
  }

  const priorityStyle = ANNOUNCE_PRIORITIES.find(p => p.value === form.priority)!

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-lg animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Bell className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Send Announcement</h2>
              <p className="text-xs text-gray-400">From {companyName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Priority</label>
            <div className="flex gap-2">
              {ANNOUNCE_PRIORITIES.map(p => (
                <button
                  key={p.value}
                  onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    form.priority === p.value ? `${p.bg} ${p.border} ${p.color}` : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {ANNOUNCE_CATEGORIES.map(c => (
                <button
                  key={c.value}
                  onClick={() => setForm(f => ({ ...f, category: c.value }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    form.category === c.value ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recipients */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Recipients</label>
            <div className="flex gap-2 mb-2">
              {([['all', 'All Tenants'], ['property', 'By Property'], ['tenant', 'Specific Tenant']] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setForm(f => ({ ...f, recipient: v }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${form.recipient === v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {form.recipient === 'property' && (
              <select
                value={form.property}
                onChange={e => setForm(f => ({ ...f, property: e.target.value }))}
                className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.property ? 'border-red-400' : 'border-gray-200'}`}
              >
                <option value="">Select property…</option>
                {properties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            )}
            {form.recipient === 'tenant' && (
              <select
                value={form.tenantId}
                onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}
                className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.tenant ? 'border-red-400' : 'border-gray-200'}`}
              >
                <option value="">Select tenant…</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name} — {t.property} Unit {t.unit}</option>)}
              </select>
            )}
            {(errors.property || errors.tenant) && <p className="text-xs text-red-500 mt-0.5">{errors.property || errors.tenant}</p>}
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Subject *</label>
            <input
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="e.g. Water Shutdown Notice – Nov 12"
              className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.subject ? 'border-red-400' : 'border-gray-200'}`}
            />
            {errors.subject && <p className="text-xs text-red-500 mt-0.5">{errors.subject}</p>}
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Message *</label>
            <textarea
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              rows={5}
              placeholder="Type your announcement here…"
              className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${errors.message ? 'border-red-400' : 'border-gray-200'}`}
            />
            {errors.message && <p className="text-xs text-red-500 mt-0.5">{errors.message}</p>}
          </div>

          {/* Pin as banner */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setForm(f => ({ ...f, pinBanner: !f.pinBanner }))}
              className={`relative w-9 h-5 rounded-full transition-colors ${form.pinBanner ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.pinBanner ? 'translate-x-4' : ''}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Pin as banner on tenant screen</p>
              <p className="text-xs text-gray-400">Tenants will see a prominent banner at the top of their portal</p>
            </div>
          </label>

          {/* Preview */}
          <div className={`rounded-xl border-2 p-3 ${priorityStyle.border} ${priorityStyle.bg}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1 ${priorityStyle.color} opacity-60">Preview</p>
            <p className={`text-sm font-bold ${priorityStyle.color}`}>{form.subject || 'Your subject here'}</p>
            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{form.message || 'Your message preview will appear here…'}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${priorityStyle.bg} ${priorityStyle.color} border ${priorityStyle.border}`}>{priorityStyle.label}</span>
              <span className="text-[10px] text-gray-400">{ANNOUNCE_CATEGORIES.find(c => c.value === form.category)?.label}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Cancel</button>
            <button
              onClick={handleSend}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Send Announcement
            </button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Inspections Sub-panel (inside Maintenance) ───────────────────────────────

interface Lease {
  id: string
  tenantId: string
  unitId: string | null
  propertyName: string
  unitNumber: string
  startDate: string
  endDate: string
  rentAmount: number
  securityDeposit: number | null
  petDeposit: number | null
  depositReturned: number | null
  depositDeductions: string | null
  escalationPct: number | null
  renewalOption: 'auto' | 'manual' | 'none'
  status: 'draft' | 'active' | 'expired' | 'renewed' | 'terminated'
  renewalSentAt: string | null
  notes: string | null
  createdAt: string
}

function leaseFromRow(r: Record<string, unknown>): Lease {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    unitId: r.unit_id as string | null,
    propertyName: (r.property_name as string) ?? '',
    unitNumber: (r.unit_number as string) ?? '',
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    rentAmount: r.rent_amount as number,
    securityDeposit: r.security_deposit as number | null,
    petDeposit: r.pet_deposit as number | null,
    depositReturned: r.deposit_returned as number | null,
    depositDeductions: r.deposit_deductions as string | null,
    escalationPct: r.escalation_pct as number | null,
    renewalOption: (r.renewal_option as Lease['renewalOption']) ?? 'manual',
    status: (r.status as Lease['status']) ?? 'active',
    renewalSentAt: r.renewal_sent_at as string | null,
    notes: r.notes as string | null,
    createdAt: r.created_at as string,
  }
}

const LEASE_CREATE_SQL = `create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  unit_id uuid references public.units(id),
  property_name text,
  unit_number text,
  start_date date not null,
  end_date date not null,
  rent_amount numeric not null,
  security_deposit numeric,
  pet_deposit numeric,
  deposit_returned numeric,
  deposit_deductions text,
  escalation_pct numeric,
  renewal_option text default 'manual',
  status text not null default 'active',
  renewal_sent_at timestamptz,
  notes text,
  created_at timestamptz default now()
);
alter table public.leases enable row level security;
create policy "PM full access" on public.leases
  using (pm_id = auth.uid()) with check (pm_id = auth.uid());`

// ─── Ledger ───────────────────────────────────────────────────────────────────

type LedgerEntryType = 'rent' | 'late_fee' | 'deposit' | 'expense' | 'refund' | 'payout'

interface LedgerEntry {
  id: string
  pmId: string
  propertyId: string | null
  tenantId: string | null
  type: LedgerEntryType
  amount: number        // positive = income, negative = expense
  date: string
  description: string
  referenceId: string | null
  createdAt: string
}

function ledgerEntryFromRow(r: Record<string, unknown>): LedgerEntry {
  return {
    id: r.id as string,
    pmId: r.pm_id as string,
    propertyId: r.property_id as string | null,
    tenantId: r.tenant_id as string | null,
    type: r.type as LedgerEntryType,
    amount: r.amount as number,
    date: r.date as string,
    description: r.description as string,
    referenceId: r.reference_id as string | null,
    createdAt: r.created_at as string,
  }
}

const EXPENSE_CATEGORIES = [
  { value: 'mortgage',    label: 'Mortgage',        color: 'bg-blue-100 text-blue-700' },
  { value: 'insurance',   label: 'Insurance',        color: 'bg-purple-100 text-purple-700' },
  { value: 'tax',         label: 'Property Tax',     color: 'bg-amber-100 text-amber-700' },
  { value: 'repair',      label: 'Repair/Maintenance', color: 'bg-orange-100 text-orange-700' },
  { value: 'utility',     label: 'Utilities',        color: 'bg-cyan-100 text-cyan-700' },
  { value: 'management',  label: 'Management Fee',   color: 'bg-indigo-100 text-indigo-700' },
  { value: 'landscaping', label: 'Landscaping',      color: 'bg-green-100 text-green-700' },
  { value: 'other',       label: 'Other',            color: 'bg-gray-100 text-gray-600' },
] as const

const LEDGER_CREATE_SQL = `create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id),
  tenant_id uuid references public.tenants(id),
  type text not null,
  amount numeric not null,
  date date not null,
  description text,
  reference_id uuid,
  created_at timestamptz default now()
)

alter table public.ledger_entries enable row level security

create policy "PM full access" on public.ledger_entries
  using (pm_id = auth.uid()) with check (pm_id = auth.uid())`

interface Inspection {
  id: string
  property: string
  propertyId: string
  unit: string
  type: 'routine' | 'move_in' | 'move_out' | 'emergency' | 'annual'
  date: string
  time: string
  inspectorName: string
  inspectorPhone: string
  durationEstimate: string
  entryNoticeSent: boolean
  accessInstructions: string
  checklistItems: string
  findings: string
  followUpActions: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  createdAt: string
}

interface DBUnit {
  id: string
  propertyId: string
  unitNumber: string
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  rentAmount: number | null
  marketRent: number | null
  status: string | null
  notes: string | null
  parkingSpot: string | null
  utilityInfo: string | null
}

function dbUnitFromRow(r: Record<string, unknown>): DBUnit {
  return {
    id: r.id as string,
    propertyId: r.property_id as string,
    unitNumber: r.unit_number as string,
    bedrooms: (r.bedrooms as number | null) ?? null,
    bathrooms: (r.bathrooms as number | null) ?? null,
    sqft: (r.sqft as number | null) ?? null,
    rentAmount: (r.rent_amount as number | null) ?? null,
    marketRent: (r.market_rent as number | null) ?? null,
    status: (r.status as string | null) ?? 'vacant',
    notes: (r.notes as string | null) ?? null,
    parkingSpot: (r.parking_spot as string | null) ?? null,
    utilityInfo: (r.utility_info as string | null) ?? null,
  }
}

const UNIT_STATUSES = [
  { value: 'occupied',    label: 'Occupied',    color: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  { value: 'vacant',      label: 'Vacant',      color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500' },
  { value: 'reserved',    label: 'Reserved',    color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
] as const

// Catches both PostgreSQL "relation does not exist" (42P01) and PostgREST
// schema-cache misses ("Could not find the table … in the schema cache")
function isTableMissing(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return err.code === '42P01' || (err.message?.includes('schema cache') ?? false)
}

// ─── Phase 5: Maintenance upgrades ───────────────────────────────────────────

interface RecurringSchedule {
  id: string
  pmId: string
  propertyId: string | null
  propertyName?: string
  unitId: string | null
  title: string
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annually'
  nextDue: string   // ISO date "YYYY-MM-DD"
  lastRun: string | null
  createdAt: string
}

function recurringScheduleFromRow(r: Record<string, unknown>): RecurringSchedule {
  return {
    id: r.id as string,
    pmId: r.pm_id as string,
    propertyId: (r.property_id as string | null) ?? null,
    propertyName: (r.property_name as string | undefined) ?? undefined,
    unitId: (r.unit_id as string | null) ?? null,
    title: r.title as string,
    frequency: (r.frequency as RecurringSchedule['frequency']) ?? 'monthly',
    nextDue: r.next_due as string,
    lastRun: (r.last_run as string | null) ?? null,
    createdAt: r.created_at as string,
  }
}

const SCHEDULE_FREQUENCIES: { value: RecurringSchedule['frequency']; label: string; days: number }[] = [
  { value: 'weekly',    label: 'Weekly',    days: 7   },
  { value: 'monthly',   label: 'Monthly',   days: 30  },
  { value: 'quarterly', label: 'Quarterly', days: 90  },
  { value: 'annually',  label: 'Annually',  days: 365 },
]

const MAINTENANCE_ALTER_SQL = `alter table public.maintenance_requests
  add column if not exists assigned_to text,
  add column if not exists vendor_name text,
  add column if not exists vendor_phone text,
  add column if not exists estimated_cost numeric,
  add column if not exists actual_cost numeric,
  add column if not exists photos text[],
  add column if not exists category text`

// ─── Phase 6: Tenant CRM ─────────────────────────────────────────────────────

interface EmergencyContact {
  id: string
  tenantId: string
  name: string
  phone: string
  relationship: string
}

interface CommLogEntry {
  id: string
  tenantId: string | null
  adminId: string | null
  type: string
  text: string
  createdAt: string
}

const MOVE_IN_CHECKLIST_TEMPLATE: ChecklistItem[] = [
  { key: 'keys',        label: 'Keys handed over',                checked: false },
  { key: 'walkthrough', label: 'Move-in walkthrough completed',   checked: false },
  { key: 'photos',      label: 'Move-in photos taken',            checked: false },
  { key: 'utilities',   label: 'Utility transfer confirmed',      checked: false },
  { key: 'lease',       label: 'Lease signed & countersigned',    checked: false },
  { key: 'deposit',     label: 'Security deposit collected',      checked: false },
]

const COMM_LOG_TYPES = [
  { value: 'note',      label: 'Note',       color: 'bg-gray-100 text-gray-700',   icon: StickyNote  },
  { value: 'call',      label: 'Phone Call', color: 'bg-blue-100 text-blue-700',   icon: PhoneCall   },
  { value: 'email',     label: 'Email',      color: 'bg-purple-100 text-purple-700', icon: Mail      },
  { value: 'in-person', label: 'In-Person',  color: 'bg-green-100 text-green-700', icon: UserCheck   },
  { value: 'letter',    label: 'Letter',     color: 'bg-amber-100 text-amber-700', icon: FileText    },
] as const

const EMERGENCY_CONTACTS_SQL = `create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  phone text,
  relationship text,
  created_at timestamptz default now()
)

alter table public.emergency_contacts enable row level security

create policy "PM full access" on public.emergency_contacts
  for all using (pm_id = auth.uid()) with check (pm_id = auth.uid())`

const TENANT_SCHEMA_SQL = `alter table public.tenants add column if not exists move_in_checklist jsonb

alter table public.activity_log add column if not exists tenant_id uuid references public.tenants(id)`

const SCHEDULES_CREATE_SQL = `create table if not exists public.maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id),
  unit_id uuid references public.units(id),
  title text not null,
  frequency text not null default 'monthly',
  next_due date not null,
  last_run date,
  created_at timestamptz default now()
)

alter table public.maintenance_schedules enable row level security

create policy "PM full access" on public.maintenance_schedules
  for all using (pm_id = auth.uid()) with check (pm_id = auth.uid())`

const INSPECTION_TYPES = [
  { value: 'routine', label: 'Routine', color: 'bg-blue-100 text-blue-700' },
  { value: 'move_in', label: 'Move-In', color: 'bg-green-100 text-green-700' },
  { value: 'move_out', label: 'Move-Out', color: 'bg-purple-100 text-purple-700' },
  { value: 'emergency', label: 'Emergency', color: 'bg-red-100 text-red-700' },
  { value: 'annual', label: 'Annual', color: 'bg-amber-100 text-amber-700' },
] as const

const INSPECTION_STATUSES = [
  { value: 'scheduled', label: 'Scheduled', color: 'bg-blue-100 text-blue-700' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
] as const

const DURATION_OPTIONS = ['30 minutes', '1 hour', '1.5 hours', '2 hours', '3 hours', 'Half day', 'Full day']

function emptyInspectionForm() {
  return {
    property: '', propertyId: '', unit: '',
    type: 'routine' as Inspection['type'],
    date: '', time: '', inspectorName: '', inspectorPhone: '',
    durationEstimate: '1 hour', entryNoticeSent: false,
    accessInstructions: '', checklistItems: '', findings: '', followUpActions: '',
    status: 'scheduled' as Inspection['status'],
  }
}

function InspectionFormModal({
  properties, initial, onClose, onSave,
}: {
  properties: Property[]
  initial?: Partial<Inspection>
  onClose: () => void
  onSave: (data: ReturnType<typeof emptyInspectionForm>) => Promise<void>
}) {
  const [form, setForm] = useState({ ...emptyInspectionForm(), ...initial })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  function set(patch: Partial<typeof form>) { setForm(f => ({ ...f, ...patch })) }

  async function handleSave() {
    const e: Record<string, string> = {}
    if (!form.property) e.property = 'Required'
    if (!form.date) e.date = 'Required'
    if (!form.inspectorName.trim()) e.inspectorName = 'Required'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const selectedProp = properties.find(p => p.name === form.property)

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-lg animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">{initial?.id ? 'Edit Inspection' : 'Schedule Inspection'}</h2>
            <p className="text-xs text-gray-400">Fill in inspection details below</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">

          {/* Inspection Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Inspection Type *</label>
            <div className="flex flex-wrap gap-2">
              {INSPECTION_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => set({ type: t.value })}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                    form.type === t.value ? `${t.color} border-current` : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Property + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Property *</label>
              <select
                value={form.property}
                onChange={e => {
                  const p = properties.find(x => x.name === e.target.value)
                  set({ property: e.target.value, propertyId: p?.id ?? '' })
                }}
                className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.property ? 'border-red-400' : 'border-gray-200'}`}
              >
                <option value="">Select…</option>
                {properties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              {errors.property && <p className="text-xs text-red-500 mt-0.5">{errors.property}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Unit <span className="font-normal text-gray-400">(optional)</span></label>
              <input
                value={form.unit}
                onChange={e => set({ unit: e.target.value })}
                placeholder={selectedProp ? `e.g. 1A` : 'Select property first'}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => set({ date: e.target.value })}
                className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.date ? 'border-red-400' : 'border-gray-200'}`}
              />
              {errors.date && <p className="text-xs text-red-500 mt-0.5">{errors.date}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Time</label>
              <input
                type="time"
                value={form.time}
                onChange={e => set({ time: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Inspector */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Inspector Name *</label>
              <input
                value={form.inspectorName}
                onChange={e => set({ inspectorName: e.target.value })}
                placeholder="Full name"
                className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.inspectorName ? 'border-red-400' : 'border-gray-200'}`}
              />
              {errors.inspectorName && <p className="text-xs text-red-500 mt-0.5">{errors.inspectorName}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Inspector Phone</label>
              <input
                type="tel"
                value={form.inspectorPhone}
                onChange={e => set({ inspectorPhone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Duration + Entry notice */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Duration Estimate</label>
              <select
                value={form.durationEstimate}
                onChange={e => set({ durationEstimate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.entryNoticeSent}
                  onChange={e => set({ entryNoticeSent: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700 font-medium">Entry notice sent</span>
              </label>
            </div>
          </div>

          {/* Access Instructions */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Access Instructions</label>
            <textarea
              value={form.accessInstructions}
              onChange={e => set({ accessInstructions: e.target.value })}
              rows={2}
              placeholder="e.g. Key in lockbox #4, code 1234. Ring doorbell twice."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Checklist Items */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Checklist Items <span className="font-normal text-gray-400">(one per line)</span></label>
            <textarea
              value={form.checklistItems}
              onChange={e => set({ checklistItems: e.target.value })}
              rows={3}
              placeholder={"HVAC filter\nSmoke detectors\nPlumbing under sinks\nWindow seals"}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-xs"
            />
          </div>

          {/* Findings / Follow-up */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Findings / Notes</label>
            <textarea
              value={form.findings}
              onChange={e => set({ findings: e.target.value })}
              rows={2}
              placeholder="Document any issues found during inspection…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Follow-Up Actions</label>
            <textarea
              value={form.followUpActions}
              onChange={e => set({ followUpActions: e.target.value })}
              rows={2}
              placeholder="e.g. Replace HVAC filter within 2 weeks, schedule plumber…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Status (only when editing) */}
          {initial?.id && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Status</label>
              <div className="flex gap-2 flex-wrap">
                {INSPECTION_STATUSES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => set({ status: s.value })}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                      form.status === s.value ? `${s.color} border-current` : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {initial?.id ? 'Save Changes' : 'Schedule Inspection'}
            </button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

function InspectionsSubPanel({ properties }: { properties: Property[] }) {
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editInspection, setEditInspection] = useState<Inspection | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('inspections')
        .select('*')
        .order('date', { ascending: true })
      if (err) {
        setError(err.message)
      } else {
        setInspections((data ?? []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          property: r.property as string,
          propertyId: (r.property_id as string) ?? '',
          unit: (r.unit as string) ?? '',
          type: (r.type as Inspection['type']) ?? 'routine',
          date: (r.date as string) ?? '',
          time: (r.time as string) ?? '',
          inspectorName: (r.inspector_name as string) ?? '',
          inspectorPhone: (r.inspector_phone as string) ?? '',
          durationEstimate: (r.duration_estimate as string) ?? '1 hour',
          entryNoticeSent: Boolean(r.entry_notice_sent),
          accessInstructions: (r.access_instructions as string) ?? '',
          checklistItems: (r.checklist_items as string) ?? '',
          findings: (r.findings as string) ?? '',
          followUpActions: (r.follow_up_actions as string) ?? '',
          status: (r.status as Inspection['status']) ?? 'scheduled',
          createdAt: (r.created_at as string) ?? '',
        })))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(form: ReturnType<typeof emptyInspectionForm>, existingId?: string) {
    const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      pm_id: user?.id ?? null,
      property: form.property,
      property_id: form.propertyId && isUuid(form.propertyId) ? form.propertyId : null,
      unit: form.unit || null,
      type: form.type,
      date: form.date,
      time: form.time || null,
      inspector_name: form.inspectorName,
      inspector_phone: form.inspectorPhone || null,
      duration_estimate: form.durationEstimate,
      entry_notice_sent: form.entryNoticeSent,
      access_instructions: form.accessInstructions || null,
      checklist_items: form.checklistItems || null,
      findings: form.findings || null,
      follow_up_actions: form.followUpActions || null,
      status: form.status,
    }
    if (existingId) {
      const { error: err } = await supabase.from('inspections').update(payload).eq('id', existingId)
      if (err) { showToast({ type: 'error', title: 'Failed to update', message: err.message }); return }
      setInspections(prev => prev.map(i => i.id === existingId ? { ...i, ...form, id: existingId } : i))
      showToast({ type: 'success', title: 'Inspection updated' })
      setEditInspection(null)
    } else {
      const { data, error: err } = await supabase.from('inspections').insert(payload).select().single()
      if (err) { showToast({ type: 'error', title: 'Failed to schedule', message: err.message }); return }
      const newRow = data as Record<string, unknown>
      setInspections(prev => [{
        id: newRow.id as string,
        property: form.property,
        propertyId: form.propertyId,
        unit: form.unit,
        type: form.type,
        date: form.date,
        time: form.time,
        inspectorName: form.inspectorName,
        inspectorPhone: form.inspectorPhone,
        durationEstimate: form.durationEstimate,
        entryNoticeSent: form.entryNoticeSent,
        accessInstructions: form.accessInstructions,
        checklistItems: form.checklistItems,
        findings: form.findings,
        followUpActions: form.followUpActions,
        status: form.status,
        createdAt: new Date().toISOString(),
      }, ...prev])
      showToast({ type: 'success', title: `Inspection scheduled at ${form.property}` })
      setShowForm(false)
    }
  }

  async function handleStatusChange(id: string, status: Inspection['status']) {
    await supabase.from('inspections').update({ status }).eq('id', id)
    setInspections(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  const filtered = filterStatus === 'all' ? inspections : inspections.filter(i => i.status === filterStatus)
  const typeMeta = (t: string) => INSPECTION_TYPES.find(x => x.value === t) ?? INSPECTION_TYPES[0]
  const statusMeta = (s: string) => INSPECTION_STATUSES.find(x => x.value === s) ?? INSPECTION_STATUSES[0]

  if (loading) {
    return <div className="p-6 space-y-3">{[0,1,2].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />)}</div>
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <p className="text-sm font-bold text-amber-900 mb-2">Inspections table not set up</p>
          <p className="text-xs text-amber-700 mb-3">Run this SQL in your Supabase dashboard to enable inspections:</p>
          <pre className="bg-white border border-amber-200 rounded-lg p-3 text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap">{`create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references auth.users(id) on delete cascade,
  property text not null,
  property_id uuid references public.properties(id),
  unit text,
  type text not null default 'routine',
  date date not null,
  time text,
  inspector_name text not null,
  inspector_phone text,
  duration_estimate text default '1 hour',
  entry_notice_sent boolean default false,
  access_instructions text,
  checklist_items text,
  findings text,
  follow_up_actions text,
  status text not null default 'scheduled',
  created_at timestamptz default now()
);
alter table public.inspections enable row level security;
create policy "PM full access" on public.inspections
  using (pm_id = auth.uid()) with check (pm_id = auth.uid());`}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900">Inspections</h3>
          <p className="text-xs text-gray-500">{inspections.filter(i => i.status === 'scheduled').length} upcoming</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Inspection
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['all', 'scheduled', 'in_progress', 'completed', 'cancelled'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterStatus === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-600">No inspections yet</p>
          <p className="text-xs text-gray-400 mt-1">Click "New Inspection" to schedule one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(insp => {
            const tm = typeMeta(insp.type)
            const sm = statusMeta(insp.status)
            return (
              <div key={insp.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tm.color}`}>{tm.label}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sm.color}`}>{sm.label}</span>
                      {insp.entryNoticeSent && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">Notice Sent</span>}
                    </div>
                    <p className="text-sm font-bold text-gray-900 truncate">{insp.property}{insp.unit ? ` — Unit ${insp.unit}` : ''}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {insp.date && new Date(insp.date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {insp.time && ` at ${insp.time}`}
                      {insp.durationEstimate && ` · ${insp.durationEstimate}`}
                    </p>
                    <p className="text-xs text-gray-500">Inspector: <span className="font-medium text-gray-700">{insp.inspectorName}</span>{insp.inspectorPhone ? ` · ${insp.inspectorPhone}` : ''}</p>
                    {insp.findings && <p className="text-xs text-amber-700 mt-1 font-medium">Findings: {insp.findings.slice(0, 80)}{insp.findings.length > 80 ? '…' : ''}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <select
                      value={insp.status}
                      onChange={e => handleStatusChange(insp.id, e.target.value as Inspection['status'])}
                      onClick={e => e.stopPropagation()}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {INSPECTION_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <button
                      onClick={() => setEditInspection(insp)}
                      className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {(insp.checklistItems || insp.accessInstructions || insp.followUpActions) && (
                  <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-3">
                    {insp.accessInstructions && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Access</p>
                        <p className="text-xs text-gray-600 line-clamp-2">{insp.accessInstructions}</p>
                      </div>
                    )}
                    {insp.checklistItems && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Checklist</p>
                        <p className="text-xs text-gray-600 line-clamp-2">{insp.checklistItems.split('\n').filter(Boolean).join(' · ')}</p>
                      </div>
                    )}
                    {insp.followUpActions && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Follow-up</p>
                        <p className="text-xs text-gray-600 line-clamp-2">{insp.followUpActions}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <InspectionFormModal
          properties={properties}
          onClose={() => setShowForm(false)}
          onSave={async (form) => { await handleSave(form) }}
        />
      )}
      {editInspection && (
        <InspectionFormModal
          properties={properties}
          initial={editInspection}
          onClose={() => setEditInspection(null)}
          onSave={async (form) => { await handleSave(form, editInspection.id) }}
        />
      )}
    </div>
  )
}

// ─── Document Viewer Modal ────────────────────────────────────────────────────

function DocViewerModal({ filename, onClose }: { filename: string; onClose: () => void }) {
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Viewing: {filename}</h2>
            <p className="text-xs text-gray-500">Document preview</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6">
          <div className="bg-gray-100 rounded-xl h-64 flex flex-col items-center justify-center gap-3">
            <FileText className="w-12 h-12 text-gray-400" />
            <p className="text-sm text-gray-500">PDF preview would appear here</p>
            <p className="text-xs text-gray-400">{filename}</p>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => showToast({ type: 'info', title: 'Download' })}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Download
            </button>
            <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Close</button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Messages Panel ───────────────────────────────────────────────────────────

interface MessagesPanelProps {
  threads: Thread[]
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>
  selectedThreadId: string | null
  setSelectedThreadId: React.Dispatch<React.SetStateAction<string | null>>
  onNewThread: () => void
  tenants: Tenant[]
  onViewTenantProfile: (tenantId: string) => void
}

function formatMsgTime(sentAt: number): string {
  const diff = Date.now() - sentAt
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  const d = new Date(sentAt)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const EMOJI_LIST = [
  '😊','😂','❤️','👍','🙏','😍','🎉','😭','😘','💯',
  '✅','🔥','💪','👏','🤔','😅','🙌','😎','💬','📋',
  '🏠','🔑','💰','📅','⚠️','✍️','📞','📧','👋','🤝',
  '😢','😤','🙃','😬','🥲','💡','📝','🗓️','⏰','🚨',
]

function MessagesPanel({ threads, setThreads, selectedThreadId, setSelectedThreadId, onNewThread, onViewTenantProfile }: MessagesPanelProps) {
  const { user } = useAuth()
  const { demoMode } = useDemoMode()
  const { data: threadMessages, setData: setThreadMessages } = useMessages(selectedThreadId)
  const [compose, setCompose] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [editedPopoverId, setEditedPopoverId] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [attachments, setAttachments] = useState<{ name: string; size: string; file: File; previewUrl: string | null }[]>([])
  const [threadSearch, setThreadSearch] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)
  const composeRef = useRef<HTMLTextAreaElement>(null)

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null
  const filteredThreads = threads.filter(t =>
    t.tenantName.toLowerCase().includes(threadSearch.toLowerCase()) ||
    t.tenantUnit.toLowerCase().includes(threadSearch.toLowerCase())
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMessages.length, selectedThreadId])

  // Opening a thread marks the tenant's messages as read
  useEffect(() => {
    if (!selectedThreadId || demoMode) return
    supabase.from('messages')
      .update({ read: true })
      .eq('tenant_id', selectedThreadId)
      .eq('sender', 'tenant')
      .eq('read', false)
      .then(() => {
        setThreads(prev => prev.map(t => t.id === selectedThreadId ? { ...t, unread: 0 } : t))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId, demoMode])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmojiPicker(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function sendMessage() {
    if ((!compose.trim() && attachments.length === 0) || !selectedThreadId || !user) return
    const textParts = [compose.trim()]
    for (const att of attachments) {
      const ext = att.name.split('.').pop() ?? 'bin'
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`
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
    const bodyText = compose.trim()
    setCompose('')
    setAttachments([])

    // Optimistic update — show message immediately
    const optimisticId = `opt-${Date.now()}`
    const optimistic: ChatMessage = {
      id: optimisticId,
      threadId: selectedThreadId,
      senderId: 'pm',
      senderName: 'Property Manager',
      text,
      timestamp: '',
      sentAt: Date.now(),
      edited: false,
      unsent: false,
    }
    setThreadMessages(prev => [...prev, optimistic])

    const { data: inserted, error } = await supabase.from('messages').insert({
      pm_id: user.id,
      tenant_id: selectedThreadId,
      sender: 'pm',
      body: text,
      read: false,
    }).select().single()

    if (error) {
      // Roll back optimistic message
      setThreadMessages(prev => prev.filter(m => m.id !== optimisticId))
      showToast({ type: 'error', title: 'Failed to send message' })
      return
    }

    // Replace optimistic row with real DB id so edits/deletes work
    if (inserted) {
      setThreadMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, id: inserted.id as string } : m))
    }

    notifyUser(selectedThreadId, {
      type: 'message',
      title: 'New message from your property manager',
      body: bodyText || 'Sent an attachment',
      link: '/tenant',
    })
    setThreads((prev) =>
      prev.map((t) =>
        t.id === selectedThreadId
          ? { ...t, lastMessage: text.split('\n').map(l => { try { const u = new URL(l.trim()); if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(u.pathname)) return '📷 Image' } catch {} return l }).filter(Boolean).join(' · ').slice(0, 60), lastTime: 'Just now', unread: 0 }
          : t
      )
    )
  }

  function insertEmoji(emoji: string) {
    const el = composeRef.current
    if (!el) { setCompose(c => c + emoji); setShowEmojiPicker(false); return }
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
    const items = files.map(f => ({
      name: f.name,
      size: f.size < 1024 * 1024 ? `${Math.round(f.size / 1024)} KB` : `${(f.size / 1024 / 1024).toFixed(1)} MB`,
      file: f,
      previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }))
    setAttachments(prev => [...prev, ...items])
    e.target.value = ''
  }

  async function unsendMessage(id: string) {
    await supabase.from('messages').delete().eq('id', id)
    setMenuOpenId(null)
  }

  return (
    <div className="flex h-full overflow-hidden animate-slide-up bg-white">
      {/* Left pane — thread list */}
      <div className="w-[300px] border-r border-gray-200 flex flex-col shrink-0 bg-gray-50">
        <div className="px-4 pt-4 pb-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 text-base">Messages</h2>
            <button
              title="New message"
              onClick={onNewThread}
              className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors shadow-sm"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Search messages…"
              value={threadSearch}
              onChange={e => setThreadSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredThreads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => {
                setSelectedThreadId(thread.id)
                setThreads((prev) =>
                  prev.map((t) => (t.id === thread.id ? { ...t, unread: 0 } : t))
                )
              }}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-white transition-colors ${
                selectedThreadId === thread.id ? 'bg-white border-l-2 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <Avatar name={thread.tenantName} />
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
                  <p className={`text-xs truncate mt-0.5 ${thread.unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{thread.lastMessage}</p>
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

      {/* Right pane — conversation */}
      {selectedThread ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3 border-b border-gray-200 bg-white flex items-center gap-3 shadow-sm">
            <div className="relative">
              <Avatar name={selectedThread.tenantName} size="lg" />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{selectedThread.tenantName}</p>
              <p className="text-xs text-gray-500">{selectedThread.tenantUnit} · Active now</p>
            </div>
            <button
              onClick={() => selectedThread && onViewTenantProfile(selectedThread.tenantId)}
              className="ml-auto text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              View Profile
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 bg-gray-50">
            {threadMessages.map((msg, idx) => {
              const isPm = msg.senderId === 'pm'
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
                <div key={msg.id} className={`flex items-end gap-2 group ${isPm ? 'justify-end' : 'justify-start'} ${showSenderBreak ? 'mt-3' : 'mt-0.5'}`}>
                  {!isPm && (
                    <div className="shrink-0 w-7">
                      {isLastInGroup && <Avatar name={msg.senderName} size="sm" />}
                    </div>
                  )}
                  <div className={`flex flex-col ${isPm ? 'items-end' : 'items-start'} max-w-[72%]`}>
                    <div className="relative">
                      <div
                        className={`px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                          isPm
                            ? `bg-blue-600 text-white shadow-sm ${isLastInGroup ? 'rounded-[20px] rounded-br-[5px]' : 'rounded-[20px]'}`
                            : `bg-white text-gray-900 border border-gray-200 shadow-sm ${isLastInGroup ? 'rounded-[20px] rounded-bl-[5px]' : 'rounded-[20px]'}`
                        }`}
                      >
                        {msg.text.split('\n').map((line, i) => {
                          try {
                            const url = new URL(line.trim())
                            if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url.pathname)) {
                              return <img key={i} src={line.trim()} className="max-w-[260px] rounded-xl mt-1 block" alt="attachment" />
                            }
                          } catch { /* not a URL */ }
                          return <span key={i}>{line}{i < msg.text.split('\n').length - 1 && '\n'}</span>
                        })}
                      </div>
                      {/* Hover actions */}
                      <div className={`absolute top-1/2 -translate-y-1/2 ${isPm ? '-left-9' : '-right-9'} hidden group-hover:flex`}>
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpenId(menuOpenId === msg.id ? null : msg.id)}
                            className="w-6 h-6 rounded-full bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center shadow-sm"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                          {menuOpenId === msg.id && (
                            <div className={`absolute ${isPm ? 'right-8' : 'left-8'} top-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 w-28`}>
                              {isPm ? (
                                <button onClick={() => unsendMessage(msg.id)} className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
                                  <X className="w-3.5 h-3.5" /> Unsend
                                </button>
                              ) : (
                                <button onClick={() => { setCompose(`@${msg.senderName} `); setMenuOpenId(null); composeRef.current?.focus() }} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                  Reply
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {isLastInGroup && (
                      <p className="text-[10px] text-gray-400 mt-1 mx-1">{formatMsgTime(msg.sentAt)}{isPm && ' · Delivered'}</p>
                    )}
                  </div>
                  {isPm && <div className="shrink-0 w-7">{isLastInGroup && <Avatar name="BMP" size="sm" />}</div>}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Attachment preview strip */}
          {attachments.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 bg-white flex gap-2 flex-wrap">
              {attachments.map((a, i) => (
                <div key={i} className="relative group/att">
                  {a.previewUrl ? (
                    <div className="relative">
                      <img src={a.previewUrl} className="w-16 h-16 rounded-xl object-cover border border-gray-200" alt={a.name} />
                      <button
                        onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
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
                      <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-blue-400 hover:text-blue-700 ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Compose bar */}
          <div className="px-4 py-3 border-t border-gray-200 bg-white">
            <div className={`flex items-end gap-2 bg-gray-50 border rounded-2xl px-3 py-2 transition-all ${compose.trim() || attachments.length ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'}`}>
              <textarea
                ref={composeRef}
                rows={1}
                className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400 resize-none leading-relaxed max-h-28 overflow-y-auto"
                placeholder={`Message ${selectedThread.tenantName}…`}
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
                {/* Emoji button with picker */}
                <div ref={emojiRef} className="relative">
                  <button
                    onClick={() => setShowEmojiPicker(v => !v)}
                    className={`p-1.5 rounded-full transition-colors ${showEmojiPicker ? 'bg-yellow-100 text-yellow-500' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                    title="Emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-10 right-0 bg-white border border-gray-200 rounded-2xl shadow-xl p-3 z-30 w-[240px]">
                      <p className="text-xs font-semibold text-gray-500 mb-2 px-1">Emoji</p>
                      <div className="grid grid-cols-8 gap-1">
                        {EMOJI_LIST.map(e => (
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

                {/* Attachment button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Attach file"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />

                {/* Send button */}
                <button
                  onClick={sendMessage}
                  disabled={!compose.trim() && attachments.length === 0}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    compose.trim() || attachments.length
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">Press Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 opacity-40" />
          </div>
          <p className="text-sm font-semibold text-gray-600">Your Messages</p>
          <p className="text-xs text-gray-400 mt-1">Select a conversation or start a new one</p>
          <button onClick={onNewThread} className="mt-4 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full font-semibold transition-colors shadow-sm">
            New Message
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

interface SettingsPanelProps {
  profileName: string
  setProfileName: (name: string) => void
  profilePhoto: string | null
  setProfilePhoto: (photo: string | null) => void
}

function SettingsPanel({ profileName, setProfileName, profilePhoto, setProfilePhoto }: SettingsPanelProps) {
  const { demoMode, setDemoMode } = useDemoMode()
  const { user } = useAuth()
  const branding = useBranding()
  const [section, setSection] = useState<'account' | 'branding' | 'security' | 'notifications' | 'preferences'>('account')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // ─── Account ────────────────────────────────────────────────────────────────
  const [profileLoading, setProfileLoading] = useState(true)
  const [fullName, setFullName] = useState(profileName)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [bio, setBio] = useState('')
  const [photoPreview, setPhotoPreview] = useState<string | null>(profilePhoto)
  const [profileSaving, setProfileSaving] = useState(false)

  // ─── Security ───────────────────────────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)

  // 2FA
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [mfaStep, setMfaStep] = useState<'idle' | 'qr' | 'verify'>('idle')
  const [mfaQr, setMfaQr] = useState<string | null>(null)
  const [mfaSecret, setMfaSecret] = useState<string | null>(null)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)
  const [mfaError, setMfaError] = useState<string | null>(null)

  // ─── Notifications ──────────────────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState({
    emailMaintenance: true, emailRent: true, emailLease: true, emailMessages: true, emailSystem: false,
    smsMaintenance: false, smsRent: true, smsLease: false, smsMessages: false, smsSystem: false,
    inappMaintenance: true, inappRent: true, inappLease: true, inappMessages: true, inappSystem: true,
  })
  const [notifSaving, setNotifSaving] = useState(false)

  // ─── Preferences ────────────────────────────────────────────────────────────
  const [prefLanguage, setPrefLanguage] = useState('English')
  const [prefTimezone, setPrefTimezone] = useState('America/Chicago')
  const [prefDateFormat, setPrefDateFormat] = useState('MM/DD/YYYY')
  const [prefCurrency, setPrefCurrency] = useState('USD')
  const [prefDarkMode, setPrefDarkMode] = useState(false)
  const [prefsSaving, setPrefsSaving] = useState(false)

  // ─── Branding ─────────────────────────────────────────────────────────────────
  const PRESET_COLORS = ['#2563EB', '#4F46E5', '#7C3AED', '#0891B2', '#059669', '#DB2777', '#E11D48', '#EA580C', '#0F172A']
  const [brandName, setBrandName] = useState(branding.companyName)
  const [brandTagline, setBrandTagline] = useState(branding.tagline)
  const [brandColor, setBrandColor] = useState(branding.primaryColor)
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(branding.logoUrl)
  const [brandSaving, setBrandSaving] = useState(false)
  const [brandLogoUploading, setBrandLogoUploading] = useState(false)

  // Keep the editor in sync once the brand context finishes loading
  useEffect(() => {
    setBrandName(branding.companyName)
    setBrandTagline(branding.tagline)
    setBrandColor(branding.primaryColor)
    setBrandLogoUrl(branding.logoUrl)
  }, [branding.companyName, branding.tagline, branding.primaryColor, branding.logoUrl])

  // Live-preview the accent while editing; restore the saved accent on unmount
  useEffect(() => {
    branding.previewColor(brandColor)
    return () => branding.previewColor(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandColor])

  const sections = [
    { id: 'account', label: 'Account' },
    { id: 'branding', label: 'Branding' },
    { id: 'security', label: 'Security' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'preferences', label: 'Preferences' },
  ] as const

  // Load profile from DB
  useEffect(() => {
    if (!user) return
    supabase.from('profiles')
      .select('full_name, email, phone, title, company, bio, avatar_url, notification_preferences, user_preferences')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const d = data as Record<string, unknown>
          setFullName((d.full_name as string) || '')
          setEmail((d.email as string) || user.email || '')
          setPhone((d.phone as string) || '')
          setTitle((d.title as string) || '')
          setCompany((d.company as string) || '')
          setBio((d.bio as string) || '')
          setPhotoPreview((d.avatar_url as string | null) || null)
          if (d.notification_preferences) {
            setNotifPrefs(prev => ({ ...prev, ...(d.notification_preferences as object) }))
          }
          if (d.user_preferences) {
            const up = d.user_preferences as Record<string, unknown>
            if (up.language) setPrefLanguage(up.language as string)
            if (up.timezone) setPrefTimezone(up.timezone as string)
            if (up.dateFormat) setPrefDateFormat(up.dateFormat as string)
            if (up.currency) setPrefCurrency(up.currency as string)
            if (up.darkMode !== undefined) setPrefDarkMode(up.darkMode as boolean)
          }
        }
        setProfileLoading(false)
      })
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp?.find(f => f.status === 'verified')
      setTwoFactorEnabled(!!verified)
      if (verified) setMfaFactorId(verified.id)
    })
  }, [user?.id])

  async function handleSaveProfile() {
    if (!user) return
    setProfileSaving(true)
    const { error } = await supabase.from('profiles')
      .update({ full_name: fullName, phone, title, company, bio })
      .eq('id', user.id)
    if (error) showToast({ type: 'error', title: 'Save failed: ' + error.message })
    else {
      setProfileName(fullName)
      if (photoPreview !== profilePhoto) setProfilePhoto(photoPreview)
      showToast({ type: 'success', title: 'Profile updated' })
    }
    setProfileSaving(false)
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/avatar.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { showToast({ type: 'error', title: 'Photo upload failed' }); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id)
    setPhotoPreview(data.publicUrl)
    setProfilePhoto(data.publicUrl)
    showToast({ type: 'success', title: 'Profile photo updated' })
    e.target.value = ''
  }

  async function handleBrandLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!user) { showToast({ type: 'error', title: 'Sign in to upload a logo' }); return }
    setBrandLogoUploading(true)
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${user.id}/logo-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('branding').upload(path, file, { upsert: true })
    if (upErr) { showToast({ type: 'error', title: 'Logo upload failed', message: upErr.message }); setBrandLogoUploading(false); return }
    const { data } = supabase.storage.from('branding').getPublicUrl(path)
    setBrandLogoUrl(data.publicUrl)
    setBrandLogoUploading(false)
    showToast({ type: 'success', title: 'Logo uploaded — remember to Save' })
    e.target.value = ''
  }

  async function handleSaveBranding() {
    if (!user) { showToast({ type: 'error', title: 'Sign in to save branding' }); return }
    setBrandSaving(true)
    const { error } = await supabase.from('branding').upsert({
      pm_id: user.id,
      company_name: brandName.trim() || 'BMP Central',
      tagline: brandTagline.trim() || null,
      logo_url: brandLogoUrl,
      primary_color: brandColor,
      updated_at: new Date().toISOString(),
    })
    if (error) showToast({ type: 'error', title: 'Save failed', message: error.message })
    else {
      await branding.refresh()
      showToast({ type: 'success', title: 'Branding saved' })
    }
    setBrandSaving(false)
  }

  async function handleChangePassword() {
    if (!newPw) { setPwError('Enter a new password.'); return }
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }
    setPwLoading(true); setPwError(null)
    if (currentPw && user?.email) {
      const { error: reErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPw })
      if (reErr) { setPwError('Current password is incorrect.'); setPwLoading(false); return }
    }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) setPwError(error.message)
    else {
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      showToast({ type: 'success', title: 'Password changed successfully' })
    }
    setPwLoading(false)
  }

  async function handleEnable2FA() {
    setMfaLoading(true); setMfaError(null)
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: branding.companyName, friendlyName: 'Authenticator App' })
    if (error || !data) { setMfaError(error?.message ?? 'Failed to start setup'); setMfaLoading(false); return }
    setMfaFactorId(data.id)
    setMfaQr(data.totp.qr_code)
    setMfaSecret(data.totp.secret)
    setMfaStep('qr')
    setMfaLoading(false)
  }

  async function handleVerify2FA() {
    if (!mfaFactorId || !mfaCode) return
    setMfaLoading(true); setMfaError(null)
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
    if (cErr || !challenge) { setMfaError(cErr?.message ?? 'Challenge failed'); setMfaLoading(false); return }
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code: mfaCode.replace(/\s/g, '') })
    if (vErr) { setMfaError('Invalid code. Please try again.'); setMfaLoading(false); return }
    setTwoFactorEnabled(true); setMfaStep('idle'); setMfaCode('')
    showToast({ type: 'success', title: '2FA enabled successfully' })
    setMfaLoading(false)
  }

  async function handleDisable2FA() {
    if (!mfaFactorId) return
    setMfaLoading(true)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId })
    if (error) { showToast({ type: 'error', title: error.message }); setMfaLoading(false); return }
    setTwoFactorEnabled(false); setMfaFactorId(null)
    showToast({ type: 'success', title: '2FA disabled' })
    setMfaLoading(false)
  }

  async function handleSaveNotifications() {
    if (!user) return
    setNotifSaving(true)
    const { error } = await supabase.from('profiles').update({ notification_preferences: notifPrefs }).eq('id', user.id)
    if (error) showToast({ type: 'error', title: 'Failed to save' })
    else showToast({ type: 'success', title: 'Notification preferences saved' })
    setNotifSaving(false)
  }

  async function handleSavePreferences() {
    if (!user) return
    setPrefsSaving(true)
    const up = { language: prefLanguage, timezone: prefTimezone, dateFormat: prefDateFormat, currency: prefCurrency, darkMode: prefDarkMode }
    const { error } = await supabase.from('profiles').update({ user_preferences: up }).eq('id', user.id)
    if (error) showToast({ type: 'error', title: 'Failed to save' })
    else showToast({ type: 'success', title: 'Preferences saved' })
    setPrefsSaving(false)
  }

  const iField = (label: string, value: string, onChange: (v: string) => void, type = 'text') => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )

  if (profileLoading) return (
    <div className="flex items-center justify-center h-full">
      <span className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex h-full overflow-hidden animate-slide-up">
      {/* Mini sidebar */}
      <div className="w-[140px] border-r border-gray-200 p-3 shrink-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">Settings</p>
        <nav className="space-y-0.5">
          {sections.map((s) => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${section === s.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── Account ── */}
        {section === 'account' && (
          <div className="max-w-lg space-y-6">
            <h2 className="text-lg font-bold text-gray-900">Account Settings</h2>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Profile Photo</h3>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {photoPreview
                    ? <img src={photoPreview} alt="Profile" className="w-16 h-16 rounded-full object-cover" />
                    : <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xl">{fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'PM'}</div>
                  }
                  <button onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-800 rounded-full flex items-center justify-center">
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Change photo</p>
                  <p className="text-xs text-gray-500">JPG, PNG up to 5MB · saved to cloud</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Profile Information</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {iField('Full Name', fullName, setFullName)}
                  {iField('Title', title, setTitle)}
                </div>
                {iField('Email address', email, setEmail, 'email')}
                <div className="grid grid-cols-2 gap-4">
                  {iField('Phone number', phone, setPhone, 'tel')}
                  {iField('Company', company, setCompany)}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Bio</label>
                  <textarea className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                    value={bio} onChange={e => setBio(e.target.value)} placeholder="Brief professional bio…" />
                </div>
                <button onClick={handleSaveProfile} disabled={profileSaving}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                  {profileSaving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {profileSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Branding ── */}
        {section === 'branding' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h3 className="text-base font-bold text-gray-900">Custom Branding</h3>
              <p className="text-sm text-gray-500 mt-0.5">White-label the tenant, owner, and admin portals with your company identity. Changes apply everywhere.</p>
            </div>

            {/* Live preview */}
            <div className="rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}>
                {brandLogoUrl
                  ? <img src={brandLogoUrl} alt="logo" className="w-9 h-9 rounded-xl object-cover shadow-lg" />
                  : <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg" style={{ background: brandColor }}><Building2 className="w-4.5 h-4.5 text-white" /></div>}
                <div>
                  <p className="text-white font-bold text-sm">{brandName || 'Company Name'}</p>
                  <p className="text-slate-400 text-[11px]">{brandTagline || 'Tagline'}</p>
                </div>
                <span className="ml-auto px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ background: brandColor }}>Primary button</span>
              </div>
              <div className="px-5 py-2 bg-gray-50 text-[11px] text-gray-400 font-medium">Live preview</div>
            </div>

            {/* Company name + tagline */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Company Name</label>
                <input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="BMP Central" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tagline</label>
                <input value={brandTagline} onChange={e => setBrandTagline(e.target.value)} placeholder="Property Management" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Logo */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                  {brandLogoUrl
                    ? <img src={brandLogoUrl} alt="logo" className="w-full h-full object-cover" />
                    : <Building2 className="w-7 h-7 text-gray-300" />}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => logoInputRef.current?.click()} disabled={brandLogoUploading} className="px-3 py-2 text-sm font-semibold text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-60">
                    {brandLogoUploading ? 'Uploading…' : brandLogoUrl ? 'Replace logo' : 'Upload logo'}
                  </button>
                  {brandLogoUrl && (
                    <button onClick={() => setBrandLogoUrl(null)} className="px-3 py-2 text-sm font-semibold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                      Remove
                    </button>
                  )}
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleBrandLogoChange} />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">Square PNG or SVG works best. Falls back to a default icon when empty.</p>
            </div>

            {/* Accent color */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Accent Color</label>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setBrandColor(c)}
                    className={`w-9 h-9 rounded-xl transition-transform ${brandColor.toUpperCase() === c.toUpperCase() ? 'ring-2 ring-offset-2 ring-gray-900 scale-110' : 'hover:scale-105'}`}
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
              <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-all w-fit">
                <div className="w-8 h-8 rounded-lg shadow-sm ring-2 ring-white ring-offset-1 ring-offset-gray-100" style={{ background: brandColor }} />
                <div>
                  <p className="text-xs font-bold text-gray-700">Custom color</p>
                  <p className="text-[11px] font-mono text-gray-400 uppercase">{brandColor}</p>
                </div>
                <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="sr-only" />
                <span className="text-xs text-blue-600 font-semibold ml-1">Pick →</span>
              </label>
              <p className="text-xs text-gray-400 mt-2">Recolors buttons, nav highlights, and accents across all three portals instantly.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button onClick={handleSaveBranding} disabled={brandSaving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors">
                <CheckCircle className="w-4 h-4" /> {brandSaving ? 'Saving…' : 'Save Branding'}
              </button>
              <button
                onClick={() => { setBrandName('BMP Central'); setBrandTagline('Property Management'); setBrandColor('#2563EB'); setBrandLogoUrl(null) }}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700"
              >
                Reset to default
              </button>
            </div>
          </div>
        )}

        {/* ── Security ── */}
        {section === 'security' && (
          <div className="max-w-lg space-y-6">
            <h2 className="text-lg font-bold text-gray-900">Security</h2>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Change Password</h3>
              <div className="space-y-3">
                {pwError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-sm text-red-700">{pwError}</p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Current Password</label>
                  <div className="relative">
                    <input type={showCurrentPw ? 'text' : 'password'} value={currentPw} onChange={e => { setCurrentPw(e.target.value); setPwError(null) }}
                      className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
                    <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">New Password</label>
                  <div className="relative">
                    <input type={showNewPw ? 'text' : 'password'} value={newPw} onChange={e => { setNewPw(e.target.value); setPwError(null) }}
                      className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min. 8 characters" />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Confirm New Password</label>
                  <input type="password" value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setPwError(null) }}
                    className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${confirmPw && confirmPw !== newPw ? 'border-red-300 bg-red-50' : confirmPw && confirmPw === newPw ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}
                    placeholder="Re-enter new password" />
                </div>
                <button onClick={handleChangePassword} disabled={pwLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                  {pwLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {pwLoading ? 'Changing…' : 'Change Password'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Two-Factor Authentication</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {twoFactorEnabled ? 'TOTP authenticator enabled.' : 'Add an extra layer of security using an authenticator app.'}
                  </p>
                </div>
                {twoFactorEnabled ? (
                  <button onClick={handleDisable2FA} disabled={mfaLoading}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
                    {mfaLoading ? 'Disabling…' : 'Disable 2FA'}
                  </button>
                ) : mfaStep === 'idle' ? (
                  <button onClick={handleEnable2FA} disabled={mfaLoading}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50">
                    {mfaLoading ? 'Loading…' : 'Enable 2FA'}
                  </button>
                ) : null}
              </div>
              {mfaStep === 'qr' && mfaQr && (
                <div className="mt-3 space-y-3 border-t border-gray-100 pt-4">
                  <p className="text-xs text-gray-600">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
                  <div className="flex justify-center">
                    <img src={mfaQr} alt="2FA QR Code" className="w-40 h-40 rounded-lg border border-gray-200" />
                  </div>
                  {mfaSecret && (
                    <p className="text-center text-xs text-gray-400">
                      Manual code: <span className="font-mono font-semibold text-gray-700 tracking-wider">{mfaSecret}</span>
                    </p>
                  )}
                  <p className="text-xs text-gray-600">Then enter the 6-digit code from your app:</p>
                  {mfaError && <p className="text-xs text-red-600">{mfaError}</p>}
                  <input value={mfaCode} onChange={e => { setMfaCode(e.target.value); setMfaError(null) }}
                    placeholder="000 000" maxLength={7}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest font-mono text-lg" />
                  <div className="flex gap-2">
                    <button onClick={() => { setMfaStep('idle'); setMfaCode(''); setMfaQr(null); setMfaError(null) }}
                      className="flex-1 border border-gray-200 text-gray-700 text-sm font-semibold py-2 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                    <button onClick={handleVerify2FA} disabled={mfaLoading || mfaCode.replace(/\s/g, '').length < 6}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-xl transition-colors flex items-center justify-center gap-2">
                      {mfaLoading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      {mfaLoading ? 'Verifying…' : 'Verify & Enable'}
                    </button>
                  </div>
                </div>
              )}
              {twoFactorEnabled && (
                <div className="mt-2 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  Your account is protected with two-factor authentication.
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Active Sessions</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Current browser session</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                  <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                </div>
              </div>
              <button onClick={async () => { await supabase.auth.signOut({ scope: 'others' }); showToast({ type: 'success', title: 'Signed out of all other devices' }) }}
                className="mt-4 w-full border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2 rounded-xl text-sm transition-colors">
                Sign out all other devices
              </button>
            </div>
          </div>
        )}

        {/* ── Notifications ── */}
        {section === 'notifications' && (
          <div className="max-w-lg space-y-6">
            <h2 className="text-lg font-bold text-gray-900">Notification Preferences</h2>
            {([
              { group: 'Email Notifications', prefix: 'email' },
              { group: 'SMS Notifications', prefix: 'sms' },
              { group: 'In-App Notifications', prefix: 'inapp' },
            ] as const).map(({ group, prefix }) => (
              <div key={group} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">{group}</h3>
                <div className="space-y-3">
                  {([
                    { key: 'Maintenance', label: 'Maintenance requests' },
                    { key: 'Rent', label: 'Rent payments' },
                    { key: 'Lease', label: 'Lease renewals' },
                    { key: 'Messages', label: 'New messages' },
                    { key: 'System', label: 'System updates' },
                  ] as const).map(({ key, label }) => {
                    const toggleKey = `${prefix}${key}` as keyof typeof notifPrefs
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <p className="text-sm text-gray-700">{label}</p>
                        <button onClick={() => setNotifPrefs(prev => ({ ...prev, [toggleKey]: !prev[toggleKey] }))}
                          className={`relative w-10 h-6 rounded-full transition-colors ${notifPrefs[toggleKey] ? 'bg-blue-600' : 'bg-gray-200'}`}>
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifPrefs[toggleKey] ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            <button onClick={handleSaveNotifications} disabled={notifSaving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
              {notifSaving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {notifSaving ? 'Saving…' : 'Save Notification Preferences'}
            </button>
          </div>
        )}

        {/* ── Preferences ── */}
        {section === 'preferences' && (
          <div className="max-w-lg space-y-6">
            <h2 className="text-lg font-bold text-gray-900">Preferences</h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Regional Settings</h3>
              <div className="space-y-4">
                {([
                  { label: 'Language', value: prefLanguage, setValue: setPrefLanguage, options: ['English', 'Spanish', 'French'] },
                  { label: 'Timezone', value: prefTimezone, setValue: setPrefTimezone, options: ['America/Chicago', 'America/New_York', 'America/Los_Angeles', 'America/Denver', 'UTC'] },
                  { label: 'Date Format', value: prefDateFormat, setValue: setPrefDateFormat, options: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] },
                  { label: 'Currency', value: prefCurrency, setValue: setPrefCurrency, options: ['USD', 'EUR', 'GBP', 'CAD'] },
                ] as const).map(({ label, value, setValue, options }) => (
                  <div key={label}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                    <select value={value} onChange={e => setValue(e.target.value as never)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Dark Mode</p>
                    <p className="text-xs text-gray-500">Switch to dark theme</p>
                  </div>
                  <button onClick={() => setPrefDarkMode(!prefDarkMode)}
                    className={`relative w-10 h-6 rounded-full transition-colors ${prefDarkMode ? 'bg-blue-600' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefDarkMode ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                <button onClick={handleSavePreferences} disabled={prefsSaving}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                  {prefsSaving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {prefsSaving ? 'Saving…' : 'Save Preferences'}
                </button>
              </div>
            </div>

            {/* Test / Demo Mode */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Developer</h3>
              <p className="text-xs text-gray-400 mb-4">For testing and demonstration purposes only</p>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">Test Mode</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Replace all data with sample records.{' '}
                    <span className="text-amber-600 font-medium">Shows fake data.</span>
                    {' '}Your real data is never touched.
                  </p>
                </div>
                <button onClick={() => {
                    const next = !demoMode; setDemoMode(next)
                    showToast({ type: next ? 'info' : 'success', title: next ? 'Test mode on — showing fake data' : 'Test mode off — showing real data' })
                  }}
                  className={`relative w-10 h-6 rounded-full transition-colors shrink-0 mt-0.5 ${demoMode ? 'bg-amber-400' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${demoMode ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              {demoMode && (
                <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Test mode is <strong>on</strong>. All panels are showing fake data.
                </p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Dashboard Panel ──────────────────────────────────────────────────────────

const DEFAULT_QUICK_ACTIONS = [
  { id: 'add-property', label: 'Add Property', icon: <Building2 className="w-4 h-4" /> },
  { id: 'invite-tenant', label: 'Invite Tenant', icon: <Plus className="w-4 h-4" /> },
  { id: 'generate-report', label: 'Generate Report', icon: <FileText className="w-4 h-4" /> },
  { id: 'announcement', label: 'Send Announcement', icon: <Bell className="w-4 h-4" /> },
  { id: 'review-tickets', label: 'Review Tickets', icon: <Wrench className="w-4 h-4" /> },
  { id: 'schedule', label: 'Schedule Inspection', icon: <CheckCircle className="w-4 h-4" /> },
]

function PendingPaymentRow({ record, tenantName, onConfirm }: { record: RentRecord; tenantName: string; onConfirm: (id: string) => Promise<void> }) {
  const [confirming, setConfirming] = useState(false)
  async function handle() {
    setConfirming(true)
    await onConfirm(record.id)
    setConfirming(false)
  }
  return (
    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-amber-100">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs">
          {tenantName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{tenantName}</p>
          <p className="text-xs text-gray-500">${record.amount.toLocaleString()} · {record.month}{record.method ? ` · ${record.method}` : ''}</p>
        </div>
      </div>
      <button
        onClick={handle}
        disabled={confirming}
        className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
      >
        {confirming ? (
          <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : <CheckCircle className="w-3 h-3" />}
        Confirm
      </button>
    </div>
  )
}

// ─── Command Palette ──────────────────────────────────────────────────────────

function CommandPalette({
  open, onClose, setActivePanel,
  tenants, properties, tickets,
}: {
  open: boolean
  onClose: () => void
  setActivePanel: (p: string) => void
  tenants: Tenant[]
  properties: Property[]
  tickets: MaintenanceTicket[]
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) { setQuery(''); setTimeout(() => inputRef.current?.focus(), 10) } }, [open])
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const NAV_ACTIONS = [
    { label: 'Go to Dashboard', shortcut: 'G D', panel: 'dashboard' },
    { label: 'Go to Properties', shortcut: 'G P', panel: 'properties' },
    { label: 'Go to Units', shortcut: '', panel: 'units' },
    { label: 'Go to Tenants', shortcut: 'G T', panel: 'tenants' },
    { label: 'Go to Leases', shortcut: '', panel: 'leases' },
    { label: 'Go to Maintenance', shortcut: 'G M', panel: 'maintenance' },
    { label: 'Go to Payments', shortcut: 'G L', panel: 'payments' },
    { label: 'Go to Reports', shortcut: 'G R', panel: 'reports' },
    { label: 'Go to Messages', shortcut: '', panel: 'messages' },
    { label: 'Go to Documents', shortcut: '', panel: 'documents' },
  ]

  const q = query.toLowerCase()
  const matchedActions = q ? NAV_ACTIONS.filter(a => a.label.toLowerCase().includes(q)) : NAV_ACTIONS.slice(0, 5)
  const matchedTenants = q.length >= 2 ? tenants.filter(t => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)).slice(0, 4) : []
  const matchedProperties = q.length >= 2 ? properties.filter(p => p.name.toLowerCase().includes(q)).slice(0, 3) : []
  const matchedTickets = q.length >= 2 ? tickets.filter(t => t.title.toLowerCase().includes(q) || t.tenantName.toLowerCase().includes(q)).slice(0, 3) : []

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            className="flex-1 text-sm bg-transparent focus:outline-none text-gray-900 placeholder-gray-400"
          />
          <kbd className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {matchedActions.length > 0 && (
            <div>
              <p className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Navigation</p>
              {matchedActions.map(a => (
                <button key={a.panel} onClick={() => { setActivePanel(a.panel); onClose() }}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
                  <span>{a.label}</span>
                  {a.shortcut && <kbd className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">{a.shortcut}</kbd>}
                </button>
              ))}
            </div>
          )}
          {matchedTenants.length > 0 && (
            <div>
              <p className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Tenants</p>
              {matchedTenants.map(t => (
                <button key={t.id} onClick={() => { setActivePanel('tenants'); onClose() }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-[10px] text-gray-400">{t.property} · Unit {t.unit}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {matchedProperties.length > 0 && (
            <div>
              <p className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Properties</p>
              {matchedProperties.map(p => (
                <button key={p.id} onClick={() => { setActivePanel('properties'); onClose() }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
                  <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          )}
          {matchedTickets.length > 0 && (
            <div>
              <p className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Tickets</p>
              {matchedTickets.map(t => (
                <button key={t.id} onClick={() => { setActivePanel('maintenance'); onClose() }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">
                  <Wrench className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <p className="font-medium">{t.title}</p>
                    <p className="text-[10px] text-gray-400">{t.property} · {t.tenantName}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {q.length >= 2 && matchedTenants.length === 0 && matchedProperties.length === 0 && matchedTickets.length === 0 && matchedActions.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-400 text-center">No results for "{query}"</p>
          )}
        </div>
      </div>
    </div>
  )
}

interface DashboardPanelProps {
  setActivePanel: (panel: string) => void
  onShowInviteModal: () => void
  onShowAddPropertyModal: () => void
  onShowAnnouncementModal: () => void
  tickets: MaintenanceTicket[]
  tenants: Tenant[]
  properties: Property[]
  rentRecords: RentRecord[]
  recentActivity: { id: string; type: string; text: string; time: string }[]
}

function DashboardPanel({
  setActivePanel, onShowInviteModal, onShowAddPropertyModal,
  onShowAnnouncementModal,
  tickets, tenants, properties, rentRecords, recentActivity,
}: DashboardPanelProps) {
  const { primaryColor } = useBranding()
  // ── Core metrics ────────────────────────────────────────────────────────────
  const totalUnits = properties.reduce((s, p) => s + p.units, 0)
  const totalOccupied = properties.reduce((s, p) => s + p.occupied, 0)
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const collectedIds = new Set(rentRecords.filter(r => r.month === currentMonth && r.status !== 'pending').map(r => r.tenantId))
  const activeTenants = tenants.filter(t => t.status !== 'notice' && t.status !== 'past')
  const rentCollectedMTD = rentRecords.filter(r => r.month === currentMonth && r.status !== 'pending').reduce((s, r) => s + r.amount, 0)
  const openTickets = tickets.filter(t => t.status !== 'resolved')
  const occupancyPct = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0

  // ── Attention data ───────────────────────────────────────────────────────────
  const attentionData = useMemo(() => {
    const now = new Date()
    const thisMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const todayDay = now.getDate()
    const emergencyTickets = tickets.filter(t => t.priority === 'emergency' && t.status !== 'resolved')
    const paidThisMonth = new Set(rentRecords.filter(r => r.month === thisMonth && r.status !== 'pending').map(r => r.tenantId))
    const overdueRent = activeTenants.filter(t => !paidThisMonth.has(t.id) && todayDay > (t.rentDueDay ?? 1))
    const expiringLeases = tenants
      .filter(t => t.status !== 'past' && t.status !== 'invited' && t.leaseEnd)
      .map(t => ({ ...t, daysLeft: Math.ceil((new Date(t.leaseEnd).getTime() - now.getTime()) / 86400000) }))
      .filter(t => t.daysLeft >= 0 && t.daysLeft <= 60)
      .sort((a, b) => a.daysLeft - b.daysLeft)
    const vacantUnits = properties.flatMap(p => {
      const n = p.units - p.occupied
      return n > 0 ? Array.from({ length: n }, (_, i) => ({ propertyName: p.name, propertyId: p.id, idx: i })) : []
    })
    return { emergencyTickets, overdueRent, expiringLeases, vacantUnits }
  }, [tickets, rentRecords, activeTenants, tenants, properties])

  // ── Tasks (localStorage) ─────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<Array<{id: string; text: string; done: boolean}>>(() => {
    try { return JSON.parse(localStorage.getItem('bmp_tasks') ?? '[]') } catch { return [] }
  })
  const [newTask, setNewTask] = useState('')
  function saveTasks(next: typeof tasks) { setTasks(next); localStorage.setItem('bmp_tasks', JSON.stringify(next)) }
  function addTask() {
    if (!newTask.trim()) return
    saveTasks([...tasks, { id: Date.now().toString(), text: newTask.trim(), done: false }])
    setNewTask('')
  }
  function toggleTask(id: string) { saveTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t)) }
  function removeTask(id: string) { saveTasks(tasks.filter(t => t.id !== id)) }

  // ── Maintenance queue ────────────────────────────────────────────────────────
  const PRIORITY_ORDER: Record<string, number> = { emergency: 0, high: 1, medium: 2, low: 3 }
  const maintenanceQueue = [...openTickets]
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4))
    .slice(0, 6)

  // ── Delinquent tenants ───────────────────────────────────────────────────────
  const delinquent = attentionData.overdueRent
    .map(t => ({ ...t, daysLate: Math.max(0, new Date().getDate() - (t.rentDueDay ?? 1)) }))
    .sort((a, b) => b.daysLate - a.daysLate)

  return (
    <div className="h-full overflow-auto p-4 bg-gray-50 space-y-3">

      {/* ── KPI Strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: 'Occupancy',
            value: `${occupancyPct}%`,
            sub: `${totalOccupied} of ${totalUnits} units`,
            ok: occupancyPct >= 90,
            warn: occupancyPct >= 75,
            icon: <Home className="w-4 h-4" />,
            go: 'properties',
          },
          {
            label: 'Rent Collected MTD',
            value: `$${rentCollectedMTD.toLocaleString()}`,
            sub: delinquent.length > 0 ? `${delinquent.length} delinquent` : 'All paid',
            ok: delinquent.length === 0,
            warn: false,
            icon: <DollarSign className="w-4 h-4" />,
            go: 'payments',
          },
          {
            label: 'Open Tickets',
            value: String(openTickets.length),
            sub: attentionData.emergencyTickets.length > 0 ? `${attentionData.emergencyTickets.length} emergency` : 'No emergencies',
            ok: openTickets.length === 0,
            warn: openTickets.length > 0 && attentionData.emergencyTickets.length === 0,
            icon: <Wrench className="w-4 h-4" />,
            go: 'maintenance',
          },
          {
            label: 'Lease Renewals',
            value: String(attentionData.expiringLeases.length),
            sub: (() => { const u = attentionData.expiringLeases.filter(t => t.daysLeft <= 30).length; return u > 0 ? `${u} in 30 days` : attentionData.expiringLeases.length > 0 ? 'In 60-day window' : 'None soon' })(),
            ok: attentionData.expiringLeases.length === 0,
            warn: attentionData.expiringLeases.length > 0 && attentionData.expiringLeases.filter(t => t.daysLeft <= 30).length === 0,
            icon: <FileText className="w-4 h-4" />,
            go: 'tenants',
          },
        ].map(kpi => {
          const color = kpi.ok ? 'text-green-700' : kpi.warn ? 'text-amber-700' : 'text-red-700'
          const bg = kpi.ok ? 'bg-green-50 border-green-200' : kpi.warn ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
          return (
            <button key={kpi.label} onClick={() => setActivePanel(kpi.go)}
              className={`border rounded-lg px-4 py-3 text-left hover:shadow-sm transition-all bg-white ${bg}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{kpi.label}</span>
                <span className={color}>{kpi.icon}</span>
              </div>
              <p className={`text-2xl font-bold leading-none ${color}`}>{kpi.value}</p>
              <p className="text-xs text-gray-500 mt-1">{kpi.sub}</p>
            </button>
          )
        })}
      </div>

      {/* ── Middle Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">

        {/* Delinquent Tenants */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-1.5">
              {delinquent.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Delinquent</span>
              {delinquent.length > 0 && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{delinquent.length}</span>}
            </div>
            <button onClick={() => setActivePanel('tenants')} className="text-[10px] font-semibold text-gray-400 hover:text-gray-600">View all</button>
          </div>
          <div className="divide-y divide-gray-50 max-h-52 overflow-y-auto">
            {delinquent.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-4 text-xs text-gray-400">
                <CheckCircle className="w-3.5 h-3.5 text-green-400" /> All rent collected
              </div>
            ) : delinquent.slice(0, 8).map(t => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer" onClick={() => setActivePanel('tenants')}>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{t.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{t.property} · Unit {t.unit}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className="text-[10px] font-bold text-red-600">{t.daysLate}d</span>
                  <span className="text-[10px] text-gray-500">${t.rent.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance Queue */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-1.5">
              {attentionData.emergencyTickets.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Maintenance</span>
              {openTickets.length > 0 && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{openTickets.length}</span>}
            </div>
            <button onClick={() => setActivePanel('maintenance')} className="text-[10px] font-semibold text-gray-400 hover:text-gray-600">View all</button>
          </div>
          <div className="divide-y divide-gray-50 max-h-52 overflow-y-auto">
            {maintenanceQueue.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-4 text-xs text-gray-400">
                <CheckCircle className="w-3.5 h-3.5 text-green-400" /> No open tickets
              </div>
            ) : maintenanceQueue.map(t => {
              const PCOLOR: Record<string, string> = { emergency: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-amber-400', low: 'bg-gray-300' }
              return (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer" onClick={() => setActivePanel('maintenance')}>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PCOLOR[t.priority] ?? 'bg-gray-300'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 truncate">{t.title}</p>
                    <p className="text-[10px] text-gray-400 truncate">{t.property} · {t.unit}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-1 rounded shrink-0 ${t.status === 'in_progress' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 bg-gray-100'}`}>
                    {t.status === 'in_progress' ? 'WIP' : 'Open'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Today's Tasks */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Tasks</span>
              {tasks.filter(t => !t.done).length > 0 && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{tasks.filter(t => !t.done).length}</span>}
            </div>
            <span className="text-[10px] text-gray-400">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
          <div className="flex-1 max-h-44 overflow-y-auto divide-y divide-gray-50">
            {tasks.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-400">No tasks — add one below</div>
            ) : tasks.map(task => (
              <div key={task.id} className="flex items-center gap-2 px-3 py-2 group hover:bg-gray-50">
                <button onClick={() => toggleTask(task.id)} className="shrink-0">
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${task.done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}>
                    {task.done && <svg className="w-2 h-2" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </button>
                <span className={`text-xs flex-1 ${task.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.text}</span>
                <button onClick={() => removeTask(task.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-gray-100 flex gap-1.5">
            <input
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              placeholder="Add task..."
              className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-300"
            />
            <button onClick={addTask} disabled={!newTask.trim()} className="px-2 py-1.5 text-xs font-semibold text-white rounded disabled:opacity-40 transition-colors" style={{ background: primaryColor }}>
              Add
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">

        {/* Recent Activity */}
        <div className="col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Recent Activity</span>
            <span className="text-[10px] text-gray-400">{recentActivity.length} events</span>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
            {recentActivity.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-400">No recent activity</div>
            ) : recentActivity.slice(0, 12).map(a => (
              <div key={a.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-gray-50">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <p className="text-xs text-gray-700 flex-1 leading-snug">{a.text}</p>
                <span className="text-[10px] text-gray-400 shrink-0 whitespace-nowrap">{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expiring Leases */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Expiring Leases</span>
              {attentionData.expiringLeases.length > 0 && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{attentionData.expiringLeases.length}</span>}
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
            {attentionData.expiringLeases.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-4 text-xs text-gray-400">
                <CheckCircle className="w-3.5 h-3.5 text-green-400" /> None in 60 days
              </div>
            ) : attentionData.expiringLeases.slice(0, 8).map(t => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer" onClick={() => setActivePanel('tenants')}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-800 truncate">{t.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{t.unit} · {t.property}</p>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${t.daysLeft <= 14 ? 'bg-red-100 text-red-700' : t.daysLeft <= 30 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                  {t.daysLeft}d
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  )
}


// ─── Tenants Panel ────────────────────────────────────────────────────────────

// ─── Import Tenants Modal ─────────────────────────────────────────────────────

const IMPORT_CSV_HEADERS = ['name', 'email', 'phone', 'property', 'unit', 'monthly_rent', 'lease_start', 'lease_end', 'rent_due_day', 'notes']

const EXAMPLE_CSV = [
  IMPORT_CSV_HEADERS.join(','),
  'Jane Smith,jane@example.com,555-0101,Maple Heights,1A,1500,2025-01-01,2026-01-01,1,Quiet tenant prefers email',
  'Robert Kim,robert@example.com,555-0202,Maple Heights,2B,1750,2025-03-01,2026-03-01,15,Has one dog',
  'Emily Chen,emily@example.com,,Sunset Lofts,3C,2100,2025-06-01,2026-06-01,,',
].join('\n')

interface ImportRow {
  row: number
  name: string
  email: string
  phone: string
  property: string
  unit: string
  monthly_rent: string
  lease_start: string
  lease_end: string
  rent_due_day: string
  notes: string
  errors: string[]
}

function parseCSV(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const idx = (col: string) => header.indexOf(col)
  return lines.slice(1).map((line, i) => {
    // simple CSV split — handles no quotes
    const cols = line.split(',').map(c => c.trim())
    const get = (col: string) => cols[idx(col)] ?? ''
    const errors: string[] = []
    const name = get('name')
    const email = get('email')
    const property = get('property')
    const unit = get('unit')
    const monthly_rent = get('monthly_rent')
    const lease_end = get('lease_end')
    if (!name) errors.push('Name required')
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid email required')
    if (!property) errors.push('Property required')
    if (!unit) errors.push('Unit required')
    if (!monthly_rent || isNaN(Number(monthly_rent)) || Number(monthly_rent) < 1) errors.push('Valid monthly rent required')
    if (!lease_end) errors.push('Lease end required')
    return {
      row: i + 2, name, email, phone: get('phone'), property, unit, monthly_rent,
      lease_start: get('lease_start'), lease_end, rent_due_day: get('rent_due_day'), notes: get('notes'), errors,
    }
  })
}

function ImportTenantsModal({ properties, onClose, onImported }: { properties: Property[]; onClose: () => void; onImported: (count: number) => void }) {
  const { demoMode } = useDemoMode()
  const [rows, setRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function downloadExample() {
    const blob = new Blob([EXAMPLE_CSV], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'import_tenants_example.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => setRows(parseCSV(e.target?.result as string))
    reader.readAsText(file)
  }

  async function handleImport() {
    if (demoMode) { showToast({ type: 'info', title: 'Demo mode — no changes saved' }); onClose(); return }
    const valid = rows.filter(r => r.errors.length === 0)
    if (valid.length === 0) return
    setImporting(true)
    const { data: { user: pmUser } } = await supabase.auth.getUser()
    let count = 0
    for (const row of valid) {
      const prop = properties.find(p => p.name.toLowerCase().trim() === row.property.toLowerCase().trim())
      if (!prop) continue
      const unitId = await findOrCreateUnit(prop.id, row.unit, Number(row.monthly_rent))
      if (!unitId) continue
      const inviteToken = crypto.randomUUID()
      const { error } = await supabase.from('tenants').insert({
        id: crypto.randomUUID(),
        pm_id: pmUser!.id,
        unit_id: unitId,
        name: row.name,
        email: row.email,
        phone: row.phone || null,
        monthly_rent: Number(row.monthly_rent),
        lease_start: row.lease_start || null,
        lease_end: row.lease_end,
        status: 'invited',
        invite_token: inviteToken,
        notes: row.notes || null,
        rent_due_day: row.rent_due_day ? Number(row.rent_due_day) : null,
      })
      if (!error) count++
    }
    setImporting(false)
    setImportedCount(count)
    setDone(true)
    onImported(count)
    showToast({ type: 'success', title: `${count} tenant${count !== 1 ? 's' : ''} imported` })
  }

  const validCount = rows.filter(r => r.errors.length === 0).length
  const errorCount = rows.filter(r => r.errors.length > 0).length
  const unknownProps = Array.from(new Set(
    rows.filter(r => r.errors.length === 0 && !properties.find(p => p.name.toLowerCase().trim() === r.property.toLowerCase().trim())).map(r => r.property)
  ))

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Import Tenants</h2>
            <p className="text-xs text-gray-400">Upload a CSV file to bulk-add tenants</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Example download */}
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-bold text-blue-900">Download the example CSV</p>
              <p className="text-xs text-blue-600 mt-0.5">Fill it in and upload below. Property names must match exactly.</p>
            </div>
            <button
              onClick={downloadExample}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors shrink-0 ml-4"
            >
              <FileText className="w-3.5 h-3.5" /> Example CSV
            </button>
          </div>

          {/* CSV columns reference */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Required columns</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { col: 'name', req: true }, { col: 'email', req: true }, { col: 'property', req: true },
                { col: 'unit', req: true }, { col: 'monthly_rent', req: true }, { col: 'lease_end', req: true },
                { col: 'phone', req: false }, { col: 'lease_start', req: false }, { col: 'rent_due_day', req: false }, { col: 'notes', req: false },
              ].map(c => (
                <span key={c.col} className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${c.req ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-gray-200 text-gray-500'}`}>
                  {c.col}{c.req ? ' *' : ''}
                </span>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          {rows.length === 0 && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}
            >
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">Drop your CSV here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">Accepts .csv files</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && !done && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-800">{rows.length} row{rows.length !== 1 ? 's' : ''} detected</span>
                {validCount > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{validCount} valid</span>}
                {errorCount > 0 && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{errorCount} with errors</span>}
                <button onClick={() => { setRows([]); if (fileRef.current) fileRef.current.value = '' }} className="ml-auto text-xs text-gray-500 hover:text-gray-700 underline">Clear</button>
              </div>

              {unknownProps.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                  <span className="font-bold">Unknown properties:</span> {unknownProps.join(', ')} — these rows will be skipped. Make sure property names exactly match your existing properties.
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {['#', 'Name', 'Email', 'Property', 'Unit', 'Rent', 'Lease End', 'Status'].map(h => (
                          <th key={h} className="text-left px-3 py-2 font-semibold text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => {
                        const propFound = properties.find(p => p.name.toLowerCase().trim() === r.property.toLowerCase().trim())
                        const hasError = r.errors.length > 0 || !propFound
                        return (
                          <tr key={r.row} className={`border-b border-gray-50 ${hasError ? 'bg-red-50' : ''}`}>
                            <td className="px-3 py-2 text-gray-400">{r.row}</td>
                            <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{r.name || <span className="text-red-400 italic">missing</span>}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.email || <span className="text-red-400 italic">missing</span>}</td>
                            <td className={`px-3 py-2 whitespace-nowrap ${propFound ? 'text-gray-600' : 'text-red-600 font-semibold'}`}>{r.property || '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{r.unit || '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{r.monthly_rent ? `$${Number(r.monthly_rent).toLocaleString()}` : <span className="text-red-400 italic">missing</span>}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.lease_end || <span className="text-red-400 italic">missing</span>}</td>
                            <td className="px-3 py-2">
                              {hasError
                                ? <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold text-[10px]">Skip</span>
                                : <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold text-[10px]">Import</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {done && (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <p className="text-base font-bold text-gray-900">{importedCount} tenant{importedCount !== 1 ? 's' : ''} imported</p>
              <p className="text-xs text-gray-400 mt-1">They'll appear in your tenants list. Send invites individually to notify them.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-400">{validCount > 0 ? `${validCount} tenant${validCount !== 1 ? 's' : ''} will be imported` : rows.length > 0 ? 'Fix errors above to enable import' : 'Upload a CSV to get started'}</p>
            <div className="flex gap-2">
              <button onClick={onClose} className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2 px-4 rounded-xl text-sm transition-colors">Cancel</button>
              <button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-xl text-sm transition-colors flex items-center gap-2"
              >
                {importing && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {importing ? 'Importing…' : `Import ${validCount > 0 ? validCount : ''} Tenant${validCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
        {done && (
          <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex justify-end">
            <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-xl text-sm transition-colors">Done</button>
          </div>
        )}
      </div>
    </ModalBackdrop>
  )
}

interface TenantsPanelProps {
  tenants: Tenant[]
  setTenants: React.Dispatch<React.SetStateAction<Tenant[]>>
  rentRecords: RentRecord[]
  threads: Thread[]
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>
  setActivePanel: (panel: string) => void
  setSelectedThreadId: React.Dispatch<React.SetStateAction<string | null>>
  onShowInviteModal: () => void
  onEditTenant: (id: string) => void
  onViewTenant: (id: string) => void
  onLogPayment: (tenantId: string) => void
  properties: Property[]
}

function TenantsPanel({ tenants, setTenants, rentRecords, threads, setThreads, setActivePanel, setSelectedThreadId, onShowInviteModal, onEditTenant, onViewTenant, onLogPayment, properties }: TenantsPanelProps) {
  const [showImport, setShowImport] = useState(false)
  const [search, setSearch] = useState('')
  const [filterProperty, setFilterProperty] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'rent' | 'leaseEnd'>('name')
  const [tenantStatusDropdownId, setTenantStatusDropdownId] = useState<string | null>(null)
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDeleteTenant(id: string) {
    setDeletingId(id)
    const { error } = await supabase.from('tenants').delete().eq('id', id)
    if (error) {
      showToast({ type: 'error', title: 'Failed to delete tenant', message: error.message })
    } else {
      setTenants(prev => prev.filter(t => t.id !== id))
      showToast({ type: 'success', title: 'Tenant deleted' })
    }
    setDeletingId(null)
    setConfirmDeleteId(null)
  }

  async function resendInvite(t: Tenant) {
    setResendingInviteId(t.id)
    const newToken = crypto.randomUUID()
    const { error } = await supabase.from('tenants').update({ invite_token: newToken }).eq('id', t.id)
    if (error) {
      showToast({ type: 'error', title: 'Failed to resend invite', message: error.message })
      setResendingInviteId(null)
      return
    }
    const link = `${window.location.origin}/invite?token=${newToken}`
    const htmlBody = `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#f3f4f6;padding:24px">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
        <div style="background:#2563EB;padding:20px 24px"><h1 style="margin:0;color:#fff;font-size:16px">You've been invited to your tenant portal</h1></div>
        <div style="padding:24px">
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">Your property manager has set up an account for you. Click the button below to create your password and access your portal.</p>
          <a href="${link}" style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:10px">Accept Invite &amp; Create Account</a>
          <p style="color:#9CA3AF;font-size:12px;margin:16px 0 0">Or copy this link: ${link}</p>
        </div>
      </div>
    </body></html>`
    sendDirectEmail(t.email, 'You\'ve been invited to your tenant portal', htmlBody).catch(() => {})
    showToast({
      type: 'success',
      title: 'Invite resent!',
      message: link,
    })
    setResendingInviteId(null)
  }

  const today = new Date()
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Auto-detect overdue: active/late tenants with no payment record for current month
  const overdueIds = new Set(
    tenants
      .filter(t => t.status !== 'invited' && t.status !== 'past' && t.status !== 'notice')
      .filter(t => !rentRecords.some(r => r.tenantId === t.id && r.month === currentMonth))
      .map(t => t.id)
  )

  const uniqueProperties = Array.from(new Set(tenants.map(t => t.property)))

  const filtered = tenants
    .filter(t => {
      const q = search.toLowerCase()
      const matchSearch = !q || t.name.toLowerCase().includes(q) || t.unit.toLowerCase().includes(q) || t.property.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
      const matchProp = !filterProperty || t.property === filterProperty
      const matchStatus = !filterStatus || t.status === filterStatus
      return matchSearch && matchProp && matchStatus
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'rent') return b.rent - a.rent
      if (sortBy === 'leaseEnd') return new Date(a.leaseEnd).getTime() - new Date(b.leaseEnd).getTime()
      return 0
    })

  const cutoff = new Date('2026-09-08')
  const expiringSoon = tenants.filter(t => {
    try { const d = new Date(t.leaseEnd); return d >= today && d <= cutoff } catch { return false }
  })

  const totalTenants = tenants.length
  const paidThisMonth = tenants.filter(t => rentRecords.some(r => r.tenantId === t.id && r.month === currentMonth)).length
  const overdueCount = overdueIds.size
  const avgLeaseMs = tenants.reduce((acc, t) => {
    try { return acc + Math.max(0, new Date(t.leaseEnd).getTime() - today.getTime()) } catch { return acc }
  }, 0) / tenants.length
  const avgLeaseDays = Math.round(avgLeaseMs / 86400000)

  const statusLabels: Record<string, string> = { active: 'Active', late: 'Late', notice: 'Notice', past: 'Past', invited: 'Invited' }
  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    current: 'bg-green-100 text-green-700',
    late: 'bg-red-100 text-red-700',
    notice: 'bg-amber-100 text-amber-700',
    invited: 'bg-purple-100 text-purple-700',
  }

  const statusBadge = (s: string, tenantId: string) => {
    if (s === 'invited') {
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 flex items-center gap-1 w-fit">INVITED</span>
    }
    return (
    <div className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setTenantStatusDropdownId(tenantStatusDropdownId === tenantId ? null : tenantId) }}
        className={`px-2 py-0.5 text-xs font-semibold rounded-full cursor-pointer flex items-center gap-1 ${statusColors[s] || 'bg-gray-100 text-gray-600'}`}
      >
        {statusLabels[s] || s}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {tenantStatusDropdownId === tenantId && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 w-28 animate-fade-in">
          {(['active', 'late', 'notice'] as const).map(st => (
            <button key={st} onClick={async () => {
              setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, status: st } : t))
              showToast({ type: 'success', title: `Status updated to ${statusLabels[st]}` })
              setTenantStatusDropdownId(null)
              await supabase.from('tenants').update({ status: st }).eq('id', tenantId)
            }} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${st === 'active' ? 'bg-green-500' : st === 'late' ? 'bg-red-500' : 'bg-amber-500'}`} />
              {statusLabels[st]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
  }

  function handleMessage(tenant: Tenant) {
    const existing = threads.find((th) => th.tenantId === tenant.id)
    if (!existing) {
      setThreads(prev => [...prev, { id: tenant.id, tenantId: tenant.id, tenantName: tenant.name, tenantUnit: `${tenant.property} · Unit ${tenant.unit}`, unread: 0, lastMessage: '', lastTime: '' }])
    }
    setSelectedThreadId(tenant.id)
    setActivePanel('messages')
  }

  return (
    <div className="p-6 animate-slide-up space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Tenants</h2>
          <p className="text-xs text-gray-500">{totalTenants} tenants across all properties</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button
            onClick={onShowInviteModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" /> Invite Tenant
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Tenants', value: totalTenants, color: 'text-blue-600' },
          { label: 'Paid This Month', value: paidThisMonth, color: 'text-green-600' },
          { label: 'Overdue', value: overdueCount, color: overdueCount > 0 ? 'text-red-600' : 'text-gray-400' },
          { label: 'Avg Lease Remaining', value: `${avgLeaseDays}d`, color: 'text-purple-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Overdue Alert */}
      {overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-sm font-semibold text-red-800">{overdueCount} Tenant{overdueCount > 1 ? 's' : ''} — No {currentMonth} Payment Logged</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tenants.filter(t => overdueIds.has(t.id)).map(t => (
              <button
                key={t.id}
                onClick={() => onLogPayment(t.id)}
                className="bg-red-100 hover:bg-red-200 text-red-800 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 transition-colors"
              >
                <CreditCard className="w-3 h-3" />
                {t.name} · Unit {t.unit}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Expiring Soon Alert */}
      {expiringSoon.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">Leases Expiring Within 90 Days</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {expiringSoon.map(t => (
              <span key={t.id} className="bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full">
                {t.name} — Unit {t.unit} — {t.leaseEnd}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            placeholder="Search tenants…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={filterProperty} onChange={e => setFilterProperty(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Properties</option>
          {uniqueProperties.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="late">Late</option>
          <option value="notice">Notice</option>
          <option value="past">Past</option>
          <option value="invited">Invited</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="name">Sort: Name</option>
          <option value="rent">Sort: Rent (high→low)</option>
          <option value="leaseEnd">Sort: Lease End</option>
        </select>
        {(search || filterProperty || filterStatus) && (
          <button onClick={() => { setSearch(''); setFilterProperty(''); setFilterStatus('') }}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-2 rounded-lg hover:bg-gray-100">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tenant</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Property</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rent</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lease End</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">June</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const hasPaid = rentRecords.some(r => r.tenantId === t.id && r.month === currentMonth)
              return (
                <tr key={t.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${overdueIds.has(t.id) ? 'bg-red-50/30' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={t.name} size="sm" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-400">{t.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-700">{t.unit}</td>
                  <td className="px-5 py-3 text-sm text-gray-700 max-w-[140px] truncate">{t.property}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-gray-900">${t.rent.toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{t.leaseEnd}</td>
                  <td className="px-5 py-3">{statusBadge(t.status, t.id)}</td>
                  <td className="px-5 py-3">
                    {t.status === 'invited' ? <span className="text-xs text-gray-400">—</span>
                      : hasPaid
                      ? <span className="flex items-center gap-1 text-xs font-semibold text-green-600"><CheckCircle className="w-3.5 h-3.5" /> Paid</span>
                      : <button onClick={() => onLogPayment(t.id)} className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 border border-red-200 px-2 py-0.5 rounded-lg hover:bg-red-50"><CreditCard className="w-3 h-3" /> Log</button>
                    }
                  </td>
                  <td className="px-5 py-3">
                    {confirmDeleteId === t.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-600 font-medium">Delete?</span>
                        <button
                          onClick={() => handleDeleteTenant(t.id)}
                          disabled={deletingId === t.id}
                          className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 px-2 py-1 rounded-lg flex items-center gap-1"
                        >
                          {deletingId === t.id && <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
                          Yes
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-xs font-semibold text-gray-600 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => onEditTenant(t.id)} className="text-xs font-semibold text-gray-600 hover:text-gray-800 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">
                          Edit
                        </button>
                        {t.status === 'invited' ? (
                          <button
                            onClick={() => resendInvite(t)}
                            disabled={resendingInviteId === t.id}
                            className="text-xs font-semibold text-purple-600 hover:text-purple-700 border border-purple-200 px-2 py-1 rounded-lg hover:bg-purple-50 disabled:opacity-50 flex items-center gap-1"
                          >
                            {resendingInviteId === t.id
                              ? <span className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                              : <Send className="w-3 h-3" />}
                            Resend
                          </button>
                        ) : (
                          <button onClick={() => onViewTenant(t.id)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 border border-blue-100 px-2 py-1 rounded-lg hover:bg-blue-50">
                            Profile
                          </button>
                        )}
                        <button onClick={() => handleMessage(t)} className="text-xs font-semibold text-gray-500 hover:text-gray-700 p-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setConfirmDeleteId(t.id)} className="text-xs text-gray-400 hover:text-red-500 p-1 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">No tenants match your filters.</div>
        )}
      </div>

      {showImport && (
        <ImportTenantsModal
          properties={properties}
          onClose={() => setShowImport(false)}
          onImported={(count) => {
            setShowImport(false)
            if (count > 0) showToast({ type: 'success', title: `${count} tenant${count !== 1 ? 's' : ''} imported — refresh to see them` })
          }}
        />
      )}
    </div>
  )
}

// ─── Maintenance Panel ────────────────────────────────────────────────────────

// ─── Recurring Schedules ─────────────────────────────────────────────────────

function NewScheduleModal({ properties, onClose, onSaved }: { properties: Property[]; onClose: () => void; onSaved: (s: RecurringSchedule) => void }) {
  const { primaryColor } = useBranding()
  const [saving, setSaving] = useState(false)
  const todayStr = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ propertyId: properties[0]?.id ?? '', title: '', frequency: 'monthly' as RecurringSchedule['frequency'], nextDue: todayStr })
  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('maintenance_schedules') as any).insert({
      pm_id: user?.id,
      property_id: isUuid(form.propertyId) ? form.propertyId : null,
      title: form.title.trim(),
      frequency: form.frequency,
      next_due: form.nextDue,
    }).select().single()
    if (error) {
      if (isTableMissing(error)) {
        showToast({ type: 'error', title: 'Run the Schedules SQL first', message: 'See Recurring tab for setup instructions' })
      } else {
        showToast({ type: 'error', title: 'Failed to save', message: error.message })
      }
      setSaving(false); return
    }
    onSaved(recurringScheduleFromRow(data as Record<string, unknown>))
    setSaving(false)
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">New Recurring Schedule</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Task Title *</label>
            <input autoFocus value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="e.g. Replace HVAC filter, Gutter cleaning…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Property</label>
            <select value={form.propertyId} onChange={e => setForm(f => ({...f, propertyId: e.target.value}))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">All properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Frequency</label>
              <select value={form.frequency} onChange={e => setForm(f => ({...f, frequency: e.target.value as RecurringSchedule['frequency']}))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {SCHEDULE_FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">First Due Date</label>
              <input type="date" value={form.nextDue} onChange={e => setForm(f => ({...f, nextDue: e.target.value}))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving || !form.title.trim()} className="flex-1 text-white py-2.5 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50" style={{ background: primaryColor }}>
              {saving ? 'Saving…' : 'Create Schedule'}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

function SchedulesSubPanel({ properties, tickets, setTickets }: { properties: Property[]; tickets: MaintenanceTicket[]; setTickets: React.Dispatch<React.SetStateAction<MaintenanceTicket[]>> }) {
  const { primaryColor } = useBranding()
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)

  async function fetchSchedules() {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('maintenance_schedules') as any).select('*, properties!property_id(name)').order('next_due')
    if (isTableMissing(error)) { setTableError(true); setLoading(false); return }
    setSchedules((data ?? []).map((r: Record<string, unknown>) => ({
      ...recurringScheduleFromRow(r),
      propertyName: (r.properties as Record<string, unknown> | null)?.name as string | undefined,
    })))
    setLoading(false)
  }
  useEffect(() => { fetchSchedules() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date().toISOString().split('T')[0]

  async function runNow(schedule: RecurringSchedule) {
    setRunningId(schedule.id)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('maintenance_requests').insert({
      pm_id: user?.id,
      title: schedule.title,
      description: `Recurring task — ${SCHEDULE_FREQUENCIES.find(f => f.value === schedule.frequency)?.label ?? schedule.frequency} schedule`,
      priority: 'medium',
      status: 'open',
    }).select().single()
    if (error) { showToast({ type: 'error', title: 'Failed to create ticket', message: error.message }); setRunningId(null); return }
    // Advance next_due
    const freq = SCHEDULE_FREQUENCIES.find(f => f.value === schedule.frequency)
    const nextDueDate = new Date(schedule.nextDue)
    nextDueDate.setDate(nextDueDate.getDate() + (freq?.days ?? 30))
    const nextDue = nextDueDate.toISOString().split('T')[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('maintenance_schedules') as any).update({ next_due: nextDue, last_run: today }).eq('id', schedule.id)
    setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, nextDue, lastRun: today } : s))
    const newTicket: MaintenanceTicket = {
      id: data.id, tenantId: '', tenantName: 'Unassigned', unit: '-',
      property: schedule.propertyName ?? '-', category: 'Recurring',
      title: schedule.title, description: data.description ?? '',
      priority: 'medium', status: 'open',
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      createdAtIso: new Date().toISOString(),
      updatedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }
    setTickets(prev => [newTicket, ...prev])
    showToast({ type: 'success', title: `Ticket created for "${schedule.title}"` })
    setRunningId(null)
  }

  async function deleteSchedule(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('maintenance_schedules') as any).delete().eq('id', id)
    setSchedules(prev => prev.filter(s => s.id !== id))
    showToast({ type: 'success', title: 'Schedule removed' })
  }

  const freqColors: Record<string, string> = {
    weekly: 'bg-blue-100 text-blue-700',
    monthly: 'bg-purple-100 text-purple-700',
    quarterly: 'bg-amber-100 text-amber-700',
    annually: 'bg-green-100 text-green-700',
  }

  if (loading) return <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-xl" />)}</div>

  if (tableError) return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
      <p className="text-sm font-bold text-amber-900 mb-1">Schedules table not set up</p>
      <p className="text-xs text-amber-700 mb-3">Run each statement separately in Supabase Dashboard → SQL Editor:</p>
      <pre className="bg-white border border-amber-200 rounded-lg p-3 text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap">{SCHEDULES_CREATE_SQL}</pre>
    </div>
  )

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{schedules.length} recurring task{schedules.length !== 1 ? 's' : ''} · {schedules.filter(s => s.nextDue <= today).length} due</p>
        <button onClick={() => setShowNewModal(true)} className="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl hover:opacity-90" style={{ background: primaryColor }}>
          <Plus className="w-4 h-4" /> New Schedule
        </button>
      </div>

      {schedules.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Repeat className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-500">No recurring schedules yet</p>
          <p className="text-xs text-gray-400 mt-1">Set up HVAC filters, gutter cleaning, fire inspections, and more</p>
          <button onClick={() => setShowNewModal(true)} className="mt-4 text-xs font-bold text-white px-4 py-2 rounded-xl" style={{ background: primaryColor }}>Create First Schedule</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Task','Property','Frequency','Next Due','Last Run',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {schedules.map(s => {
                const isDue = s.nextDue <= today
                const daysUntil = Math.ceil((new Date(s.nextDue).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                return (
                  <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${isDue ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isDue && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />}
                        <span className="font-medium text-gray-900">{s.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.propertyName ?? <span className="text-gray-400 italic">All</span>}</td>
                    <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${freqColors[s.frequency] ?? 'bg-gray-100 text-gray-600'}`}>{s.frequency.charAt(0).toUpperCase() + s.frequency.slice(1)}</span></td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{new Date(s.nextDue).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                      {isDue
                        ? <p className="text-xs text-amber-600 font-semibold">Overdue {Math.abs(daysUntil)}d</p>
                        : <p className="text-xs text-gray-400">in {daysUntil}d</p>
                      }
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.lastRun ? new Date(s.lastRun).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : <span className="text-gray-300">Never</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => runNow(s)} disabled={runningId === s.id} className="text-xs font-semibold text-white px-3 py-1 rounded-lg disabled:opacity-50 hover:opacity-90" style={{ background: primaryColor }}>
                          {runningId === s.id ? '…' : 'Run Now'}
                        </button>
                        <button onClick={() => deleteSchedule(s.id)} className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {showNewModal && <NewScheduleModal properties={properties} onClose={() => setShowNewModal(false)} onSaved={s => { setSchedules(prev => [...prev, s]); setShowNewModal(false) }} />}
    </div>
  )
}

interface MaintenancePanelProps {
  tickets: MaintenanceTicket[]
  setTickets: React.Dispatch<React.SetStateAction<MaintenanceTicket[]>>
  onShowNewTicketModal: () => void
  focusedTicketId?: string | null
  onClearFocus?: () => void
  addActivity?: (entry: { type: 'payment' | 'ticket' | 'tenant' | 'announcement' | 'lease'; text: string }) => void
  onViewTenant?: (tenantId: string) => void
  properties?: Property[]
  initialSubTab?: 'tickets' | 'inspections' | 'schedules'
}

function MaintenancePanel({ tickets, setTickets, onShowNewTicketModal, focusedTicketId, onClearFocus, addActivity, onViewTenant, properties = [], initialSubTab = 'tickets' }: MaintenancePanelProps) {
  const [mainTab, setMainTab] = useState<'tickets' | 'inspections' | 'schedules'>(initialSubTab)
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all')
  const [filterProperty, setFilterProperty] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showAnalytics, setShowAnalytics] = useState(true)
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null)
  const [editTicketId, setEditTicketId] = useState<string | null>(null)
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(focusedTicketId ?? null)
  const focusRef = useRef<HTMLTableRowElement>(null)

  function slaBadge(iso?: string) {
    if (!iso) return null
    const hours = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60)
    if (hours < 24) return <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700"><Clock className="w-3 h-3" />{Math.round(hours)}h</span>
    if (hours < 72) return <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700"><Clock className="w-3 h-3" />{Math.round(hours / 24)}d</span>
    return <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700"><Clock className="w-3 h-3" />{Math.round(hours / 24)}d</span>
  }

  useEffect(() => {
    if (focusedTicketId) {
      setExpandedTicketId(focusedTicketId)
      setFilterStatus('all')
      setTimeout(() => focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    }
  }, [focusedTicketId])

  const uniqueProperties = Array.from(new Set(tickets.map(t => t.property)))
  const uniqueCategories = Array.from(new Set(tickets.map(t => t.category)))

  const priorityBadge = (p: string) => {
    if (p === 'emergency') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">Emergency</span>
    if (p === 'high') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">High</span>
    if (p === 'medium') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">Medium</span>
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Low</span>
  }

  const statusBadge = (s: string, ticketId: string) => {
    const labels: Record<string, string> = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' }
    const colors: Record<string, string> = {
      open: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-amber-100 text-amber-700',
      resolved: 'bg-green-100 text-green-700',
    }
    return (
      <div className="relative inline-block">
        <button
          onClick={(e) => { e.stopPropagation(); setStatusDropdownId(statusDropdownId === ticketId ? null : ticketId) }}
          className={`px-2 py-0.5 text-xs font-semibold rounded-full flex items-center gap-1 ${colors[s] || 'bg-gray-100 text-gray-600'} cursor-pointer`}
        >
          {labels[s] || s}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
        {statusDropdownId === ticketId && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 w-36 animate-fade-in">
            {(['open', 'in_progress', 'resolved'] as const).map(st => (
              <button key={st} onClick={async (e) => {
                e.stopPropagation()
                const tk = tickets.find(t => t.id === ticketId)
                setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: st } : t))
                showToast({ type: 'success', title: `Status → ${labels[st]}` })
                if (tk) {
                  addActivity?.({ type: 'ticket', text: `${tk.tenantName} · ${tk.title} → ${labels[st]}` })
                  notifyUser(tk.tenantId, { type: 'maintenance', title: `Maintenance request ${labels[st]}`, body: `"${tk.title}" is now ${labels[st]}.`, link: '/tenant' })
                }
                await supabase.from('maintenance_requests').update({ status: st, updated_at: new Date().toISOString() }).eq('id', ticketId)
                setStatusDropdownId(null)
              }} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${st === 'open' ? 'bg-blue-500' : st === 'in_progress' ? 'bg-amber-500' : 'bg-green-500'}`} />
                {labels[st]}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  async function markResolved(id: string) {
    const tk = tickets.find(t => t.id === id)
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'resolved' as const } : t)))
    showToast({ type: 'success', title: 'Ticket marked as resolved' })
    if (tk) {
      addActivity?.({ type: 'ticket', text: `${tk.tenantName} · ${tk.title} → Resolved` })
      notifyUser(tk.tenantId, { type: 'maintenance', title: 'Maintenance request resolved', body: `"${tk.title}" has been marked resolved.`, link: '/tenant' })
    }
    await supabase.from('maintenance_requests').update({ status: 'resolved', updated_at: new Date().toISOString() }).eq('id', id)
  }

  const filtered = tickets.filter(t => {
    const matchStatus = filterStatus === 'all' || t.status === filterStatus
    const matchProp = !filterProperty || t.property === filterProperty
    const matchPriority = !filterPriority || t.priority === filterPriority
    const matchCat = !filterCategory || t.category === filterCategory
    return matchStatus && matchProp && matchPriority && matchCat
  })

  // Compute analytics from real ticket data
  const ticketMonthMap: Record<string, number> = {}
  const ticketTypeMap: Record<string, number> = {}
  const ticketUnitMap: Record<string, number> = {}
  tickets.forEach(t => {
    const short = t.createdAt.slice(0, 3)
    ticketMonthMap[short] = (ticketMonthMap[short] ?? 0) + 1
    ticketTypeMap[t.category] = (ticketTypeMap[t.category] ?? 0) + 1
    const unitKey = t.unit || '-'
    ticketUnitMap[unitKey] = (ticketUnitMap[unitKey] ?? 0) + 1
  })
  const TICKET_COLORS = ['#2563EB', '#7C3AED', '#EA580C', '#16A34A', '#6B7280']
  const computedTicketsByMonth = Object.entries(ticketMonthMap).map(([month, count]) => ({ month, count }))
  const computedTicketsByType = Object.entries(ticketTypeMap).map(([name, value], i) => ({ name, value, fill: TICKET_COLORS[i % TICKET_COLORS.length] }))
  const highestUnits = Object.entries(ticketUnitMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([unit, count]) => ({ unit, count }))

  const hasFilters = filterProperty || filterPriority || filterCategory

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">Maintenance</h2>
          {mainTab === 'tickets' && (
            <div className="flex gap-1.5">
              {[
                { label: `${tickets.filter(t=>t.status==='open').length} Open`, color: 'bg-blue-100 text-blue-700' },
                { label: `${tickets.filter(t=>t.status==='in_progress').length} In Progress`, color: 'bg-amber-100 text-amber-700' },
                { label: `${tickets.filter(t=>t.status==='resolved').length} Resolved`, color: 'bg-green-100 text-green-700' },
              ].map(c => (
                <span key={c.label} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.color}`}>{c.label}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {mainTab === 'tickets' && (
            <>
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
              >
                {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
              </button>
              <button onClick={onShowNewTicketModal} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
                <Plus className="w-4 h-4" /> New Ticket
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setMainTab('tickets')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${mainTab === 'tickets' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Wrench className="w-3.5 h-3.5" /> Tickets
        </button>
        <button
          onClick={() => setMainTab('inspections')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${mainTab === 'inspections' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <CheckCircle className="w-3.5 h-3.5" /> Inspections
        </button>
        <button
          onClick={() => setMainTab('schedules')}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${mainTab === 'schedules' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Repeat className="w-3.5 h-3.5" /> Recurring
        </button>
      </div>

      {/* Inspections sub-panel */}
      {mainTab === 'inspections' && (
        <InspectionsSubPanel properties={properties} />
      )}

      {/* Recurring schedules sub-panel */}
      {mainTab === 'schedules' && (
        <SchedulesSubPanel properties={properties} tickets={tickets} setTickets={setTickets} />
      )}

      {/* Tickets content (only when tickets tab is active) */}
      {mainTab === 'tickets' && (<>

      {/* Analytics */}
      {showAnalytics && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total (All Time)', value: tickets.length, icon: <BarChart2 className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50' },
              { label: 'Open', value: tickets.filter(t=>t.status==='open').length, icon: <Wrench className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50' },
              { label: 'In Progress', value: tickets.filter(t=>t.status==='in_progress').length, icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-600 bg-green-50' },
              { label: 'Resolved', value: tickets.filter(t=>t.status==='resolved').length, icon: <DollarSign className="w-4 h-4" />, color: 'text-purple-600 bg-purple-50' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${k.color}`}>{k.icon}</div>
                <div>
                  <p className="text-xs text-gray-500">{k.label}</p>
                  <p className="text-xl font-bold text-gray-900">{k.value}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Tickets by Month</h4>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={computedTicketsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                  <Bar dataKey="count" fill="#2563EB" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">By Issue Type</h4>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={computedTicketsByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                    {computedTicketsByType.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Highest Maintenance Units</h4>
              <div className="space-y-2">
                {highestUnits.map((u, i) => (
                  <div key={u.unit} className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${i === 0 ? 'bg-amber-50' : ''}`}>
                    <span className={`text-sm font-medium ${i === 0 ? 'text-amber-700' : 'text-gray-700'}`}>{u.unit}</span>
                    <span className={`text-xs font-bold ${i === 0 ? 'text-amber-600' : 'text-gray-500'}`}>{u.count} ticket{u.count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['all','open','in_progress','resolved'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <select value={filterProperty} onChange={e => setFilterProperty(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Properties</option>
          {uniqueProperties.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Priorities</option>
          <option value="emergency">Emergency</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Categories</option>
          {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setFilterProperty(''); setFilterPriority(''); setFilterCategory('') }}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Issue</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tenant / Unit</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">SLA</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const isExpanded = expandedTicketId === t.id
              const isFocused = focusedTicketId === t.id
              return (
                <>
                  <tr
                    key={t.id}
                    ref={isFocused ? focusRef : undefined}
                    onClick={() => { setExpandedTicketId(isExpanded ? null : t.id); if (isFocused && onClearFocus) onClearFocus() }}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${isFocused ? 'ring-2 ring-blue-400 ring-inset bg-blue-50' : ''} ${isExpanded ? 'bg-gray-50' : ''}`}
                  >
                    <td className="px-5 py-3 text-xs font-mono text-gray-500">{t.id}</td>
                    <td className="px-5 py-3">
                      <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                      <p className="text-xs text-gray-400">{t.category}</p>
                    </td>
                    <td className="px-5 py-3">
                      {onViewTenant && t.tenantId
                        ? <button onClick={(e) => { e.stopPropagation(); onViewTenant(t.tenantId) }} className="text-sm font-medium text-blue-600 hover:underline text-left">{t.tenantName}</button>
                        : <p className="text-sm text-gray-700">{t.tenantName}</p>
                      }
                      <p className="text-xs text-gray-400">{t.unit} · {t.property}</p>
                    </td>
                    <td className="px-5 py-3">{priorityBadge(t.priority)}</td>
                    <td className="px-5 py-3" onClick={e => e.stopPropagation()}>{statusBadge(t.status, t.id)}</td>
                    <td className="px-5 py-3">{t.status !== 'resolved' ? slaBadge(t.createdAtIso) : null}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{t.createdAt}</td>
                    <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditTicketId(t.id)} className="text-xs font-semibold text-gray-600 hover:text-gray-800 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">
                          Edit
                        </button>
                        {t.status !== 'resolved' && (
                          <button onClick={() => markResolved(t.id)} className="text-xs font-semibold text-green-600 hover:text-green-700">
                            Resolve
                          </button>
                        )}
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${t.id}-detail`} className="border-b border-gray-100">
                      <td colSpan={8} className="px-5 py-4 bg-gray-50">
                        <div className="grid grid-cols-3 gap-6">
                          <div className="col-span-2 space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</p>
                              <p className="text-sm text-gray-700">{t.description || 'No description provided.'}</p>
                            </div>
                            {(t.vendorName || t.assignedTo) && (
                              <div className="flex items-center gap-4 pt-1">
                                {t.vendorName && <div className="flex items-center gap-1.5 text-xs text-gray-600"><UserCheck className="w-3.5 h-3.5 text-gray-400" /><span className="font-semibold">{t.vendorName}</span></div>}
                                {t.vendorPhone && <div className="flex items-center gap-1.5 text-xs text-gray-600"><Phone className="w-3.5 h-3.5 text-gray-400" />{t.vendorPhone}</div>}
                                {t.assignedTo && <div className="flex items-center gap-1.5 text-xs text-gray-600"><Users className="w-3.5 h-3.5 text-gray-400" />Assigned to <span className="font-semibold">{t.assignedTo}</span></div>}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div><p className="text-xs text-gray-400">Created</p><p className="text-sm font-medium text-gray-700">{t.createdAt}</p></div>
                            <div><p className="text-xs text-gray-400">Last Updated</p><p className="text-sm font-medium text-gray-700">{t.updatedAt}</p></div>
                            {t.estimatedCost != null && <div><p className="text-xs text-gray-400">Est. Cost</p><p className="text-sm font-semibold text-gray-900">${t.estimatedCost.toLocaleString()}</p></div>}
                            {t.actualCost != null && <div><p className="text-xs text-gray-400">Actual Cost</p><p className="text-sm font-semibold text-gray-900">${t.actualCost.toLocaleString()}</p></div>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">No tickets match your filters.</div>
        )}
      </div>

      {/* Edit Ticket Modal */}
      {editTicketId && (
        <EditTicketModal
          ticket={tickets.find(t => t.id === editTicketId)!}
          onClose={() => setEditTicketId(null)}
          onSave={async (updated) => {
            setTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
            showToast({ type: 'success', title: `Ticket ${updated.id} updated` })
            addActivity?.({ type: 'ticket', text: `${updated.tenantName} · ${updated.title} updated` })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('maintenance_requests') as any).update({
              priority: updated.priority,
              description: updated.description,
              status: updated.status,
              assigned_to: updated.assignedTo ?? null,
              vendor_name: updated.vendorName ?? null,
              vendor_phone: updated.vendorPhone ?? null,
              estimated_cost: updated.estimatedCost ?? null,
              actual_cost: updated.actualCost ?? null,
              updated_at: new Date().toISOString(),
            }).eq('id', updated.id)
            setEditTicketId(null)
          }}
        />
      )}
      </>)}
    </div>
  )
}

// ─── Properties Panel ─────────────────────────────────────────────────────────

interface PropertiesPanelProps {
  properties: Property[]
  tenants: Tenant[]
  tickets: MaintenanceTicket[]
  onShowAddPropertyModal: () => void
  onManageProperty: (id: string) => void
  setActivePanel: (panel: string) => void
  onViewTicket: (ticketId: string) => void
  onViewTenant: (tenantId: string) => void
}

function PropertiesPanel({ properties, tenants, tickets, onShowAddPropertyModal, onManageProperty, onViewTicket, onViewTenant }: PropertiesPanelProps) {
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null)
  const [viewTicketsProperty, setViewTicketsProperty] = useState<Property | null>(null)
  const [unitsByPropId, setUnitsByPropId] = useState<Record<string, DBUnit[]>>({})
  const [loadingUnits, setLoadingUnits] = useState<Record<string, boolean>>({})
  const [unitDetailInfo, setUnitDetailInfo] = useState<{ unit: DBUnit; property: Property } | null>(null)
  const [dashboardInspections, setDashboardInspections] = useState<Inspection[]>([])

  useEffect(() => {
    supabase.from('inspections').select('*').then(({ data }) => {
      if (data) setDashboardInspections(data.map((r: Record<string, unknown>) => ({
        id: r.id as string, property: r.property as string, propertyId: r.property_id as string,
        unit: r.unit as string, type: r.type as Inspection['type'], date: (r.date as string) ?? '',
        time: (r.time as string) ?? '', inspectorName: r.inspector_name as string,
        inspectorPhone: r.inspector_phone as string, durationEstimate: r.duration_estimate as string,
        entryNoticeSent: r.entry_notice_sent as boolean, accessInstructions: r.access_instructions as string,
        checklistItems: r.checklist_items as string, findings: r.findings as string,
        followUpActions: r.follow_up_actions as string, status: r.status as Inspection['status'],
        createdAt: r.created_at as string,
      })))
    })
  }, [])

  async function fetchUnits(propertyId: string) {
    if (unitsByPropId[propertyId] || loadingUnits[propertyId]) return
    setLoadingUnits(prev => ({ ...prev, [propertyId]: true }))
    const { data } = await supabase.from('units').select('*').eq('property_id', propertyId).order('unit_number')
    setUnitsByPropId(prev => ({ ...prev, [propertyId]: (data ?? []).map(dbUnitFromRow) }))
    setLoadingUnits(prev => ({ ...prev, [propertyId]: false }))
  }

  const totalUnits = properties.reduce((s, p) => s + p.units, 0)
  const totalOccupied = properties.reduce((s, p) => s + p.occupied, 0)
  const totalRevenue = properties.reduce((s, p) => s + p.monthlyIncome, 0)

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Properties</h1>
          <p className="text-xs text-gray-500">Manage your portfolio</p>
        </div>
        <button onClick={onShowAddPropertyModal} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Add Property
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Properties', value: properties.length, color: 'text-blue-600' },
          { label: 'Total Units', value: totalUnits, color: 'text-purple-600' },
          { label: 'Occupied', value: totalOccupied, color: 'text-green-600' },
          { label: 'Monthly Revenue', value: `$${totalRevenue.toLocaleString()}`, color: 'text-emerald-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Property Cards */}
      <div className="grid grid-cols-2 gap-5">
        {properties.map((p) => {
          const propTenants = tenants.filter(t => t.property === p.name)
          const propTickets = tickets.filter(t => t.property === p.name)
          const openTickets = propTickets.filter(t => t.status !== 'resolved').length
          const occupancyPct = p.units > 0 ? Math.round((p.occupied / p.units) * 100) : 0
          const expanded = expandedPropertyId === p.id

          return (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow animate-slide-up">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.city}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${occupancyPct === 100 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {p.occupied}/{p.units} occupied
                </span>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { label: 'Units', value: p.units },
                  { label: 'Occupied', value: p.occupied },
                  { label: 'Income/mo', value: `$${p.monthlyIncome.toLocaleString()}` },
                  { label: 'Open Tickets', value: openTickets },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-xs text-gray-400">{s.label}</p>
                    <p className="text-sm font-bold text-gray-900">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Units grid toggle */}
              <button
                onClick={() => {
                  const next = expanded ? null : p.id
                  setExpandedPropertyId(next)
                  if (next) fetchUnits(p.id)
                }}
                className="text-xs font-semibold mb-3 flex items-center gap-1"
                style={{ color: '#2563EB' }}
              >
                <Home className="w-3.5 h-3.5" />
                {expanded ? 'Hide Units' : `View Units (${p.units})`}
              </button>
              {expanded && (
                <div className="mb-3 animate-fade-in">
                  {loadingUnits[p.id] ? (
                    <div className="grid grid-cols-3 gap-2">{[0,1,2].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />)}</div>
                  ) : (unitsByPropId[p.id] ?? []).length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {(unitsByPropId[p.id] ?? []).map(u => {
                        const tenant = tenants.find(t => t.unit === u.unitNumber && t.property === p.name && t.status !== 'past')
                        const sm = UNIT_STATUSES.find(s => s.value === (u.status ?? 'vacant')) ?? UNIT_STATUSES[1]
                        return (
                          <button
                            key={u.id}
                            onClick={() => setUnitDetailInfo({ unit: u, property: p })}
                            className="text-left p-2.5 rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all bg-gray-50 hover:bg-white"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold text-gray-900">{u.unitNumber}</span>
                              <span className={`w-2 h-2 rounded-full ${sm.dot}`} />
                            </div>
                            <p className="text-[10px] font-semibold truncate" style={{ color: sm.value === 'occupied' ? '#16A34A' : sm.value === 'maintenance' ? '#D97706' : '#6B7280' }}>
                              {tenant ? tenant.name.split(' ')[0] : sm.label}
                            </p>
                            {u.rentAmount && <p className="text-[10px] text-gray-400">${u.rentAmount.toLocaleString()}/mo</p>}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {propTenants.map(t => (
                        <div key={t.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-gray-50">
                          <button onClick={() => onViewTenant(t.id)} className="font-medium text-blue-600 hover:underline text-left">{t.name}</button>
                          <span className="text-gray-500">Unit {t.unit}</span>
                          <span className="font-semibold text-gray-700">${t.rent.toLocaleString()}/mo</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => onManageProperty(p.id)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
                >
                  Manage
                </button>
                <button
                  onClick={() => setViewTicketsProperty(p)}
                  className={`flex-1 border text-sm font-semibold py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 ${openTickets > 0 ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  {openTickets > 0 ? `${openTickets} Ticket${openTickets > 1 ? 's' : ''}` : 'Tickets'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {viewTicketsProperty && (
        <PropertyTicketsModal
          property={viewTicketsProperty}
          tickets={tickets}
          onClose={() => setViewTicketsProperty(null)}
          onViewTicket={(ticketId) => { onViewTicket(ticketId); setViewTicketsProperty(null) }}
        />
      )}
      {unitDetailInfo && (
        <UnitDetailSheet
          unit={unitDetailInfo.unit}
          property={unitDetailInfo.property}
          tenants={tenants}
          tickets={tickets}
          inspections={dashboardInspections}
          onClose={() => setUnitDetailInfo(null)}
          onViewTenant={(id) => { setUnitDetailInfo(null); onViewTenant(id) }}
        />
      )}
    </div>
  )
}

// ─── Unit Detail Sheet ────────────────────────────────────────────────────────

function UnitDetailSheet({
  unit: initialUnit, property, tenants, tickets, inspections, onClose, onViewTenant,
}: {
  unit: DBUnit
  property: Property
  tenants: Tenant[]
  tickets: MaintenanceTicket[]
  inspections: Inspection[]
  onClose: () => void
  onViewTenant: (id: string) => void
}) {
  const { primaryColor } = useBranding()
  const [visible, setVisible] = useState(false)
  const [tab, setTab] = useState<'overview' | 'tenant' | 'maintenance' | 'documents'>('overview')
  const [unit, setUnit] = useState<DBUnit>(initialUnit)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ ...initialUnit })
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState<{ url: string; path: string }[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [docs, setDocs] = useState<{ id: string; name: string; type: string; url: string | null }[]>([])

  const currentTenant = tenants.find(t => t.unit === unit.unitNumber && t.property === property.name && t.status !== 'past')
  const unitTickets = tickets.filter(t => t.unit === unit.unitNumber && t.property === property.name && t.status !== 'resolved')
  const unitInspections = inspections.filter(i => i.unit === unit.unitNumber && i.property === property.name)
    .sort((a, b) => new Date(b.date ?? b.createdAt).getTime() - new Date(a.date ?? a.createdAt).getTime())

  const statusMeta = UNIT_STATUSES.find(s => s.value === unit.status) ?? UNIT_STATUSES[1]

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  function handleClose() { setVisible(false); setTimeout(onClose, 280) }

  async function handleSave() {
    setSaving(true)
    const payload: Record<string, unknown> = {
      unit_number: editForm.unitNumber,
      bedrooms: editForm.bedrooms,
      bathrooms: editForm.bathrooms,
      sqft: editForm.sqft,
      rent_amount: editForm.rentAmount,
      status: editForm.status,
    }
    // Extended columns — graceful if they don't exist yet
    try {
      Object.assign(payload, {
        market_rent: editForm.marketRent,
        notes: editForm.notes,
        parking_spot: editForm.parkingSpot,
        utility_info: editForm.utilityInfo,
      })
    } catch { /* ignore */ }
    const { error } = await supabase.from('units').update(payload).eq('id', unit.id)
    if (!error) {
      setUnit({ ...editForm })
      setEditing(false)
      showToast({ type: 'success', title: 'Unit updated' })
    } else {
      // Retry without extended columns if they don't exist
      const { error: e2 } = await supabase.from('units').update({
        unit_number: editForm.unitNumber,
        bedrooms: editForm.bedrooms,
        bathrooms: editForm.bathrooms,
        sqft: editForm.sqft,
        rent_amount: editForm.rentAmount,
        status: editForm.status,
      }).eq('id', unit.id)
      if (!e2) { setUnit({ ...editForm }); setEditing(false); showToast({ type: 'success', title: 'Unit updated' }) }
      else showToast({ type: 'error', title: 'Failed to save', message: e2.message })
    }
    setSaving(false)
  }

  // Load photos from storage
  useEffect(() => {
    supabase.storage.from('unit-photos').list(`${unit.id}/`, { limit: 20 }).then(({ data }) => {
      if (!data) return
      const items = data.filter(f => f.name !== '.emptyFolderPlaceholder').map(f => {
        const { data: { publicUrl } } = supabase.storage.from('unit-photos').getPublicUrl(`${unit.id}/${f.name}`)
        return { url: publicUrl, path: `${unit.id}/${f.name}` }
      })
      setPhotos(items)
    })
  }, [unit.id])

  // Load documents for this unit
  useEffect(() => {
    supabase.from('documents').select('id,name,type,storage_path').eq('property_id', unit.propertyId).then(({ data }) => {
      if (data) setDocs(data.map(d => ({ id: d.id, name: d.name, type: d.type, url: d.storage_path })))
    })
  }, [unit.propertyId])

  async function uploadPhoto(file: File) {
    setUploadingPhoto(true)
    const ext = file.name.split('.').pop()
    const path = `${unit.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('unit-photos').upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('unit-photos').getPublicUrl(path)
      setPhotos(prev => [...prev, { url: publicUrl, path }])
      showToast({ type: 'success', title: 'Photo uploaded' })
    } else {
      showToast({ type: 'error', title: 'Upload failed', message: error.message })
    }
    setUploadingPhoto(false)
  }

  async function deletePhoto(path: string) {
    await supabase.storage.from('unit-photos').remove([path])
    setPhotos(prev => prev.filter(p => p.path !== path))
  }

  const rentVsMarket = unit.rentAmount && unit.marketRent
    ? ((unit.rentAmount - unit.marketRent) / unit.marketRent) * 100
    : null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300" style={{ opacity: visible ? 1 : 0 }} onClick={handleClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out" style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0" style={{ background: primaryColor }}>
          <div>
            <p className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">{property.name}</p>
            <h2 className="text-2xl font-black text-white">Unit {unit.unitNumber}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusMeta.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                {statusMeta.label}
              </span>
              {unit.rentAmount && <span className="text-white/80 text-sm font-semibold">${unit.rentAmount.toLocaleString()}/mo</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <button onClick={() => { setEditing(true); setEditForm({ ...unit }) }} className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-bold text-white transition-colors flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            <button onClick={handleClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick specs bar */}
        <div className="grid grid-cols-4 border-b border-gray-100 shrink-0 bg-gray-50">
          {[
            { icon: <BedDouble className="w-3.5 h-3.5" />, value: unit.bedrooms != null ? `${unit.bedrooms} bed` : '—', label: 'Beds' },
            { icon: <Bath className="w-3.5 h-3.5" />, value: unit.bathrooms != null ? `${unit.bathrooms} bath` : '—', label: 'Baths' },
            { icon: <Maximize2 className="w-3.5 h-3.5" />, value: unit.sqft ? `${unit.sqft.toLocaleString()} ft²` : '—', label: 'Size' },
            { icon: <Star className="w-3.5 h-3.5" />, value: unit.marketRent ? `$${unit.marketRent.toLocaleString()}` : '—', label: 'Market Rent' },
          ].map(s => (
            <div key={s.label} className="px-3 py-3 text-center border-r border-gray-100 last:border-r-0">
              <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">{s.icon}</div>
              <p className="text-sm font-bold text-gray-900">{s.value}</p>
              <p className="text-[10px] text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 shrink-0 bg-white">
          {(['overview', 'tenant', 'maintenance', 'documents'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 transition-colors ${tab === t ? 'border-b-2 text-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              style={tab === t ? { borderColor: primaryColor, color: primaryColor } : {}}
            >{t}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div className="p-6 space-y-5">
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Unit Number</label>
                      <input value={editForm.unitNumber} onChange={e => setEditForm(f => ({ ...f, unitNumber: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                      <select value={editForm.status ?? 'vacant'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        {UNIT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Bedrooms</label>
                      <input type="number" min="0" value={editForm.bedrooms ?? ''} onChange={e => setEditForm(f => ({ ...f, bedrooms: e.target.value ? Number(e.target.value) : null }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Bathrooms</label>
                      <input type="number" min="0" step="0.5" value={editForm.bathrooms ?? ''} onChange={e => setEditForm(f => ({ ...f, bathrooms: e.target.value ? Number(e.target.value) : null }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Sqft</label>
                      <input type="number" min="0" value={editForm.sqft ?? ''} onChange={e => setEditForm(f => ({ ...f, sqft: e.target.value ? Number(e.target.value) : null }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Current Rent ($/mo)</label>
                      <input type="number" min="0" value={editForm.rentAmount ?? ''} onChange={e => setEditForm(f => ({ ...f, rentAmount: e.target.value ? Number(e.target.value) : null }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Market Rent ($/mo)</label>
                      <input type="number" min="0" value={editForm.marketRent ?? ''} onChange={e => setEditForm(f => ({ ...f, marketRent: e.target.value ? Number(e.target.value) : null }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Optional" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Parking Spot</label>
                    <input value={editForm.parkingSpot ?? ''} onChange={e => setEditForm(f => ({ ...f, parkingSpot: e.target.value || null }))} placeholder="e.g. Spot #12, Garage Bay B" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Utility Info</label>
                    <input value={editForm.utilityInfo ?? ''} onChange={e => setEditForm(f => ({ ...f, utilityInfo: e.target.value || null }))} placeholder="e.g. Water included, electric metered separately" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                    <textarea value={editForm.notes ?? ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value || null }))} rows={3} placeholder="Internal notes about this unit…" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleSave} disabled={saving} className="flex-1 text-white py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: primaryColor }}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button onClick={() => setEditing(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Rent vs market */}
                  {unit.rentAmount && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Rent</p>
                        {rentVsMarket != null && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rentVsMarket > 0 ? 'bg-green-100 text-green-700' : rentVsMarket < -5 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                            {rentVsMarket > 0 ? `+${rentVsMarket.toFixed(0)}% above market` : rentVsMarket < 0 ? `${Math.abs(rentVsMarket).toFixed(0)}% below market` : 'At market'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-end gap-4">
                        <div>
                          <p className="text-2xl font-black text-gray-900">${unit.rentAmount.toLocaleString()}</p>
                          <p className="text-xs text-gray-400">current rent/mo</p>
                        </div>
                        {unit.marketRent && (
                          <div>
                            <p className="text-lg font-bold text-gray-400">${unit.marketRent.toLocaleString()}</p>
                            <p className="text-xs text-gray-400">market rate</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Info chips */}
                  <div className="grid grid-cols-2 gap-3">
                    {unit.parkingSpot && (
                      <div className="flex items-center gap-2.5 bg-gray-50 rounded-xl p-3">
                        <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase">Parking</p>
                          <p className="text-sm font-medium text-gray-900">{unit.parkingSpot}</p>
                        </div>
                      </div>
                    )}
                    {unit.utilityInfo && (
                      <div className="flex items-center gap-2.5 bg-gray-50 rounded-xl p-3">
                        <Zap className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 uppercase">Utilities</p>
                          <p className="text-sm font-medium text-gray-900">{unit.utilityInfo}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {unit.notes && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                      <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Notes</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{unit.notes}</p>
                    </div>
                  )}

                  {!unit.parkingSpot && !unit.utilityInfo && !unit.notes && (
                    <div className="text-center py-6">
                      <p className="text-sm text-gray-400">No additional info added.</p>
                      <button onClick={() => { setEditing(true); setEditForm({ ...unit }) }} className="mt-2 text-xs font-semibold hover:underline" style={{ color: primaryColor }}>Add details →</button>
                    </div>
                  )}
                </div>
              )}

              {/* Photos section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Photos</p>
                  <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto} className="text-xs font-semibold hover:underline disabled:opacity-50 flex items-center gap-1" style={{ color: primaryColor }}>
                    <ImageIcon className="w-3.5 h-3.5" /> {uploadingPhoto ? 'Uploading…' : 'Add Photo'}
                  </button>
                  <input ref={photoInputRef} type="file" accept="image/*" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }} />
                </div>
                {photos.length === 0 ? (
                  <button onClick={() => photoInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-gray-300 transition-colors group">
                    <ImageIcon className="w-8 h-8 text-gray-200 group-hover:text-gray-300 mx-auto mb-2 transition-colors" />
                    <p className="text-sm text-gray-400">Click to upload unit photos</p>
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map(p => (
                      <div key={p.path} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100">
                        <img src={p.url} alt="Unit photo" className="w-full h-full object-cover" />
                        <button onClick={() => deletePhoto(p.path)} className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    <button onClick={() => photoInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-gray-300 transition-colors">
                      <Plus className="w-5 h-5 text-gray-300" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TENANT */}
          {tab === 'tenant' && (
            <div className="p-6">
              {currentTenant ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ background: primaryColor }}>
                      {currentTenant.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{currentTenant.name}</p>
                      <p className="text-xs text-gray-400">{currentTenant.email}</p>
                      <p className="text-xs text-gray-400">{currentTenant.phone}</p>
                    </div>
                    <button onClick={() => { onViewTenant(currentTenant.id); handleClose() }} className="text-xs font-semibold hover:underline shrink-0" style={{ color: primaryColor }}>
                      View Profile →
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Lease Start', value: currentTenant.moveIn || '—' },
                      { label: 'Lease End', value: currentTenant.leaseEnd || '—' },
                      { label: 'Monthly Rent', value: `$${currentTenant.rent.toLocaleString()}` },
                      { label: 'Status', value: currentTenant.status.charAt(0).toUpperCase() + currentTenant.status.slice(1) },
                    ].map(s => (
                      <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400">{s.label}</p>
                        <p className="text-sm font-bold text-gray-900">{s.value}</p>
                      </div>
                    ))}
                  </div>
                  {currentTenant.rentDueDay && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
                      <DollarSign className="w-3.5 h-3.5" />
                      Rent due on the {currentTenant.rentDueDay}{currentTenant.rentDueDay === 1 ? 'st' : currentTenant.rentDueDay === 2 ? 'nd' : currentTenant.rentDueDay === 3 ? 'rd' : 'th'} of each month
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="font-bold text-gray-700 mb-1">Unit is Vacant</p>
                  <p className="text-sm text-gray-400 mb-4">No active tenant assigned to this unit.</p>
                  <button className="text-sm font-semibold text-white px-4 py-2 rounded-xl hover:opacity-90 transition-opacity" style={{ background: primaryColor }}>
                    Invite Tenant
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MAINTENANCE */}
          {tab === 'maintenance' && (
            <div className="p-6 space-y-4">
              {/* Open tickets */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Open Tickets</p>
                {unitTickets.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-8 h-8 text-green-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No open tickets for this unit</p>
                  </div>
                ) : unitTickets.map(t => {
                  const pm = ({ emergency: 'bg-red-50 border-red-100 text-red-700', high: 'bg-orange-50 border-orange-100 text-orange-700', medium: 'bg-amber-50 border-amber-100 text-amber-700', low: 'bg-gray-50 border-gray-100 text-gray-600' } as Record<string, string>)[t.priority] ?? 'bg-gray-50 border-gray-100 text-gray-600'
                  return (
                    <div key={t.id} className={`border rounded-xl p-3 mb-2 ${pm}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{t.title}</p>
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-white/60">{t.priority}</span>
                      </div>
                      <p className="text-xs mt-0.5 opacity-70">{t.category} · {t.status.replace('_', ' ')}</p>
                    </div>
                  )
                })}
              </div>

              {/* Inspection history */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Inspection History</p>
                {unitInspections.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No inspections recorded</p>
                ) : unitInspections.slice(0, 5).map(i => {
                  const typeMeta = INSPECTION_TYPES.find(x => x.value === i.type)
                  return (
                    <div key={i.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center gap-2.5">
                        <ClipboardList className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{typeMeta?.label ?? i.type}</p>
                          <p className="text-xs text-gray-400">{i.date ? new Date(i.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}{i.inspectorName ? ` · ${i.inspectorName}` : ''}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${INSPECTION_STATUSES.find(s => s.value === i.status)?.color ?? 'bg-gray-100 text-gray-500'}`}>{i.status}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* DOCUMENTS */}
          {tab === 'documents' && (
            <div className="p-6 space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Property Documents</p>
              {docs.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No documents linked to this property</p>
                </div>
              ) : docs.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{d.name}</p>
                    <p className="text-xs text-gray-400">{d.type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  )
}

// ─── Documents Panel ──────────────────────────────────────────────────────────

function DocumentsPanel({ onViewTenant, tenants, properties }: { onViewTenant?: (tenantId: string) => void; tenants: Tenant[]; properties: Property[] }) {
  const { user } = useAuth()
  const { data: docs, loading: docsLoading, refetch: refetchDocs } = useDocuments()
  const [docSearch, setDocSearch] = useState('')
  const [filterProperty, setFilterProperty] = useState('')
  const [filterUnit, setFilterUnit] = useState('')
  const [filterTenant, setFilterTenant] = useState('')
  const [filterType, setFilterType] = useState('')
  const [viewingDoc, setViewingDoc] = useState<string | null>(null)

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [uploadType, setUploadType] = useState('Document')
  const [uploadTenantId, setUploadTenantId] = useState('')
  const [uploadPropertyId, setUploadPropertyId] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uniqueProperties = Array.from(new Set(docs.map(d => d.property).filter(Boolean))) as string[]
  const uniqueUnits = Array.from(new Set(docs.map(d => d.unit).filter(Boolean))) as string[]
  const uniqueTenants = Array.from(new Set(docs.map(d => d.tenantName).filter(Boolean))) as string[]
  const uniqueTypes = Array.from(new Set(docs.map(d => d.type))) as string[]

  const filteredDocs = docs.filter(d => {
    const q = docSearch.toLowerCase()
    const matchesSearch = !q || d.name.toLowerCase().includes(q) || (d.tenantName?.toLowerCase().includes(q) ?? false) || (d.tenantPhone?.toLowerCase().includes(q) ?? false)
    return matchesSearch &&
      (!filterProperty || d.property === filterProperty) &&
      (!filterUnit || d.unit === filterUnit) &&
      (!filterTenant || d.tenantName === filterTenant) &&
      (!filterType || d.type === filterType)
  })

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadFile(file)
    setUploadName(file.name.replace(/\.[^.]+$/, ''))
    setShowUploadModal(true)
    e.target.value = ''
  }

  async function handleUpload() {
    if (!uploadFile || !user) return
    setUploading(true)
    const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${user.id}/${Date.now()}_${safeName}`
    const { error: upErr } = await supabase.storage.from('documents').upload(path, uploadFile)
    if (upErr) { showToast({ type: 'error', title: 'Upload failed: ' + upErr.message }); setUploading(false); return }
    const { error: dbErr } = await supabase.from('documents').insert({
      name: uploadName || uploadFile.name,
      type: uploadType,
      storage_path: path,
      size_bytes: uploadFile.size,
      property_id: uploadPropertyId || null,
      tenant_id: uploadTenantId || null,
      uploaded_by: user.id,
    })
    if (dbErr) showToast({ type: 'error', title: 'Failed to save record: ' + dbErr.message })
    else {
      showToast({ type: 'success', title: `"${uploadName || uploadFile.name}" uploaded` })
      setShowUploadModal(false)
      setUploadFile(null); setUploadName(''); setUploadType('Document')
      setUploadTenantId(''); setUploadPropertyId('')
      refetchDocs()
    }
    setUploading(false)
  }

  async function handleDownload(doc: (typeof docs)[0]) {
    if (!doc.storagePath) { showToast({ type: 'info', title: 'No file attached to this record' }); return }
    const { data } = await supabase.storage.from('documents').createSignedUrl(doc.storagePath, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const hasFilters = filterProperty || filterUnit || filterTenant || filterType

  return (
    <div className="p-6 animate-slide-up space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Documents</h2>
          <p className="text-xs text-gray-500">{filteredDocs.length} of {docs.length} document{docs.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" /> Upload Document
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            placeholder="Search name, tenant, phone…" value={docSearch} onChange={e => setDocSearch(e.target.value)} />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Types</option>
          {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterProperty} onChange={e => setFilterProperty(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Properties</option>
          {uniqueProperties.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Units</option>
          {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={filterTenant} onChange={e => setFilterTenant(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Tenants</option>
          {uniqueTenants.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setFilterProperty(''); setFilterUnit(''); setFilterTenant(''); setFilterType('') }}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-2 rounded-lg hover:bg-gray-100">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {docsLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 gap-2 text-sm">
            <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> Loading…
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Name', 'Tenant', 'Type', 'Date', 'Size', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map(d => (
                <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                      <div>
                        <span className="text-sm font-medium text-gray-900">{d.name}</span>
                        {d.property && <p className="text-xs text-gray-400">{d.property}{d.unit ? ` · Unit ${d.unit}` : ''}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {d.tenantName ? (
                      <div>
                        {d.tenantId && onViewTenant
                          ? <button onClick={() => onViewTenant(d.tenantId!)} className="text-sm font-medium text-blue-600 hover:underline text-left">{d.tenantName}</button>
                          : <p className="text-sm text-gray-700">{d.tenantName}</p>}
                        {d.tenantPhone && <p className="text-xs text-gray-400">{d.tenantPhone}</p>}
                      </div>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">{d.type}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500">{d.date}</td>
                  <td className="px-5 py-3 text-sm text-gray-500">{d.size}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => handleDownload(d)} className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                      {d.storagePath ? 'Download' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!docsLoading && filteredDocs.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">
            {docs.length === 0 ? 'No documents yet. Upload one to get started.' : 'No documents match your filters.'}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <ModalBackdrop onClose={() => { setShowUploadModal(false); setUploadFile(null) }}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Upload Document</h2>
              <button onClick={() => { setShowUploadModal(false); setUploadFile(null) }} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{uploadFile?.name}</p>
                  <p className="text-xs text-gray-500">{uploadFile ? `${Math.round(uploadFile.size / 1024)} KB` : ''}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Document Name</label>
                <input value={uploadName} onChange={e => setUploadName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                <select value={uploadType} onChange={e => setUploadType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {['Lease', 'Checklist', 'Insurance', 'Report', 'Policy', 'Invoice', 'Document'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Associate with Property (optional)</label>
                <select value={uploadPropertyId} onChange={e => { setUploadPropertyId(e.target.value); setUploadTenantId('') }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">No property</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Associate with Tenant (optional)</label>
                <select value={uploadTenantId} onChange={e => setUploadTenantId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">No tenant</option>
                  {(uploadPropertyId ? tenants.filter(t => properties.find(p => p.id === uploadPropertyId)?.name === t.property) : tenants)
                    .map(t => <option key={t.id} value={t.id}>{t.name} · {t.unit}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowUploadModal(false); setUploadFile(null) }}
                  className="flex-1 border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleUpload} disabled={uploading || !uploadName.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                  {uploading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {viewingDoc && <DocViewerModal filename={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </div>
  )
}

// ─── Edit Ticket Modal ────────────────────────────────────────────────────────

function EditTicketModal({ ticket, onClose, onSave }: { ticket: MaintenanceTicket; onClose: () => void; onSave: (t: MaintenanceTicket) => void }) {
  const { primaryColor } = useBranding()
  const [form, setForm] = useState({
    issueType: ticket.category,
    priority: ticket.priority,
    description: ticket.description,
    status: ticket.status,
    assignedTo: ticket.assignedTo ?? '',
    vendorName: ticket.vendorName ?? '',
    vendorPhone: ticket.vendorPhone ?? '',
    estimatedCost: ticket.estimatedCost != null ? String(ticket.estimatedCost) : '',
    actualCost: ticket.actualCost != null ? String(ticket.actualCost) : '',
  })

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Edit Ticket</h2>
            <p className="text-xs text-gray-400 font-mono">{ticket.id}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Status / Priority / Type */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'issueType', label: 'Issue Type', opts: ['Plumbing','Electrical','HVAC','Appliance','Structural','Other'] },
              { key: 'priority',  label: 'Priority',   opts: ['low','medium','high','emergency'] },
              { key: 'status',    label: 'Status',     opts: ['open','in_progress','resolved'] },
            ].map(({ key, label, opts }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                <select value={(form as Record<string,string>)[key]} onChange={e => setForm({...form, [key]: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {opts.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          {/* Vendor assignment */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5" />Vendor / Assignment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Vendor / Company</label>
                <input value={form.vendorName} onChange={e => setForm({...form, vendorName: e.target.value})} placeholder="e.g. Smith Plumbing Co."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Vendor Phone</label>
                <input value={form.vendorPhone} onChange={e => setForm({...form, vendorPhone: e.target.value})} placeholder="(555) 000-0000"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Assigned To (internal)</label>
                <input value={form.assignedTo} onChange={e => setForm({...form, assignedTo: e.target.value})} placeholder="e.g. John (maintenance staff)"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
          {/* Cost tracking */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" />Cost Tracking</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Estimated Cost</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min="0" step="0.01" value={form.estimatedCost} onChange={e => setForm({...form, estimatedCost: e.target.value})} placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Actual Cost</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min="0" step="0.01" value={form.actualCost} onChange={e => setForm({...form, actualCost: e.target.value})} placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm">Cancel</button>
            <button onClick={() => onSave({
              ...ticket,
              category: form.issueType,
              priority: form.priority as MaintenanceTicket['priority'],
              description: form.description,
              status: form.status as MaintenanceTicket['status'],
              assignedTo: form.assignedTo || null,
              vendorName: form.vendorName || null,
              vendorPhone: form.vendorPhone || null,
              estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : null,
              actualCost: form.actualCost ? Number(form.actualCost) : null,
            })} className="flex-1 text-white font-semibold py-2.5 rounded-xl text-sm hover:opacity-90" style={{ background: primaryColor }}>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Edit Tenant Modal ────────────────────────────────────────────────────────

function EditTenantModal({ tenant, properties, onClose, onSave }: { tenant: Tenant; properties: Property[]; onClose: () => void; onSave: (t: Tenant) => void }) {
  const [form, setForm] = useState({ name: tenant.name, email: tenant.email, phone: tenant.phone, unit: tenant.unit, property: tenant.property, rent: String(tenant.rent), leaseEnd: tenant.leaseEnd, status: tenant.status })
  const fi = (key: keyof typeof form, label: string, type = 'text') => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input type={type} value={form[key]} onChange={e => setForm({...form, [key]: e.target.value})}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Edit Tenant</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {fi('name','Full Name')}
            {fi('email','Email','email')}
            {fi('phone','Phone')}
            {fi('unit','Unit')}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Property</label>
            <select value={form.property} onChange={e => setForm({...form, property: e.target.value})}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {properties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {fi('rent','Monthly Rent ($)','number')}
            {fi('leaseEnd','Lease End')}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value as Tenant['status']})}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {(['active','late','notice','past'] as const).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm">Cancel</button>
            <button onClick={() => onSave({ ...tenant, ...form, rent: Number(form.rent) })}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm">Save Changes</button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Tenant Profile Modal ─────────────────────────────────────────────────────

// ─── Lease Form Modal ─────────────────────────────────────────────────────────

function LeaseFormModal({
  tenant, mode, initial, onClose, onSaved,
}: {
  tenant: Tenant
  mode: 'create' | 'edit' | 'renew'
  initial?: Partial<Lease>
  onClose: () => void
  onSaved: (lease: Lease) => void
}) {
  const { user } = useAuth()
  const { primaryColor } = useBranding()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    startDate: initial?.startDate ?? '',
    endDate: initial?.endDate ?? '',
    rentAmount: initial?.rentAmount ?? tenant.rent,
    securityDeposit: initial?.securityDeposit ?? null as number | null,
    petDeposit: initial?.petDeposit ?? null as number | null,
    depositReturned: initial?.depositReturned ?? null as number | null,
    depositDeductions: initial?.depositDeductions ?? '',
    escalationPct: initial?.escalationPct ?? null as number | null,
    renewalOption: initial?.renewalOption ?? 'manual' as Lease['renewalOption'],
    status: initial?.status ?? 'active' as Lease['status'],
    notes: initial?.notes ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) { setForm(f => ({ ...f, [k]: v })) }

  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

  async function handleSave() {
    const e: Record<string, string> = {}
    if (!form.startDate) e.startDate = 'Required'
    if (!form.endDate) e.endDate = 'Required'
    if (!form.rentAmount || form.rentAmount <= 0) e.rentAmount = 'Required'
    if (form.startDate && form.endDate && new Date(form.startDate) >= new Date(form.endDate)) e.endDate = 'Must be after start date'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const payload = {
      pm_id: user?.id,
      tenant_id: isUuid(tenant.id) ? tenant.id : null,
      property_name: tenant.property,
      unit_number: tenant.unit,
      start_date: form.startDate,
      end_date: form.endDate,
      rent_amount: form.rentAmount,
      security_deposit: form.securityDeposit,
      pet_deposit: form.petDeposit,
      deposit_returned: form.depositReturned,
      deposit_deductions: form.depositDeductions || null,
      escalation_pct: form.escalationPct,
      renewal_option: form.renewalOption,
      status: form.status,
      notes: form.notes || null,
    }
    if (initial?.id) {
      const { data, error } = await supabase.from('leases').update(payload).eq('id', initial.id).select().single()
      if (error) { showToast({ type: 'error', title: 'Failed to save', message: error.message }); setSaving(false); return }
      onSaved(leaseFromRow(data as Record<string, unknown>))
    } else {
      const { data, error } = await supabase.from('leases').insert(payload).select().single()
      if (error) { showToast({ type: 'error', title: 'Failed to save', message: error.message }); setSaving(false); return }
      onSaved(leaseFromRow(data as Record<string, unknown>))
    }
    setSaving(false)
  }

  const titles = { create: 'New Lease', edit: 'Edit Lease', renew: 'Renew Lease' }
  const leaseDays = form.startDate && form.endDate ? Math.round((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000) : null
  const leaseTerm = leaseDays ? leaseDays >= 350 ? '12 months' : leaseDays >= 170 ? '6 months' : leaseDays >= 80 ? '3 months' : `${leaseDays} days` : null
  const nextRent = form.escalationPct && form.rentAmount ? Math.round(form.rentAmount * (1 + form.escalationPct / 100)) : null

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-lg animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">{titles[mode]}</h2>
            <p className="text-xs text-gray-400">{tenant.name} · Unit {tenant.unit} · {tenant.property}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Dates */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Lease Term {leaseTerm && <span className="text-blue-600 ml-1">· {leaseTerm}</span>}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date *</label>
                <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.startDate ? 'border-red-400' : 'border-gray-200'}`} />
                {errors.startDate && <p className="text-xs text-red-500 mt-0.5">{errors.startDate}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">End Date *</label>
                <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.endDate ? 'border-red-400' : 'border-gray-200'}`} />
                {errors.endDate && <p className="text-xs text-red-500 mt-0.5">{errors.endDate}</p>}
              </div>
            </div>
          </div>

          {/* Rent + escalation */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Financials</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Monthly Rent *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min="0" value={form.rentAmount} onChange={e => set('rentAmount', Number(e.target.value))} className={`w-full pl-7 pr-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.rentAmount ? 'border-red-400' : 'border-gray-200'}`} />
                </div>
                {errors.rentAmount && <p className="text-xs text-red-500 mt-0.5">{errors.rentAmount}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Annual Escalation <span className="font-normal text-gray-400">(opt)</span></label>
                <div className="relative">
                  <input type="number" min="0" max="20" step="0.5" value={form.escalationPct ?? ''} onChange={e => set('escalationPct', e.target.value ? Number(e.target.value) : null)} placeholder="e.g. 3" className="w-full pl-3 pr-7 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
                {nextRent && <p className="text-[10px] text-green-600 mt-0.5">→ ${nextRent.toLocaleString()}/mo at renewal</p>}
              </div>
            </div>
          </div>

          {/* Deposits */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Deposits</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Security Deposit</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min="0" value={form.securityDeposit ?? ''} onChange={e => set('securityDeposit', e.target.value ? Number(e.target.value) : null)} placeholder="0" className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Pet Deposit</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min="0" value={form.petDeposit ?? ''} onChange={e => set('petDeposit', e.target.value ? Number(e.target.value) : null)} placeholder="0" className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            {(initial?.id || mode === 'edit') && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Deposit Returned</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" min="0" value={form.depositReturned ?? ''} onChange={e => set('depositReturned', e.target.value ? Number(e.target.value) : null)} placeholder="0" className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Deduction Notes</label>
                  <input value={form.depositDeductions} onChange={e => set('depositDeductions', e.target.value)} placeholder="e.g. Carpet cleaning $200" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}
          </div>

          {/* Renewal + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Renewal Option</label>
              <select value={form.renewalOption} onChange={e => set('renewalOption', e.target.value as Lease['renewalOption'])} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="manual">Manual review</option>
                <option value="auto">Auto-renew</option>
                <option value="none">No renewal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value as Lease['status'])} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="renewed">Renewed</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Internal Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Pet policy, special terms, addendums…" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={handleSave} disabled={saving} className="flex-1 text-white py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50" style={{ background: primaryColor }}>
            {saving ? 'Saving…' : mode === 'renew' ? 'Create Renewal' : 'Save Lease'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Lease Panel ──────────────────────────────────────────────────────────────

function LeasePanel({ tenant }: { tenant: Tenant }) {
  const { user } = useAuth()
  const { primaryColor } = useBranding()
  const [leases, setLeases] = useState<Lease[]>([])
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'renew'>('create')
  const [editLease, setEditLease] = useState<Lease | null>(null)
  const [sendingRenewal, setSendingRenewal] = useState<string | null>(null)

  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

  async function fetchLeases() {
    if (!isUuid(tenant.id)) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase.from('leases').select('*').eq('tenant_id', tenant.id).order('start_date', { ascending: false })
    if (isTableMissing(error)) { setTableError(true); setLoading(false); return }
    setLeases((data ?? []).map(r => leaseFromRow(r as Record<string, unknown>)))
    setLoading(false)
  }

  useEffect(() => { fetchLeases() }, [tenant.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function sendRenewal(lease: Lease) {
    setSendingRenewal(lease.id)
    await supabase.from('leases').update({ renewal_sent_at: new Date().toISOString() }).eq('id', lease.id)
    await notifyUser(tenant.id, {
      type: 'lease',
      title: 'Lease Renewal Notice',
      body: `Your lease at ${lease.propertyName || tenant.property} Unit ${lease.unitNumber || tenant.unit} expires on ${new Date(lease.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Please contact us to discuss renewal options.`,
      link: '/tenant',
    })
    showToast({ type: 'success', title: 'Renewal notice sent', message: `Notification sent to ${tenant.name}` })
    setLeases(prev => prev.map(l => l.id === lease.id ? { ...l, renewalSentAt: new Date().toISOString() } : l))
    setSendingRenewal(null)
  }

  const activeLease = leases.find(l => l.status === 'active')
  const pastLeases = leases.filter(l => l.status !== 'active' && l.status !== 'draft')
  const draftLeases = leases.filter(l => l.status === 'draft')
  const now = new Date()

  const daysUntilExpiry = activeLease ? Math.round((new Date(activeLease.endDate).getTime() - now.getTime()) / 86400000) : null
  const showRenewalBanner = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 60
  const totalDeposit = activeLease ? (activeLease.securityDeposit ?? 0) + (activeLease.petDeposit ?? 0) : 0
  const nextRent = activeLease?.escalationPct && activeLease.rentAmount
    ? Math.round(activeLease.rentAmount * (1 + activeLease.escalationPct / 100))
    : null

  const LEASE_STATUS_META: Record<string, { color: string; label: string }> = {
    active:     { color: 'bg-green-100 text-green-700',  label: 'Active' },
    draft:      { color: 'bg-gray-100 text-gray-600',    label: 'Draft' },
    expired:    { color: 'bg-red-100 text-red-700',      label: 'Expired' },
    renewed:    { color: 'bg-blue-100 text-blue-700',    label: 'Renewed' },
    terminated: { color: 'bg-gray-100 text-gray-500',    label: 'Terminated' },
  }

  if (loading) return (
    <div className="space-y-3 p-1">{[0,1,2].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />)}</div>
  )

  if (tableError) return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
      <p className="text-sm font-bold text-amber-900 mb-1">Leases table not set up</p>
      <p className="text-xs text-amber-700 mb-3">Run this SQL in your Supabase dashboard to enable lease tracking:</p>
      <pre className="bg-white border border-amber-200 rounded-lg p-3 text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap">{LEASE_CREATE_SQL}</pre>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Renewal banner */}
      {showRenewalBanner && activeLease && (
        <div className={`rounded-xl p-4 border flex items-start gap-3 ${daysUntilExpiry <= 14 ? 'bg-red-50 border-red-200' : daysUntilExpiry <= 30 ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'}`}>
          <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${daysUntilExpiry <= 14 ? 'text-red-500' : daysUntilExpiry <= 30 ? 'text-orange-500' : 'text-amber-500'}`} />
          <div className="flex-1">
            <p className={`text-sm font-bold ${daysUntilExpiry <= 14 ? 'text-red-800' : daysUntilExpiry <= 30 ? 'text-orange-800' : 'text-amber-800'}`}>
              Lease expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
            </p>
            <p className={`text-xs mt-0.5 ${daysUntilExpiry <= 14 ? 'text-red-600' : daysUntilExpiry <= 30 ? 'text-orange-600' : 'text-amber-600'}`}>
              Ends {new Date(activeLease.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {activeLease.renewalSentAt ? ` · Renewal notice sent ${new Date(activeLease.renewalSentAt).toLocaleDateString()}` : ''}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {!activeLease.renewalSentAt && (
              <button
                onClick={() => sendRenewal(activeLease)}
                disabled={sendingRenewal === activeLease.id}
                className="text-xs font-bold text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                style={{ background: primaryColor }}
              >
                {sendingRenewal === activeLease.id ? 'Sending…' : 'Send Renewal'}
              </button>
            )}
            <button
              onClick={() => { setFormMode('renew'); setEditLease(null); setShowForm(true) }}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Create Renewal
            </button>
          </div>
        </div>
      )}

      {/* Active lease card */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current Lease</p>
          <button
            onClick={() => { setFormMode('create'); setEditLease(null); setShowForm(true) }}
            className="text-xs font-semibold flex items-center gap-1 hover:underline"
            style={{ color: primaryColor }}
          >
            <Plus className="w-3.5 h-3.5" /> New Lease
          </button>
        </div>

        {!activeLease ? (
          <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
            <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">No active lease on file</p>
            <button onClick={() => { setFormMode('create'); setEditLease(null); setShowForm(true) }} className="mt-3 text-xs font-bold text-white px-4 py-2 rounded-xl" style={{ background: primaryColor }}>
              Add Lease
            </button>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
            {/* Lease header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${LEASE_STATUS_META[activeLease.status]?.color}`}>{LEASE_STATUS_META[activeLease.status]?.label}</span>
                <span className="text-xs text-gray-500">{activeLease.renewalOption === 'auto' ? 'Auto-renew' : activeLease.renewalOption === 'none' ? 'No renewal' : 'Manual review'}</span>
              </div>
              <button onClick={() => { setEditLease(activeLease); setFormMode('edit'); setShowForm(true) }} className="text-xs font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <Pencil className="w-3 h-3" /> Edit
              </button>
            </div>
            {/* Term + progress */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>{new Date(activeLease.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span className={daysUntilExpiry !== null && daysUntilExpiry <= 30 ? 'font-bold text-orange-600' : ''}>
                  {daysUntilExpiry !== null ? `${daysUntilExpiry > 0 ? `${daysUntilExpiry}d left` : 'Expired'}` : ''}
                  {' '}{new Date(activeLease.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              {daysUntilExpiry !== null && (() => {
                const totalMs = new Date(activeLease.endDate).getTime() - new Date(activeLease.startDate).getTime()
                const elapsedMs = now.getTime() - new Date(activeLease.startDate).getTime()
                const pct = Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)))
                return (
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${daysUntilExpiry <= 14 ? 'bg-red-500' : daysUntilExpiry <= 30 ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                )
              })()}
            </div>
            {/* Stats grid */}
            <div className="grid grid-cols-4 divide-x divide-gray-100">
              {[
                { label: 'Monthly Rent', value: `$${activeLease.rentAmount.toLocaleString()}` },
                { label: 'Security Dep.', value: activeLease.securityDeposit ? `$${activeLease.securityDeposit.toLocaleString()}` : '—' },
                { label: 'Pet Deposit', value: activeLease.petDeposit ? `$${activeLease.petDeposit.toLocaleString()}` : '—' },
                { label: 'Escalation', value: activeLease.escalationPct ? `${activeLease.escalationPct}%` : 'None' },
              ].map(s => (
                <div key={s.label} className="px-3 py-2.5 text-center">
                  <p className="text-sm font-bold text-gray-900">{s.value}</p>
                  <p className="text-[10px] text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
            {/* Deposit held summary */}
            {totalDeposit > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-700">Deposits Held: <span className="text-green-700">${totalDeposit.toLocaleString()}</span></p>
                    {activeLease.depositReturned !== null && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Returned: ${activeLease.depositReturned.toLocaleString()} · Retained: ${Math.max(0, totalDeposit - activeLease.depositReturned).toLocaleString()}
                        {activeLease.depositDeductions && ` (${activeLease.depositDeductions})`}
                      </p>
                    )}
                  </div>
                  {nextRent && (
                    <div className="text-right">
                      <p className="text-xs text-gray-400">At renewal</p>
                      <p className="text-sm font-bold text-blue-600">${nextRent.toLocaleString()}/mo</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeLease.notes && (
              <div className="px-4 py-2.5 border-t border-gray-100 bg-amber-50">
                <p className="text-xs text-amber-700">{activeLease.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Draft renewals */}
      {draftLeases.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Draft Renewals</p>
          <div className="space-y-2">
            {draftLeases.map(l => (
              <div key={l.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-gray-900">${l.rentAmount.toLocaleString()}/mo</p>
                  <p className="text-xs text-gray-500">{new Date(l.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} → {new Date(l.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Draft</span>
                  <button onClick={() => { setEditLease(l); setFormMode('edit'); setShowForm(true) }} className="text-xs font-semibold hover:underline" style={{ color: primaryColor }}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lease history */}
      {pastLeases.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Lease History</p>
          <div className="space-y-2">
            {pastLeases.map(l => (
              <div key={l.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">${l.rentAmount.toLocaleString()}/mo</p>
                    <p className="text-xs text-gray-400">{new Date(l.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} — {new Date(l.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {l.securityDeposit && <span className="text-xs text-gray-400">Dep: ${l.securityDeposit.toLocaleString()}</span>}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${LEASE_STATUS_META[l.status]?.color}`}>{LEASE_STATUS_META[l.status]?.label}</span>
                  <button onClick={() => { setEditLease(l); setFormMode('edit'); setShowForm(true) }} className="text-xs text-gray-400 hover:text-gray-600"><Pencil className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <LeaseFormModal
          tenant={tenant}
          mode={formMode}
          initial={formMode === 'renew' && activeLease ? {
            startDate: activeLease.endDate,
            endDate: (() => { const d = new Date(activeLease.endDate); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split('T')[0] })(),
            rentAmount: nextRent ?? activeLease.rentAmount,
            securityDeposit: activeLease.securityDeposit,
            petDeposit: activeLease.petDeposit,
            escalationPct: activeLease.escalationPct,
            renewalOption: activeLease.renewalOption,
            status: 'draft',
          } : editLease ?? undefined}
          onClose={() => { setShowForm(false); setEditLease(null) }}
          onSaved={async (saved) => {
            showToast({ type: 'success', title: formMode === 'renew' ? 'Renewal created' : formMode === 'edit' ? 'Lease updated' : 'Lease added' })
            await fetchLeases()
            setShowForm(false)
            setEditLease(null)
          }}
        />
      )}
    </div>
  )
}

// ─── CRM: Add Emergency Contact Modal ────────────────────────────────────────

function AddEmergencyContactModal({ tenant, onClose, onSaved }: { tenant: Tenant; onClose: () => void; onSaved: (c: EmergencyContact) => void }) {
  const { primaryColor } = useBranding()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', relationship: '' })
  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('emergency_contacts') as any).insert({
      pm_id: user?.id,
      tenant_id: isUuid(tenant.id) ? tenant.id : null,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      relationship: form.relationship.trim() || null,
    }).select().single()
    if (error) {
      if (isTableMissing(error)) showToast({ type: 'error', title: 'Run EMERGENCY_CONTACTS_SQL first' })
      else showToast({ type: 'error', title: 'Failed to save', message: error.message })
      setSaving(false); return
    }
    onSaved({ id: data.id, tenantId: data.tenant_id, name: data.name, phone: data.phone ?? '', relationship: data.relationship ?? '' })
    setSaving(false)
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-sm animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Add Emergency Contact</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name *</label>
            <input autoFocus value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Jane Doe"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="(555) 000-0000"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Relationship</label>
              <input value={form.relationship} onChange={e => setForm(f => ({...f, relationship: e.target.value}))} placeholder="e.g. Spouse, Parent"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 text-white py-2.5 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50" style={{ background: primaryColor }}>
              {saving ? 'Saving…' : 'Add Contact'}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── CRM: Log Contact Modal ───────────────────────────────────────────────────

function LogContactModal({ tenant, onClose, onSaved }: { tenant: Tenant; onClose: () => void; onSaved: () => void }) {
  const { primaryColor } = useBranding()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ type: 'call', text: '', date: new Date().toISOString().split('T')[0] })
  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  const typeMeta = COMM_LOG_TYPES.find(t => t.value === form.type)
  const IconComp = typeMeta?.icon ?? PhoneCall

  async function handleSave() {
    if (!form.text.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('activity_log') as any).insert({
      admin_id: user?.id,
      tenant_id: isUuid(tenant.id) ? tenant.id : null,
      type: form.type,
      text: form.text.trim(),
    })
    if (error) {
      if (isTableMissing(error) || error.code === '42703') showToast({ type: 'error', title: 'Run TENANT_SCHEMA_SQL first' })
      else showToast({ type: 'error', title: 'Failed to save', message: error.message })
      setSaving(false); return
    }
    showToast({ type: 'success', title: `${typeMeta?.label ?? 'Entry'} logged` })
    onSaved()
    setSaving(false)
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Log Contact with {tenant.name}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Type pills */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Type</label>
            <div className="flex flex-wrap gap-2">
              {COMM_LOG_TYPES.filter(t => t.value !== 'note').map(t => {
                const Ic = t.icon
                return (
                  <button key={t.value} onClick={() => setForm(f => ({...f, type: t.value}))}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${form.type === t.value ? `${t.color} border-current` : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <Ic className="w-3.5 h-3.5" />{t.label}
                  </button>
                )
              })}
            </div>
          </div>
          {/* Summary */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Summary *</label>
            <textarea autoFocus value={form.text} onChange={e => setForm(f => ({...f, text: e.target.value}))} rows={3}
              placeholder={form.type === 'call' ? 'e.g. Called about noise complaint, resolved amicably' : form.type === 'email' ? 'e.g. Sent lease renewal notice via email' : 'Describe the interaction…'}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving || !form.text.trim()} className="flex-1 text-white py-2.5 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: primaryColor }}>
              <IconComp className="w-4 h-4" />{saving ? 'Saving…' : `Log ${typeMeta?.label ?? 'Entry'}`}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Tenant Profile Modal ─────────────────────────────────────────────────────

function TenantProfileModal({ tenant, tickets, onClose, onMessage, onSavePayment }: { tenant: Tenant; tickets: MaintenanceTicket[]; onClose: () => void; onMessage: (id: string) => void; onSavePayment?: (record: RentRecord) => void }) {
  const { primaryColor } = useBranding()
  const [tab, setTab] = useState<'overview'|'lease'|'payments'|'maintenance'|'log'|'documents'>('overview')
  const [showLogPayment, setShowLogPayment] = useState(false)
  const [showLateFeeModal, setShowLateFeeModal] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [showLogContact, setShowLogContact] = useState(false)

  // Emergency contacts
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)

  // Communication log
  const [commLog, setCommLog] = useState<CommLogEntry[]>([])
  const [commLoading, setCommLoading] = useState(false)

  // Move-in checklist (from tenant row, fallback to template)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    tenant.moveInChecklist?.length ? tenant.moveInChecklist : MOVE_IN_CHECKLIST_TEMPLATE.map(i => ({ ...i }))
  )

  // Quick note
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const { data: rentRecords, loading: paymentsLoading, refetch: refetchPayments } = useRentRecords(tenant.id)
  const { data: docs, loading: docsLoading } = useDocuments(tenant.id)
  const tenantTickets = tickets.filter(t => t.tenantId === tenant.id)

  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  const tenantIdIsUuid = isUuid(tenant.id)

  async function fetchContacts() {
    if (!tenantIdIsUuid) return
    setContactsLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('emergency_contacts') as any).select('*').eq('tenant_id', tenant.id).order('created_at')
    setContacts((data ?? []).map((r: Record<string, unknown>) => ({ id: r.id as string, tenantId: r.tenant_id as string, name: r.name as string, phone: (r.phone as string) ?? '', relationship: (r.relationship as string) ?? '' })))
    setContactsLoading(false)
  }

  async function fetchCommLog() {
    if (!tenantIdIsUuid) return
    setCommLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('activity_log') as any).select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(50)
    setCommLog((data ?? []).map((r: Record<string, unknown>) => ({ id: r.id as string, tenantId: r.tenant_id as string | null, adminId: r.admin_id as string | null, type: r.type as string, text: r.text as string, createdAt: r.created_at as string })))
    setCommLoading(false)
  }

  useEffect(() => { fetchContacts() }, [tenant.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === 'log') fetchCommLog() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleChecklist(key: string) {
    const updated = checklist.map(i => i.key === key ? { ...i, checked: !i.checked } : i)
    setChecklist(updated)
    if (!tenantIdIsUuid) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('tenants') as any).update({ move_in_checklist: updated }).eq('id', tenant.id)
  }

  async function saveNote() {
    if (!noteText.trim()) return
    setSavingNote(true)
    const { data: { user } } = await supabase.auth.getUser()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('activity_log') as any).insert({ admin_id: user?.id, tenant_id: tenantIdIsUuid ? tenant.id : null, type: 'note', text: noteText.trim() })
    setNoteText('')
    await fetchCommLog()
    setSavingNote(false)
  }

  async function deleteContact(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('emergency_contacts') as any).delete().eq('id', id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  const now = new Date()
  let leaseEndDate: Date | null = null
  try { leaseEndDate = new Date(tenant.leaseEnd) } catch { leaseEndDate = null }
  const daysRemaining = leaseEndDate ? Math.round((leaseEndDate.getTime() - now.getTime()) / 86400000) : null
  const totalLeaseDays = 365
  const leaseProgress = daysRemaining !== null ? Math.max(0, Math.min(100, Math.round(((totalLeaseDays - daysRemaining) / totalLeaseDays) * 100))) : 0

  const checklistDone = checklist.filter(i => i.checked).length
  const checklistTotal = checklist.length

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <Avatar name={tenant.name} size="lg" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">{tenant.name}</h2>
              <p className="text-sm text-gray-500">Unit {tenant.unit} · {tenant.property}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-gray-400">{tenant.email}</span>
                <span className="text-xs text-gray-400">{tenant.phone}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-4 pt-3 border-b border-gray-100 overflow-x-auto">
          {(['overview','lease','payments','maintenance','log','documents'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${tab === t ? 'border-b-2 text-blue-700 bg-blue-50 rounded-t-lg' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              style={tab === t ? { borderColor: primaryColor, color: primaryColor } : {}}>
              {t === 'log' ? 'Log' : t.charAt(0).toUpperCase()+t.slice(1)}
              {t === 'log' && commLog.length > 0 && <span className="ml-1 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">{commLog.length}</span>}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div className="space-y-4">
              {/* Lease summary */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Lease</p>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div><p className="text-xs text-gray-400">Monthly Rent</p><p className="font-bold text-gray-900">${tenant.rent.toLocaleString()}</p></div>
                  <div><p className="text-xs text-gray-400">Move In</p><p className="font-bold text-gray-900">{tenant.moveIn}</p></div>
                  <div><p className="text-xs text-gray-400">Lease End</p><p className="font-bold text-gray-900">{tenant.leaseEnd}</p></div>
                </div>
                {daysRemaining !== null && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Lease Progress</span>
                      <span>{daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Expired'}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${leaseProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Contact + Emergency contacts */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contact</p>
                  <p className="text-sm text-gray-700">{tenant.email}</p>
                  <p className="text-sm text-gray-700">{tenant.phone}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Emergency Contacts</p>
                    <button onClick={() => setShowAddContact(true)} className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-100" title="Add contact">
                      <UserPlus className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  </div>
                  {contactsLoading ? <p className="text-xs text-gray-400">Loading…</p> :
                    contacts.length === 0 ? <p className="text-sm text-gray-400 italic">None on file</p> :
                    <div className="space-y-2">
                      {contacts.map(c => (
                        <div key={c.id} className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{c.name}</p>
                            <p className="text-xs text-gray-500">{c.relationship}{c.phone ? ` · ${c.phone}` : ''}</p>
                          </div>
                          <button onClick={() => deleteContact(c.id)} className="text-gray-300 hover:text-red-400 shrink-0 mt-0.5"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  }
                </div>
              </div>

              {/* Move-in Checklist */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-gray-400" />
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Move-In Checklist</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${checklistDone === checklistTotal ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {checklistDone}/{checklistTotal}
                  </span>
                </div>
                <div className="p-3 space-y-1">
                  {checklist.map(item => (
                    <label key={item.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={item.checked} onChange={() => toggleChecklist(item.key)}
                        className="w-4 h-4 rounded border-gray-300 accent-blue-600" />
                      <span className={`text-sm ${item.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item.label}</span>
                    </label>
                  ))}
                </div>
                {checklistDone < checklistTotal && !tenantIdIsUuid && (
                  <p className="px-4 pb-3 text-xs text-amber-600">Run TENANT_SCHEMA_SQL first to persist checklist changes</p>
                )}
              </div>
            </div>
          )}

          {/* ── LEASE ── */}
          {tab === 'lease' && <LeasePanel tenant={tenant} />}

          {/* ── PAYMENTS ── */}
          {tab === 'payments' && (
            <div className="space-y-4">
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowLateFeeModal(true)} className="border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
                  <AlertCircle className="w-4 h-4" /> Add Late Fee
                </button>
                <button onClick={() => setShowLogPayment(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
                  <CreditCard className="w-4 h-4" /> Log Payment
                </button>
              </div>
              {paymentsLoading ? (
                <p className="text-sm text-gray-400 text-center py-8">Loading payments…</p>
              ) : rentRecords.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No payments recorded yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Month','Amount','Date Paid','Status'].map(h => (
                        <th key={h} className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rentRecords.map(p => (
                      <tr key={p.id} className="border-b border-gray-50">
                        <td className="py-2.5 text-gray-700">{p.month}</td>
                        <td className="py-2.5 font-semibold text-gray-900">${p.amount.toLocaleString()}</td>
                        <td className="py-2.5 text-gray-600">{p.datePaid ?? '—'}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${p.status === 'paid' ? 'bg-green-100 text-green-700' : p.status === 'late' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                            {p.status.charAt(0).toUpperCase()+p.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── MAINTENANCE ── */}
          {tab === 'maintenance' && (
            <div>
              {tenantTickets.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No maintenance tickets for this tenant.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Issue','Category','Status','Date'].map(h => (
                        <th key={h} className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tenantTickets.map(t => (
                      <tr key={t.id} className="border-b border-gray-50">
                        <td className="py-2.5 font-medium text-gray-900">{t.title}</td>
                        <td className="py-2.5 text-gray-600">{t.category}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${t.status === 'resolved' ? 'bg-green-100 text-green-700' : t.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {t.status === 'in_progress' ? 'In Progress' : t.status.charAt(0).toUpperCase()+t.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-2.5 text-gray-500">{t.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── LOG ── */}
          {tab === 'log' && (
            <div className="space-y-4">
              {/* Quick note entry */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5" />Quick Note</p>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Log a note about this tenant…" rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white" />
                <div className="flex items-center justify-between mt-2">
                  <button onClick={() => setShowLogContact(true)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1.5 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-white">
                    <PhoneCall className="w-3.5 h-3.5" /> Log call / email
                  </button>
                  <button onClick={saveNote} disabled={savingNote || !noteText.trim()} className="text-xs font-bold text-white px-4 py-1.5 rounded-lg disabled:opacity-40 hover:opacity-90" style={{ background: primaryColor }}>
                    {savingNote ? 'Saving…' : 'Save Note'}
                  </button>
                </div>
              </div>

              {/* Timeline */}
              {commLoading ? <p className="text-sm text-gray-400 text-center py-8">Loading…</p> :
                commLog.length === 0 ? (
                  <div className="text-center py-10">
                    <StickyNote className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No log entries yet</p>
                    <p className="text-xs text-gray-300 mt-1">Notes, calls, emails, and in-person meetings will appear here</p>
                    {!tenantIdIsUuid && <p className="text-xs text-amber-600 mt-2">Run TENANT_SCHEMA_SQL to enable logging</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {commLog.map(entry => {
                      const typeMeta = COMM_LOG_TYPES.find(t => t.value === entry.type)
                      const IconComp = typeMeta?.icon ?? StickyNote
                      return (
                        <div key={entry.id} className="flex gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${typeMeta?.color ?? 'bg-gray-100 text-gray-600'}`}>
                            <IconComp className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${typeMeta?.color ?? 'bg-gray-100 text-gray-600'}`}>{typeMeta?.label ?? entry.type}</span>
                              <span className="text-xs text-gray-400 shrink-0">{new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.text}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              }
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {tab === 'documents' && (
            <div className="space-y-3">
              {docsLoading ? (
                <p className="text-sm text-gray-400 text-center py-8">Loading documents…</p>
              ) : docs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No documents uploaded for this tenant.</p>
              ) : (
                docs.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{d.name}</p>
                        <p className="text-xs text-gray-400">{d.type} · {d.date} · {d.size}</p>
                      </div>
                    </div>
                    {d.storagePath && (
                      <button onClick={async () => {
                        const { data } = await supabase.storage.from('documents').createSignedUrl(d.storagePath!, 60)
                        if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                      }} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Download</button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={() => onMessage(tenant.id)}
            className="w-full text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 hover:opacity-90"
            style={{ background: primaryColor }}
          >
            <MessageSquare className="w-4 h-4" /> Send Message
          </button>
        </div>
      </div>

      {/* Sub-modals */}
      {showLogPayment && (
        <LogPaymentModal
          tenant={tenant}
          onClose={() => setShowLogPayment(false)}
          onSave={(record) => { onSavePayment?.(record); refetchPayments(); setShowLogPayment(false) }}
        />
      )}
      {showLateFeeModal && (
        <LateFeeModal tenant={tenant} onClose={() => setShowLateFeeModal(false)} onSaved={() => setShowLateFeeModal(false)} />
      )}
      {showAddContact && (
        <AddEmergencyContactModal
          tenant={tenant}
          onClose={() => setShowAddContact(false)}
          onSaved={c => { setContacts(prev => [...prev, c]); setShowAddContact(false) }}
        />
      )}
      {showLogContact && (
        <LogContactModal
          tenant={tenant}
          onClose={() => setShowLogContact(false)}
          onSaved={async () => { setShowLogContact(false); await fetchCommLog() }}
        />
      )}
    </ModalBackdrop>
  )
}

// ─── Manage Property Modal ────────────────────────────────────────────────────

interface ManagePropertyModalProps {
  property: Property
  tenants: Tenant[]
  tickets: MaintenanceTicket[]
  onClose: () => void
  onUpdateProperty: (p: Property) => void
  onShowNewTicket: () => void
  setActivePanel: (panel: string) => void
  setSelectedThreadId: React.Dispatch<React.SetStateAction<string | null>>
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>
  onViewTenant: (tenantId: string) => void
}

function ManagePropertyModal({ property, tenants, tickets, onClose, onUpdateProperty, onShowNewTicket, onViewTenant }: ManagePropertyModalProps) {
  const [tab, setTab] = useState<'overview'|'tenants'|'maintenance'|'settings'>('overview')
  const [settingsForm, setSettingsForm] = useState({
    address: property.address,
    city: property.city,
    units: String(property.units),
    propertyType: 'Apartment',
    managementFee: '10',
    notes: '',
  })

  const propTenants = tenants.filter(t => t.property === property.name)
  const propTickets = tickets.filter(t => t.property === property.name)
  const openTickets = propTickets.filter(t => t.status !== 'resolved').length
  const occupancyPct = property.units > 0 ? (property.occupied / property.units) * 100 : 0
  const vacantUnits = property.units - property.occupied
  const avgRent = propTenants.length > 0 ? propTenants.reduce((s, t) => s + t.rent, 0) / propTenants.length : 0
  const vacancyCost = vacantUnits * avgRent

  // SVG occupancy ring
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const strokeDash = circumference * (occupancyPct / 100)

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{property.name}</h2>
            <p className="text-xs text-gray-500">{property.city}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-gray-100">
          {(['overview','tenants','maintenance','settings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === t ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'overview' && (
            <div className="space-y-5">
              <div className="flex items-center gap-6">
                {/* Occupancy ring */}
                <div className="relative w-24 h-24">
                  <svg width="96" height="96" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="10" />
                    <circle cx="48" cy="48" r={radius} fill="none" stroke="#2563EB" strokeWidth="10"
                      strokeDasharray={`${strokeDash} ${circumference}`} strokeLinecap="round"
                      transform="rotate(-90 48 48)" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-gray-900">{Math.round(occupancyPct)}%</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 flex-1">
                  {[
                    { label: 'Monthly Income', value: `$${property.monthlyIncome.toLocaleString()}` },
                    { label: 'Open Tickets', value: openTickets },
                    { label: 'Occupied Units', value: `${property.occupied} / ${property.units}` },
                    { label: 'Tenants', value: propTenants.length },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <p className="text-sm font-bold text-gray-900">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              {vacantUnits > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-amber-800">Vacancy Cost Estimate</p>
                  <p className="text-xs text-amber-700 mt-0.5">{vacantUnits} vacant unit{vacantUnits > 1 ? 's' : ''} · est. ${Math.round(vacancyCost).toLocaleString()}/mo in lost revenue</p>
                </div>
              )}
            </div>
          )}

          {tab === 'tenants' && (
            <div>
              {propTenants.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No tenants in this property.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Tenant','Unit','Rent','Lease End','Status'].map(h => (
                        <th key={h} className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {propTenants.map(t => (
                      <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5">
                          <button onClick={() => { onViewTenant(t.id); }} className="font-medium text-blue-600 hover:underline text-left">{t.name}</button>
                          <p className="text-xs text-gray-400">{t.email}</p>
                        </td>
                        <td className="py-2.5 text-gray-600">{t.unit}</td>
                        <td className="py-2.5 font-semibold">${t.rent.toLocaleString()}</td>
                        <td className="py-2.5 text-gray-600">{t.leaseEnd}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${t.status === 'active' ? 'bg-green-100 text-green-700' : t.status === 'late' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {t.status.charAt(0).toUpperCase()+t.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'maintenance' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button onClick={onShowNewTicket} className="text-xs font-semibold text-blue-600 hover:text-blue-700 border border-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-50">
                  + Add Ticket
                </button>
              </div>
              {propTickets.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No tickets for this property.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['ID','Issue','Status','Date'].map(h => (
                        <th key={h} className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {propTickets.map(t => (
                      <tr key={t.id} className="border-b border-gray-50">
                        <td className="py-2.5 font-mono text-xs text-gray-500">{t.id}</td>
                        <td className="py-2.5 font-medium text-gray-900">{t.title}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${t.status === 'resolved' ? 'bg-green-100 text-green-700' : t.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {t.status === 'in_progress' ? 'In Progress' : t.status.charAt(0).toUpperCase()+t.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-2.5 text-gray-500">{t.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'settings' && (
            <div className="space-y-4">
              {[
                { key: 'address', label: 'Address' },
                { key: 'city', label: 'City' },
                { key: 'units', label: 'Total Units', type: 'number' },
                { key: 'managementFee', label: 'Management Fee (%)', type: 'number' },
              ].map(({ key, label, type = 'text' }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                  <input type={type} value={(settingsForm as Record<string,string>)[key]} onChange={e => setSettingsForm({...settingsForm, [key]: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Property Type</label>
                <select value={settingsForm.propertyType} onChange={e => setSettingsForm({...settingsForm, propertyType: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {['Apartment','Single-Family','Multi-Family','Commercial','Other'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea value={settingsForm.notes} onChange={e => setSettingsForm({...settingsForm, notes: e.target.value})} rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <button
                onClick={() => onUpdateProperty({ ...property, address: settingsForm.address, city: settingsForm.city, units: Number(settingsForm.units) })}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── New Thread Modal ─────────────────────────────────────────────────────────

function NewThreadModal({ tenants, threads, onClose, onSelect, onCreateThread }: {
  tenants: Tenant[]
  threads: Thread[]
  onClose: () => void
  onSelect: (threadId: string) => void
  onCreateThread: (thread: Thread) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = tenants.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-sm max-h-[80vh] overflow-hidden animate-scale-in flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-900">New Conversation</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tenants…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map(t => {
            const existing = threads.find(th => th.tenantId === t.id)
            return (
              <button key={t.id} onClick={() => {
                if (existing) { onSelect(existing.id) }
                else {
                  onCreateThread({
                    id: `thread-${Date.now()}`,
                    tenantId: t.id,
                    tenantName: t.name,
                    tenantUnit: `${t.property} · Unit ${t.unit}`,
                    unread: 0,
                    lastMessage: '',
                    lastTime: '',
                  })
                }
              }} className="w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 flex items-center gap-3">
                <Avatar name={t.name} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">Unit {t.unit} · {t.property}</p>
                </div>
                {existing && <span className="text-xs text-gray-400">(existing)</span>}
              </button>
            )
          })}
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Ledger: Expense Entry Modal ─────────────────────────────────────────────

function ExpenseEntryModal({
  properties, onClose, onSaved,
}: {
  properties: Property[]
  onClose: () => void
  onSaved: (entry: LedgerEntry) => void
}) {
  const { primaryColor } = useBranding()
  const [saving, setSaving] = useState(false)
  const todayStr = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    propertyId: properties[0]?.id ?? '',
    category: 'repair',
    amount: '',
    date: todayStr,
    description: '',
    recurring: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSave() {
    const e: Record<string, string> = {}
    if (!form.propertyId) e.propertyId = 'Required'
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) e.amount = 'Enter a valid amount'
    if (!form.date) e.date = 'Required'
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const { data: { user: freshUser } } = await supabase.auth.getUser()
    const catMeta = EXPENSE_CATEGORIES.find(c => c.value === form.category)
    const desc = form.description.trim() || catMeta?.label || form.category
    const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    const { data, error } = await supabase.from('ledger_entries').insert({
      pm_id: freshUser?.id,
      property_id: isUuid(form.propertyId) ? form.propertyId : null,
      type: 'expense',
      amount: -Math.abs(Number(form.amount)),
      date: form.date,
      description: `[${form.category}] ${desc}`,
    }).select().single()
    if (error) { showToast({ type: 'error', title: 'Failed to save', message: error.message }); setSaving(false); return }
    showToast({ type: 'success', title: 'Expense recorded' })
    onSaved(ledgerEntryFromRow(data as Record<string, unknown>))
    setSaving(false)
  }

  const catMeta = EXPENSE_CATEGORIES.find(c => c.value === form.category)

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Record Expense</h2>
            <p className="text-xs text-gray-400">Logged as a negative ledger entry</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Property */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Property *</label>
            <select value={form.propertyId} onChange={e => set('propertyId', e.target.value)} className={`w-full px-3 py-2 text-sm border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.propertyId ? 'border-red-400' : 'border-gray-200'}`}>
              <option value="">Select property…</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {errors.propertyId && <p className="text-xs text-red-500 mt-0.5">{errors.propertyId}</p>}
          </div>
          {/* Category pills */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_CATEGORIES.map(c => (
                <button key={c.value} onClick={() => set('category', c.value)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border-2 transition-all ${form.category === c.value ? `${c.color} border-current` : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                >{c.label}</button>
              ))}
            </div>
          </div>
          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" className={`w-full pl-7 pr-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.amount ? 'border-red-400' : 'border-gray-200'}`} />
              </div>
              {errors.amount && <p className="text-xs text-red-500 mt-0.5">{errors.amount}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.date ? 'border-red-400' : 'border-gray-200'}`} />
            </div>
          </div>
          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description <span className="font-normal text-gray-400">(optional)</span></label>
            <input value={form.description} onChange={e => set('description', e.target.value)} placeholder={catMeta?.label ?? 'Details about this expense…'} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={handleSave} disabled={saving} className="flex-1 text-white py-2.5 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity" style={{ background: primaryColor }}>
            {saving ? 'Saving…' : 'Record Expense'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200">Cancel</button>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Ledger: Late Fee Modal ───────────────────────────────────────────────────

function LateFeeModal({ tenant, onClose, onSaved }: { tenant: Tenant; onClose: () => void; onSaved: (entry: LedgerEntry) => void }) {
  const { primaryColor } = useBranding()
  const [saving, setSaving] = useState(false)
  const todayStr = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ amount: '', date: todayStr, description: 'Late fee' })
  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) return
    setSaving(true)
    const { data: { user: freshUser } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('ledger_entries').insert({
      pm_id: freshUser?.id,
      tenant_id: isUuid(tenant.id) ? tenant.id : null,
      type: 'late_fee',
      amount: Math.abs(Number(form.amount)),
      date: form.date,
      description: form.description || 'Late fee',
    }).select().single()
    if (error) { showToast({ type: 'error', title: 'Failed to save', message: error.message }); setSaving(false); return }
    showToast({ type: 'success', title: `Late fee of $${Number(form.amount).toLocaleString()} recorded` })
    onSaved(ledgerEntryFromRow(data as Record<string, unknown>))
    setSaving(false)
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-sm animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Add Late Fee</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Adding a late fee for <span className="font-semibold">{tenant.name}</span></p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" min="0" step="0.01" autoFocus value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="e.g. 50" className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={handleSave} disabled={saving || !form.amount} className="flex-1 text-white py-2.5 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50" style={{ background: primaryColor }}>
            {saving ? 'Saving…' : 'Add Late Fee'}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200">Cancel</button>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Ledger Panel ─────────────────────────────────────────────────────────────

function LedgerPanel({ tenants, properties, rentRecords }: { tenants: Tenant[]; properties: Property[]; rentRecords: RentRecord[] }) {
  const { user } = useAuth()
  const { primaryColor } = useBranding()
  const [tab, setTab] = useState<'overview' | 'expenses' | 'aging' | 'late-fees'>('overview')
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [propFilter, setPropFilter] = useState('all')

  async function fetchEntries() {
    setLoading(true)
    const { data, error } = await supabase.from('ledger_entries').select('*').order('date', { ascending: false })
    if (isTableMissing(error)) { setTableError(true); setLoading(false); return }
    setEntries((data ?? []).map(r => ledgerEntryFromRow(r as Record<string, unknown>)))
    setLoading(false)
  }
  useEffect(() => { fetchEntries() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived: rent income from rent_payments ──────────────────────────────
  const now = new Date()
  const rentIncomeByMonth = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of rentRecords) {
      if (r.status === 'pending') continue
      const m = r.month  // e.g. "June 2026"
      map[m] = (map[m] ?? 0) + r.amount
    }
    return map
  }, [rentRecords])

  // ── Filtered entries ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return entries.filter(e => {
      const entryMonth = e.date?.slice(0, 7) // "2026-06"
      if (monthFilter !== 'all' && entryMonth !== monthFilter) return false
      if (propFilter !== 'all' && e.propertyId !== propFilter) return false
      return true
    })
  }, [entries, monthFilter, propFilter])

  // ── Overview stats ───────────────────────────────────────────────────────
  const overviewStats = useMemo(() => {
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return months.map(m => {
      const label = new Date(m + '-01').toLocaleString('en-US', { month: 'short', year: '2-digit' })
      const rentMonthLabel = new Date(m + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const income = (rentIncomeByMonth[rentMonthLabel] ?? 0) +
        entries.filter(e => e.date?.slice(0, 7) === m && e.amount > 0).reduce((s, e) => s + e.amount, 0)
      const expense = Math.abs(entries.filter(e => e.date?.slice(0, 7) === m && e.amount < 0).reduce((s, e) => s + e.amount, 0))
      return { month: m, label, income, expense, noi: income - expense }
    })
  }, [entries, rentIncomeByMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const currentStats = overviewStats.find(s => s.month === currentMonthKey) ?? { income: 0, expense: 0, noi: 0 }
  const ytdIncome = overviewStats.reduce((s, d) => s + d.income, 0)
  const ytdExpenses = overviewStats.reduce((s, d) => s + d.expense, 0)
  const ytdNOI = ytdIncome - ytdExpenses

  // ── Expenses by category ─────────────────────────────────────────────────
  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of entries.filter(e => e.amount < 0)) {
      const cat = e.description?.match(/^\[([^\]]+)\]/)?.[1] ?? 'other'
      map[cat] = (map[cat] ?? 0) + Math.abs(e.amount)
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [entries])

  // ── NOI per property ─────────────────────────────────────────────────────
  const noiByProperty = useMemo(() => {
    return properties.map(p => {
      const propRentLabel = rentRecords
        .filter(r => r.status !== 'pending' && tenants.find(t => t.id === r.tenantId)?.property === p.name)
        .reduce((s, r) => s + r.amount, 0)
      const propExpenses = Math.abs(entries.filter(e => e.propertyId === p.id && e.amount < 0).reduce((s, e) => s + e.amount, 0))
      const propLateFees = entries.filter(e => e.propertyId === p.id && e.type === 'late_fee').reduce((s, e) => s + e.amount, 0)
      const income = propRentLabel + propLateFees
      return { property: p, income, expenses: propExpenses, noi: income - propExpenses }
    })
  }, [entries, properties, rentRecords, tenants])

  // ── Rent aging ───────────────────────────────────────────────────────────
  const agingData = useMemo(() => {
    const thisMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const paidThisMonth = new Set(rentRecords.filter(r => r.month === thisMonth && r.status !== 'pending').map(r => r.tenantId))
    const today = now.getDate()
    return tenants
      .filter(t => t.status !== 'past' && t.status !== 'invited' && !paidThisMonth.has(t.id))
      .map(t => {
        const dueDay = t.rentDueDay ?? 1
        const daysLate = Math.max(0, today - dueDay)
        return { tenant: t, daysLate }
      })
      .filter(x => x.daysLate > 0)
      .sort((a, b) => b.daysLate - a.daysLate)
  }, [tenants, rentRecords]) // eslint-disable-line react-hooks/exhaustive-deps

  const aging30 = agingData.filter(x => x.daysLate <= 30)
  const aging60 = agingData.filter(x => x.daysLate > 30 && x.daysLate <= 60)
  const aging90 = agingData.filter(x => x.daysLate > 60)

  // ── Late fees ────────────────────────────────────────────────────────────
  const lateFeeEntries = useMemo(() => entries.filter(e => e.type === 'late_fee').sort((a, b) => b.date.localeCompare(a.date)), [entries])
  const totalLateFees = lateFeeEntries.reduce((s, e) => s + e.amount, 0)

  const monthOptions = useMemo(() => {
    const opts = [{ value: 'all', label: 'All time' }]
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      opts.push({ value: val, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) })
    }
    return opts
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <div className="p-6 space-y-3">{[0,1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-xl" />)}</div>
  )

  if (tableError) return (
    <div className="p-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <p className="text-sm font-bold text-amber-900 mb-1">Ledger table not set up</p>
        <p className="text-xs text-amber-700 mb-3">Run each statement separately in Supabase Dashboard → SQL Editor:</p>
        <pre className="bg-white border border-amber-200 rounded-lg p-3 text-xs text-gray-800 overflow-x-auto whitespace-pre-wrap">{LEDGER_CREATE_SQL}</pre>
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Ledger</h1>
          <p className="text-xs text-gray-500">Income, expenses & NOI across your portfolio</p>
        </div>
        <button onClick={() => setShowExpenseModal(true)} className="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl hover:opacity-90 transition-opacity" style={{ background: primaryColor }}>
          <TrendingDown className="w-4 h-4" /> Record Expense
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'YTD Income',    value: `$${ytdIncome.toLocaleString()}`,    icon: <ArrowUpRight className="w-5 h-5" />,  color: 'text-green-600 bg-green-50',  sub: '6-month total' },
          { label: 'YTD Expenses',  value: `$${ytdExpenses.toLocaleString()}`,  icon: <ArrowDownLeft className="w-5 h-5" />, color: 'text-red-600 bg-red-50',      sub: '6-month total' },
          { label: 'YTD NOI',       value: `$${ytdNOI.toLocaleString()}`,       icon: <Landmark className="w-5 h-5" />,     color: ytdNOI >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50', sub: `${ytdIncome > 0 ? Math.round((ytdNOI / ytdIncome) * 100) : 0}% margin` },
          { label: 'Late Fees (all)', value: `$${totalLateFees.toLocaleString()}`, icon: <PiggyBank className="w-5 h-5" />, color: 'text-orange-600 bg-orange-50', sub: `${lateFeeEntries.length} entries` },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{k.label}</p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.color}`}>{k.icon}</div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['overview', 'expenses', 'aging', 'late-fees'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors capitalize ${tab === t ? 'border-b-2 text-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            style={tab === t ? { borderColor: primaryColor, color: primaryColor } : {}}
          >{t === 'late-fees' ? 'Late Fees' : t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* 6-month summary chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">6-Month Income vs. Expenses</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={overviewStats} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={50} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number, name: string) => [`$${v.toLocaleString()}`, name]} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <Bar dataKey="income" name="Income" fill={primaryColor} radius={[4, 4, 0, 0]} opacity={0.9} />
                <Bar dataKey="expense" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* NOI by property */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">NOI by Property</h3>
            <div className="space-y-3">
              {noiByProperty.map(({ property: p, income, expenses, noi }) => {
                const noiPct = income > 0 ? Math.round((noi / income) * 100) : 0
                return (
                  <div key={p.id} className="flex items-center gap-4">
                    <div className="w-36 shrink-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.city}</p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span className="text-green-600 font-medium">↑ ${income.toLocaleString()}</span>
                        <span className="text-red-500">↓ ${expenses.toLocaleString()}</span>
                        <span className={`font-bold ${noi >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>NOI ${noi.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${noi >= 0 ? 'bg-emerald-500' : 'bg-red-400'}`} style={{ width: `${Math.max(5, Math.min(100, income > 0 ? (noi / income) * 100 : 0))}%` }} />
                      </div>
                    </div>
                    <div className="w-12 text-right shrink-0">
                      <p className={`text-sm font-bold ${noiPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{noiPct}%</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Expense breakdown by category */}
          {expensesByCategory.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Expense Breakdown</h3>
              <div className="space-y-2.5">
                {expensesByCategory.map(([cat, total]) => {
                  const catMeta = EXPENSE_CATEGORIES.find(c => c.value === cat)
                  const totalExpense = expensesByCategory.reduce((s, [, v]) => s + v, 0)
                  const pct = totalExpense > 0 ? Math.round((total / totalExpense) * 100) : 0
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-24 text-center shrink-0 ${catMeta?.color ?? 'bg-gray-100 text-gray-600'}`}>{catMeta?.label ?? cat}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-bold text-gray-700 w-20 text-right">${total.toLocaleString()}</span>
                      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* EXPENSES */}
      {tab === 'expenses' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3">
            <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none">
              {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={propFilter} onChange={e => setPropFilter(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none">
              <option value="all">All properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {filtered.filter(e => e.amount < 0).length === 0 ? (
              <div className="text-center py-12">
                <TrendingDown className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No expenses recorded{monthFilter !== 'all' ? ' for this period' : ''}</p>
                <button onClick={() => setShowExpenseModal(true)} className="mt-3 text-xs font-bold text-white px-4 py-2 rounded-xl" style={{ background: primaryColor }}>
                  Record First Expense
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>{['Date','Property','Category','Description','Amount'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.filter(e => e.amount < 0).map(e => {
                    const propName = properties.find(p => p.id === e.propertyId)?.name ?? '—'
                    const catMatch = e.description?.match(/^\[([^\]]+)\]/)
                    const cat = catMatch?.[1] ?? 'other'
                    const desc = e.description?.replace(/^\[[^\]]+\]\s*/, '') || '—'
                    const catMeta = EXPENSE_CATEGORIES.find(c => c.value === cat)
                    return (
                      <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td className="px-4 py-3 text-gray-700">{propName}</td>
                        <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${catMeta?.color ?? 'bg-gray-100 text-gray-600'}`}>{catMeta?.label ?? cat}</span></td>
                        <td className="px-4 py-3 text-gray-600">{desc}</td>
                        <td className="px-4 py-3 font-semibold text-red-600">−${Math.abs(e.amount).toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-100">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Total</td>
                    <td className="px-4 py-3 font-bold text-red-600">
                      −${Math.abs(filtered.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0)).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}

      {/* AGING */}
      {tab === 'aging' && (
        <div className="space-y-5">
          {/* Summary chips */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: '1–30 Days', count: aging30.length, color: 'border-amber-200 bg-amber-50', text: 'text-amber-700', amount: aging30.reduce((s, x) => s + x.tenant.rent, 0) },
              { label: '31–60 Days', count: aging60.length, color: 'border-orange-200 bg-orange-50', text: 'text-orange-700', amount: aging60.reduce((s, x) => s + x.tenant.rent, 0) },
              { label: '60+ Days', count: aging90.length, color: 'border-red-200 bg-red-50', text: 'text-red-700', amount: aging90.reduce((s, x) => s + x.tenant.rent, 0) },
            ].map(b => (
              <div key={b.label} className={`rounded-xl border p-4 ${b.color}`}>
                <p className={`text-2xl font-black ${b.text}`}>{b.count}</p>
                <p className={`text-xs font-semibold ${b.text}`}>{b.label} Late</p>
                <p className={`text-xs mt-1 ${b.text} opacity-70`}>${b.amount.toLocaleString()} outstanding</p>
              </div>
            ))}
          </div>

          {agingData.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <CheckCircle className="w-8 h-8 text-green-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-500">No overdue rent this month</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>{['Tenant','Property','Unit','Monthly Rent','Days Late','Bucket'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {agingData.map(({ tenant: t, daysLate }) => {
                    const bucket = daysLate > 60 ? { label: '60+ days', color: 'bg-red-100 text-red-700' } : daysLate > 30 ? { label: '31–60 days', color: 'bg-orange-100 text-orange-700' } : { label: '1–30 days', color: 'bg-amber-100 text-amber-700' }
                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                        <td className="px-4 py-3 text-gray-600">{t.property}</td>
                        <td className="px-4 py-3 text-gray-600">{t.unit}</td>
                        <td className="px-4 py-3 font-semibold">${t.rent.toLocaleString()}</td>
                        <td className="px-4 py-3 font-bold text-red-600">{daysLate}d</td>
                        <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bucket.color}`}>{bucket.label}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* LATE FEES */}
      {tab === 'late-fees' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {lateFeeEntries.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No late fees recorded yet</p>
                <p className="text-xs text-gray-400 mt-1">Add late fees from the tenant profile → Payments tab</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>{['Date','Tenant','Description','Amount'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lateFeeEntries.map(e => {
                    const t = tenants.find(x => x.id === e.tenantId)
                    return (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500">{new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{t?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{e.description}</td>
                        <td className="px-4 py-3 font-bold text-orange-600">+${e.amount.toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-100">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Total Collected</td>
                    <td className="px-4 py-3 font-bold text-orange-600">+${totalLateFees.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}

      {showExpenseModal && (
        <ExpenseEntryModal
          properties={properties}
          onClose={() => setShowExpenseModal(false)}
          onSaved={(entry) => { setEntries(prev => [entry, ...prev]); setShowExpenseModal(false) }}
        />
      )}
    </div>
  )
}

// ─── All Units Panel ──────────────────────────────────────────────────────────

function AllUnitsPanel({ properties, tenants, setActivePanel }: { properties: Property[]; tenants: Tenant[]; setActivePanel: (p: string) => void }) {
  const [search, setSearch] = useState('')
  const units = properties.flatMap(p =>
    Array.from({ length: p.units }, (_, i) => {
      const unitNum = `Unit ${i + 1}`
      const tenant = tenants.find(t => t.property === p.name && t.unit === unitNum)
      return { propertyId: p.id, propertyName: p.name, unitNum, tenant }
    })
  ).filter(u =>
    !search ||
    u.unitNum.toLowerCase().includes(search.toLowerCase()) ||
    u.propertyName.toLowerCase().includes(search.toLowerCase()) ||
    (u.tenant?.name ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const vacant = units.filter(u => !u.tenant).length
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search units…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300" />
        </div>
        <span className="text-xs text-gray-500">{units.length} units · {vacant} vacant</span>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Property', 'Unit', 'Tenant', 'Rent', 'Lease End', 'Status'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {units.map((u, i) => (
              <tr key={i} className="hover:bg-gray-50 cursor-pointer" onClick={() => setActivePanel('properties')}>
                <td className="px-3 py-2 text-xs font-medium text-gray-700">{u.propertyName}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{u.unitNum}</td>
                <td className="px-3 py-2 text-xs text-gray-800">{u.tenant?.name ?? <span className="text-gray-400 italic">Vacant</span>}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{u.tenant ? `$${u.tenant.rent.toLocaleString()}` : '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{u.tenant?.leaseEnd ?? '—'}</td>
                <td className="px-3 py-2">
                  {u.tenant ? (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${u.tenant.status === 'active' ? 'bg-green-100 text-green-700' : u.tenant.status === 'notice' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.tenant.status}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">vacant</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {units.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No units match your search</div>
        )}
      </div>
    </div>
  )
}

// ─── All Leases Panel ─────────────────────────────────────────────────────────

function AllLeasesPanel({ tenants, setActivePanel }: { tenants: Tenant[]; setActivePanel: (p: string) => void }) {
  const [search, setSearch] = useState('')
  const now = new Date()
  const active = tenants
    .filter(t => t.status !== 'past' && t.status !== 'invited')
    .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.property.toLowerCase().includes(search.toLowerCase()))
    .map(t => {
      const daysLeft = t.leaseEnd ? Math.ceil((new Date(t.leaseEnd).getTime() - now.getTime()) / 86400000) : null
      return { ...t, daysLeft }
    })
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leases…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300" />
        </div>
        <span className="text-xs text-gray-500">{active.length} active leases</span>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Tenant', 'Property', 'Unit', 'Rent/mo', 'Move In', 'Lease End', 'Days Left', 'Status'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {active.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setActivePanel('tenants')}>
                <td className="px-3 py-2 text-xs font-semibold text-gray-800">{t.name}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{t.property}</td>
                <td className="px-3 py-2 text-xs text-gray-600">{t.unit}</td>
                <td className="px-3 py-2 text-xs text-gray-700">${t.rent.toLocaleString()}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{t.moveIn || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-500">{t.leaseEnd || 'M-t-M'}</td>
                <td className="px-3 py-2 text-xs">
                  {t.daysLeft !== null ? (
                    <span className={`font-bold ${t.daysLeft <= 14 ? 'text-red-600' : t.daysLeft <= 30 ? 'text-orange-600' : t.daysLeft <= 60 ? 'text-amber-600' : 'text-gray-500'}`}>
                      {t.daysLeft}d
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.status === 'active' ? 'bg-green-100 text-green-700' : t.status === 'notice' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {active.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No leases match your search</div>
        )}
      </div>
    </div>
  )
}

// ─── Analytics Panel ─────────────────────────────────────────────────────────

interface AnalyticsPanelProps {
  initialSection?: string
  rentRecords?: RentRecord[]
  tenants?: Tenant[]
  properties?: Property[]
  tickets?: MaintenanceTicket[]
  onViewTenant?: (tenantId: string) => void
}

function AnalyticsPanel({ initialSection = 'overview', rentRecords = [], tenants = [], properties = [], tickets = [], activityFeed = [], onViewTenant }: AnalyticsPanelProps & { activityFeed?: { id: string; type: string; text: string; time: string }[] }) {
  const [subSection, setSubSection] = useState<'overview' | 'occupancy' | 'revenue' | 'maintenance' | 'rentroll' | 'cashflow'>(
    (initialSection as 'overview' | 'occupancy' | 'revenue' | 'maintenance' | 'rentroll' | 'cashflow') || 'overview'
  )
  const [selectedPropId, setSelectedPropId] = useState<string>('all')

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'occupancy', label: 'Occupancy' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'rentroll', label: 'Rent Roll' },
    { id: 'cashflow', label: 'Cash Flow' },
    { id: 'maintenance', label: 'Maintenance' },
  ] as const

  // ─── Property filter ──────────────────────────────────────────────────────
  const selectedPropName = selectedPropId === 'all' ? null : properties.find(p => p.id === selectedPropId)?.name
  const fp = selectedPropId === 'all' ? properties : properties.filter(p => p.id === selectedPropId)
  const ft = selectedPropId === 'all' ? tenants : tenants.filter(t => t.property === selectedPropName)
  const fk = selectedPropId === 'all' ? tickets : tickets.filter(t => t.property === selectedPropName)
  const fr = selectedPropId === 'all' ? rentRecords : rentRecords.filter(r => ft.some(t => t.id === r.tenantId))

  // ─── Computed from real data ──────────────────────────────────────────────
  const totalUnits = fp.reduce((s, p) => s + p.units, 0)
  const totalOccupied = fp.reduce((s, p) => s + p.occupied, 0)
  const totalMonthlyRevenue = fp.reduce((s, p) => s + p.monthlyIncome, 0)
  const occupancyPct = totalUnits > 0 ? ((totalOccupied / totalUnits) * 100).toFixed(1) : '0'

  const occupancyByProperty = fp.map(p => ({
    property: p.name,
    units: p.units,
    occupied: p.occupied,
    pct: p.units > 0 ? Math.round((p.occupied / p.units) * 100) : 0,
  }))

  // Revenue by month from rent records
  const revenueByMonth: Record<string, number> = {}
  fr.filter(r => r.status !== 'pending').forEach(r => {
    const short = r.month.replace(/\s+\d{4}$/, '').slice(0, 3)
    revenueByMonth[short] = (revenueByMonth[short] ?? 0) + r.amount
  })
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const computedRevenueData = MONTHS.filter(m => revenueByMonth[m] !== undefined).map(m => ({
    month: m, revenue: revenueByMonth[m], expenses: Math.round(revenueByMonth[m] * 0.15),
  }))
  const chartRevenueData = computedRevenueData.length > 0 ? computedRevenueData : (properties.length > 0 ? [] : revenueData)

  const ytdRevenue = chartRevenueData.reduce((s, d) => s + d.revenue, 0)
  const totalExpenses = chartRevenueData.reduce((s, d) => s + d.expenses, 0)
  const noi = ytdRevenue - totalExpenses

  // Occupancy trend: use current rate for months with rent data; bar chart of per-property when no history
  const currentRate = totalUnits > 0 ? parseFloat(occupancyPct) : 0
  const computedOccupancyData = MONTHS
    .filter(m => revenueByMonth[m] !== undefined)
    .map(m => ({ month: m, rate: currentRate }))
  const chartOccupancyData = computedOccupancyData.length > 0 ? computedOccupancyData
    : fp.length > 0 ? [{ month: new Date().toLocaleString('en-US', { month: 'short' }), rate: currentRate }]
    : occupancyData

  // Tickets by category from real data
  const ticketCategoryMap: Record<string, number> = {}
  fk.forEach(t => { ticketCategoryMap[t.category] = (ticketCategoryMap[t.category] ?? 0) + 1 })
  const TICKET_COLORS = ['#2563EB', '#7C3AED', '#EA580C', '#16A34A', '#6B7280']
  const computedTicketsByType = Object.entries(ticketCategoryMap).map(([name, value], i) => ({ name, value, fill: TICKET_COLORS[i % TICKET_COLORS.length] }))
  const resolvedTicketsByType = computedTicketsByType.length > 0 ? computedTicketsByType : (tickets.length > 0 ? [] : ticketsByType)

  // Tickets by month from real data
  const ticketMonthMap: Record<string, number> = {}
  fk.forEach(t => {
    const short = t.createdAt.slice(0, 3)
    ticketMonthMap[short] = (ticketMonthMap[short] ?? 0) + 1
  })
  const computedTicketsByMonth = MONTHS.filter(m => ticketMonthMap[m] !== undefined).map(m => ({ month: m, count: ticketMonthMap[m] }))
  const resolvedTicketsByMonth = computedTicketsByMonth.length > 0 ? computedTicketsByMonth : (tickets.length > 0 ? [] : ticketsByMonth)

  // Highest maintenance units from real data
  const unitTicketMap: Record<string, number> = {}
  fk.forEach(t => { if (t.unit) unitTicketMap[t.unit] = (unitTicketMap[t.unit] ?? 0) + 1 })
  const computedHighestUnits = Object.entries(unitTicketMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([unit, count]) => ({ unit, count }))
  const highestUnits = computedHighestUnits.length > 0 ? computedHighestUnits : (tickets.length > 0 ? [] : [
    { unit: 'Unit 4B', count: 3 }, { unit: 'Unit 2A', count: 2 }, { unit: 'Unit 3A', count: 2 },
  ])

  // Maintenance stats from real data
  const totalTickets = fk.length
  const openTickets = fk.filter(t => t.status === 'open' || t.status === 'in_progress').length
  const resolvedTickets = fk.filter(t => t.status === 'resolved')
  const avgResolutionDays = resolvedTickets.length > 0
    ? (resolvedTickets.reduce((s, t) => {
        const ms = new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()
        return s + ms / (1000 * 60 * 60 * 24)
      }, 0) / resolvedTickets.length).toFixed(1)
    : null
  const costThisMonth = fk.filter(t => {
    const d = new Date(t.createdAt)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((s, t) => s + (t.cost ?? 0), 0)

  const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const rentRollData = ft.map(t => {
    const pmt = fr.find(r => r.tenantId === t.id && r.month === currentMonth)
    return { ...t, junePaid: !!pmt, juneStatus: pmt?.status ?? 'unpaid', datePaid: pmt?.datePaid ?? null, method: pmt?.method ?? null }
  })

  const cashFlowData = chartRevenueData.map(d => ({
    month: d.month,
    income: d.revenue,
    mortgage: Math.round(d.revenue * 0.45),
    maintenance: Math.round(d.expenses * 0.7),
    insurance: Math.round(d.revenue * 0.03),
    tax: Math.round(d.revenue * 0.02),
    mgmt: Math.round(d.revenue * 0.01),
    net: d.revenue - Math.round(d.revenue * 0.45) - d.expenses,
  }))

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Analytics</h2>
        <p className="text-xs text-gray-500">Portfolio performance overview</p>
      </div>

      {/* Sub-nav tabs + property selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setSubSection(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${subSection === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {properties.length > 1 && (
          <select
            value={selectedPropId}
            onChange={e => setSelectedPropId(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Properties</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* Overview */}
      {subSection === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Units', value: String(totalUnits || '—'), color: 'text-blue-600 bg-blue-50', icon: <Home className="w-5 h-5" /> },
              { label: 'Occupied', value: totalUnits ? `${totalOccupied}/${totalUnits}` : '—', color: 'text-green-600 bg-green-50', icon: <Users className="w-5 h-5" /> },
              { label: 'Occupancy Rate', value: totalUnits ? `${occupancyPct}%` : '—', color: 'text-purple-600 bg-purple-50', icon: <TrendingUp className="w-5 h-5" /> },
              { label: 'Monthly Revenue', value: totalMonthlyRevenue ? `$${totalMonthlyRevenue.toLocaleString()}` : '—', color: 'text-emerald-600 bg-emerald-50', icon: <DollarSign className="w-5 h-5" /> },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{k.label}</p>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.color}`}>{k.icon}</div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{k.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Occupancy Trend (6 months)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartOccupancyData}>
                  <defs>
                    <linearGradient id="occGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[75, 100]} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip formatter={(v) => [`${v}%`, 'Occupancy']} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                  <Area type="monotone" dataKey="rate" stroke="#2563EB" strokeWidth={2} fill="url(#occGrad2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {activityFeed.slice(0, 5).map((a) => (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      a.type === 'payment' ? 'bg-green-100 text-green-600' :
                      a.type === 'ticket' ? 'bg-amber-100 text-amber-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {a.type === 'payment' ? <DollarSign className="w-3.5 h-3.5" /> :
                       a.type === 'ticket' ? <Wrench className="w-3.5 h-3.5" /> :
                       <FileText className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{a.text}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Occupancy */}
      {subSection === 'occupancy' && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Overall Occupancy', value: totalUnits ? `${occupancyPct}%` : '—', sub: `${totalOccupied} of ${totalUnits} units` },
              { label: 'Vacant Units', value: String(totalUnits - totalOccupied), sub: `${properties.length} propert${properties.length !== 1 ? 'ies' : 'y'}` },
              { label: 'Total Monthly Revenue', value: totalMonthlyRevenue ? `$${totalMonthlyRevenue.toLocaleString()}` : '—', sub: 'across all properties' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{k.label}</p>
                <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Occupancy Trend (6 months)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartOccupancyData}>
                <defs>
                  <linearGradient id="occGrad3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis domain={[70, 100]} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, 'Occupancy']} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <Area type="monotone" dataKey="rate" stroke="#2563EB" strokeWidth={2} fill="url(#occGrad3)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Occupancy by Property</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Property', 'Units', 'Occupied', 'Vacant', 'Rate'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {occupancyByProperty.map(p => (
                  <tr key={p.property} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{p.property}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">{p.units}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">{p.occupied}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">{p.units - p.occupied}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.pct === 100 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {p.pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revenue */}
      {subSection === 'revenue' && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'YTD Revenue', value: `$${ytdRevenue.toLocaleString()}`, color: 'text-blue-600' },
              { label: 'Total Expenses', value: `$${totalExpenses.toLocaleString()}`, color: 'text-red-500' },
              { label: 'Net Operating Income', value: `$${noi.toLocaleString()}`, color: 'text-green-600' },
              { label: 'NOI Margin', value: `${ytdRevenue > 0 ? Math.round((noi / ytdRevenue) * 100) : 0}%`, color: 'text-emerald-600' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{c.label}</p>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly Revenue vs Expenses</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartRevenueData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, '']} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#2563EB" radius={[4,4,0,0]} name="Revenue" />
                <Bar dataKey="expenses" fill="#E5E7EB" radius={[4,4,0,0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Revenue by Property</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Property', 'Units', 'Occupied', 'Monthly Income', 'Per Unit'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fp.length > 0 ? fp.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">{p.units}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">{p.occupied}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-green-600">${p.monthlyIncome.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{p.occupied > 0 ? `$${Math.round(p.monthlyIncome / p.occupied).toLocaleString()}` : '—'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="px-5 py-6 text-sm text-center text-gray-400">No properties yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Maintenance */}
      {subSection === 'maintenance' && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total (All Time)', value: String(totalTickets || 0), color: 'text-blue-600 bg-blue-50', icon: <BarChart2 className="w-4 h-4" /> },
              { label: 'Open / In Progress', value: String(openTickets), color: 'text-amber-600 bg-amber-50', icon: <Wrench className="w-4 h-4" /> },
              { label: 'Avg Resolution', value: avgResolutionDays ? `${avgResolutionDays}d` : '—', color: 'text-green-600 bg-green-50', icon: <TrendingUp className="w-4 h-4" /> },
              { label: 'Cost This Month', value: costThisMonth > 0 ? `$${costThisMonth.toLocaleString()}` : '—', color: 'text-purple-600 bg-purple-50', icon: <DollarSign className="w-4 h-4" /> },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${k.color}`}>{k.icon}</div>
                <div>
                  <p className="text-xs text-gray-500">{k.label}</p>
                  <p className="text-xl font-bold text-gray-900">{k.value}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Tickets by Month</h4>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={resolvedTicketsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                  <Bar dataKey="count" fill="#2563EB" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">By Issue Type</h4>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={resolvedTicketsByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                    {resolvedTicketsByType.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Highest Maintenance Units</h4>
              <div className="space-y-2">
                {highestUnits.map((u, i) => (
                  <div key={u.unit} className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${i === 0 ? 'bg-amber-50' : ''}`}>
                    <span className={`text-sm font-medium ${i === 0 ? 'text-amber-700' : 'text-gray-700'}`}>{u.unit}</span>
                    <span className={`text-xs font-bold ${i === 0 ? 'text-amber-600' : 'text-gray-500'}`}>{u.count} ticket{u.count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rent Roll */}
      {subSection === 'rentroll' && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Monthly Rent', value: `$${rentRollData.reduce((s, t) => s + t.rent, 0).toLocaleString()}`, color: 'text-blue-600' },
              { label: 'Collected (June)', value: `$${rentRollData.filter(t => t.junePaid).reduce((s, t) => s + t.rent, 0).toLocaleString()}`, color: 'text-green-600' },
              { label: 'Outstanding', value: `$${rentRollData.filter(t => !t.junePaid).reduce((s, t) => s + t.rent, 0).toLocaleString()}`, color: rentRollData.some(t => !t.junePaid) ? 'text-red-600' : 'text-gray-400' },
              { label: 'Collection Rate', value: `${Math.round((rentRollData.filter(t => t.junePaid).length / (rentRollData.length || 1)) * 100)}%`, color: 'text-emerald-600' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Rent Roll — {currentMonth}</h3>
              <span className="text-xs text-gray-500">{rentRollData.filter(t => t.junePaid).length}/{rentRollData.length} collected</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Tenant', 'Unit', 'Property', 'Rent', 'Status', 'Date Paid', 'Method'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rentRollData.map(t => (
                  <tr key={t.id} className={`border-b border-gray-50 hover:bg-gray-50 ${!t.junePaid ? 'bg-red-50/30' : ''}`}>
                    <td className="px-5 py-3">
                      {onViewTenant
                        ? <button onClick={() => onViewTenant(t.id)} className="text-sm font-medium text-blue-600 hover:underline text-left">{t.name}</button>
                        : <span className="text-sm font-medium text-gray-900">{t.name}</span>
                      }
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{t.unit}</td>
                    <td className="px-5 py-3 text-sm text-gray-600 max-w-[120px] truncate">{t.property}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-gray-900">${t.rent.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${t.junePaid ? (t.juneStatus === 'late' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700') : 'bg-red-100 text-red-700'}`}>
                        {t.junePaid ? (t.juneStatus === 'late' ? 'Late' : 'Paid') : 'Unpaid'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{t.datePaid ?? '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{t.method ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cash Flow */}
      {subSection === 'cashflow' && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'YTD Gross Income', value: `$${cashFlowData.reduce((s, d) => s + d.income, 0).toLocaleString()}`, color: 'text-blue-600' },
              { label: 'YTD Expenses', value: `$${cashFlowData.reduce((s, d) => s + d.mortgage + d.maintenance + d.insurance + d.tax + d.mgmt, 0).toLocaleString()}`, color: 'text-red-500' },
              { label: 'YTD Net Cash Flow', value: `$${cashFlowData.reduce((s, d) => s + d.net, 0).toLocaleString()}`, color: 'text-green-600' },
              { label: 'Cash-on-Cash Return', value: '8.4%', color: 'text-emerald-600' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly Net Cash Flow</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(1)}k`} />
                <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, '']} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <Bar dataKey="net" fill="#10B981" radius={[4,4,0,0]} name="Net Cash Flow" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Monthly Cash Flow Breakdown</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Month', 'Income', 'Mortgage', 'Maintenance', 'Insurance', 'Tax', 'Mgmt Fee', 'Net'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cashFlowData.map(d => (
                  <tr key={d.month} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{d.month}</td>
                    <td className="px-4 py-2.5 text-green-600 font-semibold">${d.income.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-red-500">${d.mortgage.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-red-400">${d.maintenance.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-red-400">${d.insurance}</td>
                    <td className="px-4 py-2.5 text-red-400">${d.tax}</td>
                    <td className="px-4 py-2.5 text-red-400">${d.mgmt}</td>
                    <td className="px-4 py-2.5 font-bold text-emerald-600">${d.net.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Expense Breakdown (June 2026)</h3>
            <div className="grid grid-cols-2 gap-4">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={[
                    { name: 'Mortgage', value: 6500, fill: '#3B82F6' },
                    { name: 'Maintenance', value: 425, fill: '#F59E0B' },
                    { name: 'Insurance', value: 420, fill: '#8B5CF6' },
                    { name: 'Tax', value: 290, fill: '#10B981' },
                    { name: 'Mgmt Fee', value: 144, fill: '#6B7280' },
                  ]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                    {[{ fill: '#3B82F6' }, { fill: '#F59E0B' }, { fill: '#8B5CF6' }, { fill: '#10B981' }, { fill: '#6B7280' }].map((e, i) => (
                      <Cell key={i} fill={e.fill} />
                    ))}
                  </Pie>
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex flex-col justify-center">
                {[
                  { label: 'Mortgage', amount: 6500, color: 'bg-blue-500' },
                  { label: 'Maintenance', amount: 425, color: 'bg-amber-500' },
                  { label: 'Insurance', amount: 420, color: 'bg-purple-500' },
                  { label: 'Tax', amount: 290, color: 'bg-green-500' },
                  { label: 'Mgmt Fee', amount: 144, color: 'bg-gray-500' },
                ].map(e => (
                  <div key={e.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${e.color}`} />
                      <span className="text-sm text-gray-700">{e.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">${e.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Bug Report Modal ─────────────────────────────────────────────────────────

function BugReportModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    category: '',
    subject: '',
    description: '',
    steps: '',
    severity: 'Medium',
  })

  function handleSubmit() {
    if (!form.subject.trim() || !form.description.trim()) {
      showToast({ type: 'error', title: 'Please fill in Subject and Description' })
      return
    }
    showToast({ type: 'success', title: 'Bug report submitted — thank you!' })
    onClose()
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Report a Bug</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Select category…</option>
              {['UI/UX Bug', 'Data Issue', 'Performance', 'Feature Request', 'Other'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Subject *</label>
            <input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}
              placeholder="Brief description of the issue"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description *</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              rows={4} placeholder="Describe what happened and what you expected to happen…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Steps to Reproduce</label>
            <textarea value={form.steps} onChange={e => setForm({...form, steps: e.target.value})}
              rows={3} placeholder="1. Click on...\n2. Then..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Severity</label>
            <div className="flex gap-2">
              {['Low', 'Medium', 'High', 'Critical'].map(s => (
                <button key={s} onClick={() => setForm({...form, severity: s})}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${form.severity === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={handleSubmit} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Submit Report</button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

function useLocalState<T>(key: string, def: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s !== null ? JSON.parse(s) : def } catch { return def }
  })
  function set(v: T) { setVal(v); try { localStorage.setItem(key, JSON.stringify(v)) } catch {} }
  return [val, set]
}

export default function AdminPortal() {
  const navigate = useNavigate()
  const [activePanel, setActivePanel] = useLocalState('bmp_admin_panel', 'dashboard')
  const [sidebarOpen, setSidebarOpen] = useLocalState('bmp_admin_sidebar', true)
  const [analyticsSection, setAnalyticsSection] = useState('overview')
  const [showBugModal, setShowBugModal] = useState(false)

  // Auth
  const { user, signOut } = useAuth()
  const { demoMode, setDemoMode } = useDemoMode()
  const { companyName, primaryColor } = useBranding()

  // Supabase data hooks
  const { data: tenantsData, loading: tenantsLoading } = useTenants()
  const { data: propertiesData, loading: propertiesLoading } = useProperties()
  const { data: ticketsData, loading: ticketsLoading } = useMaintenanceTickets()
  const { data: rentRecordsData, refetch: refetchRentRecords } = useRentRecords()
  const { data: threadsData, loading: threadsLoading } = useThreads()

  // Shared state lifted to root
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([])
  const [propertiesList, setPropertiesList] = useState<Property[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)

  useEffect(() => { if (!tenantsLoading) setTenants(tenantsData) }, [tenantsData, tenantsLoading])
  useEffect(() => { if (!propertiesLoading) setPropertiesList(propertiesData) }, [propertiesData, propertiesLoading])
  useEffect(() => { if (!ticketsLoading) setTickets(ticketsData) }, [ticketsData, ticketsLoading])
  useEffect(() => { if (!threadsLoading) setThreads(threadsData) }, [threadsData, threadsLoading])

  // Profile state (from auth + profiles table)
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileCompany, setProfileCompany] = useState('')
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  useEffect(() => {
    if (!user) return
    setProfileName(user.user_metadata?.full_name || user.email || 'Admin')
    setProfileEmail(user.email || '')
    setProfilePhoto(user.user_metadata?.avatar_url || null)
    supabase.from('profiles')
      .select('full_name, company, phone, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        if (data.full_name) setProfileName(data.full_name as string)
        if (data.company) setProfileCompany(data.company as string)
        if (data.avatar_url) setProfilePhoto(data.avatar_url as string)
      })
  }, [user])

  // Command palette + global search
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const globalSearchRef = useRef<HTMLInputElement>(null)

  // Profile dropdown state
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)

  // Property manage state
  const [managePropertyId, setManagePropertyId] = useState<string | null>(null)

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showAddPropertyModal, setShowAddPropertyModal] = useState(false)
  const [showNewTicketModal, setShowNewTicketModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [showNewThreadModal, setShowNewThreadModal] = useState(false)
  const [maintenanceSubTab, setMaintenanceSubTab] = useState<'tickets' | 'inspections'>('tickets')

  // Tenant modals
  const [editTenantId, setEditTenantId] = useState<string | null>(null)
  const [viewTenantId, setViewTenantId] = useState<string | null>(null)

  // Rent records + payment logging
  const [rentRecords, setRentRecords] = useState<RentRecord[]>([])
  const [logPaymentTenantId, setLogPaymentTenantId] = useState<string | null>(null)
  useEffect(() => { if (rentRecordsData.length) setRentRecords(rentRecordsData) }, [rentRecordsData])

  // Reactive activity feed
  type ActivityEntry = { id: string; type: 'payment' | 'ticket' | 'tenant' | 'announcement' | 'lease'; text: string; time: string }
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([])
  useEffect(() => {
    if (demoMode) {
      setRecentActivity(mockActivityFeed.map(a => ({ id: a.id, type: a.type as ActivityEntry['type'], text: a.text, time: a.time })))
      return
    }
    supabase.from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setRecentActivity(data.map((a) => ({
          id: a.id,
          type: a.type as ActivityEntry['type'],
          text: a.text,
          time: new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        })))
      })
  }, [demoMode])
  async function addActivity(entry: Omit<ActivityEntry, 'id' | 'time'>) {
    setRecentActivity(prev => [{ ...entry, id: `act-${Date.now()}`, time: 'Just now' }, ...prev].slice(0, 20))
    await supabase.from('activity_log').insert({ type: entry.type, text: entry.text, admin_id: user?.id })
  }

  // Focused maintenance ticket (from property tickets modal)
  const [focusedMaintenanceTicketId, setFocusedMaintenanceTicketId] = useState<string | null>(null)

  async function confirmPayment(recordId: string) {
    if (demoMode) { showToast({ type: 'info', title: 'Demo mode — no changes saved' }); return }
    const record = rentRecords.find(r => r.id === recordId)
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('rent_payments')
      .update({ status: 'paid', paid_date: today })
      .eq('id', recordId)
    if (error) { showToast({ type: 'error', title: 'Failed to confirm payment', body: error.message }); return }
    setRentRecords(prev => prev.map(r => r.id === recordId ? { ...r, status: 'paid' as const, datePaid: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } : r))
    if (record) {
      notifyUser(record.tenantId, {
        type: 'payment',
        title: 'Payment confirmed',
        body: `Your ${record.month} rent payment of $${record.amount.toLocaleString()} has been confirmed by your property manager.`,
        link: '/tenant',
      })
    }
    showToast({ type: 'success', title: 'Payment confirmed' })
  }

  // Profile-menu outside-click ref
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) setShowProfileMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    let gPressed = false
    let gTimer: ReturnType<typeof setTimeout>
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable
      if (e.key === '/' && !inInput) { e.preventDefault(); globalSearchRef.current?.focus(); return }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowCommandPalette(true); return }
      if (e.key === 'Escape') { setShowCommandPalette(false); globalSearchRef.current?.blur(); return }
      if (inInput) return
      if (e.key === 'g') {
        gPressed = true
        clearTimeout(gTimer)
        gTimer = setTimeout(() => { gPressed = false }, 800)
        return
      }
      if (gPressed) {
        gPressed = false
        clearTimeout(gTimer)
        const map: Record<string, string> = { d: 'dashboard', p: 'properties', t: 'tenants', m: 'maintenance', l: 'payments', r: 'reports' }
        if (map[e.key]) { e.preventDefault(); setActivePanel(map[e.key]) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(gTimer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Badge counts
  const unreadMessages = threads.reduce((s, t) => s + t.unread, 0)
  const openTicketCount = tickets.filter((t) => t.status !== 'resolved').length

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'properties', label: 'Properties', icon: <Building2 className="w-5 h-5" /> },
    { id: 'units', label: 'Units', icon: <Home className="w-5 h-5" /> },
    { id: 'tenants', label: 'Tenants', icon: <Users className="w-5 h-5" /> },
    { id: 'leases', label: 'Leases', icon: <ClipboardList className="w-5 h-5" /> },
    { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="w-5 h-5" />, badge: openTicketCount },
    { id: 'payments', label: 'Payments', icon: <Landmark className="w-5 h-5" /> },
    { id: 'reports', label: 'Reports', icon: <BarChart2 className="w-5 h-5" /> },
    { id: 'messages', label: 'Messages', icon: <MessageSquare className="w-5 h-5" />, badge: unreadMessages },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-5 h-5" /> },
  ]

  function renderPanel() {
    switch (activePanel) {
      case 'dashboard':
        return (
          <DashboardPanel
            setActivePanel={setActivePanel}
            onShowInviteModal={() => setShowInviteModal(true)}
            onShowAddPropertyModal={() => setShowAddPropertyModal(true)}
            onShowAnnouncementModal={() => setShowAnnouncementModal(true)}
            tickets={tickets}
            tenants={tenants}
            properties={propertiesList}
            rentRecords={rentRecords}
            recentActivity={recentActivity}
          />
        )
      case 'ledger':
      case 'payments':
        return <LedgerPanel tenants={tenants} properties={propertiesList} rentRecords={rentRecords} />
      case 'analytics':
      case 'reports':
        return <AnalyticsPanel initialSection={analyticsSection} rentRecords={rentRecords} tenants={tenants} properties={propertiesList} tickets={tickets} activityFeed={recentActivity} onViewTenant={(id) => setViewTenantId(id)} />
      case 'units':
        return <AllUnitsPanel properties={propertiesList} tenants={tenants} setActivePanel={setActivePanel} />
      case 'leases':
        return <AllLeasesPanel tenants={tenants} setActivePanel={setActivePanel} />
      case 'properties':
        return (
          <PropertiesPanel
            properties={propertiesList}
            tenants={tenants}
            tickets={tickets}
            onShowAddPropertyModal={() => setShowAddPropertyModal(true)}
            onManageProperty={(id) => setManagePropertyId(id)}
            setActivePanel={setActivePanel}
            onViewTicket={(ticketId) => {
              setFocusedMaintenanceTicketId(ticketId)
              setActivePanel('maintenance')
            }}
            onViewTenant={(id) => setViewTenantId(id)}
          />
        )
      case 'tenants':
        return (
          <TenantsPanel
            tenants={tenants}
            setTenants={setTenants}
            threads={threads}
            setThreads={setThreads}
            setActivePanel={setActivePanel}
            setSelectedThreadId={setSelectedThreadId}
            onShowInviteModal={() => setShowInviteModal(true)}
            onEditTenant={(id) => setEditTenantId(id)}
            onViewTenant={(id) => setViewTenantId(id)}
            rentRecords={rentRecords}
            onLogPayment={(tenantId) => setLogPaymentTenantId(tenantId)}
            properties={propertiesList}
          />
        )
      case 'maintenance':
        return (
          <MaintenancePanel
            tickets={tickets}
            setTickets={setTickets}
            onShowNewTicketModal={() => setShowNewTicketModal(true)}
            focusedTicketId={focusedMaintenanceTicketId}
            onClearFocus={() => setFocusedMaintenanceTicketId(null)}
            addActivity={addActivity}
            onViewTenant={(id) => setViewTenantId(id)}
            properties={propertiesList}
            initialSubTab={maintenanceSubTab}
          />
        )
      case 'messages':
        return (
          <MessagesPanel
            threads={threads}
            setThreads={setThreads}
            selectedThreadId={selectedThreadId}
            setSelectedThreadId={setSelectedThreadId}
            onNewThread={() => setShowNewThreadModal(true)}
            tenants={tenants}
            onViewTenantProfile={(tenantId) => setViewTenantId(tenantId)}
          />
        )
      case 'documents': return <DocumentsPanel onViewTenant={(id) => setViewTenantId(id)} tenants={tenants} properties={propertiesList} />
      case 'settings':
        return (
          <SettingsPanel
            profileName={profileName}
            setProfileName={setProfileName}
            profilePhoto={profilePhoto}
            setProfilePhoto={setProfilePhoto}
          />
        )
      default: return null
    }
  }

  const panelNeedsFullHeight = activePanel === 'messages' || activePanel === 'settings'

  return (
    <NotificationsProvider>
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div
        className="flex flex-col shrink-0 overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          width: sidebarOpen ? 256 : 68,
          background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo / Brand */}
        <div className={`flex items-center gap-3 py-5 ${sidebarOpen ? 'px-4' : 'justify-center px-0'}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <BrandLogo wrapperClassName="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg overflow-hidden" iconClassName="w-4.5 h-4.5 text-white" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)' }} />
          <div className={`transition-all duration-300 overflow-hidden ${sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>
            <p className="text-white font-bold text-sm whitespace-nowrap tracking-tight">{companyName}</p>
            <p className="text-slate-500 text-[11px] whitespace-nowrap font-medium tracking-wide uppercase">Admin Portal</p>
          </div>
        </div>

        {/* Nav section label */}
        {sidebarOpen && (
          <p className="px-4 pt-5 pb-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Main Menu</p>
        )}

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-0.5 mt-1">
          {navItems.map((item) => {
            const isActive = activePanel === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActivePanel(item.id)}
                title={!sidebarOpen ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
                  isActive
                    ? 'text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                } ${!sidebarOpen ? 'justify-center' : ''}`}
                style={isActive ? { background: primaryColor, boxShadow: `0 4px 12px ${primaryColor}59` } : {}}
              >
                <div className="shrink-0 relative">
                  {item.icon}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold px-0.5 shadow">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 overflow-hidden flex-1 text-left ${sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
                  {item.label}
                </span>
                {isActive && sidebarOpen && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="mx-4 my-3" style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />

        {/* Settings */}
        <div className="px-3 pb-2">
          <button
            onClick={() => setActivePanel('settings')}
            title={!sidebarOpen ? 'Settings' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
              activePanel === 'settings'
                ? 'text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            } ${!sidebarOpen ? 'justify-center' : ''}`}
            style={activePanel === 'settings' ? { background: primaryColor, boxShadow: `0 4px 12px ${primaryColor}59` } : {}}
          >
            <Settings className="w-5 h-5 shrink-0" />
            <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 overflow-hidden ${sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>Settings</span>
          </button>
        </div>

        {/* Profile row */}
        <div
          className={`mx-3 mb-1 rounded-xl p-3 flex items-center gap-3 ${!sidebarOpen ? 'justify-center' : ''}`}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {profilePhoto ? (
            <img src={profilePhoto} alt="Profile" className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-blue-500/40" />
          ) : (
            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-xs ring-2 ring-blue-500/40" style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}>
              {profileName.split(' ').map(w => w[0]).join('').slice(0, 2)}
            </div>
          )}
          {sidebarOpen && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white whitespace-nowrap truncate">{profileName}</p>
                <p className="text-[11px] text-slate-500 whitespace-nowrap">Administrator</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                title="Collapse"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Expand button when collapsed */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="mx-3 mb-3 rounded-xl h-8 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)' }}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-100 px-4 h-[54px] flex items-center gap-3 shrink-0">
          {/* Global search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              ref={globalSearchRef}
              onFocus={() => setShowCommandPalette(true)}
              readOnly
              placeholder="Search… Press / or ⌘K"
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300 cursor-pointer"
            />
          </div>
          {/* Cmd+K hint */}
          <button onClick={() => setShowCommandPalette(true)} className="hidden sm:flex items-center gap-1 px-2 py-1 border border-gray-200 rounded text-[10px] text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors shrink-0">
            <span>⌘K</span>
          </button>
          <div className="flex items-center gap-2">
            {/* Bug Report */}
            <button
              onClick={() => setShowBugModal(true)}
              className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors"
              title="Report a bug"
            >
              <HelpCircle className="w-4 h-4 text-gray-400" />
            </button>
            {/* Separator */}
            <div className="w-px h-5 bg-gray-200 mx-1" />
            {/* Bell */}
            <NotificationBell
              align="right"
              onItemClick={(n) => {
                if (n.type === 'maintenance') setActivePanel('maintenance')
                else if (n.type === 'payment') setActivePanel('dashboard')
                else if (n.type === 'lease') setActivePanel('tenants')
                else if (n.type === 'message') setActivePanel('messages')
              }}
            />

            {/* Profile button */}
            <div className="relative ml-1" ref={profileMenuRef}>
              <button
                onClick={() => { setShowProfileMenu(!showProfileMenu) }}
                className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
              >
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}>
                    {profileName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                )}
                <span className="text-xs font-semibold text-gray-700 max-w-[80px] truncate">{profileName.split(' ')[0]}</span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>
              {showProfileMenu && (
                <div className="absolute top-full right-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 animate-fade-in overflow-hidden">
                  <div className="px-4 py-4 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #F8FAFF 100%)' }}>
                    <div className="flex items-center gap-3">
                      {profilePhoto ? (
                        <img src={profilePhoto} alt="Profile" className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ring-2 ring-blue-200" style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}>
                          {profileName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-gray-900">{profileName}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[140px]">{profileEmail}</p>
                        {profileCompany && <p className="text-xs text-gray-400 truncate max-w-[140px]">{profileCompany}</p>}
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">Administrator</span>
                      </div>
                    </div>
                  </div>
                  <div className="py-1.5">
                    <button
                      onClick={() => { setActivePanel('settings'); setShowProfileMenu(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5"
                    >
                      <Settings className="w-4 h-4 text-gray-400" /> Settings
                    </button>
                    <button
                      onClick={() => { showToast({ type: 'info', title: 'Opening help center…' }); setShowProfileMenu(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <HelpCircle className="w-4 h-4 text-gray-400" /> Help & Support
                    </button>
                    <button
                      onClick={() => { setShowShortcutsModal(true); setShowProfileMenu(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Keyboard className="w-4 h-4 text-gray-400" /> Keyboard Shortcuts
                    </button>
                  </div>
                  <div className="border-t border-gray-100 py-1">
                    <button
                      onClick={async () => { setShowProfileMenu(false); await signOut(); navigate('/login') }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" /> Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Demo mode banner */}
        {demoMode && (
          <div className="mx-4 mt-3 shrink-0 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Test mode on</span> — showing fake data. Your real data is untouched.
            </p>
            <button
              onClick={() => setDemoMode(false)}
              className="ml-auto text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2"
            >
              Turn off
            </button>
          </div>
        )}

        {/* Panel content */}
        <div className={`flex-1 overflow-hidden ${panelNeedsFullHeight ? '' : 'overflow-y-auto'}`}>
          {renderPanel()}
        </div>
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        setActivePanel={setActivePanel}
        tenants={tenants}
        properties={propertiesList}
        tickets={tickets}
      />

      {/* Modals */}
      {showInviteModal && (
        <InviteTenantModal
          properties={propertiesList}
          onClose={() => setShowInviteModal(false)}
          onAdd={(t) => setTenants((prev) => [...prev, t])}
        />
      )}
      {showAddPropertyModal && (
        <AddPropertyModal
          onClose={() => setShowAddPropertyModal(false)}
          onAdd={(p) => setPropertiesList((prev) => [...prev, p])}
        />
      )}
      {showNewTicketModal && (
        <NewTicketModal
          tenants={tenants}
          onClose={() => setShowNewTicketModal(false)}
          onAdd={(t) => setTickets((prev) => [...prev, t])}
        />
      )}
      {showReportModal && <ReportModal onClose={() => setShowReportModal(false)} />}
      {showAnnouncementModal && (
        <AnnouncementModal
          tenants={tenants}
          properties={propertiesList}
          onClose={() => setShowAnnouncementModal(false)}
          onSent={(subject, count) => addActivity({ type: 'announcement', text: `"${subject}" sent to ${count} tenant${count !== 1 ? 's' : ''}` })}
        />
      )}
      {showNewThreadModal && (
        <NewThreadModal
          tenants={tenants}
          threads={threads}
          onClose={() => setShowNewThreadModal(false)}
          onSelect={(threadId) => {
            setSelectedThreadId(threadId)
            setActivePanel('messages')
            setShowNewThreadModal(false)
          }}
          onCreateThread={(thread) => {
            setThreads(prev => {
              const exists = prev.find(t => t.id === thread.tenantId)
              return exists ? prev : [...prev, { ...thread, id: thread.tenantId }]
            })
            setSelectedThreadId(thread.tenantId)
            setActivePanel('messages')
            setShowNewThreadModal(false)
          }}
        />
      )}
      {managePropertyId && (
        <ManagePropertyModal
          property={propertiesList.find(p => p.id === managePropertyId)!}
          tenants={tenants}
          tickets={tickets}
          onClose={() => setManagePropertyId(null)}
          onUpdateProperty={async (updated) => {
            setPropertiesList(prev => prev.map(p => p.id === updated.id ? updated : p))
            showToast({ type: 'success', title: `Property "${updated.name}" updated` })
            await supabase.from('properties').update({
              name: updated.name,
              address: updated.address,
              city: updated.city,
            }).eq('id', updated.id)
          }}
          onShowNewTicket={() => { setManagePropertyId(null); setShowNewTicketModal(true) }}
          setActivePanel={setActivePanel}
          setSelectedThreadId={setSelectedThreadId}
          setThreads={setThreads}
          onViewTenant={(id) => { setManagePropertyId(null); setViewTenantId(id) }}
        />
      )}
      {editTenantId && (
        <EditTenantModal
          tenant={tenants.find(t => t.id === editTenantId)!}
          properties={propertiesList}
          onClose={() => setEditTenantId(null)}
          onSave={async (updated) => {
            setTenants(prev => prev.map(t => t.id === updated.id ? updated : t))
            showToast({ type: 'success', title: `Tenant "${updated.name}" updated` })
            const newPropId = propertiesList.find(p => p.name === updated.property)?.id
            const unitId = newPropId && updated.unit
              ? await findOrCreateUnit(newPropId, updated.unit, updated.rent)
              : null
            await supabase.from('tenants').update({
              name: updated.name,
              email: updated.email,
              phone: updated.phone,
              monthly_rent: updated.rent,
              status: updated.status,
              ...(unitId ? { unit_id: unitId } : {}),
            }).eq('id', updated.id)
            setEditTenantId(null)
          }}
        />
      )}
      {viewTenantId && (
        <TenantProfileModal
          tenant={tenants.find(t => t.id === viewTenantId)!}
          tickets={tickets}
          onClose={() => setViewTenantId(null)}
          onMessage={(tenantId) => {
            const tenant = tenants.find(t => t.id === tenantId)
            if (!tenant) return
            const existing = threads.find(th => th.tenantId === tenantId)
            if (!existing) {
              setThreads(prev => [...prev, { id: tenantId, tenantId, tenantName: tenant.name, tenantUnit: `${tenant.property} · Unit ${tenant.unit}`, unread: 0, lastMessage: '', lastTime: '' }])
            }
            setSelectedThreadId(tenantId)
            setActivePanel('messages')
            setViewTenantId(null)
          }}
          onSavePayment={(record) => setRentRecords(prev => [record, ...prev])}
        />
      )}
      {showShortcutsModal && (
        <ModalBackdrop onClose={() => setShowShortcutsModal(false)}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-sm animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Keyboard Shortcuts</h2>
              <button onClick={() => setShowShortcutsModal(false)} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { key: '⌘K', desc: 'Command palette' },
                { key: '⌘/', desc: 'Search' },
                { key: 'G then D', desc: 'Go to Dashboard' },
                { key: 'G then T', desc: 'Go to Tenants' },
                { key: 'G then M', desc: 'Go to Maintenance' },
              ].map(s => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{s.desc}</span>
                  <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-700">{s.key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </ModalBackdrop>
      )}
      {showBugModal && <BugReportModal onClose={() => setShowBugModal(false)} />}
      {logPaymentTenantId && (() => {
        const t = tenants.find(x => x.id === logPaymentTenantId)
        if (!t) return null
        return (
          <LogPaymentModal
            tenant={t}
            onClose={() => setLogPaymentTenantId(null)}
            onSave={async (record) => {
              if (demoMode) { showToast({ type: 'info', title: 'Demo mode — no changes saved' }); setLogPaymentTenantId(null); return }
              setRentRecords(prev => {
                const filtered = prev.filter(r => !(r.tenantId === record.tenantId && r.month === record.month))
                return [...filtered, record]
              })
              if (!user) { setLogPaymentTenantId(null); return }
              // Persist to Supabase — month string like "June 2026" parses to the 1st of that month
              const dueDate = new Date(record.month)
              const { error } = await supabase.from('rent_payments').insert({
                pm_id: user.id,
                tenant_id: record.tenantId,
                amount: record.amount,
                due_date: (isNaN(dueDate.getTime()) ? new Date() : dueDate).toISOString().slice(0, 10),
                paid_date: record.datePaid ? new Date(record.datePaid).toISOString().slice(0, 10) : null,
                status: record.status,
                note: record.method || null,
              })
              if (error) showToast({ type: 'error', title: 'Failed to save payment' })
              addActivity({ type: 'payment', text: `${t.name} rent logged — $${record.amount.toLocaleString()} · ${t.property}` })
              refetchRentRecords()
              setLogPaymentTenantId(null)
            }}
          />
        )
      })()}
    </div>
    </NotificationsProvider>
  )
}
