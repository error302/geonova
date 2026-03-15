/**
 * PayPal Payment Integration
 * Processes PayPal payments
 */

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
  purchaseUnits: {
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
      throw new Error('Failed to obtain PayPal access token')
    }

    const data = await response.json()
    this.accessToken = data.access_token
    this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000

    return this.accessToken!
  }

  async createOrder(amount: number, currency: string = 'USD', description?: string): Promise<PayPalOrder> {
    const accessToken = await this.getAccessToken()

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
            value: amount.toFixed(2)
          },
          ...(description && { description })
        }]
      })
    })

    if (!response.ok) {
      const error = await response.json()
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
      const error = await response.json()
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
          brand_name: 'GeoNova',
          landing_page: 'NO_PREFERENCE',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/success`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/subscription/cancel`
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to create subscription')
    }

    const data = await response.json()
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
  
  if (!clientId || !clientSecret) return null

  return new PayPalService({
    clientId,
    clientSecret,
    mode: process.env.NODE_ENV === 'production' ? 'live' : 'sandbox'
  })
}
