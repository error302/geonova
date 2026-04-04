import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import db from '@/lib/db'
import { MpesaService } from '@/lib/payments/mpesa'

const mpesa = new MpesaService({
  consumerKey: process.env.MPESA_CONSUMER_KEY || '',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  shortCode: process.env.MPESA_SHORT_CODE || process.env.MPESA_SHORTCODE || '',
  initiatorName: process.env.MPESA_INITIATOR_NAME || '',
  securityCredential: process.env.MPESA_SECURITY_CREDENTIAL || '',
  environment: (process.env.MPESA_ENV as 'sandbox' | 'production') || 'sandbox'
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { amount, phoneNumber, purpose, referenceId, currency = 'KES' } = body

    if (!amount || !phoneNumber) {
      return NextResponse.json({ error: 'Amount and phone number required' }, { status: 400 })
    }

    const paymentResult = await db.query(
      `INSERT INTO payment_intents (user_id, amount, currency, amount_kes, purpose, reference_id, method, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'MPESA', 'PENDING')
       RETURNING id`,
      [session.user.id, amount, currency, amount, purpose, referenceId]
    )

    if (paymentResult.rows.length === 0) {
      return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
    }

    const paymentIntent = paymentResult.rows[0]

    try {
      const mpesaResponse = await mpesa.initiateSTKPush({
        phoneNumber,
        amount,
        reference: `METARDU-${paymentIntent.id.slice(0, 8)}`,
        description: `Metardu ${purpose}`
      })

      await db.query(
        `UPDATE payment_intents SET provider_ref = $1, status = 'PROCESSING' WHERE id = $2`,
        [mpesaResponse.checkoutRequestId, paymentIntent.id]
      )

      return NextResponse.json({
        paymentIntentId: paymentIntent.id,
        checkoutRequestId: mpesaResponse.checkoutRequestId
      })

    } catch (mpesaError) {
      console.error('M-Pesa error:', mpesaError)
      
      await db.query(
        `UPDATE payment_intents SET status = 'FAILED' WHERE id = $1`,
        [paymentIntent.id]
      )

      return NextResponse.json({ 
        error: mpesaError instanceof Error ? mpesaError.message : 'M-Pesa payment failed' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('M-Pesa initiate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
