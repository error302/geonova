/**
 * @module cryptoSealing
 *
 * Cryptographic Digital Sealing for Field Records
 *
 * Implements PKI-based signing of survey observations:
 * 1. Generate ECDSA P-256 key pair per surveyor (stored in IndexedDB)
 * 2. Sign each beacon observation with private key
 * 3. Embed signature in exported data files
 * 4. Verify signature on import (tamper detection)
 *
 * Uses Web Crypto API (available in browsers and Node.js 18+):
 * - ECDSA with P-256 curve (FIPS 186-4)
 * - SHA-256 for hashing
 * - Base64 encoding for storage
 *
 * Legal significance:
 * - Signed records are admissible as evidence under Kenya Evidence Act
 * - Tampered files fail verification instantly
 * - Private key never leaves the device (non-repudiation)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SurveyorKeyPair {
  surveyorId: string
  publicKeyJwk: JsonWebKey
  privateKeyJwk: JsonWebKey
  createdAt: string
  fingerprint: string  // SHA-256 hash of public key (for verification)
}

export interface SealedRecord {
  /** The original data that was signed */
  data: {
    pointId: string
    wgs84Lat: number
    wgs84Lng: number
    arc1960Easting: number
    arc1960Northing: number
    gpsAccuracy: number
    capturedAt: string
    surveyorId: string
    surveyorLicense: string
  }
  /** ECDSA signature (base64) */
  signature: string
  /** Algorithm used */
  algorithm: 'ECDSA-SHA256'
  /** Public key fingerprint for verification */
  publicKeyFingerprint: string
  /** When the seal was created */
  sealedAt: string
}

export interface VerificationResult {
  isValid: boolean
  error?: string
  surveyorId?: string
  sealedAt?: string
  dataHash?: string
}

// ---------------------------------------------------------------------------
// Key Pair Management
// ---------------------------------------------------------------------------

const DB_NAME = 'metardu-crypto'
const DB_VERSION = 1
const STORE_NAME = 'keypairs'

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'surveyorId' })
      }
    }
  })
}

/**
 * Generate a new ECDSA P-256 key pair for a surveyor.
 * The private key never leaves the browser.
 */
export async function generateKeyPair(surveyorId: string): Promise<SurveyorKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,  // extractable (needed to export for storage)
    ['sign', 'verify'],
  )

  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)

  // Compute fingerprint (SHA-256 of public key)
  const publicKeyBytes = new TextEncoder().encode(JSON.stringify(publicKeyJwk))
  const fingerprintBuffer = await crypto.subtle.digest('SHA-256', publicKeyBytes)
  const fingerprint = Array.from(new Uint8Array(fingerprintBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const keyPairRecord: SurveyorKeyPair = {
    surveyorId,
    publicKeyJwk,
    privateKeyJwk,
    createdAt: new Date().toISOString(),
    fingerprint,
  }

  // Store in IndexedDB
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(keyPairRecord)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  return keyPairRecord
}

/**
 * Retrieve the surveyor's key pair from IndexedDB.
 */
export async function getKeyPair(surveyorId: string): Promise<SurveyorKeyPair | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(surveyorId)
    request.onsuccess = () => resolve((request.result as SurveyorKeyPair | null) ?? null)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Delete the surveyor's key pair (for account deletion).
 */
export async function deleteKeyPair(surveyorId: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(surveyorId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ---------------------------------------------------------------------------
// Sealing (Signing)
// ---------------------------------------------------------------------------

/**
 * Create a sealed record by signing the observation data.
 *
 * @param data - The observation data to seal
 * @param surveyorId - Surveyor's ID (must have a key pair)
 * @returns The sealed record with signature
 */
export async function sealRecord(
  data: SealedRecord['data'],
  surveyorId: string,
): Promise<SealedRecord> {
  // Get private key
  const keyPair = await getKeyPair(surveyorId)
  if (!keyPair) {
    throw new Error('No key pair found. Generate a key pair first.')
  }

  // Import private key
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    keyPair.privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  // Sign the data
  const dataBytes = new TextEncoder().encode(JSON.stringify(data))
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    dataBytes,
  )

  // Convert signature to base64
  const signature = btoa(
    String.fromCharCode(...new Uint8Array(signatureBuffer)),
  )

  return {
    data,
    signature,
    algorithm: 'ECDSA-SHA256',
    publicKeyFingerprint: keyPair.fingerprint,
    sealedAt: new Date().toISOString(),
  }
}

/**
 * Seal multiple records (batch signing for field book export).
 */
export async function sealRecords(
  records: SealedRecord['data'][],
  surveyorId: string,
): Promise<SealedRecord[]> {
  const sealed: SealedRecord[] = []
  for (const record of records) {
    sealed.push(await sealRecord(record, surveyorId))
  }
  return sealed
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Verify a sealed record's signature.
 *
 * @param sealedRecord - The sealed record to verify
 * @param publicKeyJwk - The surveyor's public key (JWK format)
 * @returns Verification result
 */
export async function verifySealedRecord(
  sealedRecord: SealedRecord,
  publicKeyJwk: JsonWebKey,
): Promise<VerificationResult> {
  try {
    // Import public key
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      publicKeyJwk,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )

    // Decode signature from base64
    const signatureBytes = Uint8Array.from(
      atob(sealedRecord.signature),
      c => c.charCodeAt(0),
    )

    // Verify
    const dataBytes = new TextEncoder().encode(JSON.stringify(sealedRecord.data))
    const isValid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      signatureBytes,
      dataBytes,
    )

    // Compute data hash for reference
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes)
    const dataHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return {
      isValid,
      surveyorId: sealedRecord.data.surveyorId,
      sealedAt: sealedRecord.sealedAt,
      dataHash,
      error: isValid ? undefined : 'Signature verification failed — data may have been tampered with',
    }
  } catch (err) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : 'Verification failed',
    }
  }
}

