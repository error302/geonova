'use client';

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  FolderKanban, LayoutDashboard, MapPinned, UserRound, UsersRound, Wrench, FileText,
  CalendarDays, Radar, Store, ChevronRight, X, AlertTriangle, Clock,
  BookOpen, Compass, MapPin, ShieldCheck, type LucideIcon
} from 'lucide-react'
import { PRIMARY_NAV_ITEMS, isNavItemActive } from '@/lib/navigation-shell'

const iconMap: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  tools: Wrench,
  map: MapPinned,
  reports: FileText,
  community: UsersRound,
  profile: UserRound,
}

/** Pages hidden from the bottom tab bar — shown in the "More" drawer */
const MORE_PAGES = [
  { href: '/fieldbook', label: 'Field Book', icon: BookOpen, color: 'text-orange-400' },
  { href: '/field', label: 'Field Mode', icon: Compass, color: 'text-cyan-400' },
  { href: '/beacons', label: 'Beacon Registry', icon: MapPin, color: 'text-amber-400' },
  { href: '/schedule', label: 'Job Schedule', icon: CalendarDays, color: 'text-blue-400' },
  { href: '/equipment', label: 'Equipment Tracker', icon: Radar, color: 'text-green-400' },
  { href: '/marketplace', label: 'Equipment Marketplace', icon: Store, color: 'text-amber-400' },
]

export default function MobileNav() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const { data: session, status: authStatus } = useSession()
  const isAuthenticated = !!session

  useEffect(() => { setMounted(true) }, [])

  // Show the unified 5-item navigation + "More" button
  const mobileNavItems = PRIMARY_NAV_ITEMS

  // Check if current page is in the "More" drawer (for active highlighting)
  const isMoreActive = MORE_PAGES.some(p => pathname === p.href || pathname.startsWith(p.href + '/'))

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 bg-[var(--bg-primary)] border-t border-[var(--border-color)] md:hidden z-50"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          // AUDIT FIX (2026-07-05): Use real safe-area inset instead of CSS class
          // (the class was a no-op). On notched Android devices this prevents
          // the nav from being obscured by the gesture bar.
        }}
        role="navigation"
        aria-label="Primary mobile navigation"
      >
        <div className="flex justify-around items-stretch">
          {mobileNavItems.slice(0, 4).map((item) => {
            const isActive = isNavItemActive(pathname, item.href)
            const iconName = item.icon || item.href.replace('/', '')
            const Icon = iconMap[iconName] || LayoutDashboard
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 px-2 min-h-[48px] py-2 text-[10px] font-medium tracking-wide transition-colors min-w-0 flex-1 ${
                  isActive ? 'text-[var(--accent)]' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className={`h-5 w-5 transition-colors ${isActive ? 'text-[var(--accent)]' : 'text-gray-400'}`} strokeWidth={1.9} />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}

          {/* Reports */}
          {(() => {
            const reportsItem = mobileNavItems[4]
            const isActive = isNavItemActive(pathname, reportsItem.href)
            const Icon = iconMap['reports'] || FileText
            return (
              <Link
                key={reportsItem.href}
                href={reportsItem.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 px-2 min-h-[48px] py-2 text-[10px] font-medium tracking-wide transition-colors min-w-0 flex-1 ${
                  isActive ? 'text-[var(--accent)]' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className={`h-5 w-5 transition-colors ${isActive ? 'text-[var(--accent)]' : 'text-gray-400'}`} strokeWidth={1.9} />
                <span className="truncate">{reportsItem.label}</span>
              </Link>
            )
          })()}

          {/* More button */}
          <button
            onClick={() => setShowMore(true)}
            aria-label="Show more navigation options"
            aria-expanded={showMore}
            className={`flex flex-col items-center justify-center gap-0.5 px-2 min-h-[48px] py-2 text-[10px] font-medium tracking-wide transition-colors min-w-0 flex-1 ${
              isMoreActive ? 'text-[var(--accent)]' : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className={`h-5 w-5 flex items-center justify-center ${isMoreActive ? 'text-[var(--accent)]' : 'text-gray-400'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.9}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
            </div>
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* More Drawer */}
      {showMore && (
        <div className="fixed inset-0 z-[60] flex md:hidden" onKeyDown={(e) => { if (e.key === 'Escape') setShowMore(false) }}>
          {/* Backdrop */}
          <button type="button" aria-label="Close menu" tabIndex={-1} className="flex-1 bg-black/60 backdrop-blur-sm cursor-pointer border-0 p-0" onClick={() => setShowMore(false)} />

          {/* Panel slides up from bottom */}
          <div
            className="w-full bg-[var(--bg-primary)] border-t border-[var(--border-color)] rounded-t-2xl max-h-[70vh] overflow-y-auto animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--text-muted)]/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-color)]">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">More Tools</h2>
              <button onClick={() => setShowMore(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions Section */}
            <div className="px-5 pt-4 pb-2">
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.15em] mb-2">Field Operations</p>
              <div className="space-y-1">
                {MORE_PAGES.map((page) => {
                  const isActive = pathname === page.href || pathname.startsWith(page.href + '/')
                  return (
                    <Link
                      key={page.href}
                      href={page.href}
                      onClick={() => setShowMore(false)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                        isActive
                          ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20'
                          : 'hover:bg-[var(--bg-tertiary)] border border-transparent'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        isActive ? 'bg-[var(--accent)]/15' : 'bg-[var(--bg-tertiary)]'
                      }`}>
                        <page.icon className={`w-4.5 h-4.5 ${isActive ? 'text-[var(--accent)]' : page.color}`} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                          {page.label}
                        </span>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Admin Section (only for admin users) */}
            {mounted && isAuthenticated && (() => {
              const userRole = (session?.user as { role?: string })?.role
              const isAdmin = userRole === 'super_admin' || userRole === 'admin' || userRole === 'org_admin'
              if (!isAdmin) return null
              return (
                <div className="px-5 pt-4 pb-2">
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.15em] mb-2">Administration</p>
                  <div className="space-y-1">
                    <Link
                      href="/admin"
                      onClick={() => setShowMore(false)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                        pathname === '/admin' || pathname.startsWith('/admin/')
                          ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20'
                          : 'hover:bg-[var(--bg-tertiary)] border border-transparent'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        pathname === '/admin' ? 'bg-[var(--accent)]/15' : 'bg-[var(--bg-tertiary)]'
                      }`}>
                        <ShieldCheck className={`w-4.5 h-4.5 ${pathname === '/admin' ? 'text-[var(--accent)]' : 'text-[var(--accent)]'}`} strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium ${pathname === '/admin' ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                          Admin Dashboard
                        </span>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${pathname === '/admin' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
                    </Link>
                  </div>
                </div>
              )
            })()}

            {/* Settings Section */}
            <div className="px-5 pt-4 pb-6">
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.15em] mb-2">Settings</p>
              <div className="space-y-1">
                {[
                  { href: '/account', label: 'Account & Billing', icon: 'account' },
                  { href: '/pricing', label: 'Pricing Plans', icon: 'pricing' },
                  { href: '/docs', label: 'Documentation', icon: 'docs' },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[var(--bg-tertiary)] transition-all"
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--bg-tertiary)]">
                      <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="flex-1 text-sm text-[var(--text-primary)]">{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slideUp 0.25s ease-out;
        }
      `}</style>
    </>
  )
}
