import { useState } from 'react'
import {
  Building2, DollarSign, Wrench, TrendingUp, Bell,
  ChevronDown, ChevronUp, Download, FileText, Calendar,
  AlertTriangle, BarChart2, RefreshCw, X, Users,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { revenueData, expenseBreakdown, maintenanceTickets, properties, activityFeed } from '../data/mockData'
import type { Property } from '../data/mockData'
import { showToast } from '../components/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type OwnerTab = 'overview' | 'properties' | 'financials' | 'maintenance' | 'reports'

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

// ─── Portfolio Health Arc ─────────────────────────────────────────────────────

function PortfolioHealthArc({ score }: { score: number }) {
  const radius = 45
  const circumference = Math.PI * radius // half circle
  const progress = (score / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70">
        {/* Track */}
        <path
          d={`M 10 60 A ${radius} ${radius} 0 0 1 110 60`}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Progress */}
        <path
          d={`M 10 60 A ${radius} ${radius} 0 0 1 110 60`}
          fill="none"
          stroke="#2563EB"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
        />
        <text x="60" y="58" textAnchor="middle" fontSize="20" fontWeight="800" fill="#0A0A0A">
          {score}
        </text>
        <text x="60" y="70" textAnchor="middle" fontSize="9" fill="#6B7280">
          / 100
        </text>
      </svg>
      <p className="text-xs font-semibold text-blue-600 mt-1">Portfolio Health</p>
    </div>
  )
}

// ─── Property Manage Modal ────────────────────────────────────────────────────

