'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff, CheckCircle2, Mail } from 'lucide-react'

function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  if (password.length < 8) return { label: 'Weak', color: 'bg-red-500', width: 'w-1/3' }
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length
  if (password.length >= 8 && score >= 3) return { label: 'Strong', color: 'bg-green-500', width: 'w-full' }
  if (password.length >= 8 && score >= 2) return { label: 'Fair', color: 'bg-amber-500', width: 'w-2/3' }
  return { label: 'Weak', color: 'bg-red-500', width: 'w-1/3' }
}

export default function RegisterPage() {
  useEffect(() => { document.title = 'Create Account — METARDU' }, [])

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const strength = getPasswordStrength(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.')
        setLoading(false)
        return
      }

      // Auto-login after successful registration
      const loginResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (loginResult?.error) {
        // Registration succeeded but auto-login failed — send to login page
        setSuccess(true)
        setLoading(false)
        return
      }

      // Redirect to dashboard
      window.location.href = '/dashboard'
    } catch {
      setError('Registration failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden md:flex md:w-1/2 bg-gray-900 text-white flex-col justify-center p-12">
        <a href="/" className="text-4xl font-bold mb-4 text-[var(--accent)]">METARDU</a>
        <p className="text-xl text-gray-300 mb-8">From field data to finished documents.</p>
        <ul className="space-y-4 text-gray-400">
          <li className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Kenya Survey Regulations compliant
          </li>
          <li className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Works offline in the field
          </li>
          <li className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Trusted by surveyors across East Africa
          </li>
        </ul>
      </div>

      {/* Right panel */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 bg-[var(--bg-primary)]">
        <div className="w-full max-w-md">
          <a href="/" className="text-2xl font-bold text-[var(--accent)] md:hidden block mb-8">METARDU</a>

          {success ? (
            <div className="text-center">
              <Mail className="w-16 h-16 text-[var(--accent)] mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Account created!</h2>
              <p className="text-[var(--text-secondary)] mb-4">Your account has been created successfully.</p>
              <a href="/login" className="inline-block px-6 py-3 bg-[var(--accent)] text-black font-semibold rounded-lg hover:bg-[var(--accent-dim)] transition-colors">
                Sign in now
              </a>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">Create your account</h2>
              <p className="text-[var(--text-secondary)] mb-8">Start your free trial. No credit card required.</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">{error}</div>
                )}

                <div>
                  <label className="block text-sm text-[var(--text-primary)] mb-2">Full name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
                    autoComplete="name"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm text-[var(--text-primary)] mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
                    autoComplete="email"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-[var(--text-primary)] mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] pr-10"
                      autoComplete="new-password"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2">
                      <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full ${strength.color} ${strength.width} transition-all`} />
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-1">{strength.label}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-[var(--text-primary)] mb-2">Confirm password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] pr-10"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                  )}
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={e => setAgreeTerms(e.target.checked)}
                    className="mt-1 rounded border-gray-600 bg-[var(--bg-secondary)]"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">
                    I agree to the <a href="/docs/terms" className="text-[var(--accent)] hover:underline">Terms of Service</a> and <a href="/docs/privacy" className="text-[var(--accent)] hover:underline">Privacy Policy</a>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading || !agreeTerms || password !== confirmPassword}
                  className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>

              <p className="text-center mt-6 text-[var(--text-secondary)] text-sm">
                Already have an account?{' '}
                <a href="/login" className="text-[var(--accent)] hover:underline">Sign in</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
