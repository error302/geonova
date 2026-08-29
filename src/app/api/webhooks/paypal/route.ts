export const dynamic = 'force-dynamic'

/**
 * PayPal Webhook Handler
 *
 * Receives event notifications from PayPal (payment completion, subscription events, disputes).
 * Verifies the webhook signature to prevent spoofing.
 *
 * To activate:
 * 1. Go to PayPal Developer → My Apps & Sandboxes → Webhooks
 * 2. Add this URL: https://metardu.space/api/webhooks/paypal
 * 3. Subscribe to: CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED,
 *    BILLING.SUBSCRIPTION.ACTIVATED, BILLING.SUBSCRIPTION.CANCELLED
 * 4. Set PAYPAL_WEBHOOK_ID in your .env
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayPalService } from '@/lib/payments/paypal'
import { sendTemplatedEmail } from '@/lib/email-templates'
import { db } from '@/lib/db'
import { createVerify, createPublicKey } from 'crypto'
import { crc32 } from 'zlib'
import { logger } from '@/lib/logger'

interface PayPalWebhookEvent {
  event_type: string
  resource?: {
    id?: string
    billing_agreement_id?: string
    supplementary_data?: {
      related_ids?: { order_id?: string }
    }
    amount?: { value?: string; currency_code?: string }
  }
}

interface PaymentIntentRow {
  id: string
  user_id: string
  plan_id: string
  amount: number
  currency: string
  status: string
}

interface PaymentHistoryRow {
  id: string
  user_id: string
  plan_id: string
  status?: string
}

interface UserSubscriptionRow {
  id: string
}

// ── Payment email helpers (fire-and-forget — webhooks must respond fast) ──
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
      logger.warn(`[paypal] ${what} email not sent:`, { error: res.error })
    }
  })
}

// PayPal webhook event types we handle
const HANDLED_EVENTS = new Set([
  'CHECKOUT.ORDER.APPROVED',
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.REFUNDED',
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
])

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const headers = request.headers

    // PayPal webhook verification headers
    const transmissionId = headers.get('paypal-transmission-id')
    const transmissionTime = headers.get('paypal-transmission-time')
    const certUrl = headers.get('paypal-cert-url')
    const authAlgo = headers.get('paypal-auth-algo')
    const transmissionSig = headers.get('paypal-transmission-sig')

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      logger.warn('[PayPal Webhook] Missing verification headers — rejecting')
      return NextResponse.json({ error: 'Missing verification headers' }, { status: 400 })
    }

    // Validate certUrl belongs to PayPal (prevent SSRF attacks)
    const allowedCertHosts = ['api.paypal.com', 'api.sandbox.paypal.com', 'api-m.paypal.com', 'api-m.sandbox.paypal.com']
    try {
      const certUrlObj = new URL(certUrl)
      if (certUrlObj.protocol !== 'https:' || !allowedCertHosts.some(h => certUrlObj.hostname === h || certUrlObj.hostname.endsWith('.' + h))) {
        logger.error(`[PayPal Webhook] Invalid certUrl host: ${certUrlObj.hostname} — rejecting (SSRF protection)`)
        return NextResponse.json({ error: 'Invalid certificate URL' }, { status: 403 })
      }
    } catch {
      logger.error(`[PayPal Webhook] Malformed certUrl: ${certUrl} — rejecting`)
      return NextResponse.json({ error: 'Malformed certificate URL' }, { status: 400 })
    }

    // ─── Webhook signature verification ──────────────────────────────
    // SECURITY (audit H-03, 2026-08-30): verification now FAILS CLOSED.
    // Previously, when PAYPAL_WEBHOOK_ID was unset and PAYPAL_MODE was
    // anything other than exactly "live" (it defaults to sandbox), every
    // webhook was accepted WITHOUT signature verification — one missing env
    // var silently converted this endpoint into an open unauthenticated
    // mutation channel. The webhook ID is now required in every mode.
    const webhookId = process.env.PAYPAL_WEBHOOK_ID

    // SECURITY (audit H-03): reject stale transmissions — replayed webhook
    // bodies older than the freshness window are dropped.
    const transmissionTimeMs = Date.parse(transmissionTime)
    const WEBHOOK_FRESHNESS_MS = 60 * 60 * 1000 // 1 hour
    if (!Number.isFinite(transmissionTimeMs) || Date.now() - transmissionTimeMs > WEBHOOK_FRESHNESS_MS) {
      logger.warn('[PayPal Webhook] Stale or malformed transmission time — rejecting (replay protection)')
      return NextResponse.json({ error: 'Stale transmission' }, { status: 400 })
    }

    if (!webhookId) {
      logger.error('[PayPal Webhook] CRITICAL: PAYPAL_WEBHOOK_ID not set — rejecting all webhooks (fail closed, audit H-03)')
      return NextResponse.json(
        { error: 'PayPal webhook verification not configured. Set PAYPAL_WEBHOOK_ID env var.' },
        { status: 503 }
      )
    }

    try {
      // 1. Compute CRC32 of the raw body
      const expectedCrc = crc32(Buffer.from(body)) >>> 0 // unsigned 32-bit

      // 2. Construct the expected signature string
      const expectedSigString = `${transmissionId}|${transmissionTime}|${webhookId}|${expectedCrc}`

      // 3. Fetch the certificate from PayPal
      const certResponse = await fetch(certUrl)
      if (!certResponse.ok) {
        logger.error(`[PayPal Webhook] Failed to fetch certificate from ${certUrl}: ${certResponse.status}`)
        return NextResponse.json({ error: 'Certificate fetch failed' }, { status: 500 })
      }
      const certPem = await certResponse.text()

      // 4. Verify the signature
      const algorithm = 'sha256'
      const publicKey = createPublicKey(certPem)
      const verifier = createVerify(algorithm)
      verifier.update(expectedSigString)
      verifier.end()

      const isValid = verifier.verify(publicKey, transmissionSig, 'base64')

      if (!isValid) {
        logger.error('[PayPal Webhook] Signature verification FAILED — rejecting webhook')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
      }
    } catch (verifyError: unknown) {
      logger.error(`[PayPal Webhook] Signature verification error: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`)
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 403 })
    }

    let event: PayPalWebhookEvent
    try {
      event = JSON.parse(body) as PayPalWebhookEvent
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const eventType = event.event_type

    if (!HANDLED_EVENTS.has(eventType)) {
      return NextResponse.json({ received: true })
    }

    // ─── Handle CHECKOUT.ORDER.APPROVED ──────────────────────────────
    // SECURITY/FIX (audit H-02, 2026-08-30): this handler used to look up
    // payment_history by orderId — a row that the old create/capture flow
    // never created, so approved orders were never captured or credited.
    // The PayPal create route now writes a pending payment_intents row with
    // provider_id = orderId; this handler finds it, captures server-side,
    // verifies the amount, and credits through the same transactional block
    // as the capture route.
    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      const orderId = event.resource?.id
      if (!orderId) {
        logger.warn('[PayPal Webhook] No order ID in CHECKOUT.ORDER.APPROVED')
        return NextResponse.json({ error: 'Missing order ID' }, { status: 400 })
      }

      const paypal = getPayPalService()
      if (!paypal) {
        logger.error('[PayPal Webhook] PayPal service not available for capture')
        return NextResponse.json({ error: 'PayPal not configured' }, { status: 500 })
      }

      try {
        const { rows: intentRows } = await db.query<PaymentIntentRow>(
          `SELECT id, user_id, plan_id, amount, currency, status
             FROM payment_intents
            WHERE provider_id = $1 AND payment_method = 'paypal'
            LIMIT 1`,
          [orderId]
        )
        const intent = intentRows[0]
        if (!intent || intent.status === 'completed') {
          // Unknown order (not created by our checkout) or already credited.
          return NextResponse.json({ received: true })
        }

        const capture = await paypal.captureOrder(orderId)
        const captureStatus = capture.status?.toLowerCase()
        const captureUnit = capture.purchase_units?.[0]?.payments?.captures?.[0]
        const capturedAmount = Number(captureUnit?.amount?.value ?? NaN)

        if (
          captureStatus === 'completed' &&
          captureUnit?.status?.toLowerCase() === 'completed' &&
          Number.isFinite(capturedAmount) &&
          capturedAmount > 0 &&
          Math.round(capturedAmount) === Math.round(Number(intent.amount))
        ) {
          const client = await db.getClient()
          try {
            await client.query('BEGIN')
            const completeRes = await client.query(
              `UPDATE payment_intents SET status = 'completed', updated_at = NOW()
                WHERE id = $1 AND status <> 'completed'`,
              [intent.id]
            )
            if ((completeRes.rowCount ?? 0) > 0) {
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
                  captureUnit.id ?? orderId,
                  JSON.stringify({ planId: intent.plan_id, paymentIntentId: intent.id, source: 'webhook' }),
                ]
              )

              const { rows: existing } = await client.query<UserSubscriptionRow>(
                'SELECT id FROM user_subscriptions WHERE user_id = $1 LIMIT 1',
                [intent.user_id]
              )
              const now = new Date().toISOString()
              const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

              if (existing.length > 0) {
                await client.query(
                  `UPDATE user_subscriptions
                      SET plan_id = $1, status = 'active', payment_method = 'paypal', currency = $2,
                          current_period_start = $3, current_period_end = $4
                    WHERE id = $5`,
                  [intent.plan_id, intent.currency, now, periodEnd, existing[0].id]
                )
              } else {
                await client.query(
                  `INSERT INTO user_subscriptions
                     (user_id, plan_id, status, payment_method, currency, current_period_start, current_period_end)
                   VALUES ($1, $2, 'active', 'paypal', $3, $4, $5)`,
                  [intent.user_id, intent.plan_id, intent.currency, now, periodEnd]
                )
              }
            }
            await client.query('COMMIT')
          } catch (txErr) {
            await client.query('ROLLBACK').catch(() => {})
            logger.error('[PayPal Webhook] Credit transaction failed:', { error: txErr })
          } finally {
            client.release()
          }
        } else {
          await db.query<never>(
            `UPDATE payment_intents SET status = 'failed', metadata = metadata || $1::jsonb, updated_at = NOW()
              WHERE id = $2`,
            [
              JSON.stringify({
                fraudFlag: 'webhook_capture_unverified',
                captureStatus: capture.status,
                capturedAmount: Number.isFinite(capturedAmount) ? capturedAmount : null,
                expectedAmount: Number(intent.amount),
              }),
              intent.id,
            ]
          )
        }
      } catch (captureErr: unknown) {
        logger.error(`[PayPal Webhook] Capture failed: ${captureErr instanceof Error ? captureErr.message : String(captureErr)}`)
      }
    }

    // ─── Handle PAYMENT.CAPTURE.COMPLETED ────────────────────────────
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const captureId = event.resource?.id
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id

      if (orderId) {
        const { rows: payRows } = await db.query<PaymentHistoryRow>(
          'SELECT id, user_id, plan_id, status FROM payment_history WHERE transaction_id = $1 LIMIT 1',
          [orderId]
        )

        if (payRows.length > 0 && payRows[0].status !== 'completed') {
          await db.query<never>(
            `UPDATE payment_history SET status = 'completed', transaction_id = $1 WHERE id = $2`,
            [captureId, payRows[0].id]
          )
        }

        // Receipt email (fire-and-forget)
        const paidUser = await lookupUser(payRows[0].user_id).catch(() => undefined)
        if (paidUser?.email) {
          const amount = event.resource?.amount
          notify('receipt', sendTemplatedEmail('paymentReceipt', {
            to: paidUser.email,
            name: paidUser.full_name,
            planName: planDisplayName(payRows[0].plan_id),
            amount: Number(amount?.value ?? 0),
            currency: (amount?.currency_code || 'USD').toUpperCase(),
            paidAt: new Date().toISOString(),
            transactionId: captureId || 'N/A',
            paymentMethod: 'PayPal',
          }))
        }
      }
    }

    // ─── Handle PAYMENT.CAPTURE.DENIED / REFUNDED ───────────────────
    if (eventType === 'PAYMENT.CAPTURE.DENIED') {
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id

      if (orderId) {
        const { rows: payRows } = await db.query<PaymentHistoryRow>(
          'SELECT id, user_id FROM payment_history WHERE transaction_id = $1 LIMIT 1',
          [orderId]
        )

        if (payRows.length > 0) {
          await db.query<never>(
            `UPDATE payment_history SET status = 'failed' WHERE id = $1`,
            [payRows[0].id]
          )

          // Payment-failed email (fire-and-forget)
          const failedUser = await lookupUser(payRows[0].user_id).catch(() => undefined)
          if (failedUser?.email) {
            notify('payment-failed', sendTemplatedEmail('paymentFailed', {
              to: failedUser.email,
              name: failedUser.full_name,
              planName: planDisplayName(payRows[0].plan_id),
              amount: 0,
              currency: 'USD',
              failureReason: 'PayPal declined the payment. Please try another payment method.',
            }))
          }
        }
      }
    }

    // Handle refunds separately — 'refunded' is semantically different from 'failed'
    if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id

      if (orderId) {
        const { rows: payRows } = await db.query<PaymentHistoryRow>(
          'SELECT id, user_id FROM payment_history WHERE transaction_id = $1 LIMIT 1',
          [orderId]
        )

        if (payRows.length > 0) {
          await db.query<never>(
            `UPDATE payment_history SET status = 'refunded' WHERE id = $1`,
            [payRows[0].id]
          )
        }
      }
    }

    // ─── Handle BILLING.SUBSCRIPTION.CANCELLED / EXPIRED / SUSPENDED ─
    if (['BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.EXPIRED', 'BILLING.SUBSCRIPTION.SUSPENDED'].includes(eventType)) {
      const subscriptionId = event.resource?.id
      if (subscriptionId) {
        // Look up user by PayPal subscription ID stored in payment_history
        const { rows: payRows } = await db.query<Pick<PaymentHistoryRow, 'user_id'>>(
          `SELECT ph.user_id FROM payment_history ph WHERE ph.transaction_id = $1 LIMIT 1`,
          [subscriptionId]
        )
        if (payRows.length > 0) {
          const newStatus = eventType.includes('CANCELLED') ? 'cancelled' : eventType.includes('EXPIRED') ? 'expired' : 'suspended'
          await db.query<never>(
            `UPDATE user_subscriptions SET status = $1 WHERE user_id = $2`,
            [newStatus, payRows[0].user_id]
          )
        } else {
          // No status change to apply — subscription stays as-is.
        }
      }
    }

    // ─── Handle BILLING.SUBSCRIPTION.ACTIVATED ────────────────────────
    // Recurring subscription approved and activated. Mark the matching
    // payment_history row complete and grant the plan (auto-charges now live).
    if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const subscriptionId = event.resource?.id
      if (subscriptionId) {
        const { rows: payRows } = await db.query<PaymentHistoryRow>(
          'SELECT id, user_id, plan_id FROM payment_history WHERE transaction_id = $1 LIMIT 1',
          [subscriptionId]
        )
        if (payRows.length > 0) {
          const pay = payRows[0]
          await db.query<never>(
            `UPDATE payment_history SET status = 'completed' WHERE id = $1`,
            [pay.id]
          )
          const { rows: existing } = await db.query<UserSubscriptionRow>(
            'SELECT id FROM user_subscriptions WHERE user_id = $1 LIMIT 1',
            [pay.user_id]
          )
          const now = new Date().toISOString()
          const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          if (existing.length > 0) {
            await db.query<never>(
              `UPDATE user_subscriptions
               SET plan_id = $1, status = 'active', payment_method = 'paypal',
                   current_period_start = $2, current_period_end = $3
               WHERE id = $4`,
              [pay.plan_id, now, periodEnd, existing[0].id]
            )
          } else {
            await db.query<never>(
              `INSERT INTO user_subscriptions
               (user_id, plan_id, status, payment_method, currency, current_period_start, current_period_end)
               VALUES ($1, $2, 'active', 'paypal', 'USD', $3, $4)`,
              [pay.user_id, pay.plan_id, now, periodEnd]
            )
          }
        } else {
          logger.warn(`[PayPal Webhook] No payment_history record found for subscription ${subscriptionId}`)
        }
      }
    }

    // ─── Handle PAYMENT.SALE.COMPLETED (recurring renewal charge) ─────
    // Fired on every successful auto-charge. Extend the subscription period.
    if (eventType === 'PAYMENT.SALE.COMPLETED') {
      const subscriptionId = event.resource?.billing_agreement_id
      if (subscriptionId) {
        const { rows: payRows } = await db.query<Pick<PaymentHistoryRow, 'user_id'>>(
          `SELECT ph.user_id FROM payment_history ph WHERE ph.transaction_id = $1 LIMIT 1`,
          [subscriptionId]
        )
        if (payRows.length > 0) {
          await db.query<never>(
            `UPDATE user_subscriptions
             SET status = 'active',
                 current_period_start = NOW(),
                 current_period_end = NOW() + INTERVAL '30 days'
             WHERE user_id = $1`,
            [payRows[0].user_id]
          )
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: unknown) {
    logger.error('[PayPal Webhook] Error:', { error: (error as Error).message })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// PayPal webhooks need GET for verification during setup
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'PayPal webhook endpoint active. Configure at PayPal Developer Dashboard.',
  })
}
