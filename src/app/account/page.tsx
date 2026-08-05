'use client';
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { createClient } from '@/lib/api-client/client'
import { z } from 'zod'
import { apiGet, apiPost, ApiError } from '@/lib/api/client'

// ── Schemas ────────────────────────────────────────────────────────────────
const subscriptionResponseSchema = z.object({
  plan: z.string().optional(),
  status: z.string().optional(),
  trialEndsAt: z.string().optional(),
  periodEnd: z.string().optional(),
}).passthrough()
const updatePasswordMutationSchema = z.object({}).passthrough()

interface Subscription {
  plan_id: string
  status: string
  trial_ends_at: string
  current_period_end: string
  subscription_plans?: { name: string }
}

export default function AccountPage() {
  const { data: session, status } = useSession()
  const dbClient = createClient()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const user = session?.user ?? null
  const loading = status === 'loading'

  useEffect(() => {
    if (!user?.id) return
    async function loadSubscription() {
      try {
        const data = await apiGet(
          '/api/subscription',
          subscriptionResponseSchema,
          { ttlMs: 0 },
        )
        setSubscription({
          plan_id: data.plan || 'free',
          status: data.status || 'active',
          trial_ends_at: data.trialEndsAt || '',
          current_period_end: data.periodEnd || new Date(Date.now() + 30 * 86400000).toISOString(),
        })
      } catch (err) {
        if (err instanceof ApiError) {
          // Subscription fetch failed — keep default
        }
      }
    }
    loadSubscription()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function updatePassword(newPassword: string) {
    setSaving(true)
    setMessage('')
    try {
      await apiPost(
        '/api/auth/update-password',
        updatePasswordMutationSchema,
        { password: newPassword },
      )
      setMessage('Password updated successfully!')
    } catch (err) {
      if (err instanceof ApiError) {
        setMessage('Error: ' + err.message)
      } else {
        setMessage('Error: Password update failed')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[var(--accent)]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-16">
      <div className="max-w-3xl mx-auto px-6">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">Account Settings</h1>

        <div className="space-y-8">
          <Section title="Profile">
            <div className="space-y-4">
              <div>
                <label htmlFor="account-email" className="block text-sm text-[var(--text-secondary)] mb-1">Email</label>
                <input id="account-email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-muted)]"
                />
              </div>
            </div>
          </Section>

          <Section title="Change Password">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.target as HTMLFormElement
                const newPassword = (form.elements.namedItem('newPassword') as HTMLInputElement).value
                updatePassword(newPassword)
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="account-new-password" className="block text-sm text-[var(--text-secondary)] mb-1">New Password</label>
                <input id="account-new-password"
                  name="newPassword"
                  type="password"
                  required
                  minLength={6}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-[var(--text-primary)]"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="bg-[var(--accent)] text-black px-6 py-2 rounded-lg font-medium hover:bg-[var(--accent-dim)] disabled:opacity-50"
              >
                {saving ? 'Updating...' : 'Update Password'}
              </button>
              {message && (
                <p className={`text-sm ${message.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
                  {message}
                </p>
              )}
            </form>
          </Section>

          <Section title="Subscription">
            {subscription ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[var(--text-primary)] font-medium capitalize">
                      {subscription.subscription_plans?.name || subscription.plan_id} Plan
                    </p>
                    <p className="text-[var(--text-secondary)] text-sm">
                      {subscription.status === 'trial' 
                        ? `Trial ends ${new Date(subscription.trial_ends_at).toLocaleDateString()}`
                        : `Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`
                      }
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    subscription.plan_id === 'enterprise' ? 'bg-amber-900/50 text-amber-400' :
                    subscription.plan_id === 'firm' ? 'bg-purple-900/50 text-purple-400' :
                    subscription.plan_id === 'team' ? 'bg-blue-900/50 text-blue-400' :
                    subscription.plan_id === 'pro' ? 'bg-green-900/50 text-green-400' :
                    'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                  }`}>
                    {subscription.plan_id.toUpperCase()}
                  </span>
                </div>
                <a
                  href="/pricing"
                  className="inline-block bg-[var(--accent)] text-black px-6 py-2 rounded-lg font-medium hover:bg-[var(--accent-dim)]"
                >
                  {subscription.plan_id === 'free' ? 'Upgrade Plan' : 'Manage Plan'}
                </a>
              </div>
            ) : (
              <p className="text-[var(--text-secondary)]">No active subscription</p>
            )}
          </Section>

          <Section title="Payment History">
            <p className="text-[var(--text-secondary)]">No payment history yet.</p>
          </Section>

          <Section title="Danger Zone">
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
              <h4 className="text-red-400 font-medium mb-2">Delete Account</h4>
              <p className="text-[var(--text-secondary)] text-sm mb-4">
                Once you delete your account, there is no going back. All your projects and data will be permanently deleted.
              </p>
              <button className="bg-red-900 text-red-400 px-4 py-2 rounded-lg text-sm hover:bg-red-800">
                Delete My Account
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6">
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">{title}</h2>
      {children}
    </div>
  )
}
