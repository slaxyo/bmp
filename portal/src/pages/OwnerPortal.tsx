import { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react'
import type { Tenant } from '../data/mockData'

interface OwnerData {
  allTenants: Tenant[]
  allProperties: Property[]
  allTickets: MaintenanceTicket[]
  ownerName: string
}
const OwnerDataCtx = createContext<OwnerData>({ allTenants: [], allProperties: [], allTickets: [], ownerName: 'Owner' })

function useLocalState<T>(key: string, def: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try { const s = localStorage.getItem(key); return s !== null ? JSON.parse(s) : def } catch { return def }
  })
  const set = useCallback((v: T) => {
    setVal(v)
    try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
  }, [key])
  return [val, set]
}
import {
  Building2, DollarSign, Wrench, TrendingUp,
  ChevronDown, Download, FileText, Calendar,
  AlertTriangle, BarChart2, RefreshCw, X, Users,
  Phone, Mail, Star, Zap, Search,
  CheckCircle, Clock, Home, Save, ChevronRight,
  Award, Target, Info, ArrowUpRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { revenueData, expenseBreakdown } from '../data/mockData'
import type { Property, MaintenanceTicket } from '../data/mockData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useProperties } from '../hooks/useProperties'
import { useMaintenanceTickets } from '../hooks/useMaintenanceTickets'
import { useTenants } from '../hooks/useTenants'
import { showToast } from '../components/Toast'
import { useBranding } from '../context/BrandingContext'
import { BrandLogo } from '../components/BrandLogo'
import { NotificationBell } from '../components/NotificationBell'

type OwnerTab = 'overview' | 'properties' | 'financials' | 'maintenance' | 'reports'

// ─── Modal Backdrop ───────────────────────────────────────────────────────────

function ModalBackdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>
  )
}

// ─── Portfolio Health Arc ─────────────────────────────────────────────────────

