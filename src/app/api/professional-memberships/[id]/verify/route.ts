/**
 * /api/professional-memberships/[id]/verify
 *
 * POST — Admin-only: verify or reject a professional membership.
 *
 * Body:
 *   { status: 'VERIFIED' | 'FAILED', notes?: string, rejectionReason?: string }
 *
 * AUDIT FIX (H10, 2026-07-03): Admin review endpoint for the
 * documentary-proof workflow. Only admins can verify/reject.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/lib/apiHandler'
import db from '@/lib/db'

const VerifySchema = z.object({
  status: z.enum(['VERIFIED', 'FAILED']),
  notes: z.string().max(1000).optional(),
  rejectionReason: z.string().max(1000).optional(),
})

export const POST = apiHandler(
  { auth: true, roles: ['super_admin', 'admin'], schema: VerifySchema, rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { id } = ctx.params
    const input = ctx.body as z.infer<typeof VerifySchema>

    if (input.status === 'FAILED' && !input.rejectionReason?.trim()) {
      return NextResponse.json(
        { error: 'rejectionReason is required when status is FAILED', code: 'MISSING_REASON' },
        { status: 400 },
      )
    }

    const { rows } = await db.query(
      `UPDATE professional_memberships
          SET verification_status = $1,
              verification_notes = $2,
              rejection_reason = $3,
              verified_by = $4,
              verified_at = NOW(),
              updated_at = NOW()
        WHERE id = $5
       RETURNING *`,
      [
        input.status,
        input.notes || null,
        input.rejectionReason || null,
        ctx.userId,
        id,
      ],
    )

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Membership not found', code: 'NOT_FOUND' },
        { status: 404 },
      )
    }

    // If verified, update the user's surveyor_profiles.verified_isk
    // for backward compat (old code reads that column)
    if (input.status === 'VERIFIED' && rows[0].body === 'ISK') {
      await db.query(
        `UPDATE surveyor_profiles SET verified_isk = true WHERE user_id = $1`,
        [rows[0].user_id],
      ).catch(() => {})  // non-critical
    }

    return NextResponse.json({ data: rows[0] })
  },
)
