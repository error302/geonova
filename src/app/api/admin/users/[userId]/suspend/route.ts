import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { logAuditEvent } from '@/lib/enterprise/auditTrail'
import { z } from 'zod'

interface UserRow {
  id: string
  email: string
  full_name: string | null
}

export const dynamic = 'force-dynamic'

const suspendSchema = z.object({
  reason: z.string().min(1, 'Suspension reason is required'),
})

/**
 * POST /api/admin/users/[userId]/suspend
 *
 * Suspend a user account.
 * Requires auth + admin role.
 */
export const POST = apiHandler(
  { auth: true, roles: ['super_admin', 'admin', 'org_admin'], schema: suspendSchema , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { userId } = ctx.params
    const { reason } = ctx.body as z.infer<typeof suspendSchema>

    // Check user exists
    const { rows: userRows } = await db.query<UserRow>(
      'SELECT id, email, full_name FROM users WHERE id = $1',
      [userId],
    )
    if (userRows.length === 0) {
      return apiSuccess({ error: 'User not found' }, 404)
    }

    // Suspend the user via surveyor_profiles
    await db.query<never>(
      `INSERT INTO surveyor_profiles (id, user_id, role, is_suspended, suspension_reason)
       VALUES (gen_random_uuid(), $1, 'surveyor', true, $2)
       ON CONFLICT (user_id) DO UPDATE
       SET is_suspended = true, suspension_reason = $2`,
      [userId, reason],
    )

    // Audit log
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    await logAuditEvent({
      userId: ctx.userId,
      action: 'user.suspend',
      resourceType: 'user',
      resourceId: userId,
      details: { reason, targetEmail: userRows[0].email },
      ipAddress: clientIp,
      timestamp: new Date(),
    })

    return apiSuccess({ success: true, userId, suspended: true })
  },
)

/**
 * DELETE /api/admin/users/[userId]/suspend
 *
 * Unsuspend a user account.
 * Requires auth + admin role.
 */
export const DELETE = apiHandler(
  { auth: true, roles: ['super_admin', 'admin', 'org_admin'] , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { userId } = ctx.params

    // Check user exists
    const { rows: userRows } = await db.query<UserRow>(
      'SELECT id, email FROM users WHERE id = $1',
      [userId],
    )
    if (userRows.length === 0) {
      return apiSuccess({ error: 'User not found' }, 404)
    }

    // Unsuspend the user
    await db.query<never>(
      `UPDATE surveyor_profiles
       SET is_suspended = false, suspension_reason = NULL
       WHERE user_id = $1`,
      [userId],
    )

    // Audit log
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    await logAuditEvent({
      userId: ctx.userId,
      action: 'user.unsuspend',
      resourceType: 'user',
      resourceId: userId,
      details: { targetEmail: userRows[0].email },
      ipAddress: clientIp,
      timestamp: new Date(),
    })

    return apiSuccess({ success: true, userId, suspended: false })
  },
)
