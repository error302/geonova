export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { z } from 'zod'
import db from '@/lib/db'
import { getPlan, getPlanPrice } from '@/lib/subscription/catalog'
import { sendEmail } from '@/lib/email'
import { paymentReceiptEmail } from '@/lib/email-templates/paymentReceipt'
import { logger } from '@/lib/logger'
import { getMpesaTillNumber } from '@/lib/payments/mpesaConfig'

const TILL_NUMBER = getMpesaTillNumber()

const VerifyTillSchema = z.object({
  planId: z.enum(['pro', 'team', 'firm', 'enterprise']).default('pro'),
  mpesaCode: z
    .string()
    .min(8)
    .max(15)
    .transform((val) => val.trim().toUpperCase()),
  phoneNumber: z.string().optional(),
  userEmail: z.string().email().optional(),
  userName: z.string().optional(),
})

interface PaymentHistoryRow {
  id: string
}

interface UserRow {
  id: string
  email: string
  name?: string
}

/**
 * POST /api/payments/mpesa/verify-till
 *
 * SECURITY (audit C-03, 2026-08-30): the Till (Buy Goods) flow cannot verify a
 * receipt against Safaricom from this endpoint — a regex on the code string
 * proves nothing. Previously ANY 8-12 character string instantly activated
 * any paid plan ("verification theater"). Claims are now recorded in
 * payment_history with status 'pending_review' and grant NOTHING until an
 * admin approves them against the merchant M-Pesa statement via
 * /api/admin/payments/till-claims.
 *
 * The client-supplied userEmail/userName fields are intentionally ignored for
 * delivery: confirmations go to the account's own email only, so this endpoint
 * cannot be used as a platform-branded phishing channel.
 */
