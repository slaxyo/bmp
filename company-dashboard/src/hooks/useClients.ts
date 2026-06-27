import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface BmpClient {
  id: string
  name: string
  email: string
  phone: string | null
  company_name: string
  plan: string
  monthly_fee: number
  portal_pm_id: string | null
  status: string
  notes: string | null
  created_at: string
}

export function useClients() {
  const [clients, setClients] = useState<BmpClient[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bmp_clients')
      .select('*')
      .order('created_at', { ascending: false })
    setClients((data as BmpClient[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return { clients, loading, refresh: load }
}
