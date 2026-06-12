import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { MaintenanceTicket } from '../data/mockData'
import { maintenanceTickets as mockTickets } from '../data/mockData'
import { useDemoMode } from '../context/DemoModeContext'

function transform(row: Record<string, unknown>): MaintenanceTicket {
  const tenant = row.tenants as Record<string, unknown> | null
  const unit = row.units as Record<string, unknown> | null
  const property = unit?.properties as Record<string, unknown> | null
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return {
    id: row.id as string,
    tenantId: (row.tenant_id as string) ?? '',
    tenantName: (tenant?.name as string) ?? '',
    unit: (unit?.unit_number as string) ?? '',
    property: (property?.name as string) ?? '',
    category: 'General',
    title: row.title as string,
    description: (row.description as string) ?? '',
    priority: (row.priority as MaintenanceTicket['priority']) ?? 'medium',
    status: (row.status as MaintenanceTicket['status']) ?? 'open',
    createdAt: row.created_at ? fmt(row.created_at as string) : '',
    updatedAt: row.updated_at ? fmt(row.updated_at as string) : '',
  }
}

export function useMaintenanceTickets(propertyId?: string, tenantId?: string) {
  const { demoMode } = useDemoMode()
  const [data, setData] = useState<MaintenanceTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('maintenance_requests')
        .select('*, tenants!tenant_id(name), units!unit_id(unit_number, property_id, properties!property_id(name))')
        .order('created_at', { ascending: false })
      if (tenantId) query = query.eq('tenant_id', tenantId)
      const { data: rows, error: err } = await query
      if (err) throw err
      // maintenance_requests has no direct property_id — filter via the joined unit
      const filtered = (rows ?? []).filter((r) => {
        if (!propertyId) return true
        const unit = (r as Record<string, unknown>).units as Record<string, unknown> | null
        return (unit?.property_id as string) === propertyId
      })
      setData(filtered.map((r) => transform(r as Record<string, unknown>)))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (demoMode) { setData(mockTickets); setLoading(false); setError(null) }
    else refetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, propertyId, tenantId])

  return { data, loading, error, refetch }
}
