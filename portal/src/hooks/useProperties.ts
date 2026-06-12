import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Property } from '../data/mockData'
import { properties as mockProperties } from '../data/mockData'
import { useDemoMode } from '../context/DemoModeContext'

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function transform(row: Record<string, unknown>): Property {
  const units = (row.units as Record<string, unknown>[] | null) ?? []

  const allTenants = units.flatMap((u) => {
    const ts = (u.tenants as Record<string, unknown>[]) ?? []
    return ts.map((t) => ({ ...t, unit_number: u.unit_number }))
  })

  const allTickets = units.flatMap((u) =>
    (u.maintenance_requests as Record<string, unknown>[]) ?? []
  )

  return {
    id: row.id as string,
    name: row.name as string,
    address: (row.address as string) ?? '',
    city: (row.city as string) ?? '',
    units: units.length,
    occupied: allTenants.filter((t) => t.status !== 'notice').length,
    monthlyIncome: allTenants.reduce((sum, t) => sum + ((t.monthly_rent as number) ?? 0), 0),
    openTickets: allTickets.filter((t) => t.status !== 'resolved').length,
    tenants: allTenants.map((t) => ({
      id: t.id as string,
      name: t.name as string,
      unit: t.unit_number as string,
      rent: (t.monthly_rent as number) ?? 0,
      leaseEnd: fmtDate(t.lease_end as string | null),
    })),
  }
}

export function useProperties() {
  const { demoMode } = useDemoMode()
  const [data, setData] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: err } = await supabase
        .from('properties')
        .select(`
          id, name, address, city,
          units(
            id, unit_number, rent_amount, status,
            tenants(id, name, monthly_rent, status, lease_end),
            maintenance_requests(id, status)
          )
        `)
        .order('created_at', { ascending: true })
      if (err) throw err
      setData((rows ?? []).map((r) => transform(r as Record<string, unknown>)))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load properties')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (demoMode) { setData(mockProperties); setLoading(false); setError(null) }
    else refetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode])

  return { data, loading, error, refetch }
}
