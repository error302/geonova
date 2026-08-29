import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { z } from 'zod'

interface UserRow {
  id: string
  updated_at: string | Date
  email: string
  full_name: string | null
  firm_name: string | null
  license_number: string | null
  phone: string | null
}

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/users/[userId]
 *
 * Update a user's profile fields with optimistic locking.
 * Requires auth + admin or super_admin role.
 *
 * Frontend MUST send `updated_at` in the request body — the value should be
 * the `updated_at` timestamp from the most recent GET/fetch of this user.
 * If the DB row's `updated_at` differs (another admin edited it), returns 409.
 *
 * Body fields are split across two tables:
 *   users table:             full_name (email is intentionally immutable here)
 *   surveyor_profiles table: firm_name, license_number, phone
 */
const patchUserProfileSchema = z.object({
  // users table fields
  full_name: z.string().min(1).optional(),
  // SECURITY (audit C-06/M-05, 2026-08-30): `email` is deliberately NOT
  // patchable through this route. An org_admin could previously set any
  // user's email to the platform owner's address, then re-login as
  // super_admin through the email-matched role grant. Email changes require
  // a verified re-ownership flow and are not part of admin profile editing.
  // surveyor_profiles table fields
  firm_name: z.string().nullable().optional(),
  license_number: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  // Optimistic locking: frontend must send the updated_at value it last read
  updated_at: z.string(),
})

export const PATCH = apiHandler(
  { auth: true, roles: ['super_admin', 'admin', 'org_admin'], optimisticLock: true, schema: patchUserProfileSchema, rateLimit: { max: 60, windowMs: 60000 } },
  async (_req, ctx) => {
    const { userId } = ctx.params
    const body = ctx.body as z.infer<typeof patchUserProfileSchema>

    // Fetch current user row for optimistic lock check
    const { rows } = await db.query<UserRow>(
      'SELECT id, updated_at FROM users WHERE id = $1',
      [userId]
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // T1.8 FIX (2026-07-09): Optimistic lock guard moved to the SQL WHERE clause.

    // Build dynamic UPDATE for users table
    const userFields: string[] = []
    const userValues: unknown[] = []
    let userParamIdx = 1

    const userAllowedFields: Record<string, string> = {
      full_name: 'full_name',
      // email intentionally excluded — see schema note (audit C-06/M-05)
    }

    for (const [bodyKey, colName] of Object.entries(userAllowedFields)) {
      if (bodyKey in body && body[bodyKey as keyof typeof body] !== undefined) {
        userFields.push(`${colName} = $${userParamIdx++}`)
        userValues.push(body[bodyKey as keyof typeof body])
      }
    }

    // Build dynamic UPDATE for surveyor_profiles table
    const profileFields: string[] = []
    const profileValues: unknown[] = []
    let profileParamIdx = 1

    const profileAllowedFields: Record<string, string> = {
      firm_name: 'firm_name',
      license_number: 'license_number',
      phone: 'phone',
    }

    for (const [bodyKey, colName] of Object.entries(profileAllowedFields)) {
      if (bodyKey in body && body[bodyKey as keyof typeof body] !== undefined) {
        profileFields.push(`${colName} = $${profileParamIdx++}`)
        profileValues.push(body[bodyKey as keyof typeof body])
      }
    }

    if (userFields.length === 0 && profileFields.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update', code: 'NO_FIELDS' },
        { status: 400 }
      )
    }

    // Update users table if there are user fields to update
    if (userFields.length > 0) {
      userFields.push(`updated_at = NOW()`)
      userValues.push(userId)
      // T1.8: Add optimistic lock guard to WHERE clause
      userValues.push(body.updated_at)
      const userResult = await db.query<UserRow>(
        `UPDATE users SET ${userFields.join(', ')} WHERE id = $${userParamIdx} AND updated_at = $${userParamIdx + 1} RETURNING id`,
        userValues
      )
      if (userResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'This user was modified by another admin. Please refresh and try again.', code: 'CONFLICT' },
          { status: 409 }
        )
      }
    }

    // Update surveyor_profiles table if there are profile fields to update
    if (profileFields.length > 0) {
      profileFields.push(`updated_at = NOW()`)
      profileValues.push(userId)
      await db.query<never>(
        `UPDATE surveyor_profiles SET ${profileFields.join(', ')} WHERE user_id = $${profileParamIdx}`,
        profileValues
      )
    }

    // Fetch and return the updated user
    const updated = await db.query<UserRow>(
      `SELECT u.id, u.email, u.full_name, u.updated_at,
              sp.firm_name, sp.license_number, sp.phone
       FROM users u
       LEFT JOIN surveyor_profiles sp ON sp.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    )

    return NextResponse.json({ data: updated.rows[0] })
  }
)
