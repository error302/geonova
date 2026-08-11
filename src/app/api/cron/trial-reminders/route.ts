export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/trial-reminders
 *
 * Scheduled job that sends the branded trial-ending reminder email to
 * Pro-trial users whose trial expires within the reminder window and who
 * have not been reminded yet.
 *
 * Designed to be called by a daily cron job
 * (see .github/workflows/trial-reminders.yml).
 *
 * Auth: Bearer API_ADMIN_KEY only.
 *
 * Idempotent: each user is sent at most once, guarded by
 * user_subscriptions.trial_reminder_sent_at (migration 048).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendTemplatedEmail } from '@/lib/email-templates'
import { PLAN_CATALOG, type CurrencyCode } from '@/lib/subscription/catalog'

// Send the reminder when the trial ends within this many days.
const REMINDER_WINDOW_DAYS = 3
// Cap the batch so a single run never hammers the mail service.
const MAX_BATCH = 100

interface TrialReminderRow {
  user_id: string
  email: string
  full_name: string | null
  trial_ends_at: string
  currency: string | null
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const serviceKey = process.env.API_ADMIN_KEY
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { rows } = await db.query<TrialReminderRow>(
    `SELECT u.id AS user_id, u.email, u.full_name, s.trial_ends_at, s.currency
     FROM user_subscriptions s
     JOIN users u ON u.id = s.user_id
     WHERE s.status = 'trial'
       AND s.trial_ends_at IS NOT NULL
       AND s.trial_reminder_sent_at IS NULL
       AND s.trial_ends_at > NOW()
       AND s.trial_ends_at <= NOW() + make_interval(days => $1)
     ORDER BY s.trial_ends_at ASC
     LIMIT $2`,
    [REMINDER_WINDOW_DAYS, MAX_BATCH]
  )

  const proPlan = PLAN_CATALOG.find((p) => p.id === 'pro')
  const planPriceNote = (currency: string | null): string => {
    const code = (currency || 'KES').toUpperCase() as CurrencyCode
    const price = proPlan?.prices[code] ?? proPlan?.prices.KES
    return price ? `${code} ${price}/month` : 'KES 500/month'
  }

  let sent = 0
  let skipped = 0
  const failed: Array<{ email: string; error: string }> = []

  for (const row of rows) {
    const result = await sendTemplatedEmail('trialEnding', {
      to: row.email,
      name: row.full_name || '',
      trialEndsAt: row.trial_ends_at,
      planPriceNote: planPriceNote(row.currency),
    })

    if (result.success) {
      await db.query<never>(
        `UPDATE user_subscriptions
         SET trial_reminder_sent_at = NOW(), updated_at = NOW()
         WHERE user_id = $1 AND trial_reminder_sent_at IS NULL`,
        [row.user_id]
      )
      sent += 1
    } else if (result.error === 'Email service not configured') {
      // Not an error — mail service is off (e.g. dev/staging).
      skipped += 1
    } else {
      failed.push({ email: row.email, error: result.error || 'Send failed' })
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    failed: failed.length,
    failedDetails: failed,
    skipped,
  })
}
