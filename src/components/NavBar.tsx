'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useLanguage, languages } from '@/lib/i18n/LanguageContext'
import MetarduLogo from '@/components/MetarduLogo'
import SubscriptionBadge from '@/components/SubscriptionBadge'
import type { PlanId } from '@/lib/subscription/catalog'

const toolGroups = [
  {
    titleKey: 'tools.calculations',
    items: [
      { href: '/tools/distance', labelKey: 'tools.distance' },
      { href: '/tools/bearing', labelKey: 'tools.bearingCalc' },
      { href: '/tools/area', labelKey: 'tools.area' },
      { href: '/tools/grade', labelKey: 'tools.grade' },
    ]
  },
  {
    titleKey: 'tools.traverseAdjust',
    items: [
      { href: '/tools/traverse', labelKey: 'traverse.title' },
      { href: '/tools/coordinates', labelKey: 'tools.coordinates' },
      { href: '/tools/cogo', labelKey: 'tools.cogo' },
      { href: '/tools/gnss', labelKey: 'tools.gnss' },
    ]
  },
  {
    titleKey: 'tools.levelling',
    items: [
      { href: '/tools/levelling', labelKey: 'leveling.title' },
      { href: '/tools/two-peg-test', labelKey: 'tools.twoPegTest' },
    ]
  },
  {
    titleKey: 'tools.curvesRoads',
    items: [
      { href: '/tools/curves', labelKey: 'tools.curves' },
      { href: '/tools/chainage', labelKey: 'tools.chainage' },
      { href: '/tools/tacheometry', labelKey: 'tools.tacheometry' },
    ]
  },
  {
    titleKey: 'tools.earthworks',
    items: [
      { href: '/tools/cross-sections', labelKey: 'tools.crossSections' },
      { href: '/tools/setting-out', labelKey: 'tools.settingOut' },
    ]
  },
  {
    titleKey: 'tools.specialized',
    items: [
      { href: '/tools/mining', icon: '⛏', labelKey: 'tools.mining' },
      { href: '/tools/hydrographic', icon: '🌊', labelKey: 'tools.hydrographic' },
      { href: '/tools/drone', icon: '🚁', labelKey: 'tools.drone' },
      { href: '/tools/gcp-export', labelKey: 'tools.gcpExport' },
      { href: '/tools/civil-export', labelKey: 'tools.civilExport' },
      { href: '/tools/gis-export', labelKey: 'tools.gisExport' },
    ]
  },
  {
    titleKey: 'tools.engineering',
    items: [
      { href: '/tools/superelevation', labelKey: 'tools.superelevation', label: 'Superelevation' },
      { href: '/tools/sight-distance', labelKey: 'tools.sightDistance', label: 'Sight Distance' },
      { href: '/tools/pipe-gradient', labelKey: 'tools.pipeGradient', label: 'Pipe Gradient' },
      { href: '/tools/borrow-pit-volume', labelKey: 'tools.borrowPitVolume', label: 'Borrow Pit Volume' },
      { href: '/tools/stockpile-volume', labelKey: 'tools.stockpileVolume', label: 'Stockpile Volume' },
      { href: '/tools/setting-out', labelKey: 'tools.settingOut', label: 'Setting Out' },
    ]
  },
]

const fieldGroups = [
  {
    titleKey: 'nav.field',
    items: [
      { href: '/field', labelKey: 'field.fieldMode' },
      { href: '/fieldbook', labelKey: 'field.fieldBook' },
      { href: '/ai-plan-checker', labelKey: 'field.fieldPlanner' },
      { href: '/process', labelKey: 'field.processNotes' },
      { href: '/guide', labelKey: 'guides.title' },
    ]
  },
]

const documentGroups = [
  {
    titleKey: 'nav.documents',
    items: [
      { href: '/deed-plan', labelKey: 'documents.deedPlan', badgeKey: 'new' },
      { href: '/tools/survey-report-builder', labelKey: 'documents.surveyReport', badgeKey: 'new' },
      { href: '/tools/beacon-reference', labelKey: 'documents.beaconReference' },
      { href: '/tools/survey-regulations', labelKey: 'documents.surveyRegulations' },
      { href: '/tools/us-survey-reference', labelKey: 'documents.usSurveyReference' },
    ]
  },
]

