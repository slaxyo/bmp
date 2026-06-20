import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

// ─── Brand shape ──────────────────────────────────────────────────────────────

export interface Brand {
  companyName: string
  tagline: string
  logoUrl: string | null
  primaryColor: string
}

export const DEFAULT_BRAND: Brand = {
  companyName: 'BMP Central',
  tagline: 'Property Management',
  logoUrl: null,
  primaryColor: '#2563EB', // tailwind blue-600
}

interface BrandingContextValue extends Brand {
  loading: boolean
  refresh: () => Promise<void>
  /** Live-preview an accent without persisting (used by the Settings editor). */
  previewColor: (hex: string | null) => void
}

const BrandingContext = createContext<BrandingContextValue | null>(null)

// ─── Color helpers ────────────────────────────────────────────────────────────

function clamp(n: number) { return Math.max(0, Math.min(255, Math.round(n))) }

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const int = parseInt(h, 16)
  if (Number.isNaN(int) || h.length !== 6) return [37, 99, 235] // fallback blue-600
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('')
}

/** Mix `base` toward `target` (white or black) by `amount` (0–1). */
function mix(base: [number, number, number], target: number, amount: number) {
  const [r, g, b] = base
  return rgbToHex(
    r + (target - r) * amount,
    g + (target - g) * amount,
    b + (target - b) * amount,
  )
}

// Mix ratios calibrated so the supplied color sits at the "600" step and the
// rest of the scale tracks Tailwind's default blue lightness curve.
const SCALE: { step: number; target: number; amount: number }[] = [
  { step: 50, target: 255, amount: 0.95 },
  { step: 100, target: 255, amount: 0.86 },
  { step: 200, target: 255, amount: 0.72 },
  { step: 300, target: 255, amount: 0.54 },
  { step: 400, target: 255, amount: 0.3 },
  { step: 500, target: 255, amount: 0.12 },
  { step: 600, target: 0, amount: 0 },
  { step: 700, target: 0, amount: 0.14 },
  { step: 800, target: 0, amount: 0.28 },
  { step: 900, target: 0, amount: 0.42 },
]

/** Override Tailwind v4's blue palette CSS variables so every `*-blue-*` class
 *  across the app renders in the brand accent — no markup changes needed. */
function applyAccent(hex: string) {
  const base = hexToRgb(hex)
  const root = document.documentElement
  for (const { step, target, amount } of SCALE) {
    root.style.setProperty(`--color-blue-${step}`, amount === 0 ? hex : mix(base, target, amount))
  }
  root.style.setProperty('--brand-primary', hex)
}

function clearAccent() {
  const root = document.documentElement
  for (const { step } of SCALE) root.style.removeProperty(`--color-blue-${step}`)
  root.style.removeProperty('--brand-primary')
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth()
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Admin manages their own row; everyone else (tenant/owner/logged-out)
      // reads their PM's brand — a single PM per deployment, so the latest row.
      let query = supabase.from('branding').select('*')
      if (role === 'admin' && user) query = query.eq('pm_id', user.id)
      const { data } = await query.order('updated_at', { ascending: false }).limit(1).maybeSingle()
      if (data) {
        setBrand({
          companyName: data.company_name || DEFAULT_BRAND.companyName,
          tagline: data.tagline || DEFAULT_BRAND.tagline,
          logoUrl: data.logo_url,
          primaryColor: data.primary_color || DEFAULT_BRAND.primaryColor,
        })
      } else {
        setBrand(DEFAULT_BRAND)
      }
    } catch {
      setBrand(DEFAULT_BRAND)
    } finally {
      setLoading(false)
    }
  }, [user, role])

  useEffect(() => { load() }, [load])

  // Apply the accent whenever the resolved brand color changes.
  useEffect(() => {
    if (brand.primaryColor && brand.primaryColor.toUpperCase() !== DEFAULT_BRAND.primaryColor.toUpperCase()) {
      applyAccent(brand.primaryColor)
    } else {
      clearAccent()
    }
    return () => {}
  }, [brand.primaryColor])

  const previewColor = useCallback((hex: string | null) => {
    if (!hex) { applyAccent(brand.primaryColor); return }
    applyAccent(hex)
  }, [brand.primaryColor])

  return (
    <BrandingContext.Provider value={{ ...brand, loading, refresh: load, previewColor }}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  const ctx = useContext(BrandingContext)
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider')
  return ctx
}
