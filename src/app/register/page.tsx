'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function RegisterPage() {
  const { t } = useLanguage()
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
      // Create trial subscription for new user
      await supabase.from('user_subscriptions').insert({
        user_id: data.user.id,
        plan_id: 'pro',
        status: 'trial',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      
      setSuccess(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#E8841A' }}>
            GEONOVA
          </h1>
          <p className="text-gray-400">{t('auth.registerSubtitle')}</p>
        </div>

          {success ? (
          <div className="p-4 bg-green-900/30 border border-green-600 rounded text-green-400 text-center">
            <p className="mb-4">{t('auth.checkEmailConfirm')}</p>
            <a href="/login" className="text-[#E8841A] hover:text-[#d67715]">
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
              <label className="block text-sm text-gray-300 mb-2">{t('auth.fullName')}</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:border-[#E8841A] focus:outline-none text-gray-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">{t('auth.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:border-[#E8841A] focus:outline-none text-gray-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">{t('auth.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded focus:border-[#E8841A] focus:outline-none text-gray-100"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded transition-colors disabled:opacity-50"
            >
              {loading ? t('auth.creatingAccount') : t('auth.registerButton')}
            </button>
          </form>
        )}

        <p className="text-center mt-6 text-gray-400">
          {t('auth.hasAccount')}{' '}
          <a href="/login" className="text-[#E8841A] hover:text-[#d67715]">
            {t('auth.loginButton')}
          </a>
        </p>
      </div>
    </div>
  )
}
