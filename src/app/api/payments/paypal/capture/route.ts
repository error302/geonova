import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getPayPalService } from '@/lib/payments/paypal'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const CaptureOrderSchema = z.object({
  orderId: z.string().min(5).max(64),
})

interface PaymentIntentRow {
  id: string
  user_id: string
  plan_id: string
  amount: number
  currency: string
  status: string
}

interface SubscriptionRow {
  id: string
}

/**
 * POST /api/payments/paypal/capture
 *
 * SECURITY (audit H-02, 2026-08-30): the capture previously ran for
 * unauthenticated callers with no amount check, no payer check and no
 * crediting — customers paid and received nothing. Now:
 *   1. Requires an authenticated session.
 *   2. Loads the pending payment_intents row created at order time and
 *      verifies it belongs to the caller (the orderId alone identifies
 *      nothing the client may claim).
 *   3. Verifies the captured status is COMPLETED and the captured amount
 *      equals the catalog price recorded on the intent.
 *   4. Credits the subscription inside one transaction gated by a
 *      conditional UPDATE (idempotent under retries), mirroring the
 *      M-Pesa callback's activation block.
 */
export const POST = apiHandler(
  { auth: true, rateLimit: { max: 20, windowMs: 60000 }, schema: CaptureOrderSchema },
  async (_req, ctx) => {
    const { orderId } = ctx.body as z.infer<typeof CaptureOrderSchema>

    const paypal = getPayPalService()
    if (!paypal) {
      return NextResponse.json({ error: 'PayPal is not configured' }, { status: 503 })
    }

    // 1. Load the caller's own pending intent for this order
    const intentRes = await db.query<PaymentIntentRow>(
      `SELECT id, user_id, plan_id, amount, currency, status
         FROM payment_intents
        WHERE provider_id = $1 AND payment_method = 'paypal' AND user_id = $2
        LIMIT 1`,
      [orderId, ctx.userId]
    )
    const intent = intentRes.rows[0]
    if (!intent) {
      return NextResponse.json(
        { error: 'Order not found for this account', code: 'ORDER_NOT_FOUND' },
        { status: 404 }
      )
    }
    if (intent.status === 'completed') {
      // Already credited — idempotent
      return NextResponse.json({ ok: true, status: 'COMPLETED', alreadyCredited: true })
    }
    if (intent.status !== 'pending' && intent.status !== 'processing') {
      return NextResponse.json(
        { error: `Order is ${intent.status} and cannot be captured`, code: 'ORDER_NOT_CAPTURABLE' },
        { status: 409 }
      )
    }

    // 2. Capture server-side
    const captureResult = await paypal.captureOrder(orderId)

    // 3. Verify capture status and amount against the intent row
    const capture =
      captureResult.purchase_units?.[0]?.payments?.captures?.[0] ?? null
    const capturedAmount = capture ? Number(capture.amount?.value) : NaN
    const statusOk = captureResult.status === 'COMPLETED' && capture?.status === 'COMPLETED'

    if (!statusOk || !Number.isFinite(capturedAmount) || capturedAmount <= 0) {
      await db.query<never>(
        `UPDATE payment_intents SET status = 'failed', metadata = metadata || $1::jsonb, updated_at = NOW()
          WHERE id = $2`,
        [
          JSON.stringify({
            fraudFlag: 'capture_not_completed',
            captureStatus: captureResult.status,
            captureId: capture?.id ?? null,
          }),
          intent.id,
        ]
      )
      logger.warn('[paypal] Capture not completed', {
        userId: ctx.userId,
        orderId,
        status: captureResult.status,
      })
      return NextResponse.json(
        { error: 'Payment capture did not complete', code: 'CAPTURE_INCOMPLETE' },
        { status: 402 }
      )
    }

    if (Math.round(capturedAmount) !== Math.round(Number(intent.amount))) {
      await db.query<never>(
        `UPDATE payment_intents SET status = 'failed', metadata = metadata || $1::jsonb, updated_at = NOW()
          WHERE id = $2`,
        [
          JSON.stringify({
            fraudFlag: 'amount_mismatch',
            capturedAmount,
            expectedAmount: Number(intent.amount),
          }),
          intent.id,
        ]
      )
      logger.warn('[paypal] Amount mismatch', {
        userId: ctx.userId,
        orderId,
        capturedAmount,
        expectedAmount: Number(intent.amount),
      })
      return NextResponse.json(
        { error: 'Captured amount does not match the order', code: 'AMOUNT_MISMATCH' },
        { status: 402 }
      )
    }

    // 4. Credit: complete intent + audit row + subscription in one transaction
    const client = await db.getClient()
    try {
      await client.query('BEGIN')

      const completeRes = await client.query(
        `UPDATE payment_intents
            SET status = 'completed', updated_at = NOW()
          WHERE id = $1 AND status <> 'completed'`,
        [intent.id]
      )
      if ((completeRes.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ ok: true, status: 'COMPLETED', alreadyCredited: true })
      }

      await client.query(
        `INSERT INTO payment_history
           (user_id, amount, currency, payment_method, provider, provider_id,
            status, transaction_id, metadata)
         VALUES ($1, $2, $3, 'paypal', 'paypal', $4, 'completed', $5, $6)
         ON CONFLICT (provider_id) DO NOTHING`,
        [
          intent.user_id,
          capturedAmount,
          intent.currency,
          orderId,
          capture?.id ?? orderId,
          JSON.stringify({ planId: intent.plan_id, paymentIntentId: intent.id }),
        ]
      )

      const periodStart = new Date().toISOString()
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      const existingSub = await client.query<SubscriptionRow>(
        'SELECT id FROM user_subscriptions WHERE user_id = $1',
        [intent.user_id]
      )
      if (existingSub.rows.length > 0) {
        await client.query(
          `UPDATE user_subscriptions
              SET plan_id = $1, status = 'active', payment_method = 'paypal',
                  currency = $2, current_period_start = $3, current_period_end = $4
            WHERE id = $5`,
          [intent.plan_id, intent.currency, periodStart, periodEnd, existingSub.rows[0].id]
        )
      } else {
        await client.query(
          `INSERT INTO user_subscriptions
             (user_id, plan_id, status, payment_method, currency,
              current_period_start, current_period_end)
           VALUES ($1, $2, 'active', 'paypal', $3, $4, $5)`,
          [intent.user_id, intent.plan_id, intent.currency, periodStart, periodEnd]
        )
      }

      await client.query('COMMIT')
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {})
      logger.error('[paypal] Credit transaction failed:', { error: txErr })
      return NextResponse.json({ error: 'Failed to activate subscription' }, { status: 500 })
    } finally {
      client.release()
    }

    logger.info('[paypal] Payment credited', {
      userId: ctx.userId,
      orderId,
      planId: intent.plan_id,
    })

    return NextResponse.json({
      ok: true,
      status: 'COMPLETED',
      planId: intent.plan_id,
      amount: capturedAmount,
      currency: intent.currency,
    })
  }
)
