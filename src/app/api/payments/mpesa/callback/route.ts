export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import db from '@/lib/db'
import { getMpesaService } from '@/lib/payments/mpesa'
import { getPlan } from '@/lib/subscription/catalog'
import { sendEmail } from '@/lib/email'
import { paymentReceiptEmail } from '@/lib/email-templates/paymentReceipt'
import { logger } from '@/lib/logger'

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

// Safaricom IP whitelist for M-Pesa callbacks.
// AUDIT FIX (HIGH 5, 2026-07-02): configurable via MPESA_CALLBACK_IP_WHITELIST.
//
// SECURITY (audit C-05, 2026-08-30): the client IP is now derived from the
// RIGHTMOST X-Forwarded-For hop (the one appended by our own reverse proxy)
// or CF-Connecting-IP when present. The previous code trusted
// x-forwarded-for.split(',')[0] — the FIRST entry — which is fully
// client-controlled behind an appending proxy, so any caller could spoof a
// Safaricom source IP and forge a callback.
const DEFAULT_SAFARICOM_IPS = [
  '196.201.214.200', '196.201.214.206', '196.201.213.114',
  '196.201.214.207', '196.201.214.208', '196.201.213.44',
  '196.201.212.127', '196.201.212.138', '196.201.212.129',
  '196.201.212.136', '196.201.212.74', '196.201.212.69',
]

function getSafaricomIPs(): string[] {
  const envList = process.env.MPESA_CALLBACK_IP_WHITELIST
  if (envList) {
    return envList.split(',').map(ip => ip.trim()).filter(Boolean)
  }
  return DEFAULT_SAFARICOM_IPS
}

/**
 * Derive the real client IP (audit C-05).
 *
 * Behind Caddy (an *appending* reverse proxy) the FIRST X-Forwarded-For entry
 * is attacker-supplied; the LAST entry is the hop our own proxy observed.
 * When Cloudflare fronts the site, CF-Connecting-IP is authoritative.
 * Direct connections (no XFF) fall back to the socket address.
 */
function realClientIp(req: NextRequest): string | null {
  const cfIp = req.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const hops = xff.split(',').map(h => h.trim()).filter(Boolean)
    if (hops.length > 0) return hops[hops.length - 1]
  }

  return req.headers.get('x-real-ip')?.trim() ?? null
}

function isSafaricomIP(req: NextRequest): boolean {
  const whitelist = getSafaricomIPs()
  const clientIp = realClientIp(req)
  return clientIp ? whitelist.includes(clientIp) : false
}

/**
 * M-Pesa STK Push callback handler.
 *
 * SECURITY (audit C-05 + H-01, 2026-08-30):
 *   - Client IP derived from the last trusted proxy hop (see realClientIp),
 *     not the spoofable first XFF entry.
 *   - The amount check FAILS CLOSED: a callback without CallbackMetadata
 *     (paidAmount 0) can no longer complete an intent. Previously the
 *     mismatch check was skipped entirely when the metadata was absent.
 *   - planId comes from the payment intent row only; the planId URL query
 *     parameter is no longer trusted.
 *   - Intent completion + payment_history insert + subscription activation
 *     run inside one transaction, gated by a conditional UPDATE whose
 *     rowCount proves this callback instance won the race (idempotent under
 *     Safaricom retries). The ON CONFLICT (provider_id) target is backed by
 *     the unique partial index created in migration 055 — previously the
 *     insert raised 42P10 and paying customers never got their plan.
 */
