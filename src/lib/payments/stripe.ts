/**
 * Stripe Payment Integration
 * Processes card payments via Stripe API
 */

import { createHmac, timingSafeEqual, randomUUID } from 'crypto'
import { stripeBreaker } from '@/lib/resilience/circuitBreaker'

export interface StripeConfig {
  secretKey: string
  publishableKey: string
  webhookSecret: string
}

export interface CreatePaymentIntentParams {
  amount: number
  currency: string
  customerId?: string
  metadata?: Record<string, string>
}

export interface StripePaymentIntent {
  id: string
  clientSecret: string
  amount: number
  currency: string
  status: string
}

export interface CreateCheckoutSessionParams {
  mode: 'payment' | 'subscription'
  amount: number
  currency: string
  name: string
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}

export interface StripeCheckoutSession {
  id: string
  url: string
  paymentStatus?: string
  amountTotal?: number
  currency?: string
}

const STRIPE_API_VERSION = '2023-10-16'

export class StripeService {
  private secretKey: string

  constructor(config: StripeConfig) {
    this.secretKey = config.secretKey
  }

  private currencyMinorUnitDigits(currency: string): number {
    try {
      const nf = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() })
      return nf.resolvedOptions().maximumFractionDigits ?? 2
    } catch {
      return 2
    }
  }

  private toMinorUnits(amount: number, currency: string): number {
    const digits = this.currencyMinorUnitDigits(currency)
    const factor = Math.pow(10, digits)
    return Math.round(amount * factor)
  }

  private fromMinorUnits(amountMinor: number, currency: string): number {
    const digits = this.currencyMinorUnitDigits(currency)
    const factor = Math.pow(10, digits)
    return amountMinor / factor
  }

  private buildMetadataParams(metadata?: Record<string, string>) {
    if (!metadata) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(metadata)) {
      out[`metadata[${k}]`] = v
    }
    return out
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<StripePaymentIntent> {
    const response = await stripeBreaker.execute(() => fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': STRIPE_API_VERSION
      },
      body: new URLSearchParams({
        amount: String(this.toMinorUnits(params.amount, params.currency)),
        currency: params.currency.toLowerCase(),
        ...(params.customerId && { customer: params.customerId }),
        ...this.buildMetadataParams(params.metadata),
      }),
    }))

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Payment failed')
    }

    const data = await response.json()
    return {
      id: data.id,
      clientSecret: data.client_secret,
      amount: this.fromMinorUnits(data.amount, data.currency),
      currency: data.currency,
      status: data.status
    }
  }

  async confirmPayment(paymentIntentId: string): Promise<boolean> {
    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Stripe-Version': STRIPE_API_VERSION
      }
    })

    if (!response.ok) return false
    const data = await response.json()
    return data.status === 'succeeded'
  }

  async createCustomer(email: string, name: string): Promise<string> {
    const response = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': STRIPE_API_VERSION
      },
      body: new URLSearchParams({
        email,
        name
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Customer creation failed')
    }

    const data = await response.json()
    return data.id
  }

  async createSubscription(
    customerId: string,
    priceId: string,
    metadata?: Record<string, string>,
    idempotencyKey?: string,
  ): Promise<{ subscriptionId: string; clientSecret: string }> {
    const params = new URLSearchParams()
    params.append('customer', customerId)
    params.append('items[0][price]', priceId)
    params.append('payment_behavior', 'default_incomplete')
    params.append('payment_settings[save_default_payment_method]', 'on_subscription')
    params.append('expand', 'latest_invoice.payment_intent')

    // AUDIT FIX (CRITICAL 3, 2026-07-02): Add metadata so webhook sync
    // handlers can find the user. Without this, subscription update/delete
    // webhooks silently no-op because sub.metadata.user_id is undefined.
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        params.append(`metadata[${key}]`, value)
      }
    }

    // ByteByteGo audit fix: use a stable client-supplied idempotency key (UUID)
    // instead of Date.now() which defeats idempotency on retries within the same second.
    // Also wrap the call in a circuit breaker to prevent cascading failures.
    const key = idempotencyKey || randomUUID()

    const response = await stripeBreaker.execute(() => fetch('https://api.stripe.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': STRIPE_API_VERSION,
        'Idempotency-Key': key,
      },
      body: params
    }))

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Subscription creation failed')
    }

    const data = await response.json()
    const invoice = data.latest_invoice as { payment_intent?: { client_secret?: string } }

    return {
      subscriptionId: data.id,
      clientSecret: invoice.payment_intent?.client_secret || ''
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const parts = String(signature ?? '').split(',')
    const tPart = parts.find((p) => p.startsWith('t='))
    const v1Parts = parts.filter((p) => p.startsWith('v1='))
    const timestamp = tPart?.slice(2)
    const signatures = v1Parts.map((p) => p.slice(3)).filter(Boolean)

    if (!timestamp || signatures.length === 0) return false

    // AUDIT FIX (HIGH 9, 2026-07-02): Timestamp freshness check.
    // Reject webhooks older than 5 minutes to prevent replay attacks.
    const webhookTime = parseInt(timestamp, 10) * 1000
    const now = Date.now()
    const maxAge = 5 * 60 * 1000 // 5 minutes
    if (isNaN(webhookTime) || Math.abs(now - webhookTime) > maxAge) {
      console.warn(`[stripe] Webhook timestamp outside 5min window: ${timestamp} (now: ${now})`)
      return false
    }

    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) return false

    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex')

    try {
      const expectedBuf = Buffer.from(expected, 'utf8')
      return signatures.some((s) => {
        const sigBuf = Buffer.from(s, 'utf8')
        return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)
      })
    } catch {
      return false
    }
  }

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<StripeCheckoutSession> {
    const body = new URLSearchParams({
      mode: params.mode,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': params.currency.toLowerCase(),
      'line_items[0][price_data][product_data][name]': params.name,
      'line_items[0][price_data][unit_amount]': String(this.toMinorUnits(params.amount, params.currency)),
      ...this.buildMetadataParams(params.metadata),
    })

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': STRIPE_API_VERSION,
      },
      body,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error?.error?.message || 'Stripe checkout session failed')
    }

    const data = await response.json()
    return { id: data.id, url: data.url }
  }

  async getCheckoutSession(sessionId: string): Promise<{ id: string; paymentStatus: string; amountTotal: number; currency: string }> {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Stripe-Version': STRIPE_API_VERSION,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error?.error?.message || 'Failed to fetch Stripe session')
    }

    const data = await response.json()
    return {
      id: data.id,
      paymentStatus: data.payment_status,
      amountTotal: this.fromMinorUnits(data.amount_total ?? 0, data.currency),
      currency: data.currency,
    }
  }
}

export function getStripeService(): StripeService | null {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) return null
  
  return new StripeService({
    secretKey,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
  })
}
