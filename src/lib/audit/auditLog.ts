/**
 * Audit Chain — Tamper-Evident Append-Only Log
 * =============================================
 *
 * A cryptographic hash chain that records every significant change
 * to survey data (coordinate edits, traverse adjustments, parcel
 * boundary changes, deed plan generation, NLIMS submissions).
 *
 * Each entry's hash includes the previous entry's hash, forming a
 * chain. Tampering with any past entry breaks the chain, and
 * verifyChain() flags it. This is the Estonia e-Land pattern —
 * simple, no PKI required, auditable by Survey of Kenya without
 * any new infrastructure on their end.
 *
 * Why this exists
 * ---------------
 * The existing audit_logs table (migration 005) captures row-level
 * changes via DB triggers. But it's NOT tamper-evident: a DBA or
 * anyone with direct DB access can modify or delete past entries
 * undetected. That's the fraud vector this module closes.
 *
 * The application-level audit_chain (migration 024) is explicitly
 * appended to at key change points. Each entry carries:
 *   - who made the change (user_id + user_name)
 *   - what entity changed (entity_type + entity_id)
 *   - what action was taken (create/update/delete/adjust/...)
 *   - the before/after payload (old/new values, reason)
 *   - previous_hash + entry_hash (the chain)
 *
 * Hash chain formula
 * ------------------
 *   entry_hash = SHA-256(
 *     previous_hash + '|' +
 *     sequence + '|' +
 *     project_id + '|' +
 *     user_id + '|' +
 *     entity_type + '|' +
 *     entity_id + '|' +
 *     action + '|' +
 *     canonicalJSON(payload) + '|' +
 *     created_at
 *   )
 *
 * The '|' separator prevents ambiguity from concatenation.
 * canonicalJSON sorts object keys so the same payload always
 * produces the same hash.
 *
 * Verification
 * ------------
 * verifyChain(projectId?) walks entries in sequence order and reports
 * any entry where:
 *   - recomputed entry_hash != stored entry_hash (entry was modified)
 *   - stored previous_hash != prior entry's entry_hash (entry was
 *     inserted or deleted mid-chain)
 *
 * Both cases prove tampering.
 *
 * Usage
 * -----
 *   import { appendAuditEntry, verifyChain } from '@/lib/audit/auditLog'
 *
 *   // Record a coordinate change
 *   await appendAuditEntry({
 *     projectId: '...',
 *     userId: '...',
 *     userName: 'Jane Doe',
 *     entityType: 'control_point',
 *     entityId: 'CP1',
 *     action: 'update',
 *     payload: { old: { easting: 250000 }, new: { easting: 250050 }, reason: 'Helmert recalibration' },
 *   })
 *
 *   // Verify integrity (e.g. before generating a deed plan)
 *   const verification = await verifyChain({ projectId: '...' })
 *   if (!verification.valid) {
 *     throw new Error(`Audit chain tampered: ${verification.brokenEntries.length} entries modified`)
 *   }
 */

import { db } from '@/lib/db'
import {
  computeEntryHash,
  canonicalJSON,
  type AuditEntityType,
  type AuditAction,
  type AuditPayload,
} from './auditHash'

// Re-export the pure functions and types so callers can import everything
// from a single module.
export {
  computeEntryHash,
  canonicalJSON,
  type AuditEntityType,
  type AuditAction,
  type AuditPayload,
}

// ─── Types ──────────────────────────────────────────────────────────────
//
// AuditEntityType, AuditAction, and AuditPayload are defined in
// auditHash.ts and re-exported above. Only the DB-coupled types
// live here.

/**
 * Input for appending a new audit entry.
 */
export interface AppendAuditEntryInput {
  projectId?: string | null
  userId?: string | null
  userName?: string | null
  entityType: AuditEntityType
  entityId: string
  action: AuditAction
  payload: AuditPayload
}

/**
 * A stored audit entry as returned from the database.
 */
export interface AuditEntry {
  id: string
  sequence: number
  projectId: string | null
  userId: string | null
  userName: string | null
  entityType: string
  entityId: string
  action: string
  previousHash: string | null
  entryHash: string
  payload: AuditPayload
  createdAt: string
}

/**
 * Result of verifying the chain integrity.
 */
export interface ChainVerification {
  /** True iff every entry's hash is valid and the chain is unbroken */
  valid: boolean
  /** Total entries checked */
  totalEntries: number
  /** Entries where the hash doesn't match (entry was modified after insert) */
  modifiedEntries: Array<{
    sequence: number
    id: string
    storedHash: string
    recomputedHash: string
  }>
  /** Entries where previous_hash doesn't match the prior entry's hash
   *  (entry was inserted or deleted mid-chain) */
  brokenLinks: Array<{
    sequence: number
    id: string
    expectedPreviousHash: string | null
    actualPreviousHash: string | null
  }>
}

