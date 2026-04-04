import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import db from '@/lib/db'
import { getMpesaService } from '@/lib/payments/mpesa'
import { getPlan } from '@/lib/subscription/catalog'

export async function POST(request: NextRequest) {
  const mpesa = getMpesaService()
  if (!mpesa) {
    return NextResponse.json({ error: 'M-Pesa not configured' }, { status: 500 })
  }

  const paymentId = request.nextUrl.searchParams.get('paymentId') || ''
  const planId = request.nextUrl.searchParams.get('planId') || ''

  const qp = z
    .object({
      paymentId: z.string().uuid(),
      planId: z.enum(['free', 'pro', 'team']),
    })
    .safeParse({ paymentId, planId })
  if (!qp.success) {
    return NextResponse.json({ error: 'Invalid callback parameters' }, { status: 400 })
  }

  const payload = await request.json().catch(() => null) as Record<string, Record<string, unknown>> | null
  const stk = payload?.Body?.stkCallback as Record<string, unknown> | undefined
  const checkoutRequestId = stk?.CheckoutRequestID as string | undefined
  const resultCode = stk?.ResultCode as number | undefined

  if (!checkoutRequestId) {
    return NextResponse.json({ error: 'Missing CheckoutRequestID' }, { status: 400 })
  }

  const paymentResult = await db.query(
    'SELECT id, user_id, plan_id, currency, amount, status FROM payment_history WHERE id = $1',
    [qp.data.paymentId]
  )

  const paymentRow = paymentResult.rows[0]

  if (!paymentRow) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  if (paymentRow.status === 'completed') {
    return NextResponse.json({ ok: true })
  }

  if (paymentRow.plan_id !== qp.data.planId) {
    return NextResponse.json({ error: 'Plan mismatch' }, { status: 400 })
  }

  if (typeof resultCode === 'number' && resultCode !== 0) {
    await db.query(
      "UPDATE payment_history SET status = 'failed', transaction_id = $1 WHERE id = $2",
      [checkoutRequestId, paymentRow.id]
    )
    return NextResponse.json({ ok: true })
  }

  const status = await mpesa.checkTransactionStatus(checkoutRequestId)
  if (status.status !== 'completed') {
    return NextResponse.json({ ok: true })
  }

  const plan = getPlan(qp.data.planId)
  const expected = plan?.prices?.KES ?? Number(paymentRow.amount) ?? 0
  const paid = Number(paymentRow.amount) ?? 0
  if (Number.isFinite(expected) && expected > 0 && Math.round(paid) !== Math.round(expected)) {
    await db.query(
      "UPDATE payment_history SET status = 'failed', transaction_id = $1 WHERE id = $2",
      [checkoutRequestId, paymentRow.id]
    )
    return NextResponse.json({ ok: true })
  }

  await db.query(
    "UPDATE payment_history SET status = 'completed', transaction_id = $1 WHERE id = $2",
    [checkoutRequestId, paymentRow.id]
  )

  const existingSub = await db.query(
    'SELECT id FROM user_subscriptions WHERE user_id = $1',
    [paymentRow.user_id]
  )

  const subscriptionPayload = {
    user_id: paymentRow.user_id,
    plan_id: qp.data.planId,
    status: 'active',
    payment_method: 'mpesa',
    currency: 'KES',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }

  if (existingSub.rows.length > 0) {
    await db.query(
      `UPDATE user_subscriptions SET 
       plan_id = $1, status = $2, payment_method = $3, currency = $4,
       current_period_start = $5, current_period_end = $6
       WHERE id = $7`,
      [subscriptionPayload.plan_id, subscriptionPayload.status, subscriptionPayload.payment_method,
       subscriptionPayload.currency, subscriptionPayload.current_period_start, 
       subscriptionPayload.current_period_end, existingSub.rows[0].id]
    )
  } else {
    await db.query(
      `INSERT INTO user_subscriptions 
       (user_id, plan_id, status, payment_method, currency, current_period_start, current_period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [subscriptionPayload.user_id, subscriptionPayload.plan_id, subscriptionPayload.status,
       subscriptionPayload.payment_method, subscriptionPayload.currency,
       subscriptionPayload.current_period_start, subscriptionPayload.current_period_end]
    )
  }

  return NextResponse.json({ ok: true })
}
