import { NextResponse } from 'next/server'
import { getPayPalService } from '@/lib/payments/paypal'

export async function POST(req: Request) {
  try {
    const body = await req.json()
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
  } catch (error: any) {
    console.error('[PayPal Capture Order Error]', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
