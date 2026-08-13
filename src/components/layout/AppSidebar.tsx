'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  FolderKanban, Wrench, Compass, FileText,
  LayoutDashboard, Users, ShieldCheck, CreditCard,
  Settings2, ChevronLeft, BarChart3,
  Map, Building2, HelpCircle, LayoutTemplate, Boxes,
  RoadIcon, Mountain, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { OutdoorModeToggle } from '@/components/shared/OutdoorModeToggle'
import MetarduLogo from '@/components/MetarduLogo'

// ---------------------------------------------------------------------------
// Navigation items by role
// ---------------------------------------------------------------------------

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
  hash?: string
}

const userNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/cadastral-workflow', label: 'Cadastral', icon: Compass },
  { href: '/engineering-workflow', label: 'Engineering', icon: RoadIcon },
  { href: '/topographic-workflow', label: 'Topographic', icon: Mountain },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/process', label: 'Corrections', icon: Wrench },
  { href: '/tools/all', label: 'Toolbox', icon: Boxes },
  { href: '/tools/cogo', label: 'COGO', icon: Compass },
  { href: '/map', label: 'Map', icon: Map },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/report-templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/sectional', label: 'Sectional', icon: Building2 },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/assistant', label: 'Assistant', icon: Sparkles },
  { href: '/help', label: 'Help', icon: HelpCircle },
]

const adminNavItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/audit-logs', label: 'Audit Logs', icon: ShieldCheck },
  { href: '/admin', label: 'System Health', icon: Settings2, hash: '#system' },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
]

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

interface AppSidebarProps {
  variant: 'user' | 'admin'
  className?: string
  onNavigate?: () => void
}

export default function AppSidebar({ variant, className, onNavigate }: AppSidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()

  const navItems = variant === 'admin' ? adminNavItems : userNavItems
  const userRole = (session?.user as { role?: string })?.role ?? ''

  return (
    <aside
      className={cn(
        'h-full flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--border-color)]',
        className,
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--border-color)]">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2 no-underline"
        >
          <MetarduLogo size={28} showWordmark={true} color="var(--text-primary)" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : item.hash
              ? pathname === item.href && typeof window !== 'undefined' && window.location.hash === item.hash
              : pathname.startsWith(item.href)

          const href = item.hash ? `${item.href}${item.hash}` : item.href

          return (
            <Link
              key={`${item.href}${item.hash ?? ''}`}
              href={href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors no-underline',
                isActive
                  ? 'bg-[var(--accent)] text-[var(--bg-primary)] font-medium'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]',
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--border-color)] space-y-1">
        {/* Outdoor mode toggle */}
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            Outdoor Mode
          </span>
          <OutdoorModeToggle />
        </div>
        {/* Role badge */}
        <div className="px-3 py-1.5">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            {variant === 'admin' ? 'Admin Panel' : 'Kenya Cadastral'}
          </p>
          <p className="text-xs text-[var(--text-secondary)] capitalize">{userRole || 'Surveyor'}</p>
        </div>

        {/* Switch between admin/user dashboards */}
        {variant === 'admin' ? (
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors no-underline"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to App
          </Link>
        ) : (
          (userRole === 'super_admin' || userRole === 'admin' || userRole === 'org_admin') && (
            <Link
              href="/admin"
              onClick={onNavigate}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors no-underline"
            >
              <ShieldCheck className="w-4 h-4" />
              Admin Panel
            </Link>
          )
        )}
      </div>
    </aside>
  )
}
