import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, CheckCircle2, Lock, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { notifyUser } from '../lib/notify'

interface InviteInfo {
  tenant_id: string
  tenant_name: string
  tenant_email: string
  pm_id: string
  company_name: string
}

export default function InvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingInvite, setLoadingInvite] = useState(true)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoadError('Invalid invite link — no token found.')
      setLoadingInvite(false)
      return
    }
    supabase.rpc('get_tenant_by_invite_token', { p_token: token }).then(({ data, error: rpcErr }) => {
      if (rpcErr || !data || data.length === 0) {
        setLoadError('This invite link is invalid or has already been used.')
      } else {
        setInvite(data[0] as InviteInfo)
      }
      setLoadingInvite(false)
    })
  }, [token])

  function validate(): string | null {
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.'
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.'
    if (password !== confirmPassword) return 'Passwords do not match.'
    return null
  }

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault()
    if (!invite) return
    const err = validate()
    if (err) { setError(err); return }

    setSubmitting(true)
    setError(null)

    // Create the auth account
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: invite.tenant_email,
      password,
      options: { data: { full_name: invite.tenant_name, role: 'tenant' } },
    })

    if (signUpErr) {
      // If account already exists, try signing in
      if (signUpErr.message.includes('already registered') || signUpErr.message.includes('already been registered')) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email: invite.tenant_email, password })
        if (signInErr) {
          setError('An account with this email already exists. Try signing in with your existing password.')
          setSubmitting(false)
          return
        }
      } else {
        setError(signUpErr.message)
        setSubmitting(false)
        return
      }
    }

    const session = signUpData?.session
    if (!session && !signUpData?.user) {
      // Email confirmation required — unlikely with invite flow but handle it
      setDone(true)
      setSubmitting(false)
      return
    }

    // Accept the invite: mark tenant as active and clear the token.
    // Uses a security-definer RPC so it works regardless of session timing.
    await supabase.rpc('accept_tenant_invite', { p_token: token, p_tenant_id: invite.tenant_id })

    // Notify the PM that the tenant joined
    await notifyUser(invite.pm_id, {
      type: 'tenant',
      title: `${invite.tenant_name} accepted your invite`,
      body: `${invite.tenant_name} (${invite.tenant_email}) created their account and is now active.`,
      link: '/admin',
    })

    setDone(true)
    setSubmitting(false)

    // Redirect to tenant portal after short delay
    setTimeout(() => navigate('/tenant', { replace: true }), 1500)
  }

  if (loadingInvite) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid invite</h1>
          <p className="text-sm text-gray-500 mb-6">{loadError}</p>
          <button onClick={() => navigate('/login')} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm">
            Go to sign in
          </button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">You're all set!</h1>
          <p className="text-sm text-gray-500 mb-1">Welcome, {invite?.tenant_name}.</p>
          <p className="text-sm text-gray-400">Redirecting to your portal…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Company header */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">{invite?.company_name}</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Accept your invite</h1>
          <p className="text-sm text-gray-500 mb-6">
            Create a password for <span className="font-semibold text-gray-700">{invite?.tenant_email}</span>
          </p>

          {/* Pre-filled info */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
            <p className="text-xs font-semibold text-blue-700 mb-0.5">Invited as</p>
            <p className="text-sm font-bold text-blue-900">{invite?.tenant_name}</p>
            <p className="text-xs text-blue-600">{invite?.tenant_email}</p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleAccept} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Create password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null) }}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    { label: '8+ chars', ok: password.length >= 8 },
                    { label: 'Uppercase', ok: /[A-Z]/.test(password) },
                    { label: 'Number', ok: /[0-9]/.test(password) },
                  ].map((hint) => (
                    <span
                      key={hint.label}
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        hint.ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {hint.ok && <CheckCircle2 className="w-3 h-3" />}
                      {hint.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showConfirmPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(null) }}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  className={`w-full pl-9 pr-10 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    confirmPassword && confirmPassword !== password
                      ? 'border-red-300 bg-red-50'
                      : confirmPassword && confirmPassword === password
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(!showConfirmPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 mt-2"
            >
              {submitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {submitting ? 'Creating account…' : 'Create account & join'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} className="text-blue-600 hover:text-blue-700 font-semibold">
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
