'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const mobileNavItems = [
  { href: '/dashboard', icon: '🗺', labelKey: 'nav.projects' },
  { href: '/tools', icon: '🧮', labelKey: 'nav.tools' },
  { href: '/guide', icon: '📖', labelKey: 'guides.title' },
  { href: '/beacons', icon: '📡', labelKey: 'community.controlPoints' },
  { href: '/profile', icon: '👤', labelKey: 'nav.profile' },
]

export default function MobileNav() {
  const pathname = usePathname()
  const { t } = useLanguage()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 md:hidden z-50">
      <div className="flex justify-around py-2">
        {mobileNavItems.map(item => {
          const isActive = pathname === item.href || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 text-xs transition-colors ${
                isActive ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
