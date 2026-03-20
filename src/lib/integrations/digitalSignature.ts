/**
 * Digital Signature & QR Verification Service
 * Uses Web Crypto API (SubtleCrypto) — zero bundle cost, works in browsers natively
 */

const ALGORITHM = { name: 'HMAC', hash: 'SHA-256' }
const enc = new TextEncoder()
const dec = new TextDecoder()

export interface SignedDocument {
  documentId: string
  documentHash: string
  signature: string
  timestamp: number
  signerId: string
  metadata: Record<string, string>
}

export interface QRVerificationResult {
  valid: boolean
  document?: SignedDocument
  message: string
  verifiedAt: number
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('geonova-salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    ALGORITHM,
    false,
    ['sign', 'verify']
  )
}

async function hashContent(content: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(content))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacSign(key: CryptoKey, data: string): Promise<string> {
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function signDocument(
  documentId: string,
  content: string,
  signerId: string,
  secret: string,
  metadata: Record<string, string> = {}
): Promise<SignedDocument> {
  const documentHash = await hashContent(content)
  const key = await deriveKey(secret)
  const signature = await hmacSign(key, documentHash)
  return { documentId, documentHash, signature, timestamp: Date.now(), signerId, metadata }
}

export async function verifySignature(
  signedDoc: SignedDocument,
  originalContent: string,
  secret: string
): Promise<QRVerificationResult> {
  const computedHash = await hashContent(originalContent)
  if (computedHash !== signedDoc.documentHash) {
    return { valid: false, message: 'Document content has been modified', verifiedAt: Date.now() }
  }
  const key = await deriveKey(secret)
  const expectedSig = await hmacSign(key, signedDoc.documentHash)
  if (expectedSig !== signedDoc.signature) {
    return { valid: false, message: 'Invalid signature', verifiedAt: Date.now() }
  }
  return { valid: true, document: signedDoc, message: 'Document signature verified successfully', verifiedAt: Date.now() }
}

export function generateQRPayload(signedDoc: SignedDocument): string {
  const payload = { id: signedDoc.documentId, h: signedDoc.documentHash, s: signedDoc.signature, t: signedDoc.timestamp, si: signedDoc.signerId }
  return btoa(JSON.stringify(payload))
}

export function parseQRPayload(payload: string): SignedDocument | null {
  try {
    const decoded = JSON.parse(atob(payload))
    return { documentId: decoded.id, documentHash: decoded.h, signature: decoded.s, timestamp: decoded.t, signerId: decoded.si, metadata: {} }
  } catch { return null }
}

export async function createSurveyReportSignature(
  surveyId: string,
  surveyorLicense: string,
  measurements: Record<string, number>,
  secret: string
): Promise<SignedDocument> {
  const content = JSON.stringify({ surveyId, surveyorLicense, measurements }, Object.keys(measurements).sort())
  return signDocument(surveyId, content, surveyorLicense, secret, { type: 'survey_report' })
}