const moreGroups = [
  {
    titleKey: 'nav.import',
    items: [
      { href: '/import', labelKey: 'import.totalStation' },
      { href: '/process', labelKey: 'import.csvUpload' },
      { href: '/instruments', labelKey: 'import.instruments' },
    ]
  },
  {
    titleKey: 'nav.community',
    items: [
      { href: '/jobs', labelKey: 'community.projectTenders' },
      { href: '/marketplace', labelKey: 'community.equipmentExchange' },
      { href: '/peer-review', labelKey: 'community.peerReview' },
      { href: '/beacons', labelKey: 'community.controlPointsMap' },
    ]
  },
  {
    titleKey: 'nav.resources',
    items: [
      { href: '/online', labelKey: 'resources.datumConverter' },
      { href: '/kencors', labelKey: 'resources.kencorsRtk' },
      { href: '/equipment', labelKey: 'resources.calibrationManager', badgeKey: 'calibration' },
      { href: '/cpd', labelKey: 'resources.cpdTracker' },
      { href: '/parcel', labelKey: 'resources.landRegistrySearch' },
      { href: '/docs', labelKey: 'resources.knowledgeBase' },
    ]
  },
]

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
          <div className={`bg-[var(--bg-secondary)] border border-[#E8841A20] rounded-lg shadow-xl ${panelClassName ?? 'min-w-[200px] py-2'}`}>
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

type Translator = (key: string, values?: Record<string, string | number>) => string
type MenuItem = { href: string; labelKey: string; icon?: string; badgeKey?: 'new' | 'ai' | 'beta' | string }
type MenuGroup = { titleKey: string; items: MenuItem[] }

