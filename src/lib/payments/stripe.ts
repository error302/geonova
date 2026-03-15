/**
 * Stripe Payment Integration
 * Processes card payments via Stripe API
 */

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

const STRIPE_API_VERSION = '2023-10-16'

export class StripeService {
  private secretKey: string

  constructor(config: StripeConfig) {
    this.secretKey = config.secretKey
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<StripePaymentIntent> {
    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': STRIPE_API_VERSION
      },
      body: new URLSearchParams({
        amount: String(Math.round(params.amount * 100)),
        currency: params.currency.toLowerCase(),
        ...(params.customerId && { customer: params.customerId }),
        ...(params.metadata && { 
          metadata: JSON.stringify(params.metadata) 
        })
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Payment failed')
    }

    const data = await response.json()
    return {
      id: data.id,
      clientSecret: data.client_secret,
      amount: data.amount / 100,
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

  async createSubscription(customerId: string, priceId: string): Promise<{ subscriptionId: string; clientSecret: string }> {
    const params = new URLSearchParams()
    params.append('customer', customerId)
    params.append('items[0][price]', priceId)
    params.append('payment_behavior', 'default_incomplete')
    params.append('payment_settings[save_default_payment_method]', 'on_subscription')
    params.append('expand', 'latest_invoice.payment_intent')

    const response = await fetch('https://api.stripe.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': STRIPE_API_VERSION
      },
      body: params
    })

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
    const crypto = require('crypto')
    const timestamp = signature.split(',')[0]?.replace('t=', '')
    const signatures = signature.split(',')?.map((s: string) => s.replace('v1=', '')) || []
    
    const signedPayload = `${timestamp}.${payload}`
    const expectedSignature = crypto
      .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET!)
      .update(signedPayload)
      .digest('hex')

    return signatures.some(s => s === expectedSignature)
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
