export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/reconcile-mpesa
 *
 * Reconciles M-Pesa STK Push payments that never received a callback.
 *
 * Why: if the customer closes the browser before the STK callback arrives
 * (or Safaricom's callback fails), the payment row stays `pending` forever —
 * the customer may have paid but their subscription never activates, and
 * there is no audit trail. This job asks Daraja's STK Push Query API for an
 * authoritative answer and finalizes each row accordingly.
 *
 * Designed to be called every 5 minutes by cron / scheduled workflow:
 *   Auth: Bearer API_ADMIN_KEY (same pattern as trial-reminders).
 *
 * Finalization rules per stale pending payment (older than RECONCILE_AFTER_MIN):
 *   - Daraja ResultCode 0            → completed + activate subscription
 *   - Daraja definitive failure code → failed
 *   - query error / ambiguous        → leave pending, retry next run
 *   - older than ABANDON_AFTER_HRS   → marked failed without querying
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getMpesaService } from '@/lib/payments/mpesa'
import { logger } from '@/lib/logger'
import type { PlanId } from '@/lib/subscription/catalog'

const RECONCILE_AFTER_MIN = 15
const ABANDON_AFTER_HRS = 48
const MAX_BATCH = 50

interface StalePaymentRow {
  id: string
  user_id: string
  plan_id: string | null
  currency: string | null
  amount: number | null
  transaction_id: string | null
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const serviceKey = process.env.API_ADMIN_KEY
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const mpesa = getMpesaService()
  if (!mpesa) {
    return NextResponse.json(
      { skipped: true, reason: 'M-Pesa not configured' },
      { status: 200 },
    )
  }

  const { rows: stale } = await db.query<StalePaymentRow>(
    `SELECT id, user_id, plan_id, currency, amount, transaction_id
     FROM payment_history
     WHERE provider = 'mpesa'
       AND status = 'pending'
       AND transaction_id IS NOT NULL
       AND created_at < NOW() - make_interval(mins => $1)
     ORDER BY created_at ASC
     LIMIT $2`,
    [RECONCILE_AFTER_MIN, MAX_BATCH],
  )

  let completed = 0
  let failed = 0
  let keptPending = 0
  const errors: Array<{ id: string; error: string }> = []

  for (const pay of stale) {
    try {
      // Abandoned checkouts: finalize without hitting Daraja.
      const { rows: ageRows } = await db.query<{ old: boolean }>(
        `SELECT created_at < NOW() - make_interval(hours => $1) AS old FROM payment_history WHERE id = $2`,
        [ABANDON_AFTER_HRS, pay.id],
      )
      if (ageRows[0]?.old) {
        await db.query(`UPDATE payment_history SET status = 'failed', metadata = COALESCE(metadata,'{}'::jsonb) || '{"reconciled":"abandoned_timeout"}'::jsonb WHERE id = $1`, [pay.id])
        failed++
        continue
      }

      const result = await mpesa.checkTransactionStatus(pay.transaction_id!)

      if (result.status === 'completed') {
        await db.query(
          `UPDATE payment_history SET status = 'completed',
              metadata = COALESCE(metadata,'{}'::jsonb) || '{"reconciled":true}'::jsonb
            WHERE id = $1 AND status = 'pending'`,
          [pay.id],
        )
        await activateSubscriptionForReconciliation(pay)
        completed++
      } else if (typeof result.resultCode === 'number' && result.resultCode !== 0) {
        // Definitive failure from Daraja (cancelled, timeout, insufficient funds…)
        await db.query(
          `UPDATE payment_history SET status = 'failed',
              metadata = COALESCE(metadata,'{}'::jsonb) || $2::jsonb
            WHERE id = $1 AND status = 'pending'`,
          [pay.id, JSON.stringify({ reconciled: true, resultCode: result.resultCode, resultDesc: result.resultDesc })],
        )
        failed++
      } else {
        // Ambiguous (query endpoint hiccup) — leave pending for the next run.
        keptPending++
      }
    } catch (err: unknown) {
      keptPending++
      errors.push({ id: pay.id, error: (err as Error).message })
    }
  }

  logger.info('[cron/reconcile-mpesa] run complete', { stale: stale.length, completed, failed, keptPending })

  return NextResponse.json({
    ok: true,
    scanned: stale.length,
    completed,
    failed,
    keptPending,
    ...(errors.length > 0 && { errors }),
  })
}

/** Mirror of the callback route's activation block, scoped to one payment. */
async function activateSubscriptionForReconciliation(pay: StalePaymentRow): Promise<void> {
  const existingSub = await db.query<{ id: string }>(
    'SELECT id FROM user_subscriptions WHERE user_id = $1',
    [pay.user_id],
  )
  const periodStart = new Date().toISOString()
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  if (existingSub.rows.length > 0) {
    await db.query(
      `UPDATE user_subscriptions
         SET plan_id = $1, status = 'active', payment_method = 'mpesa',
             currency = 'KES', current_period_start = $2, current_period_end = $3
         WHERE id = $4`,
      [(pay.plan_id as PlanId) || 'pro', periodStart, periodEnd, existingSub.rows[0].id],
    )
  } else {
    await db.query(
      `INSERT INTO user_subscriptions
         (user_id, plan_id, status, payment_method, currency,
          current_period_start, current_period_end)
       VALUES ($1, $2, 'active', 'mpesa', 'KES', $3, $4)`,
      [pay.user_id, (pay.plan_id as PlanId) || 'pro', periodStart, periodEnd],
    )
  }
}
