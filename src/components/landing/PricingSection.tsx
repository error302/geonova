'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

/* ────────────────────────────────────────────────────────────── */
/*  Data                                                          */
/* ────────────────────────────────────────────────────────────── */

const PRICING = [
  {
    tier: 'Free',
    description: 'For students & occasional use',
    priceMonthly: 0,
    priceAnnual: 0,
    period: '/month',
    features: ['All quick calculation tools', '1 survey project', 'Up to 50 survey points', 'Basic PDF report', 'CSV import', 'Offline calculations'],
    cta: 'Start Free',
    href: '/register',
    highlighted: false,
  },
  {
    tier: 'Pro',
    description: 'For licensed surveyors',
    priceMonthly: 500,
    priceAnnual: 5000,
    period: '/month',
    features: ['Everything in Free', 'Unlimited projects', 'Unlimited survey points', 'GNSS baseline processing', 'Deed plan generation', 'NLIMS exports', 'Priority support'],
    cta: 'Start Pro',
    href: '/checkout?plan=pro',
    highlighted: true,
  },
  {
    tier: 'Team',
    description: 'For surveying firms',
    priceMonthly: 2000,
    priceAnnual: 20000,
    period: '/month',
    features: ['Everything in Pro', '5 team members', 'Real-time collaboration', 'Role-based access', 'Audit trail', 'Branded reports'],
    cta: 'Start Team',
    href: '/checkout?plan=team',
    highlighted: false,
  },
]

function MPesaBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-700 text-white uppercase tracking-wider"
      title="Pay with M-Pesa"
    >
      M-Pesa
    </span>
  )
}

export function PricingSection() {
  const [annual, setAnnual] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const handleScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setActive(idx)
  }

  return (
    <section aria-labelledby="pricing-heading" className="py-32 md:py-40 bg-[var(--bg-secondary)] border-t border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="text-center mb-10">
          <p className="text-[var(--accent)] text-sm font-semibold uppercase tracking-widest mb-4">
            Pricing
          </p>
          <h2 id="pricing-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Start free,{' '}
            <span className="text-[var(--accent)]">scale as you grow</span>
          </h2>
          <p className="max-w-xl mx-auto text-[var(--text-primary)]/70 text-base lg:text-lg">
            No hidden fees. Pay via M-Pesa, card, or PayPal.
          </p>
        </div>

        {/* Billing interval toggle */}
        <div className="flex justify-center mb-12">
          <div
            role="radiogroup"
            aria-label="Billing interval"
            className="inline-flex items-center bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full p-1"
          >
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 text-sm rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                !annual ? 'bg-[var(--accent)] text-black font-semibold' : 'text-[var(--text-primary)]/70'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 text-sm rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                annual ? 'bg-[var(--accent)] text-black font-semibold' : 'text-[var(--text-primary)]/70'
              }`}
            >
              Annual <span className="text-xs opacity-80">· 2 months free</span>
            </button>
          </div>
        </div>

                <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="md:grid md:grid-cols-3 gap-6 md:gap-8 items-start max-w-5xl mx-auto flex overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-4 -mx-4"
        >
          {PRICING.map((plan, i) => {
            const price = annual ? plan.priceAnnual : plan.priceMonthly
            const periodLabel = annual ? '/year' : plan.period
            return (
              <div
                key={i}
                className={`relative p-8 rounded-2xl border transition-all min-w-[86%] sm:min-w-[60%] md:min-w-0 snap-center shrink-0 ${
                  plan.highlighted
                    ? 'border-[var(--accent)]/50 bg-[var(--bg-primary)] shadow-[0_0_60px_-15px_rgba(209,123,71,0.2)] md:scale-[1.02]'
                    : 'border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-[var(--accent)]/40'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[var(--accent)] text-black text-xs font-bold rounded-full uppercase tracking-wider">
                    Most Popular
                  </div>
                )}

                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">{plan.tier}</h3>
                <p className="text-sm text-[var(--text-primary)]/70 mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold text-[var(--text-primary)]">
                    KSh {price.toLocaleString()}
                  </span>
                  <span className="text-[var(--text-primary)]/70 text-sm">{periodLabel}</span>
                </div>
                <div className="mb-6">
                  <MPesaBadge />
                </div>

                <ul className="space-y-3 mb-8 list-none p-0">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-[var(--text-primary)]/85">
                      <span className="mt-0.5 text-[var(--accent)]" aria-hidden>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.href}
                  className={`block text-center py-3.5 min-h-[44px] rounded-xl font-semibold text-sm transition-all no-underline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                    plan.highlighted
                      ? 'bg-[var(--accent)] text-black hover:bg-[var(--accent-dim)]'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            )
          })}
        </div>

        {/* swipe indicator — mobile only */}
        <div className="flex md:hidden justify-center gap-2 mt-6" aria-hidden>
          {PRICING.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === active ? 'bg-[var(--accent)]' : 'bg-[var(--border-color)]'
              }`}
            />
          ))}
        </div>

        <p className="text-center text-xs text-[var(--text-primary)]/65 mt-8">
          Need 20+ seats, a white-label license, or on-premise deployment?{' '}
          <Link href="/enterprise" className="text-[var(--accent)] underline underline-offset-2 hover:no-underline">Talk to us about Firm & Enterprise tiers.</Link>
        </p>
      </div>
    </section>
  )
}
