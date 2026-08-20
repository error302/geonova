import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// ─── DB Row Interfaces ───────────────────────────────────────────────────────

interface CountRow {
  total: number
}

interface UserRow {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
  verified_isk: boolean | null
  created_at: Date | string
  updated_at: Date | string
  is_suspended: boolean | null
  suspension_reason: string | null
  plan_id: string | null
  subscription_status: string | null
}

/**
 * GET /api/admin/users
 *
 * List all users with pagination, search, and role filters.
 * Requires auth + admin role.
 *
 * Query params:
 *   page    (number, default 1)
 *   limit   (number, default 25, max 100)
 *   search  (string, searches email and full_name)
 *   role    (string, filter by role)
 *   status  (string, 'active' | 'suspended')
 */
export const GET = apiHandler(
  { auth: true, roles: ['super_admin', 'admin', 'org_admin'] , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, _ctx) => {
    const { searchParams } = new URL(req.url)

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '25', 10)), 100)
    const offset = (page - 1) * limit
    const search = searchParams.get('search')?.trim() || ''
    const roleFilter = searchParams.get('role')?.trim() || ''
    const statusFilter = searchParams.get('status')?.trim() || ''

    // Build WHERE conditions
    const conditions: string[] = []
    const params: unknown[] = []
    let paramIdx = 1

    if (search) {
      conditions.push(
        `(u.email ILIKE $${paramIdx} OR u.full_name ILIKE $${paramIdx})`,
      )
      params.push(`%${search}%`)
      paramIdx++
    }

    if (roleFilter) {
      conditions.push(`u.role = $${paramIdx}`)
      params.push(roleFilter)
      paramIdx++
    }

    if (statusFilter === 'suspended') {
      conditions.push(`sp.is_suspended = true`)
    } else if (statusFilter === 'active') {
      conditions.push(`(sp.is_suspended = false OR sp.is_suspended IS NULL)`)
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count query
    const countResult = await db.query<CountRow>(
      `SELECT COUNT(*)::int AS total
       FROM users u
       LEFT JOIN surveyor_profiles sp ON sp.user_id = u.id
       ${whereClause}`,
      params,
    )
    const total = countResult.rows[0]?.total ?? 0

    // Data query
    const dataResult = await db.query<UserRow>(
      `SELECT
         u.id,
         u.email,
         u.full_name,
         u.role,
         u.verified_isk,
         u.created_at,
         u.updated_at,
         sp.is_suspended,
         sp.suspension_reason,
         us.plan_id,
         us.status AS subscription_status
       FROM users u
       LEFT JOIN surveyor_profiles sp ON sp.user_id = u.id
       LEFT JOIN user_subscriptions us ON us.user_id = u.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset],
    )

    const users = dataResult.rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      fullName: row.full_name || row.email?.split('@')[0],
      role: row.role || 'surveyor',
      verifiedIsk: row.verified_isk || false,
      isSuspended: row.is_suspended || false,
      suspensionReason: row.suspension_reason || null,
      plan: row.plan_id || 'free',
      subscriptionStatus: row.subscription_status || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return apiSuccess({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + users.length < total,
      },
    })
  },
)
