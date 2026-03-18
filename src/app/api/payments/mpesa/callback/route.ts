import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { getMpesaService } from '@/lib/payments/mpesa'
import { getPlan } from '@/lib/subscription/catalog'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabaseAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin not configured' }, { status: 500 })
  }

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

  const payload = await request.json().catch(() => null) as any
  const stk = payload?.Body?.stkCallback
  const checkoutRequestId = stk?.CheckoutRequestID as string | undefined
  const resultCode = stk?.ResultCode as number | undefined

  if (!checkoutRequestId) {
    return NextResponse.json({ error: 'Missing CheckoutRequestID' }, { status: 400 })
  }

  const { data: paymentRow, error: payErr } = await supabaseAdmin
    .from('payment_history')
    .select('id, user_id, plan_id, currency, amount, status')
    .eq('id', qp.data.paymentId)
    .maybeSingle()

  if (payErr || !paymentRow) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  if (paymentRow.status === 'completed') {
    return NextResponse.json({ ok: true })
  }

  if (paymentRow.plan_id !== qp.data.planId) {
    return NextResponse.json({ error: 'Plan mismatch' }, { status: 400 })
  }

  // Fail fast on non-zero result code.
  if (typeof resultCode === 'number' && resultCode !== 0) {
    await supabaseAdmin
      .from('payment_history')
      .update({ status: 'failed', transaction_id: checkoutRequestId })
      .eq('id', paymentRow.id)

    return NextResponse.json({ ok: true })
  }

  // Verify with a server-side status query before activating.
  const status = await mpesa.checkTransactionStatus(checkoutRequestId)
  if (status.status !== 'completed') {
    return NextResponse.json({ ok: true })
  }

  const plan = getPlan(qp.data.planId)
  const expected = plan?.prices?.KES ?? Number(paymentRow.amount) ?? 0
  const paid = Number(paymentRow.amount) ?? 0
  if (Number.isFinite(expected) && expected > 0 && Math.round(paid) !== Math.round(expected)) {
    await supabaseAdmin
      .from('payment_history')
      .update({ status: 'failed', transaction_id: checkoutRequestId })
      .eq('id', paymentRow.id)
    return NextResponse.json({ ok: true })
  }

  await supabaseAdmin
    .from('payment_history')
    .update({ status: 'completed', transaction_id: checkoutRequestId })
    .eq('id', paymentRow.id)

  // Upsert-style update of the user's subscription.
  const { data: existing } = await supabaseAdmin
    .from('user_subscriptions')
    .select('id')
    .eq('user_id', paymentRow.user_id)
    .maybeSingle()

  const subscriptionPayload = {
    user_id: paymentRow.user_id,
    plan_id: qp.data.planId,
    status: 'active',
    payment_method: 'mpesa',
    currency: 'KES',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }

  if (existing?.id) {
    await supabaseAdmin.from('user_subscriptions').update(subscriptionPayload).eq('id', existing.id)
  } else {
    await supabaseAdmin.from('user_subscriptions').insert(subscriptionPayload)
  }

  return NextResponse.json({ ok: true })
}

