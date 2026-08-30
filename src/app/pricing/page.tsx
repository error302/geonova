'use client';
import { useState, useEffect, useRef } from 'react'
import { ModernPricingPage, PricingCardProps } from '@/components/ui/animated-glassy-pricing'
import { PLAN_CATALOG, getPlanPrice, type CurrencyCode } from '@/lib/subscription/catalog'
import { MpesaCheckoutModal } from '@/components/pricing/MpesaCheckoutModal'
import { getMpesaTillNumber } from '@/lib/payments/mpesaConfig'
import { Smartphone, CreditCard } from 'lucide-react'
import { logger } from '@/lib/logger'

// Minimal typed surface for the PayPal v6 SDK global (window.paypal)
interface PayPalV6PaymentSession {
  start(opts: { presentationMode: string }, createOrder: () => Promise<{ orderId: string }>): Promise<void>
}
interface PayPalV6SDKInstance {
  createPayPalOneTimePaymentSession(options: {
    onApprove: (data: { orderId: string }) => void
    onCancel: (data: unknown) => void
    onError: (error: unknown) => void
  }): PayPalV6PaymentSession
}
interface PayPalV6SDK {
  createInstance(config: { clientId: string; components: string[]; pageType: string; currency: CurrencyCode }): Promise<PayPalV6SDKInstance>
}

declare global {
  interface Window {
    paypal?: PayPalV6SDK
  }
}


const currencyMap: Record<string, CurrencyCode> = {
  'KE': 'KES', 'UG': 'UGX', 'TZ': 'TZS', 'NG': 'NGN',
  'GH': 'GHS', 'ZA': 'ZAR', 'IN': 'INR', 'ID': 'IDR',
  'BR': 'BRL', 'AU': 'AUD', 'GB': 'GBP', 'FR': 'EUR',
  'DE': 'EUR', 'US': 'USD', 'ET': 'KES', 'RW': 'KES',
  'SD': 'KES', 'MA': 'EUR', 'EG': 'USD'
}

const formatPrice = (price: number, currency: CurrencyCode) => {
  const symbols: Record<string, string> = {
    KES: 'KSh ', UGX: 'USh ', TZS: 'TSh ', NGN: '₦ ', USD: '$ ',
    GHS: '₵ ', ZAR: 'R ', INR: '₹ ', IDR: 'Rp ', BRL: 'R$ ', AUD: 'A$ ', GBP: '£ ', EUR: '€ '
  }
  return `${symbols[currency] || ''}${price.toLocaleString()}`
}

