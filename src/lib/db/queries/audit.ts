/**
 * Audit Trail Database Queries
 *
 * Every survey operation must be logged for legal compliance.
 * This creates an immutable record of all computations and corrections.
 *
 * AUDIT FIX (H1, 2026-07-02): Rewrote from Prisma client to raw SQL.
 *
 * T1.9 FIX (2026-07-09): Fixed silent failure — the INSERT referenced columns
 * `entity_type`, `entity_id`, `user_name`, `changes` which DON'T EXIST in the
 * actual `audit_logs` table (migration 000_canonical_schema.sql:521). The real
 * columns are `table_name`, `record_id`, `details`. The catch block was silently
 * swallowing the Postgres error, so 4 admin routes believed they were audited
 * when nothing was being written. Now uses the correct column names.
 *
 * Real schema:
 *   CREATE TABLE audit_logs (
 *     id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *     action        VARCHAR(255),
 *     table_name    VARCHAR(255),
 *     record_id     UUID,
 *     user_id       UUID REFERENCES users(id),
 *     details       JSONB,
 *     ip_address    VARCHAR(45),
 *     created_at    TIMESTAMPTZ DEFAULT NOW()
 *   );
 */

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export interface CreateAuditEntry {
  entityType: string
  entityId: string
  action: string
  userId: string
  userName: string
  changes?: string
}

export interface AuditLogRow {
  id: string
  action: string | null
  table_name: string | null
  record_id: string | null
  user_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

/**
 * Create an audit log entry.
 * This is fire-and-forget — it should never block the main operation.
 *
 * T1.9: `userName` is stored inside `details` JSONB (no dedicated column).
 * `entityType` → `table_name`, `entityId` → `record_id`, `changes` → `details`.
 */
export async function createAuditLog(entry: CreateAuditEntry): Promise<AuditLogRow | null> {
  try {
    // Build details JSONB — stores userName + changes since there's no
    // dedicated column for them in the real schema.
    const details: Record<string, unknown> = {
      user_name: entry.userName,
    }
    if (entry.changes) {
      try {
        details.changes = JSON.parse(entry.changes)
      } catch {
        details.changes = entry.changes // store as string if not valid JSON
      }
    }

    const { rows } = await db.query(
      `INSERT INTO audit_logs (action, table_name, record_id, user_id, details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, action, table_name, record_id, user_id, details, ip_address, created_at`,
      [
        entry.action,
        entry.entityType,
        entry.entityId, // UUID — will fail if not a valid UUID, caught below
        entry.userId,
        JSON.stringify(details),
      ]
    )
    return rows[0] as AuditLogRow
  } catch (error) {
    // Audit logging should never fail the main operation — but it MUST be
    // visible when it fails so we can fix it. Log with full context.
    logger.error('[audit] createAuditLog FAILED (silent swallow was the old behavior):', {
      error: error instanceof Error ? error.message : String(error),
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      userId: entry.userId,
    })
    return null
  }
}

/**
 * Get audit trail for an entity.
 */
export async function getAuditTrail(
  entityType: string,
  entityId: string
): Promise<AuditLogRow[]> {
  const { rows } = await db.query(
    `SELECT id, action, table_name, record_id, user_id, details, ip_address, created_at
     FROM audit_logs
     WHERE table_name = $1 AND record_id = $2
     ORDER BY created_at DESC`,
    [entityType, entityId]
  )
  return rows as AuditLogRow[]
}

/**
 * Get recent audit entries for a user.
 */
export async function getRecentAuditEntries(
  userId: string,
  limit: number = 50
): Promise<AuditLogRow[]> {
  const { rows } = await db.query(
    `SELECT id, action, table_name, record_id, user_id, details, ip_address, created_at
     FROM audit_logs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  )
  return rows as AuditLogRow[]
}
