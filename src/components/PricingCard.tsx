'use client'
import Link from 'next/link'
import type { PlanId } from '@/lib/subscription/catalog'
import type { CurrencyCode } from '@/lib/subscription/catalog'

interface PricingCardProps {
  planId: PlanId
  name: string
  price: number
  currency: CurrencyCode
  features: Array<{ text: string; included: boolean }>
  cta: string
  popular?: boolean
  currentPlan?: PlanId
  href?: string
}

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
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

export default function PricingCard({
  planId,
  name,
  price,
  currency,
  features,
  cta,
  popular = false,
  currentPlan,
  href,
}: PricingCardProps) {
  const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `
  const isCurrent = currentPlan === planId
  const isFree = price === 0

  const linkHref = href || (planId === 'team' ? 'mailto:support@metardu.app?subject=Team%20Plan' : `/checkout?plan=${planId}&currency=${currency}`)

  return (
    <div
      className={`relative bg-[var(--bg-secondary)] rounded-2xl border p-8 flex flex-col ${
        popular ? 'border-[var(--accent)]' : 'border-[var(--border-color)]'
      }`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--accent)] text-black text-xs font-bold px-4 py-1 rounded-full">
          Most Popular
        </div>
      )}

      <div className="mb-1">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
          planId === 'free' ? 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]' :
          planId === 'pro' ? 'bg-emerald-900/50 text-emerald-400' :
          'bg-blue-900/50 text-blue-400'
        }`}>
          {name.toUpperCase()}
        </span>
      </div>

      <div className="mb-6">
        <span className="text-[var(--accent)] text-4xl font-bold">
          {isFree ? 'Free' : `${symbol}${price.toLocaleString()}`}
        </span>
        {!isFree && (
          <span className="text-[var(--text-muted)]">/{currency === 'USD' ? 'mo' : 'month'}</span>
        )}
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature, i) => (
          <li
            key={i}
            className={`flex items-center gap-3 text-sm ${
              feature.included ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
            }`}
          >
            <span className={`text-lg ${feature.included ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
              {feature.included ? '✓' : '✗'}
            </span>
            {feature.text}
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <div className="w-full py-3 rounded-lg font-medium text-center bg-[var(--bg-tertiary)] text-[var(--text-secondary)] cursor-default">
          Current Plan
        </div>
      ) : planId === 'team' ? (
        <a
          href={linkHref}
          className="block w-full py-3 rounded-lg font-medium text-center transition-colors bg-[var(--bg-tertiary)] text-white hover:bg-[var(--bg-tertiary)]"
        >
          {cta}
        </a>
      ) : (
        <Link
          href={linkHref}
          className={`block w-full py-3 rounded-lg font-medium text-center transition-colors ${
            popular
              ? 'bg-[var(--accent)] text-black hover:bg-[var(--accent-dim)]'
              : 'bg-[var(--bg-tertiary)] text-white hover:bg-[var(--bg-tertiary)]'
          }`}
        >
          {cta}
        </Link>
      )}
    </div>
  )
}
