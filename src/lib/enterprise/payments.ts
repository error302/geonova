/**
 * Client-side payment helpers for the Checkout UI.
 *
 * IMPORTANT:
 * - Never fake payment success in the frontend.
 * - Never send an arbitrary amount from the client; the server validates plan pricing.
 */

import type { CurrencyCode, PlanId } from '@/lib/subscription/catalog'

export interface PaymentMethod {
  id: string
  type: 'card' | 'mpesa' | 'paypal'
  name: string
  enabled: boolean
  countries: string[]
}

export type PaymentProvider = 'stripe' | 'paypal' | 'mpesa'

export type StartSubscriptionResult =
  | { kind: 'activated'; planId: PlanId }
  | { kind: 'redirect'; provider: 'stripe' | 'paypal'; url: string; paymentId: string }
  | { kind: 'mpesa'; provider: 'mpesa'; paymentId: string; checkoutRequestId: string }

const paymentMethods: PaymentMethod[] = [
  { id: 'card', type: 'card', name: 'Visa / Mastercard', enabled: true, countries: ['*'] },
  { id: 'mpesa', type: 'mpesa', name: 'M-Pesa (STK Push)', enabled: true, countries: ['Kenya'] },
  { id: 'paypal', type: 'paypal', name: 'PayPal', enabled: true, countries: ['*'] },
]

export function getPaymentMethods(country?: string): PaymentMethod[] {
  if (!country) return paymentMethods.filter((p) => p.enabled)
  return paymentMethods.filter(
    (p) => p.enabled && (p.countries.includes('*') || p.countries.includes(country))
  )
}

export function getCurrencyForCountry(country: string): CurrencyCode {
  const currencies: Record<string, CurrencyCode> = {
    Kenya: 'KES',
    Uganda: 'UGX',
    Tanzania: 'TZS',
    Nigeria: 'NGN',
    Ghana: 'GHS',
    'South Africa': 'ZAR',
    India: 'INR',
    Indonesia: 'IDR',
    Brazil: 'BRL',
    Australia: 'AUD',
    UK: 'GBP',
    Germany: 'EUR',
    France: 'EUR',
    US: 'USD',
  }
  return currencies[country] || 'USD'
}

export async function startSubscriptionPayment(input: {
  planId: PlanId
  currency: CurrencyCode
  method: PaymentMethod['type']
  email: string
  phoneNumber?: string
  country?: string
}): Promise<StartSubscriptionResult> {
  const provider: PaymentProvider =
    input.method === 'mpesa' ? 'mpesa' : input.method === 'paypal' ? 'paypal' : 'stripe'

  const res = await fetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider,
      action: 'start-subscription',
      planId: input.planId,
      currency: input.currency,
      email: input.email,
      phoneNumber: input.phoneNumber,
      country: input.country,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to start payment')
  }

  return data as StartSubscriptionResult
}

export async function checkMpesaPaymentStatus(input: {
  paymentId: string
  checkoutRequestId: string
}): Promise<{ status: 'pending' | 'completed' | 'failed' }> {
  const res = await fetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'mpesa',
      action: 'check-status',
      paymentId: input.paymentId,
      checkoutRequestId: input.checkoutRequestId,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || 'Failed to check payment status')
  }

  return data as { status: 'pending' | 'completed' | 'failed' }
}