function PortfolioHealthArc({ score, onClick }: { score: number; onClick?: () => void }) {
  const radius = 45
  const circumference = Math.PI * radius
  const progress = (score / 100) * circumference
  const color = score >= 80 ? '#16A34A' : score >= 60 ? '#2563EB' : '#D97706'

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center group focus:outline-none"
      title="Click to see portfolio health details"
    >
      <svg width="120" height="72" viewBox="0 0 120 72">
        <path d={`M 10 62 A ${radius} ${radius} 0 0 1 110 62`} fill="none" stroke="#E5E7EB" strokeWidth="8" strokeLinecap="round" />
        <path d={`M 10 62 A ${radius} ${radius} 0 0 1 110 62`} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${progress} ${circumference}`} />
        <text x="60" y="58" textAnchor="middle" fontSize="22" fontWeight="800" fill="#111827">{score}</text>
        <text x="60" y="70" textAnchor="middle" fontSize="9" fill="#9CA3AF">/ 100</text>
      </svg>
      <p className="text-xs font-semibold text-blue-600 mt-1 group-hover:underline flex items-center gap-1">
        Portfolio Health <Info className="w-3 h-3" />
      </p>
    </button>
  )
}

// ─── Portfolio Health Modal ───────────────────────────────────────────────────

function PortfolioHealthModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'breakdown' | 'properties' | 'tips'>('breakdown')

  const factors = [
    { label: 'Occupancy Rate', score: 92, weight: 30, icon: <Home className="w-4 h-4" />, color: 'text-green-600', bg: 'bg-green-50', detail: '11 of 12 units occupied (91.7%). One vacancy at 12 Elmwood Court, Unit 2.' },
    { label: 'Rent Collection', score: 95, weight: 25, icon: <DollarSign className="w-4 h-4" />, color: 'text-green-600', bg: 'bg-green-50', detail: 'All active tenants paid on time this month. No late payments recorded.' },
    { label: 'Maintenance Response', score: 78, weight: 20, icon: <Wrench className="w-4 h-4" />, color: 'text-amber-600', bg: 'bg-amber-50', detail: '2 open tickets. Avg resolution 3.2 days — slightly above the 2-day target.' },
    { label: 'Lease Stability', score: 80, weight: 15, icon: <FileText className="w-4 h-4" />, color: 'text-amber-600', bg: 'bg-amber-50', detail: '1 lease expiring within 90 days (Jessica Park, Aug 31). Renewal conversation recommended.' },
    { label: 'Financial Health', score: 91, weight: 10, icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-600', bg: 'bg-green-50', detail: 'NOI up 9.1% YoY. Expense ratio at 8.4% of gross revenue — healthy range.' },
  ]

  const propertyScores = [
    { name: '14 Oakwood Drive', score: 91, occ: '4/4', tickets: 1, income: 5800 },
    { name: '7 Maple Lane', score: 83, occ: '4/4', tickets: 1, income: 5900 },
    { name: '12 Elmwood Court', score: 74, occ: '3/4', tickets: 0, income: 4200 },
  ]

  const tips = [
    { priority: 'High', title: 'Fill the vacant unit at 12 Elmwood Court', detail: 'Unit 2 has been vacant since May 1. At $1,850/mo estimated rent, each month vacant costs ~$1,850. List on Zillow, Apartments.com, and local channels.', impact: '+8 pts', color: 'border-red-300 bg-red-50' },
    { priority: 'Medium', title: 'Start Jessica Park\'s lease renewal', detail: 'Lease expires Aug 31, 2026 — 82 days away. Early renewal conversations reduce turnover risk significantly.', impact: '+4 pts', color: 'border-amber-300 bg-amber-50' },
    { priority: 'Medium', title: 'Close the 2 open maintenance tickets', detail: 'Faster resolution improves your maintenance response score. Target under 2 days average.', impact: '+3 pts', color: 'border-amber-300 bg-amber-50' },
    { priority: 'Low', title: 'Add property photos and documents', detail: 'Uploading lease agreements, inspection reports, and insurance docs completes your portfolio profile.', impact: '+2 pts', color: 'border-blue-200 bg-blue-50' },
  ]

  const weightedScore = Math.round(factors.reduce((sum, f) => sum + (f.score * f.weight) / 100, 0))

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #F8FAFF 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Portfolio Health Score</h2>
              <p className="text-xs text-gray-500">Updated June 11, 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-3xl font-black text-blue-600">{weightedScore}</p>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">out of 100</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white hover:bg-gray-100 flex items-center justify-center border border-gray-200"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 bg-white">
          {([['breakdown', 'Score Breakdown'], ['properties', 'By Property'], ['tips', 'How to Improve']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'breakdown' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-4">Your score is a weighted average across 5 key performance areas. Each factor is scored 0–100.</p>
              {factors.map(f => (
                <div key={f.label} className={`p-4 rounded-xl border ${f.bg} border-gray-200`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`${f.color}`}>{f.icon}</div>
                      <span className="text-sm font-semibold text-gray-900">{f.label}</span>
                      <span className="text-xs text-gray-400">({f.weight}% weight)</span>
                    </div>
                    <span className={`text-lg font-black ${f.color}`}>{f.score}</span>
                  </div>
                  <div className="w-full h-2 bg-white rounded-full border border-gray-200 mb-2">
                    <div className={`h-full rounded-full ${f.score >= 85 ? 'bg-green-500' : f.score >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${f.score}%` }} />
                  </div>
                  <p className="text-xs text-gray-600">{f.detail}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'properties' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500 mb-2">Individual scores for each of your properties.</p>
              {propertyScores.map(p => {
                const color = p.score >= 85 ? 'text-green-600' : p.score >= 70 ? 'text-amber-600' : 'text-red-600'
                const bg = p.score >= 85 ? 'bg-green-500' : p.score >= 70 ? 'bg-amber-500' : 'bg-red-500'
                return (
                  <div key={p.name} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500">Austin, TX</p>
                      </div>
                      <p className={`text-3xl font-black ${color}`}>{p.score}</p>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full mb-4">
                      <div className={`h-full rounded-full ${bg}`} style={{ width: `${p.score}%`, transition: 'width 0.8s ease' }} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Occupancy', value: p.occ },
                        { label: 'Open Tickets', value: String(p.tickets) },
                        { label: 'Monthly Income', value: `$${p.income.toLocaleString()}` },
                      ].map(s => (
                        <div key={s.label} className="bg-gray-50 rounded-lg p-2.5 text-center">
                          <p className="text-xs text-gray-500">{s.label}</p>
                          <p className="text-sm font-bold text-gray-900 mt-0.5">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {activeTab === 'tips' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-2">Actions you can take to raise your portfolio health score.</p>
              {tips.map((tip, i) => (
                <div key={i} className={`p-4 rounded-xl border-l-4 ${tip.color}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tip.priority === 'High' ? 'bg-red-100 text-red-700' : tip.priority === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{tip.priority}</span>
                        <p className="text-sm font-semibold text-gray-900">{tip.title}</p>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{tip.detail}</p>
                    </div>
                    <div className="shrink-0 text-center bg-white rounded-xl px-3 py-2 border border-gray-200 shadow-sm">
                      <p className="text-xs text-gray-400">Impact</p>
                      <p className="text-sm font-black text-green-600">{tip.impact}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mt-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-bold text-blue-900">Target Score: 95+</p>
                </div>
                <p className="text-xs text-blue-700">Completing all high and medium priority actions could raise your score by up to 15 points.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Tenant Profile Modal ─────────────────────────────────────────────────────

function TenantProfileModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const { allTenants, allTickets } = useContext(OwnerDataCtx)
  const { primaryColor } = useBranding()
  const tenant = allTenants.find(t => t.id === tenantId)
  if (!tenant) return null

  const leaseMs = new Date(tenant.leaseEnd).getTime() - Date.now()
  const daysLeft = Math.max(0, Math.round(leaseMs / 86400000))
  const propTickets = allTickets.filter(t => t.tenantId === tenant.id)

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #F8FAFF 0%, #EFF6FF 100%)' }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow" style={{ background: primaryColor }}>
                {tenant.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900">{tenant.name}</h2>
                <p className="text-sm text-gray-500">Unit {tenant.unit} · {tenant.property}</p>
                <span className={`inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full ${tenant.status === 'active' ? 'bg-green-100 text-green-700' : tenant.status === 'late' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {tenant.status === 'active' ? 'Active' : tenant.status === 'late' ? 'Late' : tenant.status === 'notice' ? 'Notice' : 'Past'}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Contact */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Contact</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="text-sm font-semibold text-gray-900">{tenant.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Phone className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Phone</p>
                  <p className="text-sm font-semibold text-gray-900">{tenant.phone}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Lease */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Lease</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Monthly Rent', value: `$${tenant.rent.toLocaleString()}` },
                { label: 'Move-in Date', value: tenant.moveIn },
                { label: 'Lease Ends', value: tenant.leaseEnd },
                { label: 'Days Remaining', value: daysLeft <= 90 ? `⚠️ ${daysLeft} days` : `${daysLeft} days` },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className={`text-sm font-bold mt-0.5 ${s.label === 'Days Remaining' && daysLeft <= 90 ? 'text-amber-600' : 'text-gray-900'}`}>{s.value}</p>
                </div>
              ))}
            </div>
            {daysLeft <= 90 && (
              <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Lease expires soon. Consider sending a renewal notice.</p>
              </div>
            )}
          </div>

          {/* Maintenance history */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Maintenance History ({propTickets.length})</p>
            {propTickets.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No tickets submitted</p>
            ) : (
              <div className="space-y-2">
                {propTickets.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                      <p className="text-xs text-gray-400">{t.id} · {t.createdAt}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.status === 'resolved' ? 'bg-green-100 text-green-700' : t.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {t.status === 'in_progress' ? 'In Progress' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Ticket Detail Modal ──────────────────────────────────────────────────────

function TicketDetailModal({ ticket, onClose }: { ticket: MaintenanceTicket; onClose: () => void }) {
  const priorityColors: Record<string, string> = {
    emergency: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  const statusColors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${priorityColors[ticket.priority]}`}>
                {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)} Priority
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColors[ticket.status]}`}>
                {ticket.status === 'in_progress' ? 'In Progress' : ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
              </span>
            </div>
            <h2 className="text-base font-bold text-gray-900">{ticket.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{ticket.id}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Description */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Description</p>
            <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-4">{ticket.description}</p>
          </div>

          {/* Details grid */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Details</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Property', value: ticket.property },
                { label: 'Unit', value: ticket.unit },
                { label: 'Category', value: ticket.category },
                { label: 'Tenant', value: ticket.tenantName },
                { label: 'Submitted', value: ticket.createdAt },
                { label: 'Last Updated', value: ticket.updatedAt },
                { label: 'Est. Cost', value: ticket.cost ? `$${ticket.cost}` : 'TBD' },
                { label: 'Actual Cost', value: ticket.cost ? `$${ticket.cost}` : '—' },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Timeline</p>
            <div className="space-y-3">
              {[
                { label: 'Ticket submitted', time: ticket.createdAt, done: true },
                { label: 'Assigned to maintenance team', time: ticket.status !== 'open' ? ticket.updatedAt : null, done: ticket.status !== 'open' },
                { label: 'Work in progress', time: ticket.status === 'in_progress' || ticket.status === 'resolved' ? ticket.updatedAt : null, done: ticket.status === 'in_progress' || ticket.status === 'resolved' },
                { label: 'Resolved & closed', time: ticket.status === 'resolved' ? ticket.updatedAt : null, done: ticket.status === 'resolved' },
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${step.done ? 'bg-green-500' : 'bg-gray-200'}`}>
                    {step.done ? <CheckCircle className="w-3 h-3 text-white" /> : <Clock className="w-3 h-3 text-gray-400" />}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${step.done ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                    {step.time && <p className="text-xs text-gray-400 mt-0.5">{step.time}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Property Manage Sheet ────────────────────────────────────────────────────

function PropertyManageSheet({ property, onClose }: { property: Property; onClose: () => void }) {
  const { allTenants, allTickets } = useContext(OwnerDataCtx)
  const { primaryColor } = useBranding()
  const [manageTab, setManageTab] = useState<'overview' | 'tenants' | 'maintenance' | 'settings'>('overview')
  const [tenantSearch, setTenantSearch] = useState('')
  const [viewTenantId, setViewTenantId] = useState<string | null>(null)
  const [viewTicket, setViewTicket] = useState<MaintenanceTicket | null>(null)
  const [visible, setVisible] = useState(false)

  // Settings state
  const [settings, setSettings] = useState({
    address: property.address,
    city: property.city,
    state: 'TX',
    zip: '78701',
    type: 'Multi-Family',
    yearBuilt: '2008',
    sqft: String(property.units * 850),
    parking: 'Covered',
    laundry: 'In-Unit',
    petPolicy: 'Cats & Dogs (under 30 lbs)',
    utilitiesWater: true,
    utilitiesTrash: true,
    utilitiesElectric: false,
    utilitiesGas: false,
    insurance: 'State Farm · Policy #SF-2847-TX',
    insuranceExpiry: 'Jan 15, 2027',
    mortgageBank: 'Chase Bank',
    mortgageBalance: '$284,000',
    mortgageRate: '3.85%',
    mortgagePayment: '$1,420/mo',
    contactName: 'BMP Central',
    contactPhone: '(512) 555-0100',
    contactEmail: 'maintenance@bmpcentral.com',
  })

  const propTickets = allTickets.filter(t => t.property === property.name || t.property === property.address)
  const propTenants = property.tenants

  const filteredTenants = propTenants.filter(t => {
    const full = allTenants.find(x => x.id === t.id)
    const q = tenantSearch.toLowerCase()
    if (!q) return true
    return t.name.toLowerCase().includes(q) ||
      t.unit.toLowerCase().includes(q) ||
      (full?.email ?? '').toLowerCase().includes(q) ||
      (full?.phone ?? '').toLowerCase().includes(q)
  })

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  const occupancyPct = Math.round((property.occupied / property.units) * 100)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />
      {/* Sheet */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out"
        style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0" style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Property</p>
            <h2 className="text-xl font-black text-white">{property.address}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{property.city} · {property.units} units</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-black text-white">${property.monthlyIncome.toLocaleString()}</p>
              <p className="text-xs text-slate-400">/month</p>
            </div>
            <button onClick={handleClose} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 border-b border-gray-100 shrink-0">
          {[
            { label: 'Occupancy', value: `${occupancyPct}%`, sub: `${property.occupied}/${property.units} units`, color: occupancyPct === 100 ? 'text-green-600' : 'text-amber-600' },
            { label: 'Open Tickets', value: String(property.openTickets), sub: 'maintenance', color: property.openTickets > 0 ? 'text-amber-600' : 'text-green-600' },
            { label: 'Monthly NOI', value: `$${(property.monthlyIncome * 0.87).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, sub: 'est. after expenses', color: 'text-blue-600' },
            { label: 'Avg Rent', value: `$${Math.round(property.monthlyIncome / (property.occupied || 1)).toLocaleString()}`, sub: 'per occupied unit', color: 'text-gray-900' },
          ].map(s => (
            <div key={s.label} className="px-4 py-3 text-center border-r border-gray-100 last:border-r-0">
              <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs font-semibold text-gray-500 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-gray-400">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 shrink-0">
          {(['overview', 'tenants', 'maintenance', 'settings'] as const).map(t => (
            <button key={t} onClick={() => setManageTab(t)} className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 transition-colors ${manageTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* OVERVIEW */}
          {manageTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Full Address', value: `${property.address}, ${property.city}` },
                  { label: 'Property Type', value: 'Multi-Family Residential' },
                  { label: 'Year Built', value: '2008' },
                  { label: 'Total Square Footage', value: `${(property.units * 850).toLocaleString()} sq ft` },
                  { label: 'Avg Unit Size', value: '850 sq ft' },
                  { label: 'Parking', value: 'Covered + Street' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-xl p-3.5">
                    <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-500 mb-1.5">
                  <span>Occupancy Rate</span>
                  <span>{property.occupied}/{property.units} units ({occupancyPct}%)</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${occupancyPct === 100 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${occupancyPct}%` }} />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Financial Summary</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {[
                    { label: 'Gross Monthly Rent', value: `$${property.monthlyIncome.toLocaleString()}`, type: 'income' },
                    { label: 'Mortgage Payment', value: '-$1,420', type: 'expense' },
                    { label: 'Insurance (monthly)', value: '-$142', type: 'expense' },
                    { label: 'Maintenance Reserve', value: '-$200', type: 'expense' },
                    { label: 'Property Tax (monthly)', value: '-$290', type: 'expense' },
                    { label: 'Net Operating Income', value: `$${(property.monthlyIncome - 1420 - 142 - 200 - 290).toLocaleString()}`, type: 'noi' },
                  ].map(row => (
                    <div key={row.label} className={`flex items-center justify-between px-4 py-2.5 ${row.type === 'noi' ? 'bg-green-50' : ''}`}>
                      <span className="text-sm text-gray-700">{row.label}</span>
                      <span className={`text-sm font-bold ${row.type === 'income' ? 'text-gray-900' : row.type === 'expense' ? 'text-red-500' : 'text-green-600'}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-bold text-blue-900">Amenities</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['In-unit W/D', 'Central A/C', 'Covered Parking', 'Pet Friendly', 'High-Speed Internet', 'Private Patio'].map(a => (
                    <span key={a} className="text-xs bg-white text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">{a}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TENANTS */}
          {manageTab === 'tenants' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search by name, unit, email, or phone…"
                  value={tenantSearch}
                  onChange={e => setTenantSearch(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                {filteredTenants.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No tenants match your search</p>
                )}
                {filteredTenants.map(t => {
                  const full = allTenants.find(x => x.id === t.id)
                  return (
                    <button
                      key={t.id}
                      onClick={() => setViewTenantId(t.id)}
                      className="w-full text-left p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: primaryColor }}>
                            {t.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700">{t.name}</p>
                            <p className="text-xs text-gray-500">Unit {t.unit} · Lease ends {t.leaseEnd}</p>
                            {full && <p className="text-xs text-gray-400">{full.email}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          <div>
                            <p className="text-sm font-black text-gray-900">${t.rent.toLocaleString()}/mo</p>
                            {full && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${full.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{full.status}</span>}
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              {property.occupied < property.units && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">{property.units - property.occupied} vacant unit{property.units - property.occupied > 1 ? 's' : ''}</p>
                    <p className="text-xs text-amber-600 mt-0.5">Est. lost revenue: ${((property.units - property.occupied) * Math.round(property.monthlyIncome / (property.occupied || 1))).toLocaleString()}/mo</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MAINTENANCE */}
          {manageTab === 'maintenance' && (
            <div className="space-y-3">
              {propTickets.length === 0 ? (
                <div className="text-center py-10">
                  <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-700">No open tickets</p>
                  <p className="text-xs text-gray-400">This property is all clear</p>
                </div>
              ) : propTickets.map(t => (
                <button
                  key={t.id}
                  onClick={() => setViewTicket(t)}
                  className="w-full text-left p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700">{t.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t.id} · {t.category} · Unit {t.unit} · {t.tenantName}</p>
                      <p className="text-xs text-gray-400 mt-1 truncate">{t.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.priority === 'emergency' ? 'bg-red-100 text-red-700' : t.priority === 'high' ? 'bg-orange-100 text-orange-700' : t.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.status === 'open' ? 'bg-blue-100 text-blue-700' : t.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {t.status === 'in_progress' ? 'In Progress' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                      </span>
                      {t.cost && <span className="text-xs font-semibold text-gray-500">${t.cost}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* SETTINGS */}
          {manageTab === 'settings' && (
            <div className="space-y-6">
              {/* Property Info */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Property Information</p>
                <div className="space-y-3">
                  {[
                    { label: 'Street Address', key: 'address' as const },
                    { label: 'City', key: 'city' as const },
                    { label: 'State', key: 'state' as const },
                    { label: 'ZIP Code', key: 'zip' as const },
                    { label: 'Property Type', key: 'type' as const },
                    { label: 'Year Built', key: 'yearBuilt' as const },
                    { label: 'Total Sq Footage', key: 'sqft' as const },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                      <input value={settings[f.key]} onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Utilities */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Utilities Included</p>
                <div className="grid grid-cols-2 gap-2">
                  {([['utilitiesWater', 'Water'], ['utilitiesTrash', 'Trash'], ['utilitiesElectric', 'Electric'], ['utilitiesGas', 'Gas']] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setSettings(s => ({ ...s, [key]: !s[key] }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${settings[key] ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                    >
                      <Zap className="w-4 h-4" /> {label} {settings[key] && <CheckCircle className="w-3.5 h-3.5 ml-auto" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Policies */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Policies</p>
                <div className="space-y-3">
                  {[
                    { label: 'Parking', key: 'parking' as const },
                    { label: 'Laundry', key: 'laundry' as const },
                    { label: 'Pet Policy', key: 'petPolicy' as const },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                      <input value={settings[f.key]} onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Insurance */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Insurance</p>
                <div className="space-y-3">
                  {[
                    { label: 'Provider & Policy Number', key: 'insurance' as const },
                    { label: 'Policy Expiration', key: 'insuranceExpiry' as const },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                      <input value={settings[f.key]} onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Mortgage */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Mortgage</p>
                <div className="space-y-3">
                  {[
                    { label: 'Lender', key: 'mortgageBank' as const },
                    { label: 'Remaining Balance', key: 'mortgageBalance' as const },
                    { label: 'Interest Rate', key: 'mortgageRate' as const },
                    { label: 'Monthly Payment', key: 'mortgagePayment' as const },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                      <input value={settings[f.key]} onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Maintenance Contact */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Maintenance Contact</p>
                <div className="space-y-3">
                  {[
                    { label: 'Contact Name', key: 'contactName' as const },
                    { label: 'Phone', key: 'contactPhone' as const },
                    { label: 'Email', key: 'contactEmail' as const },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                      <input value={settings[f.key]} onChange={e => setSettings(s => ({ ...s, [f.key]: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => showToast({ type: 'success', title: `Settings saved for ${property.address}` })}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-colors shadow"
              >
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      {viewTenantId && <TenantProfileModal tenantId={viewTenantId} onClose={() => setViewTenantId(null)} />}
      {viewTicket && <TicketDetailModal ticket={viewTicket} onClose={() => setViewTicket(null)} />}
    </>
  )
}

// ─── Report Modal ─────────────────────────────────────────────────────────────

interface ReportData { id: string; title: string }

function OwnerReportModal({ report, onClose }: { report: ReportData; onClose: () => void }) {
  const { companyName } = useBranding()
  const reportContent: Record<string, React.ReactNode> = {
    monthly: (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Revenue by Property — June 2026</h3>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100">{['Property', 'Units', 'Occ.', 'Income'].map(h => <th key={h} className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody>
            {[{ name: '14 Oakwood Drive', units: 4, occ: 4, income: 5800 }, { name: '7 Maple Lane', units: 4, occ: 4, income: 5900 }, { name: '12 Elmwood Court', units: 4, occ: 3, income: 4200 }].map(r => (
              <tr key={r.name} className="border-b border-gray-50">
                <td className="py-2 font-medium text-gray-900">{r.name}</td>
                <td className="py-2 text-gray-600">{r.units}</td>
                <td className="py-2 text-gray-600">{r.occ}</td>
                <td className="py-2 font-semibold text-green-600">${r.income.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-bold"><td className="py-2 text-gray-900">Total</td><td className="py-2">12</td><td className="py-2">11</td><td className="py-2 text-green-700">$15,900</td></tr>
          </tbody>
        </table>
        <div className="grid grid-cols-2 gap-3">
          {[{ label: 'Occupancy', value: '11/12 (91.7%)' }, { label: 'Maintenance Spend', value: '$340' }, { label: 'Outstanding Rent', value: '$0' }, { label: 'NOI', value: '$13,196' }].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">{s.label}</p><p className="text-sm font-bold text-gray-900 mt-0.5">{s.value}</p></div>
          ))}
        </div>
      </div>
    ),
    q2: (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Q2 2026 Portfolio Summary (Apr–Jun)</h3>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100">{['Month', 'Revenue', 'Expenses', 'NOI'].map(h => <th key={h} className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody>
            {[{ month: 'April 2026', rev: 14100, exp: 1190, noi: 12910 }, { month: 'May 2026', rev: 14080, exp: 1195, noi: 12885 }, { month: 'June 2026', rev: 14400, exp: 1204, noi: 13196 }].map(r => (
              <tr key={r.month} className="border-b border-gray-50">
                <td className="py-2 font-medium text-gray-900">{r.month}</td>
                <td className="py-2 text-gray-700">${r.rev.toLocaleString()}</td>
                <td className="py-2 text-red-600">${r.exp.toLocaleString()}</td>
                <td className="py-2 font-semibold text-green-600">${r.noi.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-bold"><td className="py-2 text-gray-900">Q2 Total</td><td className="py-2">$42,580</td><td className="py-2 text-red-700">$3,589</td><td className="py-2 text-green-700">$38,991</td></tr>
          </tbody>
        </table>
      </div>
    ),
    tax: (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Tax Summary — FY 2025</h3>
        <div className="grid grid-cols-2 gap-3">
          {[{ label: 'Gross Rental Income', value: '$168,000' }, { label: 'Total Deductible Expenses', value: '$14,250' }, { label: 'Net Taxable Income', value: '$153,750' }, { label: 'Depreciation (est.)', value: '$12,400' }].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">{s.label}</p><p className="text-sm font-bold text-gray-900 mt-0.5">{s.value}</p></div>
          ))}
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200"><p className="text-xs font-semibold text-amber-700 mb-1">Disclaimer</p><p className="text-sm text-amber-800">Demo only. Consult your accountant for official tax filing.</p></div>
      </div>
    ),
    lease: (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Upcoming Lease Expirations (Next 90 Days)</h3>
        <div className="space-y-3">
          {[{ name: 'Jessica Park', unit: '2A', property: '7 Maple Lane', expiry: 'Aug 31, 2026', days: 82 }].map(r => (
            <div key={r.name} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200">
              <div><p className="text-sm font-semibold text-gray-900">{r.name} — Unit {r.unit}</p><p className="text-xs text-gray-500">{r.property} · Expires {r.expiry}</p></div>
              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">{r.days} days</span>
            </div>
          ))}
        </div>
      </div>
    ),
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div><h2 className="text-base font-bold text-gray-900">{report.title}</h2><p className="text-xs text-gray-500">{companyName} · Owner Portal</p></div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6">
          {reportContent[report.id] ?? <p className="text-sm text-gray-500">Report data not available.</p>}
          <div className="flex gap-3 mt-6">
            <button onClick={() => showToast({ type: 'info', title: 'Print report' })} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Print</button>
            <button onClick={() => showToast({ type: 'info', title: 'PDF download' })} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Download PDF</button>
            <button onClick={onClose} className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Close</button>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ onShowHealth }: { onShowHealth: () => void }) {
  const { ownerName } = useContext(OwnerDataCtx)
  const { primaryColor } = useBranding()
  const [activity, setActivity] = useState<{ id: string; type: string; text: string; time: string }[]>([])
  useEffect(() => {
    supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => {
        if (data) setActivity(data.map(a => ({
          id: a.id, type: a.type, text: a.text,
          time: new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        })))
      })
  }, [])
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Greeting + health */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900">{greeting}, {ownerName.split(' ')[0]} 👋</h2>
          <p className="text-sm text-gray-500 mt-1">Wednesday, June 11, 2026 · Austin, TX</p>
          <p className="text-sm text-gray-500 mt-3 max-w-sm">Your portfolio is performing well. <strong>11 of 12 units occupied</strong> and all rents collected this month.</p>
          <div className="flex gap-3 mt-4">
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-center">
              <p className="text-xl font-black text-green-600">$14,400</p>
              <p className="text-xs text-green-700 font-semibold">Monthly Revenue</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-center">
              <p className="text-xl font-black text-blue-600">$13,196</p>
              <p className="text-xs text-blue-700 font-semibold">Net Operating Income</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-2 text-center">
              <p className="text-xl font-black text-purple-600">91.7%</p>
              <p className="text-xs text-purple-700 font-semibold">Occupancy</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <PortfolioHealthArc score={87} onClick={onShowHealth} />
          <p className="text-xs text-gray-400 mt-2">Click for details</p>
        </div>
      </div>

      {/* Alerts */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Action Required</h3>
        {[
          { title: 'Lease Expiring Soon', desc: 'Jessica Park · Unit 2A · 7 Maple Lane · expires Aug 31 (82 days)', color: 'border-amber-400 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
          { title: 'Vacant Unit', desc: '12 Elmwood Court · Unit 2 — vacant since May 1 · est. $1,850/mo lost', color: 'border-red-400 bg-red-50 text-red-800', dot: 'bg-red-500' },
        ].map((a, i) => (
          <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border-l-4 ${a.color}`}>
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold">{a.title}</p>
              <p className="text-xs mt-0.5 opacity-80">{a.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two-col: activity + upcoming */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {activity.length === 0 && <p className="text-sm text-gray-400">No recent activity</p>}
            {activity.map(a => (
              <div key={a.id} className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${a.type === 'payment' ? 'bg-green-500' : a.type === 'ticket' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                <div>
                  <p className="text-sm text-gray-800">{a.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Upcoming</h3>
          <div className="space-y-2.5">
            {[
              { icon: <Calendar className="w-4 h-4 text-blue-500" />, title: 'Lease Renewal — Robert Kim', sub: 'Due Jun 30, 2026', bg: 'bg-blue-50' },
              { icon: <Calendar className="w-4 h-4 text-blue-500" />, title: 'Lease Renewal — David Park', sub: 'Due Jul 15, 2026', bg: 'bg-blue-50' },
              { icon: <Wrench className="w-4 h-4 text-amber-500" />, title: 'AC Repair — 7 Maple Ln 3B', sub: 'Scheduled Jun 12, 2026', bg: 'bg-amber-50' },
              { icon: <Wrench className="w-4 h-4 text-amber-500" />, title: 'Plumber — 14 Oakwood Dr 1A', sub: 'Scheduled Jun 12, 2026', bg: 'bg-amber-50' },
            ].map((item, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${item.bg}`}>
                {item.icon}
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Properties Tab ───────────────────────────────────────────────────────────

function PropertiesTab() {
  const { allTenants, allProperties } = useContext(OwnerDataCtx)
  const { primaryColor } = useBranding()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tenantSearch, setTenantSearch] = useState<Record<string, string>>({})
  const [managingProperty, setManagingProperty] = useState<Property | null>(null)
  const [viewTenantId, setViewTenantId] = useState<string | null>(null)
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const properties = allProperties

  function getFilteredTenants(p: Property) {
    const q = (tenantSearch[p.id] ?? '').toLowerCase()
    if (!q) return p.tenants
    return p.tenants.filter(t => {
      const full = allTenants.find(x => x.id === t.id)
      return t.name.toLowerCase().includes(q) ||
        t.unit.toLowerCase().includes(q) ||
        (full?.email ?? '').toLowerCase().includes(q) ||
        (full?.phone ?? '').toLowerCase().includes(q)
    })
  }

  return (
    <div className="p-6 grid grid-cols-3 gap-5 max-w-6xl mx-auto">
      {properties.map(p => {
        const isExpanded = expandedId === p.id
        const filtered = getFilteredTenants(p)
        const occupancyPct = Math.round((p.occupied / p.units) * 100)

        return (
          <div key={p.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            {/* Photo header */}
            <div className="relative h-36 flex items-end p-4" style={{ background: 'linear-gradient(160deg, #0F172A 0%, #1E3A5F 100%)' }}>
              <div>
                <span className="text-white font-black text-base leading-tight">{p.address}</span>
                <p className="text-slate-400 text-xs mt-0.5">{p.city}</p>
              </div>
              <span className={`absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full ${p.occupied === p.units ? 'bg-green-400 text-green-900' : 'bg-amber-400 text-amber-900'}`}>
                {p.occupied}/{p.units} Occupied
              </span>
            </div>

            <div className="p-4 flex flex-col gap-3 flex-1">
              {/* Occupancy bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Occupancy</span>
                  <span className="font-semibold">{occupancyPct}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full">
                  <div className={`h-full rounded-full ${occupancyPct === 100 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${occupancyPct}%` }} />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Monthly Income', value: `$${p.monthlyIncome.toLocaleString()}`, color: 'text-green-600' },
                  { label: 'Open Tickets', value: String(p.openTickets), color: p.openTickets > 0 ? 'text-amber-600' : 'text-gray-700' },
                  { label: 'Units', value: String(p.units), color: 'text-gray-900' },
                  { label: 'NOI/mo', value: `$${(p.monthlyIncome * 0.87).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, color: 'text-blue-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-2.5">
                    <p className="text-[10px] text-gray-400 font-medium">{label}</p>
                    <p className={`font-black text-sm ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => setManagingProperty(p)}
                  className="flex-1 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow hover:shadow-md active:scale-95"
                  style={{ background: primaryColor }}
                >
                  Manage
                </button>
                <button
                  onClick={() => {
                    setExpandedId(isExpanded ? null : p.id)
                    setTenantSearch(s => ({ ...s, [p.id]: '' }))
                  }}
                  className={`flex-1 border text-xs font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-1 ${isExpanded ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Tenants
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Tenant dropdown — animated */}
              <div
                ref={el => { dropdownRefs.current[p.id] = el }}
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: isExpanded ? '500px' : '0px', opacity: isExpanded ? 1 : 0 }}
              >
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      className="w-full pl-8 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Search name, unit, email, phone…"
                      value={tenantSearch[p.id] ?? ''}
                      onChange={e => setTenantSearch(s => ({ ...s, [p.id]: e.target.value }))}
                    />
                  </div>
                  {/* Tenant list */}
                  {filtered.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">No matches</p>
                  )}
                  {filtered.map(t => {
                    const full = allTenants.find(x => x.id === t.id)
                    return (
                      <button
                        key={t.id}
                        onClick={() => setViewTenantId(t.id)}
                        className="w-full text-left flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: primaryColor }}>
                            {t.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 group-hover:text-blue-700 truncate">{t.name}</p>
                            <p className="text-[10px] text-gray-400">Unit {t.unit}{full ? ` · ${full.phone}` : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-bold text-gray-700">${t.rent.toLocaleString()}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {managingProperty && <PropertyManageSheet property={managingProperty} onClose={() => setManagingProperty(null)} />}
      {viewTenantId && <TenantProfileModal tenantId={viewTenantId} onClose={() => setViewTenantId(null)} />}
    </div>
  )
}

// ─── Financials Tab ───────────────────────────────────────────────────────────

function FinancialsTab() {
  const { primaryColor } = useBranding()
  const totalExpenses = expenseBreakdown.reduce((s, e) => s + e.value, 0)
  const totalRevenue = 14400
  const noi = totalRevenue - totalExpenses
  const cashFlowRows = revenueData.map(d => ({ month: d.month, revenue: d.revenue, expenses: d.expenses, noi: d.revenue - d.expenses }))

  function handleExportCSV() {
    const rows = [['Month','Revenue','Expenses','NOI'],['Jan','13200','1120','12080'],['Feb','13400','1150','12250'],['Mar','13850','1180','12670'],['Apr','14100','1190','12910'],['May','14080','1195','12885'],['Jun','14400','1204','13196']]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'bmp-financials-q2-2026.csv'; a.click()
    URL.revokeObjectURL(url)
    showToast({ type: 'success', title: 'CSV downloaded' })
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-5 gap-5">
        <div className="col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Monthly Revenue vs Expenses</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => [`$${Number(v).toLocaleString()}`, '']} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
              <Bar dataKey="revenue" fill={primaryColor} radius={[4,4,0,0]} name="Revenue" />
              <Bar dataKey="expenses" fill="#E5E7EB" radius={[4,4,0,0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Expense Breakdown</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                {expenseBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 11, color: '#6B7280' }}>{v}</span>} />
              <Tooltip formatter={v => [`$${v}`, '']} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-center text-xs text-gray-500 mt-1">Total: <span className="font-bold text-gray-900">${totalExpenses.toLocaleString()}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Gross Revenue', value: `$${totalRevenue.toLocaleString()}`, color: 'text-blue-600', bg: 'bg-white' },
          { label: 'Total Expenses', value: `$${totalExpenses.toLocaleString()}`, color: 'text-red-500', bg: 'bg-white' },
          { label: 'Net Operating Income', value: `$${noi.toLocaleString()}`, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
          { label: 'YoY Revenue Growth', value: '↑ 9.1%', color: 'text-green-600', bg: 'bg-white', sub: 'vs June 2025' },
        ].map(c => (
          <div key={c.label} className={`rounded-2xl border border-gray-200 shadow-sm p-4 ${c.bg}`}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{c.label}</p>
            <p className={`text-2xl font-black mt-1 ${c.color}`}>{c.value}</p>
            {c.sub && <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">6-Month Cash Flow</h3>
          <button onClick={handleExportCSV} className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"><Download className="w-4 h-4" /> Export CSV</button>
        </div>
        <table className="w-full">
          <thead><tr className="border-b border-gray-100">{['Month','Revenue','Expenses','NOI'].map(h => <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody>
            {cashFlowRows.map(r => (
              <tr key={r.month} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 text-sm font-semibold text-gray-900">{r.month} 2026</td>
                <td className="px-5 py-3 text-sm text-gray-700">${r.revenue.toLocaleString()}</td>
                <td className="px-5 py-3 text-sm text-gray-700">${r.expenses.toLocaleString()}</td>
                <td className="px-5 py-3 text-sm font-bold text-green-600">${r.noi.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Maintenance Tab ──────────────────────────────────────────────────────────

function OwnerMaintenanceTab() {
  const { allTickets, allProperties } = useContext(OwnerDataCtx)
  const [viewTicket, setViewTicket] = useState<MaintenanceTicket | null>(null)

  const costByProperty = allProperties.map(p => ({
    property: p.name.replace('Drive', 'Dr').replace('Lane', 'Ln').replace('Court', 'Ct'),
    cost: allTickets.filter(t => t.property === p.name).reduce((s, t) => s + (t.cost ?? 0), 0),
  }))

  const priorityBadge = (p: string) => {
    const map: Record<string, string> = { emergency: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-gray-100 text-gray-600' }
    return <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${map[p] ?? map.low}`}>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { open: 'bg-blue-100 text-blue-700', in_progress: 'bg-amber-100 text-amber-700', resolved: 'bg-green-100 text-green-700' }
    return <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${map[s]}`}>{s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}</span>
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Spend (June)', value: '$340', icon: <DollarSign className="w-5 h-5" />, color: 'text-blue-600 bg-blue-50' },
          { label: 'Open Tickets', value: '2', icon: <Wrench className="w-5 h-5" />, color: 'text-amber-600 bg-amber-50' },
          { label: 'Avg Resolution', value: '3.2 days', icon: <TrendingUp className="w-5 h-5" />, color: 'text-green-600 bg-green-50' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{k.label}</p>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${k.color}`}>{k.icon}</div>
            </div>
            <p className="text-2xl font-black text-gray-900">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">All Tickets — click to view details</p>
          </div>
          <table className="w-full">
            <thead><tr className="border-b border-gray-100">{['Ticket','Property','Priority','Status','Cost'].map(h => <th key={h} className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody>
              {allTickets.map(t => (
                <tr
                  key={t.id}
                  onClick={() => setViewTicket(t)}
                  className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors group"
                >
                  <td className="px-5 py-3">
                    <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700">{t.title}</p>
                    <p className="text-xs text-gray-400">{t.id} · Unit {t.unit}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-700">{t.property}</td>
                  <td className="px-5 py-3">{priorityBadge(t.priority)}</td>
                  <td className="px-5 py-3">{statusBadge(t.status)}</td>
                  <td className="px-5 py-3 text-sm font-bold text-gray-700">${t.cost ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Cost by Property</h3>
          <div className="space-y-4">
            {costByProperty.map(c => (
              <div key={c.property}>
                <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1.5">
                  <span className="truncate max-w-[120px]">{c.property}</span>
                  <span>${c.cost}</span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${costByProperty[0].cost > 0 ? (c.cost / Math.max(...costByProperty.map(x => x.cost))) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100 space-y-2">
            {[{ label: 'Total June Spend', value: '$340' }, { label: 'Budget Remaining', value: '$660' }, { label: 'Monthly Budget', value: '$1,000' }].map(s => (
              <div key={s.label} className="flex justify-between text-sm">
                <span className="text-gray-500">{s.label}</span>
                <span className="font-bold text-gray-900">{s.value}</span>
              </div>
            ))}
            <div className="w-full h-2 bg-gray-100 rounded-full mt-2">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: '34%' }} />
            </div>
            <p className="text-xs text-gray-400">34% of monthly budget used</p>
          </div>
        </div>
      </div>

      {viewTicket && <TicketDetailModal ticket={viewTicket} onClose={() => setViewTicket(null)} />}
    </div>
  )
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab() {
  const [autoSchedule, setAutoSchedule] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [openReport, setOpenReport] = useState<ReportData | null>(null)

  const reports = [
    { id: 'monthly', title: 'Monthly Summary', desc: 'Revenue, expenses, occupancy and maintenance summary for June 2026.', generated: 'Jun 1, 2026', icon: <BarChart2 className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50' },
    { id: 'q2', title: 'Q2 2026 Report', desc: 'Comprehensive quarterly performance report covering April–June 2026.', generated: 'Jun 10, 2026', icon: <TrendingUp className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50' },
    { id: 'tax', title: 'Tax Summary 2025', desc: 'Annual income and expense summary for tax filing purposes.', generated: 'Jan 15, 2026', icon: <FileText className="w-5 h-5 text-green-600" />, bg: 'bg-green-50' },
    { id: 'lease', title: 'Lease Expiration Report', desc: 'All upcoming lease expirations for the next 90 days.', generated: 'Jun 10, 2026', icon: <Calendar className="w-5 h-5 text-amber-600" />, bg: 'bg-amber-50' },
  ]

  function handleGenerate(report: typeof reports[number]) {
    setGenerating(report.id)
    showToast({ type: 'info', title: 'Report generating…' })
    setTimeout(() => { setGenerating(null); setOpenReport({ id: report.id, title: report.title }) }, 2000)
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="grid grid-cols-2 gap-4">
        {reports.map(r => (
          <div key={r.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${r.bg}`}>{r.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900">{r.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">{r.desc}</p>
              <p className="text-xs text-gray-400 mb-3">Last generated: {r.generated}</p>
              <button
                onClick={() => handleGenerate(r)}
                disabled={generating === r.id}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${generating === r.id ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
              >
                {generating === r.id ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating…</> : <><Download className="w-3.5 h-3.5" /> Generate</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 mb-4">Scheduled Reports</h3>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-4">
          <div>
            <p className="text-sm font-bold text-gray-900">Monthly Summary Auto-Send</p>
            <p className="text-xs text-gray-500 mt-0.5">Delivered on the 1st of each month</p>
          </div>
          <button onClick={() => { setAutoSchedule(!autoSchedule); showToast({ type: 'success', title: `Auto-send ${!autoSchedule ? 'enabled' : 'disabled'}` }) }} className={`relative w-10 h-6 rounded-full transition-colors ${autoSchedule ? 'bg-blue-600' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoSchedule ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">Email Destination</label>
          <input type="email" defaultValue="james.owner@email.com" disabled={!autoSchedule} className={`w-full max-w-sm px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${!autoSchedule ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`} />
          <button onClick={() => showToast({ type: 'success', title: 'Report settings saved' })} className="mt-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">Save</button>
        </div>
      </div>

      {openReport && <OwnerReportModal report={openReport} onClose={() => setOpenReport(null)} />}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OwnerPortal() {
  const { user, signOut } = useAuth()
  const { companyName, primaryColor } = useBranding()
  const { data: propertiesData, loading: propertiesLoading } = useProperties()
  const { data: tenantsData, loading: tenantsLoading } = useTenants()
  const { data: ticketsData, loading: ticketsLoading } = useMaintenanceTickets()
  const [activeTab, setActiveTab] = useLocalState<OwnerTab>('bmp_owner_tab', 'overview')
  const [showHealthModal, setShowHealthModal] = useState(false)

  const [allProperties, setAllProperties] = useState<Property[]>([])
  const [allTenants, setAllTenants] = useState<Tenant[]>([])
  const [allTickets, setAllTickets] = useState<MaintenanceTicket[]>([])
  // Sync once the fetch settles — syncing on `!loading` (not `data.length`) so
  // empty real results correctly clear stale or demo data.
  useEffect(() => { if (!propertiesLoading) setAllProperties(propertiesData) }, [propertiesData, propertiesLoading])
  useEffect(() => { if (!tenantsLoading) setAllTenants(tenantsData) }, [tenantsData, tenantsLoading])
  useEffect(() => { if (!ticketsLoading) setAllTickets(ticketsData) }, [ticketsData, ticketsLoading])

  const ownerName = user?.user_metadata?.full_name || user?.email || 'Owner'

  const totalUnits = allProperties.reduce((s, p) => s + p.units, 0)
  const totalOccupied = allProperties.reduce((s, p) => s + p.occupied, 0)
  const totalRevenue = allProperties.reduce((s, p) => s + p.monthlyIncome, 0)
  const openTickets = allTickets.filter(t => t.status !== 'resolved').length

  const tabs: { id: OwnerTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Home className="w-4 h-4" /> },
    { id: 'properties', label: 'Properties', icon: <Building2 className="w-4 h-4" /> },
    { id: 'financials', label: 'Financials', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" /> },
  ]

  const summaryStats = [
    { label: 'Properties', value: String(allProperties.length || '—'), color: 'text-blue-600' },
    { label: 'Total Units', value: String(totalUnits || '—'), color: 'text-gray-900' },
    { label: 'Occupied', value: totalUnits ? `${totalOccupied}/${totalUnits}` : '—', color: 'text-green-600' },
    { label: 'Monthly Revenue', value: totalRevenue ? `$${totalRevenue.toLocaleString()}` : '—', color: 'text-emerald-600' },
    { label: 'Net Income', value: totalRevenue ? `$${Math.round(totalRevenue * 0.917).toLocaleString()}` : '—', color: 'text-blue-700' },
    { label: 'Open Tickets', value: String(openTickets), color: openTickets > 0 ? 'text-amber-600' : 'text-gray-500' },
  ]

  return (
    <OwnerDataCtx.Provider value={{ allTenants, allProperties, allTickets, ownerName }}>
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <BrandLogo wrapperClassName="w-8 h-8 rounded-xl flex items-center justify-center shadow overflow-hidden" iconClassName="w-4 h-4 text-white" style={{ background: primaryColor }} />
          <div>
            <p className="font-black text-gray-900 text-sm leading-none">{companyName}</p>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider leading-none mt-0.5">Owner Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell align="right" />
          <button
            onClick={async () => { await signOut() }}
            className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full border border-gray-200 hover:border-red-200 hover:bg-red-50 transition-all"
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-black text-[10px]" style={{ background: 'linear-gradient(135deg, #7C3AED, #4C1D95)' }}>
              {ownerName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <span className="text-xs font-bold text-gray-700">{ownerName.split(' ')[0]}</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-100 px-6 py-2.5 sticky top-14 z-20">
        <div className="flex items-center gap-6 max-w-5xl">
          {summaryStats.map(s => (
            <div key={s.label} className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.label}</span>
              <span className={`text-sm font-black ${s.color}`}>{s.value}</span>
            </div>
          ))}
          <div className="ml-auto">
            <button
              onClick={() => setShowHealthModal(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors"
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> Portfolio Health: <span className="text-green-600">87</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-6 sticky top-[94px] z-10">
        <div className="flex gap-0 max-w-5xl">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-bold border-b-2 transition-all ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && <OverviewTab onShowHealth={() => setShowHealthModal(true)} />}
        {activeTab === 'properties' && <PropertiesTab />}
        {activeTab === 'financials' && <FinancialsTab />}
        {activeTab === 'maintenance' && <OwnerMaintenanceTab />}
        {activeTab === 'reports' && <ReportsTab />}
      </div>

      {showHealthModal && <PortfolioHealthModal onClose={() => setShowHealthModal(false)} />}
    </div>
    </OwnerDataCtx.Provider>
  )
}
