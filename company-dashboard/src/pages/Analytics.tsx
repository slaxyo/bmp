import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { supabase } from '../lib/supabase'

interface MonthlyClient { month: string; clients: number }
interface ClientProperty { company: string; properties: number }
interface TenantStatus { name: string; value: number }
interface MonthlyRevenue { month: string; revenue: number }

const COLORS = ['#2563EB', '#7C3AED', '#DC2626', '#D97706', '#059669']

function monthLabel(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleString('default', { month: 'short', year: '2-digit' })
}

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export function Analytics() {
  const [clientGrowth, setClientGrowth] = useState<MonthlyClient[]>([])
  const [topProperties, setTopProperties] = useState<ClientProperty[]>([])
  const [tenantStatuses, setTenantStatuses] = useState<TenantStatus[]>([])
  const [revenueByMonth, setRevenueByMonth] = useState<MonthlyRevenue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { data: profiles },
        { data: properties },
        { data: tenants },
        { data: payments },
        { data: brandings },
      ] = await Promise.all([
        supabase.from('profiles').select('id, created_at').eq('role', 'admin').order('created_at'),
        supabase.from('properties').select('pm_id').order('pm_id'),
        supabase.from('tenants').select('status'),
        supabase.from('rent_payments').select('amount, paid_date, status').eq('status', 'paid').not('paid_date', 'is', null),
        supabase.from('branding').select('pm_id, company_name'),
      ])

      // Client growth by month (cumulative)
      const monthMap = new Map<string, number>()
      for (const p of profiles ?? []) {
        const key = p.created_at ? p.created_at.slice(0, 7) : ''
        if (key) monthMap.set(key, (monthMap.get(key) ?? 0) + 1)
      }
      let running = 0
      const growth: MonthlyClient[] = []
      for (const [month, count] of [...monthMap.entries()].sort()) {
        running += count
        growth.push({ month: monthLabel(month + '-01'), clients: running })
      }
      setClientGrowth(growth)

      // Properties per client (top 8)
      const propMap = new Map<string, number>()
      for (const p of properties ?? []) propMap.set(p.pm_id, (propMap.get(p.pm_id) ?? 0) + 1)
      const brandMap = new Map<string, string>()
      for (const b of brandings ?? []) brandMap.set(b.pm_id, b.company_name)
      const top = [...propMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([pmId, count]) => ({ company: brandMap.get(pmId) ?? 'Unknown', properties: count }))
      setTopProperties(top)

      // Tenant status distribution
      const statusMap = new Map<string, number>()
      for (const t of tenants ?? []) {
        const s = t.status ?? 'unknown'
        statusMap.set(s, (statusMap.get(s) ?? 0) + 1)
      }
      setTenantStatuses([...statusMap.entries()].map(([name, value]) => ({ name, value })))

      // Revenue by month (last 12 months)
      const revMap = new Map<string, number>()
      for (const p of payments ?? []) {
        const key = (p.paid_date ?? '').slice(0, 7)
        if (key) revMap.set(key, (revMap.get(key) ?? 0) + (p.amount ?? 0))
      }
      const now = new Date()
      const rev: MonthlyRevenue[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = d.toISOString().slice(0, 7)
        rev.push({ month: monthLabel(key + '-01'), revenue: revMap.get(key) ?? 0 })
      }
      setRevenueByMonth(rev)

      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  const noData = (arr: unknown[]) => arr.length === 0

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Aggregate trends across all client portals</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Client growth */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Cumulative clients</h3>
          {noData(clientGrowth) ? (
            <p className="text-center text-gray-400 py-12 text-sm">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={clientGrowth}>
                <defs>
                  <linearGradient id="clientGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [v, 'Clients']} />
                <Area type="monotone" dataKey="clients" stroke="#2563EB" fill="url(#clientGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue by month */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Monthly collected rent (last 12 mo)</h3>
          {noData(revenueByMonth.filter((r) => r.revenue > 0)) ? (
            <p className="text-center text-gray-400 py-12 text-sm">No payment data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueByMonth}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => '$' + (v / 1000).toFixed(0) + 'k'} />
                <Tooltip formatter={(v) => [fmtMoney(Number(v)), 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#059669" fill="url(#revGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Properties per client */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Properties per client (top 8)</h3>
          {noData(topProperties) ? (
            <p className="text-center text-gray-400 py-12 text-sm">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProperties} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="company" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(v) => [v, 'Properties']} />
                <Bar dataKey="properties" fill="#7C3AED" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tenant status pie */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Tenant status distribution</h3>
          {noData(tenantStatuses) ? (
            <p className="text-center text-gray-400 py-12 text-sm">No tenant data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={tenantStatuses}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                  labelLine={false}
                >
                  {tenantStatuses.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconSize={10} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
