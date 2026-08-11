import { NextResponse } from 'next/server'
import { getPayPalService } from '@/lib/payments/paypal'
import { getPlanPrice, PlanId, CurrencyCode } from '@/lib/subscription/catalog'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  try {
    const body = await req.json() as unknown as { planId?: PlanId; currency?: CurrencyCode }
    const { planId, currency } = body as { planId: PlanId; currency: CurrencyCode }
    
    if (!planId || !currency) {
      return NextResponse.json({ error: 'Missing planId or currency' }, { status: 400 })
    }

    const price = getPlanPrice(planId, currency)
    if (!price || price <= 0) {
      return NextResponse.json({ error: 'Invalid plan or free plan selected' }, { status: 400 })
    }

    const paypal = getPayPalService()
    if (!paypal) {
      return NextResponse.json({ error: 'PayPal is not configured' }, { status: 503 })
    }

    const order = await paypal.createOrder({
      amount: price,
      currency,
      description: `METARDU ${planId.toUpperCase()} Plan`,
    })

    return NextResponse.json({ orderId: order.id })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    logger.error('[PayPal Create Order Error]', { error: error })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
