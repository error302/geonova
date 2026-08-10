/**
 * requireAuth / requireRole — Server-side auth guards for API routes.
 *
 * [!] DEPRECATED: New routes should use `apiHandler()` from '@/lib/apiHandler'
 * instead of calling requireAuth/requireRole directly. apiHandler provides
 * auth, Zod validation, optimistic locking, rate limiting, error handling,
 * and Sentry integration in a single composable wrapper.
 *
 * These functions are kept for backward compatibility with existing routes
 * that haven't been migrated yet.
 *
 * Migration guide:
 *   BEFORE: const { session, error } = await requireAuth()
 *           if (error) return error
 *   AFTER:  export const GET = apiHandler({ auth: true }, async (req, ctx) => { ... })
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { db, setCurrentUserId } from '@/lib/db'

/**
 * @deprecated Use apiHandler({ auth: true }) instead
 */
export async function requireAuth() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return {
        session: null,
        error: NextResponse.json(
          { error: 'Authentication required', code: 'UNAUTHORIZED' },
          { status: 401 }
        ),
      }
    }
    // Set the user ID for RLS policies (current_user_id() in PostgreSQL)
    const userId = (session.user as any).id
    if (userId) {
      setCurrentUserId(String(userId))
    }
    return { session, error: null }
  } catch (err) {
    console.error('[requireAuth] Session check failed:', err)
    return {
      session: null,
      error: NextResponse.json(
        { error: 'Authentication check failed', code: 'AUTH_ERROR' },
        { status: 401 }
      ),
    }
  }
}

/**
 * @deprecated Use apiHandler({ auth: true, roles: [...] }) instead
 */
export type UserRole = 'surveyor' | 'admin' | 'enterprise' | 'university' | 'government_auditor'

/**
 * @deprecated Use apiHandler({ auth: true, roles: [...] }) instead
 */
export async function requireRole(allowedRoles: UserRole[], userId: string) {
  // Ensure RLS context is set for this request
  setCurrentUserId(String(userId))

  const { rows } = await db.query<{ role: UserRole; is_suspended: boolean }>(
    'SELECT role, is_suspended FROM surveyor_profiles WHERE user_id = $1',
    [userId]
  )
  
  if (rows.length === 0) {
    return { allowed: false, error: 'Profile not found' }
  }
  
  const profile = rows[0]
  if (profile.is_suspended) {
    return { allowed: false, error: 'Account suspended' }
  }
  if (!allowedRoles.includes(profile.role)) {
    return { allowed: false, error: 'Insufficient permissions' }
  }
  
  return { allowed: true, role: profile.role }
}
