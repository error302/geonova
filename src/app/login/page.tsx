'use client'

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

function LoginForm() {
  const { t } = useLanguage()
  useEffect(() => { document.title = 'Login — METARDU' }, [])
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Read next path only on client — never during SSR
  const getNext = () => {
    const param = searchParams.get('next')
    if (param) return decodeURIComponent(param)
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth:redirect') || '/dashboard'
    }
    return '/dashboard'
  }

  // If already signed in, go straight to destination
  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      if (data.user) {
        localStorage.removeItem('auth:redirect')
        window.location.replace(getNext())
      }
    })
    return () => { mounted = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    localStorage.removeItem('auth:redirect')
    // Hard redirect — full page load ensures session cookies are read fresh
    // before any JS runs, preventing the getUser() race condition
    window.location.href = getNext()
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <a href="/" className="text-4xl font-bold mb-2 text-[var(--accent)] block hover:opacity-80 transition-opacity">
            GEONOVA
          </a>
          <p className="text-[var(--text-secondary)]">{t('auth.loginSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-[var(--text-primary)] mb-2">{t('auth.email')}</label>
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
            <label className="block text-sm text-[var(--text-primary)] mb-2">{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : t('auth.loginButton')}
          </button>
        </form>

        <p className="text-center mt-6 text-[var(--text-secondary)]">
          {t('auth.noAccount')}{' '}
          <a href="/register" className="text-[var(--accent)] hover:text-[var(--accent-dim)]">
            {t('nav.register')}
          </a>
        </p>
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
