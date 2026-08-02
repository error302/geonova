import { NextResponse } from 'next/server'
import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/users/override-plan
 *
 * Override a user's subscription plan (super_admin only).
 *
 * Body:
 *   email  (string, required) — user email to look up
 *   plan   ('free' | 'pro' | 'enterprise', required)
 *   days   (number, optional, default 30) — duration in days
 */
export const PATCH = apiHandler(
  { auth: true, roles: ['admin', 'super_admin'] , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const payload = ctx.body as Record<string, unknown>
    const email = String(payload.email || '').trim().toLowerCase()
    const plan = String(payload.plan || '').trim().toLowerCase()
    const days = Math.max(1, Math.min(3650, parseInt(String(payload.days || '30'), 10) || 30))

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400 },
      )
    }

    const validPlans = ['free', 'pro', 'enterprise']
    if (!validPlans.includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be free, pro, or enterprise' },
        { status: 400 },
      )
    }

    // Find user by email
    const userRes = await db.query(
      `SELECT id FROM users WHERE email = $1`,
      [email],
    )

    if (userRes.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 },
      )
    }

    const userId = userRes.rows[0].id
    const expiresAt = new Date(Date.now() + days * 86400000).toISOString()

    // Upsert subscription
    await db.query(
      `INSERT INTO user_subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
       VALUES ($1, $2, 'active', NOW(), $3)
       ON CONFLICT (user_id)
       DO UPDATE SET plan_id = $2, status = 'active', current_period_start = NOW(), current_period_end = $3`,
      [userId, plan, expiresAt],
    )

    return apiSuccess({
      userId,
      email,
      plan,
      expiresAt,
      days,
    })
  },
)
