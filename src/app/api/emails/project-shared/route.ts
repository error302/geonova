export const dynamic = 'force-dynamic'

/**
 * POST /api/emails/project-shared
 *
 * Internal endpoint for sending project-shared emails when a surveyor adds
 * a colleague to a project.
 *
 * Auth: valid session (called from the share-project UI flow).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendTemplatedEmail } from '@/lib/email-templates'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email().max(200),
  recipientName: z.string().max(200).optional().default(''),
  sharerName: z.string().min(1).max(200),
  projectName: z.string().min(1).max(300),
  role: z.enum(['viewer', 'editor', 'surveyor', 'admin']),
  projectId: z.string().min(1).max(200),
  message: z.string().max(1000).optional(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
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
  const result = await sendTemplatedEmail('projectShared', { to: email, ...rest })
  if (!result.success && result.error !== 'Email service not configured') {
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