function PropertyManageModal({ property, onClose }: { property: Property; onClose: () => void }) {
  const [manageTab, setManageTab] = useState<'overview' | 'tenants' | 'maintenance' | 'settings'>('overview')
  const [editAddress, setEditAddress] = useState(property.address)
  const [editRentDefault, setEditRentDefault] = useState(
    property.tenants.length > 0 ? String(property.tenants[0].rent) : '1400'
  )

  const propTickets = maintenanceTickets.filter((t) => t.property === property.name || t.property === property.address)

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{property.address}</h2>
            <p className="text-xs text-gray-500">{property.city}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        {/* Manage tabs */}
        <div className="flex border-b border-gray-100 px-6">
          {(['overview', 'tenants', 'maintenance', 'settings'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setManageTab(t)}
              className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 transition-colors ${manageTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-6">
          {manageTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Address', value: property.address },
                  { label: 'City', value: property.city },
                  { label: 'Total Units', value: String(property.units) },
                  { label: 'Monthly Income', value: `$${property.monthlyIncome.toLocaleString()}` },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Occupancy</span>
                  <span>{property.occupied}/{property.units} ({Math.round((property.occupied / property.units) * 100)}%)</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${(property.occupied / property.units) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {manageTab === 'tenants' && (
            <div className="space-y-3">
              {property.tenants.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No tenants in this property</p>
              ) : property.tenants.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500">Unit {t.unit} · Lease ends {t.leaseEnd}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-700">${t.rent.toLocaleString()}/mo</span>
                </div>
              ))}
            </div>
          )}

          {manageTab === 'maintenance' && (
            <div className="space-y-3">
              {propTickets.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No open tickets for this property</p>
              ) : propTickets.map((t) => (
                <div key={t.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                    <p className="text-xs text-gray-500">{t.id} · {t.category} · Unit {t.unit}</p>
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

          {manageTab === 'settings' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Property Address</label>
                <input
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Default Monthly Rent ($)</label>
                <input
                  type="number"
                  value={editRentDefault}
                  onChange={(e) => setEditRentDefault(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => showToast({ type: 'success', title: `Settings saved for ${property.address}` })}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl text-sm transition-colors"
              >
                Save Settings
              </button>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose} className="w-full border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-colors">Close</button>
        </div>
      </div>
    </ModalBackdrop>
  )
}

// ─── Report Modal ─────────────────────────────────────────────────────────────

interface ReportData {
  id: string
  title: string
}

function OwnerReportModal({ report, onClose }: { report: ReportData; onClose: () => void }) {
  const reportContent: Record<string, React.ReactNode> = {
    monthly: (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Revenue by Property — June 2026</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['Property', 'Units', 'Occ.', 'Income'].map((h) => (
                <th key={h} className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { name: '14 Oakwood Drive', units: 4, occ: 4, income: 5800 },
              { name: '7 Maple Lane', units: 4, occ: 4, income: 5900 },
              { name: '12 Elmwood Court', units: 4, occ: 3, income: 4200 },
            ].map((r) => (
              <tr key={r.name} className="border-b border-gray-50">
                <td className="py-2 font-medium text-gray-900">{r.name}</td>
                <td className="py-2 text-gray-600">{r.units}</td>
                <td className="py-2 text-gray-600">{r.occ}</td>
                <td className="py-2 font-semibold text-green-600">${r.income.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-bold">
              <td className="py-2 text-gray-900">Total</td>
              <td className="py-2">12</td>
              <td className="py-2">11</td>
              <td className="py-2 text-green-700">$15,900</td>
            </tr>
          </tbody>
        </table>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Occupancy', value: '11/12 (91.7%)' },
            { label: 'Maintenance Spend', value: '$340' },
            { label: 'Outstanding Rent', value: '$0' },
            { label: 'NOI', value: '$13,196' },
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
      </div>
    ),
    q2: (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Q2 2026 Portfolio Summary (Apr–Jun)</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['Month', 'Revenue', 'Expenses', 'NOI'].map((h) => (
                <th key={h} className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { month: 'April 2026', rev: 14100, exp: 1190, noi: 12910 },
              { month: 'May 2026', rev: 14080, exp: 1195, noi: 12885 },
              { month: 'June 2026', rev: 14400, exp: 1204, noi: 13196 },
            ].map((r) => (
              <tr key={r.month} className="border-b border-gray-50">
                <td className="py-2 font-medium text-gray-900">{r.month}</td>
                <td className="py-2 text-gray-700">${r.rev.toLocaleString()}</td>
                <td className="py-2 text-red-600">${r.exp.toLocaleString()}</td>
                <td className="py-2 font-semibold text-green-600">${r.noi.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-bold">
              <td className="py-2 text-gray-900">Q2 Total</td>
              <td className="py-2 text-gray-900">$42,580</td>
              <td className="py-2 text-red-700">$3,589</td>
              <td className="py-2 text-green-700">$38,991</td>
            </tr>
          </tbody>
        </table>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-700 mb-1">Q2 Highlights</p>
          <p className="text-sm text-blue-800">Revenue increased 2.1% vs Q1. Avg occupancy 91.7%. 3 maintenance tickets resolved. 1 unit vacant since May 1.</p>
        </div>
      </div>
    ),
    tax: (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Tax Summary — FY 2025</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Gross Rental Income', value: '$168,000' },
            { label: 'Total Deductible Expenses', value: '$14,250' },
            { label: 'Net Taxable Income', value: '$153,750' },
            { label: 'Depreciation (est.)', value: '$12,400' },
          ].map((s) => (
            <div key={s.label} className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <p className="text-xs font-semibold text-amber-700 mb-1">Disclaimer</p>
          <p className="text-sm text-amber-800">This is a demo summary. Please consult your accountant for official tax filing. BMP Central does not provide tax advice.</p>
        </div>
      </div>
    ),
    lease: (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Upcoming Lease Expirations (Next 90 Days)</h3>
        <div className="space-y-3">
          {[
            { name: 'Jessica Park', unit: '2A', property: '7 Maple Lane', expiry: 'Aug 31, 2026', days: 82 },
            { name: 'David Park', unit: '3B', property: '7 Maple Lane', expiry: 'Sep 30, 2026', days: 112 },
            { name: 'Robert Kim', unit: '1B', property: '14 Oakwood Drive', expiry: 'Nov 30, 2026', days: 173 },
          ].filter((r) => r.days <= 90).map((r) => (
            <div key={r.name} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200">
              <div>
                <p className="text-sm font-semibold text-gray-900">{r.name} — Unit {r.unit}</p>
                <p className="text-xs text-gray-500">{r.property} · Expires {r.expiry}</p>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">{r.days} days</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500">1 lease expiring within 90 days. Consider sending renewal notices early.</p>
      </div>
    ),
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{report.title}</h2>
            <p className="text-xs text-gray-500">BMP Central · Owner Portal</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6">
          {reportContent[report.id] ?? <p className="text-sm text-gray-500">Report data not available.</p>}
          <div className="flex gap-3 mt-6">
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

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="p-6 space-y-6">
      {/* Greeting + health */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Good morning, James</h2>
          <p className="text-sm text-gray-500 mt-1">Tuesday, June 10, 2026 · Austin, TX</p>
          <p className="text-sm text-gray-400 mt-2">Your portfolio is performing well. 11 of 12 units occupied.</p>
        </div>
        <div className="flex flex-col items-center">
          <PortfolioHealthArc score={87} />
          <div className="flex gap-3 mt-2 text-xs">
            <span className="flex items-center gap-1 text-gray-500"><span className="w-2 h-2 rounded-full bg-gray-200 inline-block" /> Track</span>
            <span className="flex items-center gap-1 text-blue-600 font-semibold"><span className="w-2 h-2 rounded-full bg-blue-600 inline-block" /> Score</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-gray-800">Alerts</h3>
        {[
          {
            title: 'Lease Expiring Soon',
            desc: 'Jessica Park, Unit 2A · 7 Maple Lane · Aug 31, 2026 (82 days)',
            color: 'border-amber-400 bg-amber-50',
            textColor: 'text-amber-800',
            iconColor: 'text-amber-500',
          },
          {
            title: 'Vacant Unit',
            desc: '12 Elmwood Court, Unit 2 — Vacant since May 1 · Est. $1,850/mo lost revenue',
            color: 'border-amber-400 bg-amber-50',
            textColor: 'text-amber-800',
            iconColor: 'text-amber-500',
          },
        ].map((alert, i) => (
          <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border-l-4 ${alert.color}`}>
            <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${alert.iconColor}`} />
            <div>
              <p className={`text-sm font-semibold ${alert.textColor}`}>{alert.title}</p>
              <p className={`text-xs mt-0.5 ${alert.textColor} opacity-80`}>{alert.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two column: activity + upcoming */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-base font-bold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {activityFeed.slice(0, 5).map((a) => (
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

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-base font-bold text-gray-900 mb-4">Upcoming</h3>
          <div className="space-y-3">
            {[
              { icon: <Calendar className="w-4 h-4 text-blue-500" />, title: 'Lease Renewal — Robert Kim', sub: 'Due Jun 30, 2026', bg: 'bg-blue-50' },
              { icon: <Calendar className="w-4 h-4 text-blue-500" />, title: 'Lease Renewal — David Park', sub: 'Due Jul 15, 2026', bg: 'bg-blue-50' },
              { icon: <Wrench className="w-4 h-4 text-amber-500" />, title: 'AC Repair — 7 Maple Ln 3B', sub: 'Scheduled Jun 12, 2026', bg: 'bg-amber-50' },
              { icon: <Wrench className="w-4 h-4 text-amber-500" />, title: 'Plumber — 14 Oakwood Dr 1A', sub: 'Scheduled Jun 12, 2026', bg: 'bg-amber-50' },
            ].map((item, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${item.bg}`}>
                {item.icon}
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [managingProperty, setManagingProperty] = useState<Property | null>(null)

  return (
    <div className="p-6 grid grid-cols-3 gap-5">
      {properties.map((p) => (
        <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Photo placeholder */}
          <div className="relative h-32 bg-gradient-to-br from-slate-600 to-slate-800 flex items-end p-3">
            <div>
              <span className="text-white font-bold text-sm">{p.address}</span>
              <p className="text-slate-300 text-xs">{p.city}</p>
            </div>
            <span className={`absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full ${
              p.occupied === p.units ? 'bg-green-400 text-green-900' : 'bg-amber-400 text-amber-900'
            }`}>
              {p.occupied}/{p.units} Occupied
            </span>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { label: 'Units', value: p.units },
                { label: 'Occupied', value: p.occupied },
                { label: 'Income/mo', value: `$${p.monthlyIncome.toLocaleString()}` },
                { label: 'Open Tickets', value: p.openTickets, amber: p.openTickets > 0 },
              ].map(({ label, value, amber }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`font-bold text-sm ${amber ? 'text-amber-600' : 'text-gray-900'}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setManagingProperty(p)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
              >
                Manage
              </button>
              <button
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <Users className="w-3.5 h-3.5" />
                Tenants
                {expandedId === p.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {expandedId === p.id && (
              <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                {p.tenants.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400">Unit {t.unit} · Lease ends {t.leaseEnd}</p>
                    </div>
                    <span className="font-semibold text-gray-700">${t.rent.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      {managingProperty && (
        <PropertyManageModal property={managingProperty} onClose={() => setManagingProperty(null)} />
      )}
    </div>
  )
}

// ─── Financials Tab ───────────────────────────────────────────────────────────

function FinancialsTab() {
  const totalExpenses = expenseBreakdown.reduce((s, e) => s + e.value, 0)
  const totalRevenue = 14400
  const noi = totalRevenue - totalExpenses

  const cashFlowRows = revenueData.map((d) => ({
    month: d.month,
    revenue: d.revenue,
    expenses: d.expenses,
    noi: d.revenue - d.expenses,
  }))

  function handleExportCSV() {
    const rows = [
      ['Month', 'Revenue', 'Expenses', 'NOI'],
      ['January 2026', '13200', '1120', '12080'],
      ['February 2026', '13400', '1150', '12250'],
      ['March 2026', '13850', '1180', '12670'],
      ['April 2026', '14100', '1190', '12910'],
      ['May 2026', '14080', '1195', '12885'],
      ['June 2026', '14400', '1204', '13196'],
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bmp-central-financials-q2-2026.csv'
    a.click()
    URL.revokeObjectURL(url)
    showToast({ type: 'success', title: 'Financials CSV downloaded' })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Revenue + Expense charts side-by-side */}
      <div className="grid grid-cols-5 gap-5">
        {/* Revenue chart */}
        <div className="col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-base font-bold text-gray-900 mb-4">Monthly Revenue vs Expenses</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [`$${Number(v).toLocaleString()}`, '']} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
              <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar dataKey="expenses" fill="#E5E7EB" radius={[4, 4, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense breakdown */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-base font-bold text-gray-900 mb-4">Expense Breakdown</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={expenseBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                dataKey="value"
                strokeWidth={0}
              >
                {expenseBreakdown.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span style={{ fontSize: 11, color: '#6B7280' }}>{value}</span>}
              />
              <Tooltip formatter={(v) => [`$${v}`, '']} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-center text-xs text-gray-500 mt-1">Total: <span className="font-bold text-gray-900">${totalExpenses.toLocaleString()}</span></p>
        </div>
      </div>

      {/* NOI cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Gross Revenue', value: `$${totalRevenue.toLocaleString()}`, color: 'text-blue-600', bg: 'bg-white' },
          { label: 'Total Expenses', value: `$${totalExpenses.toLocaleString()}`, color: 'text-red-500', bg: 'bg-white' },
          { label: 'Net Operating Income', value: `$${noi.toLocaleString()}`, color: 'text-green-600', bg: 'bg-blue-50 border-blue-100' },
          { label: 'YoY Revenue Growth', value: '↑ 9.1%', color: 'text-green-600', bg: 'bg-white', sub: 'vs June 2025' },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border border-gray-200 shadow-sm p-4 ${c.bg}`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
            {c.sub && <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Cash flow table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">6-Month Cash Flow Summary</h3>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {['Month', 'Revenue', 'Expenses', 'NOI'].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cashFlowRows.map((r) => (
              <tr key={r.month} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-gray-900">{r.month} 2026</td>
                <td className="px-5 py-3 text-sm text-gray-700">${r.revenue.toLocaleString()}</td>
                <td className="px-5 py-3 text-sm text-gray-700">${r.expenses.toLocaleString()}</td>
                <td className="px-5 py-3 text-sm font-semibold text-green-600">${r.noi.toLocaleString()}</td>
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
  const costByProperty = [
    { property: '14 Oakwood Dr', cost: 120 },
    { property: '7 Maple Lane', cost: 220 },
    { property: '12 Elmwood Ct', cost: 0 },
  ]

  const priorityBadge = (p: string) => {
    if (p === 'emergency') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">Emergency</span>
    if (p === 'high') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700">High</span>
    if (p === 'medium') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">Medium</span>
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">Low</span>
  }

  const statusBadge = (s: string) => {
    if (s === 'open') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">Open</span>
    if (s === 'in_progress') return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">In Progress</span>
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">Resolved</span>
  }

  return (
    <div className="p-6 space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Spend (June)', value: '$340', icon: <DollarSign className="w-5 h-5" />, color: 'text-blue-600 bg-blue-50' },
          { label: 'Open Tickets', value: '2', icon: <Wrench className="w-5 h-5" />, color: 'text-amber-600 bg-amber-50' },
          { label: 'Avg Resolution', value: '3.2 days', icon: <TrendingUp className="w-5 h-5" />, color: 'text-green-600 bg-green-50' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{k.label}</p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.color}`}>{k.icon}</div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Table + chart */}
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Ticket', 'Property', 'Priority', 'Status', 'Cost'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {maintenanceTickets.map((t) => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                    <p className="text-xs text-gray-400">{t.id}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-700">{t.property}</td>
                  <td className="px-5 py-3">{priorityBadge(t.priority)}</td>
                  <td className="px-5 py-3">{statusBadge(t.status)}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-gray-700">${t.cost ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Cost by Property</h3>
          <div className="space-y-3">
            {costByProperty.map((c) => (
              <div key={c.property}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span className="truncate max-w-[120px]">{c.property}</span>
                  <span className="font-semibold">${c.cost}</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${costByProperty[0].cost > 0 ? (c.cost / Math.max(...costByProperty.map(x => x.cost))) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab() {
  const [autoSchedule, setAutoSchedule] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [openReport, setOpenReport] = useState<ReportData | null>(null)

  const reports = [
    { id: 'monthly', title: 'Monthly Summary', desc: 'Revenue, expenses, occupancy and maintenance summary for June 2026.', generated: 'Jun 1, 2026', icon: <BarChart2 className="w-5 h-5 text-blue-600" /> },
    { id: 'q2', title: 'Q2 2026 Report', desc: 'Comprehensive quarterly performance report covering April–June 2026.', generated: 'Jun 10, 2026', icon: <TrendingUp className="w-5 h-5 text-purple-600" /> },
    { id: 'tax', title: 'Tax Summary 2025', desc: 'Annual income and expense summary prepared for tax filing purposes.', generated: 'Jan 15, 2026', icon: <FileText className="w-5 h-5 text-green-600" /> },
    { id: 'lease', title: 'Lease Expiration Report', desc: 'All upcoming lease expirations for the next 90 days across your portfolio.', generated: 'Jun 10, 2026', icon: <Calendar className="w-5 h-5 text-amber-600" /> },
  ]

  function handleGenerate(report: typeof reports[number]) {
    setGenerating(report.id)
    showToast({ type: 'info', title: 'Report generating…' })
    setTimeout(() => {
      setGenerating(null)
      setOpenReport({ id: report.id, title: report.title })
    }, 2000)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {reports.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              r.id === 'monthly' ? 'bg-blue-50' :
              r.id === 'q2' ? 'bg-purple-50' :
              r.id === 'tax' ? 'bg-green-50' :
              'bg-amber-50'
            }`}>
              {r.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{r.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">{r.desc}</p>
              <p className="text-xs text-gray-400 mb-3">Last generated: {r.generated}</p>
              <button
                onClick={() => handleGenerate(r)}
                disabled={generating === r.id}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  generating === r.id
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {generating === r.id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" /> Generate
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Scheduled Reports */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Scheduled Reports</h3>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Monthly Summary Auto-Send</p>
            <p className="text-xs text-gray-500">Delivered on the 1st of each month</p>
          </div>
          <button
            onClick={() => {
              setAutoSchedule(!autoSchedule)
              showToast({ type: 'success', title: `Monthly auto-send ${!autoSchedule ? 'enabled' : 'disabled'}` })
            }}
            className={`relative w-10 h-6 rounded-full transition-colors ${autoSchedule ? 'bg-blue-600' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoSchedule ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Email Destination</label>
          <input
            type="email"
            defaultValue="james.owner@email.com"
            disabled={!autoSchedule}
            className={`w-full max-w-sm px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${!autoSchedule ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''}`}
          />
          <button
            onClick={() => showToast({ type: 'success', title: 'Report email settings saved' })}
            className="mt-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {openReport && <OwnerReportModal report={openReport} onClose={() => setOpenReport(null)} />}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OwnerPortal() {
  const [activeTab, setActiveTab] = useState<OwnerTab>('overview')

  const tabs: { id: OwnerTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'properties', label: 'Properties' },
    { id: 'financials', label: 'Financials' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'reports', label: 'Reports' },
  ]

  const summaryStats = [
    { label: 'Properties', value: '3', color: 'text-blue-600' },
    { label: 'Units', value: '12', color: 'text-purple-600' },
    { label: 'Occupied', value: '11/12', color: 'text-green-600' },
    { label: 'Monthly Revenue', value: '$14,400', color: 'text-emerald-600' },
    { label: 'Open Tickets', value: '2', color: 'text-amber-600' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900">BMP Central</p>
            <p className="text-xs text-gray-400">Owner Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-colors">
            <Bell className="w-4 h-4 text-gray-500" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            JO
          </div>
        </div>
      </header>

      {/* Sticky stats bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-[73px] z-20">
        <div className="flex items-center gap-8">
          {summaryStats.map((s) => (
            <div key={s.label} className="flex flex-col">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{s.label}</span>
              <span className={`text-base font-bold ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6 sticky top-[121px] z-10">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'properties' && <PropertiesTab />}
        {activeTab === 'financials' && <FinancialsTab />}
        {activeTab === 'maintenance' && <OwnerMaintenanceTab />}
        {activeTab === 'reports' && <ReportsTab />}
      </div>
    </div>
  )
}
