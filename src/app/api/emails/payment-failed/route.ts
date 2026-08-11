export const dynamic = 'force-dynamic'

/**
 * POST /api/emails/payment-failed
 *
 * Internal endpoint for sending payment-failed emails. Called by payment
 * webhooks (PayPal, M-Pesa, Stripe) when a charge is declined.
 *
 * Auth: Bearer API_ADMIN_KEY.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendTemplatedEmail } from '@/lib/email-templates'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email().max(200),
  name: z.string().max(200).optional().default(''),
  planName: z.string().min(1).max(100),
  amount: z.number().nonnegative(),
  currency: z.string().length(3).default('KES'),
  failureReason: z.string().min(1).max(500),
  retryAt: z.string().datetime().optional(),
})

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const serviceKey = process.env.API_ADMIN_KEY
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rawBody: unknown = await req.json().catch(() => null)
  const parsed = schema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 422 },
    )
  }

  const { email, ...rest } = parsed.data
  const result = await sendTemplatedEmail('paymentFailed', { to: email, ...rest })
  if (!result.success && result.error !== 'Email service not configured') {
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
