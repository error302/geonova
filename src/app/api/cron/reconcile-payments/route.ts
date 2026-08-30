export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * POST /api/cron/reconcile-payments
 *
 * General payments reconciliation sweep — the safety net the M-Pesa-only
 * reconciler (/api/cron/reconcile-mpesa, STK-push rows) doesn't cover:
 *
 *   1. STALE INTENTS: payment_intents stuck pending/processing for >48h are
 *      marked failed + expired. An intent that old was abandoned by the user
 *      or its callback was lost forever (Safaricom/PayPal callbacks are
 *      retried for minutes, not days). Without this, the Pending Payments
 *      admin view accumulates zombie rows forever.
 *      Idempotent: only touches rows still pending/processing.
 *
 *   2. STALE TILL CLAIMS: payment_history pending_review claims older than
 *      7 days get metadata.staleReview = true (NOT auto-failed — a Till
 *      claim is a human-review queue; auto-failing could reject a real
 *      payment the admin simply hasn't looked at). The flag lets the Admin
 *      Claims Hub surface them for attention.
 *      Idempotent: re-flagging is a no-op (metadata || merge).
 *
 *   3. SUMMARY: counts by status for monitoring/alerting.
 *
 * AUTH: Bearer API_ADMIN_KEY — same pattern as the other cron routes
 * (trial-reminders, reconcile-mpesa). Schedule via VM crontab or
 * workflow_dispatch (see .github/workflows/reconcile-mpesa.yml for the
 * VM-local scheduling precedent).
 *
 * TESTS: __tests__/route.test.ts pins the stale-intent expiry, the
 * stale-claim flagging, idempotency guards, and the auth gate.
 */

const STALE_INTENT_HOURS = 48
const STALE_CLAIM_DAYS = 7

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const serviceKey = process.env.API_ADMIN_KEY
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ── 1. Expire stale payment intents ─────────────────────────────────
    // Only pending/processing rows older than the cutoff. The status guard
    // makes re-running safe: completed/failed rows are never touched.
    const staleIntents = await db.query<{ id: string; payment_method: string }>(
      `UPDATE payment_intents
          SET status = 'failed',
              metadata = metadata || '{"reconciled":"expired_stale_intent"}'::jsonb,
              updated_at = NOW()
        WHERE status IN ('pending', 'processing')
          AND created_at < NOW() - ($1 || ' hours')::interval
        RETURNING id, payment_method`,
      [String(STALE_INTENT_HOURS)]
    )

    // ── 2. Flag stale Till claims for admin attention ────────────────────
    // NOT auto-failed: these need human adjudication against the merchant
    // statement. The flag is what the Admin Claims Hub reads to sort them.
    const staleClaims = await db.query<{ id: string }>(
      `UPDATE payment_history
          SET metadata = metadata || '{"staleReview":true}'::jsonb,
              updated_at = NOW()
        WHERE status = 'pending_review'
          AND payment_method = 'mpesa_till'
          AND created_at < NOW() - ($1 || ' days')::interval
          AND COALESCE(metadata->>'staleReview', 'false') <> 'true'
        RETURNING id`,
      [String(STALE_CLAIM_DAYS)]
    )

    // ── 3. Status summary for monitoring ─────────────────────────────────
    const intentSummary = await db.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM payment_intents GROUP BY status ORDER BY status`
    )
    const claimSummary = await db.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count
         FROM payment_history
        WHERE payment_method = 'mpesa_till'
        GROUP BY status ORDER BY status`
    )

    logger.info('[reconcile-payments] sweep complete', {
      expiredIntents: staleIntents.rowCount ?? 0,
      flaggedClaims: staleClaims.rowCount ?? 0,
    })

    return NextResponse.json({
      ok: true,
      expiredIntents: staleIntents.rowCount ?? 0,
      expiredIntentIds: staleIntents.rows.map((r) => r.id),
      flaggedStaleClaims: staleClaims.rowCount ?? 0,
      intentStatusCounts: Object.fromEntries(intentSummary.rows.map((r) => [r.status, Number(r.count)])),
      tillClaimStatusCounts: Object.fromEntries(claimSummary.rows.map((r) => [r.status, Number(r.count)])),
    })
  } catch (err) {
    logger.error('[reconcile-payments] sweep failed:', { error: err })
    return NextResponse.json({ error: 'Reconciliation sweep failed' }, { status: 500 })
  }
}
