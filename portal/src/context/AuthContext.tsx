import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Role = 'tenant' | 'owner' | 'admin' | null

interface AuthContextValue {
  user: User | null
  session: Session | null
  role: Role
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string, role: 'tenant' | 'owner' | 'admin', extra?: { company?: string; phone?: string }) => Promise<{ error: string | null; needsConfirmation: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role>(null)
  const [loading, setLoading] = useState(true)

  async function fetchRole(u: User) {
    // Profiles table is the authoritative source — the trigger always writes it.
    // Fall back to user_metadata for accounts created before the profiles table existed.
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', u.id)
      .maybeSingle()
    const resolved = (data?.role as Role) ?? (u.user_metadata?.role as Role) ?? null
    setRole(resolved)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchRole(session.user).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchRole(session.user).finally(() => setLoading(false))
      } else {
        setRole(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signUp(email: string, password: string, fullName: string, role: 'tenant' | 'owner' | 'admin', extra?: { company?: string; phone?: string }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    })
    if (error) return { error: error.message, needsConfirmation: false }
    // Persist company/phone to profiles right after sign-up when session is live
    if (data.session && (extra?.company || extra?.phone)) {
      await supabase.from('profiles').update({
        ...(extra.company ? { company: extra.company } : {}),
        ...(extra.phone ? { phone: extra.phone } : {}),
      }).eq('id', data.user!.id)
    }
    const needsConfirmation = !data.session
    return { error: null, needsConfirmation }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
