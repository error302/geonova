/**
 * Auth session helpers — server-side
 * 
 * Provides getAuthUser() for server components and API routes.
 * Replaces all dbClient.auth.getUser() / dbClient.auth.getSession() calls.
 */

import { auth } from '@/lib/auth-v5'
export interface AuthUser {
  id: string
  email: string
  name: string
}

/**
 * Get the currently authenticated user from the NextAuth session.
 * Returns null if not authenticated.
 * 
 * Usage in server components / API routes:
 *   const user = await getAuthUser()
 *   if (!user) redirect('/login')
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await auth()
  if (!session?.user?.email) return null

  return {
    id: session.user.id ?? '',
    email: session.user.email,
    name: session.user.name ?? '',
  }
}

/**
 * Check if the current user is an admin.
 * Checks both 'admin' and 'super_admin' roles, as well as ADMIN_EMAILS.
 */
export async function isAdmin(): Promise<boolean> {
  const session = await auth()
  if (!session?.user) return false

  const userRole = (session.user as { role?: string }).role
  if (userRole === 'super_admin' || userRole === 'admin' || userRole === 'org_admin') {
    return true
  }

  // Fallback: check ADMIN_EMAILS
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())

  return adminEmails.includes((session.user.email || '').toLowerCase())
}
