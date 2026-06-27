import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { BmpClient } from './useClients'
import type { BmpInvoice } from './useInvoices'

export interface ClientDetail {
  client: BmpClient | null
  invoices: BmpInvoice[]
}

export function useClientDetail(id: string) {
  const [detail, setDetail] = useState<ClientDetail>({ client: null, invoices: [] })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [{ data: client }, { data: invoices }] = await Promise.all([
      supabase.from('bmp_clients').select('*').eq('id', id).maybeSingle(),
      supabase.from('bmp_invoices').select('*').eq('client_id', id).order('due_date', { ascending: false }),
    ])
    setDetail({ client: client as BmpClient | null, invoices: (invoices as BmpInvoice[]) ?? [] })
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  return { detail, loading, refresh: load }
}
