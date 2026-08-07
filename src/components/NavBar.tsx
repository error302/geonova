'use client';

import { useState, useEffect, useMemo, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { z } from 'zod'
import { apiGet, apiPost, ApiError } from '@/lib/api/client'

import { useLanguage, languages } from '@/lib/i18n/LanguageContext'
import MetarduLogo from '@/components/MetarduLogo'
import SubscriptionBadge from '@/components/SubscriptionBadge'
import type { PlanId } from '@/lib/subscription/catalog'
import { APP_SHELL_LINKS, PUBLIC_SHELL_LINKS, isExplicitPublicRoute, isNavItemActive } from '@/lib/navigation-shell'
import FieldModeToggle from '@/components/shared/FieldModeToggle'

// ── Schemas ────────────────────────────────────────────────────────────────
const subscriptionResponseSchema = z.object({
  plan: z.string().optional(),
}).passthrough()
const signoutMutationSchema = z.object({}).passthrough()

/* ── Search index: all navigable pages for Ctrl+K ────────────────── */
const searchablePages = [
  { category: 'AI', group: 'Assistant', href: '/assistant', labelKey: 'Survey Assistant (Cap 299)' },
  // Cadastral workflow
  { category: 'Cadastral', group: 'Workflow', href: '/cadastral-workflow', labelKey: 'Cadastral Workflow' },
  { category: 'Cadastral', group: 'Validation', href: '/tools/topology-check', labelKey: 'Topology Pre-flight' },
  { category: 'Cadastral', group: 'Subdivision', href: '/tools/subdivision-generator', labelKey: 'Generative Subdivision' },
  { category: 'Cadastral', group: 'COGO', href: '/tools/cogo-reconstruct', labelKey: 'COGO Deed Reconstructor' },
  { category: 'Engineering', group: 'As-built', href: '/tools/as-built-deviation', labelKey: 'As-built Deviation Guard' },
  { category: 'Geodesy', group: 'Scale Factor', href: '/tools/scale-factor', labelKey: 'Combined Scale Factor' },
  { category: 'Geodesy', group: 'Calibration', href: '/tools/site-calibration', labelKey: 'Site Calibration' },
  { category: 'Geodesy', group: 'Heights', href: '/tools/orthometric-height', labelKey: 'Orthometric Height' },
  // Engineering workflow
  { category: 'Engineering', group: 'Workflow', href: '/engineering-workflow', labelKey: 'Engineering Workflow' },
  // Topographic workflow
  { category: 'Topographic', group: 'Workflow', href: '/topographic-workflow', labelKey: 'Topographic Workflow' },
  // Topographic - additional
  { category: 'Topographic', group: 'Volumes', href: '/tools/volume-comparison', labelKey: 'Dual-Surface Volume Comparison' },
  { category: 'Topographic', group: 'Point Cloud', href: '/tools/point-cloud-import', labelKey: 'Point Cloud Import' },
  { category: 'Topographic', group: 'Orthophoto', href: '/tools/orthophoto-viewer', labelKey: 'Orthophoto Viewer' },
  // Engineering - additional
  { category: 'Engineering', group: 'Control', href: '/tools/lsa', labelKey: 'Least Squares Adjustment' },
  { category: 'Engineering', group: 'GNSS', href: '/tools/gnss-baseline', labelKey: 'GNSS Baseline' },
  { category: 'Engineering', group: 'GNSS', href: '/tools/gnss-observation-log', labelKey: 'GNSS Observation Log' },
  { category: 'Engineering', group: 'Roads', href: '/tools/road-design', labelKey: 'Road Design' },
  { category: 'Engineering', group: 'Roads', href: '/tools/superelevation', labelKey: 'Superelevation' },
  { category: 'Engineering', group: 'Roads', href: '/tools/sight-distance', labelKey: 'Sight Distance' },
  { category: 'Engineering', group: 'Earthworks', href: '/tools/cut-fill', labelKey: 'Cut and Fill' },
  { category: 'Engineering', group: 'Piling', href: '/tools/pile-grid', labelKey: 'Pile Grid Setting Out' },
  { category: 'Engineering', group: 'Machine', href: '/tools/machine-control', labelKey: 'Machine Control Export' },
  { category: 'Engineering', group: 'Progress', href: '/tools/progress-monitor', labelKey: 'Progress Monitor' },
  // Cadastral - additional
  { category: 'Cadastral', group: 'Documents', href: '/tools/statutory-workbook', labelKey: 'Statutory Workbook' },
  { category: 'Cadastral', group: 'Documents', href: '/tools/survey-plan-demo', labelKey: 'Survey Plan Viewer' },
  { category: 'Cadastral', group: 'Documents', href: '/tools/billable-documents', labelKey: 'Billable Documents' },
  { category: 'Cadastral', group: 'Reference', href: '/tools/control-marks-register', labelKey: 'Control Marks Register' },
  // Geodesy - additional
  { category: 'Geodesy', group: 'Cassini', href: '/tools/cassini-utm', labelKey: 'Cassini UTM Converter' },
  // Field
  { category: 'Field', group: 'Field Book', href: '/tools/level-book', labelKey: 'Level Book' },
  { category: 'Field', group: 'Field Book', href: '/tools/traverse-field-book', labelKey: 'Traverse Field Book' },
  // Tools - Calculations
  { category: 'Tools', group: 'Calculations', href: '/tools/distance', labelKey: 'tools.distance' },
  { category: 'Tools', group: 'Calculations', href: '/tools/bearing', labelKey: 'tools.bearingCalc' },
  { category: 'Tools', group: 'Calculations', href: '/tools/area', labelKey: 'tools.area' },
  { category: 'Tools', group: 'Calculations', href: '/tools/grade', labelKey: 'tools.grade' },
  // Tools - Traverse
  { category: 'Tools', group: 'Traverse', href: '/tools/traverse', labelKey: 'traverse.title' },
  { category: 'Tools', group: 'Traverse', href: '/tools/coordinates', labelKey: 'tools.coordinates' },
  { category: 'Tools', group: 'Traverse', href: '/tools/cogo', labelKey: 'tools.cogo' },
  { category: 'Tools', group: 'Traverse', href: '/tools/gnss', labelKey: 'tools.gnss' },
  // Tools - Levelling
  { category: 'Tools', group: 'Levelling', href: '/tools/leveling', labelKey: 'leveling.title' },
  { category: 'Tools', group: 'Levelling', href: '/tools/two-peg-test', labelKey: 'tools.twoPegTest' },
  // Tools - Curves & Roads
  { category: 'Tools', group: 'Curves & Roads', href: '/tools/curves', labelKey: 'tools.curves' },
  { category: 'Tools', group: 'Curves & Roads', href: '/tools/chainage', labelKey: 'tools.chainage' },
  { category: 'Tools', group: 'Curves & Roads', href: '/tools/tacheometry', labelKey: 'tools.tacheometry' },
  // Tools - Earthworks
  { category: 'Tools', group: 'Earthworks', href: '/tools/cross-sections', labelKey: 'tools.crossSections' },
  { category: 'Tools', group: 'Earthworks', href: '/tools/setting-out', labelKey: 'tools.settingOut' },
  { category: 'Tools', group: 'Earthworks', href: '/tools/cut-fill', labelKey: 'Cut & Fill Volumes' },
  { category: 'Tools', group: 'Geodesy', href: '/tools/gnss-rinex', labelKey: 'GNSS RINEX Processing' },
  { category: 'Tools', group: 'Monitoring', href: '/tools/deformation-monitoring', labelKey: 'Deformation Monitoring' },
  { category: 'Tools', group: 'Corridor', href: '/tools/corridor', labelKey: 'Corridor / Chainage Mode' },
  { category: 'Tools', group: 'Topographic', href: '/tools/topographic-survey', labelKey: 'Topographic Survey' },
  { category: 'Tools', group: 'Quality', href: '/tools/control-point-verification', labelKey: 'Control Point Verification' },
  { category: 'Tools', group: 'Career', href: '/tools/portfolio', labelKey: 'License Application Portfolio' },
  { category: 'Tools', group: 'Regulatory', href: '/tools/regulatory-checklist', labelKey: 'Regulatory Checklist' },
  // Tools - Specialized (scope narrowing v1: mining + hydrographic removed)
  { category: 'Tools', group: 'Specialized', href: '/tools/drone', labelKey: 'tools.drone' },
  // Field
  { category: 'Field', group: 'Field', href: '/field', labelKey: 'field.fieldMode' },
  { category: 'Field', group: 'Field', href: '/fieldbook', labelKey: 'field.fieldBook' },
  { category: 'Field', group: 'Field', href: '/guide', labelKey: 'guides.title' },
  // Documents
  { category: 'Documents', group: 'Documents', href: '/deed-plan', labelKey: 'documents.deedPlan' },
  { category: 'Documents', group: 'Documents', href: '/tools/survey-report-builder', labelKey: 'documents.surveyReport' },
  { category: 'Documents', group: 'Documents', href: '/tools/beacon-certificate', labelKey: 'documents.beaconReference' },
  // Resources
  { category: 'Resources', group: 'Resources', href: '/online', labelKey: 'resources.datumConverter' },
  { category: 'Resources', group: 'Resources', href: '/kencors', labelKey: 'resources.kencorsRtk' },
  { category: 'Resources', group: 'Resources', href: '/docs', labelKey: 'resources.knowledgeBase' },
  { category: 'Resources', group: 'Resources', href: '/pricing', labelKey: 'nav.pricing' },
]

/* ⚡ Bolt: Pre-compute map for O(1) page lookups instead of O(N) array search on every render/navigation */
const searchablePagesMap = new Map(searchablePages.map(p => [p.href, p.labelKey]))

interface DropdownProps {
  label: string
  children: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  align?: 'left' | 'right'
  buttonClassName?: string
  panelClassName?: string
}

function Dropdown({ label, children, isOpen, onToggle, align = 'left', buttonClassName, panelClassName }: DropdownProps) {
  return (
    <div className="relative group">
      <button 
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={
          buttonClassName ??
          'px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors flex items-center gap-1 rounded-lg hover:bg-white/5'
        }
      >
        {label}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} pt-2 z-50`}>
          <div className={`bg-[var(--bg-secondary)] border border-[#D17B4720] rounded-lg shadow-xl ${panelClassName ?? 'min-w-[200px] py-2'}`}>
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

type Translator = (key: string, values?: Record<string, string | number>) => string

// UI-5 (2026-07-24): Replaced the 130-line GlobalSearch function with a
// tiny trigger button. The full-featured CommandPalette (in AppShell,
// using the cmdk library) already handles Cmd+K globally — this button
// just dispatches a synthetic Cmd+K to open it. Removes the duplicate
// search index, modal, and keyboard listener that were fighting with
// CommandPalette for the Cmd+K binding.
function SearchTrigger({ t }: { t: Translator }) {
  const isMac = typeof navigator !== 'undefined' ? /mac|iphone|ipad|ipod/i.test(navigator.platform) : false
  const hint = isMac ? '⌘K' : 'Ctrl K'

  const openPalette = () => {
    // CommandPalette.tsx listens for (e.metaKey || e.ctrlKey) && e.key === 'k'
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
    )
  }

  return (
    <button
      onClick={openPalette}
      className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)] rounded-lg text-xs sm:text-sm text-[var(--text-secondary)] hover:border-[var(--accent)] transition-colors"
      aria-label={t('nav.search')}
    >
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <span className="hidden sm:inline">{t('nav.search')}</span>
      <kbd className="hidden sm:inline px-1.5 py-0.5 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded">{hint}</kbd>
    </button>
  )
}

