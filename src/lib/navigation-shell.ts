export type PrimaryNavItem = {
  href: string
  label: string
  icon?: 'map' | 'tools' | 'reports'
}

/**
 * METARDU Navigation Shell — Single Source of Truth
 *
 * These items are the primary navigation for ALL users (authenticated and public).
 * They follow the Kenyan cadastral surveyor workflow:
 *   Dashboard → Field Book → Map → Tools → Reports → Community
 *
 * The Map is positioned AFTER Field Book because the natural workflow is:
 *   1. Open project → 2. Record field observations → 3. View/map data → 4. Compute → 5. Generate reports
 *
 * When authenticated, Account appears in the user dropdown (not in the main nav).
 * When public, the home page landing section handles sign-up flows.
 */
export const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/fieldbook', label: 'Field Book' },
  { href: '/map', label: 'Map', icon: 'map' },
  { href: '/tools', label: 'Tools', icon: 'tools' },
  { href: '/reports', label: 'Reports', icon: 'reports' },
  { href: '/community', label: 'Community' },
]

/**
 * @deprecated Use PRIMARY_NAV_ITEMS instead. Kept for backward compatibility.
 */
export const APP_SHELL_LINKS: PrimaryNavItem[] = PRIMARY_NAV_ITEMS

/**
 * @deprecated Use PRIMARY_NAV_ITEMS instead. Kept for backward compatibility.
 */
export const PUBLIC_SHELL_LINKS: PrimaryNavItem[] = PRIMARY_NAV_ITEMS

export function isExplicitPublicRoute(pathname: string | null | undefined) {
  const path = pathname || '/'

  if (path === '/' || path === '/community') return true

  return [
    '/docs',
    '/guide',
    '/pricing',
    '/online',
    '/login',
    '/register',
    '/tools',
  ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

export function isNavItemActive(pathname: string | null | undefined, href: string) {
  const path = pathname || '/'

  if (href === '/dashboard') {
    return path === '/dashboard'
  }

  if (href === '/projects') {
    return path === '/projects' || path.startsWith('/project/')
  }

  if (href === '/account') {
    return path === '/account' || path.startsWith('/account/') || path === '/profile' || path.startsWith('/profile/')
  }

  return path === href || path.startsWith(`${href}/`)
}
