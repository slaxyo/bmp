import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface BmpInvoice {
  id: string
  client_id: string
  amount: number
  due_date: string
  paid_date: string | null
  status: string
  stripe_payment_link: string | null
  stripe_payment_link_id: string | null
  notes: string | null
  created_at: string
  // joined
  client_name?: string
  client_company?: string
}

export function useInvoices(clientId?: string) {
  const [invoices, setInvoices] = useState<BmpInvoice[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    let query = supabase
      .from('bmp_invoices')
      .select('*, bmp_clients(name, company_name)')
      .order('due_date', { ascending: false })

    if (clientId) query = query.eq('client_id', clientId)

    const { data } = await query
    type RawRow = BmpInvoice & { bmp_clients: { name: string; company_name: string } | null }
    const mapped = (data ?? []).map((row: unknown) => {
      const r = row as RawRow
      return {
        ...r,
        client_name: r.bmp_clients?.name ?? '',
        client_company: r.bmp_clients?.company_name ?? '',
      }
    })
    setInvoices(mapped)
    setLoading(false)
  }, [clientId])

  useEffect(() => { load() }, [load])

  return { invoices, loading, refresh: load }
}
