'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'

type View = 'login' | 'forgot' | 'sent'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

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
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => { document.title = 'Login — METARDU' }, [])

  useEffect(() => {
    const saved = localStorage.getItem('metardu_remember')
    if (saved === 'true') setRememberMe(true)
  }, [])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown(c => c - 1), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const getRedirectTo = () => {
    const param = searchParams.get('next') || searchParams.get('redirectTo')
    if (param) return decodeURIComponent(param)
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth:redirect') || '/dashboard'
    }
    return '/dashboard'
  }

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (session) {
        localStorage.removeItem('auth:redirect')
        window.location.replace(getRedirectTo())
      }
    })
    return () => { mounted = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      if (signInError.message.includes('Invalid login credentials')) {
        setError('Incorrect email or password. Please try again.')
      } else if (signInError.message.includes('Email not confirmed')) {
        setError('Please verify your email address before signing in. Check your inbox.')
      } else if (signInError.message.includes('Too many requests')) {
        setError('Too many attempts. Please wait a few minutes and try again.')
      } else {
        setError('Sign in failed. Please try again.')
      }
      setLoading(false)
      return
    }

    if (rememberMe) {
      localStorage.setItem('metardu_remember', 'true')
    } else {
      localStorage.removeItem('metardu_remember')
      sessionStorage.setItem('metardu_session_only', 'true')
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
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })
    setLoading(false)
    setResendCooldown(60)
    setView('sent')
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })
    setLoading(false)
    setResendCooldown(60)
  }

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
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

      {/* Right panel - form */}
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

              {googleEnabled && (
                <>
                  <div className="flex items-center gap-4 my-6">
                    <div className="flex-1 h-px bg-[var(--border-color)]" />
                    <span className="text-sm text-[var(--text-muted)]">or</span>
                    <div className="flex-1 h-px bg-[var(--border-color)]" />
                  </div>
                  <button
                    onClick={handleGoogleSignIn}
                    className="w-full py-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Continue with Google
                  </button>
                </>
              )}

              <p className="text-center mt-6 text-[var(--text-secondary)] text-sm">
                Don&apos;t have an account?{' '}
                <a href="/register" className="text-[var(--accent)] hover:underline">Create one</a>
              </p>
              <p className="text-center mt-4 text-xs text-[var(--text-muted)]">
                By signing in you agree to our <a href="/docs/terms" className="underline">Terms</a> and <a href="/docs/privacy" className="underline">Privacy Policy</a>
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
              <Mail className="w-16 h-16 text-[var(--accent)] mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Check your email</h2>
              <p className="text-[var(--text-secondary)] mb-1">We&apos;ve sent a password reset link to:</p>
              <p className="text-[var(--text-primary)] font-medium mb-4">{email}</p>
              <p className="text-sm text-[var(--text-muted)] mb-6">The link expires in 1 hour.</p>

              <button
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="text-sm text-[var(--accent)] hover:underline disabled:text-gray-500 disabled:no-underline mb-6"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend email'}
              </button>

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
