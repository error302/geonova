import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSubscription } from '@/lib/subscription/subscriptionEngine'
import type { PlanId } from '@/lib/subscription/catalog'
import { z } from 'zod'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const SubscriptionActionSchema = z.object({
  planId: z.string().optional(),
  action: z.literal('cancel'),
})

/**
 * GET /api/subscription
 *
 * Returns the current user's subscription info.
 * Uses the server-side subscriptionEngine which correctly
 * detects admin emails and grants enterprise access.
 *
 * This replaces direct client-side DB reads of user_subscriptions
 * which missed the admin bypass logic.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ plan: 'free', status: 'active' }, { status: 401 })
    }

    const userId = session.user.id
    const email = session.user.email ?? undefined

    const sub = await getSubscription(userId, email)

    if (!sub) {
      // No subscription row — default to free tier (admin check already done inside getSubscription)
      return NextResponse.json({
        plan: 'free' as PlanId,
        status: 'active',
        isUnlimitedProjects: false,
        isUnlimitedPoints: false,
        maxTeamMembers: 1,
        isAdmin: false,
      })
    }

    return NextResponse.json({
      plan: sub.plan,
      status: sub.status,
      trialEndsAt: sub.trialEndsAt,
      periodStart: sub.periodStart,
      periodEnd: sub.periodEnd,
      paymentMethod: sub.paymentMethod,
      currency: sub.currency,
      isUnlimitedProjects: sub.isUnlimitedProjects,
      isUnlimitedPoints: sub.isUnlimitedPoints,
      maxTeamMembers: sub.maxTeamMembers,
      isAdmin: sub.paymentMethod === 'admin',
    })
  } catch (error) {
    logger.error('[/api/subscription] Error:', { error: error })
    return NextResponse.json({ plan: 'free', status: 'active' }, { status: 500 })
  }
}

/**
 * POST /api/subscription
 *
 * SECURITY (audit C-04, 2026-08-30): the only mutation a user may perform
 * directly on their own subscription is CANCELLATION. The previous
 * `subscribe` and `upgrade` actions inserted/updated user_subscriptions with
 * whatever client-supplied planId arrived — a free-plan dispenser running in
 * production. Plan changes now happen exclusively through the payment flows
 * (M-Pesa STK callback, admin-approved Till claims, PayPal webhook), each of
 * which credits server-side after verifying money actually moved.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const rawBody: unknown = await request.json()
    const parsed = SubscriptionActionSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Only the cancel action is supported. Plan changes go through checkout (/pricing).',
          code: 'ACTION_NOT_SUPPORTED',
        },
        { status: 400 }
      )
    }

    const { action } = parsed.data
    const userId = session.user.id

    // Import db dynamically to avoid circular deps
    const { db } = await import('@/lib/db')

    if (action === 'cancel') {
      await db.query<never>(
        `UPDATE user_subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE user_id = $1 AND status = 'active'`,
        [userId]
      )

      return NextResponse.json({ success: true, action: 'cancel' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    logger.error('[/api/subscription POST] Error:', { error: error })
    return NextResponse.json({ error: 'Subscription action failed' }, { status: 500 })
  }
}
