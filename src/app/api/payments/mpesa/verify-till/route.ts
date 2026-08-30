export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { z } from 'zod'
import db from '@/lib/db'
import { getPlan, getPlanPrice } from '@/lib/subscription/catalog'
import { sendEmail } from '@/lib/email'
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

    // 2. Check for duplicate M-Pesa code across payment_history to prevent double-spending
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

    // 3. Resolve user details (account email only — client-supplied addresses
    //    are never used for delivery, see C-03 phishing note)
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

    // 5. Record the claim in payment_history as pending_review — no
    //    subscription mutation happens here (audit C-03).
    await db.query<never>(
      `INSERT INTO payment_history
         (user_id, amount, currency, payment_method, provider, provider_id,
          status, transaction_id, metadata)
       VALUES ($1, $2, 'KES', 'mpesa_till', 'safaricom_buygoods', $3, 'pending_review', $4, $5)`,
      [
        ctx.userId,
        amount,
        `TILL_${TILL_NUMBER}`,
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
