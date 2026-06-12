import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { RentRecord } from '../data/mockData'
import { rentRecords as mockRentRecords } from '../data/mockData'
import { useDemoMode } from '../context/DemoModeContext'

function transform(row: Record<string, unknown>): RentRecord {
  const dueDate = row.due_date ? new Date(row.due_date as string) : null
  const month = dueDate
    ? dueDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    month,
    amount: row.amount as number,
    datePaid: row.paid_date
      ? new Date(row.paid_date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '',
    method: '',
    status: (row.status as RentRecord['status']) ?? 'pending',
  }
}

export function useRentRecords(tenantId?: string, _month?: string) {
  const { demoMode } = useDemoMode()
  const [data, setData] = useState<RentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('rent_payments')
        .select('*')
        .order('due_date', { ascending: false })
      if (tenantId) query = query.eq('tenant_id', tenantId)
      const { data: rows, error: err } = await query
      if (err) throw err
      setData((rows ?? []).map((r) => transform(r as Record<string, unknown>)))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load rent records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (demoMode) { setData(mockRentRecords); setLoading(false); setError(null) }
    else refetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, tenantId])

  return { data, loading, error, refetch }
}
