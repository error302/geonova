'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const icons = {
  projects: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  tools: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
    </svg>
  ),
  guides: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
    </svg>
  ),
  beacons: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/>
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
}

const mobileNavItems = [
  { href: '/dashboard', icon: 'projects', labelKey: 'nav.projects' },
  { href: '/tools', icon: 'tools', labelKey: 'nav.tools' },
  { href: '/guide', icon: 'guides', labelKey: 'guides.title' },
  { href: '/beacons', icon: 'beacons', labelKey: 'community.controlPoints' },
  { href: '/profile', icon: 'profile', labelKey: 'nav.profile' },
] as const

export default function MobileNav() {
  const pathname = usePathname()
  const { t } = useLanguage()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[var(--bg-primary)] border-t border-[var(--border-color)] md:hidden z-50 safe-area-inset-bottom">
      <div className="flex justify-around items-stretch py-1">
        {mobileNavItems.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 text-[10px] font-medium tracking-wide transition-colors min-w-0 flex-1 ${
                isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className={`w-5 h-5 transition-colors ${isActive ? 'text-[var(--accent)]' : ''}`}>
                {icons[item.icon]}
              </span>
              <span className="truncate">{t(item.labelKey)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
