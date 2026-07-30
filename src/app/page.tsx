'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import {
  Waypoints, FileBadge, Mountain, DraftingCompass,
  Satellite, FileChartColumn, MapPinned, Calculator,
  ShieldCheck, ChevronDown,
} from 'lucide-react'

/* ────────────────────────────────────────────────────────────── */
/*  Data                                                          */
/* ────────────────────────────────────────────────────────────── */

const STATS = [
  { value: '47', suffix: '', label: 'Counties supported' },
  { value: 'Arc 1960', suffix: '', label: 'UTM 36S/37S datum' },
  { value: 'Cap 299', suffix: '', label: 'Survey Act compliant' },
  { value: 'NLIMS', suffix: ' ', label: 'ArdhiSasa-ready exports' },
]

const TRUST_BADGES = [
  { label: 'ISK', sublabel: 'Institution of Surveyors of Kenya' },
  { label: 'EBK', sublabel: 'Engineers Board of Kenya' },
  { label: 'SoK', sublabel: 'Survey of Kenya' },
  { label: 'RDM 1.1', sublabel: 'Road Design Manual' },
  { label: 'NLIMS', sublabel: 'ArdhiSasa integration' },
]

const FEATURES = [
  {
    icon: Waypoints,
    title: 'Traverse Adjustment',
    description: 'Bowditch, Transit, and Least Squares adjustment with RDM 1.1 accuracy grading. Full bearing/distance computation with closure checks.',
  },
  {
    icon: FileBadge,
    title: 'Deed Plan Generation',
    description: 'Survey Act Cap. 299 compliant Form No. 4 with SVG, PDF, and DXF output. SHA-256 verified, Director of Surveys authentication block.',
  },
  {
    icon: Mountain,
    title: 'Topographic Surveys',
    description: 'TIN generation, contour extraction, volume computation. Web Worker TIN for large datasets. Auto breakline detection from mesh analysis.',
  },
  {
    icon: DraftingCompass,
    title: 'COGO Engine',
    description: 'Intersection, resection, radiation, bearing-distance. Full coordinate geometry with solution steps shown for every calculation.',
  },
  {
    icon: Satellite,
    title: 'GNSS Baseline Processing',
    description: 'Upload RINEX files and get adjusted coordinates via RTKLIB integration. No external software needed — process baselines right in the browser.',
  },
  {
    icon: FileChartColumn,
    title: 'Statutory Documents',
    description: 'RDM 1.1 survey reports, Form C-22, CLA forms, computation workbooks. NLIMS-ready exports with ArdhiSasa integration.',
  },
]

const WORKFLOW_STEPS = [
  {
    number: '01',
    title: 'Set Up Project',
    description: 'Enter project details, LR number, UTM zone, and surveyor credentials. METARDU handles the rest.',
    example: 'Project: LR 20904/2 · UTM 37S · Surveyor: ISK/LS/2021/0452',
  },
  {
    number: '02',
    title: 'Collect & Compute',
    description: 'Import field data from total stations, GNSS, or CSV. Run Bowditch, levelling, COGO, and curve calculations with full working shown.',
    example: 'Closure: 1:48,000  RDM 1.1 Class B',
  },
  {
    number: '03',
    title: 'Submit & Archive',
    description: 'Generate deed plans, survey reports, and NLIMS exports. Every computation is audit-chained for legal compliance.',
    example: 'Form No. 4 PDF · SHA-256 seal · NLIMS-ready',
  },
]

const TOOLS = [
  { icon: Calculator, title: 'Traverse', description: 'Bowditch & Transit adjustment' },
  { icon: MapPinned, title: 'COGO', description: 'Intersection & resection' },
  { icon: Mountain, title: 'Contours', description: 'TIN + marching triangles' },
  { icon: DraftingCompass, title: 'Curves', description: 'Horizontal & vertical design' },
  { icon: Satellite, title: 'GNSS', description: 'RINEX baseline processing' },
  { icon: FileBadge, title: 'Deed Plans', description: 'Form No. 4 generation' },
  { icon: FileChartColumn, title: 'Reports', description: 'RDM 1.1 survey reports' },
  { icon: ShieldCheck, title: 'Validation', description: 'NLIMS pre-flight checks' },
]

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

