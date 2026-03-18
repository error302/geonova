'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

type Currency = 'KES' | 'UGX' | 'TZS' | 'NGN' | 'USD' | 'GHS' | 'ZAR' | 'INR' | 'IDR' | 'BRL' | 'AUD' | 'GBP' | 'EUR'

const currencyMap: Record<string, Currency> = {
  'KE': 'KES', 'UG': 'UGX', 'TZ': 'TZS', 'NG': 'NGN',
  'GH': 'GHS', 'ZA': 'ZAR', 'IN': 'INR', 'ID': 'IDR',
  'BR': 'BRL', 'AU': 'AUD', 'GB': 'GBP', 'FR': 'EUR',
  'DE': 'EUR', 'US': 'USD', 'ET': 'KES', 'RW': 'KES',
  'SD': 'KES', 'MA': 'EUR', 'EG': 'USD'
}

const plans = [
  {
    id: 'free',
    name: 'Free',
    prices: { KES: 0, UGX: 0, TZS: 0, NGN: 0, USD: 0, GHS: 0, ZAR: 0, INR: 0, IDR: 0, BRL: 0, AUD: 0, GBP: 0, EUR: 0 },
    features: [
      { text: 'All 15 quick calculation tools', included: true },
      { text: '1 survey project', included: true },
      { text: 'Up to 50 survey points', included: true },
      { text: 'Basic PDF report', included: true },
      { text: 'CSV import', included: true },
      { text: 'Offline calculations', included: true },
      { text: 'DXF/LandXML export', included: false },
      { text: 'Report share link', included: false },
      { text: 'Team collaboration', included: false },
    ],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    prices: { KES: 500, UGX: 15000, TZS: 10000, NGN: 2000, USD: 4, GHS: 50, ZAR: 75, INR: 350, IDR: 65000, BRL: 20, AUD: 6, GBP: 3, EUR: 4 },
    features: [
      { text: 'Everything in Free', included: true },
      { text: 'Unlimited projects', included: true },
      { text: 'Unlimited survey points', included: true },
      { text: 'Full professional PDF reports', included: true },
      { text: 'DXF export for AutoCAD', included: true },
      { text: 'LandXML export', included: true },
      { text: 'Report share link', included: true },
      { text: 'GPS Stakeout mode', included: true },
      { text: 'Process field notes', included: true },
      { text: 'Priority support', included: true },
      { text: 'Team collaboration', included: false },
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    id: 'team',
    name: 'Team',
    prices: { KES: 2000, UGX: 60000, TZS: 40000, NGN: 8000, USD: 15, GHS: 200, ZAR: 280, INR: 1300, IDR: 230000, BRL: 75, AUD: 22, GBP: 12, EUR: 14 },
    features: [
      { text: 'Everything in Pro', included: true },
      { text: '5 team members', included: true },
      { text: 'Real-time collaboration', included: true },
      { text: 'Role-based access', included: true },
      { text: 'Version history', included: true },
      { text: 'Audit trail', included: true },
      { text: 'Branded reports with firm logo', included: true },
      { text: 'Dedicated support', included: true },
    ],
    cta: 'Contact Us',
    popular: false,
  },
]

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
  const [currency, setCurrency] = useState<Currency>('KES')

  const formatPrice = (price: number) => {
    const symbols: Record<Currency, string> = {
      KES: 'KSh ', UGX: 'USh ', TZS: 'TSh ', NGN: '₦ ', USD: '$ ',
      GHS: '₵ ', ZAR: 'R ', INR: '₹ ', IDR: 'Rp ', BRL: 'R$ ', AUD: 'A$ ', GBP: '£ ', EUR: '€ '
    }
    return `${symbols[currency]}${price.toLocaleString()}`
  }

  useEffect(() => {
    async function detectCurrency() {
      try {
        const res = await fetch('https://ipapi.co/json/')
        const data = await res.json()
        if (data.country_code && currencyMap[data.country_code]) {
          setCurrency(currencyMap[data.country_code])
        }
      } catch {
        // Use default
      }
    }
    detectCurrency()
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-gray-400 text-lg">
            Start free, upgrade when you need more
          </p>
        </div>

        <div className="flex justify-center mb-12">
          <div className="bg-[#111] p-1 rounded-lg flex flex-wrap justify-center gap-1">
            {(['KES', 'UGX', 'TZS', 'NGN', 'GHS', 'ZAR', 'USD', 'EUR', 'GBP', 'INR', 'IDR', 'BRL', 'AUD'] as Currency[]).map((curr) => (
              <button
                key={curr}
                onClick={() => setCurrency(curr)}
                className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  currency === curr
                    ? 'bg-[#E8841A] text-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {curr}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-20">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-[#111] rounded-2xl border ${
                plan.popular ? 'border-[#E8841A]' : 'border-[#222]'
              } p-8 relative`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#E8841A] text-black text-xs font-bold px-4 py-1 rounded-full">
                  Most Popular
                </div>
              )}

              <h3 className="text-white font-bold text-2xl mb-2">{plan.name}</h3>
              <div className="mb-6">
                <span className="text-[#E8841A] text-4xl font-bold">
                  {formatPrice(plan.prices[currency])}
                </span>
                <span className="text-gray-500">/{currency === 'USD' ? 'mo' : 'month'}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li
                    key={i}
                    className={`flex items-center gap-3 text-sm ${
                      feature.included ? 'text-gray-300' : 'text-gray-600'
                    }`}
                  >
                    <span
                      className={`text-lg ${
                        feature.included ? 'text-[#E8841A]' : 'text-gray-700'
                      }`}
                    >
                      {feature.included ? '✓' : '✗'}
                    </span>
                    {feature.text}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.id === 'free' ? '/register' : '/register'}
                className={`block w-full py-3 rounded-lg font-medium text-center transition-colors ${
                  plan.popular
                    ? 'bg-[#E8841A] text-black hover:bg-[#d47619]'
                    : 'bg-[#1e293b] text-white hover:bg-[#334155]'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-[#111] rounded-xl p-6 border border-[#222]">
                <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
                <p className="text-gray-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-12 text-gray-500 text-sm">
          <p>All prices include applicable taxes.</p>
          <p>Need a custom enterprise plan? Contact us at support@geonova.app</p>
        </div>
      </div>
    </div>
  )
}