/**
 * Verify a batch of sealed records.
 */
export async function verifySealedRecords(
  sealedRecords: SealedRecord[],
  publicKeyJwk: JsonWebKey,
): Promise<VerificationResult[]> {
  const results: VerificationResult[] = []
  for (const record of sealedRecords) {
    results.push(await verifySealedRecord(record, publicKeyJwk))
  }
  return results
}

// ---------------------------------------------------------------------------
// Export/Import with Embedded Signatures
// ---------------------------------------------------------------------------

/**
 * Create a tamper-evident export file with cryptographic seals.
 * The output JSON contains both the data and the signatures.
 */
export async function createSealedExport(
  records: SealedRecord['data'][],
  surveyorId: string,
  metadata?: Record<string, unknown>,
): Promise<{
  format: 'metardu-sealed-v1'
  exportedAt: string
  surveyorId: string
  metadata?: Record<string, unknown>
  records: SealedRecord[]
}> {
  const sealedRecords = await sealRecords(records, surveyorId)

  return {
    format: 'metardu-sealed-v1',
    exportedAt: new Date().toISOString(),
    surveyorId,
    metadata,
    records: sealedRecords,
  }
}

/**
 * Verify an imported sealed export file.
 */
export async function verifySealedExport(
  exportData: {
    format: string
    records: SealedRecord[]
  },
  publicKeyJwk: JsonWebKey,
): Promise<{
  isValid: boolean
  totalRecords: number
  validRecords: number
  invalidRecords: number
  errors: string[]
}> {
  if (exportData.format !== 'metardu-sealed-v1') {
    return {
      isValid: false,
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      errors: ['Unknown export format'],
    }
  }

  const results = await verifySealedRecords(exportData.records, publicKeyJwk)
  const validCount = results.filter(r => r.isValid).length
  const invalidCount = results.length - validCount

  return {
    isValid: invalidCount === 0,
    totalRecords: results.length,
    validRecords: validCount,
    invalidRecords: invalidCount,
    errors: results.filter(r => !r.isValid).map(r => r.error || 'Unknown error'),
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Compute a SHA-256 hash of any data (for integrity checking).
 */
export async function computeHash(data: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Check if the browser supports Web Crypto API.
 */
export function isCryptoSupported(): boolean {
  return typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.subtle.generateKey === 'function'
}
