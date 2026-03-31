import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { VerifySignatureResponse } from '@/types/signature'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { status: 'NOT_FOUND' as const, valid: false } as VerifySignatureResponse,
        { status: 400 }
      )
    }

    const { data: signature, error } = await supabase
      .from('document_signatures')
      .select('*')
      .eq('verification_token', token.toUpperCase())
      .single()

    if (error || !signature) {
      return NextResponse.json({
        status: 'NOT_FOUND',
        valid: false
      } as VerifySignatureResponse)
    }

    if (!signature.valid) {
      return NextResponse.json({
        valid: false,
        surveyorName: signature.surveyor_name,
        iskNumber: signature.isk_number,
        firmName: signature.firm_name,
        signedAt: signature.signed_at,
        documentType: signature.document_type,
        status: 'REVOKED',
        revokedAt: signature.revoked_at || undefined,
        revokedReason: signature.revoked_reason || undefined
      } as VerifySignatureResponse)
    }

    return NextResponse.json({
      valid: true,
      surveyorName: signature.surveyor_name,
      iskNumber: signature.isk_number,
      firmName: signature.firm_name,
      signedAt: signature.signed_at,
      documentType: signature.document_type,
      status: 'VALID'
    } as VerifySignatureResponse)

  } catch (error) {
    console.error('Verify signature error:', error)
    return NextResponse.json(
      { status: 'NOT_FOUND', valid: false } as VerifySignatureResponse,
      { status: 500 }
    )
  }
}
