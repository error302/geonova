import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripeService } from '@/lib/payments/stripe'
import { getPayPalService } from '@/lib/payments/paypal'
import { getMpesaService } from '@/lib/payments/mpesa'
import { createClient } from '@/lib/supabase/server'
import type { CurrencyCode, PlanId } from '@/lib/subscription/catalog'
import { getPlan } from '@/lib/subscription/catalog'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const schema = z.object({
      provider: z.enum(['stripe', 'paypal', 'mpesa']),
      action: z.string(),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const { provider, action } = parsed.data
    const params = (body ?? {}) as Record<string, any>

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const requireUser = () => {
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      return null
    }

    const getPlanPricing = (planId: string, currency: string) => {
      const plan = getPlan(planId)
      if (!plan) {
        return { ok: false as const, response: NextResponse.json({ error: 'Unknown plan' }, { status: 400 }) }
      }
      const c = currency as CurrencyCode
      const amount = plan.prices[c]
      if (amount === undefined) {
        return { ok: false as const, response: NextResponse.json({ error: 'Unsupported currency' }, { status: 400 }) }
      }
      return { ok: true as const, plan, currency: c, amount }
    }

    const activateSubscription = async (input: {
      planId: PlanId
      payment_method: string
      currency: CurrencyCode
      amount: number
      transaction_id?: string
      status: 'completed' | 'failed'
      paymentId?: string
    }) => {
      if (!user) return

      if (input.status === 'completed') {
        // Upsert-style: replace existing subscription row for this user.
        const { data: existing } = await supabase
          .from('user_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        const payload = {
          user_id: user.id,
          plan_id: input.planId,
          status: 'active',
          payment_method: input.payment_method,
          currency: input.currency,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }

        if (existing?.id) {
          await supabase.from('user_subscriptions').update(payload).eq('id', existing.id)
        } else {
          await supabase.from('user_subscriptions').insert(payload)
        }
      }

      if (input.paymentId) {
        await supabase
          .from('payment_history')
          .update({
            status: input.status,
            transaction_id: input.transaction_id ?? null,
          })
          .eq('id', input.paymentId)
          .eq('user_id', user.id)
      }
    }

    // Unified subscription checkout entrypoint (server validates amount from plan).
    if (action === 'start-subscription') {
      const authResp = requireUser()
      if (authResp) return authResp

      const startSchema = z.object({
        planId: z.enum(['free', 'pro', 'team']),
        currency: z.string().min(3).max(3),
        email: z.string().email().optional(),
        phoneNumber: z.string().optional(),
        country: z.string().optional(),
      })
      const start = startSchema.safeParse(params)
      if (!start.success) {
        return NextResponse.json({ error: 'Invalid request.', issues: start.error.issues }, { status: 400 })
      }

      const { planId, currency } = start.data
      const priced = getPlanPricing(planId, currency)
      if (!priced.ok) return priced.response

      // Free plan: activate immediately.
      if (priced.amount <= 0) {
        await activateSubscription({
          planId,
          payment_method: 'free',
          currency: priced.currency,
          amount: 0,
          status: 'completed',
        })
        return NextResponse.json({ kind: 'activated', planId })
      }

      // Create payment history row first (links provider callbacks to a user safely).
      const { data: paymentRow, error: payErr } = await supabase
        .from('payment_history')
        .insert({
          user_id: user!.id,
          amount: priced.amount,
          currency: priced.currency,
          status: 'pending',
          payment_method: provider,
          plan_id: planId,
        })
        .select('id')
        .single()

      if (payErr || !paymentRow?.id) {
        return NextResponse.json({ error: payErr?.message || 'Failed to create payment record' }, { status: 500 })
      }

      const paymentId = paymentRow.id as string
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      if (provider === 'stripe') {
        const stripe = getStripeService()
        if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

        const session = await stripe.createCheckoutSession({
          mode: 'payment',
          amount: priced.amount,
          currency: priced.currency,
          name: `GeoNova ${priced.plan.name}`,
          successUrl: `${appUrl}/subscription/success?provider=stripe&paymentId=${paymentId}&planId=${planId}&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${appUrl}/subscription/cancel?provider=stripe&paymentId=${paymentId}&planId=${planId}`,
          metadata: {
            payment_id: paymentId,
            user_id: user!.id,
            plan_id: planId,
            currency: priced.currency,
          },
        })

        await supabase.from('payment_history').update({ transaction_id: session.id }).eq('id', paymentId)

        return NextResponse.json({ kind: 'redirect', provider: 'stripe', url: session.url, paymentId })
      }

      if (provider === 'paypal') {
        const paypal = getPayPalService()
        if (!paypal) return NextResponse.json({ error: 'PayPal not configured' }, { status: 500 })

        const order = await paypal.createOrder({
          amount: priced.amount,
          currency: priced.currency,
          description: `GeoNova ${priced.plan.name} subscription`,
          returnUrl: `${appUrl}/subscription/success?provider=paypal&paymentId=${paymentId}&planId=${planId}`,
          cancelUrl: `${appUrl}/subscription/cancel?provider=paypal&paymentId=${paymentId}&planId=${planId}`,
        })

        const approval = order.links?.find((l) => l.rel === 'approve')?.href
        if (!approval) {
          return NextResponse.json({ error: 'PayPal did not return approval link' }, { status: 500 })
        }

        await supabase.from('payment_history').update({ transaction_id: order.id }).eq('id', paymentId)

        return NextResponse.json({ kind: 'redirect', provider: 'paypal', url: approval, paymentId })
      }

      if (provider === 'mpesa') {
        const mpesa = getMpesaService()
        if (!mpesa) return NextResponse.json({ error: 'M-Pesa not configured' }, { status: 500 })

        if (priced.currency !== 'KES') {
          return NextResponse.json({ error: 'M-Pesa payments must be in KES.' }, { status: 400 })
        }

        if (!start.data.phoneNumber) {
          return NextResponse.json({ error: 'Phone number required for M-Pesa.' }, { status: 400 })
        }

        const callbackUrl = `${appUrl}/api/payments/mpesa/callback?paymentId=${paymentId}&planId=${planId}`
        const result = await mpesa.initiateSTKPush({
          phoneNumber: start.data.phoneNumber,
          amount: priced.amount,
          reference: paymentId,
          description: `GeoNova ${priced.plan.name} subscription`,
          callbackUrl,
        })

        await supabase.from('payment_history').update({ transaction_id: result.checkoutRequestId }).eq('id', paymentId)

        return NextResponse.json({
          kind: 'mpesa',
          provider: 'mpesa',
          paymentId,
          checkoutRequestId: result.checkoutRequestId,
        })
      }

      return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
    }

    switch (provider) {
      case 'stripe': {
        const stripe = getStripeService()
        if (!stripe) {
          return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
        }

        switch (action) {
          case 'confirm-session': {
            const authResp = requireUser()
            if (authResp) return authResp

            const s = z.object({ sessionId: z.string().min(1), paymentId: z.string().uuid(), planId: z.enum(['free','pro','team']) }).safeParse(params)
            if (!s.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

            const { data: pay } = await supabase
              .from('payment_history')
              .select('id, plan_id, currency, amount, transaction_id, status')
              .eq('id', s.data.paymentId)
              .eq('user_id', user!.id)
              .maybeSingle()

            if (!pay) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })
            if (pay.plan_id !== s.data.planId) return NextResponse.json({ error: 'Plan mismatch.' }, { status: 400 })
            if (pay.transaction_id && pay.transaction_id !== s.data.sessionId) {
              return NextResponse.json({ error: 'Transaction mismatch.' }, { status: 400 })
            }
            if (pay.status === 'completed') return NextResponse.json({ status: 'completed' })
            if (pay.status === 'failed') return NextResponse.json({ status: 'failed' })

            const session = await stripe.getCheckoutSession(s.data.sessionId)
            if (session.paymentStatus !== 'paid') {
              return NextResponse.json({ status: 'pending' })
            }

            if (String(pay.currency || '').toUpperCase() !== String(session.currency || '').toUpperCase()) {
              await activateSubscription({
                planId: s.data.planId,
                payment_method: 'stripe',
                currency: (pay.currency as CurrencyCode) || 'USD',
                amount: Number(pay.amount) || 0,
                transaction_id: session.id,
                status: 'failed',
                paymentId: s.data.paymentId,
              })
              return NextResponse.json({ status: 'failed' })
            }

            if (Number(pay.amount) !== Number(session.amountTotal)) {
              await activateSubscription({
                planId: s.data.planId,
                payment_method: 'stripe',
                currency: (pay.currency as CurrencyCode) || 'USD',
                amount: Number(pay.amount) || 0,
                transaction_id: session.id,
                status: 'failed',
                paymentId: s.data.paymentId,
              })
              return NextResponse.json({ status: 'failed' })
            }

            await activateSubscription({
              planId: s.data.planId,
              payment_method: 'stripe',
              currency: session.currency as CurrencyCode,
              amount: session.amountTotal,
              transaction_id: session.id,
              status: 'completed',
              paymentId: s.data.paymentId,
            })

            return NextResponse.json({ status: 'completed' })
          }

          default:
            return NextResponse.json({ error: 'Unknown stripe action' }, { status: 400 })
        }
      }

      case 'paypal': {
        const paypal = getPayPalService()
        if (!paypal) {
          return NextResponse.json({ error: 'PayPal not configured' }, { status: 500 })
        }

        switch (action) {
          case 'capture-order': {
            const authResp = requireUser()
            if (authResp) return authResp

            const s = z.object({ orderId: z.string().min(1), paymentId: z.string().uuid(), planId: z.enum(['free','pro','team']) }).safeParse(params)
            if (!s.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

            const { data: pay } = await supabase
              .from('payment_history')
              .select('id, plan_id, currency, amount, transaction_id, status')
              .eq('id', s.data.paymentId)
              .eq('user_id', user!.id)
              .maybeSingle()

            if (!pay) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })
            if (pay.plan_id !== s.data.planId) return NextResponse.json({ error: 'Plan mismatch.' }, { status: 400 })
            if (pay.transaction_id && pay.transaction_id !== s.data.orderId) {
              return NextResponse.json({ error: 'Transaction mismatch.' }, { status: 400 })
            }
            if (pay.status === 'completed') return NextResponse.json({ status: 'completed' })
            if (pay.status === 'failed') return NextResponse.json({ status: 'failed' })

            const capture = await paypal.captureOrder(s.data.orderId)
            const status = capture.status?.toLowerCase() === 'completed' ? 'completed' : 'failed'

            if (status !== 'completed') {
              await activateSubscription({
                planId: s.data.planId,
                payment_method: 'paypal',
                currency: 'USD',
                amount: 0,
                transaction_id: s.data.orderId,
                status: 'failed',
                paymentId: s.data.paymentId,
              })
              return NextResponse.json({ status: 'failed' })
            }

            const amountStr =
              (capture as any).purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value ?? '0'
            const currencyCode =
              (capture as any).purchase_units?.[0]?.payments?.captures?.[0]?.amount?.currency_code ?? 'USD'

            if (String(pay.currency || '').toUpperCase() !== String(currencyCode || '').toUpperCase()) {
              await activateSubscription({
                planId: s.data.planId,
                payment_method: 'paypal',
                currency: (pay.currency as CurrencyCode) || 'USD',
                amount: Number(pay.amount) || 0,
                transaction_id: s.data.orderId,
                status: 'failed',
                paymentId: s.data.paymentId,
              })
              return NextResponse.json({ status: 'failed' })
            }

            if (Number(pay.amount) !== Number(amountStr)) {
              await activateSubscription({
                planId: s.data.planId,
                payment_method: 'paypal',
                currency: (pay.currency as CurrencyCode) || 'USD',
                amount: Number(pay.amount) || 0,
                transaction_id: s.data.orderId,
                status: 'failed',
                paymentId: s.data.paymentId,
              })
              return NextResponse.json({ status: 'failed' })
            }

            await activateSubscription({
              planId: s.data.planId,
              payment_method: 'paypal',
              currency: currencyCode as CurrencyCode,
              amount: Number(amountStr),
              transaction_id: s.data.orderId,
              status: 'completed',
              paymentId: s.data.paymentId,
            })

            return NextResponse.json({ status: 'completed' })
          }

          default:
            return NextResponse.json({ error: 'Unknown paypal action' }, { status: 400 })
        }
      }

      case 'mpesa': {
        const mpesa = getMpesaService()
        if (!mpesa) {
          return NextResponse.json({ error: 'M-Pesa not configured' }, { status: 500 })
        }

        switch (action) {
          case 'check-status': {
            const authResp = requireUser()
            if (authResp) return authResp

            const s = z.object({ paymentId: z.string().uuid(), checkoutRequestId: z.string().min(1) }).safeParse(params)
            if (!s.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

            const { data: pay } = await supabase
              .from('payment_history')
              .select('id, plan_id, currency, amount, status')
              .eq('id', s.data.paymentId)
              .eq('user_id', user!.id)
              .maybeSingle()

            if (!pay) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })
            if (pay.status === 'completed') return NextResponse.json({ status: 'completed' })
            if (pay.status === 'failed') return NextResponse.json({ status: 'failed' })

            const result = await mpesa.checkTransactionStatus(s.data.checkoutRequestId)
            const status = result.status === 'completed' ? 'completed' : 'pending'

            if (status === 'completed') {
              await activateSubscription({
                planId: (pay.plan_id as PlanId) || 'pro',
                payment_method: 'mpesa',
                currency: (pay.currency as CurrencyCode) || 'KES',
                amount: Number(pay.amount) || 0,
                transaction_id: s.data.checkoutRequestId,
                status: 'completed',
                paymentId: s.data.paymentId,
              })
            }

            return NextResponse.json({ status })
          }

          default:
            return NextResponse.json({ error: 'Unknown mpesa action' }, { status: 400 })
        }
      }

      default:
        return NextResponse.json({ error: 'Unknown payment provider' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Payment failed' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    providers: {
      stripe: !!process.env.STRIPE_SECRET_KEY,
      paypal: !!process.env.PAYPAL_CLIENT_ID,
      mpesa: !!process.env.MPESA_CONSUMER_KEY,
      airtel: !!process.env.AIRTEL_CLIENT_ID
    },
    currencies: ['USD', 'KES', 'UGX', 'TZ', 'EUR', 'GBP'],
    paymentMethods: [
      { id: 'card', name: 'Credit/Debit Card', providers: ['stripe', 'paypal'] },
      { id: 'mpesa', name: 'M-Pesa', providers: ['mpesa'] },
      { id: 'airtel_money', name: 'Airtel Money', providers: ['airtel'] },
      { id: 'paypal', name: 'PayPal', providers: ['paypal'] }
    ]
  })
}
