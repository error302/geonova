export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getStripeService } from '@/lib/payments/stripe'
import { getPublicAppUrl } from '@/lib/site'
import { apiHandler } from '@/lib/apiHandler'
import { apiSuccess, apiError } from '@/lib/api/response'
import { log } from '@/lib/logger'

export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { reviewRequestId } = ctx.body as { reviewRequestId?: string }
  if (!reviewRequestId) {
    return NextResponse.json(apiError('Missing reviewRequestId'), { status: 400 })
  }

  const stripe = getStripeService()
  if (!stripe) {
    log({ level: 'error', message: 'Stripe service is not configured or failed to initialize' })
    return NextResponse.json(apiError('Stripe not configured', { fallback: true }), { status: 500 })
  }

  const appUrl = getPublicAppUrl()

  const checkoutSession = await stripe.createCheckoutSession({
    mode: 'payment',
    amount: 2500,
    currency: 'KES',
    name: 'Peer Review Request',
    successUrl: `${appUrl}/peer-review?payment=success&request_id=${reviewRequestId}`,
    cancelUrl: `${appUrl}/peer-review?payment=cancelled`,
    metadata: {
      type: 'peer_review',
      review_request_id: reviewRequestId,
      user_id: ctx.userId,
    },
  })

  return NextResponse.json(apiSuccess({ url: checkoutSession.url }))
})
