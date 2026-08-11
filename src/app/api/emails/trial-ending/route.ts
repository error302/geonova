export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { setCurrentUserId } from '@/lib/db'
import { sendTemplatedEmail } from '@/lib/email-templates'
import { z } from 'zod'

const trialEndingSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().max(200).optional().default(''),
  trialEndDate: z.string().datetime(),
  planPriceNote: z.string().max(100).optional().default('KES 500/month'),
})

export async function POST(req: NextRequest) {
  // Session OR service-key auth (cron)
  const session = await getServerSession(authOptions)
  if (session?.user) {
    const userId = (session.user as { id?: string }).id
    if (userId) setCurrentUserId(String(userId))
  } else {
    const authHeader = req.headers.get('authorization')
    const serviceKey = process.env.API_ADMIN_KEY
    if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const rawBody: unknown = await req.json().catch(() => null)
  const parsed = trialEndingSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 422 },
    )
  }

  const { email, name, trialEndDate, planPriceNote } = parsed.data

  const result = await sendTemplatedEmail('trialEnding', {
    to: email,
    name,
    trialEndsAt: trialEndDate,
    planPriceNote,
  })

  if (!result.success && result.error !== 'Email service not configured') {
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
