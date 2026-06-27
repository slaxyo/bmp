import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, ChevronRight, Users } from 'lucide-react'
import { useClients } from '../hooks/useClients'

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-blue-100 text-blue-600',
    overdue: 'bg-red-100 text-red-700',
    suspended: 'bg-orange-100 text-orange-700',
    canceled: 'bg-gray-100 text-gray-400',
  }
  return map[status] ?? 'bg-gray-100 text-gray-500'
}

const STATUS_FILTERS = ['all', 'active', 'overdue', 'pending', 'suspended', 'canceled']

export function ClientList() {
  const { clients, loading } = useClients()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = clients.filter((c) => {
    const matchesQuery =
      c.company_name.toLowerCase().includes(query.toLowerCase()) ||
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.email.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter
    return matchesQuery && matchesStatus
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clients.length} total clients</p>
        </div>
        <Link
          to="/create-portal"
          className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          New client
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-56"
          />
        </div>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{query ? 'No clients match your search.' : 'No clients yet.'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Plan</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Monthly fee</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Portal</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{c.company_name}</p>
                    <p className="text-xs text-gray-400">{c.name} · {c.email}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <span className="capitalize text-gray-600">{c.plan}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium text-gray-800 hidden sm:table-cell">
                    {fmtMoney(c.monthly_fee)}<span className="text-xs text-gray-400 font-normal">/mo</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    {c.portal_pm_id ? (
                      <span className="text-xs text-green-600 font-medium">✓ Active</span>
                    ) : (
                      <span className="text-xs text-gray-400">Not provisioned</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      to={`/clients/${c.id}`}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium"
                    >
                      Manage <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
