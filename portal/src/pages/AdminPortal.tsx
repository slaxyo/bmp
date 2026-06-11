import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Users, Wrench, MessageSquare, FileText,
  Settings, ChevronLeft, ChevronRight, Plus, MoreHorizontal, Send,
  Smile, Paperclip, Edit2, Home, DollarSign, Bell, X,
  Eye, EyeOff, Camera, Pencil, CheckCircle, LogOut, HelpCircle,
  Keyboard, TrendingUp, BarChart2, AlertTriangle, Search,
} from 'lucide-react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, BarChart, Bar,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import type { Thread, ChatMessage, Tenant, MaintenanceTicket, Property } from '../data/mockData'
import {
  tenants as initialTenants,
  maintenanceTickets as initialTickets,
  properties as initialProperties,
  activityFeed, occupancyData,
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
    showToast({ type: 'demo', title: `Tenant ${form.name} invited (demo — invite email not sent)` })
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
    showToast({ type: 'demo', title: `Property "${newProp.name}" added (demo)` })
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
    showToast({ type: 'demo', title: `Ticket ${newTicket.id} created (demo)` })
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
              onClick={() => showToast({ type: 'demo', title: 'Print report (demo)' })}
              className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Print
            </button>
            <button
              onClick={() => showToast({ type: 'demo', title: 'PDF download (demo)' })}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Download PDF (Demo)
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
}

