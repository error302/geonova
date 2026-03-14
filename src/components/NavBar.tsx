'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useLanguage, languages } from '@/lib/i18n/LanguageContext'

const toolGroups = [
  {
    title: 'FIELD LAYOUT',
    items: [
      { href: '/tools/setting-out', label: 'Setting Out' },
      { href: '/tools/missing-line', label: 'Missing Line' },
    ]
  },
  {
    title: 'LEVELING',
    items: [
      { href: '/tools/leveling', label: 'Leveling' },
      { href: '/tools/two-peg-test', label: 'Two Peg Test' },
      { href: '/tools/height-of-object', label: 'Height of Object' },
    ]
  },
  {
    title: 'CALCULATIONS',
    items: [
      { href: '/tools/distance', label: 'Distance & Bearing' },
      { href: '/tools/bearing', label: 'Bearing' },
      { href: '/tools/area', label: 'Area' },
      { href: '/tools/grade', label: 'Grade' },
    ]
  },
  {
    title: 'TRAVERSE & ADJUSTMENT',
    items: [
      { href: '/tools/traverse', label: 'Traverse' },
      { href: '/tools/coordinates', label: 'Coordinates' },
      { href: '/tools/cogo', label: 'COGO' },
      { href: '/tools/chainage', label: 'Chainage Calculator' },
    ]
  },
  {
    title: 'CURVES',
    items: [
      { href: '/tools/curves', label: 'Horizontal Curves' },
      { href: '/tools/tacheometry', label: 'Tacheometry' },
    ]
  },
]

export default function NavBar() {
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

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

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setShowInstall(false)
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <nav className="border-b border-[var(--border-color)] bg-[#0a0a0f] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-2xl font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
          GEONOVA
        </Link>

        {/* Desktop Dropdowns */}
        <div className="hidden md:flex items-center gap-1">
          <div className="relative group">
            <button className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
              Quick Tools ▾
            </button>
            <div className="absolute top-full left-0 pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="bg-[#111118] border border-[#E8841A20] rounded-lg shadow-xl min-w-[200px] py-2">
                {toolGroups.map(group => (
                  <div key={group.title}>
                    <div className="px-4 py-2 text-xs text-gray-500 uppercase tracking-wider font-semibold">
                      {group.title}
                    </div>
                    {group.items.map(item => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-4 py-2 text-sm text-gray-300 hover:text-[var(--accent)] hover:bg-white/5"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Process Field Notes - Flagship Feature */}
          <Link 
            href="/process" 
            className="px-4 py-2 text-sm font-semibold text-[#E8841A] hover:text-[#E8841A] transition-colors"
          >
            Process Field Notes
          </Link>
          
          {/* Field Mode */}
          <Link 
            href="/field" 
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
          >
            Field Mode
          </Link>
          
          {/* Guide */}
          <Link 
            href="/guide" 
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
          >
            Guide
          </Link>
          
          {/* Field Book */}
          <Link 
            href="/fieldbook" 
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
          >
            Field Book
          </Link>
          
          {/* Community - Beacon Network */}
          <Link 
            href="/beacons" 
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
          >
            Beacons
          </Link>
          
          {user && (
            <Link href="/dashboard" className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
              Projects
            </Link>
          )}
          
          <Link href="/dashboard" className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
            Dashboard
          </Link>
          
          {showInstall && (
            <button
              onClick={handleInstall}
              className="ml-2 text-sm border border-[#E8841A] text-[#E8841A] px-3 py-1 rounded hover:bg-[#E8841A] hover:text-black transition"
            >
              📲 Install
            </button>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <LanguageDropdown />
          {loading ? (
            <div className="w-24 h-8 bg-gray-800 animate-pulse rounded"></div>
          ) : user ? (
            <div className="hidden md:flex items-center gap-4">
              <span className="text-sm text-gray-500">{user.email}</span>
              <Link href="/dashboard" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm border border-gray-600 text-gray-300 rounded hover:border-[#E8841A] hover:text-[#E8841A] transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-4">
              <Link href="/login" className="px-4 py-2 text-sm border border-[#E8841A] text-[#E8841A] rounded hover:bg-[#E8841A]/10 transition-colors">
                Log In
              </Link>
              <Link href="/register" className="px-4 py-2 text-sm bg-[#E8841A] text-black font-semibold rounded hover:bg-[#d67715] transition-colors">
                Get Started
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
        <div className="md:hidden bg-[#0a0a0f] border-t border-gray-800 max-h-[80vh] overflow-y-auto">
          <div className="p-4 space-y-4">
            {toolGroups.map(group => (
              <div key={group.title}>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">
                  {group.title}
                </div>
                <div className="space-y-1">
                  {group.items.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 text-sm text-gray-300 hover:text-[var(--accent)] hover:bg-white/5 rounded"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            
            <div className="border-t border-gray-800 pt-4 space-y-2">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-gray-300 hover:text-[var(--accent)]"
                  >
                    Projects
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-gray-300 hover:text-[var(--accent)]"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      handleSignOut()
                      setMobileMenuOpen(false)
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-gray-300 hover:text-[var(--accent)]"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-center border border-[#E8841A] text-[#E8841A] rounded hover:bg-[#E8841A]/10"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-center bg-[#E8841A] text-black font-semibold rounded hover:bg-[#d67715]"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

function LanguageDropdown() {
  const { language, setLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const currentLang = languages.find(l => l.code === language) || languages[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-700 rounded hover:border-[#E8841A] text-gray-300 hover:text-white transition"
      >
        <span>🌐</span>
        <span className="hidden sm:inline">{currentLang.flag}</span>
        <span className="hidden md:inline">{currentLang.code.toUpperCase()}</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden z-50">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => { setLanguage(lang.code); setOpen(false); }}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-800 transition ${
                language === lang.code ? 'bg-[#E8841A]/20 text-[#E8841A]' : 'text-gray-300'
              }`}
            >
              <span className="mr-2">{lang.flag}</span>
              {lang.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