const FAQS = [
  {
    q: 'Does METARDU work offline?',
    a: 'Yes. The full survey engine runs in your browser. Field observations, traverse adjustment, COGO, and deed-plan generation all work without a network connection. Sync resumes automatically when you are back online.',
  },
  {
    q: 'Can I pay with M-Pesa?',
    a: 'Yes — every paid tier accepts M-Pesa Daraja, Stripe (card), and PayPal. M-Pesa is the default for Kenyan accounts and supports both monthly and annual billing.',
  },
  {
    q: 'Are the deed plans accepted by the Survey of Kenya?',
    a: 'METARDU produces Survey Act Cap. 299 Form No. 4 layouts with SHA-256 audit seals and the Director of Surveys authentication block. The output is NLIMS / ArdhiSasa-ready — but submission still requires your wet-ink seal and signature.',
  },
  {
    q: 'What happens to my deed plans if I cancel?',
    a: 'Your data is yours. Cancelling downgrades you to Free, but every deed plan, survey report, and computation you already produced remains downloadable as PDF / DXF / LandXML — we never hold your work hostage.',
  },
  {
    q: 'Which datums and projections are supported?',
    a: 'Arc 1960 (EPSG:21037 for UTM 37S, EPSG:21036 for 36S) is the default for Kenya, with WGS84 and ARC1960UTM available for cross-border work. Cassini-Soldner is supported for legacy cadastre conversions.',
  },
  {
    q: 'Do you offer an annual discount?',
    a: 'Yes — annual billing gives you 2 months free versus monthly. The Pro annual price is KSh 5,000/year (a KSh 1,000 saving over twelve monthly payments).',
  },
]

/* ────────────────────────────────────────────────────────────── */
/*  Component                                                    */
/* ────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const [annual, setAnnual] = useState(false)

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-x-hidden">
      <HeroSection />
      <TrustStrip />
      <StatsBar />
      <FeaturesSection />
      <WorkflowSection />
      <ToolsSection />
      <PricingSection annual={annual} onToggleAnnual={setAnnual} />
      <FAQSection />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'METARDU',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              price: '500',
              priceCurrency: 'KES',
              url: 'https://metardu.duckdns.org/checkout?plan=pro',
            },
            areaServed: 'KE',
            knowsAbout: ['Survey Act Cap. 299', 'RDM 1.1', 'NLIMS', 'ArdhiSasa', 'EPSG:21037'],
          }),
        }}
      />
    </div>
  )
}

/* ============================================================= */
/*  HERO                                                         */
/* ============================================================= */

