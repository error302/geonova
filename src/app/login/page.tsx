'use client';

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Eye, EyeOff, ArrowLeft, CheckCircle2, ShieldCheck, WifiOff , AlertTriangle } from 'lucide-react'
import MetarduLogo from '@/components/MetarduLogo'
import Image from 'next/image'
import { logger } from '@/lib/logger'

type View = 'login' | 'forgot' | 'sent'

/* ── OAuth provider SVG icons (inline for zero-dependency rendering) ── */

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  )
}

function LoginForm() {
  const searchParams = useSearchParams()

  const [view, setView] = useState<View>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

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
    if (emailErr || passErr) {
      return
    }

    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      setLoading(false)

      if (result?.error) {
        // Check if the database is available — if not, show a service-unavailable message
        try {
          const healthRes = await fetch('/api/public/health')
          const healthData = await healthRes.json() as { checks?: { database?: string } }
          if (healthData.checks?.database === 'error') {
            setError('Service temporarily unavailable. The database is not reachable. Please try again later.')
            return
          }
        } catch {
          // Health check itself failed — likely a network issue
        }
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
    } catch (err) {
      logger.error('Login error:', { error: err })
      setLoading(false)
      setError('An error occurred. Please try again.')
    }
  }

  const handleOAuthSignIn = async (provider: 'google' | 'azure-ad') => {
    setError('')
    setOauthLoading(provider)
    try {
      await signIn(provider, {
        callbackUrl: getRedirectTo(),
      })
    } catch (err) {
      logger.error('OAuth sign-in error:', { error: err })
      setOauthLoading(null)
      setError('Unable to sign in with this provider. Please try again.')
    }
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
        setError('Unable to send reset link. Please try again.')
      }
    } catch {
      setError('A network error occurred. Please check your connection and try again.')
    }
    setLoading(false)
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden auth-page">
      {/* ──────────────────────────────────────────────────────────────
          LIGHT TOPOGRAPHIC MAP BACKGROUND
          Subtle overlays preserve the delicate contour detail while
          giving the dark glass card maximum contrast.
         ────────────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 -z-10">
        {/* Pre-loaded topographic PNG — optimized with next/image */}
        <Image
          src="/images/signin-topo.jpg"
          alt="World topographic contour map"
          onLoad={() => setImageLoaded(true)}
          fill
          priority
          sizes="100vw"
          className={[
            'object-cover transition-opacity duration-700',
            imageLoaded ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        />
        {/* Fallback background color while image loads */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[var(--bg-secondary)]"
          style={{ zIndex: -1 }}
        />
        {/* Very subtle warm tint — lets contour lines shine through */}
        <div className="absolute inset-0 bg-gradient-to-br from-[color-mix(in_srgb,var(--bg-primary)_30%,transparent)] via-[color-mix(in_srgb,var(--bg-secondary)_20%,transparent)] to-[color-mix(in_srgb,var(--bg-primary)_35%,transparent)]" />
        {/* Bottom darkening so card/badges contrast cleanly */}
        <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_srgb,var(--bg-primary)_60%,transparent)] via-transparent to-[color-mix(in_srgb,var(--bg-primary)_15%,transparent)]" />
        {/* Soft vignette */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 45%, rgba(26,24,22,0.35) 100%)',
          }}
        />
      </div>

      {/* Top brand bar */}
      <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 lg:px-12 py-5">
        <a
          href="/"
          className="group inline-flex items-center gap-3 drop-shadow-lg"
        >
          <MetarduLogo size={36} showWordmark={true} color="#FFFFFF" />
        </a>
        <div className="hidden sm:flex items-center gap-2 text-xs text-white/90 px-3 py-1.5 rounded-full bg-[color-mix(in_srgb,var(--bg-card)_50%,transparent)] border border-white/20 backdrop-blur-md drop-shadow-md">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>East Africa Survey Platform</span>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex min-h-[calc(100vh-88px)] items-center justify-center px-4 sm:px-6 pb-12">
        <div className="w-full max-w-md">
          {/* Dark frosted-glass card — pops against the light topo map.
              NOTE: bg-[color-mix(in_srgb,var(--bg-card)_80%,transparent)] silently compiles to a fully
              transparent background (Tailwind can't apply an opacity
              modifier to a var() color), which washed the white card text
              out over the light map. Hard-code the auth-page dark card
              color with real alpha instead (.auth-page pins --bg-card to
              #080808 in globals.css). */}
          <div className="[--auth-border:rgba(255,255,255,0.10)] [--auth-field:rgba(255,255,255,0.05)] relative rounded-2xl border border-[var(--auth-border)] bg-[rgba(8,8,8,0.82)] backdrop-blur-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.7)] overflow-hidden">
            {/* Top accent stripe */}
            <div className="h-1 w-full bg-gradient-to-r from-[var(--accent)] via-orange-400 to-[var(--accent)]" />

            <div className="px-6 sm:px-8 py-8 sm:py-10">
              {view === 'login' && (
                <>
                  <div className="mb-8">
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">
                      Welcome back
                    </h2>
                    <p className="text-sm text-white/60 mt-1.5">
                      Sign in to your METARDU account
                    </p>
                  </div>

                  {/* ── OAuth Buttons (shown first for prominence) ── */}
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => handleOAuthSignIn('google')}
                      disabled={oauthLoading !== null}
                      className="w-full py-3 px-4 bg-white/[0.07] border border-white/15 hover:bg-white/[0.12] hover:border-white/25 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      {oauthLoading === 'google' ? (
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <GoogleIcon className="w-5 h-5 shrink-0" />
                      )}
                      {oauthLoading === 'google' ? 'Connecting...' : 'Continue with Google'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOAuthSignIn('azure-ad')}
                      disabled={oauthLoading !== null}
                      className="w-full py-3 px-4 bg-white/[0.07] border border-white/15 hover:bg-white/[0.12] hover:border-white/25 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      {oauthLoading === 'azure-ad' ? (
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <MicrosoftIcon className="w-5 h-5 shrink-0" />
                      )}
                      {oauthLoading === 'azure-ad' ? 'Connecting...' : 'Continue with Microsoft'}
                    </button>
                  </div>

                  {/* ── Divider ── */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[var(--auth-border)]" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-3 bg-transparent text-white/40 uppercase tracking-wider">
                        or sign in with email
                      </span>
                    </div>
                  </div>

                  {/* ── Credentials Form ── */}
                  <form onSubmit={handleLogin} className="space-y-5">
                    {error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm flex items-start gap-2">
                        <span className="mt-0.5"><AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /></span>
                        <span>{error}</span>
                      </div>
                    )}

                    <div>
                      <label htmlFor="login-email" className="block text-xs font-medium uppercase tracking-wider text-white/60 mb-2">
                        Email
                      </label>
                      <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => {
                          setEmailTouched(true)
                          setEmailError(validateEmail(email))
                        }}
                        className="w-full px-4 py-3 bg-[var(--auth-field)] border border-[var(--auth-border)] rounded-lg text-white placeholder-white/30 focus:border-[var(--accent)] focus:bg-white/10 focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none transition-all"
                        autoComplete="email"
                        placeholder="you@example.com"
                      />
                      {emailTouched && emailError && (
                        <p className="text-red-300 text-xs mt-1.5">{emailError}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="login-password" className="block text-xs font-medium uppercase tracking-wider text-white/60 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onBlur={() => {
                            setPasswordTouched(true)
                            setPasswordError(validatePassword(password))
                          }}
                          className="w-full px-4 py-3 pr-11 bg-[var(--auth-field)] border border-[var(--auth-border)] rounded-lg text-white placeholder-white/30 focus:border-[var(--accent)] focus:bg-white/10 focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none transition-all"
                          autoComplete="current-password"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors p-1"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {passwordTouched && passwordError && (
                        <p className="text-red-300 text-xs mt-1.5">{passwordError}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input aria-label="Rememberme"
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 rounded border-white/20 bg-[var(--auth-field)] text-[var(--accent)] focus:ring-[color-mix(in_srgb,var(--accent)_50%,transparent)]"
                        />
                        <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                          Remember me
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setView('forgot')
                          setError('')
                        }}
                        className="text-sm text-[var(--accent)] hover:text-amber-300 hover:underline transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dim)] hover:from-amber-400 hover:to-[var(--accent)] text-black font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
                    >
                      {loading && (
                        <span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                      )}
                      {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                  </form>

                  <p className="text-center mt-6 text-white/60 text-sm">
                    Don&apos;t have an account?{' '}
                    <a
                      href="/register"
                      className="text-[var(--accent)] hover:text-amber-300 hover:underline font-medium transition-colors"
                    >
                      Create one
                    </a>
                  </p>
                </>
              )}

              {view === 'forgot' && (
                <>
                  <div className="mb-8">
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">
                      Reset your password
                    </h2>
                    <p className="text-sm text-white/60 mt-1.5">
                      Enter your email and we&apos;ll send you a reset link.
                    </p>
                  </div>

                  <form onSubmit={handleForgotPassword} className="space-y-5">
                    <div>
                      <label htmlFor="forgot-email" className="block text-xs font-medium uppercase tracking-wider text-white/60 mb-2">
                        Email
                      </label>
                      <input
                        id="forgot-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => {
                          setEmailTouched(true)
                          setEmailError(validateEmail(email))
                        }}
                        className="w-full px-4 py-3 bg-[var(--auth-field)] border border-[var(--auth-border)] rounded-lg text-white placeholder-white/30 focus:border-[var(--accent)] focus:bg-white/10 focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none transition-all"
                        autoComplete="email"
                        placeholder="you@example.com"
                      />
                      {emailTouched && emailError && (
                        <p className="text-red-300 text-xs mt-1.5">{emailError}</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dim)] hover:from-amber-400 hover:to-[var(--accent)] text-black font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
                    >
                      {loading && (
                        <span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                      )}
                      {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                  </form>

                  <button
                    onClick={() => {
                      setView('login')
                      setError('')
                      setEmailTouched(false)
                      setPasswordTouched(false)
                    }}
                    className="flex items-center gap-2 text-sm text-[var(--accent)] hover:text-amber-300 hover:underline mt-6 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to sign in
                  </button>
                </>
              )}

              {view === 'sent' && (
                <div className="text-center py-2">
                  <div className="grid place-items-center w-16 h-16 rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--accent)_30%,transparent)] mx-auto mb-5">
                    <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
                  <p className="text-white/60 mb-1">We&apos;ve sent a password reset link to:</p>
                  <p className="text-white font-medium mb-6">{email}</p>

                  <button
                    onClick={() => {
                      setView('login')
                      setError('')
                      setEmailTouched(false)
                      setPasswordTouched(false)
                    }}
                    className="flex items-center gap-2 text-sm text-[var(--accent)] hover:text-amber-300 hover:underline mx-auto transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to sign in
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Trust badges below the card — float over world map */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {[
              { icon: CheckCircle2, text: 'Kenya Survey Compliant' },
              { icon: WifiOff, text: 'Works Offline' },
              { icon: ShieldCheck, text: 'Trusted Across East Africa' },
            ].map((item) => (
              <div
                key={item.text}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-[var(--auth-border)] backdrop-blur-md text-xs text-white/75"
              >
                <item.icon className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center auth-page">
          <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
