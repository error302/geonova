/**
 * PayPal Payment Integration
 * Processes PayPal payments
 */
import { logger } from '@/lib/logger'

export interface PayPalConfig {
  clientId: string
  clientSecret: string
  mode: 'sandbox' | 'live'
}

export interface PayPalOrder {
  id: string
  status: string
  links: { rel: string; href: string }[]
}

export interface PayPalCaptureResult {
  id: string
  status: string
  purchase_units: {
    payments: {
      captures: { id: string; status: string; amount: { value: string; currency_code: string } }[]
    }[]
  }[]
}

export class PayPalService {
  private clientId: string
  private clientSecret: string
  private mode: 'sandbox' | 'live'
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(config: PayPalConfig) {
    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
    this.mode = config.mode
  }

  private get baseUrl(): string {
    return this.mode === 'sandbox'
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com'
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
    
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown')
      logger.error(`[PayPal] Token request failed: ${response.status} ${response.statusText} | mode=${this.mode} | body=${errorBody}`)
      throw new Error(`Failed to obtain PayPal access token (${response.status}). Mode: ${this.mode}. Check PAYPAL_MODE, CLIENT_ID and CLIENT_SECRET.`)
    }

    const data = (await response.json()) as { access_token: string; expires_in: number }
    this.accessToken = data.access_token
    this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000

    return this.accessToken!
  }

  private currencyMinorUnitDigits(currency: string): number {
    try {
      const nf = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() })
      return nf.resolvedOptions().maximumFractionDigits ?? 2
    } catch {
      return 2
    }
  }

  async createOrder(input: {
    amount: number
    currency?: string
    description?: string
    returnUrl?: string
    cancelUrl?: string
  }): Promise<PayPalOrder> {
    const accessToken = await this.getAccessToken()
    const currency = input.currency || 'USD'
    const digits = this.currencyMinorUnitDigits(currency)
    const value = input.amount.toFixed(digits)

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency,
            value
          },
          ...(input.description && { description: input.description })
        }],
        ...(input.returnUrl || input.cancelUrl
          ? {
              application_context: {
                return_url: input.returnUrl,
                cancel_url: input.cancelUrl,
                brand_name: 'METARDU',
                landing_page: 'NO_PREFERENCE',
                user_action: 'PAY_NOW',
              },
            }
          : {}),
      })
    })

    if (!response.ok) {
      const error = (await response.json()) as { message?: string }
      throw new Error(error.message || 'Failed to create PayPal order')
    }

    return response.json()
  }

  async captureOrder(orderId: string): Promise<PayPalCaptureResult> {
    const accessToken = await this.getAccessToken()

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = (await response.json()) as { message?: string }
      throw new Error(error.message || 'Failed to capture PayPal order')
    }

    return response.json()
  }

  async getOrderDetails(orderId: string): Promise<PayPalOrder> {
    const accessToken = await this.getAccessToken()

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to get PayPal order details')
    }

    return response.json()
  }

  async createSubscription(planId: string, subscriber: { email: string; name?: string }): Promise<{ subscriptionId: string; approvalUrl: string }> {
    const accessToken = await this.getAccessToken()

    const response = await fetch(`${this.baseUrl}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan_id: planId,
        subscriber: {
          email_address: subscriber.email,
          ...(subscriber.name && {
            name: { given_name: subscriber.name.split(' ')[0], surname: subscriber.name.split(' ').slice(1).join(' ') }
          })
        },
        application_context: {
          brand_name: 'METARDU',
          landing_page: 'NO_PREFERENCE',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/success`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/cancel`
        }
      })
    })

    if (!response.ok) {
      const error = (await response.json()) as { message?: string }
      throw new Error(error.message || 'Failed to create subscription')
    }

    const data = (await response.json()) as { id: string; links?: Array<{ rel: string; href: string }> }
    const approveLink = data.links?.find((l: { rel: string }) => l.rel === 'approve')

    return {
      subscriptionId: data.id,
      approvalUrl: approveLink?.href || ''
    }
  }

  async activateSubscription(subscriptionId: string): Promise<boolean> {
    const accessToken = await this.getAccessToken()

    const response = await fetch(`${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/activate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    return response.ok
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    const accessToken = await this.getAccessToken()

    const response = await fetch(`${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: 'User requested cancellation' })
    })

    return response.ok
  }
}

export function getPayPalService(): PayPalService | null {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    logger.warn('[PayPal] PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not set — PayPal disabled')
    return null
  }

  // Default to sandbox unless PAYPAL_MODE=live is explicitly set.
  // NEVER auto-detect from NODE_ENV — prevents sandbox credentials hitting live API.
  const mode = (process.env.PAYPAL_MODE as 'sandbox' | 'live') || 'sandbox'

  return new PayPalService({
    clientId,
    clientSecret,
    mode
  })
}
