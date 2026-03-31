import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { MpesaService } from '@/lib/payments/mpesa'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

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
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { amount, phoneNumber, purpose, referenceId, currency = 'KES' } = body

    if (!amount || !phoneNumber) {
      return NextResponse.json({ error: 'Amount and phone number required' }, { status: 400 })
    }

    const { data: paymentIntent, error: paymentError } = await supabase
      .from('payment_intents')
      .insert({
        user_id: user.id,
        amount,
        currency,
        amount_kes: amount,
        purpose,
        reference_id: referenceId,
        method: 'MPESA',
        status: 'PENDING'
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Payment intent error:', paymentError)
      return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
    }

    try {
      const mpesaResponse = await mpesa.initiateSTKPush({
        phoneNumber,
        amount,
        reference: `METARDU-${paymentIntent.id.slice(0, 8)}`,
        description: `Metardu ${purpose}`
      })

      await supabase
        .from('payment_intents')
        .update({
          provider_ref: mpesaResponse.checkoutRequestId,
          status: 'PROCESSING'
        })
        .eq('id', paymentIntent.id)

      return NextResponse.json({
        paymentIntentId: paymentIntent.id,
        checkoutRequestId: mpesaResponse.checkoutRequestId
      })

    } catch (mpesaError) {
      console.error('M-Pesa error:', mpesaError)
      
      await supabase
        .from('payment_intents')
        .update({ status: 'FAILED' })
        .eq('id', paymentIntent.id)

      return NextResponse.json({ 
        error: mpesaError instanceof Error ? mpesaError.message : 'M-Pesa payment failed' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('M-Pesa initiate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
