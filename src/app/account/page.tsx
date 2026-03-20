'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AccountPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    if (user) {
      const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('*, subscription_plans(*)')
        .eq('user_id', user.id)
        .single()
      setSubscription(sub)
    }
    setLoading(false)
  }

  async function updatePassword(currentPassword: string, newPassword: string) {
    setSaving(true)
    setMessage('')

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage('Password updated successfully!')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[#E8841A]">Loading...</div>
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
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Email</label>
                <input
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
                updatePassword('', newPassword)
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">New Password</label>
                <input
                  name="newPassword"
                  type="password"
                  required
                  minLength={6}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-4 py-2 text-white"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="bg-[#E8841A] text-black px-6 py-2 rounded-lg font-medium hover:bg-[#d47619] disabled:opacity-50"
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
                    subscription.plan_id === 'team' ? 'bg-blue-900/50 text-blue-400' :
                    subscription.plan_id === 'pro' ? 'bg-green-900/50 text-green-400' :
                    'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                  }`}>
                    {subscription.plan_id.toUpperCase()}
                  </span>
                </div>
                <a
                  href="/pricing"
                  className="inline-block bg-[#E8841A] text-black px-6 py-2 rounded-lg font-medium hover:bg-[#d47619]"
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
