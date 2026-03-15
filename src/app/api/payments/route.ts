import { NextRequest, NextResponse } from 'next/server'
import { getStripeService } from '@/lib/payments/stripe'
import { getPayPalService } from '@/lib/payments/paypal'
import { getMpesaService } from '@/lib/payments/mpesa'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider, action, ...params } = body

    switch (provider) {
      case 'stripe': {
        const stripe = getStripeService()
        if (!stripe) {
          return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
        }

        switch (action) {
          case 'create-payment-intent': {
            const result = await stripe.createPaymentIntent({
              amount: params.amount,
              currency: params.currency || 'usd',
              metadata: params.metadata
            })
            return NextResponse.json(result)
          }

          case 'create-subscription': {
            const result = await stripe.createSubscription(
              params.customerId,
              params.priceId
            )
            return NextResponse.json(result)
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
          case 'create-order': {
            const result = await paypal.createOrder(
              params.amount,
              params.currency || 'USD',
              params.description
            )
            return NextResponse.json(result)
          }

          case 'capture-order': {
            const result = await paypal.captureOrder(params.orderId)
            return NextResponse.json(result)
          }

          case 'create-subscription': {
            const result = await paypal.createSubscription(params.planId, {
              email: params.email,
              name: params.name
            })
            return NextResponse.json(result)
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
          case 'stk-push': {
            const result = await mpesa.initiateSTKPush({
              phoneNumber: params.phoneNumber,
              amount: params.amount,
              reference: params.reference,
              description: params.description
            })
            return NextResponse.json(result)
          }

          case 'check-status': {
            const result = await mpesa.checkTransactionStatus(params.checkoutRequestId)
            return NextResponse.json(result)
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
