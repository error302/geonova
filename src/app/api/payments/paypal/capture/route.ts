import { NextResponse } from 'next/server'
import { getPayPalService } from '@/lib/payments/paypal'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { orderId?: string }
    const { orderId } = body
    
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    const paypal = getPayPalService()
    if (!paypal) {
      return NextResponse.json({ error: 'PayPal is not configured' }, { status: 503 })
    }

    const captureResult = await paypal.captureOrder(orderId)
    
    // Optionally: Update user's subscription status in database based on successful capture here.
    
    return NextResponse.json(captureResult)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    logger.error('[PayPal Capture Order Error]', { error: error })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
