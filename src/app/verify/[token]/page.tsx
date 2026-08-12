import Link from 'next/link'
import { Check, X, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/api-client/server'
import { getPublicAppHost } from '@/lib/site'
import type { VerifySignatureResponse } from '@/types/signature'

interface DocumentSignatureRow {
  valid: boolean
  surveyor_name: string
  isk_number: string
  firm_name: string
  signed_at: string
  document_type: 'DEED_PLAN' | 'SURVEY_REPORT' | 'TRAVERSE_COMPUTATION'
  revoked_at: string | null
  revoked_reason: string | null
  verification_token: string
}

async function getVerification(token: string): Promise<VerifySignatureResponse> {
  const dbClient = await createClient()
  const { data, error } = (await dbClient
    .from('document_signatures')
    .select('*')
    .eq('verification_token', token.toUpperCase())
    .single()) as unknown as {
      data: DocumentSignatureRow | null
      error: { message: string } | null
    }

  if (error || !data) {
    return { status: 'NOT_FOUND', valid: false }
  }

  if (!data.valid) {
    return {
      valid: false,
      surveyorName: data.surveyor_name,
      iskNumber: data.isk_number,
      firmName: data.firm_name,
      signedAt: data.signed_at,
      documentType: data.document_type,
      status: 'REVOKED',
      revokedAt: data.revoked_at || undefined,
      revokedReason: data.revoked_reason || undefined
    }
  }

  return {
    valid: true,
    surveyorName: data.surveyor_name,
    iskNumber: data.isk_number,
    firmName: data.firm_name,
    signedAt: data.signed_at,
    documentType: data.document_type,
    status: 'VALID'
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

function getDocumentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    DEED_PLAN: 'Deed Plan',
    SURVEY_REPORT: 'Survey Report',
    TRAVERSE_COMPUTATION: 'Traverse Computation'
  }
  return labels[type] || type
}

export default async function VerifyPage({
  params
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const result = await getVerification(token)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden">
        {result.valid && result.status === 'VALID' && (
          <>
            <div className="bg-green-500 p-6 text-center">
              <Check className="w-16 h-16 text-white mx-auto" />
              <h1 className="text-2xl font-bold text-white mt-2">DOCUMENT VERIFIED</h1>
            </div>
            <div className="p-6">
              <p className="text-gray-600 text-center mb-6">
                This document has been digitally signed and is authentic.
              </p>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Signed by:</span>
                  <span className="font-medium">{result.surveyorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ISK No:</span>
                  <span className="font-medium">{result.iskNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Firm:</span>
                  <span className="font-medium">{result.firmName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date:</span>
                  <span className="font-medium">{result.signedAt ? formatDate(result.signedAt) : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Type:</span>
                  <span className="font-medium">{result.documentType ? getDocumentTypeLabel(result.documentType) : '—'}</span>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t text-center text-sm text-gray-500">
                <p>METARDU Survey Platform</p>
                <p className="text-xs">{getPublicAppHost()}</p>
              </div>
            </div>
          </>
        )}

        {result.status === 'REVOKED' && (
          <>
            <div className="bg-red-500 p-6 text-center">
              <AlertTriangle className="w-16 h-16 text-white mx-auto" />
              <h1 className="text-2xl font-bold text-white mt-2">DOCUMENT REVOKED</h1>
            </div>
            <div className="p-6">
              <p className="text-red-600 text-center mb-4">
                This document signature has been revoked.
              </p>
              {result.revokedAt && (
                <p className="text-sm text-gray-600 text-center">
                  Revoked on: {formatDate(result.revokedAt)}
                </p>
              )}
              {result.revokedReason && (
                <p className="text-sm text-gray-600 text-center mt-2">
                  Reason: {result.revokedReason}
                </p>
              )}
            </div>
          </>
        )}

        {result.status === 'NOT_FOUND' && (
          <>
            <div className="bg-gray-400 p-6 text-center">
              <X className="w-16 h-16 text-white mx-auto" />
              <h1 className="text-2xl font-bold text-white mt-2">NOT FOUND</h1>
            </div>
            <div className="p-6">
              <p className="text-gray-600 text-center">
                Verification code not found. This document may not have been
                signed through METARDU, or the code may be incorrect.
              </p>
              <div className="mt-6 text-center">
                <Link
                  href="/"
                  className="inline-block px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
                >
                  Go to METARDU
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
