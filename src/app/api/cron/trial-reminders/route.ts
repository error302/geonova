export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/trial-reminders
 *
 * Scheduled job that sends the branded trial reminder emails to Pro-trial
 * users who never upgraded:
 *   1. Primary touch — trialEnding, 3 days before expiry
 *      (user_subscriptions.trial_reminder_sent_at, migration 048).
 *   2. Final touch — trialExpiring, in the last 24 hours before expiry
 *      (user_subscriptions.trial_reminder_2_sent_at, migration 049).
 *
 * Designed to be called by a daily cron job
 * (see .github/workflows/trial-reminders.yml).
 *
 * Auth: Bearer API_ADMIN_KEY only.
 *
 * Idempotent: each touch is sent at most once per user, guarded by the
 * per-touch columns above.
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

  // ── Second touch: final 24-hour reminder for trials that never upgraded ──
  // Runs independently of the 3-day touch so short trials (e.g. 1-day ones)
  // still get a warning; a normal 14-day trial gets both touches.
  const { rows: finalRows } = await db.query<TrialReminderRow>(
    `SELECT u.id AS user_id, u.email, u.full_name, s.trial_ends_at, s.currency
     FROM user_subscriptions s
     JOIN users u ON u.id = s.user_id
     WHERE s.status = 'trial'
       AND s.trial_ends_at IS NOT NULL
       AND s.trial_reminder_2_sent_at IS NULL
       AND s.trial_ends_at > NOW()
       AND s.trial_ends_at <= NOW() + interval '24 hours'
     ORDER BY s.trial_ends_at ASC
     LIMIT $1`,
    [MAX_BATCH]
  )

  let sent24h = 0

  for (const row of finalRows) {
    const result = await sendTemplatedEmail('trialExpiring', {
      to: row.email,
      name: row.full_name || '',
      trialEndsAt: row.trial_ends_at,
      planPriceNote: planPriceNote(row.currency),
    })

    if (result.success) {
      await db.query<never>(
        `UPDATE user_subscriptions
         SET trial_reminder_2_sent_at = NOW(), updated_at = NOW()
         WHERE user_id = $1 AND trial_reminder_2_sent_at IS NULL`,
        [row.user_id]
      )
      sent24h += 1
    } else if (result.error === 'Email service not configured') {
      // Not an error — mail service is off (e.g. dev/staging).
      skipped += 1
    } else {
      failed.push({ email: row.email, error: result.error || 'Send failed' })
    }
  }

  return NextResponse.json({
    success: true,
    sent3Day: sent,
    sent24h,
    sent: sent + sent24h,
    failed: failed.length,
    failedDetails: failed,
    skipped,
  })
}
