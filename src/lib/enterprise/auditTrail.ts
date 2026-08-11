/**
 * Enterprise Audit Trail — Full audit logging system for METARDU
 *
 * Provides structured logging, paginated querying, timeline retrieval,
 * and CSV export of all significant actions across the platform.
 *
 * T1.9 FIX (2026-07-09): Fixed silent failure — the INSERT and SELECT
 * referenced columns `resource_type`, `resource_id`, `user_agent` which
 * DON'T EXIST in the actual `audit_logs` table. The real columns are
 * `table_name`, `record_id` (no `user_agent` — store in `details` JSONB).
 * The catch block in callers was silently swallowing the Postgres error.
 *
 * Real schema (migration 000_canonical_schema.sql:521):
 * ```sql
 * CREATE TABLE audit_logs (
 *   id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   action        VARCHAR(255),
 *   table_name    VARCHAR(255),
 *   record_id     UUID,
 *   user_id       UUID REFERENCES users(id),
 *   details       JSONB,
 *   ip_address    VARCHAR(45),
 *   created_at    TIMESTAMPTZ DEFAULT NOW()
 * );
 * ```
 */

import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEvent {
  id: string; // T1.9: UUID, not number (schema uses uuid_generate_v4)
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface AuditQuery {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// logAuditEvent
// ---------------------------------------------------------------------------

/**
 * Insert a new audit event into the audit_logs table.
 *
 * T1.9: `resourceType` → `table_name`, `resourceId` → `record_id`.
 * `userAgent` is stored inside `details` JSONB (no dedicated column).
 * Returns the inserted row id (UUID string) or throws on failure.
 */
export async function logAuditEvent(event: Omit<AuditEvent, 'id'>): Promise<string> {
  const { userId, action, resourceType, resourceId, details, ipAddress, userAgent, timestamp } = event;

  // Merge userAgent into details JSONB since there's no dedicated column.
  const fullDetails: Record<string, unknown> = { ...details };
  if (userAgent) {
    fullDetails.user_agent = userAgent;
  }

  const result = await db.query<{ id: string }>(
    `INSERT INTO audit_logs (action, table_name, record_id, user_id, details, ip_address, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      action,
      resourceType,        // → table_name
      resourceId ?? null,  // → record_id (UUID)
      userId,
      Object.keys(fullDetails).length > 0 ? JSON.stringify(fullDetails) : null,
      ipAddress ?? null,
      timestamp instanceof Date ? timestamp : new Date(),
    ],
  );

  return result.rows[0].id as string;
}

// ---------------------------------------------------------------------------
// queryAuditLogs
// ---------------------------------------------------------------------------

/**
 * Query audit logs with pagination and optional filters.
 * Returns both the matching events and the total count.
 *
 * T1.9: Uses real column names (table_name, record_id) and extracts
 * userAgent from the details JSONB.
 */
export async function queryAuditLogs(
  query: AuditQuery,
): Promise<{ events: AuditEvent[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (query.userId) {
    conditions.push(`al.user_id = $${paramIdx++}`);
    params.push(query.userId);
  }
  if (query.action) {
    conditions.push(`al.action = $${paramIdx++}`);
    params.push(query.action);
  }
  if (query.resourceType) {
    conditions.push(`al.table_name = $${paramIdx++}`); // T1.9: table_name
    params.push(query.resourceType);
  }
  if (query.resourceId) {
    conditions.push(`al.record_id = $${paramIdx++}`); // T1.9: record_id
    params.push(query.resourceId);
  }
  if (query.startDate) {
    conditions.push(`al.created_at >= $${paramIdx++}`);
    params.push(query.startDate);
  }
  if (query.endDate) {
    conditions.push(`al.created_at <= $${paramIdx++}`);
    params.push(query.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 500);
  const offset = Math.max(query.offset ?? 0, 0);

  // Count query
  const countResult = await db.query<{ total: string }>(
    `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
    params,
  );
  const total = parseInt(countResult.rows[0].total as string, 10) || 0;

  // Data query — T1.9: use real column names, extract userAgent from details
  const dataResult = await db.query(
    `SELECT al.id,
            al.user_id as "userId",
            al.action,
            al.table_name as "resourceType",
            al.record_id as "resourceId",
            al.details,
            al.ip_address as "ipAddress",
            al.created_at as "timestamp"
     FROM audit_logs al
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset],
  );

  const events: AuditEvent[] = dataResult.rows.map((row: Record<string, unknown>) => {
    const details = row.details as Record<string, unknown> | undefined;
    return {
      id: row.id as string,
      userId: row.userId as string,
      action: row.action as string,
      resourceType: row.resourceType as string,
      resourceId: (row.resourceId as string) || undefined,
      details,
      ipAddress: (row.ipAddress as string) || undefined,
      userAgent: (details?.user_agent as string) || undefined, // T1.9: extract from JSONB
      timestamp: new Date(row.timestamp as string),
    };
  });

  return { events, total };
}

// ---------------------------------------------------------------------------
// getAuditTimeline
// ---------------------------------------------------------------------------

/**
 * Get an activity timeline for a specific resource.
 */
export async function getAuditTimeline(
  resourceType: string,
  resourceId: string,
): Promise<AuditEvent[]> {
  const { rows } = await db.query(
    `SELECT al.id,
            al.user_id as "userId",
            al.action,
            al.table_name as "resourceType",
            al.record_id as "resourceId",
            al.details,
            al.ip_address as "ipAddress",
            al.created_at as "timestamp"
     FROM audit_logs al
     WHERE al.table_name = $1 AND al.record_id = $2
     ORDER BY al.created_at DESC
     LIMIT 500`,
    [resourceType, resourceId],
  );

  return rows.map((row: Record<string, unknown>) => {
    const details = row.details as Record<string, unknown> | undefined;
    return {
      id: row.id as string,
      userId: row.userId as string,
      action: row.action as string,
      resourceType: row.resourceType as string,
      resourceId: (row.resourceId as string) || undefined,
      details,
      ipAddress: (row.ipAddress as string) || undefined,
      userAgent: (details?.user_agent as string) || undefined,
      timestamp: new Date(row.timestamp as string),
    };
  });
}

// ---------------------------------------------------------------------------
// exportAuditCSV
// ---------------------------------------------------------------------------

/**
 * Export audit logs matching the query as a CSV string.
 */
export async function exportAuditCSV(query: AuditQuery): Promise<string> {
  const exportQuery: AuditQuery = {
    ...query,
    limit: Math.min(query.limit ?? 10000, 10000),
    offset: 0,
  };

  const { events } = await queryAuditLogs(exportQuery);

  const headers = [
    'id',
    'timestamp',
    'user_id',
    'action',
    'resource_type',
    'resource_id',
    'details',
    'ip_address',
    'user_agent',
  ];

  const rows = events.map((e) => {
    const detailsStr = e.details ? JSON.stringify(e.details) : '';
    return [
      String(e.id),
      e.timestamp.toISOString(),
      e.userId,
      csvEscape(e.action),
      csvEscape(e.resourceType),
      e.resourceId ? csvEscape(e.resourceId) : '',
      csvEscape(detailsStr),
      e.ipAddress ?? '',
      csvEscape(e.userAgent ?? ''),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (!value) return '""';
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}
