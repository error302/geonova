import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { paymentReceiptEmail } from '@/lib/email-templates/paymentReceipt'
import { getPlan } from '@/lib/subscription/catalog'
import { logger } from '@/lib/logger'
import { getMpesaTillNumber } from '@/lib/payments/mpesaConfig'

export const dynamic = 'force-dynamic'

interface ClaimRow {
  id: string
  user_id: string
  user_email: string | null
  user_name: string | null
  amount: string | null
  currency: string | null
  transaction_id: string | null
  metadata: { planId?: string; tillNumber?: string; phoneNumber?: string } | null
  created_at: Date | string
}

interface SubscriptionRow {
  id: string
}

interface UserRow {
  id: string
  email: string
  name: string | null
}

const ActionSchema = z.object({
  paymentId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  // Optional rejection reason — shown to the admin in the claims history
  // and useful when the customer asks why their claim failed.
  reason: z.string().min(3).max(500).optional(),
})

/**
 * GET /api/admin/payments/till-claims
 *
 * SECURITY (audit C-03, 2026-08-30): lists M-Pesa Till claims waiting for
 * manual review. Claims are created by /api/payments/mpesa/verify-till in
 * status 'pending_review' and grant nothing until approved here.
 */
export const GET = apiHandler(
  { auth: true, roles: ['super_admin', 'admin'], rateLimit: { max: 60, windowMs: 60000 } },
  async (_req, _ctx) => {
    const res = await db.query<ClaimRow>(
      `SELECT ph.id, ph.user_id, u.email AS user_email,
              COALESCE(u.full_name, SPLIT_PART(u.email, '@', 1)) AS user_name,
              ph.amount, ph.currency, ph.transaction_id, ph.metadata, ph.created_at
         FROM payment_history ph
         LEFT JOIN users u ON u.id = ph.user_id
        WHERE ph.status = 'pending_review'
          AND ph.payment_method = 'mpesa_till'
        ORDER BY ph.created_at ASC
        LIMIT 200`,
    )

    const claims = res.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      userName: row.user_name,
      amount: parseFloat(row.amount || '0'),
      currency: row.currency || 'KES',
      mpesaCode: row.transaction_id,
      planId: row.metadata?.planId || 'pro',
      phoneNumber: row.metadata?.phoneNumber || 'N/A',
      tillNumber: row.metadata?.tillNumber || getMpesaTillNumber(),
      submittedAt: row.created_at,
    }))

    return apiSuccess({ claims, count: claims.length })
  },
)

/**
 * POST /api/admin/payments/till-claims
 *
 * Approve or reject a pending Till claim. Approval verifies against the
 * merchant's own M-Pesa statement (the admin is expected to check the
 * receipt number, amount and till there), marks the payment completed and
 * activates the 30-day subscription. Rejection marks the claim rejected and
 * grants nothing.
 */
export const POST = apiHandler(
  { auth: true, roles: ['super_admin', 'admin'], rateLimit: { max: 60, windowMs: 60000 }, schema: ActionSchema },
  async (_req, ctx) => {
    const { paymentId, action, reason } = ctx.body as z.infer<typeof ActionSchema>

    const claimRes = await db.query<ClaimRow>(
      `SELECT ph.id, ph.user_id, u.email AS user_email,
              COALESCE(u.full_name, SPLIT_PART(u.email, '@', 1)) AS user_name,
              ph.amount, ph.currency, ph.transaction_id, ph.metadata, ph.created_at
         FROM payment_history ph
         LEFT JOIN users u ON u.id = ph.user_id
        WHERE ph.id = $1 AND ph.status = 'pending_review'
        LIMIT 1`,
      [paymentId],
    )
    const claim = claimRes.rows[0]
    if (!claim) {
      return NextResponse.json(
        { error: 'Claim not found or already processed.' },
        { status: 404 },
      )
    }

    const planId = (claim.metadata?.planId || 'pro') as string
    const plan = getPlan(planId)
    const planDisplayName = plan?.name || (planId.toUpperCase() + ' Plan')

    if (action === 'reject') {
      await db.query<never>(
        `UPDATE payment_history
            SET status = 'rejected',
                updated_at = NOW(),
                metadata = metadata || jsonb_build_object(
                  'reviewedBy', $2::text,
                  'reviewedAt', NOW()::text,
                  'rejectionReason', $3::text
                )
          WHERE id = $1`,
        [paymentId, ctx.userId, reason || 'Not specified'],
      )
      logger.info('[mpesa-till] Claim rejected', { paymentId, adminId: ctx.userId })
      return apiSuccess({ paymentId, action: 'rejected' })
    }

    // ── Approve ────────────────────────────────────────────────────────
    const periodStart = new Date()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const userRes = await db.query<UserRow>(
      'SELECT id, email, full_name AS name FROM users WHERE id = $1',
      [claim.user_id],
    )
    const user = userRes.rows[0]

    const existingSub = await db.query<SubscriptionRow>(
      'SELECT id FROM user_subscriptions WHERE user_id = $1',
      [claim.user_id],
    )

    if (existingSub.rows.length > 0) {
      await db.query<never>(
        `UPDATE user_subscriptions
            SET plan_id = $1, status = 'active', payment_method = 'mpesa_till',
                currency = 'KES', current_period_start = $2, current_period_end = $3,
                updated_at = NOW()
          WHERE id = $4`,
        [planId, periodStart.toISOString(), periodEnd.toISOString(), existingSub.rows[0].id],
      )
    } else {
      await db.query<never>(
        `INSERT INTO user_subscriptions
           (user_id, plan_id, status, payment_method, currency,
            current_period_start, current_period_end)
         VALUES ($1, $2, 'active', 'mpesa_till', 'KES', $3, $4)`,
        [claim.user_id, planId, periodStart.toISOString(), periodEnd.toISOString()],
      )
    }

    await db.query<never>(
      `UPDATE payment_history
          SET status = 'completed',
              metadata = metadata || jsonb_build_object(
                'reviewedBy', $2::text,
                'reviewedAt', NOW()::text
              )
        WHERE id = $1`,
      [paymentId, ctx.userId],
    )

    // Receipt goes to the account email only (never a client-supplied address)
    if (user?.email) {
      try {
        const receipt = paymentReceiptEmail.render({
          to: user.email,
          name: user.name || 'Surveyor',
          planName: `${planDisplayName} Plan`,
          amount: parseFloat(claim.amount || '0'),
          currency: claim.currency || 'KES',
          paidAt: new Date().toISOString(),
          transactionId: claim.transaction_id || '',
          paymentMethod: `M-Pesa Buy Goods · Till ${claim.metadata?.tillNumber || getMpesaTillNumber()}`,
        })
        await sendEmail({
          to: user.email,
          subject: receipt.subject,
          html: receipt.html,
          text: receipt.text,
        })
      } catch (emailErr) {
        logger.warn('[mpesa-till] Failed to send approval receipt:', { error: emailErr })
      }
    }

    logger.info('[mpesa-till] Claim approved', { paymentId, adminId: ctx.userId, planId })
    return apiSuccess({
      paymentId,
      action: 'approved',
      planId,
      expiresAt: periodEnd.toISOString(),
    })
  },
)
