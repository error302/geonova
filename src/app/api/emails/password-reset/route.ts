export const dynamic = 'force-dynamic'

/**
 * POST /api/emails/password-reset
 *
 * Internal-only endpoint for triggering password-reset emails outside the
 * forgot-password flow (e.g. admin-initiated reset).
 *
 * Auth: requires either a valid session OR a Bearer API_ADMIN_KEY (for cron).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendTemplatedEmail } from '@/lib/email-templates'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email().max(200),
  name: z.string().max(200).optional().default(''),
  resetToken: z.string().min(16).max(128),
  expiresAt: z.string().datetime(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    const authHeader = req.headers.get('authorization')
    const serviceKey = process.env.API_ADMIN_KEY
    if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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
  const result = await sendTemplatedEmail('passwordReset', { to: email, ...rest })
  if (!result.success && result.error !== 'Email service not configured') {
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
