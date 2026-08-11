export const dynamic = 'force-dynamic'

/**
 * POST /api/emails/weekly-digest
 *
 * Internal endpoint for sending weekly digest emails.
 * Designed to be called by a Monday-morning cron job that batches per user.
 *
 * Auth: Bearer API_ADMIN_KEY only.
 *
 * The cron job should:
 *   1. Query users WHERE notification_preferences->'email'->>'weekly_digest' = 'true'
 *   2. Aggregate their activity for the past 7 days
 *   3. Call this endpoint once per user
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendTemplatedEmail } from '@/lib/email-templates'
import { z } from 'zod'

const highlightedProjectSchema = z.object({
  name: z.string().min(1).max(300),
  status: z.enum(['active', 'completed', 'archived']),
  newObservations: z.number().int().nonnegative().default(0),
  projectUrl: z.string().url(),
})

const schema = z.object({
  email: z.string().email().max(200),
  name: z.string().max(200).optional().default(''),
  weekStart: z.string().datetime(),
  weekEnd: z.string().datetime(),
  projectsActive: z.number().int().nonnegative().default(0),
  projectsCompleted: z.number().int().nonnegative().default(0),
  pointsCollected: z.number().int().nonnegative().default(0),
  documentsGenerated: z.number().int().nonnegative().default(0),
  pendingSubmissions: z.number().int().nonnegative().default(0),
  highlightedProjects: z.array(highlightedProjectSchema).max(3).optional(),
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
  const result = await sendTemplatedEmail('weeklyDigest', { to: email, ...rest })
  if (!result.success && result.error !== 'Email service not configured') {
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
