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
import { db } from '@/lib/db'
import type { PlanId, CurrencyCode } from '@/lib/subscription/catalog'
import { createVerify, createPublicKey } from 'crypto'
import { crc32 } from 'zlib'

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
      console.warn('[PayPal Webhook] Missing verification headers — rejecting')
      return NextResponse.json({ error: 'Missing verification headers' }, { status: 400 })
    }

    // Validate certUrl belongs to PayPal (prevent SSRF attacks)
    const allowedCertHosts = ['api.paypal.com', 'api.sandbox.paypal.com', 'api-m.paypal.com', 'api-m.sandbox.paypal.com']
    try {
      const certUrlObj = new URL(certUrl)
      if (certUrlObj.protocol !== 'https:' || !allowedCertHosts.some(h => certUrlObj.hostname === h || certUrlObj.hostname.endsWith('.' + h))) {
        console.error(`[PayPal Webhook] Invalid certUrl host: ${certUrlObj.hostname} — rejecting (SSRF protection)`)
        return NextResponse.json({ error: 'Invalid certificate URL' }, { status: 403 })
      }
    } catch {
      console.error(`[PayPal Webhook] Malformed certUrl: ${certUrl} — rejecting`)
      return NextResponse.json({ error: 'Malformed certificate URL' }, { status: 400 })
    }

    // ─── Webhook signature verification ──────────────────────────────
    // AUDIT FIX (CRITICAL 4, 2026-07-02): Security hardening.
    //   - PAYPAL_WEBHOOK_ID is now REQUIRED in production (fail-fast)
    //   - Sandbox bypass removed — even in sandbox, signature must verify
    //     if webhook_id is set. If webhook_id is not set AND we're in
    //     production, reject. If not set AND sandbox, allow with warning.
    const webhookId = process.env.PAYPAL_WEBHOOK_ID
    const isProduction = (process.env.PAYPAL_MODE || 'sandbox') === 'live'

    if (!webhookId) {
      if (isProduction) {
        console.error('[PayPal Webhook] CRITICAL: PAYPAL_WEBHOOK_ID not set in production — rejecting all webhooks')
        return NextResponse.json(
          { error: 'PayPal webhook verification not configured. Set PAYPAL_WEBHOOK_ID env var.' },
          { status: 503 }
        )
      } else {
        console.warn('[PayPal Webhook] PAYPAL_WEBHOOK_ID not set in sandbox — skipping signature verification (development only)')
      }
    } else {
      try {
        // 1. Compute CRC32 of the raw body
        const expectedCrc = crc32(Buffer.from(body)) >>> 0 // unsigned 32-bit

        // 2. Construct the expected signature string
        const expectedSigString = `${transmissionId}|${transmissionTime}|${webhookId}|${expectedCrc}`

        // 3. Fetch the certificate from PayPal
        const certResponse = await fetch(certUrl)
        if (!certResponse.ok) {
          console.error(`[PayPal Webhook] Failed to fetch certificate from ${certUrl}: ${certResponse.status}`)
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
          // AUDIT FIX (CRITICAL 4): No sandbox bypass — reject always
          console.error('[PayPal Webhook] Signature verification FAILED — rejecting webhook')
          return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
        }
      } catch (verifyError: any) {
        console.error(`[PayPal Webhook] Signature verification error: ${verifyError.message}`)
        // AUDIT FIX (CRITICAL 4): No sandbox bypass — reject always
        return NextResponse.json({ error: 'Signature verification failed' }, { status: 403 })
      }
    }

    let event: any
    try {
      event = JSON.parse(body)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const eventType = event.event_type

    if (!HANDLED_EVENTS.has(eventType)) {
      return NextResponse.json({ received: true })
    }

    // ─── Handle CHECKOUT.ORDER.APPROVED ──────────────────────────────
    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      const orderId = event.resource?.id
      if (!orderId) {
        console.warn('[PayPal Webhook] No order ID in CHECKOUT.ORDER.APPROVED')
        return NextResponse.json({ error: 'Missing order ID' }, { status: 400 })
      }

      // Auto-capture the approved order
      const paypal = getPayPalService()
      if (!paypal) {
        console.error('[PayPal Webhook] PayPal service not available for capture')
        return NextResponse.json({ error: 'PayPal not configured' }, { status: 500 })
      }

      try {
        const capture = await paypal.captureOrder(orderId)
        const captureStatus = (capture as any).status?.toLowerCase()

        if (captureStatus === 'completed') {
          const captureAmount = (capture as any).purchase_units?.[0]?.payments?.captures?.[0]?.amount
          const amount = Number(captureAmount?.value ?? 0)
          const currencyCode = (captureAmount?.currency_code ?? 'USD') as CurrencyCode

          // Try to find matching payment_history record by transaction_id
          const { rows: payRows } = await db.query(
            'SELECT id, user_id, plan_id FROM payment_history WHERE transaction_id = $1 LIMIT 1',
            [orderId]
          )

          if (payRows.length > 0) {
            const pay = payRows[0]
            await db.query(
              `UPDATE payment_history SET status = 'completed', transaction_id = $1 WHERE id = $2`,
              [orderId, pay.id]
            )

            // Activate subscription
            const { rows: existing } = await db.query(
              'SELECT id FROM user_subscriptions WHERE user_id = $1 LIMIT 1',
              [pay.user_id]
            )
            const now = new Date().toISOString()
            const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

            if (existing.length > 0) {
              await db.query(
                `UPDATE user_subscriptions
                 SET plan_id = $1, status = 'active', payment_method = 'paypal', currency = $2,
                     current_period_start = $3, current_period_end = $4
                 WHERE id = $5`,
                [pay.plan_id, currencyCode, now, periodEnd, existing[0].id]
              )
            } else {
              await db.query(
                `INSERT INTO user_subscriptions
                 (user_id, plan_id, status, payment_method, currency, current_period_start, current_period_end)
                 VALUES ($1, $2, 'active', 'paypal', $3, $4, $5)`,
                [pay.user_id, pay.plan_id, currencyCode, now, periodEnd]
              )
            }

          } else {
            console.warn(`[PayPal Webhook] No payment_history record found for order ${orderId}`)
          }
        }
      } catch (captureErr: any) {
        console.error(`[PayPal Webhook] Capture failed: ${captureErr.message}`)
      }
    }

    // ─── Handle PAYMENT.CAPTURE.COMPLETED ────────────────────────────
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const captureId = event.resource?.id
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id
      const amount = event.resource?.amount?.value
      const currencyCode = event.resource?.amount?.currency_code

      if (orderId) {
        const { rows: payRows } = await db.query(
          'SELECT id, user_id, plan_id, status FROM payment_history WHERE transaction_id = $1 LIMIT 1',
          [orderId]
        )

        if (payRows.length > 0 && payRows[0].status !== 'completed') {
          await db.query(
            `UPDATE payment_history SET status = 'completed', transaction_id = $1 WHERE id = $2`,
            [captureId, payRows[0].id]
          )
        }
      }
    }

    // ─── Handle PAYMENT.CAPTURE.DENIED / REFUNDED ───────────────────
    if (eventType === 'PAYMENT.CAPTURE.DENIED') {
      const captureId = event.resource?.id
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id

      if (orderId) {
        const { rows: payRows } = await db.query(
          'SELECT id, user_id FROM payment_history WHERE transaction_id = $1 LIMIT 1',
          [orderId]
        )

        if (payRows.length > 0) {
          await db.query(
            `UPDATE payment_history SET status = 'failed' WHERE id = $1`,
            [payRows[0].id]
          )
        }
      }
    }

    // Handle refunds separately — 'refunded' is semantically different from 'failed'
    if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      const captureId = event.resource?.id
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id

      if (orderId) {
        const { rows: payRows } = await db.query(
          'SELECT id, user_id FROM payment_history WHERE transaction_id = $1 LIMIT 1',
          [orderId]
        )

        if (payRows.length > 0) {
          await db.query(
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
        const { rows: payRows } = await db.query(
          `SELECT ph.user_id FROM payment_history ph WHERE ph.transaction_id = $1 LIMIT 1`,
          [subscriptionId]
        )
        if (payRows.length > 0) {
          const newStatus = eventType.includes('CANCELLED') ? 'cancelled' : eventType.includes('EXPIRED') ? 'expired' : 'suspended'
          await db.query(
            `UPDATE user_subscriptions SET status = $1 WHERE user_id = $2`,
            [newStatus, payRows[0].user_id]
          )
        } else {
          // No status change to apply — subscription stays as-is.
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: unknown) {
    console.error('[PayPal Webhook] Error:', (error as Error).message)
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