export const POST = apiHandler(
  { auth: true, rateLimit: { max: 20, windowMs: 60000 }, schema: VerifyTillSchema },
  async (_req, ctx) => {
    const { planId, mpesaCode, phoneNumber } = ctx.body as z.infer<
      typeof VerifyTillSchema
    >

    // 1. Validate Safaricom M-Pesa Transaction Code format (typically 10 alphanumeric characters)
    const codeRegex = /^[A-Z0-9]{8,12}$/
    if (!codeRegex.test(mpesaCode)) {
      return NextResponse.json(
        { error: 'Invalid M-Pesa transaction code format. Must be an 8-12 character alphanumeric code (e.g. SHK489XZY1).' },
        { status: 400 }
      )
    }

    // 2. Check if a pre-verified SMS payment already exists on this Till
    const unclaimedRes = await db.query<{ id: string; amount: string; currency: string }>(
      `SELECT id, amount, currency FROM payment_history
       WHERE transaction_id = $1 AND status = 'unclaimed_payment'`,
      [mpesaCode]
    )

    // 3. Resolve user details
    const userRes = await db.query<UserRow>(
      `SELECT id, email, name FROM users WHERE id = $1`,
      [ctx.userId]
    )
    const user = userRes.rows[0]

    // 4. Resolve plan pricing
    const plan = getPlan(planId)
    const planDisplayName = plan?.name || (planId.toUpperCase() + ' Plan')
    const amount = getPlanPrice(planId, 'KES')
    const submittedAt = new Date().toISOString()

    // 2A. INSTANT ACTIVATION: If SMS was already received on Till, activate
    //    immediately — but only when the SMS amount matches the plan price
    //    (fail-closed, same rule as the M-Pesa callback's amount gate: a
    //    mismatch routes to manual review instead of auto-activation).
    if (unclaimedRes.rows.length > 0) {
      const unclaimed = unclaimedRes.rows[0]
      const smsAmount = Number(unclaimed.amount)

      if (
        !Number.isFinite(smsAmount) ||
        smsAmount <= 0 ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        Math.round(smsAmount) !== Math.round(amount)
      ) {
        // PAYMENTS CONTRACT FIX (2026-08-30): amounts disagree — do NOT
        // auto-activate. Flip the unclaimed row to pending_review with a
        // fraud flag so an admin can adjudicate with both numbers visible.
        await db.query<never>(
          `UPDATE payment_history
             SET status = 'pending_review',
                 user_id = COALESCE(user_id, $1),
                 updated_at = NOW(),
                 metadata = metadata || $2::jsonb
           WHERE id = $3`,
          [
            ctx.userId,
            JSON.stringify({
              fraudFlag: 'amount_mismatch',
              claimedByUserId: ctx.userId,
              claimedAt: submittedAt,
              smsAmount,
              expectedAmount: amount,
              planId,
            }),
            unclaimed.id,
          ]
        )
        logger.warn('[mpesa-till] SMS amount mismatch on instant-activation path', {
          userId: ctx.userId,
          planId,
          mpesaCode,
          smsAmount,
          expectedAmount: amount,
        })
        return NextResponse.json(
          {
            success: true,
            status: 'pending_review',
            message: `The received payment amount does not match the ${planDisplayName} plan price (KES ${amount}). Your claim has been queued for manual review.`,
            planId,
            planName: planDisplayName,
            amount,
            currency: 'KES',
            transactionId: mpesaCode,
            tillNumber: TILL_NUMBER,
            submittedAt,
          },
          { status: 202 }
        )
      }

      const periodStart = new Date()
      const periodEnd = new Date()
      periodEnd.setDate(periodEnd.getDate() + 30)

      // PAYMENTS CONTRACT FIX (2026-08-30): the claim completion and the
      // subscription grant must be ONE transaction — a crash between them
      // used to strand a completed payment with no subscription (and the
      // non-transactional version wrote to a nonexistent `subscriptions`
      // table, 42P01 at runtime, so this path never actually worked).
      const client = await db.getClient()
      try {
        await client.query('BEGIN')

        // Conditional claim: rowCount 0 means another request already
        // claimed this payment — idempotent under double-submit.
        const claimRes = await client.query(
          `UPDATE payment_history
             SET user_id = $1,
                 status = 'completed',
                 updated_at = NOW(),
                 metadata = metadata || $2::jsonb
           WHERE id = $3 AND status = 'unclaimed_payment'`,
          [
            ctx.userId,
            JSON.stringify({
              planId,
              claimedByUserId: ctx.userId,
              claimedAt: submittedAt,
              phoneNumber: phoneNumber || 'N/A',
            }),
            unclaimed.id,
          ]
        )
        if ((claimRes.rowCount ?? 0) === 0) {
          await client.query('ROLLBACK')
          return NextResponse.json(
            { error: 'This M-Pesa transaction code has already been claimed.' },
            { status: 409 }
          )
        }

        // user_subscriptions (NOT `subscriptions` — that table has never
        // existed; the old INSERT raised 42P01 on every instant activation).
        await client.query(
          `INSERT INTO user_subscriptions
               (user_id, plan_id, status, payment_method, currency,
                current_period_start, current_period_end)
           VALUES ($1, $2, 'active', 'mpesa_till', 'KES', $3, $4)
           ON CONFLICT (user_id)
           DO UPDATE SET plan_id = $2, status = 'active',
                         current_period_start = $3, current_period_end = $4,
                         payment_method = 'mpesa_till', updated_at = NOW()`,
          [ctx.userId, planId, periodStart.toISOString(), periodEnd.toISOString()]
        )

        await client.query('COMMIT')
      } catch (txErr) {
        await client.query('ROLLBACK').catch(() => {})
        throw txErr
      } finally {
        client.release()
      }

      // Send branded receipt
      if (user?.email) {
        try {
          const receipt = paymentReceiptEmail.render({
            to: user.email,
            name: user.name || 'Surveyor',
            planName: `${planDisplayName} Plan`,
            amount: parseFloat(unclaimed.amount || String(amount)),
            currency: unclaimed.currency || 'KES',
            paidAt: submittedAt,
            transactionId: mpesaCode,
            paymentMethod: `M-Pesa Buy Goods · Till ${TILL_NUMBER}`,
          })
          await sendEmail({
            to: user.email,
            subject: receipt.subject,
            html: receipt.html,
            text: receipt.text,
          })
        } catch (emailErr) {
          logger.warn('[mpesa-till] Failed to send instant receipt email:', { error: emailErr })
        }
      }

      logger.info('[mpesa-till] Instant plan activation from pre-verified SMS', {
        userId: ctx.userId,
        planId,
        mpesaCode,
      })

      return NextResponse.json({
        success: true,
        status: 'completed',
        activatedImmediately: true,
        message: `Payment verified instantly! Your ${planDisplayName} plan is now active.`,
        planId,
        planName: planDisplayName,
        amount,
        currency: 'KES',
        transactionId: mpesaCode,
        tillNumber: TILL_NUMBER,
        submittedAt,
      })
    }

    // 2B. Check for duplicate M-Pesa code across completed/pending claims
    const existingPayment = await db.query<PaymentHistoryRow>(
      `SELECT id FROM payment_history
       WHERE transaction_id = $1 OR (metadata->>'mpesaCode' = $1 AND status IN ('pending_review', 'completed'))`,
      [mpesaCode]
    )

    if (existingPayment.rows.length > 0) {
      return NextResponse.json(
        { error: 'This M-Pesa transaction code has already been submitted for verification.' },
        { status: 409 }
      )
    }

    // 5. Record the claim in payment_history as pending_review.
    //    PAYMENTS CONTRACT FIX (2026-08-30): provider_id must be UNIQUE per
    //    claim — every claim used the sentinel 'TILL_3370347', so the SECOND
    //    claim ever would violate migration 055's unique partial index
    //    (23505 → generic 409). Key it by the transaction code instead.
    await db.query<never>(
      `INSERT INTO payment_history
         (user_id, amount, currency, payment_method, provider, provider_id,
          status, transaction_id, metadata)
       VALUES ($1, $2, 'KES', 'mpesa_till', 'safaricom_buygoods', $3, 'pending_review', $4, $5)`,
      [
        ctx.userId,
        amount,
        `TILL_${TILL_NUMBER}_${mpesaCode}`,
        mpesaCode,
        JSON.stringify({
          tillNumber: TILL_NUMBER,
          planId,
          mpesaCode,
          phoneNumber: phoneNumber || 'N/A',
          submittedAt,
        }),
      ]
    )

    // 6. Acknowledge submission to the account email (plain confirmation, no receipt)
    if (user?.email) {
      try {
        await sendEmail({
          to: user.email,
          subject: `METARDU — M-Pesa payment received for review (${mpesaCode})`,
          html: `<p>Hi ${user.name || 'Surveyor'},</p>
<p>We received your M-Pesa payment claim for the <b>${planDisplayName} plan</b> (KES ${amount}, code <b>${mpesaCode}</b>, Till ${TILL_NUMBER}).</p>
<p>Our team verifies every Till payment against the merchant M-Pesa statement. Your plan activates automatically once the payment is confirmed — usually within a few hours.</p>
<p>If your payment is not confirmed within 24 hours, please reply to this email with a screenshot of the M-Pesa confirmation SMS.</p>
<p>— METARDU</p>`,
          text: `Hi ${user.name || 'Surveyor'}, we received your M-Pesa payment claim for the ${planDisplayName} plan (KES ${amount}, code ${mpesaCode}, Till ${TILL_NUMBER}). It is pending manual verification against the merchant statement; your plan activates once confirmed. — METARDU`,
        })
      } catch (emailErr) {
        logger.warn('[mpesa-till] Failed to send submission acknowledgment:', { error: emailErr })
      }
    }

    logger.info('[mpesa-till] Claim submitted for review', {
      userId: ctx.userId,
      planId,
      mpesaCode,
    })

    return NextResponse.json({
      success: true,
      status: 'pending_review',
      message: `Payment submitted for verification. Your ${planDisplayName} plan activates once the M-Pesa payment is confirmed (usually within a few hours).`,
      planId,
      planName: planDisplayName,
      amount,
      currency: 'KES',
      transactionId: mpesaCode,
      tillNumber: TILL_NUMBER,
      submittedAt,
    })
  }
)
