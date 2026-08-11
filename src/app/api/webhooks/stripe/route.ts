export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getStripeService } from '@/lib/payments/stripe'
import { sendTemplatedEmail } from '@/lib/email-templates'

interface StripeWebhookEvent {
  type: string
  data: {
    object: {
      id?: string
      metadata?: Record<string, string | undefined>
      customer?: string
      status?: string
      currency?: string
      payment_intent?: string
      amount_total?: number
      amount_paid?: number
      amount_due?: number
      next_payment_attempt?: number
      last_payment_error?: { message?: string }
    }
  }
}

interface UserSubscriptionRow {
  id: string
  user_id: string
}

export async function POST(request: NextRequest) {
  const stripe = getStripeService()
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: StripeWebhookEvent
  try {
    if (!stripe.verifyWebhookSignature(payload, signature)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
    }
    event = JSON.parse(payload) as StripeWebhookEvent
  } catch (err: unknown) {
    logger.error('Stripe webhook verification failed:', { message: (err as Error).message })
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  const db = (await import('@/lib/db')).default

  // ── Payment email helpers (fire-and-forget — webhooks must respond fast,
  // Stripe retries on slow responses) ────────────────────────────────────────
  async function lookupUser(userId: string): Promise<{ email: string; full_name: string } | undefined> {
    const { rows } = await db.query<{ email: string; full_name: string }>(
      'SELECT email, full_name FROM users WHERE id = $1 LIMIT 1',
      [userId]
    )
    return rows[0]
  }

  function planDisplayName(planId: string): string {
    const names: Record<string, string> = { pro: 'Pro', enterprise: 'Enterprise', basic: 'Basic' }
    return names[planId] || planId
  }

  function notify(what: string, send: Promise<{ success: boolean; error?: string }>) {
    void send.then((res) => {
      if (!res.success && res.error !== 'Email service not configured') {
        logger.warn(`[stripe] ${what} email not sent:`, { error: res.error })
      }
    })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const paymentId = session.metadata?.payment_id
      const userId = session.metadata?.user_id
      const planId = session.metadata?.plan_id

      if (session.metadata?.type === 'peer_review') {
        const reviewReqId = session.metadata.review_request_id
        if (reviewReqId) {
          await db.query<never>(
            'UPDATE peer_reviews SET payment_status = $1, stripe_payment_intent_id = $2 WHERE id = $3',
            ['paid', session.payment_intent, reviewReqId]
          )
        }
        break
      }

      if (!paymentId || !userId || !planId) {
        logger.error('Stripe webhook: missing metadata in checkout.session.completed')
        break
      }

      const now = new Date()
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      const currency = (session.currency || 'USD').toUpperCase()

      await db.query<never>(
        `INSERT INTO user_subscriptions (user_id, plan_id, status, payment_method, currency, current_period_start, current_period_end)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id) DO UPDATE SET
           plan_id = EXCLUDED.plan_id, status = EXCLUDED.status, payment_method = EXCLUDED.payment_method,
           currency = EXCLUDED.currency, current_period_start = EXCLUDED.current_period_start,
           current_period_end = EXCLUDED.current_period_end`,
        [userId, planId, 'active', 'stripe', currency, now.toISOString(), periodEnd.toISOString()]
      ).catch(async () => {
        // Fallback: upsert may fail if no unique constraint on user_id
        const { rows: existingRows2 } = await db.query<Pick<UserSubscriptionRow, 'id'>>(
          'SELECT id FROM user_subscriptions WHERE user_id = $1 LIMIT 1',
          [userId]
        )
        const existing2 = existingRows2[0]
        if (existing2?.id) {
          await db.query<never>(
            `UPDATE user_subscriptions
             SET plan_id = $1, status = $2, payment_method = $3, currency = $4, current_period_start = $5, current_period_end = $6
             WHERE id = $7`,
            [planId, 'active', 'stripe', currency, now.toISOString(), periodEnd.toISOString(), existing2.id]
          )
        } else {
          await db.query<never>(
            `INSERT INTO user_subscriptions (user_id, plan_id, status, payment_method, currency, current_period_start, current_period_end)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, planId, 'active', 'stripe', currency, now.toISOString(), periodEnd.toISOString()]
          )
        }
      })

      await db.query<never>(
        'UPDATE payment_history SET status = $1, transaction_id = $2 WHERE id = $3 AND user_id = $4',
        ['completed', session.id, paymentId, userId]
      )

      // Receipt email for the new subscription (fire-and-forget)
      const receiptUser = await lookupUser(userId).catch(() => undefined)
      if (receiptUser?.email) {
        notify('receipt', sendTemplatedEmail('paymentReceipt', {
          to: receiptUser.email,
          name: receiptUser.full_name,
          planName: planDisplayName(planId),
          amount: (session.amount_total ?? 0) / 100,
          currency,
          paidAt: now.toISOString(),
          transactionId: session.payment_intent || session.id || 'N/A',
          paymentMethod: 'Stripe card',
        }))
      }

      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object
      const customerId = sub.customer
      const status = sub.status

      const { rows: userRows } = await db.query<Pick<UserSubscriptionRow, 'user_id'>>(
        'SELECT user_id FROM user_subscriptions WHERE user_id = $1 LIMIT 1',
        [sub.metadata?.user_id || '']
      )
      const user = userRows[0]

      if (user) {
        const newStatus = status === 'active' ? 'active' : status === 'past_due' ? 'past_due' : 'cancelled'
        // AUDIT FIX (MED 13, 2026-07-02): Also store stripe IDs for sync
        await db.query<never>(
          'UPDATE user_subscriptions SET status = $1, stripe_customer_id = $2, stripe_subscription_id = $3 WHERE user_id = $4',
          [newStatus, customerId, sub.id, user.user_id]
        )
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const userId = sub.metadata?.user_id

      if (userId) {
        await db.query<never>(
          'UPDATE user_subscriptions SET status = $1, cancelled_at = NOW(), stripe_subscription_id = $2 WHERE user_id = $3',
          ['cancelled', sub.id, userId]
        )
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object

      const { rows: userSubRows } = await db.query<Pick<UserSubscriptionRow, 'user_id'>>(
        'SELECT user_id FROM user_subscriptions WHERE user_id = $1 LIMIT 1',
        [invoice.metadata?.user_id || '']
      )
      const userSub = userSubRows[0]

      if (userSub) {
        await db.query<never>(
          'UPDATE user_subscriptions SET status = $1 WHERE user_id = $2',
          ['expired', userSub.user_id]
        )

        // Payment-failed email (fire-and-forget)
        const failedUser = await lookupUser(userSub.user_id).catch(() => undefined)
        if (failedUser?.email) {
          notify('payment-failed', sendTemplatedEmail('paymentFailed', {
            to: failedUser.email,
            name: failedUser.full_name,
            planName: planDisplayName(invoice.metadata?.plan_id || 'pro'),
            amount: (invoice.amount_due ?? 0) / 100,
            currency: (invoice.currency || 'USD').toUpperCase(),
            failureReason: invoice.last_payment_error?.message || 'Your payment method was declined.',
            ...(invoice.next_payment_attempt
              ? { retryAt: new Date(invoice.next_payment_attempt * 1000).toISOString() }
              : {}),
          }))
        }
      }
      break
    }

    // AUDIT FIX (HIGH 11, 2026-07-02): Add missing webhook events.

    case 'checkout.session.expired': {
      // Session expired without payment — mark as expired
      const session = event.data.object
      const paymentId = session.metadata?.payment_id
      if (paymentId) {
        await db.query<never>(
          'UPDATE payment_history SET status = $1 WHERE id = $2 AND status = $3',
          ['expired', paymentId, 'pending']
        )
      }
      break
    }

    case 'charge.refunded': {
      // Refund processed — update payment_history + cancel subscription
      const charge = event.data.object
      const paymentIntentId = charge.payment_intent
      if (paymentIntentId) {
        await db.query<never>(
          'UPDATE payment_history SET status = $1 WHERE transaction_id = $2',
          ['refunded', paymentIntentId]
        )
        // If this was a subscription payment, cancel it
        const userId = charge.metadata?.user_id
        if (userId) {
          await db.query<never>(
            "UPDATE user_subscriptions SET status = $1 WHERE user_id = $2 AND status = 'active'",
            ['cancelled', userId]
          )
        }
      }
      break
    }

    case 'invoice.paid': {
      // Recurring invoice paid — extend subscription period
      const invoice = event.data.object
      const userId = invoice.metadata?.user_id
      if (userId) {
        const now = new Date()
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        await db.query<never>(
          `UPDATE user_subscriptions
           SET status = 'active', current_period_start = $1, current_period_end = $2
           WHERE user_id = $3`,
          [now.toISOString(), periodEnd.toISOString(), userId]
        )

        // Renewal receipt email (fire-and-forget)
        const paidUser = await lookupUser(userId).catch(() => undefined)
        if (paidUser?.email) {
          notify('receipt', sendTemplatedEmail('paymentReceipt', {
            to: paidUser.email,
            name: paidUser.full_name,
            planName: planDisplayName(invoice.metadata?.plan_id || 'pro'),
            amount: (invoice.amount_paid ?? 0) / 100,
            currency: (invoice.currency || 'USD').toUpperCase(),
            paidAt: now.toISOString(),
            transactionId: invoice.payment_intent || invoice.id || 'N/A',
            paymentMethod: 'Stripe card',
          }))
        }
      }
      break
    }

    case 'payment_intent.payment_failed': {
      // Card payment failed — log for debugging
      const intent = event.data.object
      logger.warn(`[stripe] Payment failed: ${intent.id} — ${intent.last_payment_error?.message || 'unknown'}`)
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
