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
    if (!providedSecret || (expectedSecret && providedSecret !== expectedSecret)) {
      return NextResponse.json({ error: 'Unauthorized webhook access' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const smsText = (typeof body === 'string' ? body : (body.sms || body.message || body.text || body.content || '')) as string

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

      // Mark payment as completed
      await db.query(
        `UPDATE payment_history
         SET status = 'completed',
             updated_at = NOW(),
             metadata = metadata || $2::jsonb
         WHERE id = $1`,
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

      // Grant/extend 30 days of subscription
      const periodEnd = new Date()
      periodEnd.setDate(periodEnd.getDate() + 30)

      await db.query(
        `INSERT INTO subscriptions (user_id, plan, status, current_period_end)
         VALUES ($1, $2, 'active', $3)
         ON CONFLICT (user_id)
         DO UPDATE SET plan = $2, status = 'active', current_period_end = $3, updated_at = NOW()`,
        [claim.user_id, planId, periodEnd.toISOString()]
      )

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
      await db.query(
        `INSERT INTO payment_history
           (user_id, amount, currency, payment_method, provider, provider_id,
            status, transaction_id, metadata)
         VALUES ($1, $2, 'KES', 'mpesa_till', 'safaricom_buygoods', $3, 'unclaimed_payment', $4, $5)`,
        [
          null,
          parsed.amount || 500,
          `TILL_${tillNumber}`,
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
