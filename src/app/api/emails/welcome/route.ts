export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth-v5'
import { setCurrentUserId } from '@/lib/db'
import { rateLimit } from '@/lib/security/rateLimit'
import { sendTemplatedEmail } from '@/lib/email-templates'
import { z } from 'zod'

const welcomeSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().max(200).optional().default(''),
  trialEndsAt: z.string().datetime().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (session?.user) {
    const userId = (session.user as { id?: string }).id
    if (userId) setCurrentUserId(String(userId))
  } else {
    // Allow service-key auth for cron-triggered sends
    const authHeader = req.headers.get('authorization')
    const serviceKey = process.env.API_ADMIN_KEY
    if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const rawBody: unknown = await req.json().catch(() => null)
  const parsed = welcomeSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 422 },
    )
  }

  const { email, name } = parsed.data
  const trialEndsAt = parsed.data.trialEndsAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const { allowed } = await rateLimit(email, 5, 3600000)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const result = await sendTemplatedEmail('welcome', {
    to: email,
    name,
    trialEndsAt,
  })

  if (!result.success && result.error !== 'Email service not configured') {
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
