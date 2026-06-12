import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Users, Wrench, MessageSquare, FileText,
  Settings, ChevronLeft, ChevronRight, Plus, MoreHorizontal, Send,
  Smile, Paperclip, Edit2, Home, DollarSign, Bell, X,
  Eye, EyeOff, Camera, Pencil, CheckCircle, LogOut, HelpCircle,
  Keyboard, TrendingUp, BarChart2, AlertTriangle, Search, ChevronUp, ChevronDown,
  CreditCard, Receipt,
} from 'lucide-react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, BarChart, Bar,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import type { Thread, ChatMessage, Tenant, MaintenanceTicket, Property, RentRecord } from '../data/mockData'
import {
  tenants as initialTenants,
  maintenanceTickets as initialTickets,
  properties as initialProperties,
  rentRecords as initialRentRecords,
  activityFeed, occupancyData, revenueData,
  messageThreads, chatMessages,
  ticketsByMonth, ticketsByType,
} from '../data/mockData'
import { showToast } from '../components/Toast'

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
  const [form, setForm] = useState({
    name: '', email: '', phone: '', unit: '', property: '', rent: '', leaseStart: '', leaseEnd: '',
    emergencyName: '', emergencyPhone: '', moveIn: '', deposit: '', petPolicy: 'No Pets', parking: '', notes: '',
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

  function handleSubmit() {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    const newTenant: Tenant = {
      id: `t-${Date.now()}`,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      unit: form.unit.trim(),
      property: form.property,
      rent: Number(form.rent),
      leaseEnd: form.leaseEnd || 'TBD',
      status: 'current',
      moveIn: form.leaseStart || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }
    onAdd(newTenant)
    showToast({ type: 'success', title: `Tenant ${form.name} invited` })
    onClose()
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
                  {properties.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
                {errors.property && <p className="text-xs text-red-500 mt-0.5">{errors.property}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {fi('rent', 'Monthly Rent ($)', 'number', true)}
                {fi('deposit', 'Security Deposit ($)', 'number')}
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

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={handleSubmit} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Send Invite</button>
          </div>
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

  function handleSubmit() {
    const newProp: Property = {
      id: `prop-${Date.now()}`,
      name: form.propertyName.trim() || form.address.trim(),
      address: form.address.trim(),
      city: `${form.city}, ${form.state}`,
      units: Number(form.units),
      occupied: 0,
      monthlyIncome: 0,
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
  const [form, setForm] = useState({ tenantId: '', issueType: '', priority: '', summary: '', description: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleSubmit() {
    const e: Record<string, string> = {}
    if (!form.summary.trim()) e.summary = 'Required'
    if (!form.issueType) e.issueType = 'Required'
    if (!form.priority) e.priority = 'Required'
    if (Object.keys(e).length > 0) { setErrors(e); return }
    const tenant = tenants.find((t) => t.id === form.tenantId)
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const priorityMap: Record<string, MaintenanceTicket['priority']> = {
      Low: 'low', Medium: 'medium', High: 'high', Urgent: 'emergency',
    }
    const newTicket: MaintenanceTicket = {
      id: `MT-${String(Math.floor(Math.random() * 900) + 100)}`,
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
    showToast({ type: 'success', title: `Ticket ${newTicket.id} created` })
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
  const today = new Date('2026-06-11')
  const months: string[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    months.push(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))
  }
  const [form, setForm] = useState({
    month: months[0],
    amount: String(tenant.rent),
    datePaid: '2026-06-11',
    method: 'ACH',
    notes: '',
    status: 'paid' as 'paid' | 'late' | 'pending',
  })

  function handleSave() {
    const record: RentRecord = {
      id: `rr-${Date.now()}`,
      tenantId: tenant.id,
      month: form.month,
      amount: Number(form.amount),
      datePaid: new Date(form.datePaid).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      method: form.method,
      status: form.status,
    }
    onSave(record)
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
            <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm">Cancel</button>
            <button onClick={handleSave} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
              <CreditCard className="w-4 h-4" /> Log Payment
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
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Monthly Report — June 2026</h2>
            <p className="text-xs text-gray-500">BMP Central · Admin Portal</p>
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

interface AnnouncementModalProps {
  tenants: Tenant[]
  properties: Property[]
  onClose: () => void
  onSent?: (subject: string, count: number) => void
}

function AnnouncementModal({ tenants, properties, onClose, onSent }: AnnouncementModalProps) {
  const [form, setForm] = useState({ recipient: 'all', property: '', subject: '', message: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleSend() {
    const e: Record<string, string> = {}
    if (!form.subject.trim()) e.subject = 'Required'
    if (!form.message.trim()) e.message = 'Required'
    if (Object.keys(e).length > 0) { setErrors(e); return }
    const count = form.recipient === 'all' ? tenants.length
      : tenants.filter((t) => t.property === form.property).length
    showToast({ type: 'success', title: `Announcement sent to ${count} tenant${count !== 1 ? 's' : ''}` })
    onSent?.(form.subject, count)
    onClose()
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Send Announcement</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">From</p>
            <p className="text-sm font-semibold text-gray-900">BMP Central</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Recipients</label>
            <div className="flex gap-2">
              {['all', 'property'].map((v) => (
                <button
                  key={v}
                  onClick={() => setForm({ ...form, recipient: v })}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${form.recipient === v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {v === 'all' ? 'All Tenants' : 'By Property'}
                </button>
              ))}
            </div>
            {form.recipient === 'property' && (
              <select
                value={form.property}
                onChange={(e) => setForm({ ...form, property: e.target.value })}
                className="mt-2 w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select property…</option>
                {properties.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Subject *</label>
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.subject ? 'border-red-400' : 'border-gray-200'}`}
            />
            {errors.subject && <p className="text-xs text-red-500 mt-0.5">{errors.subject}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Message *</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={4}
              className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${errors.message ? 'border-red-400' : 'border-gray-200'}`}
            />
            {errors.message && <p className="text-xs text-red-500 mt-0.5">{errors.message}</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={handleSend} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Send</button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Schedule Inspection Modal ────────────────────────────────────────────────

interface ScheduleInspectionModalProps {
  properties: Property[]
  onClose: () => void
}

function ScheduleInspectionModal({ properties, onClose }: ScheduleInspectionModalProps) {
  const [form, setForm] = useState({ property: '', unit: '', date: '', time: '', inspector: '', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleSubmit() {
    const e: Record<string, string> = {}
    if (!form.property) e.property = 'Required'
    if (!form.date) e.date = 'Required'
    if (Object.keys(e).length > 0) { setErrors(e); return }
    showToast({ type: 'success', title: `Inspection scheduled at ${form.property} on ${form.date}` })
    onClose()
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Schedule Inspection</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Property *</label>
            <select
              value={form.property}
              onChange={(e) => setForm({ ...form, property: e.target.value })}
              className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${errors.property ? 'border-red-400' : 'border-gray-200'}`}
            >
              <option value="">Select property…</option>
              {properties.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            {errors.property && <p className="text-xs text-red-500 mt-0.5">{errors.property}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Unit (optional)</label>
            <input
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="e.g. 1A (leave blank for whole property)"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={`w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.date ? 'border-red-400' : 'border-gray-200'}`}
              />
              {errors.date && <p className="text-xs text-red-500 mt-0.5">{errors.date}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Time</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Inspector Name</label>
            <input
              value={form.inspector}
              onChange={(e) => setForm({ ...form, inspector: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Cancel</button>
            <button onClick={handleSubmit} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Schedule</button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
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
  const [messages, setMessages] = useState<ChatMessage[]>(chatMessages)
  const [compose, setCompose] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [editedPopoverId, setEditedPopoverId] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [attachments, setAttachments] = useState<{ name: string; size: string }[]>([])
  const [threadSearch, setThreadSearch] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)
  const composeRef = useRef<HTMLTextAreaElement>(null)

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null
  const threadMessages = messages.filter((m) => m.threadId === selectedThreadId)
  const filteredThreads = threads.filter(t =>
    t.tenantName.toLowerCase().includes(threadSearch.toLowerCase()) ||
    t.tenantUnit.toLowerCase().includes(threadSearch.toLowerCase())
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMessages.length, selectedThreadId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmojiPicker(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function sendMessage() {
    if ((!compose.trim() && attachments.length === 0) || !selectedThreadId) return
    const text = [
      compose.trim(),
      ...attachments.map(a => `📎 ${a.name} (${a.size})`),
    ].filter(Boolean).join('\n')
    const now = Date.now()
    const newMsg: ChatMessage = {
      id: `msg-${now}`,
      threadId: selectedThreadId,
      senderId: 'pm',
      senderName: 'BMP Central',
      text,
      timestamp: 'Just now',
      sentAt: now,
      edited: false,
      unsent: false,
    }
    setMessages((prev) => [...prev, newMsg])
    setThreads((prev) =>
      prev.map((t) =>
        t.id === selectedThreadId
          ? { ...t, lastMessage: compose.trim() || '📎 Attachment', lastTime: 'Just now', unread: 0 }
          : t
      )
    )
    setCompose('')
    setAttachments([])
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
    }))
    setAttachments(prev => [...prev, ...items])
    e.target.value = ''
  }

  function startEdit(msg: ChatMessage) {
    setEditingId(msg.id)
    setEditText(msg.text)
    setMenuOpenId(null)
  }

  function saveEdit(id: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, edited: true, originalText: m.text, text: editText }
          : m
      )
    )
    setEditingId(null)
  }

  function unsendMessage(id: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, unsent: true } : m))
    )
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

              if (editingId === msg.id) {
                return (
                  <div key={msg.id} className={`flex ${isPm ? 'justify-end' : 'justify-start'} ${showSenderBreak ? 'mt-3' : ''}`}>
                    <div className="max-w-[72%] space-y-2">
                      <textarea
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-blue-400 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white shadow-sm"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(msg.id) }
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(msg.id)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-full font-semibold">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 rounded-full border border-gray-200 bg-white">Cancel</button>
                      </div>
                    </div>
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
                        {msg.text}
                        {msg.edited && (
                          <span className="relative">
                            <button
                              onClick={() => setEditedPopoverId(editedPopoverId === msg.id ? null : msg.id)}
                              className={`text-xs italic ml-1.5 ${isPm ? 'text-blue-200' : 'text-gray-400'} hover:underline`}
                            >
                              edited
                            </button>
                            {editedPopoverId === msg.id && (
                              <div className="absolute bottom-full left-0 mb-2 bg-gray-900 rounded-xl px-4 py-3 w-[220px] z-20 shadow-xl">
                                <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Original</p>
                                <p className="text-sm text-white">{msg.originalText}</p>
                              </div>
                            )}
                          </span>
                        )}
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
                                <>
                                  <button onClick={() => startEdit(msg)} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                                    <Edit2 className="w-3.5 h-3.5" /> Edit
                                  </button>
                                  <button onClick={() => unsendMessage(msg.id)} className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
                                    <X className="w-3.5 h-3.5" /> Unsend
                                  </button>
                                </>
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
                <div key={i} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5 text-xs text-blue-700 font-medium">
                  <Paperclip className="w-3 h-3" />
                  <span className="max-w-[140px] truncate">{a.name}</span>
                  <span className="text-blue-400">{a.size}</span>
                  <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-blue-400 hover:text-blue-700 ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
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
  const [section, setSection] = useState<'account' | 'security' | 'notifications' | 'preferences'>('account')
  const [photoPreview, setPhotoPreview] = useState<string | null>(profilePhoto)
  const [fullName, setFullName] = useState(profileName)
  const [email, setEmail] = useState('admin@bmpcentral.com')
  const [phone, setPhone] = useState('+1 (512) 555-0100')
  const [title, setTitle] = useState('Property Manager')
  const [company, setCompany] = useState('BMP Central')
  const [bio, setBio] = useState('')
  const [twoFactor, setTwoFactor] = useState(false)
  const [notifToggles, setNotifToggles] = useState({
    emailMaintenance: true, emailRent: true, emailLease: true, emailMessages: true, emailSystem: false,
    smsMaintenance: false, smsRent: true, smsLease: false, smsMessages: false, smsSystem: false,
    inappMaintenance: true, inappRent: true, inappLease: true, inappMessages: true, inappSystem: true,
  })
  const [darkMode, setDarkMode] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sections = [
    { id: 'account', label: 'Account' },
    { id: 'security', label: 'Security' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'preferences', label: 'Preferences' },
  ] as const

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setPhotoPreview(url)
      showToast({ type: 'success', title: 'Profile photo updated' })
    }
  }

  function handleSaveProfile() {
    setProfileName(fullName)
    setProfilePhoto(photoPreview)
    showToast({ type: 'success', title: 'Profile updated' })
  }

  return (
    <div className="flex h-full overflow-hidden animate-slide-up">
      {/* Mini sidebar */}
      <div className="w-[140px] border-r border-gray-200 p-3 shrink-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">Settings</p>
        <nav className="space-y-0.5">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                section === s.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {section === 'account' && (
          <div className="max-w-lg space-y-6">
            <h2 className="text-lg font-bold text-gray-900">Account Settings</h2>

            {/* Photo */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Profile Photo</h3>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Profile" className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
                      PM
                    </div>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-800 rounded-full flex items-center justify-center"
                  >
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Change photo</p>
                  <p className="text-xs text-gray-500">JPG, PNG up to 5MB</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </div>
            </div>

            {/* Profile info */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Profile Information</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
                    <input
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
                    <input
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                    <input
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Company</label>
                    <input
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Bio</label>
                  <textarea
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Brief professional bio…"
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {section === 'security' && (
          <div className="max-w-lg space-y-6">
            <h2 className="text-lg font-bold text-gray-900">Security</h2>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Change Password</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Current Password</label>
                  <input type="password" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">New Password</label>
                  <input type="password" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Confirm New Password</label>
                  <input type="password" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
                </div>
                <button
                  onClick={() => showToast({ type: 'success', title: 'Password changed' })}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  Change Password
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Two-Factor Authentication</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Add an extra layer of security to your account</p>
                </div>
                <button
                  onClick={() => {
                    setTwoFactor(!twoFactor)
                    showToast({ type: 'success', title: `Two-factor authentication ${!twoFactor ? 'enabled' : 'disabled'}` })
                  }}
                  className={`relative w-10 h-6 rounded-full transition-colors ${twoFactor ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${twoFactor ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Active Sessions</h3>
              <div className="space-y-3">
                {[
                  { device: 'Chrome · Austin, TX', time: 'Current session', current: true },
                  { device: 'Mobile App · Austin, TX', time: '2 hours ago', current: false },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{s.device}</p>
                      <p className="text-xs text-gray-500">{s.time}</p>
                    </div>
                    {s.current && (
                      <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Current</span>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => showToast({ type: 'success', title: 'Signed out of all other devices' })}
                className="mt-4 w-full border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2 rounded-xl text-sm transition-colors"
              >
                Sign out all other devices
              </button>
            </div>
          </div>
        )}

        {section === 'notifications' && (
          <div className="max-w-lg space-y-6">
            <h2 className="text-lg font-bold text-gray-900">Notification Preferences</h2>
            {[
              { group: 'Email Notifications', prefix: 'email' as const },
              { group: 'SMS Notifications', prefix: 'sms' as const },
              { group: 'In-App Notifications', prefix: 'inapp' as const },
            ].map(({ group, prefix }) => (
              <div key={group} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">{group}</h3>
                <div className="space-y-3">
                  {[
                    { key: 'Maintenance' as const, label: 'Maintenance requests' },
                    { key: 'Rent' as const, label: 'Rent payments' },
                    { key: 'Lease' as const, label: 'Lease renewals' },
                    { key: 'Messages' as const, label: 'New messages' },
                    { key: 'System' as const, label: 'System updates' },
                  ].map(({ key, label }) => {
                    const toggleKey = `${prefix}${key}` as keyof typeof notifToggles
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <p className="text-sm text-gray-700">{label}</p>
                        <button
                          onClick={() => {
                            setNotifToggles((prev) => ({ ...prev, [toggleKey]: !prev[toggleKey] }))
                            showToast({ type: 'success', title: `Notification preference updated` })
                          }}
                          className={`relative w-10 h-6 rounded-full transition-colors ${notifToggles[toggleKey] ? 'bg-blue-600' : 'bg-gray-200'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifToggles[toggleKey] ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {section === 'preferences' && (
          <div className="max-w-lg space-y-6">
            <h2 className="text-lg font-bold text-gray-900">Preferences</h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Regional Settings</h3>
              <div className="space-y-4">
                {[
                  { label: 'Language', defaultVal: 'English' },
                  { label: 'Timezone', defaultVal: 'America/Chicago' },
                  { label: 'Date Format', defaultVal: 'MM/DD/YYYY' },
                  { label: 'Currency', defaultVal: 'USD' },
                ].map(({ label, defaultVal }) => (
                  <div key={label}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                    <select
                      defaultValue={defaultVal}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option>{defaultVal}</option>
                    </select>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Dark Mode</p>
                    <p className="text-xs text-gray-500">Switch to dark theme</p>
                  </div>
                  <button
                    onClick={() => {
                      setDarkMode(!darkMode)
                      showToast({ type: 'success', title: 'Dark mode preference saved' })
                    }}
                    className={`relative w-10 h-6 rounded-full transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                <button
                  onClick={() => showToast({ type: 'success', title: 'Preferences saved' })}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  Save Preferences
                </button>
              </div>
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

interface DashboardPanelProps {
  setActivePanel: (panel: string) => void
  setAnalyticsSection: (section: string) => void
  onShowInviteModal: () => void
  onShowAddPropertyModal: () => void
  onShowReportModal: () => void
  onShowAnnouncementModal: () => void
  onShowScheduleModal: () => void
  tenants: Tenant[]
  properties: Property[]
  rentRecords: RentRecord[]
  recentActivity: { id: string; type: string; text: string; time: string }[]
}

function DashboardPanel({
  setActivePanel, setAnalyticsSection, onShowInviteModal, onShowAddPropertyModal,
  onShowReportModal, onShowAnnouncementModal, onShowScheduleModal,
  tenants, properties, rentRecords, recentActivity,
}: DashboardPanelProps) {
  const [editQuickActions, setEditQuickActions] = useState(false)
  const [hiddenActions, setHiddenActions] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('adminHiddenActions')
      return new Set(stored ? JSON.parse(stored) : [])
    } catch {
      return new Set()
    }
  })
  const [actionsOrder, setActionsOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('adminActionsOrder')
      return stored ? JSON.parse(stored) : DEFAULT_QUICK_ACTIONS.map(a => a.id)
    } catch {
      return DEFAULT_QUICK_ACTIONS.map(a => a.id)
    }
  })

  function toggleHidden(id: string) {
    setHiddenActions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem('adminHiddenActions', JSON.stringify([...next]))
      return next
    })
  }

  function moveAction(id: string, direction: 'up' | 'down') {
    setActionsOrder(prev => {
      const idx = prev.indexOf(id)
      if (idx < 0) return prev
      const next = [...prev]
      if (direction === 'up' && idx > 0) {
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      } else if (direction === 'down' && idx < next.length - 1) {
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      }
      localStorage.setItem('adminActionsOrder', JSON.stringify(next))
      return next
    })
  }

  function handleQuickAction(id: string) {
    if (id === 'add-property') onShowAddPropertyModal()
    else if (id === 'invite-tenant') onShowInviteModal()
    else if (id === 'generate-report') onShowReportModal()
    else if (id === 'announcement') onShowAnnouncementModal()
    else if (id === 'review-tickets') setActivePanel('maintenance')
    else if (id === 'schedule') onShowScheduleModal()
  }

  const orderedActions = actionsOrder
    .map(id => DEFAULT_QUICK_ACTIONS.find(a => a.id === id))
    .filter(Boolean) as typeof DEFAULT_QUICK_ACTIONS

  const totalUnits = properties.reduce((s, p) => s + p.units, 0)
  const totalOccupied = properties.reduce((s, p) => s + p.occupied, 0)
  const totalRevenue = properties.reduce((s, p) => s + p.monthlyIncome, 0)
  const currentMonth = 'June 2026'
  const collectedIds = new Set(rentRecords.filter(r => r.month === currentMonth && r.status !== 'pending').map(r => r.tenantId))
  const activeTenants = tenants.filter(t => t.status !== 'notice')
  const collectedCount = activeTenants.filter(t => collectedIds.has(t.id)).length
  const overdueCount = activeTenants.filter(t => !collectedIds.has(t.id)).length

  const kpis = [
    { label: 'Properties', value: String(properties.length), icon: <Building2 className="w-5 h-5" />, trend: null, color: 'text-blue-600 bg-blue-50', section: 'overview' },
    { label: 'Total Units', value: String(totalUnits), icon: <Home className="w-5 h-5" />, trend: null, color: 'text-purple-600 bg-purple-50', section: 'occupancy' },
    { label: 'Occupied', value: `${totalOccupied}/${totalUnits}`, icon: <Users className="w-5 h-5" />, trend: { text: `${Math.round((totalOccupied/totalUnits)*100)}% occupancy`, positive: totalOccupied/totalUnits >= 0.9 }, color: 'text-green-600 bg-green-50', section: 'occupancy' },
    { label: 'Monthly Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: <DollarSign className="w-5 h-5" />, trend: { text: '↑ 9.1% YoY', positive: true }, color: 'text-emerald-600 bg-emerald-50', section: 'revenue' },
    { label: 'Rent Collected', value: `${collectedCount}/${activeTenants.length}`, icon: <Receipt className="w-5 h-5" />, trend: overdueCount > 0 ? { text: `${overdueCount} overdue`, positive: false } : { text: 'All collected', positive: true }, color: overdueCount > 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50', section: 'rentroll' },
  ]

  return (
    <div className="p-6 space-y-6 animate-slide-up">
      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k) => (
          <button
            key={k.label}
            onClick={() => { setAnalyticsSection(k.section); setActivePanel('analytics') }}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-left hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{k.label}</p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.color}`}>
                {k.icon}
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{k.value}</p>
            {k.trend && (
              <p className={`text-xs mt-1 font-medium ${k.trend.positive ? 'text-green-600' : 'text-red-600'}`}>
                {k.trend.text}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-5 gap-5">
        {/* LEFT — 60% */}
        <div className="col-span-3 space-y-5">
          {/* Occupancy Trend */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Occupancy Trend</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={occupancyData}>
                <defs>
                  <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis domain={[75, 100]} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, 'Occupancy']} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                <Area type="monotone" dataKey="rate" stroke="#2563EB" strokeWidth={2} fill="url(#occGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {recentActivity.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    a.type === 'payment' ? 'bg-green-100 text-green-600' :
                    a.type === 'ticket' ? 'bg-amber-100 text-amber-600' :
                    a.type === 'announcement' ? 'bg-purple-100 text-purple-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {a.type === 'payment' ? <DollarSign className="w-3.5 h-3.5" /> :
                     a.type === 'ticket' ? <Wrench className="w-3.5 h-3.5" /> :
                     a.type === 'announcement' ? <Bell className="w-3.5 h-3.5" /> :
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

        {/* RIGHT — 40% */}
        <div className="col-span-2 space-y-5">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Quick Actions</h3>
              <button
                onClick={() => setEditQuickActions(!editQuickActions)}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                title="Edit quick actions"
              >
                {editQuickActions ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              </button>
            </div>

            {editQuickActions ? (
              <div className="space-y-2 animate-fade-in">
                {orderedActions.map((a, idx) => (
                  <div key={a.id} className="flex items-center justify-between py-1.5">
                    <div className={`flex items-center gap-2 text-sm font-medium ${hiddenActions.has(a.id) ? 'line-through text-gray-300' : 'text-gray-700'}`}>
                      {a.icon}
                      {a.label}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveAction(a.id, 'up')}
                        disabled={idx === 0}
                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20"
                        title="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveAction(a.id, 'down')}
                        disabled={idx === orderedActions.length - 1}
                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20"
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleHidden(a.id)}
                        className="p-0.5 text-gray-400 hover:text-gray-600"
                        title={hiddenActions.has(a.id) ? 'Show' : 'Hide'}
                      >
                        {hiddenActions.has(a.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setEditQuickActions(false)}
                  className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-xl text-sm transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {orderedActions.filter((a) => !hiddenActions.has(a.id)).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleQuickAction(a.id)}
                    className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 rounded-xl text-sm font-medium text-gray-700 transition-colors text-left"
                  >
                    {a.icon}
                    <span className="truncate">{a.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Rent Collection */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Rent Collection — {currentMonth}</h3>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-700 font-medium">{collectedCount} of {activeTenants.length} collected</p>
              <span className={`text-xs font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {Math.round((collectedCount / (activeTenants.length || 1)) * 100)}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${overdueCount > 0 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${(collectedCount / (activeTenants.length || 1)) * 100}%` }}
              />
            </div>
            {overdueCount > 0 ? (
              <p className="text-xs text-red-500 mt-2 font-medium">⚠ {overdueCount} tenant{overdueCount > 1 ? 's' : ''} overdue — check Tenants panel</p>
            ) : (
              <p className="text-xs text-gray-400 mt-2">All payments received for this month</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Tenants Panel ────────────────────────────────────────────────────────────

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
}

function TenantsPanel({ tenants, setTenants, rentRecords, threads, setThreads, setActivePanel, setSelectedThreadId, onShowInviteModal, onEditTenant, onViewTenant, onLogPayment }: TenantsPanelProps) {
  const [search, setSearch] = useState('')
  const [filterProperty, setFilterProperty] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'rent' | 'leaseEnd'>('name')
  const [tenantStatusDropdownId, setTenantStatusDropdownId] = useState<string | null>(null)

  const today = new Date('2026-06-11')
  const currentMonth = 'June 2026'

  // Auto-detect overdue: tenants with no payment record for current month
  const overdueIds = new Set(
    tenants
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

  const statusLabels: Record<string, string> = { current: 'Current', late: 'Late', notice: 'Notice' }
  const statusColors: Record<string, string> = {
    current: 'bg-green-100 text-green-700',
    late: 'bg-red-100 text-red-700',
    notice: 'bg-amber-100 text-amber-700',
  }

  const statusBadge = (s: string, tenantId: string) => (
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
          {(['current', 'late', 'notice'] as const).map(st => (
            <button key={st} onClick={() => {
              setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, status: st } : t))
              showToast({ type: 'success', title: `Status updated to ${statusLabels[st]}` })
              setTenantStatusDropdownId(null)
            }} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${st === 'current' ? 'bg-green-500' : st === 'late' ? 'bg-red-500' : 'bg-amber-500'}`} />
              {statusLabels[st]}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  function handleMessage(tenant: Tenant) {
    let thread = threads.find((th) => th.tenantId === tenant.id)
    if (!thread) {
      thread = {
        id: `thread-${Date.now()}`,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantUnit: `${tenant.property} · Unit ${tenant.unit}`,
        unread: 0,
        lastMessage: '',
        lastTime: '',
      }
      setThreads((prev) => [...prev, thread!])
    }
    setSelectedThreadId(thread.id)
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
        <button
          onClick={onShowInviteModal}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Invite Tenant
        </button>
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
          <option value="current">Current</option>
          <option value="late">Late</option>
          <option value="notice">Notice</option>
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
                    {hasPaid
                      ? <span className="flex items-center gap-1 text-xs font-semibold text-green-600"><CheckCircle className="w-3.5 h-3.5" /> Paid</span>
                      : <button onClick={() => onLogPayment(t.id)} className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 border border-red-200 px-2 py-0.5 rounded-lg hover:bg-red-50"><CreditCard className="w-3 h-3" /> Log</button>
                    }
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => onEditTenant(t.id)} className="text-xs font-semibold text-gray-600 hover:text-gray-800 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">
                        Edit
                      </button>
                      <button onClick={() => onViewTenant(t.id)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 border border-blue-100 px-2 py-1 rounded-lg hover:bg-blue-50">
                        Profile
                      </button>
                      <button onClick={() => handleMessage(t)} className="text-xs font-semibold text-gray-500 hover:text-gray-700 p-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
    </div>
  )
}

// ─── Maintenance Panel ────────────────────────────────────────────────────────

interface MaintenancePanelProps {
  tickets: MaintenanceTicket[]
  setTickets: React.Dispatch<React.SetStateAction<MaintenanceTicket[]>>
  onShowNewTicketModal: () => void
  focusedTicketId?: string | null
  onClearFocus?: () => void
  addActivity?: (entry: { type: 'payment' | 'ticket' | 'tenant' | 'announcement' | 'lease'; text: string }) => void
}

function MaintenancePanel({ tickets, setTickets, onShowNewTicketModal, focusedTicketId, onClearFocus, addActivity }: MaintenancePanelProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all')
  const [filterProperty, setFilterProperty] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showAnalytics, setShowAnalytics] = useState(true)
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null)
  const [editTicketId, setEditTicketId] = useState<string | null>(null)
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(focusedTicketId ?? null)
  const focusRef = useRef<HTMLTableRowElement>(null)

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
              <button key={st} onClick={(e) => {
                e.stopPropagation()
                const tk = tickets.find(t => t.id === ticketId)
                setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: st } : t))
                showToast({ type: 'success', title: `Status → ${labels[st]}` })
                if (tk) addActivity?.({ type: 'ticket', text: `${tk.tenantName} · ${tk.title} → ${labels[st]}` })
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

  function markResolved(id: string) {
    const tk = tickets.find(t => t.id === id)
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'resolved' as const } : t)))
    showToast({ type: 'success', title: 'Ticket marked as resolved' })
    if (tk) addActivity?.({ type: 'ticket', text: `${tk.tenantName} · ${tk.title} → Resolved` })
  }

  const filtered = tickets.filter(t => {
    const matchStatus = filterStatus === 'all' || t.status === filterStatus
    const matchProp = !filterProperty || t.property === filterProperty
    const matchPriority = !filterPriority || t.priority === filterPriority
    const matchCat = !filterCategory || t.category === filterCategory
    return matchStatus && matchProp && matchPriority && matchCat
  })

  const highestUnits = [
    { unit: 'Unit 4B', count: 3 },
    { unit: 'Unit 2A', count: 2 },
    { unit: 'Unit 3A', count: 2 },
    { unit: 'Unit 1B', count: 1 },
    { unit: '1 Elmwood', count: 1 },
  ]

  const hasFilters = filterProperty || filterPriority || filterCategory

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">Maintenance</h2>
          <div className="flex gap-1.5">
            {[
              { label: `${tickets.filter(t=>t.status==='open').length} Open`, color: 'bg-blue-100 text-blue-700' },
              { label: `${tickets.filter(t=>t.status==='in_progress').length} In Progress`, color: 'bg-amber-100 text-amber-700' },
              { label: `${tickets.filter(t=>t.status==='resolved').length} Resolved`, color: 'bg-green-100 text-green-700' },
            ].map(c => (
              <span key={c.label} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.color}`}>{c.label}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
          >
            {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
          </button>
          <button onClick={onShowNewTicketModal} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors">
            <Plus className="w-4 h-4" /> New Ticket
          </button>
        </div>
      </div>

      {/* Analytics */}
      {showAnalytics && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total (All Time)', value: 9, icon: <BarChart2 className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50' },
              { label: 'Open', value: tickets.filter(t=>t.status==='open').length, icon: <Wrench className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50' },
              { label: 'Avg Resolution', value: '3.2d', icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-600 bg-green-50' },
              { label: 'Cost This Month', value: '$340', icon: <DollarSign className="w-4 h-4" />, color: 'text-purple-600 bg-purple-50' },
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
                <BarChart data={ticketsByMonth}>
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
                  <Pie data={ticketsByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                    {ticketsByType.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
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
                      <p className="text-sm text-gray-700">{t.tenantName}</p>
                      <p className="text-xs text-gray-400">{t.unit} · {t.property}</p>
                    </td>
                    <td className="px-5 py-3">{priorityBadge(t.priority)}</td>
                    <td className="px-5 py-3" onClick={e => e.stopPropagation()}>{statusBadge(t.status, t.id)}</td>
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
                      <td colSpan={7} className="px-5 py-4 bg-gray-50">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="col-span-2">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</p>
                            <p className="text-sm text-gray-700">{t.description || 'No description provided.'}</p>
                          </div>
                          <div className="space-y-2">
                            <div><p className="text-xs text-gray-400">Created</p><p className="text-sm font-medium text-gray-700">{t.createdAt}</p></div>
                            <div><p className="text-xs text-gray-400">Last Updated</p><p className="text-sm font-medium text-gray-700">{t.updatedAt}</p></div>
                            {t.cost !== undefined && <div><p className="text-xs text-gray-400">Estimated Cost</p><p className="text-sm font-semibold text-gray-900">${t.cost}</p></div>}
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
          onSave={(updated) => {
            setTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
            showToast({ type: 'success', title: `Ticket ${updated.id} updated` })
            addActivity?.({ type: 'ticket', text: `${updated.tenantName} · ${updated.title} updated` })
            setEditTicketId(null)
          }}
        />
      )}
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
}

function PropertiesPanel({ properties, tenants, tickets, onShowAddPropertyModal, onManageProperty, onViewTicket }: PropertiesPanelProps) {
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null)
  const [viewTicketsProperty, setViewTicketsProperty] = useState<Property | null>(null)

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

              {/* Expandable tenants */}
              <button
                onClick={() => setExpandedPropertyId(expanded ? null : p.id)}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold mb-3"
              >
                {expanded ? 'Hide Tenants' : `View Tenants (${propTenants.length})`}
              </button>
              {expanded && (
                <div className="mb-3 space-y-1 animate-fade-in">
                  {propTenants.map(t => (
                    <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                      <span className="font-medium text-gray-800">{t.name}</span>
                      <span className="text-gray-500">Unit {t.unit}</span>
                      <span className="font-semibold text-gray-700">${t.rent.toLocaleString()}/mo</span>
                    </div>
                  ))}
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
    </div>
  )
}

// ─── Documents Panel ──────────────────────────────────────────────────────────

interface DocEntry {
  name: string
  type: string
  date: string
  size: string
  property?: string
  unit?: string
  tenantName?: string
  tenantPhone?: string
  tenantId?: string
}

function DocumentsPanel({ onViewTenant }: { onViewTenant?: (tenantId: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [docs, setDocs] = useState<DocEntry[]>([
    { name: 'Lease Agreement — Sarah Mitchell', type: 'Lease', date: 'Jan 1, 2026', size: '245 KB', property: '14 Oakwood Drive', unit: '1A', tenantName: 'Sarah Mitchell', tenantPhone: '+1 (512) 555-0101', tenantId: 't-1' },
    { name: 'Lease Agreement — Robert Kim', type: 'Lease', date: 'Dec 1, 2025', size: '238 KB', property: '14 Oakwood Drive', unit: '1B', tenantName: 'Robert Kim', tenantPhone: '+1 (512) 555-0102', tenantId: 't-2' },
    { name: 'Lease Agreement — Emily Chen', type: 'Lease', date: 'Nov 1, 2025', size: '241 KB', property: '14 Oakwood Drive', unit: '2A', tenantName: 'Emily Chen', tenantPhone: '+1 (512) 555-0103', tenantId: 't-3' },
    { name: 'Lease Agreement — Priya Sharma', type: 'Lease', date: 'Mar 1, 2026', size: '239 KB', property: '7 Maple Lane', unit: '3A', tenantName: 'Priya Sharma', tenantPhone: '+1 (512) 555-0105', tenantId: 't-5' },
    { name: 'Move-In Checklist — Sarah Mitchell', type: 'Checklist', date: 'Jan 1, 2026', size: '45 KB', property: '14 Oakwood Drive', unit: '1A', tenantName: 'Sarah Mitchell', tenantPhone: '+1 (512) 555-0101', tenantId: 't-1' },
    { name: 'Property Insurance — 14 Oakwood Drive', type: 'Insurance', date: 'Mar 15, 2026', size: '1.2 MB', property: '14 Oakwood Drive' },
    { name: 'Property Insurance — 7 Maple Lane', type: 'Insurance', date: 'Mar 15, 2026', size: '1.1 MB', property: '7 Maple Lane' },
    { name: 'Inspection Report — Q1 2026', type: 'Report', date: 'Apr 2, 2026', size: '3.4 MB', property: 'All Properties' },
    { name: 'Inspection Report — Q4 2025', type: 'Report', date: 'Jan 8, 2026', size: '2.9 MB', property: 'All Properties' },
    { name: 'HOA Rules & Regulations', type: 'Policy', date: 'Jan 1, 2026', size: '189 KB' },
  ])
  const [viewingDoc, setViewingDoc] = useState<string | null>(null)
  const [docSearch, setDocSearch] = useState('')
  const [filterProperty, setFilterProperty] = useState('')
  const [filterUnit, setFilterUnit] = useState('')
  const [filterTenant, setFilterTenant] = useState('')
  const [filterType, setFilterType] = useState('')

  const uniqueProperties = Array.from(new Set(docs.map(d => d.property).filter(Boolean))) as string[]
  const uniqueUnits = Array.from(new Set(docs.map(d => d.unit).filter(Boolean))) as string[]
  const uniqueTenants = Array.from(new Set(docs.map(d => d.tenantName).filter(Boolean))) as string[]
  const uniqueTypes = Array.from(new Set(docs.map(d => d.type))) as string[]

  const filteredDocs = docs.filter(d => {
    const q = docSearch.toLowerCase()
    const matchesSearch = !q || d.name.toLowerCase().includes(q) ||
      (d.tenantName?.toLowerCase().includes(q) ?? false) ||
      (d.tenantPhone?.toLowerCase().includes(q) ?? false)
    const matchesProp = !filterProperty || d.property === filterProperty
    const matchesUnit = !filterUnit || d.unit === filterUnit
    const matchesTenant = !filterTenant || d.tenantName === filterTenant
    const matchesType = !filterType || d.type === filterType
    return matchesSearch && matchesProp && matchesUnit && matchesTenant && matchesType
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      const sizeKB = Math.round(file.size / 1024)
      const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`
      setDocs((prev) => [{ name: file.name, type: 'Document', date: today, size: sizeStr }, ...prev])
      showToast({ type: 'success', title: `"${file.name}" uploaded` })
    }
    e.target.value = ''
  }

  const hasFilters = filterProperty || filterUnit || filterTenant || filterType

  return (
    <div className="p-6 animate-slide-up space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Documents</h2>
          <p className="text-xs text-gray-500">{filteredDocs.length} of {docs.length} document{docs.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Upload
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            placeholder="Search name, tenant, phone…"
            value={docSearch}
            onChange={e => setDocSearch(e.target.value)}
          />
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
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tenant</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Size</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.map((d, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
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
                      {d.tenantId && onViewTenant ? (
                        <button
                          onClick={() => onViewTenant(d.tenantId!)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline text-left"
                        >
                          {d.tenantName}
                        </button>
                      ) : (
                        <p className="text-sm text-gray-700">{d.tenantName}</p>
                      )}
                      <p className="text-xs text-gray-400">{d.tenantPhone}</p>
                    </div>
                  ) : <span className="text-xs text-gray-400">—</span>}
                </td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">{d.type}</span>
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">{d.date}</td>
                <td className="px-5 py-3 text-sm text-gray-500">{d.size}</td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => setViewingDoc(d.name)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredDocs.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">No documents match your filters.</div>
        )}
      </div>
      {viewingDoc && <DocViewerModal filename={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </div>
  )
}

// ─── Edit Ticket Modal ────────────────────────────────────────────────────────

function EditTicketModal({ ticket, onClose, onSave }: { ticket: MaintenanceTicket; onClose: () => void; onSave: (t: MaintenanceTicket) => void }) {
  const [form, setForm] = useState({ issueType: ticket.category, priority: ticket.priority, description: ticket.description, status: ticket.status })
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Edit Ticket {ticket.id}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {[
            { key: 'issueType', label: 'Issue Type', opts: ['Plumbing','Electrical','HVAC','Appliance','Structural','Other'] },
            { key: 'priority', label: 'Priority', opts: ['low','medium','high','emergency'] },
            { key: 'status', label: 'Status', opts: ['open','in_progress','resolved'] },
          ].map(({ key, label, opts }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
              <select value={(form as Record<string,string>)[key]} onChange={e => setForm({...form, [key]: e.target.value})}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {opts.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm">Cancel</button>
            <button onClick={() => onSave({ ...ticket, category: form.issueType, priority: form.priority as MaintenanceTicket['priority'], description: form.description, status: form.status as MaintenanceTicket['status'] })}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm">Save Changes</button>
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
              {(['current','late','notice'] as const).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
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

function TenantProfileModal({ tenant, tickets, onClose, onMessage }: { tenant: Tenant; tickets: MaintenanceTicket[]; onClose: () => void; onMessage: (id: string) => void }) {
  const [tab, setTab] = useState<'overview'|'payments'|'maintenance'|'documents'>('overview')
  const tenantTickets = tickets.filter(t => t.tenantId === tenant.id)

  const today = new Date('2026-06-10')
  let leaseEndDate: Date | null = null
  try { leaseEndDate = new Date(tenant.leaseEnd) } catch { leaseEndDate = null }
  const daysRemaining = leaseEndDate ? Math.round((leaseEndDate.getTime() - today.getTime()) / 86400000) : null
  const totalLeaseDays = 365
  const leaseProgress = daysRemaining !== null ? Math.max(0, Math.min(100, Math.round(((totalLeaseDays - daysRemaining) / totalLeaseDays) * 100))) : 0

  const paymentHistory = [
    { month: 'Jun 2026', amount: tenant.rent, date: 'Jun 1, 2026', method: 'ACH', status: 'paid' },
    { month: 'May 2026', amount: tenant.rent, date: 'May 1, 2026', method: 'ACH', status: 'paid' },
    { month: 'Apr 2026', amount: tenant.rent, date: 'Apr 1, 2026', method: 'ACH', status: 'paid' },
    { month: 'Mar 2026', amount: tenant.rent, date: 'Mar 1, 2026', method: 'ACH', status: 'paid' },
    { month: 'Feb 2026', amount: tenant.rent, date: 'Feb 1, 2026', method: 'ACH', status: 'paid' },
    { month: 'Jan 2026', amount: tenant.rent, date: 'Jan 2, 2026', method: 'ACH', status: 'paid' },
  ]

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
        <div className="flex gap-1 px-6 pt-4 border-b border-gray-100">
          {(['overview','payments','maintenance','documents'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${tab === t ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'overview' && (
            <div className="space-y-4">
              {/* Lease card */}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contact</p>
                  <p className="text-sm text-gray-700">{tenant.email}</p>
                  <p className="text-sm text-gray-700">{tenant.phone}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Emergency Contact</p>
                  <p className="text-sm text-gray-400 italic">Not on file</p>
                </div>
              </div>
            </div>
          )}
          {tab === 'payments' && (
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Month','Amount','Date Paid','Method','Status'].map(h => (
                      <th key={h} className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((p, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2.5 text-gray-700">{p.month}</td>
                      <td className="py-2.5 font-semibold text-gray-900">${p.amount.toLocaleString()}</td>
                      <td className="py-2.5 text-gray-600">{p.date}</td>
                      <td className="py-2.5 text-gray-600">{p.method}</td>
                      <td className="py-2.5"><span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">Paid</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === 'maintenance' && (
            <div>
              {tenantTickets.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No maintenance tickets for this tenant.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['ID','Issue','Category','Status','Date'].map(h => (
                        <th key={h} className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tenantTickets.map(t => (
                      <tr key={t.id} className="border-b border-gray-50">
                        <td className="py-2.5 font-mono text-xs text-gray-500">{t.id}</td>
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
          {tab === 'documents' && (
            <div className="space-y-3">
              {[
                { name: `Lease Agreement — ${tenant.name}`, type: 'Lease', date: tenant.moveIn },
                { name: `Move-In Checklist — ${tenant.name}`, type: 'Checklist', date: tenant.moveIn },
              ].map(d => (
                <div key={d.name} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{d.name}</p>
                      <p className="text-xs text-gray-400">{d.type} · {d.date}</p>
                    </div>
                  </div>
                  <button onClick={() => showToast({ type: 'info', title: `Opening ${d.name}` })} className="text-xs font-semibold text-blue-600 hover:text-blue-700">View</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={() => onMessage(tenant.id)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-4 h-4" /> Send Message
          </button>
        </div>
      </div>
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
}

function ManagePropertyModal({ property, tenants, tickets, onClose, onUpdateProperty, onShowNewTicket }: ManagePropertyModalProps) {
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
                          <p className="font-medium text-gray-900">{t.name}</p>
                          <p className="text-xs text-gray-400">{t.email}</p>
                        </td>
                        <td className="py-2.5 text-gray-600">{t.unit}</td>
                        <td className="py-2.5 font-semibold">${t.rent.toLocaleString()}</td>
                        <td className="py-2.5 text-gray-600">{t.leaseEnd}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${t.status === 'current' ? 'bg-green-100 text-green-700' : t.status === 'late' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
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

// ─── Analytics Panel ─────────────────────────────────────────────────────────

interface AnalyticsPanelProps {
  initialSection?: string
  rentRecords?: RentRecord[]
  tenants?: Tenant[]
}

function AnalyticsPanel({ initialSection = 'overview', rentRecords = [], tenants = [] }: AnalyticsPanelProps) {
  const [subSection, setSubSection] = useState<'overview' | 'occupancy' | 'revenue' | 'maintenance' | 'rentroll' | 'cashflow'>(
    (initialSection as 'overview' | 'occupancy' | 'revenue' | 'maintenance' | 'rentroll' | 'cashflow') || 'overview'
  )

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'occupancy', label: 'Occupancy' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'rentroll', label: 'Rent Roll' },
    { id: 'cashflow', label: 'Cash Flow' },
    { id: 'maintenance', label: 'Maintenance' },
  ] as const

  const totalRevenue = revenueData.reduce((s, d) => s + d.revenue, 0)
  const totalExpenses = revenueData.reduce((s, d) => s + d.expenses, 0)
  const noi = totalRevenue - totalExpenses
  const ytdRevenue = revenueData.reduce((s, d) => s + d.revenue, 0)

  const occupancyByProperty = [
    { property: '14 Oakwood Drive', units: 4, occupied: 4, pct: 100 },
    { property: '7 Maple Lane', units: 4, occupied: 4, pct: 100 },
    { property: '12 Elmwood Court', units: 4, occupied: 3, pct: 75 },
  ]

  const highestUnits = [
    { unit: 'Unit 4B', count: 3 },
    { unit: 'Unit 2A', count: 2 },
    { unit: 'Unit 3A', count: 2 },
    { unit: 'Unit 1B', count: 1 },
    { unit: '1 Elmwood', count: 1 },
  ]

  const currentMonth = 'June 2026'
  const rentRollData = tenants.map(t => {
    const junePmt = rentRecords.find(r => r.tenantId === t.id && r.month === currentMonth)
    return { ...t, junePaid: !!junePmt, juneStatus: junePmt?.status ?? 'unpaid', datePaid: junePmt?.datePaid ?? null, method: junePmt?.method ?? null }
  })

  const cashFlowData = [
    { month: 'Jan', income: 14000, mortgage: 6500, maintenance: 1100, insurance: 420, tax: 290, mgmt: 140, net: 5550 },
    { month: 'Feb', income: 14000, mortgage: 6500, maintenance: 980, insurance: 420, tax: 290, mgmt: 140, net: 5670 },
    { month: 'Mar', income: 14000, mortgage: 6500, maintenance: 1350, insurance: 420, tax: 290, mgmt: 140, net: 5300 },
    { month: 'Apr', income: 14000, mortgage: 6500, maintenance: 890, insurance: 420, tax: 290, mgmt: 140, net: 5760 },
    { month: 'May', income: 14000, mortgage: 6500, maintenance: 1150, insurance: 420, tax: 290, mgmt: 140, net: 5500 },
    { month: 'Jun', income: 14400, mortgage: 6500, maintenance: 425, insurance: 420, tax: 290, mgmt: 144, net: 6621 },
  ]

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Analytics</h2>
        <p className="text-xs text-gray-500">Portfolio performance overview</p>
      </div>

      {/* Sub-nav tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSubSection(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${subSection === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {subSection === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Units', value: '12', color: 'text-blue-600 bg-blue-50', icon: <Home className="w-5 h-5" /> },
              { label: 'Occupied', value: '11/12', color: 'text-green-600 bg-green-50', icon: <Users className="w-5 h-5" /> },
              { label: 'Avg Occupancy', value: '91.7%', color: 'text-purple-600 bg-purple-50', icon: <TrendingUp className="w-5 h-5" /> },
              { label: 'Monthly Revenue', value: '$14,400', color: 'text-emerald-600 bg-emerald-50', icon: <DollarSign className="w-5 h-5" /> },
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
                <AreaChart data={occupancyData}>
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
              { label: 'Overall Occupancy', value: '91.7%', sub: '11 of 12 units' },
              { label: 'Vacant Units', value: '1', sub: '12 Elmwood Court' },
              { label: 'Avg Occupancy (6mo)', value: '90.3%', sub: 'Jan–Jun 2026' },
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
              <AreaChart data={occupancyData}>
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
              { label: 'NOI Margin', value: `${Math.round((noi / totalRevenue) * 100)}%`, color: 'text-emerald-600' },
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
              <BarChart data={revenueData} barGap={4}>
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
                {[
                  { name: '14 Oakwood Drive', units: 4, occupied: 4, income: 5800 },
                  { name: '7 Maple Lane', units: 4, occupied: 4, income: 5900 },
                  { name: '12 Elmwood Court', units: 4, occupied: 3, income: 4200 },
                ].map(p => (
                  <tr key={p.name} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">{p.units}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">{p.occupied}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-green-600">${p.income.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">${Math.round(p.income / p.occupied).toLocaleString()}</td>
                  </tr>
                ))}
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
              { label: 'Total (All Time)', value: '9', color: 'text-blue-600 bg-blue-50', icon: <BarChart2 className="w-4 h-4" /> },
              { label: 'Open', value: '2', color: 'text-amber-600 bg-amber-50', icon: <Wrench className="w-4 h-4" /> },
              { label: 'Avg Resolution', value: '3.2d', color: 'text-green-600 bg-green-50', icon: <TrendingUp className="w-4 h-4" /> },
              { label: 'Cost This Month', value: '$340', color: 'text-purple-600 bg-purple-50', icon: <DollarSign className="w-4 h-4" /> },
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
                <BarChart data={ticketsByMonth}>
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
                  <Pie data={ticketsByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                    {ticketsByType.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
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
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{t.name}</td>
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

  // Shared state lifted to root
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants)
  const [tickets, setTickets] = useState<MaintenanceTicket[]>(initialTickets)
  const [propertiesList, setPropertiesList] = useState<Property[]>(initialProperties)
  const [threads, setThreads] = useState<Thread[]>(messageThreads)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)

  // Profile state
  const [profileName, setProfileName] = useState('BMP Central Admin')
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)

  // Notification bell state
  const [showNotifs, setShowNotifs] = useState(false)
  const [notifications, setNotifications] = useState([
    { id: 'n1', type: 'maintenance', icon: 'wrench', title: 'New maintenance request', body: 'Sarah Mitchell submitted a plumbing request — Unit 4B', time: '2 min ago', read: false },
    { id: 'n2', type: 'payment', icon: 'dollar', title: 'Rent received', body: 'Rachel Green paid $1,250 — Unit 4A, 44 Riverside Dr', time: '1 hour ago', read: false },
    { id: 'n3', type: 'lease', icon: 'file', title: 'Lease expiring soon', body: 'Jessica Park, Unit 2A — expires Aug 31, 2026 (82 days)', time: '3 hours ago', read: true },
    { id: 'n4', type: 'maintenance', icon: 'check', title: 'Ticket resolved', body: 'Ticket #1031 resolved — Maria Santos, Unit 3A', time: '1 day ago', read: true },
    { id: 'n5', type: 'move', icon: 'user', title: 'Portal login', body: 'Sarah Mitchell logged into tenant portal', time: '2 days ago', read: true },
  ])

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
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showNewThreadModal, setShowNewThreadModal] = useState(false)

  // Tenant modals
  const [editTenantId, setEditTenantId] = useState<string | null>(null)
  const [viewTenantId, setViewTenantId] = useState<string | null>(null)

  // Rent records + payment logging
  const [rentRecords, setRentRecords] = useState<RentRecord[]>(initialRentRecords)
  const [logPaymentTenantId, setLogPaymentTenantId] = useState<string | null>(null)

  // Reactive activity feed
  type ActivityEntry = { id: string; type: 'payment' | 'ticket' | 'tenant' | 'announcement' | 'lease'; text: string; time: string }
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>(
    activityFeed.map(a => ({ id: a.id, type: a.type as ActivityEntry['type'], text: a.text, time: a.time }))
  )
  function addActivity(entry: Omit<ActivityEntry, 'id' | 'time'>) {
    setRecentActivity(prev => [{ ...entry, id: `act-${Date.now()}`, time: 'Just now' }, ...prev].slice(0, 20))
  }

  // Focused maintenance ticket (from property tickets modal)
  const [focusedMaintenanceTicketId, setFocusedMaintenanceTicketId] = useState<string | null>(null)

  // Notification outside-click ref
  const notifRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false)
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) setShowProfileMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const unreadNotifCount = notifications.filter(n => !n.read).length

  // Badge counts
  const unreadMessages = threads.reduce((s, t) => s + t.unread, 0)
  const openTicketCount = tickets.filter((t) => t.status !== 'resolved').length

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'properties', label: 'Properties', icon: <Building2 className="w-5 h-5" /> },
    { id: 'tenants', label: 'Tenants', icon: <Users className="w-5 h-5" /> },
    { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="w-5 h-5" />, badge: openTicketCount },
    { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-5 h-5" /> },
    { id: 'messages', label: 'Messages', icon: <MessageSquare className="w-5 h-5" />, badge: unreadMessages },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-5 h-5" /> },
  ]

  function renderPanel() {
    switch (activePanel) {
      case 'dashboard':
        return (
          <DashboardPanel
            setActivePanel={setActivePanel}
            setAnalyticsSection={setAnalyticsSection}
            onShowInviteModal={() => setShowInviteModal(true)}
            onShowAddPropertyModal={() => setShowAddPropertyModal(true)}
            onShowReportModal={() => setShowReportModal(true)}
            onShowAnnouncementModal={() => setShowAnnouncementModal(true)}
            onShowScheduleModal={() => setShowScheduleModal(true)}
            tenants={tenants}
            properties={propertiesList}
            rentRecords={rentRecords}
            recentActivity={recentActivity}
          />
        )
      case 'analytics':
        return <AnalyticsPanel initialSection={analyticsSection} rentRecords={rentRecords} tenants={tenants} />
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
      case 'documents': return <DocumentsPanel onViewTenant={(id) => setViewTenantId(id)} />
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
        <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)' }}>
            <Building2 className="w-4.5 h-4.5 text-white" />
          </div>
          <div className={`transition-all duration-300 overflow-hidden ${sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>
            <p className="text-white font-bold text-sm whitespace-nowrap tracking-tight">BMP Central</p>
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
                style={isActive ? { background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', boxShadow: '0 4px 12px rgba(59,130,246,0.35)' } : {}}
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
            style={activePanel === 'settings' ? { background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', boxShadow: '0 4px 12px rgba(59,130,246,0.35)' } : {}}
          >
            <Settings className="w-5 h-5 shrink-0" />
            <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 overflow-hidden ${sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>Settings</span>
          </button>
        </div>

        {/* Profile row */}
        <div className="mx-3 mb-3 rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {profilePhoto ? (
            <img src={profilePhoto} alt="Profile" className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-blue-500/40" />
          ) : (
            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-xs ring-2 ring-blue-500/40" style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}>
              {profileName.split(' ').map(w => w[0]).join('').slice(0, 2)}
            </div>
          )}
          <div className={`flex-1 min-w-0 transition-all duration-300 overflow-hidden ${sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 pointer-events-none'}`}>
            <p className="text-sm font-semibold text-white whitespace-nowrap truncate">{profileName}</p>
            <p className="text-[11px] text-slate-500 whitespace-nowrap">Administrator</p>
          </div>
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
              title="Collapse"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          {!sidebarOpen && (
            <span className="sr-only">Expand</span>
          )}
        </div>

        {/* Expand button when collapsed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="mx-3 mb-3 w-11 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)' }}
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-100 px-6 h-[60px] flex items-center justify-between shrink-0 shadow-sm">
          {/* Page title */}
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-none capitalize">
                {activePanel === 'settings' ? 'Settings'
                  : activePanel === 'dashboard' ? 'Dashboard'
                  : activePanel === 'analytics' ? 'Analytics'
                  : activePanel.charAt(0).toUpperCase() + activePanel.slice(1)}
              </h1>
              <p className="text-[11px] text-gray-400 mt-0.5">BMP Central · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>
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
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotifs(!showNotifs); setShowProfileMenu(false) }}
                className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showNotifs ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold px-0.5 leading-none">
                    {unreadNotifCount}
                  </span>
                )}
              </button>
              {showNotifs && (
                <div className="absolute top-full right-0 mt-2 w-[340px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 animate-fade-in overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 text-sm">Notifications</span>
                      {unreadNotifCount > 0 && (
                        <span className="min-w-[20px] h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold px-1.5">{unreadNotifCount}</span>
                      )}
                    </div>
                    <button
                      onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                    {notifications.map(n => (
                      <button
                        key={n.id}
                        onClick={() => {
                          setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
                          if (n.type === 'maintenance') setActivePanel('maintenance')
                          else if (n.type === 'payment') setActivePanel('dashboard')
                          else if (n.type === 'lease') setActivePanel('tenants')
                          setShowNotifs(false)
                        }}
                        className={`w-full text-left px-5 py-3.5 hover:bg-gray-50 transition-colors flex items-start gap-3 ${!n.read ? 'bg-blue-50/60' : ''}`}
                      >
                        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read ? 'bg-gray-300' : 'bg-blue-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${!n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>{n.title}</p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{n.body}</p>
                          <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
                    <button
                      onClick={() => { showToast({ type: 'info', title: 'View all notifications' }); setShowNotifs(false) }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold w-full text-center"
                    >
                      View all notifications →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile button */}
            <div className="relative ml-1" ref={profileMenuRef}>
              <button
                onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifs(false) }}
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
                        <p className="text-xs text-gray-500">admin@bmpcentral.com</p>
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
                      onClick={() => { navigate('/'); setShowProfileMenu(false) }}
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

        {/* Panel content */}
        <div className={`flex-1 overflow-hidden ${panelNeedsFullHeight ? '' : 'overflow-y-auto'}`}>
          {renderPanel()}
        </div>
      </div>

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
      {showScheduleModal && (
        <ScheduleInspectionModal
          properties={propertiesList}
          onClose={() => setShowScheduleModal(false)}
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
            setThreads(prev => [...prev, thread])
            setSelectedThreadId(thread.id)
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
          onUpdateProperty={(updated) => {
            setPropertiesList(prev => prev.map(p => p.id === updated.id ? updated : p))
            showToast({ type: 'success', title: `Property "${updated.name}" updated` })
          }}
          onShowNewTicket={() => { setManagePropertyId(null); setShowNewTicketModal(true) }}
          setActivePanel={setActivePanel}
          setSelectedThreadId={setSelectedThreadId}
          setThreads={setThreads}
        />
      )}
      {editTenantId && (
        <EditTenantModal
          tenant={tenants.find(t => t.id === editTenantId)!}
          properties={propertiesList}
          onClose={() => setEditTenantId(null)}
          onSave={(updated) => {
            setTenants(prev => prev.map(t => t.id === updated.id ? updated : t))
            showToast({ type: 'success', title: `Tenant "${updated.name}" updated` })
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
            let thread = threads.find(th => th.tenantId === tenantId)
            if (!thread) {
              thread = { id: `thread-${Date.now()}`, tenantId, tenantName: tenant.name, tenantUnit: `${tenant.property} · Unit ${tenant.unit}`, unread: 0, lastMessage: '', lastTime: '' }
              setThreads(prev => [...prev, thread!])
            }
            setSelectedThreadId(thread.id)
            setActivePanel('messages')
            setViewTenantId(null)
          }}
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
            onSave={(record) => {
              setRentRecords(prev => {
                const filtered = prev.filter(r => !(r.tenantId === record.tenantId && r.month === record.month))
                return [...filtered, record]
              })
              addActivity({ type: 'payment', text: `${t.name} rent logged — $${record.amount.toLocaleString()} · ${t.property}` })
              setLogPaymentTenantId(null)
            }}
          />
        )
      })()}
    </div>
  )
}