function DropdownGroup({
  titleKey,
  items,
  t,
  onSelect,
  badgeCounts,
}: {
  titleKey: string
  items: MenuItem[]
  t: Translator
  onSelect?: () => void
  badgeCounts?: Record<string, number>
}) {
  const getBadgeStyle = (badgeKey?: string) => {
    switch (badgeKey) {
      case 'new':
        return 'bg-green-600 text-white'
      case 'ai':
        return 'bg-indigo-600 text-white'
      case 'beta':
        return 'bg-amber-600 text-white'
      default:
        return 'bg-red-600 text-white'
    }
  }

  return (
    <div className="px-4 py-2">
      <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-2">
        {t(titleKey)}
      </div>
      {items.map((item: any) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onSelect}
          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
        >
          <span className="inline-flex items-center gap-2">
            {item.icon ? <span aria-hidden>{item.icon}</span> : null}
            <span>{t(item.labelKey)}</span>
            {item.badgeKey && (item.badgeKey === 'new' || item.badgeKey === 'ai' || item.badgeKey === 'beta') ? (
              <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded ${getBadgeStyle(item.badgeKey)}`}>
                {item.badgeKey.toUpperCase()}
              </span>
            ) : item.badgeKey && badgeCounts && badgeCounts[item.badgeKey] > 0 ? (
              <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-bold bg-red-600 text-white rounded-full">
                !
              </span>
            ) : null}
          </span>
        </Link>
      ))}
    </div>
  )
}

function MegaMenu({ groups, t, onSelect }: { groups: MenuGroup[]; t: Translator; onSelect?: () => void }) {
  return (
    <div className="flex gap-6 px-4 py-3">
      {groups.map((group, idx) => (
        <DropdownGroup key={idx} titleKey={group.titleKey} items={group.items} t={t} onSelect={onSelect} />
      ))}
    </div>
  )
}

function GlobalSearch({ t }: { t: Translator }) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isMac = typeof navigator !== 'undefined' ? /mac|iphone|ipad|ipod/i.test(navigator.platform) : false
  const hint = isMac ? '⌘K' : 'Ctrl K'

  const searchIndex = useMemo(() => {
    const flatten = (category: string, groups: MenuGroup[]) => {
      const out: Array<{ category: string; group: string; href: string; label: string }> = []
      for (const g of groups) {
        const groupLabel = t(g.titleKey)
        for (const item of g.items) {
          out.push({ category, group: groupLabel, href: item.href, label: t(item.labelKey) })
        }
      }
      return out
    }

    const docsItems = [
      { href: '/docs', label: t('nav.docs'), group: t('nav.docs') },
      { href: '/pricing', label: t('nav.pricing'), group: t('nav.docs') },
    ]

    return [
      ...flatten(t('nav.tools'), toolGroups),
      ...flatten(t('nav.field'), fieldGroups),
      ...flatten(t('nav.more'), moreGroups),
      ...docsItems.map((x) => ({ category: x.group, group: x.group, href: x.href, label: x.label })),
      { category: t('nav.projects'), group: t('nav.projects'), href: '/dashboard', label: t('nav.dashboard') },
    ]
  }, [t])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return searchIndex.slice(0, 18)
    return searchIndex
      .filter((x) => `${x.label} ${x.group} ${x.category}`.toLowerCase().includes(q))
      .slice(0, 30)
  }, [query, searchIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-secondary)] hover:border-[var(--accent)] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden sm:inline">{t('nav.search')}</span>
        <kbd className="hidden sm:inline px-1.5 py-0.5 text-xs bg-gray-700 rounded">{hint}</kbd>
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-start justify-center pt-[15vh] z-50"
          onClick={() => { setIsOpen(false); setQuery(''); }}
        >
          <div 
            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl w-full max-w-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 p-4 border-b border-[var(--border-color)]">
              <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('nav.search')}
                className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none"
              />
              <kbd className="px-2 py-1 text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded">ESC</kbd>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="p-4 text-sm text-[var(--text-secondary)]">{t('common.noResults')}</div>
              ) : (
                <div className="space-y-1">
                  {filtered.map((item) => (
                    <Link
                      key={`${item.href}|${item.label}`}
                      href={item.href}
                      onClick={() => {
                        setIsOpen(false)
                        setQuery('')
                      }}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)] rounded-lg"
                    >
                      <span>{item.label}</span>
                      <span className="text-xs text-[var(--text-muted)]">{item.group}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function NavBar() {
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [userPlan, setUserPlan] = useState<PlanId>('free')
  const [calibrationOverdueCount, setCalibrationOverdueCount] = useState(0)
  const navRef = useRef<HTMLDivElement>(null)

  const { language, setLanguage, t, hydrated } = useLanguage()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const supabase = createClient()
    
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null
      setUser(user as { email: string } | null)
      if (user) {
        const { data: sub } = await supabase
          .from('user_subscriptions')
          .select('plan_id')
          .eq('user_id', user.id)
          .maybeSingle()
        setUserPlan((sub?.plan_id as PlanId) || 'free')
      } else {
        setUserPlan('free')
      }
      setLoading(false)
    }
    
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user as { email: string; id?: string } | null
      setUser(u)
      if (u?.id) {
        const { data: sub } = await supabase
          .from('user_subscriptions')
          .select('plan_id')
          .eq('user_id', u.id)
          .maybeSingle()
        setUserPlan((sub?.plan_id as PlanId) || 'free')
      } else {
        setUserPlan('free')
      }
      setLoading(false)
    })

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    return () => {
      subscription.unsubscribe()
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
    // Sign out via NextAuth
    try {
      const { signOut } = await import('next-auth/react')
      await signOut({ redirect: false })
    } catch {
      // Fallback: call signout API directly
      await fetch('/api/auth/signout', { method: 'POST' })
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

  const currentLang = languages.find((l: any) => l.code === language) || languages[0]

  if (!mounted) {
    return (
      <div className="h-16 border-b border-[var(--border-color)] bg-[#0a0a0f]" />
    )
  }

  return (
    <nav className="border-b border-[var(--border-color)] bg-[#0a0a0f] sticky top-0 z-50">
      <div ref={navRef} className="max-w-7xl mx-auto px-4">
        {/* Main Navbar */}
        <div className="h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/">
            <MetarduLogo color="var(--accent)" size={28} showWordmark={true} />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {/* Dashboard Link */}
            <Link 
              href="/dashboard" 
              className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors rounded-lg hover:bg-white/5"
            >
              Dashboard
            </Link>

            {/* Projects Link */}
            <Link 
              href="/projects" 
              className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors rounded-lg hover:bg-white/5"
            >
              Projects
            </Link>

            {/* Community Link */}
            <Link 
              href="/community" 
              className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors rounded-lg hover:bg-white/5"
            >
              Community
            </Link>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* Global Search */}
            <GlobalSearch t={t} />

            {/* Language Selector */}
            <Dropdown
              label={`${currentLang.flag} ${currentLang.code.toUpperCase()}`}
              isOpen={openDropdown === 'lang'}
              onToggle={() => handleDropdownToggle('lang')}
              align="right"
              panelClassName="min-w-[180px] py-1"
              buttonClassName="flex items-center gap-2 px-2 py-1 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors rounded-lg hover:bg-white/5"
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

            {loading ? (
              <div className="w-20 h-8 bg-[var(--bg-tertiary)] animate-pulse rounded"></div>
            ) : user ? (
              <div className="hidden md:block relative">
                <button
                  onClick={() => handleDropdownToggle('user')}
                  aria-expanded={openDropdown === 'user'}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 hover:border-[var(--accent)] transition-colors"
                >
                  <span className="w-8 h-8 rounded-full bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center font-bold">
                    {(user.email || 'U').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="hidden lg:flex flex-col">
                    <span className="text-sm text-[var(--text-primary)] max-w-[180px] truncate leading-tight">{user.email}</span>
                    <SubscriptionBadge plan={userPlan} compact />
                  </div>
                  <svg className="w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {openDropdown === 'user' && (
                  <div className="absolute top-full right-0 pt-2 z-50">
                    <div className="bg-[var(--bg-secondary)] border border-[#E8841A20] rounded-lg shadow-xl min-w-[220px] py-2">
                      <div className="px-4 pb-2 flex items-center justify-between">
                        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">{t('nav.dashboard')}</div>
                        <SubscriptionBadge plan={userPlan} compact />
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
                          href="/pricing"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          {t('nav.pricing')}
                        </Link>
                        <Link
                          href="/docs"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          Documentation
                        </Link>
                        <Link
                          href="/cpd"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          CPD Tracker
                        </Link>
                        <Link
                          href="/instruments"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          Calibration Manager
                        </Link>
                        <Link
                          href="/kencors"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          KenCORS RTK
                        </Link>
                        <Link
                          href="/equipment"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          Equipment Tracker
                        </Link>
                        <Link
                          href="/guide"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          Field Guides
                        </Link>
                        <Link
                          href="/tools/beacon-reference"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          Beacon Reference
                        </Link>
                        <Link
                          href="/tools/survey-regulations"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          Kenya Survey Regulations
                        </Link>
                        <Link
                          href="/tools/us-survey-reference"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          US Survey Standards
                        </Link>
                        <Link
                          href="/enterprise"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          Enterprise Products
                        </Link>
                        <Link
                          href="/white-label"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          White Label
                        </Link>
                        <Link
                          href="/digital-signature"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          Digital Signature
                        </Link>
                        <Link
                          href="/notifications"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          Notifications
                        </Link>
                        <Link
                          href="/audit-logs"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          Audit Logs
                        </Link>
                        <Link
                          href="/api-docs"
                          onClick={() => setOpenDropdown(null)}
                          className="block px-2 py-1.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent)] hover:bg-white/5 rounded"
                        >
                          API
                        </Link>
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
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/login" className="px-4 py-2 text-sm border border-[var(--accent)] text-[var(--accent)] rounded hover:bg-[var(--accent)]/10 transition-colors">
                  {t('nav.login')}
                </Link>
                <Link href="/register" className="px-4 py-2 text-sm bg-[var(--accent)] text-black font-semibold rounded hover:bg-[var(--accent-dim)] transition-colors">
                  {t('nav.register')}
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
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

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0a0a0f] border-t border-[var(--border-color)] max-h-[80vh] overflow-y-auto pb-4">
            <div className="py-2">
              {/* Quick Links */}
              <Link href="/dashboard" className="block px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                {t('nav.projects')}
              </Link>
              <Link href="/tools" className="block px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                {t('nav.tools')}
              </Link>
              <Link href="/field" className="block px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                {t('field.fieldMode')}
              </Link>
              <Link href="/guide" className="block px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                {t('guides.title')}
              </Link>
              <Link href="/community" className="block px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                {t('nav.community')}
              </Link>
              <Link href="/docs" className="block px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                {t('nav.docs')}
              </Link>
              
              {user && (
                <>
                  <div className="border-t border-[var(--border-color)] my-2"></div>
                  <Link href="/profile" className="block px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                    {t('nav.profile')}
                  </Link>
                  <Link href="/account" className="block px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                    {t('nav.account')}
                  </Link>
                  <button onClick={handleSignOut} className="block w-full text-left px-4 py-2 text-[var(--text-primary)] hover:text-[var(--accent)]">
                    {t('nav.signOut')}
                  </button>
                </>
              )}
              
              {!user && (
                <>
                  <div className="border-t border-[var(--border-color)] my-2"></div>
                  <Link href="/login" className="block px-4 py-2 text-[var(--accent)]">
                    {t('nav.login')}
                  </Link>
                  <Link href="/register" className="block px-4 py-2 text-[var(--accent)] font-semibold">
                    {t('nav.register')}
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
