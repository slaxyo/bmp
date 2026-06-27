import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { showToast } from '../components/Toast'

const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL as string | undefined
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL as string | undefined

const PRESET_COLORS = [
  '#2563EB', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2', '#BE185D', '#374151',
]

const PLANS = [
  { id: 'basic', label: 'Basic', price: 49 },
  { id: 'pro', label: 'Pro', price: 99 },
  { id: 'enterprise', label: 'Enterprise', price: 199 },
  { id: 'custom', label: 'Custom', price: 0 },
]

export function CreatePortal() {
  const navigate = useNavigate()

  // Step 1: Client info
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [plan, setPlan] = useState('pro')
  const [monthlyFee, setMonthlyFee] = useState('99')
  const [notes, setNotes] = useState('')

  // Step 2: Branding
  const [color, setColor] = useState('#2563EB')

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ email: string; clientId: string } | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    // 1. Create the bmp_clients record first
    const { data: clientData, error: clientError } = await supabase
      .from('bmp_clients')
      .insert({
        name: fullName,
        email,
        phone: phone || null,
        company_name: companyName,
        plan,
        monthly_fee: parseFloat(monthlyFee),
        notes: notes || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (clientError || !clientData) {
      showToast(clientError?.message ?? 'Failed to create client record', 'error')
      setSubmitting(false)
      return
    }

    const clientId = clientData.id

    // 2. Provision the portal (create Supabase auth user + branding) if FUNCTIONS_URL is set
    if (FUNCTIONS_URL) {
      const { data: { session } } = await supabase.auth.getSession()
      try {
        const res = await fetch(`${FUNCTIONS_URL}/create-portal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ email, full_name: fullName, company_name: companyName, primary_color: color, portal_url: PORTAL_URL }),
        })
        const json = await res.json()
        if (res.ok && json.pm_id) {
          // Link the portal PM account to the client record
          await supabase.from('bmp_clients').update({ portal_pm_id: json.pm_id, status: 'active' }).eq('id', clientId)
        } else {
          showToast('Client created but portal invite failed: ' + (json.error ?? 'unknown error'), 'error')
        }
      } catch {
        showToast('Client created but portal provisioning failed (network error)', 'error')
      }
    } else {
      showToast('Client record created. Set VITE_FUNCTIONS_URL to also provision their portal automatically.', 'success')
    }

    setSuccess({ email, clientId })
    setSubmitting(false)
  }

  if (success) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4 mt-12">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Client created!</h2>
        <p className="text-gray-500 text-sm">
          {FUNCTIONS_URL
            ? <>An invitation has been sent to <strong>{success.email}</strong> with a link to set up their portal.</>
            : <>Client record created for <strong>{success.email}</strong>. Set VITE_FUNCTIONS_URL to automatically provision portals.</>
          }
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => navigate(`/clients/${success.clientId}`)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            View client
          </button>
          <button
            onClick={() => { setSuccess(null); setFullName(''); setEmail(''); setPhone(''); setCompanyName(''); setNotes(''); setColor('#2563EB') }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Add another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-5">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" />Back
      </button>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">New client portal</h1>
        <p className="text-sm text-gray-500 mt-0.5">Creates a client record and provisions their portal.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Client info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            Contact details
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Company name</label>
              <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Smith Properties"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@smith.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone <span className="text-gray-400">(optional)</span></label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes <span className="text-gray-400">(internal)</span></label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any notes about this client…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none" />
            </div>
          </div>
        </div>

        {/* Plan */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            Plan & billing
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {PLANS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setPlan(p.id); if (p.price) setMonthlyFee(String(p.price)) }}
                className={`border rounded-lg px-3 py-2.5 text-left transition-colors ${
                  plan === p.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className={`text-sm font-medium ${plan === p.id ? 'text-blue-700' : 'text-gray-800'}`}>{p.label}</p>
                {p.price > 0 && <p className="text-xs text-gray-400">${p.price}/mo</p>}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Monthly fee ($)</label>
            <input required type="number" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} min="0"
              className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          </div>
        </div>

        {/* Branding */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            Portal branding
          </h3>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Accent color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-md border-2 transition-all ${color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded-md border border-gray-300 cursor-pointer p-0.5" />
              <span className="text-xs text-gray-400 font-mono">{color}</span>
            </div>
          </div>
          {/* Preview */}
          <div className="rounded-lg p-3 flex items-center gap-3" style={{ backgroundColor: color + '15' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: color }}>
              {companyName ? companyName.slice(0, 2).toUpperCase() : 'PM'}
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color }}>{companyName || 'Company Name'}</p>
              <p className="text-xs text-gray-400">Property Management Portal</p>
            </div>
          </div>
          {!FUNCTIONS_URL && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              VITE_FUNCTIONS_URL not set — client record will be created but portal won't be provisioned automatically.
            </p>
          )}
        </div>

        <button type="submit" disabled={submitting}
          className="w-full bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {submitting ? 'Creating…' : 'Create client & send portal invite'}
        </button>
      </form>
    </div>
  )
}