export async function POST(request: NextRequest) {
  // 1. Reject requests not from Safaricom IPs
  if (!isSafaricomIP(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const mpesa = getMpesaService()
  if (!mpesa) {
    return NextResponse.json({ error: 'M-Pesa not configured' }, { status: 500 })
  }

  // 2. Parse callback payload
  const payload = (await request.json().catch(() => null)) as Record<
    string,
    Record<string, unknown>
  > | null
  const stk = payload?.Body?.stkCallback as Record<string, unknown> | undefined
  const checkoutRequestId = stk?.CheckoutRequestID as string | undefined
  const resultCode = stk?.ResultCode as number | undefined

  if (!checkoutRequestId) {
    return NextResponse.json({ error: 'Missing CheckoutRequestID' }, { status: 400 })
  }

  // 3. Look up the payment intent by CheckoutRequestID (primary). The
  //    paymentId query parameter remains as a legacy fallback, but the plan
  //    is ALWAYS taken from the intent row — never from the URL.
  const paymentIdParam = request.nextUrl.searchParams.get('paymentId') || ''

  let paymentRow: PaymentIntentRow | null = null

  const byCheckout = await db.query<PaymentIntentRow>(
    `SELECT id, user_id, plan_id, amount, currency, status
     FROM payment_intents
     WHERE checkout_request_id = $1 AND payment_method = 'mpesa'`,
    [checkoutRequestId]
  )
  paymentRow = byCheckout.rows[0] ?? null

  if (!paymentRow && paymentIdParam && z.string().uuid().safeParse(paymentIdParam).success) {
    const result = await db.query<PaymentIntentRow>(
      `SELECT id, user_id, plan_id, amount, currency, status
       FROM payment_intents
       WHERE id = $1 AND payment_method = 'mpesa'`,
      [paymentIdParam]
    )
    paymentRow = result.rows[0] ?? null
  }

  if (!paymentRow) {
    return NextResponse.json({ error: 'Payment intent not found' }, { status: 404 })
  }

  // Already completed — idempotent response
  if (paymentRow.status === 'completed') {
    return NextResponse.json({ ok: true })
  }

  // 4. Plan comes from the intent row ONLY (audit C-05)
  const planId = paymentRow.plan_id as 'free' | 'pro' | 'team' | 'firm' | 'enterprise'

  // 5. Handle failure result code
  if (typeof resultCode === 'number' && resultCode !== 0) {
    await db.query<never>(
      `UPDATE payment_intents
       SET status = 'failed', provider_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [checkoutRequestId, paymentRow.id]
    )
    return NextResponse.json({ ok: true })
  }

  // 6. Parse callback metadata to get the ACTUAL paid amount + receipt number
  const parsed = mpesa.parseCallback(payload as Record<string, unknown>)
  const paidAmount = parsed?.amount ?? 0
  const receiptNumber = parsed?.transactionId ?? checkoutRequestId

  // 7. Verify the paid amount matches the expected price — FAIL CLOSED
  //    (audit C-05). A callback that arrives without CallbackMetadata has
  //    paidAmount 0 and is rejected outright; previously the check was
  //    skipped whenever paidAmount was falsy, which allowed forged
  //    "success" callbacks carrying no metadata at all.
  const plan = getPlan(planId)
  const expectedAmount = plan?.prices?.KES ?? Number(paymentRow.amount) ?? 0
  if (
    !Number.isFinite(paidAmount) ||
    paidAmount <= 0 ||
    !Number.isFinite(expectedAmount) ||
    expectedAmount <= 0 ||
    Math.round(paidAmount) !== Math.round(expectedAmount)
  ) {
    logger.warn(
      `[mpesa] Amount verification failed: paid ${paidAmount} KES, expected ${expectedAmount} KES for plan ${planId} (intent ${paymentRow.id})`
    )
    await db.query<never>(
      `UPDATE payment_intents
       SET status = 'failed', provider_id = $1,
           metadata = metadata || $2::jsonb, updated_at = NOW()
       WHERE id = $3`,
      [
        checkoutRequestId,
        JSON.stringify({
          fraudFlag: paidAmount <= 0 ? 'missing_callback_metadata' : 'amount_mismatch',
          paidAmount,
          expectedAmount,
        }),
        paymentRow.id,
      ]
    )
    return NextResponse.json({ ok: true, error: 'Amount verification failed' })
  }

  // 8-10. Complete the intent, write the audit row and activate the
  //       subscription inside ONE transaction, gated by a conditional UPDATE
  //       so concurrent retries cannot double-credit (audit H-01).
  const client = await db.getClient()
  let activated = false
  try {
    await client.query('BEGIN')

    // Conditional completion: rowCount 0 means another callback instance
    // already completed (or concurrently completes) this intent.
    const completeRes = await client.query(
      `UPDATE payment_intents
       SET status = 'completed', provider_id = $1, updated_at = NOW()
       WHERE id = $2 AND status <> 'completed'`,
      [checkoutRequestId, paymentRow.id]
    )
    if ((completeRes.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ ok: true })
    }

    // Audit trail row (unique partial index from migration 055 backs the
    // ON CONFLICT target; DO NOTHING keeps Safaricom retries idempotent).
    await client.query(
      `INSERT INTO payment_history
         (user_id, amount, currency, payment_method, provider, provider_id,
          status, transaction_id, metadata)
       VALUES ($1, $2, $3, 'mpesa', 'safaricom', $4, 'completed', $5, $6)
       ON CONFLICT (provider_id) DO NOTHING`,
      [
        paymentRow.user_id,
        paidAmount,
        paymentRow.currency,
        checkoutRequestId,
        receiptNumber,
        JSON.stringify({ planId, paymentIntentId: paymentRow.id }),
      ]
    )

    const existingSub = await client.query<SubscriptionRow>(
      'SELECT id FROM user_subscriptions WHERE user_id = $1',
      [paymentRow.user_id]
    )

    const periodStart = new Date().toISOString()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    if (existingSub.rows.length > 0) {
      await client.query(
        `UPDATE user_subscriptions
         SET plan_id = $1, status = 'active', payment_method = 'mpesa',
             currency = 'KES', current_period_start = $2, current_period_end = $3
         WHERE id = $4`,
        [planId, periodStart, periodEnd, existingSub.rows[0].id]
      )
    } else {
      await client.query(
        `INSERT INTO user_subscriptions
           (user_id, plan_id, status, payment_method, currency,
            current_period_start, current_period_end)
         VALUES ($1, $2, 'active', 'mpesa', 'KES', $3, $4)`,
        [paymentRow.user_id, planId, periodStart, periodEnd]
      )
    }

    await client.query('COMMIT')
    activated = true
  } catch (txErr) {
    await client.query('ROLLBACK').catch(() => {})
    logger.error('[mpesa-callback] Transaction failed:', { error: txErr })
    return NextResponse.json({ error: 'Callback processing failed' }, { status: 500 })
  } finally {
    client.release()
  }

  // 11. Send automated branded HTML email receipt (outside the transaction —
  //     a mail failure must never roll back a completed payment)
  if (activated) {
    try {
      const userRes = await db.query<{ email: string; name?: string }>(
        'SELECT email, name FROM users WHERE id = $1',
        [paymentRow.user_id]
      )
      const user = userRes.rows[0]
      if (user?.email) {
        const plan = getPlan(planId)
        const planName = plan?.name ? `${plan.name} Plan` : 'Pro Plan'
        const receipt = paymentReceiptEmail.render({
          to: user.email,
          name: user.name || 'Surveyor',
          planName,
          amount: paidAmount,
          currency: 'KES',
          paidAt: new Date().toISOString(),
          transactionId: receiptNumber || checkoutRequestId,
          paymentMethod: 'M-Pesa STK Push (Till 3370347)',
        })

        await sendEmail({
          to: user.email,
          subject: receipt.subject,
          html: receipt.html,
          text: receipt.text,
        })
      }
    } catch (emailErr) {
      logger.warn('[mpesa-callback] Failed to send email receipt:', { error: emailErr })
    }
  }

  return NextResponse.json({ ok: true })
}