function AnnouncementModal({ tenants, properties, onClose }: AnnouncementModalProps) {
  const [form, setForm] = useState({ recipient: 'all', property: '', subject: '', message: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function handleSend() {
    const e: Record<string, string> = {}
    if (!form.subject.trim()) e.subject = 'Required'
    if (!form.message.trim()) e.message = 'Required'
    if (Object.keys(e).length > 0) { setErrors(e); return }
    const count = form.recipient === 'all' ? tenants.length
      : tenants.filter((t) => t.property === form.property).length
    showToast({ type: 'demo', title: `Announcement sent to ${count} tenant${count !== 1 ? 's' : ''} (demo)` })
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
    showToast({ type: 'demo', title: `Inspection scheduled at ${form.property} on ${form.date} (demo)` })
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
              onClick={() => showToast({ type: 'demo', title: 'Download (demo)' })}
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

function MessagesPanel({ threads, setThreads, selectedThreadId, setSelectedThreadId, onNewThread, onViewTenantProfile }: MessagesPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(chatMessages)
  const [compose, setCompose] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [editedPopoverId, setEditedPopoverId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null
  const threadMessages = messages.filter((m) => m.threadId === selectedThreadId)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMessages.length, selectedThreadId])

  function sendMessage() {
    if (!compose.trim() || !selectedThreadId) return
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      threadId: selectedThreadId,
      senderId: 'pm',
      senderName: 'BMP Central',
      text: compose.trim(),
      timestamp: 'Just now',
      edited: false,
      unsent: false,
    }
    setMessages((prev) => [...prev, newMsg])
    setThreads((prev) =>
      prev.map((t) =>
        t.id === selectedThreadId
          ? { ...t, lastMessage: compose.trim(), lastTime: 'Just now' }
          : t
      )
    )
    setCompose('')
    showToast({ type: 'demo', title: 'Message sent' })
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
    showToast({ type: 'demo', title: 'Message edited' })
  }

  function unsendMessage(id: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, unsent: true } : m))
    )
    setMenuOpenId(null)
    showToast({ type: 'demo', title: 'Message unsent' })
  }

  return (
    <div className="flex h-full overflow-hidden animate-slide-up">
      {/* Left pane */}
      <div className="w-[280px] border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Messages</h2>
          <button
            title="New message"
            onClick={onNewThread}
            className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => {
                setSelectedThreadId(thread.id)
                setThreads((prev) =>
                  prev.map((t) => (t.id === thread.id ? { ...t, unread: 0 } : t))
                )
              }}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                selectedThreadId === thread.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <Avatar name={thread.tenantName} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {thread.tenantName}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0 ml-2">{thread.lastTime}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{thread.tenantUnit}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{thread.lastMessage}</p>
                </div>
                {thread.unread > 0 && (
                  <span className="mt-1 min-w-[20px] h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-semibold px-1">
                    {thread.unread}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right pane */}
      {selectedThread ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
            <Avatar name={selectedThread.tenantName} size="lg" />
            <div>
              <p className="font-semibold text-gray-900">{selectedThread.tenantName}</p>
              <p className="text-xs text-gray-500">{selectedThread.tenantUnit}</p>
            </div>
            <button
              onClick={() => selectedThread && onViewTenantProfile(selectedThread.tenantId)}
              className="ml-auto text-xs text-blue-600 hover:underline font-semibold"
            >
              View Tenant Profile
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {threadMessages.map((msg) => {
              const isPm = msg.senderId === 'pm'

              if (msg.unsent) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <p className="text-xs text-gray-400 italic line-through">Message unsent</p>
                  </div>
                )
              }

              if (editingId === msg.id) {
                return (
                  <div key={msg.id} className={`flex ${isPm ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[70%] space-y-2">
                      <input
                        className="w-full px-3 py-2 text-sm border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(msg.id)}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg font-semibold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 rounded-lg border border-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 group ${isPm ? 'justify-end' : 'justify-start'}`}
                >
                  {!isPm && <Avatar name={msg.senderName} size="sm" />}
                  <div className={`flex flex-col ${isPm ? 'items-end' : 'items-start'} max-w-[70%]`}>
                    <div className="relative">
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm ${
                          isPm
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                        }`}
                      >
                        {msg.text}
                        {msg.edited && (
                          <span className="relative">
                            <button
                              onClick={() =>
                                setEditedPopoverId(
                                  editedPopoverId === msg.id ? null : msg.id
                                )
                              }
                              className={`text-xs italic ml-1.5 ${isPm ? 'text-blue-200' : 'text-gray-400'} hover:underline`}
                            >
                              (edited)
                            </button>
                            {editedPopoverId === msg.id && (
                              <div className="absolute bottom-full left-0 mb-1 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 w-[200px] z-10 shadow-lg">
                                <p className="font-semibold mb-0.5">Original message:</p>
                                <p className="opacity-80">{msg.originalText}</p>
                              </div>
                            )}
                          </span>
                        )}
                      </div>
                      {/* Hover action menu */}
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 ${isPm ? '-left-8' : '-right-8'} hidden group-hover:flex`}
                      >
                        <div className="relative">
                          <button
                            onClick={() =>
                              setMenuOpenId(menuOpenId === msg.id ? null : msg.id)
                            }
                            className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                          {menuOpenId === msg.id && (
                            <div
                              className={`absolute ${isPm ? 'right-8' : 'left-8'} top-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 w-28`}
                            >
                              {isPm ? (
                                <>
                                  <button
                                    onClick={() => startEdit(msg)}
                                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" /> Edit
                                  </button>
                                  <button
                                    onClick={() => unsendMessage(msg.id)}
                                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <X className="w-3.5 h-3.5" /> Unsend
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => {
                                    setCompose(`@${msg.senderName} `)
                                    setMenuOpenId(null)
                                  }}
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
                    <p className="text-xs text-gray-400 mt-0.5">{msg.timestamp}</p>
                  </div>
                  {isPm && <Avatar name="BMP" size="sm" />}
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Compose bar */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2">
              <input
                className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
                placeholder={`Message ${selectedThread.tenantName}…`}
                value={compose}
                onChange={(e) => setCompose(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
              />
              <button
                onClick={() => showToast({ type: 'info', title: 'Emoji picker coming soon' })}
                className="text-gray-400 hover:text-gray-600 p-1"
                title="Emoji"
              >
                <Smile className="w-5 h-5" />
              </button>
              <button
                onClick={() => showToast({ type: 'demo', title: 'File attached (demo)' })}
                className="text-gray-400 hover:text-gray-600 p-1"
                title="Attach file"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <button
                onClick={sendMessage}
                disabled={!compose.trim()}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  compose.trim()
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">Select a conversation</p>
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
      showToast({ type: 'demo', title: 'Profile photo updated' })
    }
  }

  function handleSaveProfile() {
    setProfileName(fullName)
    setProfilePhoto(photoPreview)
    showToast({ type: 'demo', title: 'Profile updated — changes will revert in 30 minutes' })
    setTimeout(() => {
      setProfileName('BMP Central Admin')
      setProfilePhoto(null)
      showToast({ type: 'info', title: 'Demo profile reverted to defaults' })
    }, 30 * 60 * 1000)
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
                  onClick={() => showToast({ type: 'demo', title: 'Password changed' })}
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
                    showToast({ type: 'demo', title: `Two-factor authentication ${!twoFactor ? 'enabled' : 'disabled'}` })
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
                onClick={() => showToast({ type: 'demo', title: 'Signed out of all other devices' })}
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
                            showToast({ type: 'demo', title: `Notification preference updated` })
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
                      showToast({ type: 'demo', title: 'Dark mode preference saved' })
                    }}
                    className={`relative w-10 h-6 rounded-full transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                <button
                  onClick={() => showToast({ type: 'demo', title: 'Preferences saved' })}
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
  onShowInviteModal: () => void
  onShowAddPropertyModal: () => void
  onShowReportModal: () => void
  onShowAnnouncementModal: () => void
  onShowScheduleModal: () => void
  tenants: Tenant[]
  properties: Property[]
}

function DashboardPanel({
  setActivePanel, onShowInviteModal, onShowAddPropertyModal,
  onShowReportModal, onShowAnnouncementModal, onShowScheduleModal,
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

  function toggleHidden(id: string) {
    setHiddenActions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem('adminHiddenActions', JSON.stringify([...next]))
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

  const kpis = [
    { label: 'Properties', value: '3', icon: <Building2 className="w-5 h-5" />, trend: null, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Units', value: '12', icon: <Home className="w-5 h-5" />, trend: null, color: 'text-purple-600 bg-purple-50' },
    { label: 'Occupied', value: '11', icon: <Users className="w-5 h-5" />, trend: { text: '↑ 1 from last month', positive: true }, color: 'text-green-600 bg-green-50' },
    { label: 'Open Tickets', value: '2', icon: <Wrench className="w-5 h-5" />, trend: null, color: 'text-amber-600 bg-amber-50' },
    { label: 'Monthly Revenue', value: '$14,400', icon: <DollarSign className="w-5 h-5" />, trend: { text: '↑ $400 vs May', positive: true }, color: 'text-emerald-600 bg-emerald-50' },
  ]

  return (
    <div className="p-6 space-y-6 animate-slide-up">
      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
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
          </div>
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
              {activityFeed.map((a) => (
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
              <div className="space-y-2">
                {DEFAULT_QUICK_ACTIONS.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-1.5">
                    <div className={`flex items-center gap-2 text-sm font-medium ${hiddenActions.has(a.id) ? 'line-through text-gray-300' : 'text-gray-700'}`}>
                      {a.icon}
                      {a.label}
                    </div>
                    <button
                      onClick={() => toggleHidden(a.id)}
                      className="text-gray-400 hover:text-gray-600"
                      title={hiddenActions.has(a.id) ? 'Show' : 'Hide'}
                    >
                      {hiddenActions.has(a.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
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
                {DEFAULT_QUICK_ACTIONS.filter((a) => !hiddenActions.has(a.id)).map((a) => (
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
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Rent Collection</h3>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-700 font-medium">11 of 11 collected · June 2026</p>
              <span className="text-xs font-bold text-green-600">100%</span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }} />
            </div>
            <p className="text-xs text-gray-400 mt-2">All payments received for this month</p>
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
  threads: Thread[]
  setThreads: React.Dispatch<React.SetStateAction<Thread[]>>
  setActivePanel: (panel: string) => void
  setSelectedThreadId: React.Dispatch<React.SetStateAction<string | null>>
  onShowInviteModal: () => void
  onEditTenant: (id: string) => void
  onViewTenant: (id: string) => void
}

function TenantsPanel({ tenants, threads, setThreads, setActivePanel, setSelectedThreadId, onShowInviteModal, onEditTenant, onViewTenant }: TenantsPanelProps) {
  const [search, setSearch] = useState('')
  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.unit.toLowerCase().includes(search.toLowerCase()) ||
      t.property.toLowerCase().includes(search.toLowerCase())
  )

  // Leases expiring within 90 days from Jun 10, 2026 = before Sep 8, 2026
  const today = new Date('2026-06-10')
  const cutoff = new Date('2026-09-08')
  const expiringSoon = tenants.filter(t => {
    try {
      const d = new Date(t.leaseEnd)
      return d >= today && d <= cutoff
    } catch { return false }
  })

  // Stats
  const totalTenants = tenants.length
  const paidThisMonth = tenants.filter(t => t.status === 'current').length
  const overdue = tenants.filter(t => t.status === 'late').length
  const avgLeaseMs = tenants.reduce((acc, t) => {
    try { return acc + Math.max(0, new Date(t.leaseEnd).getTime() - today.getTime()) } catch { return acc }
  }, 0) / tenants.length
  const avgLeaseDays = Math.round(avgLeaseMs / 86400000)

  const statusBadge = (s: string) => {
    if (s === 'current') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">Current</span>
    if (s === 'late') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">Late</span>
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">Notice</span>
  }

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
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
              placeholder="Search tenants…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
          { label: 'Total Tenants', value: totalTenants, color: 'text-blue-600 bg-blue-50' },
          { label: 'Paid This Month', value: paidThisMonth, color: 'text-green-600 bg-green-50' },
          { label: 'Overdue', value: overdue, color: 'text-red-600 bg-red-50' },
          { label: 'Avg Lease Remaining', value: `${avgLeaseDays}d`, color: 'text-purple-600 bg-purple-50' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color.split(' ')[0]}`}>{k.value}</p>
          </div>
        ))}
      </div>

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
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
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
                <td className="px-5 py-3 text-sm text-gray-700">{t.property}</td>
                <td className="px-5 py-3 text-sm font-semibold text-gray-900">${t.rent.toLocaleString()}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{t.leaseEnd}</td>
                <td className="px-5 py-3">{statusBadge(t.status)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => onEditTenant(t.id)} className="text-xs font-semibold text-gray-600 hover:text-gray-800 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">
                      Edit
                    </button>
                    <button onClick={() => onViewTenant(t.id)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 border border-blue-100 px-2 py-1 rounded-lg hover:bg-blue-50">
                      Profile
                    </button>
                    <button onClick={() => handleMessage(t)} className="text-xs font-semibold text-gray-500 hover:text-gray-700">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Maintenance Panel ────────────────────────────────────────────────────────

interface MaintenancePanelProps {
  tickets: MaintenanceTicket[]
  setTickets: React.Dispatch<React.SetStateAction<MaintenanceTicket[]>>
  onShowNewTicketModal: () => void
}

function MaintenancePanel({ tickets, setTickets, onShowNewTicketModal }: MaintenancePanelProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all')
  const [showAnalytics, setShowAnalytics] = useState(true)
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null)
  const [editTicketId, setEditTicketId] = useState<string | null>(null)

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
          className={`px-2 py-0.5 text-xs font-semibold rounded-full ${colors[s] || 'bg-gray-100 text-gray-600'} cursor-pointer`}
        >
          {labels[s] || s}
        </button>
        {statusDropdownId === ticketId && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 w-32 animate-fade-in">
            {(['open', 'in_progress', 'resolved'] as const).map(st => (
              <button key={st} onClick={() => {
                setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: st } : t))
                showToast({ type: 'demo', title: `Ticket status updated to ${labels[st]}` })
                setStatusDropdownId(null)
              }} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                {labels[st]}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  function markResolved(id: string) {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'resolved' as const } : t)))
    showToast({ type: 'demo', title: 'Ticket marked as resolved' })
  }

  const filtered = filterStatus === 'all' ? tickets : tickets.filter(t => t.status === filterStatus)

  const highestUnits = [
    { unit: 'Unit 4B', count: 3 },
    { unit: 'Unit 2A', count: 2 },
    { unit: 'Unit 3A', count: 2 },
    { unit: 'Unit 1B', count: 1 },
    { unit: '1 Elmwood', count: 1 },
  ]

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

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['all','open','in_progress','resolved'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
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
            {filtered.map((t) => (
              <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
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
                <td className="px-5 py-3">{statusBadge(t.status, t.id)}</td>
                <td className="px-5 py-3 text-sm text-gray-500">{t.createdAt}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditTicketId(t.id)} className="text-xs font-semibold text-gray-600 hover:text-gray-800 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">
                      Edit
                    </button>
                    {t.status !== 'resolved' && (
                      <button onClick={() => markResolved(t.id)} className="text-xs font-semibold text-green-600 hover:text-green-700">
                        Resolve
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Ticket Modal */}
      {editTicketId && (
        <EditTicketModal
          ticket={tickets.find(t => t.id === editTicketId)!}
          onClose={() => setEditTicketId(null)}
          onSave={(updated) => {
            setTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
            showToast({ type: 'demo', title: `Ticket ${updated.id} updated (demo)` })
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
}

function PropertiesPanel({ properties, tenants, tickets, onShowAddPropertyModal, onManageProperty }: PropertiesPanelProps) {
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null)

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
                  {occupancyPct}% occupied
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-gray-100 rounded-full mb-4">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${occupancyPct}%` }} />
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
                  onClick={() => showToast({ type: 'demo', title: `Viewing tickets for ${p.name}` })}
                  className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold py-2 rounded-xl transition-colors"
                >
                  View Tickets
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Documents Panel ──────────────────────────────────────────────────────────

interface DocEntry {
  name: string
  type: string
  date: string
  size: string
}

function DocumentsPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [docs, setDocs] = useState<DocEntry[]>([
    { name: 'Lease Agreement — Sarah Mitchell', type: 'Lease', date: 'Jan 1, 2026', size: '245 KB' },
    { name: 'Lease Agreement — Robert Kim', type: 'Lease', date: 'Dec 1, 2025', size: '238 KB' },
    { name: 'Property Insurance — 14 Oakwood Dr', type: 'Insurance', date: 'Mar 15, 2026', size: '1.2 MB' },
    { name: 'Inspection Report — Q1 2026', type: 'Report', date: 'Apr 2, 2026', size: '3.4 MB' },
    { name: 'HOA Rules & Regulations', type: 'Policy', date: 'Jan 1, 2026', size: '189 KB' },
  ])
  const [viewingDoc, setViewingDoc] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      const sizeKB = Math.round(file.size / 1024)
      const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`
      setDocs((prev) => [{ name: file.name, type: 'Document', date: today, size: sizeStr }, ...prev])
      showToast({ type: 'demo', title: `"${file.name}" uploaded (demo)` })
    }
    e.target.value = ''
  }

  return (
    <div className="p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900">Documents</h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Upload
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Size</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">{d.name}</span>
                  </div>
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
                  <button onClick={() => showToast({ type: 'demo', title: `Opening ${d.name} (demo)` })} className="text-xs font-semibold text-blue-600 hover:text-blue-700">View</button>
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
                      <tr key={t.id} className="border-b border-gray-50">
                        <td className="py-2.5 font-medium text-gray-900">{t.name}</td>
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminPortal() {
  const navigate = useNavigate()
  const [activePanel, setActivePanel] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)

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
            onShowReportModal={() => setShowReportModal(true)}
            onShowAnnouncementModal={() => setShowAnnouncementModal(true)}
            onShowScheduleModal={() => setShowScheduleModal(true)}
            tenants={tenants}
            properties={propertiesList}
          />
        )
      case 'properties':
        return (
          <PropertiesPanel
            properties={propertiesList}
            tenants={tenants}
            tickets={tickets}
            onShowAddPropertyModal={() => setShowAddPropertyModal(true)}
            onManageProperty={(id) => setManagePropertyId(id)}
            setActivePanel={setActivePanel}
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
          />
        )
      case 'maintenance':
        return (
          <MaintenancePanel
            tickets={tickets}
            setTickets={setTickets}
            onShowNewTicketModal={() => setShowNewTicketModal(true)}
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
      case 'documents': return <DocumentsPanel />
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
        className="flex flex-col bg-[#1E293B] transition-all duration-300 ease-in-out shrink-0 overflow-hidden"
        style={{ width: sidebarOpen ? 240 : 72 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className={`transition-all duration-300 overflow-hidden ${sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
            <p className="text-white font-bold text-sm whitespace-nowrap">BMP Central</p>
            <p className="text-slate-400 text-xs whitespace-nowrap">Admin Portal</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const isActive = activePanel === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActivePanel(item.id)}
                title={!sidebarOpen ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                } ${!sidebarOpen ? 'justify-center' : ''}`}
              >
                <div className="shrink-0 relative">
                  {item.icon}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold px-0.5">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-sm font-medium whitespace-nowrap transition-all duration-300 overflow-hidden ${
                    sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Profile + Settings at bottom */}
        <div className="p-3 space-y-1 border-t border-slate-700">
          {/* Profile preview */}
          <div className={`flex items-center gap-3 px-3 py-2 ${sidebarOpen ? '' : 'justify-center'}`}>
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="w-7 h-7 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0">
                PM
              </div>
            )}
            <span className={`text-sm font-medium text-slate-300 whitespace-nowrap transition-all duration-300 overflow-hidden ${sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
              {profileName}
            </span>
          </div>

          <button
            onClick={() => setActivePanel('settings')}
            title={!sidebarOpen ? 'Settings' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              activePanel === 'settings'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            } ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <Settings className="w-5 h-5 shrink-0" />
            <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 overflow-hidden ${sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
              Settings
            </span>
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors ${!sidebarOpen ? 'justify-center' : ''}`}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? (
              <>
                <ChevronLeft className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium whitespace-nowrap">Collapse</span>
              </>
            ) : (
              <ChevronRight className="w-5 h-5 shrink-0" />
            )}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold text-gray-900 capitalize">
              {activePanel === 'settings' ? 'Settings' : activePanel === 'dashboard' ? 'Dashboard' : activePanel}
            </h1>
            <p className="text-xs text-gray-500">BMP Central · Admin Portal</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotifs(!showNotifs); setShowProfileMenu(false) }}
                className="relative w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <Bell className="w-5 h-5 text-gray-500" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold px-0.5">
                    {unreadNotifCount}
                  </span>
                )}
              </button>
              {showNotifs && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 animate-fade-in overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 text-sm">Notifications</span>
                      {unreadNotifCount > 0 && (
                        <span className="min-w-[20px] h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold px-1">{unreadNotifCount}</span>
                      )}
                    </div>
                    <button
                      onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
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
                        className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-start gap-3 ${!n.read ? 'bg-blue-50' : ''}`}
                      >
                        <div className="mt-0.5 shrink-0">
                          <div className={`w-2 h-2 rounded-full mt-1 ${n.read ? 'bg-gray-300' : 'bg-blue-500'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>{n.title}</p>
                          <p className="text-xs text-gray-500 truncate">{n.body}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="px-4 py-2 border-t border-gray-100">
                    <button
                      onClick={() => { showToast({ type: 'demo', title: 'View all notifications (demo)' }); setShowNotifs(false) }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold w-full text-center py-1"
                    >
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* PM Avatar */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifs(false) }}
                className="cursor-pointer"
              >
                {profilePhoto ? (
                  <img src={profilePhoto} alt="Profile" className="w-9 h-9 rounded-xl object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                    PM
                  </div>
                )}
              </button>
              {showProfileMenu && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 z-50 animate-fade-in overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      {profilePhoto ? (
                        <img src={profilePhoto} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">PM</div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{profileName}</p>
                        <p className="text-xs text-gray-500">admin@bmpcentral.com</p>
                      </div>
                    </div>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { setActivePanel('settings'); setShowProfileMenu(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4 text-gray-400" /> Settings
                    </button>
                    <button
                      onClick={() => { showToast({ type: 'demo', title: 'Opening help center…' }); setShowProfileMenu(false) }}
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
            showToast({ type: 'demo', title: `Property "${updated.name}" updated (demo)` })
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
            showToast({ type: 'demo', title: `Tenant "${updated.name}" updated (demo)` })
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
    </div>
  )
}