function HeroSection() {
  return (
    <section
      aria-label="Hero"
      className="relative min-h-[calc(100vh-4rem)] flex flex-col"
    >
      <div className="absolute inset-0">
        <Image
          src="/landing/hero-topo.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          quality={75}
          className="object-cover"
          style={{ filter: 'brightness(0.35) contrast(1.1)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)]/80 via-[var(--bg-primary)]/60 to-[var(--bg-primary)]" />
      </div>

      <div className="relative z-10 flex-1 flex items-center pt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-12 lg:py-20 w-full">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-[var(--text-primary)]/70 font-mono tracking-wide">Built in Nairobi · Cassini · UTM 36S/37S · Arc 1960</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
              Surveying software
              <br />
              built for{' '}
              <span className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dim)] bg-clip-text text-transparent">
                East Africa.
              </span>
            </h1>

            <p className="text-base sm:text-lg lg:text-xl text-[var(--text-primary)]/70 leading-relaxed mb-8 max-w-2xl">
              Traverse adjustment, deed plans, GNSS baseline processing, contour generation,
              and NLIMS-ready exports — all in one professional workspace. From field to finish,
              built for Kenyan surveyors.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 min-h-[44px] bg-[var(--accent)] text-[var(--bg-primary)] font-semibold rounded-xl text-sm hover:bg-[var(--accent-dim)] hover:scale-[1.02] transition-all no-underline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              >
                Start a project
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 min-h-[44px] bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] font-medium rounded-xl text-sm hover:bg-[var(--bg-tertiary)] transition-all no-underline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              >
                Explore features
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================= */
/*  TRUST STRIP                                                  */
/* ============================================================= */

function TrustStrip() {
  return (
    <section aria-label="Regulatory compliance" className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-6">
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-center">
          {TRUST_BADGES.map((badge, i) => (
            <li key={i} className="flex flex-col items-center">
              <span className="text-sm font-bold text-[var(--text-primary)]/85 tracking-wider">{badge.label}</span>
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-primary)]/65">{badge.sublabel}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ============================================================= */
/*  STATS BAR                                                    */
/* ============================================================= */

function StatsBar() {
  return (
    <section aria-label="Key facts" className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        {STATS.map((stat, i) => (
          <div key={i} className="text-center">
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--text-primary)]">
              {stat.value}{stat.suffix}
            </div>
            <div className="text-xs text-[var(--text-primary)]/65 mt-2 uppercase tracking-widest">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ============================================================= */
/*  FEATURES                                                     */
/* ============================================================= */

function FeaturesSection() {
  return (
    <section id="features" aria-labelledby="features-heading" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="text-center mb-16">
          <p className="text-[var(--accent)] text-sm font-semibold uppercase tracking-widest mb-4">
            Feature Suite
          </p>
          <h2 id="features-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Everything you need for
            <br />
            <span className="text-[var(--accent)]">professional surveying</span>
          </h2>
          <p className="max-w-2xl mx-auto text-[var(--text-primary)]/70 text-base lg:text-lg">
            Six core modules purpose-built for the East African surveyor. From field observations
            to regulatory submission.
          </p>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon
            return (
              <li
                key={i}
                className="group p-8 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent)]/40 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center mb-5 group-hover:bg-[var(--accent)]/20 transition-colors">
                  <Icon className="w-6 h-6 text-[var(--accent)]" aria-hidden />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3">{feature.title}</h3>
                <p className="text-sm text-[var(--text-primary)]/70 leading-relaxed">{feature.description}</p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

/* ============================================================= */
/*  WORKFLOW                                                     */
/* ============================================================= */

function WorkflowSection() {
  return (
    <section id="workflow" aria-labelledby="workflow-heading" className="py-24 md:py-32 bg-[var(--bg-secondary)] border-y border-[var(--border-color)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="text-center mb-16">
          <p className="text-[var(--accent)] text-sm font-semibold uppercase tracking-widest mb-4">
            Workflow
          </p>
          <h2 id="workflow-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Survey smarter in{' '}
            <span className="text-[var(--accent)]">3 steps</span>
          </h2>
          <p className="max-w-xl mx-auto text-[var(--text-primary)]/70 text-base lg:text-lg">
            From raw field observations to submission-ready documents.
          </p>
        </div>

        <ol className="grid md:grid-cols-3 gap-8 md:gap-12 list-none p-0 relative">
          {/* dashed connector for md+ */}
          <div aria-hidden className="hidden md:block absolute top-6 left-[16%] right-[16%] border-t-2 border-dashed border-[var(--accent)]/30" />
          {WORKFLOW_STEPS.map((step, i) => (
            <li key={i} className="relative text-center md:text-left bg-[var(--bg-secondary)] md:bg-transparent">
              <div className="inline-flex md:flex items-center justify-center w-12 h-12 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/40 text-[var(--accent)] font-bold text-base mb-4">
                {step.number}
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">{step.title}</h3>
              <p className="text-sm text-[var(--text-primary)]/70 leading-relaxed">{step.description}</p>
              <code className="block mt-3 text-xs font-mono text-[var(--text-primary)]/85 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded px-3 py-2">
                {step.example}
              </code>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ============================================================= */
/*  TOOLS GRID                                                   */
/* ============================================================= */

function ToolsSection() {
  return (
    <section aria-labelledby="tools-heading" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="text-center mb-16">
          <p className="text-[var(--accent)] text-sm font-semibold uppercase tracking-widest mb-4">
            Tool Library
          </p>
          <h2 id="tools-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Professional-grade tools,{' '}
            <span className="text-[var(--accent)]">free to start</span>
          </h2>
        </div>

        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 list-none p-0">
          {TOOLS.map((tool, i) => {
            const Icon = tool.icon
            return (
              <li key={i}>
                <Link
                  href="/tools"
                  className="group block p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-tertiary)] transition-all no-underline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center mb-4 group-hover:bg-[var(--accent)]/20 transition-colors">
                    <Icon className="w-5 h-5 text-[var(--accent)]" aria-hidden />
                  </div>
                  <h3 className="font-bold text-[var(--text-primary)] text-sm mb-1">{tool.title}</h3>
                  <p className="text-xs text-[var(--text-primary)]/70">{tool.description}</p>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

/* ============================================================= */
/*  PRICING                                                      */
/* ============================================================= */

function MPesaBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-600 text-white uppercase tracking-wider"
      title="Pay with M-Pesa"
    >
      M-Pesa
    </span>
  )
}

function PricingSection({ annual, onToggleAnnual }: { annual: boolean; onToggleAnnual: (v: boolean) => void }) {
  return (
    <section aria-labelledby="pricing-heading" className="py-24 md:py-32 bg-[var(--bg-secondary)] border-t border-[var(--border-color)]">
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
              onClick={() => onToggleAnnual(false)}
              className={`px-4 py-2 text-sm rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                !annual ? 'bg-[var(--accent)] text-black font-semibold' : 'text-[var(--text-primary)]/70'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => onToggleAnnual(true)}
              className={`px-4 py-2 text-sm rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                annual ? 'bg-[var(--accent)] text-black font-semibold' : 'text-[var(--text-primary)]/70'
              }`}
            >
              Annual <span className="text-xs opacity-80">· 2 months free</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-start max-w-5xl mx-auto">
          {PRICING.map((plan, i) => {
            const price = annual ? plan.priceAnnual : plan.priceMonthly
            const periodLabel = annual ? '/year' : plan.period
            return (
              <div
                key={i}
                className={`relative p-8 rounded-2xl border transition-all ${
                  plan.highlighted
                    ? 'border-[var(--accent)]/50 bg-[var(--bg-primary)] shadow-[0_0_60px_-15px_rgba(209,123,71,0.2)] scale-[1.02]'
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

        <p className="text-center text-xs text-[var(--text-primary)]/65 mt-8">
          Need 20+ seats, a white-label license, or on-premise deployment?{' '}
          <Link href="/enterprise" className="text-[var(--accent)] no-underline hover:underline">Talk to us about Firm & Enterprise tiers.</Link>
        </p>
      </div>
    </section>
  )
}

/* ============================================================= */
/*  FAQ                                                          */
/* ============================================================= */

function FAQSection() {
  return (
    <section aria-labelledby="faq-heading" className="py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="text-center mb-12">
          <p className="text-[var(--accent)] text-sm font-semibold uppercase tracking-widest mb-4">
            FAQ
          </p>
          <h2 id="faq-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Questions,{' '}
            <span className="text-[var(--accent)]">answered</span>
          </h2>
        </div>

        <ul className="space-y-3 list-none p-0">
          {FAQS.map((faq, i) => (
            <li key={i}>
              <details className="group bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none focus-visible:outline-2 focus-visible:outline-[var(--accent)]">
                  <span className="font-semibold text-[var(--text-primary)] text-sm">{faq.q}</span>
                  <ChevronDown className="w-4 h-4 text-[var(--text-primary)]/70 transition-transform group-open:rotate-180 flex-shrink-0" aria-hidden />
                </summary>
                <div className="px-5 pb-5 text-sm text-[var(--text-primary)]/70 leading-relaxed">
                  {faq.a}
                </div>
              </details>
            </li>
          ))}
        </ul>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: FAQS.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            }),
          }}
        />
      </div>
    </section>
  )
}
