'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function RegisterPage() {
  const { t } = useLanguage()
  useEffect(() => { document.title = 'Create Account — METARDU' }, [])
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else if (data.user) {
      // Create trial subscription + send welcome email server-side
      await Promise.allSettled([
        fetch('/api/auth/register-complete', { method: 'POST' }),
        fetch('/api/emails/welcome', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name: fullName }),
        }),
      ])
      setSuccess(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-[var(--accent)]">
            METARDU
          </h1>
          <p className="text-[var(--text-secondary)]">{t('auth.registerSubtitle')}</p>
        </div>

          {success ? (
          <div className="p-4 bg-green-900/30 border border-green-600 rounded text-green-400 text-center">
            <p className="mb-4">{t('auth.checkEmailConfirm')}</p>
            <a href="/login" className="text-[var(--accent)] hover:text-[var(--accent-dim)]">
              {t('auth.backToSignIn')}
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm text-[var(--text-primary)] mb-2">{t('auth.fullName')}</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--text-primary)] mb-2">{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--text-primary)] mb-2">{t('auth.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded transition-colors disabled:opacity-50"
            >
              {loading ? t('auth.creatingAccount') : t('auth.registerButton')}
            </button>
          </form>
        )}

        <p className="text-center mt-6 text-[var(--text-secondary)]">
          {t('auth.hasAccount')}{' '}
          <a href="/login" className="text-[var(--accent)] hover:text-[var(--accent-dim)]">
            {t('auth.loginButton')}
          </a>
        </p>
      </div>
    </div>
  )
}
