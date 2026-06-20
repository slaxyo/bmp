import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, CheckCircle2, User, Mail, Lock, Building2, Home, ShieldCheck, Phone } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useBranding } from '../context/BrandingContext'
import { BrandLogo } from '../components/BrandLogo'

type Role = 'tenant' | 'owner' | 'admin'

const ROLES: { value: Role; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'tenant', label: 'Tenant', description: 'I rent a property', icon: <Home className="w-5 h-5" /> },
  { value: 'owner', label: 'Owner', description: 'I own properties', icon: <Building2 className="w-5 h-5" /> },
  { value: 'admin', label: 'Admin', description: 'I manage properties', icon: <ShieldCheck className="w-5 h-5" /> },
]

export default function Register() {
  const navigate = useNavigate()
  const { signUp, user, role } = useAuth()
  const { companyName } = useBranding()

  const [step, setStep] = useState<'form' | 'confirm'>('form')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState<Role>('tenant')
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect if already logged in
  useEffect(() => {
    if (user && role) navigate(`/${role}`, { replace: true })
  }, [user, role])

  function validate(): string | null {
    if (!fullName.trim()) return 'Full name is required.'
    if (fullName.trim().split(' ').length < 2) return 'Please enter your first and last name.'
    if (!email.trim()) return 'Email address is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.'
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.'
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.'
    if (password !== confirmPassword) return 'Passwords do not match.'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }

    setLoading(true)
    setError(null)

    const { error: signUpError, needsConfirmation } = await signUp(
      email.trim(),
      password,
      fullName.trim(),
      selectedRole,
      { company: company.trim() || undefined, phone: phone.trim() || undefined }
    )

    if (signUpError) {
      setError(
        signUpError.includes('already registered') || signUpError.includes('already been registered')
          ? 'An account with this email already exists. Try signing in.'
          : signUpError
      )
      setLoading(false)
      return
    }

    if (needsConfirmation) {
      setStep('confirm')
    } else {
      // Email confirmation disabled — session is live, redirect handled by useEffect
    }
    setLoading(false)
  }

  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex items-center justify-center gap-2 mb-8">
            <BrandLogo wrapperClassName="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center overflow-hidden" iconClassName="w-5 h-5 text-white" />
            <span className="text-xl font-bold text-gray-900">{companyName}</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Check your email</h1>
            <p className="text-sm text-gray-500 mb-1">
              We sent a confirmation link to
            </p>
            <p className="text-sm font-semibold text-gray-900 mb-4">{email}</p>
            <p className="text-xs text-gray-400 mb-6">
              Click the link in the email to verify your account and complete sign-up. Check your spam folder if you don't see it.
            </p>
            <Link
              to="/login"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm text-center"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <BrandLogo wrapperClassName="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center overflow-hidden" iconClassName="w-5 h-5 text-white" />
          <span className="text-xl font-bold text-gray-900">{companyName}</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create an account</h1>
          <p className="text-sm text-gray-500 mb-6">Get access to your portal</p>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full name */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); setError(null) }}
                  placeholder="Jane Smith"
                  autoComplete="name"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null) }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Company */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Company <span className="font-normal text-gray-400">(optional)</span></label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={company}
                  onChange={(e) => { setCompany(e.target.value); setError(null) }}
                  placeholder="Acme Property Management"
                  autoComplete="organization"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phone number <span className="font-normal text-gray-400">(optional)</span></label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError(null) }}
                  placeholder="+1 (555) 000-0000"
                  autoComplete="tel"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Role selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">I am a…</label>
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

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password</label>
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
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Password strength hints */}
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

            {/* Confirm password */}
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
                  aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 mt-2"
            >
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
