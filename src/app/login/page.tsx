'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react'

type View = 'login' | 'forgot' | 'sent'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [view, setView] = useState<View>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)

  useEffect(() => { document.title = 'Login — METARDU' }, [])

  useEffect(() => {
    const saved = localStorage.getItem('metardu_remember')
    if (saved === 'true') setRememberMe(true)
  }, [])

  const getRedirectTo = () => {
    const param = searchParams.get('next') || searchParams.get('redirectTo')
    if (param) return decodeURIComponent(param)
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth:redirect') || '/dashboard'
    }
    return '/dashboard'
  }

  const validateEmail = (value: string) => {
    if (!value) return 'Please enter your email address'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address'
    return ''
  }

  const validatePassword = (value: string) => {
    if (!value) return 'Please enter your password'
    return ''
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailTouched(true)
    setPasswordTouched(true)

    const emailErr = validateEmail(email)
    const passErr = validatePassword(password)
    setEmailError(emailErr)
    setPasswordError(passErr)
    if (emailErr || passErr) return

    setError('')
    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Incorrect email or password. Please try again.')
      return
    }

    if (rememberMe) {
      localStorage.setItem('metardu_remember', 'true')
    } else {
      localStorage.removeItem('metardu_remember')
    }

    localStorage.removeItem('auth:redirect')
    window.location.href = getRedirectTo()
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailTouched(true)

    const emailErr = validateEmail(email)
    setEmailError(emailErr)
    if (emailErr) return

    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setView('sent')
      } else {
        setError('Password reset is not yet available. Please contact support at mohameddosho20@gmail.com')
      }
    } catch {
      setError('Password reset is not yet available. Please contact support at mohameddosho20@gmail.com')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">
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

      <div className="w-full md:w-1/2 flex items-center justify-center p-8 bg-[var(--bg-primary)]">
        <div className="w-full max-w-md">
          <a href="/" className="text-2xl font-bold text-[var(--accent)] md:hidden block mb-8">METARDU</a>

          {view === 'login' && (
            <>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">Welcome back</h2>
              <p className="text-[var(--text-secondary)] mb-8">Sign in to your account</p>

              <form onSubmit={handleLogin} className="space-y-5">
                {error && (
                  <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm text-[var(--text-primary)] mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={() => { setEmailTouched(true); setEmailError(validateEmail(email)) }}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
                    autoComplete="email"
                    autoFocus
                  />
                  {emailTouched && emailError && <p className="text-red-400 text-xs mt-1">{emailError}</p>}
                </div>

                <div>
                  <label className="block text-sm text-[var(--text-primary)] mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onBlur={() => { setPasswordTouched(true); setPasswordError(validatePassword(password)) }}
                      className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordTouched && passwordError && <p className="text-red-400 text-xs mt-1">{passwordError}</p>}
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="rounded border-gray-600 bg-[var(--bg-secondary)]"
                    />
                    <span className="text-sm text-[var(--text-secondary)]">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => { setView('forgot'); setError(''); }}
                    className="text-sm text-[var(--accent)] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <p className="text-center mt-6 text-[var(--text-secondary)] text-sm">
                Don&apos;t have an account?{' '}
                <a href="/register" className="text-[var(--accent)] hover:underline">Create one</a>
              </p>
            </>
          )}

          {view === 'forgot' && (
            <>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">Reset your password</h2>
              <p className="text-[var(--text-secondary)] mb-8">Enter your email and we&apos;ll send you a reset link.</p>

              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="block text-sm text-[var(--text-primary)] mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={() => { setEmailTouched(true); setEmailError(validateEmail(email)) }}
                    className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
                    autoComplete="email"
                    autoFocus
                  />
                  {emailTouched && emailError && <p className="text-red-400 text-xs mt-1">{emailError}</p>}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />}
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <button
                onClick={() => { setView('login'); setError(''); setEmailTouched(false); setPasswordTouched(false); }}
                className="flex items-center gap-2 text-sm text-[var(--accent)] hover:underline mt-6"
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
            </>
          )}

          {view === 'sent' && (
            <div className="text-center">
              <svg className="w-16 h-16 text-[var(--accent)] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Check your email</h2>
              <p className="text-[var(--text-secondary)] mb-1">We&apos;ve sent a password reset link to:</p>
              <p className="text-[var(--text-primary)] font-medium mb-4">{email}</p>

              <button
                onClick={() => { setView('login'); setError(''); setEmailTouched(false); setPasswordTouched(false); }}
                className="flex items-center gap-2 text-sm text-[var(--accent)] hover:underline mx-auto"
              >
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}