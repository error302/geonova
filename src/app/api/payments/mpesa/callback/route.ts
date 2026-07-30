export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import db from '@/lib/db'
import { getMpesaService } from '@/lib/payments/mpesa'
import { getPlan } from '@/lib/subscription/catalog'

// Safaricom IP whitelist for M-Pesa callbacks.
// AUDIT FIX (HIGH 5, 2026-07-02): Now configurable via env var
// MPESA_CALLBACK_IP_WHITELIST (comma-separated). Falls back to the
// hardcoded list below for backward compatibility. Update the env var
// when Safaricom adds new IPs — no code deploy needed.
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

function isSafaricomIP(req: NextRequest): boolean {
  const whitelist = getSafaricomIPs()
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
  return clientIp ? whitelist.includes(clientIp) : false
}

/**
 * M-Pesa STK Push callback handler.
 *
 * AUDIT FIX (C4, 2026-07-02):
 *   - Was reading from payment_history (wrong table) — now reads from
 *     payment_intents (where initiate/route.ts writes)
 *   - Was trying to UPDATE transaction_id column that didn't exist —
 *     migration 026 added it
 *   - Was comparing expected vs expected for amount verification — now
 *     extracts actual paid amount from CallbackMetadata via parseCallback
 *     and verifies it matches the expected plan price
 *   - Was failing on missing paymentId/planId query params — now falls
 *     back to looking up by CheckoutRequestID in payment_intents
 *   - Now writes a historical record to payment_history on success
 *   - Now uses parameterised status values (lowercase) matching the
 *     payment_intents CHECK constraint
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

  // 3. Look up the payment intent. Try URL query params first (paymentId),
  //    fall back to CheckoutRequestID lookup (in case Safaricom strips
  //    query params — they shouldn't, but defensive).
  const paymentIdParam = request.nextUrl.searchParams.get('paymentId') || ''
  const planIdParam = request.nextUrl.searchParams.get('planId') || ''

  let paymentRow: { id: string; user_id: string; plan_id: string; amount: number; currency: string; status: string } | null = null

  if (paymentIdParam && z.string().uuid().safeParse(paymentIdParam).success) {
    const result = await db.query(
      `SELECT id, user_id, plan_id, amount, currency, status
       FROM payment_intents
       WHERE id = $1 AND payment_method = 'mpesa'`,
      [paymentIdParam]
    )
    paymentRow = result.rows[0] ?? null
  }

  if (!paymentRow) {
    // Fallback: look up by CheckoutRequestID
    const result = await db.query(
      `SELECT id, user_id, plan_id, amount, currency, status
       FROM payment_intents
       WHERE checkout_request_id = $1 AND payment_method = 'mpesa'`,
      [checkoutRequestId]
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

  // 4. Determine planId — prefer URL param (validated), fall back to row
  const planId =
    // AUDIT FIX (HIGH 7, 2026-07-02): Include 'firm' and 'enterprise'
    planIdParam && ['free', 'pro', 'team', 'firm', 'enterprise'].includes(planIdParam)
      ? (planIdParam as 'free' | 'pro' | 'team' | 'firm' | 'enterprise')
      : (paymentRow.plan_id as 'free' | 'pro' | 'team' | 'firm' | 'enterprise')

  // 5. Handle failure result code
  if (typeof resultCode === 'number' && resultCode !== 0) {
    await db.query(
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

  // 7. Verify the paid amount matches the expected plan price.
  //    This is the critical fraud-prevention check that was previously
  //    comparing expected vs expected (both from the DB row).
  const plan = getPlan(planId)
  const expectedAmount = plan?.prices?.KES ?? Number(paymentRow.amount) ?? 0
  if (
    Number.isFinite(expectedAmount) &&
    expectedAmount > 0 &&
    Number.isFinite(paidAmount) &&
    paidAmount > 0 &&
    Math.round(paidAmount) !== Math.round(expectedAmount)
  ) {
    console.warn(
      `[mpesa] Amount mismatch: paid ${paidAmount} KES, expected ${expectedAmount} KES for plan ${planId}`
    )
    await db.query(
      `UPDATE payment_intents
       SET status = 'failed', provider_id = $1,
           metadata = metadata || $2::jsonb, updated_at = NOW()
       WHERE id = $3`,
      [
        checkoutRequestId,
        JSON.stringify({
          fraudFlag: 'amount_mismatch',
          paidAmount,
          expectedAmount,
        }),
        paymentRow.id,
      ]
    )
    return NextResponse.json({ ok: true, error: 'Amount mismatch' })
  }

  // 8. Mark payment intent as completed
  await db.query(
    `UPDATE payment_intents
     SET status = 'completed', provider_id = $1, updated_at = NOW()
     WHERE id = $2`,
    [checkoutRequestId, paymentRow.id]
  )

  // 9. Write historical record to payment_history (audit trail)
  // ByteByteGo audit fix: idempotent INSERT — use ON CONFLICT to prevent
  // duplicate rows when Safaricom retries the callback. The provider_id
  // (CheckoutRequestID) is unique per transaction.
  await db.query(
    `INSERT INTO payment_history
       (user_id, amount, currency, payment_method, provider, provider_id,
        status, transaction_id, metadata)
     VALUES ($1, $2, $3, 'mpesa', 'safaricom', $4, 'completed', $5, $6)
     ON CONFLICT (provider_id) DO NOTHING`,
    [
      paymentRow.user_id,
      paidAmount || paymentRow.amount,
      paymentRow.currency,
      checkoutRequestId,
      receiptNumber,
      JSON.stringify({ planId, paymentIntentId: paymentRow.id }),
    ]
  )

  // 10. Activate or upgrade the user's subscription
  const existingSub = await db.query(
    'SELECT id FROM user_subscriptions WHERE user_id = $1',
    [paymentRow.user_id]
  )

  const periodStart = new Date().toISOString()
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  if (existingSub.rows.length > 0) {
    await db.query(
      `UPDATE user_subscriptions
       SET plan_id = $1, status = 'active', payment_method = 'mpesa',
           currency = 'KES', current_period_start = $2, current_period_end = $3
       WHERE id = $4`,
      [planId, periodStart, periodEnd, existingSub.rows[0].id]
    )
  } else {
    await db.query(
      `INSERT INTO user_subscriptions
         (user_id, plan_id, status, payment_method, currency,
          current_period_start, current_period_end)
       VALUES ($1, $2, 'active', 'mpesa', 'KES', $3, $4)`,
      [paymentRow.user_id, planId, periodStart, periodEnd]
    )
  }

  return NextResponse.json({ ok: true })
}
