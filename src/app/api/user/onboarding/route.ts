export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'

/**
 * POST /api/user/onboarding
 *
 * Marks the onboarding tour as completed or skipped (server-side).
 * AUDIT FIX (M18, 2026-07-02): Previously onboarding state was
 * localStorage-only — clearing browser storage or switching devices
 * showed the tour again. Now persisted to the users table.
 *
 * Body: { action: 'complete' | 'skip' }
 *
 * Also supports GET to check the current onboarding status:
 *   GET /api/user/onboarding → { completed: boolean, skipped: boolean }
 */

const OnboardingSchema = z.object({
  action: z.enum(['complete', 'skip']),
})

export const POST = apiHandler(
  { auth: true, schema: OnboardingSchema },
  async (_req, ctx) => {
    const { action } = ctx.body as z.infer<typeof OnboardingSchema>

    const column = action === 'complete' ? 'onboarding_completed_at' : 'onboarding_skipped_at'

    await db.query(
      `UPDATE users SET ${column} = NOW() WHERE id = $1`,
      [ctx.userId]
    )

    return NextResponse.json({ success: true, action })
  }
)

export const GET = apiHandler(
  { auth: true },
  async (_req, ctx) => {
    const { rows } = await db.query(
      `SELECT onboarding_completed_at, onboarding_skipped_at
       FROM users WHERE id = $1`,
      [ctx.userId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      completed: rows[0].onboarding_completed_at !== null,
      skipped: rows[0].onboarding_skipped_at !== null,
      completedAt: rows[0].onboarding_completed_at,
      skippedAt: rows[0].onboarding_skipped_at,
    })
  }
)
