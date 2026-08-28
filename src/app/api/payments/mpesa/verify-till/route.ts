export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { z } from 'zod'
import db from '@/lib/db'
import { getPlan, getPlanPrice } from '@/lib/subscription/catalog'
import { sendEmail } from '@/lib/email'
import { paymentReceiptEmail } from '@/lib/email-templates/paymentReceipt'
import { logger } from '@/lib/logger'

const TILL_NUMBER = '3370347'

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

interface SubscriptionRow {
  id: string
}

interface PaymentHistoryRow {
  id: string
}

interface UserRow {
  id: string
  email: string
  name?: string
}

export const POST = apiHandler(
  { auth: true, rateLimit: { max: 20, windowMs: 60000 }, schema: VerifyTillSchema },
  async (_req, ctx) => {
    const { planId, mpesaCode, phoneNumber, userEmail, userName } = ctx.body as z.infer<
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
       WHERE transaction_id = $1 OR (metadata->>'mpesaCode' = $1 AND status = 'completed')`,
      [mpesaCode]
    )

    if (existingPayment.rows.length > 0) {
      return NextResponse.json(
        { error: 'This M-Pesa transaction code has already been verified and claimed.' },
        { status: 409 }
      )
    }

    // 3. Resolve user details
    const userRes = await db.query<UserRow>(
      `SELECT id, email, name FROM users WHERE id = $1`,
      [ctx.userId]
    )
    const user = userRes.rows[0]
    const recipientEmail = userEmail || user?.email || ''
    const recipientName = userName || user?.name || 'Surveyor'

    // 4. Resolve plan pricing
    const plan = getPlan(planId)
    const planDisplayName = plan?.name || (planId.toUpperCase() + ' Plan')
    const amount = getPlanPrice(planId, 'KES')
    const paidAt = new Date().toISOString()
    const periodStart = new Date().toISOString()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // 5. Record payment in payment_history
    await db.query<never>(
      `INSERT INTO payment_history
         (user_id, amount, currency, payment_method, provider, provider_id,
          status, transaction_id, metadata)
       VALUES ($1, $2, 'KES', 'mpesa_till', 'safaricom_buygoods', $3, 'completed', $4, $5)`,
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
          verifiedAt: paidAt,
        }),
      ]
    )

    // 6. Activate or upgrade user subscription
    const existingSub = await db.query<SubscriptionRow>(
      'SELECT id FROM user_subscriptions WHERE user_id = $1',
      [ctx.userId]
    )

    if (existingSub.rows.length > 0) {
      await db.query<never>(
        `UPDATE user_subscriptions
         SET plan_id = $1, status = 'active', payment_method = 'mpesa_till',
             currency = 'KES', current_period_start = $2, current_period_end = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [planId, periodStart, periodEnd, existingSub.rows[0].id]
      )
    } else {
      await db.query<never>(
        `INSERT INTO user_subscriptions
           (user_id, plan_id, status, payment_method, currency,
            current_period_start, current_period_end)
         VALUES ($1, $2, 'active', 'mpesa_till', 'KES', $3, $4)`,
        [ctx.userId, planId, periodStart, periodEnd]
      )
    }

    // 7. Dispatch custom branded HTML email receipt
    let receiptSent = false
    if (recipientEmail) {
      try {
        const receipt = paymentReceiptEmail.render({
          to: recipientEmail,
          name: recipientName,
          planName: `${planDisplayName} Plan`,
          amount,
          currency: 'KES',
          paidAt,
          transactionId: mpesaCode,
          paymentMethod: `M-Pesa Buy Goods · Till ${TILL_NUMBER}`,
        })

        const emailRes = await sendEmail({
          to: recipientEmail,
          subject: receipt.subject,
          html: receipt.html,
          text: receipt.text,
        })
        receiptSent = !!emailRes.success
      } catch (emailErr) {
        logger.warn('[mpesa-till] Failed to send email receipt:', { error: emailErr })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully verified M-Pesa payment for ${planDisplayName} plan.`,
      planId,
      planName: planDisplayName,
      amount,
      currency: 'KES',
      transactionId: mpesaCode,
      tillNumber: TILL_NUMBER,
      receiptSent,
      expiresAt: periodEnd,
    })
  }
)
