import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface CompanyMetrics {
  totalClients: number
  activeClients: number
  mrr: number
  outstandingAmount: number
  overdueCount: number
  paidThisMonth: number
}

export function useCompanyMetrics() {
  const [metrics, setMetrics] = useState<CompanyMetrics>({
    totalClients: 0,
    activeClients: 0,
    mrr: 0,
    outstandingAmount: 0,
    overdueCount: 0,
    paidThisMonth: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [
        { data: clients },
        { data: invoices },
      ] = await Promise.all([
        supabase.from('bmp_clients').select('status, monthly_fee'),
        supabase.from('bmp_invoices').select('amount, status, paid_date'),
      ])

      const activeClients = (clients ?? []).filter((c) => c.status === 'active')
      const mrr = activeClients.reduce((s, c) => s + (c.monthly_fee ?? 0), 0)

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

      const outstandingAmount = (invoices ?? [])
        .filter((i) => i.status === 'pending' || i.status === 'overdue')
        .reduce((s, i) => s + (i.amount ?? 0), 0)

      const overdueCount = (invoices ?? []).filter((i) => i.status === 'overdue').length

      const paidThisMonth = (invoices ?? [])
        .filter((i) => i.status === 'paid' && i.paid_date && i.paid_date >= monthStart)
        .reduce((s, i) => s + (i.amount ?? 0), 0)

      setMetrics({
        totalClients: (clients ?? []).length,
        activeClients: activeClients.length,
        mrr,
        outstandingAmount,
        overdueCount,
        paidThisMonth,
      })
      setLoading(false)
    }
    load()
  }, [])

  return { metrics, loading }
}
