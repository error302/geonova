/**
 * M-Pesa Mobile Money Integration
 * Supports Kenya M-Pesa, Uganda Airtel Money, Tanzania M-Pesa
 */

export interface MpesaConfig {
  consumerKey: string
  consumerSecret: string
  shortCode: string
  initiatorName: string
  securityCredential: string
  environment: 'sandbox' | 'production'
}

export interface STKPushParams {
  phoneNumber: string
  amount: number
  reference: string
  description?: string
  callbackUrl?: string
}

export interface MpesaTransaction {
  transactionId: string
  amount: number
  phone: string
  reference: string
  status: 'pending' | 'completed' | 'failed'
  timestamp: string
}

export class MpesaService {
  private consumerKey: string
  private consumerSecret: string
  private shortCode: string
  private initiatorName: string
  private securityCredential: string
  private environment: 'sandbox' | 'production'

  constructor(config: MpesaConfig) {
    this.consumerKey = config.consumerKey
    this.consumerSecret = config.consumerSecret
    this.shortCode = config.shortCode
    this.initiatorName = config.initiatorName
    this.securityCredential = config.securityCredential
    this.environment = config.environment
  }

  private get baseUrl(): string {
    return this.environment === 'sandbox'
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke'
  }

  private async getAccessToken(): Promise<string> {
    const credentials = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64')

    const response = await fetch(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: {
        'Authorization': `Basic ${credentials}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to obtain M-Pesa access token')
    }

    const data = await response.json()
    return data.access_token
  }

  async initiateSTKPush(params: STKPushParams): Promise<{ checkoutRequestId: string; responseCode: string }> {
    const accessToken = await this.getAccessToken()

    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
    const password = Buffer.from(`${this.shortCode}${process.env.MPESA_PASSKEY || ''}${timestamp}`).toString('base64')

    const response = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerBuyGoodsOnline',
        Amount: Math.round(params.amount),
        PartyA: params.phoneNumber,
        PartyB: this.shortCode,
        PhoneNumber: params.phoneNumber,
        CallBackURL: params.callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/mpesa/callback`,
        AccountReference: params.reference,
        TransactionDesc: params.description || 'GeoNova Payment'
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.errorMessage || 'STK Push failed')
    }

    const data = await response.json()
    return {
      checkoutRequestId: data.CheckoutRequestID,
      responseCode: data.ResponseCode
    }
  }

  async checkTransactionStatus(checkoutRequestId: string): Promise<{ status: string; amount?: number; phone?: string }> {
    const accessToken = await this.getAccessToken()

    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
    const password = Buffer.from(`${this.shortCode}${process.env.MPESA_PASSKEY || ''}${timestamp}`).toString('base64')

    const response = await fetch(`${this.baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      })
    })

    if (!response.ok) {
      throw new Error('Failed to check transaction status')
    }

    const data = await response.json()
    return {
      status: data.ResponseCode === '0' ? 'completed' : 'failed',
      amount: data.Amount ? parseFloat(data.Amount) : undefined,
      phone: data.PhoneNumber
    }
  }

  async registerC2BUrls(): Promise<boolean> {
    const accessToken = await this.getAccessToken()

    const response = await fetch(`${this.baseUrl}/mpesa/c2b/v1/registerurl`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ShortCode: this.shortCode,
        ResponseType: 'Completed',
        ConfirmationURL: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/mpesa/c2b/confirm`,
        ValidationURL: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/mpesa/c2b/validate`
      })
    })

    return response.ok
  }

  parseCallback(payload: Record<string, unknown>): MpesaTransaction | null {
    const body = payload.Body as { stkCallback?: { ResultCode: number; CallbackMetadata?: { Item: { Name: string; Value: string | number }[] } } }
    
    if (!body?.stkCallback?.CallbackMetadata) return null

    const items = body.stkCallback.CallbackMetadata.Item
    const getValue = (name: string): string | number | undefined => 
      items.find(i => i.Name === name)?.Value

    return {
      transactionId: String(getValue('MpesaReceiptNumber') || ''),
      amount: Number(getValue('Amount')) || 0,
      phone: String(getValue('PhoneNumber') || ''),
      reference: String(getValue('AccountReference') || ''),
      status: body.stkCallback.ResultCode === 0 ? 'completed' : 'failed',
      timestamp: new Date().toISOString()
    }
  }
}

export class AirtelMoneyService {
  private clientId: string
  private clientSecret: string
  private environment: 'sandbox' | 'production'

  constructor(clientId: string, clientSecret: string, environment: 'sandbox' | 'production' = 'sandbox') {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.environment = environment
  }

  private get baseUrl(): string {
    return this.environment === 'sandbox'
      ? 'https://api.sandbox.airtel.africa'
      : 'https://api.airtel.africa'
  }

  async initiatePayment(phone: string, amount: number, reference: string): Promise<{ transactionId: string }> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')

    const response = await fetch(`${this.baseUrl}/merchant/v1/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials}`,
        'Content-Type': 'application/json',
        'X-Country': 'UGA',
        'X-Currency': 'UGX'
      },
      body: JSON.stringify({
        reference,
        subscriber: {
          country: 'UG',
          msisdn: phone.replace(/^256/, '')
        },
        transaction: {
          amount,
          currency: 'UGX',
          description: 'GeoNova Payment'
        }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Airtel payment failed')
    }

    const data = await response.json()
    return {
      transactionId: data.data?.transaction?.id || ''
    }
  }
}

export function getMpesaService(): MpesaService | null {
  const consumerKey = process.env.MPESA_CONSUMER_KEY
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET
  
  if (!consumerKey || !consumerSecret) return null

  return new MpesaService({
    consumerKey,
    consumerSecret,
    shortCode: process.env.MPESA_SHORT_CODE || '',
    initiatorName: process.env.MPESA_INITIATOR_NAME || '',
    securityCredential: process.env.MPESA_SECURITY_CREDENTIAL || '',
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
  })
}
