'use client';

import { useState } from 'react'
import { 
  signDocument, 
  verifySignature, 
  generateQRPayload, 
  parseQRPayload,
  createSurveyReportSignature,
  SignedDocument,
  QRVerificationResult
} from '@/lib/integrations/digitalSignature'

export default function DigitalSignaturePage() {
  const [, setValidationMsg] = useState<string|null>(null)
  const [activeTab, setActiveTab] = useState<'sign' | 'verify'>('sign')
  const [signForm, setSignForm] = useState({
    documentId: '',
    content: '',
    signerId: '',
    secret: ''
  })
  const [verifyForm, setVerifyForm] = useState({
    qrPayload: '',
    originalContent: '',
    secret: ''
  })
  const [signedDoc, setSignedDoc] = useState<SignedDocument | null>(null)
  const [verificationResult, setVerificationResult] = useState<QRVerificationResult | null>(null)
  const [qrCode, setQrCode] = useState('')

  const handleSign = async () => {
    if (!signForm.documentId || !signForm.content || !signForm.signerId || !signForm.secret) {
      setValidationMsg('Please fill all required fields.'); return
    }
    const signed = await signDocument(
      signForm.documentId,
      signForm.content,
      signForm.signerId,
      signForm.secret
    )
    setSignedDoc(signed)
    setQrCode(generateQRPayload(signed))
  }

  const handleVerify = async () => {
    if (!verifyForm.qrPayload || !verifyForm.originalContent || !verifyForm.secret) {
      setValidationMsg('Please fill all required fields.'); return
    }
    const parsed = parseQRPayload(verifyForm.qrPayload)
    if (!parsed) {
      setVerificationResult({
        valid: false,
        message: 'Invalid QR payload format',
        verifiedAt: Date.now()
      })
      return
    }
    const result = await verifySignature(parsed, verifyForm.originalContent, verifyForm.secret)
    setVerificationResult(result)
  }

  const handleSurveySign = async () => {
    if (!signForm.signerId || !signForm.secret) {
      setValidationMsg('Please enter your signer ID and secret key.'); return
    }
    const measurements: Record<string, number> = {
      pointA_Easting: 500000.00,
      pointA_Northing: 9800000.00,
      pointB_Easting: 500100.00,
      pointB_Northing: 9800100.00,
      distance_AB: 141.42,
      bearing_AB_Value: 45.0
    }
    const signed = await createSurveyReportSignature(
      `SURVEY-${Date.now()}`,
      signForm.signerId,
      measurements,
      signForm.secret
    )
    setSignedDoc(signed)
    setQrCode(generateQRPayload(signed))
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Digital Signature & QR Verification</h1>
        <p className="text-[var(--text-muted)] mb-8">Sign survey documents and verify signatures with QR codes</p>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('sign')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'sign' 
                ? 'bg-blue-600 text-white' 
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]'
            }`}
          >
            Sign Document
          </button>
          <button
            onClick={() => setActiveTab('verify')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'verify' 
                ? 'bg-blue-600 text-white' 
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)]'
            }`}
          >
            Verify Signature
          </button>
        </div>

        {activeTab === 'sign' && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <h2 className="text-xl font-semibold mb-4">Sign a Document</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="sig-document-id" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Document ID
                </label>
                <input
                  id="sig-document-id"
                  type="text"
                  value={signForm.documentId}
                  onChange={e => setSignForm({...signForm, documentId: e.target.value})}
                  aria-label="Document ID" placeholder="e.g., SURVEY-2024-001"
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="sig-content" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Document Content
                </label>
                <textarea
                  id="sig-content"
                  value={signForm.content}
                  onChange={e => setSignForm({...signForm, content: e.target.value})}
                  placeholder="Enter document content to sign..."
                  rows={4}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="sig-signer-id" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Signer ID (License Number)
                </label>
                <input
                  id="sig-signer-id"
                  type="text"
                  value={signForm.signerId}
                  onChange={e => setSignForm({...signForm, signerId: e.target.value})}
                  aria-label="Signer ID (License Number)" placeholder="e.g., LS/2024/1234"
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="sig-secret" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Secret Key
                </label>
                <input
                  id="sig-secret"
                  type="password"
                  value={signForm.secret}
                  onChange={e => setSignForm({...signForm, secret: e.target.value})}
                  aria-label="Secret key" placeholder="Enter signing secret"
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>

            <div className="flex gap-3 mb-6">
              <button
                onClick={handleSign}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Sign Document
              </button>
              <button
                onClick={handleSurveySign}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Quick Survey Report Sign
              </button>
            </div>

            {signedDoc && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-800 mb-2"> Document Signed Successfully</h3>
                <div className="text-sm text-green-700 space-y-1">
                  <p><strong>Document ID:</strong> {signedDoc.documentId}</p>
                  <p><strong>Signer:</strong> {signedDoc.signerId}</p>
                  <p><strong>Timestamp:</strong> {new Date(signedDoc.timestamp).toLocaleString()}</p>
                  <p><strong>Document Hash:</strong> <code className="text-xs">{signedDoc.documentHash}</code></p>
                  <p><strong>Signature:</strong> <code className="text-xs">{signedDoc.signature}</code></p>
                </div>
                
                {qrCode && (
                  <div className="mt-4 p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)]">
                    <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">QR Payload (Base64):</p>
                    <textarea
                      readOnly
                      value={qrCode}
                      className="w-full p-2 text-xs font-mono border rounded bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                      rows={3}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'verify' && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <h2 className="text-xl font-semibold mb-4">Verify a Signature</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="verify-qr" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  QR Payload (Base64)
                </label>
                <textarea
                  id="verify-qr"
                  value={verifyForm.qrPayload}
                  onChange={e => setVerifyForm({...verifyForm, qrPayload: e.target.value})}
                  placeholder="Paste QR payload from signed document..."
                  rows={3}
                  className="w-full p-2 border rounded-lg font-mono text-sm"
                />
              </div>
              <div>
                <label htmlFor="verify-original" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Original Document Content
                </label>
                <textarea
                  id="verify-original"
                  value={verifyForm.originalContent}
                  onChange={e => setVerifyForm({...verifyForm, originalContent: e.target.value})}
                  placeholder="Enter original document content..."
                  rows={4}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="verify-secret" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Secret Key
                </label>
                <input
                  id="verify-secret"
                  type="password"
                  value={verifyForm.secret}
                  onChange={e => setVerifyForm({...verifyForm, secret: e.target.value})}
                  aria-label="Secret key" placeholder="Enter signing secret"
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>

            <button
              onClick={handleVerify}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mb-6"
            >
              Verify Signature
            </button>

            {verificationResult && (
              <div className={`border rounded-lg p-4 ${
                verificationResult.valid 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <h3 className={`font-medium mb-2 ${
                  verificationResult.valid ? 'text-green-800' : 'text-red-800'
                }`}>
                  {verificationResult.valid ? ' Signature Verified' : '[x] Verification Failed'}
                </h3>
                <p className="text-sm">{verificationResult.message}</p>
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  Verified at: {new Date(verificationResult.verifiedAt).toLocaleString()}
                </p>
                
                {verificationResult.document && verificationResult.valid && (
                  <div className="mt-4 text-sm text-green-700">
                    <p><strong>Document ID:</strong> {verificationResult.document.documentId}</p>
                    <p><strong>Signer:</strong> {verificationResult.document.signerId}</p>
                    <p><strong>Signed:</strong> {new Date(verificationResult.document.timestamp).toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
