export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { parseMpesaSms } from '@/lib/payments/smsParser'
import { getPlan, type PlanId } from '@/lib/subscription/catalog'
import { paymentReceiptEmail } from '@/lib/email-templates/paymentReceipt'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { getMpesaTillNumber } from '@/lib/payments/mpesaConfig'

interface PaymentRow {
  id: string
  user_id: string
  amount: string
  currency: string
  metadata: {
    planId?: PlanId
    mpesaCode?: string
    phoneNumber?: string
    tillNumber?: string
  }
}

interface UserRow {
  id: string
  email: string
  name?: string
}

/**
 * POST /api/payments/mpesa/sms-webhook
 *
 * Automated zero-Daraja M-Pesa payment processor.
 * Accepts incoming SMS forwarded from the merchant Till phone,
 * extracts transaction details, and automatically activates matching user subscriptions.
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const querySecret = url.searchParams.get('secret')
    const authHeader = req.headers.get('authorization')
    const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

    const expectedSecret = process.env.MPESA_SMS_WEBHOOK_SECRET || process.env.API_ADMIN_KEY || process.env.WORKER_SECRET

    const providedSecret = querySecret || bearerSecret
    // PAYMENTS CONTRACT FIX (2026-08-30): FAIL CLOSED. The old check
    // `(expectedSecret && providedSecret !== expectedSecret)` short-circuited
    // to ALLOW when NO secret was configured — any non-empty bearer token
    // could submit forged payment SMS on an unconfigured deployment.
    if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized webhook access' }, { status: 401 })
    }

    // LINT FIX (2026-08-30): type the parsed body — `any` made every field
    // access an unsafe-member-access error under the repo's type-aware rules.
    const body: unknown = await req.json().catch(() => ({}))
    const smsText = (
      typeof body === 'string'
        ? body
        : (body as { sms?: string; message?: string; text?: string; content?: string }).sms ||
          (body as { message?: string }).message ||
          (body as { text?: string }).text ||
          (body as { content?: string }).content ||
          ''
    ) as string

    if (!smsText) {
      return NextResponse.json({ error: 'No SMS message text provided' }, { status: 400 })
    }

    const parsed = parseMpesaSms(smsText)
    if (!parsed.success || !parsed.mpesaCode) {
      return NextResponse.json({
        error: parsed.error || 'Failed to parse M-Pesa transaction code from SMS',
        rawText: smsText,
      }, { status: 422 })
    }

    const mpesaCode = parsed.mpesaCode
    const tillNumber = getMpesaTillNumber()

    // 1. Check if a pending customer claim exists for this transaction code
    const claimRes = await db.query<PaymentRow>(
      `SELECT id, user_id, amount, currency, metadata
       FROM payment_history
       WHERE (transaction_id = $1 OR metadata->>'mpesaCode' = $1)
         AND status = 'pending_review'
       ORDER BY created_at DESC
       LIMIT 1`,
      [mpesaCode]
    )

    if (claimRes.rows.length > 0) {
      const claim = claimRes.rows[0]
      const planId = (claim.metadata?.planId || 'pro') as PlanId
      const plan = getPlan(planId)
      const planDisplayName = plan?.name || (planId.toUpperCase() + ' Plan')

      // PAYMENTS CONTRACT FIX (2026-08-30): verify the SMS amount against
      // the claimed plan's price before auto-activating — the old path
      // granted whatever plan the CLAIM asked for, regardless of how much
      // money actually arrived. Fail-closed: mismatch routes to manual
      // review instead of activation.
      const { getPlanPrice } = await import('@/lib/subscription/catalog')
      const expectedAmount = getPlanPrice(planId, 'KES')
      const smsAmount = parsed.amount ?? Number(claim.amount)
      if (
        !Number.isFinite(smsAmount) ||
        smsAmount <= 0 ||
        !Number.isFinite(expectedAmount) ||
        expectedAmount <= 0 ||
        Math.round(smsAmount) !== Math.round(expectedAmount)
      ) {
        await db.query<never>(
          `UPDATE payment_history
             SET status = 'pending_review',
                 updated_at = NOW(),
                 metadata = metadata || $2::jsonb
           WHERE id = $1`,
          [
            claim.id,
            JSON.stringify({
              fraudFlag: 'amount_mismatch',
              smsAmount,
              expectedAmount,
              verifiedAt: new Date().toISOString(),
              smsSenderPhone: parsed.senderPhone,
              smsSenderName: parsed.senderName,
            }),
          ]
        )
        logger.warn('[mpesa-sms-webhook] SMS/claim amount mismatch — routed to manual review', {
          mpesaCode,
          planId,
          smsAmount,
          expectedAmount,
        })
        return NextResponse.json({
          success: true,
          action: 'routed_to_manual_review',
          reason: 'amount_mismatch',
          mpesaCode,
          smsAmount,
          expectedAmount,
        })
      }

      const periodStart = new Date()
      const periodEnd = new Date()
      periodEnd.setDate(periodEnd.getDate() + 30)

      // PAYMENTS CONTRACT FIX (2026-08-30): claim completion + subscription
      // grant in ONE transaction, with a conditional claim UPDATE so a
      // retried/duplicate SMS cannot double-claim. The old code wrote to a
      // nonexistent `subscriptions` table (42P01 on every auto-activation)
      // non-transactionally.
      const client = await db.getClient()
      try {
        await client.query<never>('BEGIN')
        const claimUpd = await client.query<never>(
          `UPDATE payment_history
             SET status = 'completed',
                 updated_at = NOW(),
                 metadata = metadata || $2::jsonb
           WHERE id = $1 AND status = 'pending_review'`,
          [
            claim.id,
            JSON.stringify({
              autoVerifiedViaSms: true,
              verifiedAt: new Date().toISOString(),
              smsAmount: parsed.amount,
              smsSenderPhone: parsed.senderPhone,
              smsSenderName: parsed.senderName,
            }),
          ]
        )
        if ((claimUpd.rowCount ?? 0) === 0) {
          await client.query<never>('ROLLBACK')
          return NextResponse.json({
            success: true,
            action: 'already_processed',
            mpesaCode,
          })
        }

        await client.query<never>(
          `INSERT INTO user_subscriptions
               (user_id, plan_id, status, payment_method, currency,
                current_period_start, current_period_end)
           VALUES ($1, $2, 'active', 'mpesa_till', 'KES', $3, $4)
           ON CONFLICT (user_id)
           DO UPDATE SET plan_id = $2, status = 'active',
                         current_period_start = $3, current_period_end = $4,
                         payment_method = 'mpesa_till', updated_at = NOW()`,
          [claim.user_id, planId, periodStart.toISOString(), periodEnd.toISOString()]
        )

        await client.query<never>('COMMIT')
      } catch (txErr) {
        await client.query<never>('ROLLBACK').catch(() => {})
        throw txErr
      } finally {
        client.release()
      }

      // Send branded receipt
      const userRes = await db.query<UserRow>('SELECT id, email, name FROM users WHERE id = $1', [claim.user_id])
      const user = userRes.rows[0]

      if (user?.email) {
        try {
          const receipt = paymentReceiptEmail.render({
            to: user.email,
            name: user.name || 'Surveyor',
            planName: `${planDisplayName} Plan`,
            amount: parseFloat(claim.amount || String(parsed.amount || 500)),
            currency: claim.currency || 'KES',
            paidAt: new Date().toISOString(),
            transactionId: mpesaCode,
            paymentMethod: `M-Pesa Buy Goods · Till ${tillNumber}`,
          })

          await sendEmail({
            to: user.email,
            subject: receipt.subject,
            html: receipt.html,
            text: receipt.text,
          })
        } catch (emailErr) {
          logger.warn('[mpesa-sms-webhook] Failed to send receipt email:', { error: emailErr })
        }
      }

      logger.info('[mpesa-sms-webhook] Auto-approved pending claim via SMS', {
        mpesaCode,
        userId: claim.user_id,
        planId,
      })

      return NextResponse.json({
        success: true,
        action: 'activated_pending_claim',
        mpesaCode,
        userId: claim.user_id,
        planId,
        amount: parsed.amount,
      })
    }

    // 2. No pending claim found yet — store as unclaimed verified payment in payment_history
    const existingPayment = await db.query<{ id: string; status: string }>(
      'SELECT id, status FROM payment_history WHERE transaction_id = $1 LIMIT 1',
      [mpesaCode]
    )

    if (existingPayment.rows.length === 0) {
      await db.query<never>(
        `INSERT INTO payment_history
           (user_id, amount, currency, payment_method, provider, provider_id,
            status, transaction_id, metadata)
         VALUES ($1, $2, 'KES', 'mpesa_till', 'safaricom_buygoods', $3, 'unclaimed_payment', $4, $5)`,
        [
          null,
          parsed.amount || 500,
          // PAYMENTS CONTRACT FIX (2026-08-30): unique per transaction — the
          // sentinel `TILL_${tillNumber}` would collide on the second SMS
          // (migration 055's unique partial index on provider_id).
          `TILL_${tillNumber}_${mpesaCode}`,
          mpesaCode,
          JSON.stringify({
            tillNumber,
            mpesaCode,
            smsAmount: parsed.amount,
            smsSenderName: parsed.senderName || 'N/A',
            smsSenderPhone: parsed.senderPhone || 'N/A',
            smsTimestamp: parsed.timestamp || new Date().toISOString(),
            rawSms: parsed.rawText,
          }),
        ]
      )
    }

    return NextResponse.json({
      success: true,
      action: 'recorded_unclaimed_payment',
      mpesaCode,
      amount: parsed.amount,
      sender: parsed.senderName,
    })
  } catch (err) {
    logger.error('[mpesa-sms-webhook] Unexpected error:', { error: err })
    return NextResponse.json({ error: 'Internal server error processing SMS' }, { status: 500 })
  }
}
