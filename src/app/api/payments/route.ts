export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPublicAppUrl } from '@/lib/site'
import { getStripeService } from '@/lib/payments/stripe'
import { getPayPalService } from '@/lib/payments/paypal'
import { getMpesaService } from '@/lib/payments/mpesa'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import type { CurrencyCode, PlanId } from '@/lib/subscription/catalog'
import { getPlan } from '@/lib/subscription/catalog'

// ─── Row types ────────────────────────────────────────────────────────────
interface SubscriptionRow {
  id: string
}

interface PaymentHistoryRow {
  id: string
  plan_id: string | null
  currency: string | null
  amount: number | null
  transaction_id: string | null
  status: string | null
}

// PayPal capture response — library types don't expose purchase_units
interface PayPalCapture {
  status?: string
  purchase_units?: {
    payments?: {
      captures?: {
        amount?: { value?: string; currency_code?: string }
      }[]
    }
  }[]
}

export const POST = apiHandler({ auth: true, rateLimit: { max: 10, windowMs: 60000 } }, async (req, ctx) => {
  const body = ctx.body as Record<string, unknown>
  const schema = z.object({
    provider: z.enum(['stripe', 'paypal', 'mpesa']),
    action: z.string(),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { provider, action } = parsed.data
  const params = body
  const userId = ctx.userId

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
    if (input.status === 'completed') {
      const { rows: existing } = await db.query<SubscriptionRow>(
        'SELECT id FROM user_subscriptions WHERE user_id = $1 LIMIT 1',
        [userId]
      )
      const now = new Date().toISOString()
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

      if (existing.length > 0) {
        await db.query<never>(
          `UPDATE user_subscriptions
           SET plan_id = $1, status = 'active', payment_method = $2, currency = $3,
               current_period_start = $4, current_period_end = $5
           WHERE id = $6`,
          [input.planId, input.payment_method, input.currency, now, periodEnd, existing[0].id]
        )
      } else {
        await db.query<never>(
          `INSERT INTO user_subscriptions
           (user_id, plan_id, status, payment_method, currency, current_period_start, current_period_end)
           VALUES ($1, $2, 'active', $3, $4, $5, $6)`,
          [userId, input.planId, input.payment_method, input.currency, now, periodEnd]
        )
      }
    }

    if (input.paymentId) {
      await db.query<never>(
        `UPDATE payment_history SET status = $1, transaction_id = $2 WHERE id = $3 AND user_id = $4`,
        [input.status, input.transaction_id ?? null, input.paymentId, userId]
      )
    }
  }

  // ─── Unified subscription checkout ──────────────────────────────────────
  if (action === 'start-subscription') {
    const startSchema = z.object({
      planId: z.enum(['free', 'pro', 'team', 'firm', 'enterprise']),
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

    if (priced.amount <= 0) {
      await activateSubscription({ planId, payment_method: 'free', currency: priced.currency, amount: 0, status: 'completed' })
      return NextResponse.json({ kind: 'activated', planId })
    }

    const { rows } = await db.query<Pick<PaymentHistoryRow, 'id'>>(
      `INSERT INTO payment_history (user_id, amount, currency, status, payment_method, plan_id)
       VALUES ($1, $2, $3, 'pending', $4, $5) RETURNING id`,
      [userId, priced.amount, priced.currency, provider, planId]
    )
    if (!rows[0]?.id) throw new Error('No ID returned from payment_history insert')
    const paymentId = rows[0].id as string

    const appUrl = getPublicAppUrl()

    if (provider === 'stripe') {
      const stripe = getStripeService()
      if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

      const stripeSession = await stripe.createCheckoutSession({
        mode: 'payment',
        amount: priced.amount,
        currency: priced.currency,
        name: `METARDU ${priced.plan.name}`,
        successUrl: `${appUrl}/subscription/success?provider=stripe&paymentId=${paymentId}&planId=${planId}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${appUrl}/subscription/cancel?provider=stripe&paymentId=${paymentId}&planId=${planId}`,
        metadata: { payment_id: paymentId, user_id: userId, plan_id: planId, currency: priced.currency },
      })

      if (!stripeSession?.id || !stripeSession?.url) {
        return NextResponse.json({ error: 'Stripe returned an invalid session' }, { status: 502 })
      }

      await db.query<never>(
        'UPDATE payment_history SET transaction_id = $1 WHERE id = $2 AND user_id = $3',
        [stripeSession.id, paymentId, userId]
      )
      return NextResponse.json({ kind: 'redirect', provider: 'stripe', url: stripeSession.url, paymentId })
    }

    if (provider === 'paypal') {
      const paypal = getPayPalService()
      if (!paypal) return NextResponse.json({ error: 'PayPal not configured' }, { status: 500 })

      // PayPal only supports ~25 currencies (USD, EUR, GBP, etc.) — NOT KES, UGX, TZS, NGN, GHS, INR, IDR, BRL.
      // When the local currency is unsupported, convert to USD using the plan catalog.
      const PAYPAL_UNSUPPORTED = new Set(['KES', 'UGX', 'TZS', 'NGN', 'GHS', 'INR', 'IDR', 'BRL'])
      const paypalCurrency: CurrencyCode = PAYPAL_UNSUPPORTED.has(priced.currency) ? 'USD' : priced.currency
      const paypalAmount = priced.plan.prices[paypalCurrency]
      if (paypalAmount === undefined || paypalAmount <= 0) {
        return NextResponse.json({ error: `PayPal pricing not available for ${paypalCurrency}` }, { status: 400 })
      }

      // Update the payment_history record to reflect the PayPal currency/amount
      if (paypalCurrency !== priced.currency) {
        await db.query<never>(
          'UPDATE payment_history SET amount = $1, currency = $2 WHERE id = $3 AND user_id = $4',
          [paypalAmount, paypalCurrency, paymentId, userId]
        )
      }

      const order = await paypal.createOrder({
        amount: paypalAmount,
        currency: paypalCurrency,
        description: `METARDU ${priced.plan.name} subscription`,
        returnUrl: `${appUrl}/subscription/success?provider=paypal&paymentId=${paymentId}&planId=${planId}`,
        cancelUrl: `${appUrl}/subscription/cancel?provider=paypal&paymentId=${paymentId}&planId=${planId}`,
      })

      if (!order?.id) {
        return NextResponse.json({ error: 'PayPal returned an invalid order' }, { status: 502 })
      }

      const approval = order.links?.find((l) => l.rel === 'approve')?.href
      if (!approval) return NextResponse.json({ error: 'PayPal did not return approval link' }, { status: 502 })

      await db.query<never>(
        'UPDATE payment_history SET transaction_id = $1 WHERE id = $2 AND user_id = $3',
        [order.id, paymentId, userId]
      )
      return NextResponse.json({ kind: 'redirect', provider: 'paypal', url: approval, paymentId })
    }

    if (provider === 'mpesa') {
      const mpesa = getMpesaService()
      if (!mpesa) return NextResponse.json({ error: 'M-Pesa not configured' }, { status: 500 })
      if (priced.currency !== 'KES') return NextResponse.json({ error: 'M-Pesa payments must be in KES.' }, { status: 400 })
      if (!start.data.phoneNumber) return NextResponse.json({ error: 'Phone number required for M-Pesa.' }, { status: 400 })

      const callbackUrl = `${appUrl}/api/payments/mpesa/callback?paymentId=${paymentId}&planId=${planId}`
      const result = await mpesa.initiateSTKPush({
        phoneNumber: start.data.phoneNumber,
        amount: priced.amount,
        reference: paymentId,
        description: `METARDU ${priced.plan.name} subscription`,
        callbackUrl,
      })

      if (!result?.checkoutRequestId) {
        return NextResponse.json({ error: 'M-Pesa returned an invalid response' }, { status: 502 })
      }

      await db.query<never>(
        'UPDATE payment_history SET transaction_id = $1 WHERE id = $2 AND user_id = $3',
        [result.checkoutRequestId, paymentId, userId]
      )
      return NextResponse.json({ kind: 'mpesa', provider: 'mpesa', paymentId, checkoutRequestId: result.checkoutRequestId })
    }

    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  // ─── Provider action switches ────────────────────────────────────────────
  switch (provider) {
    case 'stripe': {
      const stripe = getStripeService()
      if (!stripe) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

      switch (action) {
        case 'confirm-session': {
          const s = z.object({
            sessionId: z.string().min(1),
            paymentId: z.string().uuid(),
            planId: z.enum(['free', 'pro', 'team', 'firm', 'enterprise']),
          }).safeParse(params)
          if (!s.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

          const { rows: payRows } = await db.query<PaymentHistoryRow>(
            'SELECT id, plan_id, currency, amount, transaction_id, status FROM payment_history WHERE id = $1 AND user_id = $2 LIMIT 1',
            [s.data.paymentId, userId]
          )
          const pay = payRows[0] ?? null
          if (!pay) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })
          if (pay.plan_id !== s.data.planId) return NextResponse.json({ error: 'Plan mismatch.' }, { status: 400 })
          if (pay.transaction_id && pay.transaction_id !== s.data.sessionId) return NextResponse.json({ error: 'Transaction mismatch.' }, { status: 400 })
          if (pay.status === 'completed') return NextResponse.json({ status: 'completed' })
          if (pay.status === 'failed') return NextResponse.json({ status: 'failed' })

          const stripeSession = await stripe.getCheckoutSession(s.data.sessionId)

          if (!stripeSession?.paymentStatus || !stripeSession?.currency) {
            return NextResponse.json({ error: 'Stripe returned invalid session data' }, { status: 502 })
          }

          if (stripeSession.paymentStatus !== 'paid') return NextResponse.json({ status: 'pending' })

          if (String(pay.currency ?? '').toUpperCase() !== String(stripeSession.currency).toUpperCase() ||
              Number(pay.amount) !== Number(stripeSession.amountTotal ?? 0)) {
            await activateSubscription({ planId: s.data.planId, payment_method: 'stripe', currency: (pay.currency as CurrencyCode) || 'USD', amount: Number(pay.amount) || 0, transaction_id: stripeSession.id, status: 'failed', paymentId: s.data.paymentId })
            return NextResponse.json({ status: 'failed' })
          }

          await activateSubscription({ planId: s.data.planId, payment_method: 'stripe', currency: stripeSession.currency as CurrencyCode, amount: Number(stripeSession.amountTotal ?? 0), transaction_id: stripeSession.id, status: 'completed', paymentId: s.data.paymentId })
          return NextResponse.json({ status: 'completed' })
        }
        default:
          return NextResponse.json({ error: 'Unknown stripe action' }, { status: 400 })
      }
    }

    case 'paypal': {
      const paypal = getPayPalService()
      if (!paypal) return NextResponse.json({ error: 'PayPal not configured' }, { status: 500 })

      switch (action) {
        case 'capture-order': {
          const s = z.object({
            orderId: z.string().min(1),
            paymentId: z.string().uuid(),
            planId: z.enum(['free', 'pro', 'team', 'firm', 'enterprise']),
          }).safeParse(params)
          if (!s.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

          const { rows: payRows } = await db.query<PaymentHistoryRow>(
            'SELECT id, plan_id, currency, amount, transaction_id, status FROM payment_history WHERE id = $1 AND user_id = $2 LIMIT 1',
            [s.data.paymentId, userId]
          )
          const pay = payRows[0] ?? null
          if (!pay) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })
          if (pay.plan_id !== s.data.planId) return NextResponse.json({ error: 'Plan mismatch.' }, { status: 400 })
          if (pay.transaction_id && pay.transaction_id !== s.data.orderId) return NextResponse.json({ error: 'Transaction mismatch.' }, { status: 400 })
          if (pay.status === 'completed') return NextResponse.json({ status: 'completed' })
          if (pay.status === 'failed') return NextResponse.json({ status: 'failed' })

          // AUDIT FIX (HIGH 8, 2026-07-02): Handle ORDER_ALREADY_CAPTURED
          // gracefully. The PayPal webhook may auto-capture before the
          // success page calls this endpoint. Previously the error was
          // unhandled and marked the payment as 'failed' even though it
          // was already captured successfully.
          let capture: PayPalCapture
          try {
            capture = await paypal.captureOrder(s.data.orderId) as PayPalCapture
          } catch (captureErr) {
            const errMsg = captureErr instanceof Error ? captureErr.message : String(captureErr)
            if (errMsg.includes('ORDER_ALREADY_CAPTURED') || errMsg.includes('ORDER_ALREADY_PAID')) {
              // Order was already captured by the webhook — treat as success
              // Verify the payment_history row was already marked completed
              const { rows: recheck } = await db.query<Pick<PaymentHistoryRow, 'status'>>(
                'SELECT status FROM payment_history WHERE id = $1',
                [s.data.paymentId]
              )
              if (recheck[0]?.status === 'completed') {
                return NextResponse.json({ status: 'completed' })
              }
              // If not yet completed, mark it now
              await activateSubscription({ planId: s.data.planId, payment_method: 'paypal', currency: 'USD', amount: Number(pay.amount), transaction_id: s.data.orderId, status: 'completed', paymentId: s.data.paymentId })
              return NextResponse.json({ status: 'completed' })
            }
            // Genuine error — mark as failed
            await activateSubscription({ planId: s.data.planId, payment_method: 'paypal', currency: 'USD', amount: 0, transaction_id: s.data.orderId, status: 'failed', paymentId: s.data.paymentId })
            return NextResponse.json({ status: 'failed', error: errMsg })
          }
          if (capture.status?.toLowerCase() !== 'completed') {
            await activateSubscription({ planId: s.data.planId, payment_method: 'paypal', currency: 'USD', amount: 0, transaction_id: s.data.orderId, status: 'failed', paymentId: s.data.paymentId })
            return NextResponse.json({ status: 'failed' })
          }

          const captureAmount = capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount
          const amountStr = captureAmount?.value ?? '0'
          const currencyCode = (captureAmount?.currency_code ?? 'USD') as CurrencyCode

          if (String(pay.currency ?? '').toUpperCase() !== currencyCode.toUpperCase() ||
              Number(pay.amount) !== Number(amountStr)) {
            await activateSubscription({ planId: s.data.planId, payment_method: 'paypal', currency: (pay.currency as CurrencyCode) || 'USD', amount: Number(pay.amount) || 0, transaction_id: s.data.orderId, status: 'failed', paymentId: s.data.paymentId })
            return NextResponse.json({ status: 'failed' })
          }

          await activateSubscription({ planId: s.data.planId, payment_method: 'paypal', currency: currencyCode, amount: Number(amountStr), transaction_id: s.data.orderId, status: 'completed', paymentId: s.data.paymentId })
          return NextResponse.json({ status: 'completed' })
        }
        default:
          return NextResponse.json({ error: 'Unknown paypal action' }, { status: 400 })
      }
    }

    case 'mpesa': {
      const mpesa = getMpesaService()
      if (!mpesa) return NextResponse.json({ error: 'M-Pesa not configured' }, { status: 500 })

      switch (action) {
        case 'check-status': {
          const s = z.object({
            paymentId: z.string().uuid(),
            checkoutRequestId: z.string().min(1),
          }).safeParse(params)
          if (!s.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

          const { rows: payRows } = await db.query<Pick<PaymentHistoryRow, 'id' | 'plan_id' | 'currency' | 'amount' | 'status'>>(
            'SELECT id, plan_id, currency, amount, status FROM payment_history WHERE id = $1 AND user_id = $2 LIMIT 1',
            [s.data.paymentId, userId]
          )
          const pay = payRows[0] ?? null
          if (!pay) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })
          if (pay.status === 'completed') return NextResponse.json({ status: 'completed' })
          if (pay.status === 'failed') return NextResponse.json({ status: 'failed' })

          const result = await mpesa.checkTransactionStatus(s.data.checkoutRequestId)
          if (result.status === 'completed') {
            await activateSubscription({ planId: (pay.plan_id as PlanId) || 'pro', payment_method: 'mpesa', currency: (pay.currency as CurrencyCode) || 'KES', amount: Number(pay.amount) || 0, transaction_id: s.data.checkoutRequestId, status: 'completed', paymentId: s.data.paymentId })
          }

          return NextResponse.json({ status: result.status === 'completed' ? 'completed' : 'pending' })
        }
        default:
          return NextResponse.json({ error: 'Unknown mpesa action' }, { status: 400 })
      }
    }

    default:
      return NextResponse.json({ error: 'Unknown payment provider' }, { status: 400 })
  }
})

export const GET = apiHandler({ auth: false }, async () => {
  const isReal = (key: string | undefined) => !!key && !key.includes('mockup') && !key.includes('Mock')
  const stripe = isReal(process.env.STRIPE_SECRET_KEY)
  const paypal = isReal(process.env.PAYPAL_CLIENT_ID)
  const mpesa = isReal(process.env.MPESA_CONSUMER_KEY)
  // AUDIT FIX (HIGH, 2026-07-02): Airtel Money service exists but has no
  // route handler in the unified payments API. Don't advertise it until wired.
  // const airtel = isReal(process.env.AIRTEL_CLIENT_ID)

  return NextResponse.json({
    providers: { stripe, paypal, mpesa },
    currencies: ['USD', 'KES', 'UGX', 'TZS', 'EUR', 'GBP'],
    paymentMethods: [
      ...(stripe || paypal ? [{ id: 'card', name: 'Credit/Debit Card', providers: [stripe && 'stripe', paypal && 'paypal'].filter(Boolean) }] : []),
      ...(mpesa ? [{ id: 'mpesa', name: 'M-Pesa', providers: ['mpesa'] }] : []),
      // ...(airtel ? [{ id: 'airtel_money', name: 'Airtel Money', providers: ['airtel'] }] : []),
      ...(paypal ? [{ id: 'paypal', name: 'PayPal', providers: ['paypal'] }] : []),
    ],
  })
})
