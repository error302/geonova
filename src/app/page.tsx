import Link from 'next/link'
import Image from 'next/image'
import {
  Waypoints, FileBadge, Mountain, DraftingCompass,
  Satellite, FileChartColumn, MapPinned, Calculator,
  ShieldCheck, ChevronDown,
} from 'lucide-react'
import { PricingSection } from '@/components/landing/PricingSection'
import { SRID_21037 } from '@/lib/map/projection'

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
    image: '/landing/feature-traverse.jpg',
  },
  {
    icon: FileBadge,
    title: 'Deed Plan Generation',
    description: 'Survey Act Cap. 299 compliant Form No. 4 with SVG, PDF, and DXF output. SHA-256 verified, Director of Surveys authentication block.',
    image: '/landing/feature-deedplan.jpg',
  },
  {
    icon: Mountain,
    title: 'Topographic Surveys',
    description: 'TIN generation, contour extraction, volume computation. Web Worker TIN for large datasets. Auto breakline detection from mesh analysis.',
    image: '/landing/feature-topography.jpg',
  },
  {
    icon: DraftingCompass,
    title: 'COGO Engine',
    description: 'Intersection, resection, radiation, bearing-distance. Full coordinate geometry with solution steps shown for every calculation.',
    image: '/landing/feature-cogo.jpg',
  },
  {
    icon: Satellite,
    title: 'GNSS Baseline Processing',
    description: 'Upload RINEX files and get adjusted coordinates via RTKLIB integration. No external software needed — process baselines right in the browser.',
    image: '/landing/feature-gnss.jpg',
  },
  {
    icon: FileChartColumn,
    title: 'Statutory Documents',
    description: 'RDM 1.1 survey reports, Form C-22, CLA forms, computation workbooks. NLIMS-ready exports with ArdhiSasa integration.',
    image: '/landing/feature-statutory.jpg',
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
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-x-hidden">
      <HeroSection />
      <TrustStrip />
      <StatsBar />
      <FeaturesSection />
      <ShowcaseSection />
      <WorkflowSection />
      <ToolsSection />
      <PricingSection />
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
              url: 'https://metardu.space/checkout?plan=pro',
            },
            areaServed: 'KE',
            knowsAbout: ['Survey Act Cap. 299', 'RDM 1.1', 'NLIMS', 'ArdhiSasa', SRID_21037],
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
          src="/landing/hero-rift-valley-topo.jpg"
          alt="METARDU Topographic Surveying Platform"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1920px"
          quality={85}
          className="object-cover object-right"
          style={{ filter: 'brightness(0.7) contrast(1.1)' }}
        />
        {/* Left-to-right scrim: legible copy on the left, terrain visible on the right */}
        <div className="absolute inset-0 bg-gradient-to-r from-[color-mix(in_srgb,var(--bg-primary)_85%,transparent)] via-[color-mix(in_srgb,var(--bg-primary)_45%,transparent)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--bg-primary)] to-transparent" />
      </div>

      <div className="relative z-10 flex-1 flex items-center pt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-12 lg:py-20 w-full">
          <div className="max-w-3xl">

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
              Surveying software
              <br />
              built for{' '}
              <span className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dim)] bg-clip-text text-transparent">
                East Africa.
              </span>
            </h1>

            <p className="text-base sm:text-lg lg:text-xl text-[var(--text-primary)] leading-relaxed mb-8 max-w-2xl">
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
              <span className="text-sm font-bold text-[var(--text-primary)] tracking-wider">{badge.label}</span>
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-primary)]">{badge.sublabel}</span>
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
            <div className="text-xs text-[var(--text-primary)] mt-2 uppercase tracking-widest">
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
    <section id="features" aria-labelledby="features-heading" className="relative py-32 md:py-40 overflow-hidden">
      {/* Theodolite blueprint — bottom-anchored, blends with dark theme */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
        <Image
          src="/landing/theodolite-blueprint.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
          style={{ opacity: 0.4, mixBlendMode: 'screen', filter: 'contrast(1.25) brightness(0.95)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)] via-[color-mix(in_srgb,var(--bg-primary)_30%,transparent)] to-[var(--bg-primary)]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="text-center mb-16">
          <p className="text-[var(--accent)] text-sm font-semibold uppercase tracking-widest mb-4">
            Feature Suite
          </p>
          <h2 id="features-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Everything you need for
            <br />
            <span className="text-[var(--accent)]">professional surveying</span>
          </h2>
          <p className="max-w-2xl mx-auto text-[var(--text-primary)] text-base lg:text-lg">
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
                className="group relative p-8 rounded-2xl bg-[color-mix(in_srgb,var(--bg-secondary)_80%,transparent)] backdrop-blur-sm border border-[var(--border-color)] overflow-hidden hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] transition-all duration-300 hover:-translate-y-1"
              >
                <Image
                  src={feature.image}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 480px"
                  className="object-cover object-top pointer-events-none opacity-[0.14] group-hover:opacity-[0.22] transition-opacity duration-500 group-hover:scale-110 group-hover:transition-[opacity,transform]"
                  style={{ filter: 'brightness(0.55) saturate(0.85)' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-secondary)] via-transparent to-[color-mix(in_srgb,var(--bg-secondary)_60%,transparent)] pointer-events-none" aria-hidden />
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] flex items-center justify-center mb-5 group-hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] transition-colors">
                    <Icon className="w-6 h-6 text-[var(--accent)]" aria-hidden />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3">{feature.title}</h3>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">{feature.description}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

/* ============================================================= */
/*  SHOWCASE                                                     */
/* ============================================================= */

function ShowcaseSection() {
  return (
    <section id="showcase" aria-labelledby="showcase-heading" className="py-32 md:py-40 bg-[var(--bg-secondary)] border-y border-[var(--border-color)] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="text-center mb-16">
          <p className="text-[var(--accent)] text-sm font-semibold uppercase tracking-widest mb-4">
            See it in action
          </p>
          <h2 id="showcase-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            One workspace,{' '}
            <span className="text-[var(--accent)]">field to finish</span>
          </h2>
          <p className="max-w-2xl mx-auto text-[var(--text-primary)] text-base lg:text-lg">
            Import observations, close traverses, draft deed plans, and produce
            NLIMS-ready documents — without leaving the browser or losing connectivity.
          </p>
        </div>

        <div className="space-y-12">
          {/* Wide cadastral map shot */}
          <figure className="group relative">
            <div className="absolute -inset-3 bg-gradient-to-r from-[color-mix(in_srgb,var(--accent)_10%,transparent)] via-transparent to-transparent rounded-3xl blur-2xl opacity-60 group-hover:opacity-100 transition-opacity" aria-hidden />
            <div className="relative rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-2 shadow-2xl">
              <Image
                src="/landing/showcase-cadastral-workspace.jpg"
                alt="METARDU cadastral map workspace showing parcel boundaries, RIM overlays, and survey layers"
                width={1920}
                height={1080}
                sizes="(max-width: 768px) 100vw, 1200px"
                quality={90}
                className="rounded-xl object-cover"
              />
            </div>
            <figcaption className="mt-4 text-sm text-[var(--text-primary)] text-center">
              Cadastral map workspace — parcels, RIM overlays, stakeout and layer control.
            </figcaption>
          </figure>

          {/* Two-up: workflow diagram + map layout */}
          <div className="grid md:grid-cols-5 gap-6">
            <figure className="group relative md:col-span-3">
              <div className="relative rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-2 shadow-2xl h-full">
                <Image
                  src="/landing/showcase-traverse-workflow.jpg"
                  alt="METARDU survey workflow and traverse computation workspace"
                  width={1920}
                  height={1080}
                  sizes="(max-width: 768px) 100vw, 900px"
                  quality={90}
                  className="rounded-xl object-cover"
                />
              </div>
              <figcaption className="mt-4 text-sm text-[var(--text-primary)] text-center">
                Guided project workflow — setup, field book, compute, review, submission.
              </figcaption>
            </figure>
            <figure className="group relative md:col-span-2">
              <div className="relative rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-2 shadow-2xl h-full">
                <Image
                  src="/landing/showcase-map-inspector.jpg"
                  alt="METARDU interactive map tools and layer inspector panel"
                  width={900}
                  height={1200}
                  sizes="(max-width: 768px) 100vw, 500px"
                  quality={90}
                  className="rounded-xl object-cover"
                />
              </div>
              <figcaption className="mt-4 text-sm text-[var(--text-primary)] text-center">
                Interactive map panel — coordinates, layers, and measurement tools.
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================= */
/*  WORKFLOW                                                     */
/* ============================================================= */

function WorkflowSection() {
  return (
    <section id="workflow" aria-labelledby="workflow-heading" className="relative py-32 md:py-40 bg-[var(--bg-secondary)] border-y border-[var(--border-color)] overflow-hidden">
      {/* Field-survey background — visible but subtle behind the content */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden>
        <Image
          src="/landing/feature-fieldbook.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
          style={{ opacity: 0.22, filter: 'brightness(0.5) saturate(0.7)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-secondary)] via-[color-mix(in_srgb,var(--bg-secondary)_40%,transparent)] to-[var(--bg-secondary)]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="text-center mb-16">
          <p className="text-[var(--accent)] text-sm font-semibold uppercase tracking-widest mb-4">
            Workflow
          </p>
          <h2 id="workflow-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Survey smarter in{' '}
            <span className="text-[var(--accent)]">3 steps</span>
          </h2>
          <p className="max-w-xl mx-auto text-[var(--text-primary)] text-base lg:text-lg">
            From raw field observations to submission-ready documents.
          </p>
        </div>

        <ol className="grid md:grid-cols-3 gap-8 md:gap-12 list-none p-0 relative">
          {/* dashed connector for md+ */}
          <div aria-hidden className="hidden md:block absolute top-6 left-[16%] right-[16%] border-t-2 border-dashed border-[color-mix(in_srgb,var(--accent)_30%,transparent)]" />
          {WORKFLOW_STEPS.map((step, i) => (
            <li key={i} className="relative text-center md:text-left bg-[var(--bg-secondary)] md:bg-transparent">
              <div className="inline-flex md:flex items-center justify-center w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] text-[var(--accent)] font-bold text-base mb-4">
                {step.number}
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">{step.title}</h3>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">{step.description}</p>
              <code className="block mt-3 text-xs font-mono text-[var(--text-primary)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded px-3 py-2">
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
    <section aria-labelledby="tools-heading" className="py-32 md:py-40">
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
                  className="group block p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:bg-[var(--bg-tertiary)] transition-all no-underline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                >
                  <div className="w-10 h-10 rounded-lg bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] flex items-center justify-center mb-4 group-hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] transition-colors">
                    <Icon className="w-5 h-5 text-[var(--accent)]" aria-hidden />
                  </div>
                  <h3 className="font-bold text-[var(--text-primary)] text-sm mb-1">{tool.title}</h3>
                  <p className="text-xs text-[var(--text-primary)]">{tool.description}</p>
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



/* ============================================================= */
/*  FAQ                                                          */
/* ============================================================= */

function FAQSection() {
  return (
    <section aria-labelledby="faq-heading" className="py-32 md:py-40">
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
                  <ChevronDown className="w-4 h-4 text-[var(--text-primary)] transition-transform group-open:rotate-180 flex-shrink-0" aria-hidden />
                </summary>
                <div className="px-5 pb-5 text-sm text-[var(--text-primary)] leading-relaxed">
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