export default function NavBar() {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [userPlan, setUserPlan] = useState<PlanId>('free')
  const navRef = useRef<HTMLDivElement>(null)

  const { data: session, status: authStatus } = useSession()
  const user = session?.user as { email?: string; name?: string; id?: string; role?: string } | undefined
  const isAuthenticated = !!session
  const userRole = user?.role ?? ''
  const isAdminUser = ['super_admin', 'admin', 'org_admin'].includes(userRole)

  const { language, setLanguage, t, hydrated } = useLanguage()
  const pathname = usePathname()
  const router = useRouter()

  // Helper to check if a route is a mobile root-level view
  const isRootPath = (path: string) => {
    const roots = ['/', '/dashboard', '/fieldbook', '/map', '/tools', '/reports', '/community']
    return roots.includes(path)
  }

  // Helper to determine the logical parent path for back button fallback
  const getParentPath = (path: string) => {
    if (path.startsWith('/tools/')) return '/tools'
    if (path.startsWith('/fieldbook/')) return '/fieldbook'
    if (path.startsWith('/reports/')) return '/reports'
    if (path.startsWith('/account/')) return '/account'
    if (path.startsWith('/admin/')) return '/admin'
    const segments = path.split('/').filter(Boolean)
    if (segments.length > 1) {
      return '/' + segments.slice(0, -1).join('/')
    }
    return '/dashboard'
  }

  // Helper to handle back click
  const handleBack = (e: React.MouseEvent) => {
    if (window.history.length > 1) {
      e.preventDefault()
      router.back()
    }
  }

  // Resolve dynamic sub-page titles using searchablePages definitions
  const pageTitle = useMemo(() => {
    const matchedLabelKey = searchablePagesMap.get(pathname)
    if (matchedLabelKey) return t(matchedLabelKey)

    // Manual/Dynamic overrides
    if (pathname.startsWith('/fieldbook/')) {
      if (pathname.includes('/new')) return 'New Observation'
      return 'Observation Detail'
    }
    if (pathname.startsWith('/projects/')) return 'Project Details'
    if (pathname.startsWith('/account')) return 'Account'
    if (pathname.startsWith('/docs/')) return 'Documentation'
    
    // Fallback: capitalize the last segment
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length > 0) {
      const last = segments[segments.length - 1]
      return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ')
    }
    return 'METARDU'
  }, [pathname, t])

  useEffect(() => { setMounted(true) }, [])

  // Fetch user subscription plan when session changes (uses server API which detects admin emails)
  useEffect(() => {
    const fetchPlan = async () => {
      if (user?.id) {
        try {
          const data = await apiGet(
            '/api/subscription',
            subscriptionResponseSchema,
            { ttlMs: 0 },
          )
          setUserPlan((data.plan as PlanId) ?? 'free')
        } catch (err) {
          if (err instanceof ApiError) {
            // subscription fetch failed — fall back to free
          }
          setUserPlan('free')
        }
      } else {
        setUserPlan('free')
      }
    }
    fetchPlan()
  }, [session?.user?.id])

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    const prompt = await installPrompt.prompt()
    if (prompt.outcome === 'accepted') {
      setShowInstall(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut({ redirect: false })
    } catch {
      try {
        // ponytail: best-effort fallback signout — silent on error
        await apiPost('/api/auth/signout', signoutMutationSchema, {})
      } catch (err) {
        if (err instanceof ApiError) {
          // ignore — best-effort signout
        }
      }
    }
    window.location.href = '/'
  }

  const handleDropdownToggle = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name)
  }

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (navRef.current && navRef.current.contains(target)) return
      setOpenDropdown(null)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null)
    }

    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('keydown', onEsc)
    }
  }, [])

  useEffect(() => {
    setMobileMenuOpen(false)
    setOpenDropdown(null)
  }, [pathname])

  const currentLang = languages.find((l: any) => l.code === language) || languages[0]
  const shellVariant = authStatus !== 'loading' && !isAuthenticated && isExplicitPublicRoute(pathname) ? 'public' : 'app'
  const desktopLinks = shellVariant === 'app' ? APP_SHELL_LINKS : PUBLIC_SHELL_LINKS
  const mobileLinks = shellVariant === 'app' ? APP_SHELL_LINKS : PUBLIC_SHELL_LINKS

  if (!mounted) {
    return (
      <div className="h-16 border-b border-[var(--border-color)] bg-[var(--bg-primary)]" />
    )
  }

  return (
    <nav className="border-b border-[var(--border-color)] bg-[var(--bg-primary)] sticky top-0 z-50 pt-[env(safe-area-inset-top,0px)]">
      <div ref={navRef} className="max-w-7xl mx-auto px-4">
        {/* Main Navbar */}
        <div className="relative h-16 flex items-center justify-between">
          {/* Mobile Back Button (only on sub-pages) */}
          <div className="flex md:hidden items-center">
            {!isRootPath(pathname) ? (
              <Link
                href={getParentPath(pathname)}
                onClick={handleBack}
                className="flex items-center gap-1.5 text-[var(--accent)] hover:text-[#FFB84D] transition-colors py-2 px-1"
                aria-label="Go back"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-semibold hidden sm:inline">Back</span>
              </Link>
            ) : (
              /* Default Logo on mobile root pages */
              <Link href="/" prefetch={false}>
                <MetarduLogo color="var(--text-primary)" size={24} showWordmark={true} />
              </Link>
            )}
          </div>

          {/* Desktop Logo (always visible on desktop) */}
          <div className="hidden md:flex items-center">
            <Link href="/" prefetch={false}>
              <MetarduLogo color="var(--text-primary)" size={28} showWordmark={true} />
            </Link>
          </div>

          {/* Centered Page Title on Mobile Sub-pages */}
          {!isRootPath(pathname) && (
            <div className="absolute left-1/2 -translate-x-1/2 md:hidden text-sm font-bold text-[var(--text-primary)] max-w-[45%] truncate tracking-wide uppercase">
              {pageTitle}
            </div>
          )}

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {desktopLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={`px-3 py-2 text-sm transition-colors rounded-lg ${item.icon ? 'inline-flex items-center gap-1.5' : ''} ${
                  isNavItemActive(pathname, item.href)
                    ? 'text-[var(--accent)] bg-white/5'
                    : 'text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-white/5'
                }`}
              >
                {item.icon === 'map' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                ) : null}
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Global Search — opens CommandPalette via synthetic Cmd+K (UI-5) */}
            <SearchTrigger t={t} />

            {/* Language Selector — compact on mobile */}
            <div className={isRootPath(pathname) ? "block" : "hidden md:block"}>
              <Dropdown
                label={`${currentLang.flag} ${currentLang.code.toUpperCase()}`}
                isOpen={openDropdown === 'lang'}
                onToggle={() => handleDropdownToggle('lang')}
                align="right"
                panelClassName="min-w-[180px] py-1"
                buttonClassName="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-2 py-1 text-xs sm:text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors rounded-lg hover:bg-white/5"
              >
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code)
                      setOpenDropdown(null)
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 ${
                      language === lang.code ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {lang.flag} {lang.name}
                  </button>
                ))}
              </Dropdown>
            </div>

            {/* Field mode / dark toggle — always visible in navbar */}
            <div className="block">
              <FieldModeToggle />
            </div>

            {authStatus === 'loading' ? (
              <div className="w-20 h-8 bg-[var(--bg-tertiary)] animate-pulse rounded"></div>
            ) : isAuthenticated ? (
              <div className="hidden md:block relative">
                <button
                  onClick={() => handleDropdownToggle('user')}
                  aria-expanded={openDropdown === 'user'}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 hover:border-[var(--accent)] transition-colors"
                >
                  <span className="w-8 h-8 rounded-full bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center font-bold">
                    {(user?.email || 'U').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="hidden lg:flex flex-col">
                    <span className="text-sm text-[var(--text-primary)] max-w-[180px] truncate leading-tight">{user?.email}</span>
                    {/* AUDIT FIX (M-005, 2026-07-27): Admin users shouldn't show "FREE"
                        even on the free plan — it's confusing. Show role badge instead. */}
                    {isAdminUser ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-900/50 text-amber-400 border border-amber-700/50">
                        {userRole === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN'}
                      </span>
                    ) : (
                      <SubscriptionBadge plan={userPlan} compact />
                    )}
                  </div>
                  <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {openDropdown === 'user' && (
                  <div className="absolute top-full right-0 pt-2 z-50">
                    <div className="bg-[var(--bg-secondary)] border border-[#D17B4720] rounded-lg shadow-xl min-w-[220px] py-2">
                      <div className="px-4 pb-2 flex items-center justify-between">
                        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Account</div>
                        {/* AUDIT FIX (M-005, 2026-07-27): show ADMIN badge for admin users. */}
                        {isAdminUser ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-900/50 text-amber-400 border border-amber-700/50">
                            {userRole === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN'}
                          </span>
                        ) : (
                          <SubscriptionBadge plan={userPlan} compact />
                        )}
                      </div>
                      <div className="px-4 py-2">
                        <Link
                          href="/dashboard"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          {t('nav.dashboard')}
                        </Link>
                        <Link
                          href="/account"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          Account Settings
                        </Link>
                        <Link
                          href="/account/billing"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          Billing
                        </Link>
                        <Link
                          href="/notifications"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          Notifications
                        </Link>
                        {isAdminUser && (
                          <>
                            <div className="border-t border-white/5 my-2" />
                            <div className="px-2 py-1">
                              <span className="text-[10px] font-semibold text-[var(--accent)] uppercase tracking-wider">Admin</span>
                            </div>
                            <Link
                              href="/admin"
                              onClick={() => setOpenDropdown(null)}
                              className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                            >
                              Admin Dashboard
                            </Link>
                            <Link
                              href="/admin/users"
                              onClick={() => setOpenDropdown(null)}
                              className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                            >
                              User Management
                            </Link>
                          </>
                        )}
                      </div>
                      <div className="border-t border-white/5 my-2" />
                      <div className="px-4">
                        <button
                          onClick={() => {
                            setOpenDropdown(null)
                            handleSignOut()
                          }}
                          className="w-full text-left px-2 py-2 text-sm text-red-200 hover:bg-white/5 rounded"
                        >
                          {t('nav.signOut')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              ) : authStatus === 'unauthenticated' && (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/login" className="px-4 py-2 text-sm border border-[var(--accent)] text-[var(--accent)] rounded hover:bg-[var(--accent)]/10 transition-colors">
                  Log In
                </Link>
                <Link href="/register" className="px-4 py-2 text-sm bg-[var(--accent)] text-black font-semibold rounded hover:bg-[var(--accent-dim)] transition-colors">
                  Get Started
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <div className={isRootPath(pathname) ? "block" : "hidden md:block"}>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                className="md:hidden p-2 text-[var(--text-primary)]"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[var(--bg-primary)] border-t border-[var(--border-color)] max-h-[80vh] overflow-y-auto pb-4">
            <div className="py-2">
              {mobileLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={`block px-4 py-2 transition-colors ${
                    isNavItemActive(pathname, item.href)
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text-primary)] hover:text-[var(--accent)]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}

              {shellVariant === 'app' && (
                <>
                  <div className="border-t border-[var(--border-color)] my-2"></div>
                  <div className="px-4 py-1">
                    <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Field Operations</span>
                  </div>
                  <Link href="/schedule" className="block px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                    Job Schedule
                  </Link>
                  <Link href="/equipment" className="block px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                    Equipment Tracker
                  </Link>
                  <Link href="/marketplace" className="block px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                    Equipment Marketplace
                  </Link>
                  <Link href="/fieldbook" className="block px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                    {t('field.fieldBook')}
                  </Link>
                  <Link href="/field" className="block px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                    {t('field.fieldMode')}
                  </Link>
                  <Link href="/beacons" className="block px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                    Beacon Registry
                  </Link>
                  <Link href="/docs" className="block px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                    Documentation
                  </Link>
                </>
              )}
              
              {isAuthenticated && (
                <>
                  <div className="border-t border-[var(--border-color)] my-2"></div>
                  <Link href="/account" className="block px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                    Account
                  </Link>
                  {isAdminUser && (
                    <>
                      <Link href="/admin" className="block px-4 py-2 text-[var(--accent)] font-medium">
                        Admin Dashboard
                      </Link>
                      <Link href="/admin/users" className="block px-4 py-2 text-[var(--accent)]">
                        User Management
                      </Link>
                    </>
                  )}
                  <button onClick={handleSignOut} className="block w-full text-left px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                    {t('nav.signOut')}
                  </button>
                </>
              )}
              
              {!isAuthenticated && (
                <>
                  <div className="border-t border-[var(--border-color)] my-2"></div>
                  <Link href="/login" className="block px-4 py-2 text-[var(--accent)]">
                    Log In
                  </Link>
                  <Link href="/register" className="block px-4 py-2 text-[var(--accent)] font-semibold">
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
