import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useDemoMode } from '../context/DemoModeContext'

export interface DocEntry {
  id: string
  name: string
  type: string
  date: string
  size: string
  storagePath: string | null
  property?: string
  unit?: string
  tenantName?: string
  tenantPhone?: string
  tenantId?: string
}

function transform(row: Record<string, unknown>): DocEntry {
  const property = row.properties as Record<string, unknown> | null
  const tenant = row.tenants as Record<string, unknown> | null
  const unit = tenant?.units as Record<string, unknown> | null
  const bytes = (row.size_bytes as number | null) ?? 0
  const size = bytes > 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as string,
    date: new Date(row.created_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    size,
    storagePath: row.storage_path as string | null,
    property: (property?.name as string) ?? undefined,
    unit: (unit?.unit_number as string) ?? undefined,
    tenantName: (tenant?.name as string) ?? undefined,
    tenantPhone: (tenant?.phone as string) ?? undefined,
    tenantId: (row.tenant_id as string) ?? undefined,
  }
}

export function useDocuments(tenantId?: string, propertyId?: string) {
  const { demoMode } = useDemoMode()
  const [data, setData] = useState<DocEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refetch() {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('documents')
        .select('*, properties(name), tenants!tenant_id(name, phone, units!unit_id(unit_number))')
        .order('created_at', { ascending: false })
      if (tenantId) query = query.eq('tenant_id', tenantId)
      if (propertyId) query = query.eq('property_id', propertyId)
      const { data: rows, error: err } = await query
      if (err) throw err
      setData((rows ?? []).map((r) => transform(r as Record<string, unknown>)))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (demoMode) { setData([]); setLoading(false); setError(null) }
    else refetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, tenantId, propertyId])

  return { data, setData, loading, error, refetch }
}
