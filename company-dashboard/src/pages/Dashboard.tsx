import { Link } from 'react-router-dom'
import { Users, DollarSign, AlertCircle, TrendingUp, Plus, ChevronRight, Clock } from 'lucide-react'
import { StatCard } from '../components/StatCard'
import { useCompanyMetrics } from '../hooks/useCompanyMetrics'
import { useInvoices } from '../hooks/useInvoices'
import { useClients } from '../hooks/useClients'

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    void: 'bg-gray-100 text-gray-400',
  }
  return map[status] ?? 'bg-gray-100 text-gray-500'
}

function clientStatusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-blue-100 text-blue-600',
    overdue: 'bg-red-100 text-red-700',
    suspended: 'bg-orange-100 text-orange-700',
    canceled: 'bg-gray-100 text-gray-400',
  }
  return map[status] ?? 'bg-gray-100 text-gray-500'
}

export function Dashboard() {
  const { metrics, loading } = useCompanyMetrics()
  const { invoices } = useInvoices()
  const { clients } = useClients()

  const recentInvoices = invoices.slice(0, 6)
  const overdueClients = clients.filter((c) => c.status === 'overdue').slice(0, 5)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">BMP Central</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your business at a glance</p>
        </div>
        <Link
          to="/create-portal"
          className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New client
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Monthly recurring revenue"
          value={loading ? '—' : fmtMoney(metrics.mrr)}
          icon={<TrendingUp className="w-5 h-5" />}
          color="bg-blue-50 text-blue-600"
          sub={`${metrics.activeClients} active clients`}
        />
        <StatCard
          label="Collected this month"
          value={loading ? '—' : fmtMoney(metrics.paidThisMonth)}
          icon={<DollarSign className="w-5 h-5" />}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          label="Outstanding balance"
          value={loading ? '—' : fmtMoney(metrics.outstandingAmount)}
          icon={<Clock className="w-5 h-5" />}
          color="bg-yellow-50 text-yellow-600"
          sub={`${metrics.overdueCount} overdue`}
        />
        <StatCard
          label="Total clients"
          value={loading ? '—' : metrics.totalClients}
          icon={<Users className="w-5 h-5" />}
          color="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          label="Overdue invoices"
          value={loading ? '—' : metrics.overdueCount}
          icon={<AlertCircle className="w-5 h-5" />}
          color="bg-red-50 text-red-600"
          sub={metrics.overdueCount > 0 ? 'needs attention' : 'all clear'}
        />
        <StatCard
          label="Active portals"
          value={loading ? '—' : metrics.activeClients}
          icon={<Users className="w-5 h-5" />}
          color="bg-emerald-50 text-emerald-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent invoices */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent invoices</h2>
            <Link to="/invoices" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">No invoices yet</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentInvoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{inv.client_company || inv.client_name}</p>
                    <p className="text-xs text-gray-400">Due {new Date(inv.due_date).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-sm font-semibold text-gray-800">{fmtMoney(inv.amount)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(inv.status)}`}>
                      {inv.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Clients needing attention */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Clients needing attention</h2>
            <Link to="/clients" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
              All clients <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {overdueClients.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-green-600 font-medium text-sm">All clients are up to date</p>
              <p className="text-gray-400 text-xs mt-1">No overdue accounts</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {overdueClients.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/clients/${c.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.company_name}</p>
                      <p className="text-xs text-gray-400">{c.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${clientStatusBadge(c.status)}`}>
                        {c.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
