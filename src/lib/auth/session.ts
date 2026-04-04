/**
 * Auth session helpers — server-side
 * 
 * Provides getAuthUser() for server components and API routes.
 * Replaces all supabase.auth.getUser() / supabase.auth.getSession() calls.
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return {
    id: (session.user as any).id || '',
    email: session.user.email,
    name: session.user.name || '',
  }
}

/**
 * Check if the current user is an admin.
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getAuthUser()
  if (!user) return false

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e: any) => e.trim().toLowerCase())
  
  return adminEmails.includes(user.email.toLowerCase())
}
