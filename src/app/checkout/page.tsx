'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CurrencyCode, PlanId } from '@/lib/subscription/catalog'
import { PLAN_CATALOG } from '@/lib/subscription/catalog'
import {
  checkMpesaPaymentStatus,
  getCurrencyForCountry,
  getPaymentMethods,
  startSubscriptionPayment,
  type PaymentMethod,
} from '@/lib/enterprise'

export default function CheckoutPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('pro')
  const [country, setCountry] = useState('Kenya')
  const [currency, setCurrency] = useState<CurrencyCode>('KES')
  const [method, setMethod] = useState<PaymentMethod['type']>('mpesa')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mpesa, setMpesa] = useState<{ paymentId: string; checkoutRequestId: string } | null>(null)

  const plan = useMemo(
    () => PLAN_CATALOG.find((p) => p.id === selectedPlanId)!,
    [selectedPlanId]
  )

  const paymentMethods = useMemo(() => getPaymentMethods(country), [country])

  useEffect(() => {
    if (!paymentMethods.some((m) => m.type === method)) {
      setMethod(paymentMethods[0]?.type ?? 'card')
    }
  }, [paymentMethods, method])

  const formatPrice = (amount: number) => {
    const symbols: Partial<Record<CurrencyCode, string>> = {
      KES: 'KSh ',
      UGX: 'USh ',
      TZS: 'TSh ',
      NGN: '₦ ',
      GHS: 'GH₵ ',
      ZAR: 'R ',
      USD: '$ ',
      EUR: '€ ',
      GBP: '£ ',
      INR: '₹ ',
      IDR: 'Rp ',
      BRL: 'R$ ',
      AUD: 'A$ ',
    }
    return `${symbols[currency] ?? `${currency} `}${amount.toLocaleString()}`
  }

  const onStart = async () => {
    setError(null)
    setProcessing(true)
    try {
      const res = await startSubscriptionPayment({
        planId: plan.id,
        currency,
        method,
        email,
        phoneNumber: phoneNumber || undefined,
        country,
      })

      if (res.kind === 'activated') {
        window.location.href = '/dashboard'
        return
      }

      if (res.kind === 'redirect') {
        window.location.href = res.url
        return
      }

      if (res.kind === 'mpesa') {
        setMpesa({ paymentId: res.paymentId, checkoutRequestId: res.checkoutRequestId })
        setStep(4)
        return
      }

      setError('Unexpected payment response.')
    } catch (e: any) {
      setError(e?.message ?? 'Payment failed.')
    } finally {
      setProcessing(false)
    }
  }

  const canContinueDetails =
    !!email && (method !== 'mpesa' || !!phoneNumber) && paymentMethods.some((m) => m.type === method)

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Checkout</h1>
        <p className="text-gray-400 mb-8">Choose a plan and complete payment.</p>

        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded ${step >= (s as any) ? 'bg-[#E8841A]' : 'bg-[#222]'}`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-900/50 bg-red-900/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[#222] p-6">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">1) Select Plan</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Country</label>
              <select
                value={country}
                onChange={(e) => {
                  const c = e.target.value
                  setCountry(c)
                  setCurrency(getCurrencyForCountry(c))
                }}
                className="w-full p-3 bg-[var(--bg-primary)] border border-[#222] rounded-lg text-white"
              >
                <option value="Kenya">Kenya</option>
                <option value="Uganda">Uganda</option>
                <option value="Tanzania">Tanzania</option>
                <option value="Nigeria">Nigeria</option>
                <option value="Ghana">Ghana</option>
                <option value="South Africa">South Africa</option>
                <option value="Germany">Germany</option>
                <option value="UK">UK</option>
                <option value="US">US</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">Currency auto-selects from country, and you can still pay via card globally.</p>
            </div>

            <div className="space-y-3">
              {PLAN_CATALOG.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlanId(p.id)}
                  className={`w-full text-left p-4 border-2 rounded-lg transition ${
                    selectedPlanId === p.id ? 'border-[#E8841A] bg-[#E8841A]/10' : 'border-[#222] hover:border-[#333]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[var(--text-primary)] font-semibold text-lg">{p.name}</div>
                      <div className="text-gray-500 text-sm">{p.features.slice(0, 2).join(' • ')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#E8841A] font-bold text-2xl">{formatPrice(p.prices[currency])}</div>
                      <div className="text-gray-500 text-xs">/month</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full mt-6 py-3 bg-[#E8841A] text-black rounded-lg hover:bg-[#d47619]"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[#222] p-6">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">2) Payment Details</h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full p-3 bg-[var(--bg-primary)] border border-[#222] rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone (M-Pesa only)</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+254700000000"
                  className="w-full p-3 bg-[var(--bg-primary)] border border-[#222] rounded-lg text-white"
                />
                <p className="text-xs text-gray-500 mt-2">Required only for M-Pesa STK Push.</p>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Payment Method</label>
              <div className="space-y-2">
                {paymentMethods.map((pm) => (
                  <label
                    key={pm.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                      method === pm.type ? 'border-[#E8841A] bg-[#E8841A]/10' : 'border-[#222]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={pm.type}
                      checked={method === pm.type}
                      onChange={() => setMethod(pm.type)}
                    />
                    <span className="text-gray-200">{pm.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 border border-[#333] text-gray-200 rounded-lg hover:bg-[#0f172a]"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canContinueDetails}
                className="flex-1 py-3 bg-[#E8841A] text-black rounded-lg hover:bg-[#d47619] disabled:bg-gray-700 disabled:text-gray-300"
              >
                Review Order
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[#222] p-6">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">3) Confirm & Pay</h2>

            <div className="rounded-lg border border-[#222] bg-[var(--bg-primary)] p-4 mb-6">
              <div className="flex items-center justify-between text-gray-200 mb-2">
                <span>Plan</span>
                <span className="font-semibold">{plan.name}</span>
              </div>
              <div className="flex items-center justify-between text-gray-200 mb-2">
                <span>Currency</span>
                <span className="font-semibold">{currency}</span>
              </div>
              <div className="flex items-center justify-between text-gray-200 mb-2">
                <span>Method</span>
                <span className="font-semibold">{paymentMethods.find((p) => p.type === method)?.name ?? method}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[#222] pt-2 mt-2 text-gray-200">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg text-[#E8841A]">{formatPrice(plan.prices[currency])}</span>
              </div>
            </div>

            <div className="text-xs text-gray-500 mb-6">
              Card payments use Stripe Checkout (Visa/Mastercard). PayPal redirects to PayPal approval. M-Pesa triggers STK push.
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 border border-[#333] text-gray-200 rounded-lg hover:bg-[#0f172a]"
              >
                Back
              </button>
              <button
                onClick={onStart}
                disabled={processing}
                className="flex-1 py-3 bg-[#E8841A] text-black rounded-lg hover:bg-[#d47619] disabled:bg-gray-700 disabled:text-gray-300"
              >
                {processing ? 'Starting payment…' : 'Pay Now'}
              </button>
            </div>
          </div>
        )}

        {step === 4 && mpesa && (
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[#222] p-6">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">M-Pesa STK Push Sent</h2>
            <p className="text-gray-400 mb-6">Complete payment on your phone, then verify to activate your plan.</p>

            <button
              onClick={async () => {
                setProcessing(true)
                setError(null)
                try {
                  const r = await checkMpesaPaymentStatus(mpesa)
                  if (r.status === 'completed') {
                    window.location.href = '/dashboard'
                    return
                  }
                  if (r.status === 'failed') setError('Payment failed. Please try again.')
                  if (r.status === 'pending') setError('Still pending. If you have paid, wait a moment then try again.')
                } catch (e: any) {
                  setError(e?.message ?? 'Failed to verify payment.')
                } finally {
                  setProcessing(false)
                }
              }}
              disabled={processing}
              className="w-full py-3 bg-[#E8841A] text-black rounded-lg hover:bg-[#d47619] disabled:bg-gray-700 disabled:text-gray-300"
            >
              {processing ? 'Checking…' : 'Verify Payment'}
            </button>

            <button
              onClick={() => {
                setMpesa(null)
                setStep(2)
              }}
              className="w-full mt-3 py-3 border border-[#333] text-gray-200 rounded-lg hover:bg-[#0f172a]"
            >
              Change method
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
