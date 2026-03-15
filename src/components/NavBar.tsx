'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useLanguage, languages } from '@/lib/i18n/LanguageContext'

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
    titleKey: 'tools.leveling',
    items: [
      { href: '/tools/leveling', labelKey: 'leveling.title' },
      { href: '/tools/two-peg-test', labelKey: 'tools.twoPegTest' },
    ]
  },
  {
    titleKey: 'tools.curves',
    items: [
      { href: '/tools/curves', labelKey: 'tools.curves' },
      { href: '/tools/tacheometry', labelKey: 'tools.tacheometry' },
      { href: '/tools/chainage', labelKey: 'tools.chainage' },
    ]
  },
  {
    titleKey: 'tools.specialized',
    items: [
      { href: '/tools/mining', icon: '⛏', labelKey: 'tools.mining' },
      { href: '/tools/hydrographic', icon: '🌊', labelKey: 'tools.hydrographic' },
      { href: '/tools/drone', icon: '🚁', labelKey: 'tools.drone' },
    ]
  },
]

const fieldGroups = [
  {
    titleKey: 'nav.field',
    items: [
      { href: '/field', labelKey: 'field.fieldMode' },
      { href: '/tools/setting-out', labelKey: 'tools.settingOut' },
    ]
  },
  {
    titleKey: 'nav.field',
    items: [
      { href: '/fieldbook', labelKey: 'field.fieldBook' },
      { href: '/process', labelKey: 'field.processNotes' },
    ]
  },
]

const importGroups = [
  {
    titleKey: 'nav.import',
    items: [
      { href: '/import', labelKey: 'import.totalStation' },
      { href: '/process', labelKey: 'import.csvUpload' },
      { href: '/instruments', labelKey: 'import.instruments' },
    ]
  },
]

const aiGroups = [
  {
    titleKey: 'nav.ai',
    items: [
      { href: '/guide', labelKey: 'guides.title' },
      { href: '/fieldbook', labelKey: 'field.fieldBook' },
    ]
  },
]

const communityGroups = [
  {
    titleKey: 'nav.community',
    items: [
      { href: '/community', labelKey: 'community.surveyCommunity' },
      { href: '/beacons', labelKey: 'community.controlPoints' },
      { href: '/marketplace', labelKey: 'community.marketplace' },
      { href: '/jobs', labelKey: 'community.jobs' },
      { href: '/peer-review', labelKey: 'community.peerReview' },
      { href: '/cpd', labelKey: 'community.cpd' },
      { href: '/ai-plan-checker', labelKey: 'community.aiChecker' },
    ]
  },
]

interface DropdownProps {
  label: string
  children: React.ReactNode
  isOpen: boolean
  onToggle: () => void
}

