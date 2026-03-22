'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type Status = 'processing' | 'completed' | 'failed'

export default function SubscriptionSuccessPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const provider = String(searchParams.provider || '')
  const paymentId = String(searchParams.paymentId || '')
  const planId = String(searchParams.planId || '')
  const stripeSessionId = String(searchParams.session_id || '')
  const paypalOrderId = String(searchParams.token || searchParams.orderId || '')

  const [status, setStatus] = useState<Status>('processing')
  const [message, setMessage] = useState<string>('Verifying payment…')

  const canVerify = useMemo(() => {
    if (!provider || !paymentId || !planId) return false
    if (provider === 'stripe') return !!stripeSessionId
    if (provider === 'paypal') return !!paypalOrderId
    return false
  }, [provider, paymentId, planId, stripeSessionId, paypalOrderId])

  useEffect(() => {
    if (!canVerify) {
      setStatus('failed')
      setMessage('Missing payment details. If you paid, contact support.')
      return
    }

    const run = async () => {
      try {
        const payload =
          provider === 'stripe'
            ? { provider: 'stripe', action: 'confirm-session', sessionId: stripeSessionId, paymentId, planId }
            : { provider: 'paypal', action: 'capture-order', orderId: paypalOrderId, paymentId, planId }

        const res = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error('Please log in to verify and activate your subscription.')
          }
          throw new Error(data?.error || 'Verification failed')
        }

        if (data.status === 'completed') {
          setStatus('completed')
          setMessage('Payment completed. Your subscription is now active.')
          return
        }

        if (data.status === 'pending') {
          setStatus('processing')
          setMessage('Payment still pending. If you were charged, wait a moment and refresh.')
          return
        }

        setStatus('failed')
        setMessage('Payment not completed.')
      } catch (e: any) {
        setStatus('failed')
        setMessage(e?.message ?? 'Verification failed.')
      }
    }

    run()
  }, [canVerify, provider, paymentId, planId, stripeSessionId, paypalOrderId])

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl p-8">
        <div className="text-center mb-6">
          {status === 'completed' ? (
            <div className="w-16 h-16 rounded-full bg-green-900/30 border border-green-700/50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
          ) : status === 'processing' ? (
            <div className="w-16 h-16 rounded-full bg-yellow-900/30 border border-yellow-700/50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-red-900/30 border border-red-700/50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2 text-center">METARDU</h1>
        <p className="text-[var(--text-secondary)] mb-6">{message}</p>

        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            status === 'completed'
              ? 'border-green-900/40 bg-green-900/10 text-green-200'
              : status === 'processing'
                ? 'border-yellow-900/40 bg-yellow-900/10 text-yellow-200'
                : 'border-red-900/40 bg-red-900/10 text-red-200'
          }`}
        >
          Status: <span className="font-semibold">{status.toUpperCase()}</span>
        </div>

        <div className="mt-6 flex gap-3">
          <Link
            href="/dashboard"
            className="flex-1 text-center py-3 bg-[var(--accent)] text-black rounded-lg hover:bg-[var(--accent-dim)]"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/checkout"
            className="flex-1 text-center py-3 border border-[var(--border-hover)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-primary)]"
          >
            Back to Checkout
          </Link>
        </div>
      </div>
    </div>
  )
}
