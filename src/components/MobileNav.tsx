'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const mobileNavItems = [
  { href: '/dashboard', icon: '🗺', label: 'Projects' },
  { href: '/tools', icon: '🧮', label: 'Tools' },
  { href: '/guide', icon: '📖', label: 'Guide' },
  { href: '/beacons', icon: '📡', label: 'Beacons' },
  { href: '/profile', icon: '👤', label: 'Profile' },
]

export default function MobileNav() {
  const pathname = usePathname()

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
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
