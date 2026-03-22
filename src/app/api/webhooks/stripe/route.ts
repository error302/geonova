import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeService } from '@/lib/payments/stripe'
import type { CurrencyCode } from '@/lib/subscription/catalog'

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

  const isValid = stripe.verifyWebhookSignature(payload, signature)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  let event: any
  try {
    event = JSON.parse(payload)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const supabase = await createClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const paymentId = session.metadata?.payment_id
      const userId = session.metadata?.user_id
      const planId = session.metadata?.plan_id

      if (!paymentId || !userId || !planId) {
        console.error('Stripe webhook: missing metadata in checkout.session.completed')
        break
      }

      const now = new Date()
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      const { data: existing } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      const payload = {
        user_id: userId,
        plan_id: planId,
        status: 'active',
        payment_method: 'stripe',
        currency: (session.currency || 'USD').toUpperCase() as CurrencyCode,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      }

      if (existing?.id) {
        await supabase.from('user_subscriptions').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('user_subscriptions').insert(payload)
      }

      await supabase
        .from('payment_history')
        .update({
          status: 'completed',
          transaction_id: session.id,
        })
        .eq('id', paymentId)
        .eq('user_id', userId)

      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object
      const customerId = sub.customer
      const status = sub.status
      const planId = sub.metadata?.plan_id || 'free'

      const { data: user } = await supabase
        .from('user_subscriptions')
        .select('user_id')
        .eq('user_id', sub.metadata?.user_id || '')
        .maybeSingle()

      if (user) {
        await supabase
          .from('user_subscriptions')
          .update({ status: status === 'active' ? 'active' : status === 'past_due' ? 'active' : 'cancelled' })
          .eq('user_id', user.user_id)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const userId = sub.metadata?.user_id

      if (userId) {
        await supabase
          .from('user_subscriptions')
          .update({ status: 'cancelled' })
          .eq('user_id', userId)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object
      const customerId = invoice.customer

      const { data: userSub } = await supabase
        .from('user_subscriptions')
        .select('user_id')
        .eq('user_id', invoice.metadata?.user_id || '')
        .maybeSingle()

      if (userSub) {
        await supabase
          .from('user_subscriptions')
          .update({ status: 'expired' })
          .eq('user_id', userSub.user_id)
      }
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
