'use client';
import { useState, useEffect, useRef } from 'react'
import { ModernPricingPage, PricingCardProps } from '@/components/ui/animated-glassy-pricing'
import { PLAN_CATALOG, getPlanPrice, SUPPORTED_CURRENCIES, type CurrencyCode } from '@/lib/subscription/catalog'
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

const faqs = [
  {
    q: 'Can I change plans anytime?',
    a: 'Yes. Upgrade or downgrade at any time. Changes take effect immediately.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'M-Pesa (Kenya), Visa/Mastercard (Stripe), and PayPal for global payments.',
  },
  {
    q: 'Is there a free trial?',
    a: 'All paid plans include a 14-day free trial. No credit card required.',
  },
  {
    q: 'Do you offer student discounts?',
    a: 'Yes. Contact us with your student ID for 50% off any plan.',
  },
]

export default function PricingPage() {
  const [currency, setCurrency] = useState<CurrencyCode>('KES')
  const paypalContainerRef = useRef<HTMLDivElement>(null)
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

  // Show Free, Pro, and Team plans on pricing page (single source of truth from PLAN_CATALOG)
  const visiblePlans = PLAN_CATALOG.filter(p => ['free', 'pro', 'team'].includes(p.id))

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
    <ModernPricingPage
      title={
        <>
          Simple, <span className="text-cyan-400">Transparent</span> Pricing
        </>
      }
      subtitle="Start free, upgrade when you need more. No hidden fees, cancel anytime."
      plans={plans}
    >
      {/* PayPal SDK v6 Web Component section */}
      <div className="w-full max-w-5xl mx-auto mt-12 mb-8">
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-foreground mb-2">Pay with PayPal</h3>
          <p className="text-foreground/70 text-sm mb-4">Secure checkout for one-time payments</p>
          
          <div className="flex justify-center gap-2 mb-6 items-center">
            <span className="text-sm font-medium">Select Plan:</span>
            <select 
              className="bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value as string)}
            >
              {visiblePlans.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {formatPrice(getPlanPrice(p.id, currency), currency)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-center">
          <div className="min-h-[200px] flex items-center justify-center w-full max-w-xs">
            {/* @ts-expect-error custom web component */}
            <paypal-button 
              id="paypal-v6-button" 
              hidden 
              data-plan={selectedPlanId}
              data-currency={currency}
            />
          </div>
        </div>
      </div>
    </ModernPricingPage>
  )
}
