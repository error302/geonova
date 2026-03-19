'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function LoginPage() {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      if (data.user) router.replace('/dashboard')
    })
    return () => { mounted = false }
  }, [router, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Redirect to the page the user was trying to access, or dashboard by default
      const redirectTo = typeof window !== 'undefined' ? localStorage.getItem('auth:redirect') : null
      localStorage.removeItem('auth:redirect')
      router.push(redirectTo || '/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#E8841A' }}>
            GEONOVA
          </h1>
          <p className="text-[var(--text-secondary)]">{t('auth.loginSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-[var(--text-primary)] mb-2">{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[#E8841A] focus:outline-none text-[var(--text-primary)]"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--text-primary)] mb-2">{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[#E8841A] focus:outline-none text-[var(--text-primary)]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded transition-colors disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('auth.loginButton')}
          </button>
        </form>

        <p className="text-center mt-6 text-[var(--text-secondary)]">
          {t('auth.noAccount')}{' '}
          <a href="/register" className="text-[#E8841A] hover:text-[#d67715]">
            {t('nav.register')}
          </a>
        </p>
      </div>
    </div>
  )
}
