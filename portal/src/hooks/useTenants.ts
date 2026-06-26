import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Tenant } from '../data/mockData'
import { tenants as mockTenants } from '../data/mockData'
import { useDemoMode } from '../context/DemoModeContext'

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function transform(row: Record<string, unknown>): Tenant {
  const unit = row.units as Record<string, unknown> | null
  const property = unit?.properties as Record<string, unknown> | null
  return {
    id: row.id as string,
    name: row.name as string,
    unit: (unit?.unit_number as string) ?? '',
    property: (property?.name as string) ?? '',
    propertyId: (unit?.property_id as string) ?? undefined,
    rent: (row.monthly_rent as number) ?? 0,
    leaseEnd: fmtDate(row.lease_end as string | null),
    status: (row.status as Tenant['status']) ?? 'active',
    email: (row.email as string) ?? '',
    phone: (row.phone as string) ?? '',
    moveIn: fmtDate(row.lease_start as string | null),
    rentDueDay: (row.rent_due_day as number | null) ?? null,
  }
}

export function useTenants() {
  const { demoMode } = useDemoMode()
  const [data, setData] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: err } = await supabase
        .from('tenants')
        .select('*, units!unit_id(unit_number, property_id, properties!property_id(name))')
        .order('created_at', { ascending: true })
      if (err) throw err
      setData((rows ?? []).map(transform))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (demoMode) { setData(mockTenants); setLoading(false); setError(null) }
    else refetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode])

  return { data, loading, error, refetch }
}

export function useCurrentTenant() {
  const { demoMode } = useDemoMode()
  const [data, setData] = useState<Tenant | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [pmId, setPmId] = useState<string | null>(null)
  const [unitId, setUnitId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (demoMode) {
      setData(mockTenants[0])
      setTenantId(mockTenants[0].id)
      setLoading(false)
      return
    }
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const select = '*, units!unit_id(unit_number, property_id, properties!property_id(name))'
      // Tenant row is keyed by auth uid when self-registered, or matched by
      // email when the PM created the row before the tenant signed up
      let { data: row, error: err } = await supabase
        .from('tenants')
        .select(select)
        .eq('id', user.id)
        .maybeSingle()
      if (!row && !err && user.email) {
        ({ data: row, error: err } = await supabase
          .from('tenants')
          .select(select)
          .ilike('email', user.email)
          .maybeSingle())
      }
      if (err) { setError(err.message); setLoading(false); return }
      if (row) {
        const r = row as Record<string, unknown>
        setData(transform(r))
        setTenantId(r.id as string)
        setPmId(r.pm_id as string)
        setUnitId((r.unit_id as string) ?? null)
      }
      setLoading(false)
    }
    fetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode])

  return { data, tenantId, pmId, unitId, loading, error }
}
