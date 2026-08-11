export const dynamic = 'force-dynamic'

/**
 * POST /api/emails/security-alert
 *
 * Internal endpoint for sending security-alert emails (new device login,
 * password change, email change, API key created).
 *
 * Auth: Bearer API_ADMIN_KEY.
 *
 * Security alerts are always sent — they bypass notification_preferences
 * per NIST 800-63B and Kenya DPA 2019 best practice.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendTemplatedEmail } from '@/lib/email-templates'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email().max(200),
  name: z.string().max(200).optional().default(''),
  eventName: z.string().min(1).max(200),
  deviceInfo: z.string().max(300).optional().default('Unknown device'),
  location: z.string().max(200).optional().default('Unknown location'),
  timestamp: z.string().datetime(),
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
  const result = await sendTemplatedEmail('securityAlert', { to: email, ...rest })
  if (!result.success && result.error !== 'Email service not configured') {
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
