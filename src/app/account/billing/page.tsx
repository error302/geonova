'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { PlanId } from '@/lib/subscription/catalog'
import type { CurrencyCode } from '@/lib/subscription/catalog'

interface PaymentRecord {
  id: string
  amount: number
  currency: CurrencyCode
  status: string
  payment_method: string
  transaction_id: string | null
  plan_id: PlanId
  created_at: string
}

interface SubscriptionRecord {
  plan_id: PlanId
  status: string
  payment_method: string
  currency: string
  current_period_start: string
  current_period_end: string
  trial_ends_at: string | null
}

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  KES: 'KSh ', UGX: 'USh ', TZS: 'TSh ', NGN: '₦ ',
  GHS: 'GH₵ ', ZAR: 'R ', USD: '$ ', EUR: '€ ',
  GBP: '£ ', INR: '₹ ', IDR: 'Rp ', BRL: 'R$ ', AUD: 'A$ ',
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-green-400',
  pending: 'text-amber-400',
  failed: 'text-red-400',
  refunded: 'text-gray-400',
  active: 'text-green-400',
  cancelled: 'text-red-400',
  expired: 'text-gray-400',
  trial: 'text-blue-400',
}

export default function BillingPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    if (user) {
      const [{ data: sub }, { data: pay }] = await Promise.all([
        supabase.from('user_subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('payment_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      ])
      setSubscription(sub as any)
      setPayments((pay || []) as any)
    }
    setLoading(false)
  }

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel your subscription? You will retain access until the end of the billing period.')) return
    setCancelling(true)
    setMessage('')

    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'stripe', action: 'cancel-subscription' }),
    })

    if (res.ok) {
      setMessage('Subscription cancelled. You retain access until the end of your billing period.')
      await loadData()
    } else {
      const data = await res.json()
      setMessage(`Error: ${data.error || 'Failed to cancel'}`)
    }
    setCancelling(false)
  }

  async function handleReactivate() {
    setCancelling(true)
    setMessage('')

    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'stripe', action: 'reactivate-subscription' }),
    })

    if (res.ok) {
      setMessage('Subscription reactivated.')
      await loadData()
    } else {
      const data = await res.json()
      setMessage(`Error: ${data.error || 'Failed to reactivate'}`)
    }
    setCancelling(false)
  }

  const formatAmount = (amount: number, currency: CurrencyCode) =>
    `${CURRENCY_SYMBOLS[currency] || `${currency} `}${amount.toLocaleString()}`

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[var(--accent)]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-12">
      <div className="max-w-3xl mx-auto px-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Billing</h1>
          <Link href="/pricing" className="text-[var(--accent)] hover:underline text-sm">
            View Plans
          </Link>
        </div>

        {message && (
          <div className="mb-6 rounded-lg border px-4 py-3 text-sm bg-[var(--bg-secondary)] border-[var(--border-color)]">
            {message}
          </div>
        )}

        <div className="space-y-6">
          <Section title="Current Plan">
            {subscription ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[var(--text-primary)] font-bold text-xl capitalize">
                      {subscription.plan_id} Plan
                    </p>
                    <p className="text-[var(--text-secondary)] text-sm">
                      {subscription.status === 'trial'
                        ? `Free trial ends ${formatDate(subscription.trial_ends_at || '')}`
                        : subscription.status === 'active'
                        ? `Renews ${formatDate(subscription.current_period_end)}`
                        : subscription.status === 'cancelled'
                        ? `Cancels ${formatDate(subscription.current_period_end)} — access ends then`
                        : `Status: ${subscription.status}`}
                    </p>
                    {subscription.payment_method && (
                      <p className="text-[var(--text-muted)] text-xs mt-1">
                        Paid via {subscription.payment_method}
                      </p>
                    )}
                  </div>
                  <span className={`text-sm font-bold px-3 py-1 rounded-full bg-[var(--bg-tertiary)] ${STATUS_COLORS[subscription.status] || 'text-white'}`}>
                    {subscription.status.toUpperCase()}
                  </span>
                </div>

                {subscription.status === 'active' && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="px-4 py-2 border border-red-800 text-red-400 rounded-lg text-sm hover:bg-red-900/20 disabled:opacity-50"
                    >
                      {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
                    </button>
                  </div>
                )}

                {subscription.status === 'cancelled' && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleReactivate}
                      disabled={cancelling}
                      className="px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-semibold hover:bg-[var(--accent-dim)] disabled:opacity-50"
                    >
                      {cancelling ? 'Reactivating...' : 'Reactivate Subscription'}
                    </button>
                  </div>
                )}

                {subscription.status === 'trial' && (
                  <div className="flex gap-3">
                    <Link
                      href="/checkout"
                      className="px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-semibold hover:bg-[var(--accent-dim)]"
                    >
                      Upgrade Now
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--text-primary)] font-bold text-xl">Free Plan</p>
                  <p className="text-[var(--text-secondary)] text-sm">No active subscription</p>
                </div>
                <Link
                  href="/pricing"
                  className="px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-semibold hover:bg-[var(--accent-dim)]"
                >
                  Upgrade
                </Link>
              </div>
            )}
          </Section>

          <Section title="Payment History">
            {payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border-color)]">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Plan</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Method</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((pay) => (
                      <tr key={pay.id} className="border-b border-[var(--border-color)]/50 text-[var(--text-primary)]">
                        <td className="py-3">{formatDate(pay.created_at)}</td>
                        <td className="py-3 capitalize">{pay.plan_id}</td>
                        <td className="py-3">{formatAmount(pay.amount, pay.currency)}</td>
                        <td className="py-3 capitalize">{pay.payment_method || '—'}</td>
                        <td className={`py-3 font-medium ${STATUS_COLORS[pay.status] || 'text-white'}`}>
                          {pay.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[var(--text-secondary)]">No payment history yet.</p>
            )}
          </Section>

          <Section title="Billing Address">
            <p className="text-[var(--text-secondary)] text-sm">
              Contact <a href="mailto:billing@metardu.app" className="text-[var(--accent)] hover:underline">billing@metardu.app</a> to update your billing address or request invoices.
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{title}</h2>
      {children}
    </div>
  )
}