// ─── Hashing ────────────────────────────────────────────────────────────
//
// computeEntryHash, sha256, and canonicalJSON live in auditHash.ts
// (pure module with no DB dependency, for testability).
// They're re-exported at the top of this file.

// ─── Database row mapping ───────────────────────────────────────────────

interface AuditChainRow {
  id: string
  sequence: string | number // pg returns BIGSERIAL as string sometimes
  project_id: string | null
  user_id: string | null
  user_name: string | null
  entity_type: string
  entity_id: string
  action: string
  previous_hash: string | null
  entry_hash: string
  payload: AuditPayload | string
  created_at: Date | string
}

function rowToEntry(row: AuditChainRow): AuditEntry {
  return {
    id: row.id,
    sequence: Number(row.sequence),
    projectId: row.project_id,
    userId: row.user_id,
    userName: row.user_name,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    previousHash: row.previous_hash,
    entryHash: row.entry_hash,
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Append a new entry to the audit chain.
 *
 * This function:
 *   1. Fetches the previous entry's hash (the tail of the chain)
 *   2. Computes this entry's hash including the previous hash
 *   3. Inserts the entry
 *
 * The fetch-and-insert is NOT atomic across concurrent transactions
 * in this implementation — for true atomicity we'd need a DB-level
 * advisory lock or a stored procedure. For now, the BIGSERIAL
 * sequence number ensures ordering is preserved even if two appends
 * race; the second one's previous_hash will point at the first one's
 * entry_hash because the SELECT happens after the first INSERT commits.
 *
 * For high-concurrency scenarios, wrap calls in a serialized
 * transaction or use the DB-level appendAuditEntry() stored procedure
 * (future work).
 *
 * @throws {Error} if the database insert fails
 */
export async function appendAuditEntry(
  input: AppendAuditEntryInput
): Promise<AuditEntry> {
  // 1. Get the previous entry's hash (tail of the chain)
  //    Filtered by project_id if provided, for per-project chains.
  //    System-wide events (null project_id) are on the global chain.
  const tailQuery = input.projectId
    ? 'SELECT entry_hash, sequence FROM audit_chain WHERE project_id = $1 ORDER BY sequence DESC LIMIT 1'
    : 'SELECT entry_hash, sequence FROM audit_chain WHERE project_id IS NULL ORDER BY sequence DESC LIMIT 1'
  const tailParams = input.projectId ? [input.projectId] : []
  const tailResult = await db.query(tailQuery, tailParams)

  const previousHash = tailResult.rows.length > 0
    ? (tailResult.rows[0] as AuditChainRow).entry_hash
    : null
  const previousSequence = tailResult.rows.length > 0
    ? Number((tailResult.rows[0] as AuditChainRow).sequence)
    : 0

  // 2. Compute this entry's hash
  //    We use a provisional sequence (previous + 1) and createdAt (now)
  //    for the hash computation. The actual sequence is assigned by
  //    BIGSERIAL on insert — if it doesn't match our provisional value
  //    (due to concurrent inserts), the chain verification will catch
  //    it and we'd need to recompute. In practice, single-threaded
  //    appends from the application layer mean this is rarely an issue.
  const provisionalSequence = previousSequence + 1
  const createdAt = new Date().toISOString()
  const entryHash = await computeEntryHash({
    previousHash,
    sequence: provisionalSequence,
    projectId: input.projectId ?? null,
    userId: input.userId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    payload: input.payload,
    createdAt,
  })

  // 3. Insert
  const insertResult = await db.query(
    `INSERT INTO audit_chain
       (project_id, user_id, user_name, entity_type, entity_id, action,
        previous_hash, entry_hash, payload, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     RETURNING *`,
    [
      input.projectId ?? null,
      input.userId ?? null,
      input.userName ?? null,
      input.entityType,
      input.entityId,
      input.action,
      previousHash,
      entryHash,
      JSON.stringify(input.payload),
    ]
  )

  const inserted = rowToEntry(insertResult.rows[0] as AuditChainRow)

  // 4. If the actual sequence doesn't match our provisional value,
  //    the stored hash is wrong. Recompute and update.
  //    (Rare race condition path.)
  if (inserted.sequence !== provisionalSequence) {
    const correctedHash = await computeEntryHash({
      previousHash,
      sequence: inserted.sequence,
      projectId: input.projectId ?? null,
      userId: input.userId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      payload: input.payload,
      createdAt: inserted.createdAt,
    })
    await db.query(
      'UPDATE audit_chain SET entry_hash = $1 WHERE id = $2',
      [correctedHash, inserted.id]
    )
    inserted.entryHash = correctedHash
  }

  return inserted
}

/**
 * Verify the integrity of the audit chain.
 *
 * Walks entries in sequence order and reports any entry where:
 *   - recomputed entry_hash != stored entry_hash (entry was modified)
 *   - stored previous_hash != prior entry's entry_hash (entry was
 *     inserted or deleted mid-chain)
 *
 * @param filter - optional filter to verify only a specific project's chain
 * @returns verification result with lists of broken entries
 */
export async function verifyChain(filter?: {
  projectId?: string
}): Promise<ChainVerification> {
  const query = filter?.projectId
    ? 'SELECT * FROM audit_chain WHERE project_id = $1 ORDER BY sequence ASC'
    : 'SELECT * FROM audit_chain ORDER BY sequence ASC'
  const params = filter?.projectId ? [filter.projectId] : []
  const result = await db.query(query, params)

  const entries = result.rows.map(rowToEntry)
  const modifiedEntries: ChainVerification['modifiedEntries'] = []
  const brokenLinks: ChainVerification['brokenLinks'] = []

  let expectedPreviousHash: string | null = null

  for (const entry of entries) {
    // Check link integrity
    if (entry.previousHash !== expectedPreviousHash) {
      brokenLinks.push({
        sequence: entry.sequence,
        id: entry.id,
        expectedPreviousHash: expectedPreviousHash,
        actualPreviousHash: entry.previousHash,
      })
    }

    // Recompute hash and check
    const recomputedHash = await computeEntryHash({
      previousHash: entry.previousHash,
      sequence: entry.sequence,
      projectId: entry.projectId,
      userId: entry.userId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      payload: entry.payload,
      createdAt: entry.createdAt,
    })

    if (recomputedHash !== entry.entryHash) {
      modifiedEntries.push({
        sequence: entry.sequence,
        id: entry.id,
        storedHash: entry.entryHash,
        recomputedHash,
      })
    }

    expectedPreviousHash = entry.entryHash
  }

  return {
    valid: modifiedEntries.length === 0 && brokenLinks.length === 0,
    totalEntries: entries.length,
    modifiedEntries,
    brokenLinks,
  }
}

/**
 * Query audit entries for a project, entity, or user.
 *
 * Returns entries in sequence order (oldest first) by default.
 */
export async function queryAuditEntries(filter: {
  projectId?: string
  entityType?: AuditEntityType
  entityId?: string
  userId?: string
  limit?: number
  offset?: number
  newestFirst?: boolean
}): Promise<AuditEntry[]> {
  const conditions: string[] = []
  const params: unknown[] = []
  let paramIdx = 1

  if (filter.projectId !== undefined) {
    conditions.push(`project_id = $${paramIdx++}`)
    params.push(filter.projectId)
  }
  if (filter.entityType !== undefined) {
    conditions.push(`entity_type = $${paramIdx++}`)
    params.push(filter.entityType)
  }
  if (filter.entityId !== undefined) {
    conditions.push(`entity_id = $${paramIdx++}`)
    params.push(filter.entityId)
  }
  if (filter.userId !== undefined) {
    conditions.push(`user_id = $${paramIdx++}`)
    params.push(filter.userId)
  }

  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : ''

  const orderClause = filter.newestFirst ? 'ORDER BY sequence DESC' : 'ORDER BY sequence ASC'
  const limitClause = filter.limit !== undefined ? `LIMIT $${paramIdx++}` : ''
  if (filter.limit !== undefined) params.push(filter.limit)
  const offsetClause = filter.offset !== undefined ? `OFFSET $${paramIdx++}` : ''
  if (filter.offset !== undefined) params.push(filter.offset)

  const query = `SELECT * FROM audit_chain ${whereClause} ${orderClause} ${limitClause} ${offsetClause}`.trim()
  const result = await db.query(query, params)
  return result.rows.map(rowToEntry)
}

/**
 * Get a human-readable summary of the chain state.
 * Useful for display in the UI or for a surveyor's compliance report.
 */
export async function getChainSummary(filter?: {
  projectId?: string
}): Promise<{
  totalEntries: number
  earliestEntry?: string
  latestEntry?: string
  uniqueUsers: number
  uniqueEntities: number
  isValid: boolean
  brokenEntryCount: number
}> {
  const query = filter?.projectId
    ? 'SELECT * FROM audit_chain WHERE project_id = $1 ORDER BY sequence ASC'
    : 'SELECT * FROM audit_chain ORDER BY sequence ASC'
  const params = filter?.projectId ? [filter.projectId] : []
  const result = await db.query(query, params)
  const entries = result.rows.map(rowToEntry)

  if (entries.length === 0) {
    return {
      totalEntries: 0,
      uniqueUsers: 0,
      uniqueEntities: 0,
      isValid: true,
      brokenEntryCount: 0,
    }
  }

  const verification = await verifyChain(filter)
  const users = new Set(entries.map((e) => e.userId).filter(Boolean))
  const entities = new Set(entries.map((e) => `${e.entityType}/${e.entityId}`))

  return {
    totalEntries: entries.length,
    earliestEntry: entries[0]?.createdAt,
    latestEntry: entries[entries.length - 1]?.createdAt,
    uniqueUsers: users.size,
    uniqueEntities: entities.size,
    isValid: verification.valid,
    brokenEntryCount: verification.modifiedEntries.length + verification.brokenLinks.length,
  }
}