export default function PricingPage() {
  const [currency, setCurrency] = useState<CurrencyCode>('KES')
  const paypalLoadedRef = useRef(false)

  useEffect(() => { document.title = 'Pricing — METARDU' }, [])

  useEffect(() => {
    async function detectCurrency() {
      try {
        const cached = localStorage.getItem('metardu:currency')
        if (cached) {
          const { code, ts } = JSON.parse(cached) as { code: CurrencyCode; ts: number }
          if (Date.now() - ts < 86400000) { setCurrency(code); return }
        }
      } catch { /* ignore */ }
      try {
        const res = await fetch('https://ipapi.co/json/')
        const data = (await res.json()) as { country_code?: string }
        if (data.country_code && currencyMap[data.country_code]) {
          const code = currencyMap[data.country_code]
          setCurrency(code)
          try { localStorage.setItem('metardu:currency', JSON.stringify({ code, ts: Date.now() })) } catch { /* ignore */ }
        }
      } catch {
        // Use default KES
      }
    }
    detectCurrency()
  }, [])

  const [selectedPlanId, setSelectedPlanId] = useState<string>('pro')

  // Load PayPal SDK v6
  useEffect(() => {
    if (paypalLoadedRef.current) return

    const script = document.createElement('script')
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ''
    if (!clientId) {
      return
    }
    
    script.src = `https://www.paypal.com/web-sdk/v6/core`
    script.async = true
    script.onload = async () => {
      paypalLoadedRef.current = true
      try {
        if (!window.paypal) {
          return
        }
        const sdkInstance = await window.paypal.createInstance({
          clientId,
          components: ["paypal-payments"],
          pageType: "checkout",
          currency: currency
        })

        const paymentSessionOptions = {
          async onApprove(data: { orderId: string }) {
            try {
              const res = await fetch('/api/payments/paypal/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: data.orderId })
              })
              const captureData = (await res.json()) as { error?: string }
              if (captureData.error) throw new Error(captureData.error)
              alert("Payment successful! Thank you for subscribing.")
            } catch {
              alert("Payment capture failed.")
            }
          },
          onCancel() {
            /* cancelled */
          },
          onError() {
            alert("An error occurred during payment.")
          },
        }

        const paypalPaymentSession = sdkInstance.createPayPalOneTimePaymentSession(paymentSessionOptions)

        const paypalButton = document.getElementById("paypal-v6-button")
        if (paypalButton) {
          paypalButton.removeAttribute("hidden")
          paypalButton.addEventListener("click", async () => {
            try {
              await paypalPaymentSession.start(
                { presentationMode: "auto" },
                () => {
                  return fetch("/api/payments/paypal/create", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    // Access the current selectedPlanId and currency from a mutable ref or closures if necessary,
                    // but since this is bound once, we should fetch the current value from the DOM or state.
                    // We'll use a hack to read from a data attribute or global, but easiest is reading a data-plan attribute.
                    body: JSON.stringify({ 
                      planId: document.getElementById('paypal-v6-button')?.getAttribute('data-plan') || 'pro', 
                      currency: document.getElementById('paypal-v6-button')?.getAttribute('data-currency') || 'USD' 
                    })
                  })
                  .then(response => response.json())
                  .then((data: { error?: string; orderId?: string }) => {
                    if (data.error) throw new Error(data.error)
                    if (!data.orderId) throw new Error('Missing order ID from create response')
                    return { orderId: data.orderId }
                  })
                }
              )
            } catch (error) {
              logger.error("PayPal payment start error:", { error })
            }
          })
        }
      } catch (err) {
        logger.warn('[Pricing] PayPal SDK v6 render error:', { error: err })
      }
    }
    document.body.appendChild(script)

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script)
    }
  }, [currency]) // Re-bind if currency changes to ensure correct currency in createInstance (though technically sdkInstance might not re-init easily, keeping it simple for now)

  const [mpesaModalOpen, setMpesaModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'mpesa' | 'paypal'>('mpesa')

  // Show Free, Pro, and Team plans on pricing page (single source of truth from PLAN_CATALOG)
  const visiblePlans = PLAN_CATALOG.filter(p => ['free', 'pro', 'team'].includes(p.id))

  const selectedPlan = PLAN_CATALOG.find(p => p.id === selectedPlanId) || visiblePlans[1]
  const amountKes = getPlanPrice(selectedPlan.id as any, 'KES')

  const plans: PricingCardProps[] = visiblePlans.map(plan => ({
    planId: plan.id,
    planName: plan.name,
    description: plan.id === 'free'
      ? 'Perfect for students and hobbyist surveyors'
      : plan.id === 'pro'
        ? 'For professional surveyors and small firms'
        : 'Collaborate with your survey crew',
    price: formatPrice(getPlanPrice(plan.id, currency), currency),
    features: plan.features,
    buttonText: plan.id === 'free'
      ? 'Get Started Free'
      : plan.id === 'team'
        ? 'Start Free Trial'
        : 'Start Free Trial',
    buttonVariant: plan.id === 'free' ? 'secondary' as const : 'primary' as const,
    isPopular: plan.id === 'pro',
  }))

  return (
    <>
      <ModernPricingPage
        title={
          <>
            Simple, <span className="text-cyan-400">Transparent</span> Pricing
          </>
        }
        subtitle="Start free, upgrade when you need more. Two trusted payment options: M-Pesa Buy Goods Till & PayPal."
        plans={plans}
      >
        {/* Payment Methods Section */}
        <div className="w-full max-w-4xl mx-auto mt-16 mb-12 p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3 border border-emerald-500/20">
              ⚡ Instant Activation
            </div>
            <h3 className="text-2xl font-bold text-[var(--text-primary)]">Choose Your Payment Method</h3>
            <p className="text-[var(--text-secondary)] text-sm mt-1">
              Pay securely via Lipa na M-Pesa Till (Kenya) or PayPal / Card (Global).
            </p>

            {/* Payment Method Switcher Tabs */}
            <div className="flex justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setActiveTab('mpesa')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  activeTab === 'mpesa'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg'
                    : 'bg-black/20 text-[var(--text-muted)] border border-[var(--border-color)] hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>M-Pesa Buy Goods (Till {getMpesaTillNumber()})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('paypal')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  activeTab === 'paypal'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-lg'
                    : 'bg-black/20 text-[var(--text-muted)] border border-[var(--border-color)] hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4 text-blue-400" />
                <span>PayPal / International Card</span>
              </button>
            </div>
          </div>

          {/* Plan Selector */}
          <div className="max-w-md mx-auto mb-8 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-between">
            <div>
              <span className="text-xs text-[var(--text-muted)] block">Selected Plan:</span>
              <span className="text-base font-bold text-white">{selectedPlan.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-[var(--accent)]"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value as string)}
              >
                {visiblePlans.filter(p => p.id !== 'free').map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatPrice(getPlanPrice(p.id, currency), currency)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tab 1: M-Pesa Buy Goods Till */}
          {activeTab === 'mpesa' && (
            <div className="max-w-md mx-auto text-center space-y-4">
              <div className="p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-left space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-emerald-400">TILL NUMBER:</span>
                  <span className="text-xs font-bold text-[var(--accent)]">{getMpesaTillNumber()}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Pay directly from your Safaricom M-Pesa line using Buy Goods Till <strong className="text-emerald-400 font-mono">{getMpesaTillNumber()}</strong> and get instant access + email receipt.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMpesaModalOpen(true)}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                <span>Pay KSh {amountKes.toLocaleString()} via M-Pesa Till →</span>
              </button>
            </div>
          )}

          {/* Tab 2: PayPal Checkout */}
          {activeTab === 'paypal' && (
            <div className="max-w-md mx-auto text-center space-y-4">
              <div className="flex justify-center min-h-[160px] items-center">
                {/* @ts-expect-error custom web component */}
                <paypal-button
                  id="paypal-v6-button"
                  hidden
                  data-plan={selectedPlanId}
                  data-currency={currency}
                />
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Supports Visa, Mastercard, American Express, and PayPal balances.
              </p>
            </div>
          )}
        </div>
      </ModernPricingPage>

      {/* M-Pesa Checkout Modal */}
      <MpesaCheckoutModal
        isOpen={mpesaModalOpen}
        onClose={() => setMpesaModalOpen(false)}
        planId={selectedPlanId as any}
        planName={selectedPlan.name}
        amountKes={amountKes}
      />
    </>
  )
}
