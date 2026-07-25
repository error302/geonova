/**
 * Audit Chain — Pure Functions
 * ============================
 *
 * Hash computation and canonical JSON serialization for the audit
 * chain. Extracted into a separate file so unit tests can import
 * these functions without pulling in the database module.
 *
 * See auditLog.ts for the full API including DB-backed functions.
 */

// ─── Types ──────────────────────────────────────────────────────────────

export type AuditEntityType =
  | 'control_point'
  | 'traverse'
  | 'leveling'
  | 'parcel'
  | 'alignment'
  | 'surface'
  | 'volume'
  | 'transformation'
  | 'document'
  | 'system'
  | 'custom'

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'adjust'
  | 'generate'
  | 'submit'
  | 'lock'
  | 'unlock'
  | 'sign'
  | 'validate'
  | 'import'
  | 'export'
  | 'custom'

export interface AuditPayload {
  old?: unknown
  new?: unknown
  reason?: string
  metadata?: Record<string, unknown>
}

// ─── Hashing ────────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 hash of an audit entry's canonical form.
 *
 * The hash includes the previous entry's hash, forming the chain.
 * Uses Web Crypto (available in both browser and Node 18+).
 *
 * @param previousHash - hash of the preceding entry, or null for genesis
 * @param sequence - monotonic sequence number
 * @param projectId - nullable project id
 * @param userId - nullable user id
 * @param entityType - entity type string
 * @param entityId - entity id string
 * @param action - action string
 * @param payload - audit payload object
 * @param createdAt - ISO timestamp string
 * @returns hex-encoded SHA-256 hash (64 chars)
 */
export async function computeEntryHash(params: {
  previousHash: string | null
  sequence: number
  projectId: string | null
  userId: string | null
  entityType: string
  entityId: string
  action: string
  payload: AuditPayload
  createdAt: string
}): Promise<string> {
  const canonical = [
    params.previousHash ?? '',
    params.sequence,
    params.projectId ?? '',
    params.userId ?? '',
    params.entityType,
    params.entityId,
    params.action,
    canonicalJSON(params.payload),
    params.createdAt,
  ].join('|')

  return sha256(canonical)
}

/**
 * SHA-256 hash function using Web Crypto.
 * Returns hex-encoded string (64 lowercase characters).
 */
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Canonical JSON serialization: sorted keys, no whitespace.
 * Ensures the same payload always produces the same hash regardless
 * of object key insertion order.
 *
 * Exported for testing.
 */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJSON).join(',') + ']'
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJSON(obj[k])).join(',') + '}'
}
