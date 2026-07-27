'use client';
import { useState, useEffect, useRef } from 'react'
import { ModernPricingPage, PricingCardProps } from '@/components/ui/animated-glassy-pricing'
import { PLAN_CATALOG, getPlanPrice, SUPPORTED_CURRENCIES, type CurrencyCode } from '@/lib/subscription/catalog'

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
          const { code, ts } = JSON.parse(cached)
          if (Date.now() - ts < 86400000) { setCurrency(code); return }
        }
      } catch { /* ignore */ }
      try {
        const res = await fetch('https://ipapi.co/json/')
        const data = await res.json()
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

  // Load PayPal Hosted Button
  useEffect(() => {
    if (paypalLoadedRef.current) return

    const script = document.createElement('script')
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ''
    if (!clientId) {
      console.warn('PayPal client ID not configured — set NEXT_PUBLIC_PAYPAL_CLIENT_ID (M-Pesa still works)')
      return
    }
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=hosted-buttons&disable-funding=credit,card`
    script.async = true
    script.onload = () => {
      paypalLoadedRef.current = true
      // Render the hosted button after script loads
      try {
        // @ts-expect-error PayPal SDK global
        if (window.paypal?.HostedButtons) {
          // @ts-expect-error PayPal SDK global
          window.paypal.HostedButtons({
            hostedButtonId: 'V8SP7YFGMUMGG',
          }).render('#paypal-hosted-button-container')
        }
      } catch (err) {
        console.warn('[Pricing] PayPal Hosted Button render error:', err)
      }
    }
    document.body.appendChild(script)

    return () => {
      // Cleanup script on unmount
      if (script.parentNode) script.parentNode.removeChild(script)
    }
  }, [])

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
      {/* PayPal Hosted Button section */}
      <div className="w-full max-w-5xl mx-auto mt-12 mb-8">
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-foreground mb-2">Pay with PayPal</h3>
          <p className="text-foreground/70 text-sm">Secure payment via PayPal — no account required</p>
        </div>
        <div className="flex justify-center">
          <div
            id="paypal-hosted-button-container"
            ref={paypalContainerRef}
            className="min-h-[200px] flex items-center justify-center"
          />
        </div>
      </div>
    </ModernPricingPage>
  )
}
