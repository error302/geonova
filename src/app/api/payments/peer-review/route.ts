import { NextRequest, NextResponse } from 'next/server'
import { getStripeService } from '@/lib/payments/stripe'
import { createClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { Logger } from '@/lib/logger'

const logger = new Logger('PeerReviewPayments')

export async function POST(req: NextRequest) {
  try {
    const { reviewRequestId } = await req.json()
    if (!reviewRequestId) {
      return NextResponse.json(apiError('Missing reviewRequestId'), { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // For peer reviews, they might not be fully registered but we can try to link if logged in
    const stripe = getStripeService()
    if (!stripe) {
      logger.error('Stripe service is not configured or failed to initialize')
      return NextResponse.json(apiError('Stripe not configured', { fallback: true }), { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.createCheckoutSession({
      mode: 'payment',
      amount: 2500, // KES 2,500
      currency: 'KES',
      name: 'Peer Review Request',
      successUrl: `${appUrl}/peer-review?payment=success&request_id=${reviewRequestId}`,
      cancelUrl: `${appUrl}/peer-review?payment=cancelled`,
      metadata: {
        type: 'peer_review',
        review_request_id: reviewRequestId,
        user_id: user?.id || ''
      }
    })

    return NextResponse.json(apiSuccess({ url: session.url }))
  } catch (error: any) {
    logger.error('Peer review checkout error', error)
    return NextResponse.json(apiError('Failed to initialize payment checkout session'), { status: 500 })
  }
}