function Dropdown({ label, children, isOpen, onToggle }: DropdownProps) {
  return (
    <div className="relative group">
      <button 
        onClick={onToggle}
        className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors flex items-center gap-1"
      >
        {label}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 pt-1 z-50">
          <div className="bg-[#111118] border border-[#E8841A20] rounded-lg shadow-xl min-w-[200px] py-2">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

type Translator = (key: string, values?: Record<string, string | number>) => string
type MenuItem = { href: string; labelKey: string; icon?: string }
type MenuGroup = { titleKey: string; items: MenuItem[] }

function DropdownGroup({ titleKey, items, t }: { titleKey: string, items: MenuItem[], t: Translator }) {
  return (
    <div className="px-4 py-2">
      <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
        {t(titleKey)}
      </div>
      {items.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className="block px-2 py-1.5 text-sm text-gray-300 hover:text-[var(--accent)] hover:bg-white/5 rounded"
        >
          <span className="inline-flex items-center gap-2">
            {item.icon ? <span aria-hidden>{item.icon}</span> : null}
            <span>{t(item.labelKey)}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

function MegaMenu({ groups, t }: { groups: MenuGroup[], t: Translator }) {
  return (
    <div className="flex gap-6 px-4 py-3">
      {groups.map((group, idx) => (
        <DropdownGroup key={idx} titleKey={group.titleKey} items={group.items} t={t} />
      ))}
    </div>
  )
}

function GlobalSearch({ t }: { t: Translator }) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const results = [
    { category: 'Tools', items: [
      { href: '/tools/traverse', label: 'Traverse Calculator' },
      { href: '/tools/leveling', label: 'Leveling Calculator' },
      { href: '/tools/cogo', label: 'COGO Tools' },
    ]},
    { category: 'Pages', items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/guide', label: 'Field Guides' },
      { href: '/beacons', label: 'Control Points' },
    ]},
  ]

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
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-400 hover:border-[var(--accent)] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span className="hidden sm:inline">{t('nav.search')}</span>
        <kbd className="hidden sm:inline px-1.5 py-0.5 text-xs bg-gray-700 rounded">⌘K</kbd>
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-start justify-center pt-[15vh] z-50"
          onClick={() => { setIsOpen(false); setQuery(''); }}
        >
          <div 
            className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 p-4 border-b border-gray-800">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <kbd className="px-2 py-1 text-xs bg-gray-800 text-gray-400 rounded">ESC</kbd>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {results.map((group, idx) => (
                <div key={idx} className="mb-2">
                  <div className="px-3 py-2 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                    {group.category}
                  </div>
                  {group.items.map((item, i) => (
                    <Link
                      key={i}
                      href={item.href}
                      onClick={() => { setIsOpen(false); setQuery(''); }}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-[var(--accent)] rounded-lg"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}
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

  const { language, setLanguage, t } = useLanguage()

  useEffect(() => {
    const supabase = createClient()
    
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user as { email: string } | null)
      setLoading(false)
    }
    
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user as { email: string } | null)
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
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const handleDropdownToggle = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name)
  }

  const currentLang = languages.find(l => l.code === language) || languages[0]

  return (
    <nav className="border-b border-[var(--border-color)] bg-[#0a0a0f] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        {/* Main Navbar */}
        <div className="h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="text-2xl font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
            GEONOVA
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {/* Tools Dropdown */}
            <div className="relative group">
              <button className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                {t('nav.tools')} ▾
              </button>
              <div className="absolute top-full left-0 pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="bg-[#111118] border border-[#E8841A20] rounded-lg shadow-xl min-w-[600px] py-2">
                  <MegaMenu groups={toolGroups} t={t} />
                </div>
              </div>
            </div>

            {/* Projects Link */}
            <Link 
              href="/dashboard" 
              className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
            >
              {t('nav.projects')}
            </Link>

            {/* Field Dropdown */}
            <div className="relative group">
              <button className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                {t('nav.field')} ▾
              </button>
              <div className="absolute top-full left-0 pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="bg-[#111118] border border-[#E8841A20] rounded-lg shadow-xl min-w-[180px] py-2">
                  {fieldGroups.map((group, idx) => (
                    <DropdownGroup key={idx} titleKey={group.titleKey} items={group.items} t={t} />
                  ))}
                </div>
              </div>
            </div>

            {/* Import Dropdown */}
            <div className="relative group">
              <button className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                {t('nav.import')} ▾
              </button>
              <div className="absolute top-full left-0 pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="bg-[#111118] border border-[#E8841A20] rounded-lg shadow-xl min-w-[180px] py-2">
                  {importGroups.map((group, idx) => (
                    <DropdownGroup key={idx} titleKey={group.titleKey} items={group.items} t={t} />
                  ))}
                </div>
              </div>
            </div>

            {/* AI Dropdown */}
            <div className="relative group">
              <button className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                {t('nav.ai')} ▾
              </button>
              <div className="absolute top-full left-0 pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="bg-[#111118] border border-[#E8841A20] rounded-lg shadow-xl min-w-[180px] py-2">
                  {aiGroups.map((group, idx) => (
                    <DropdownGroup key={idx} titleKey={group.titleKey} items={group.items} t={t} />
                  ))}
                </div>
              </div>
            </div>

            {/* Community Link */}
            <div className="relative group">
              <button className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                {t('nav.community')} ▾
              </button>
              <div className="absolute top-full left-0 pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="bg-[#111118] border border-[#E8841A20] rounded-lg shadow-xl min-w-[180px] py-2">
                  {communityGroups.map((group, idx) => (
                    <DropdownGroup key={idx} titleKey={group.titleKey} items={group.items} t={t} />
                  ))}
                </div>
              </div>
            </div>

            {/* Docs */}
            <Link 
              href="/docs" 
              className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
            >
              {t('nav.docs')}
            </Link>

            {/* Online Services */}
            <div className="relative group">
              <button className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                Online ▾
              </button>
              <div className="absolute top-full left-0 pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="bg-[#111118] border border-[#E8841A20] rounded-lg shadow-xl min-w-[200px] py-2">
                  <Link href="/online" className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-[var(--accent)]">
                    Coordinate Services
                  </Link>
                  <Link href="/parcel" className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-[var(--accent)]">
                    Parcel Intelligence
                  </Link>
                  <Link href="/kencors" className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-[var(--accent)]">
                    KenCORS RTK
                  </Link>
                  <Link href="/equipment" className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-[var(--accent)]">
                    Equipment Tracker
                  </Link>
                  <Link href="/digital-signature" className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-[var(--accent)]">
                    Digital Signature
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* Global Search */}
            <GlobalSearch t={t} />

            {/* Language Selector */}
            <div className="relative group">
              <button className="flex items-center gap-2 px-2 py-1 text-sm text-gray-400 hover:text-[var(--accent)] transition-colors">
                <span>{currentLang.flag}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute top-full right-0 pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="bg-[#111118] border border-[#E8841A20] rounded-lg shadow-xl py-1 min-w-[140px]">
                  {languages.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => setLanguage(lang.code)}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 ${
                        language === lang.code ? 'text-[var(--accent)]' : 'text-gray-300'
                      }`}
                    >
                      {lang.flag} {lang.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="w-20 h-8 bg-gray-800 animate-pulse rounded"></div>
            ) : user ? (
              <div className="hidden md:flex items-center gap-3">
                <Link 
                  href="/pricing" 
                  className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  {t('nav.pricing')}
                </Link>
                <Link 
                  href="/white-label" 
                  className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  White Label
                </Link>
                <Link 
                  href="/api-docs" 
                  className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  API
                </Link>
                <Link href="/dashboard" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                  {t('nav.dashboard')}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="px-3 py-1.5 text-sm border border-gray-600 text-gray-300 rounded hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  {t('nav.signOut')}
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/login" className="px-4 py-2 text-sm border border-[#E8841A] text-[#E8841A] rounded hover:bg-[#E8841A]/10 transition-colors">
                  {t('nav.login')}
                </Link>
                <Link href="/register" className="px-4 py-2 text-sm bg-[#E8841A] text-black font-semibold rounded hover:bg-[#d67715] transition-colors">
                  {t('nav.register')}
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-300"
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
          <div className="md:hidden bg-[#0a0a0f] border-t border-gray-800 max-h-[80vh] overflow-y-auto pb-4">
            <div className="py-2">
              {/* Quick Links */}
              <Link href="/dashboard" className="block px-4 py-2 text-gray-300 hover:text-[var(--accent)]">
                {t('nav.projects')}
              </Link>
              <Link href="/tools" className="block px-4 py-2 text-gray-300 hover:text-[var(--accent)]">
                {t('nav.tools')}
              </Link>
              <Link href="/field" className="block px-4 py-2 text-gray-300 hover:text-[var(--accent)]">
                {t('field.fieldMode')}
              </Link>
              <Link href="/guide" className="block px-4 py-2 text-gray-300 hover:text-[var(--accent)]">
                {t('guides.title')}
              </Link>
              <Link href="/community" className="block px-4 py-2 text-gray-300 hover:text-[var(--accent)]">
                {t('nav.community')}
              </Link>
              <Link href="/docs" className="block px-4 py-2 text-gray-300 hover:text-[var(--accent)]">
                {t('nav.docs')}
              </Link>
              
              {user && (
                <>
                  <div className="border-t border-gray-800 my-2"></div>
                  <Link href="/profile" className="block px-4 py-2 text-gray-300 hover:text-[var(--accent)]">
                    {t('nav.profile')}
                  </Link>
                  <Link href="/account" className="block px-4 py-2 text-gray-300 hover:text-[var(--accent)]">
                    {t('nav.account')}
                  </Link>
                  <button onClick={handleSignOut} className="block w-full text-left px-4 py-2 text-gray-300 hover:text-[var(--accent)]">
                    {t('nav.signOut')}
                  </button>
                </>
              )}
              
              {!user && (
                <>
                  <div className="border-t border-gray-800 my-2"></div>
                  <Link href="/login" className="block px-4 py-2 text-[#E8841A]">
                    {t('nav.login')}
                  </Link>
                  <Link href="/register" className="block px-4 py-2 text-[#E8841A] font-semibold">
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
