import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, Building2, Home, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useBranding } from '../context/BrandingContext'
import { BrandLogo } from '../components/BrandLogo'
import { supabase } from '../lib/supabase'
import { showToast } from '../components/Toast'

type Role = 'tenant' | 'owner' | 'admin'
type AuthHashType = 'invite' | 'recovery' | null

function parseAuthHash(): { type: AuthHashType; accessToken: string | null } {
  const hash = window.location.hash.slice(1)
  const params = new URLSearchParams(hash)
  const type = params.get('type') as AuthHashType
  const accessToken = params.get('access_token')
  return { type: (type === 'invite' || type === 'recovery') ? type : null, accessToken }
}

const ROLES: { value: Role; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'tenant',
    label: 'Tenant',
    description: 'I rent a property',
    icon: <Home className="w-5 h-5" />,
  },
  {
    value: 'owner',
    label: 'Owner',
    description: 'I own properties',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'I manage properties',
    icon: <ShieldCheck className="w-5 h-5" />,
  },
]

export default function Login() {
  const navigate = useNavigate()
  const { signIn, signOut, user, role } = useAuth()
  const { companyName } = useBranding()
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Set-password mode (invite / password reset links)
  const { type: hashType } = parseAuthHash()
  const [setPasswordMode] = useState<AuthHashType>(hashType)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [settingPassword, setSettingPassword] = useState(false)
  const [passwordSet, setPasswordSet] = useState(false)

  useEffect(() => {
    if (!user || !role) return
    // No role selected yet (already-logged-in redirect) → go to their portal
    if (!selectedRole) {
      navigate(`/${role}`, { replace: true })
      return
    }
    // Role selected — enforce it matches the account's actual role
    if (role === selectedRole) {
      navigate(`/${role}`, { replace: true })
    } else {
      signOut()
      setError(`No ${selectedRole} account found for this email. This account is registered as ${role}.`)
      setLoading(false)
    }
  }, [user, role])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) { setError('Email and password are required.'); return }
    setLoading(true)
    setError(null)
    const { error: err } = await signIn(email.trim(), password)
    if (err) {
      setError(
        err === 'Invalid login credentials' ? 'Incorrect email or password.' :
        err.toLowerCase().includes('not confirmed') ? 'Please confirm your email address before signing in. Check your inbox (and spam folder).' :
        err
      )
    }
    setLoading(false)
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }
    setSettingPassword(true)
    setError(null)
    const { error: err } = await supabase.auth.updateUser({ password: newPassword })
    if (err) {
      setError(err.message)
      setSettingPassword(false)
      return
    }
    setPasswordSet(true)
    setSettingPassword(false)
    // Clear the hash so back-nav doesn't re-trigger this flow
    window.history.replaceState(null, '', window.location.pathname)
    setTimeout(() => navigate('/', { replace: true }), 1500)
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError('Enter your email address first, then tap "Forgot password?"'); return }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    })
    if (err) showToast({ type: 'error', title: 'Could not send reset email', message: err.message })
    else showToast({ type: 'success', title: 'Password reset email sent', message: `Check ${email.trim()} for a reset link.` })
  }

  const roleLabel = selectedRole ? ROLES.find(r => r.value === selectedRole)!.label : null

  if (setPasswordMode) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-2 mb-8">
            <BrandLogo wrapperClassName="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center overflow-hidden" iconClassName="w-5 h-5 text-white" />
            <span className="text-xl font-bold text-gray-900">{companyName}</span>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            {passwordSet ? (
              <div className="text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-7 h-7 text-green-600" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">Password set!</h1>
                <p className="text-sm text-gray-500">Redirecting you to your portal…</p>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  {setPasswordMode === 'invite' ? 'Set your password' : 'Reset your password'}
                </h1>
                <p className="text-sm text-gray-500 mb-6">
                  {setPasswordMode === 'invite'
                    ? 'Create a password to activate your portal account.'
                    : 'Enter a new password for your account.'}
                </p>
                {error && (
                  <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
                <form onSubmit={handleSetPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">New password</label>
                    <div className="relative">
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setError(null) }}
                        placeholder="Min. 8 characters"
                        autoComplete="new-password"
                        autoFocus
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                      />
                      <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={settingPassword || newPassword.length < 8}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
                    {settingPassword && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {settingPassword ? 'Saving…' : setPasswordMode === 'invite' ? 'Activate account' : 'Reset password'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <BrandLogo wrapperClassName="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center overflow-hidden" iconClassName="w-5 h-5 text-white" />
          <span className="text-xl font-bold text-gray-900">{companyName}</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {roleLabel ? `Sign in as ${roleLabel}` : 'Welcome back'}
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            {roleLabel ? `Access your ${roleLabel.toLowerCase()} portal` : 'Sign in to your portal'}
          </p>

          {/* Role selector */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-700 mb-2">I am a…</p>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => { setSelectedRole(r.value); setError(null) }}
                  className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 transition-all text-center ${
                    selectedRole === r.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className={selectedRole === r.value ? 'text-blue-600' : 'text-gray-400'}>{r.icon}</span>
                  <span className="text-xs font-semibold leading-tight">{r.label}</span>
                  <span className="text-[10px] text-gray-400 leading-tight">{r.description}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null) }}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-700">Password</label>
                <button type="button" onClick={handleForgotPassword} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null) }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !selectedRole}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            {!selectedRole && (
              <p className="text-center text-xs text-gray-400">Select your role above to continue</p>
            )}
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-600 hover:text-blue-700 font-semibold">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
