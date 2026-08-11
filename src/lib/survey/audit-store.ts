// ──────────────────────────────────────────────────────────────────────────
// METARDU — Audit Trail Persistence Layer
// ──────────────────────────────────────────────────────────────────────────
// Stores audit entries in PostgreSQL for permanent, tamper-evident records.
// Uses the same raw pg Pool as the rest of the application.
// ──────────────────────────────────────────────────────────────────────────

import { getPool } from '@/lib/db';
import type { AuditEntry, AuditOperation } from './audit-trail';

// ─── Row Types ───────────────────────────────────────────────────────────

interface AuditTrailRow {
  id: string
  timestamp: Date
  survey_id: string
  project_id: string
  user_id: string
  operation: string
  inputs: string | Record<string, unknown>
  outputs: string | Record<string, unknown>
  corrections: string | unknown[]
  formula: string
  reference: string
  software_version: string
  checksum: string
  previous_hash: string | null
  chain_hash: string
  duration_ms: number
  accuracy_check: string | Record<string, unknown> | null
}

// ─── Table Initialization ────────────────────────────────────────────────

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS survey_audit_trail (
  id                TEXT PRIMARY KEY,
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT now(),
  survey_id         TEXT NOT NULL,
  project_id        TEXT NOT NULL,
  user_id           TEXT NOT NULL,
  operation         TEXT NOT NULL,
  inputs            JSONB NOT NULL,
  outputs           JSONB NOT NULL,
  corrections       JSONB NOT NULL DEFAULT '[]',
  formula           TEXT NOT NULL,
  reference         TEXT NOT NULL,
  software_version  TEXT NOT NULL,
  checksum          TEXT NOT NULL,
  previous_hash     TEXT,
  chain_hash        TEXT NOT NULL,
  duration_ms       INTEGER NOT NULL DEFAULT 0,
  accuracy_check    JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_survey ON survey_audit_trail(survey_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_project ON survey_audit_trail(project_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_user ON survey_audit_trail(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_operation ON survey_audit_trail(operation, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON survey_audit_trail(timestamp DESC);
`;

/**
 * Ensure the audit_trail table exists. Call once on startup or lazily.
 */
let tableEnsured = false;
export async function ensureAuditTable(): Promise<void> {
  if (tableEnsured) return;
  const pool = getPool();
  await pool.query(CREATE_TABLE_SQL);
  tableEnsured = true;
}

// ─── Write ───────────────────────────────────────────────────────────────

/**
 * Persist an audit entry to the database.
 */
export async function storeAuditEntry(entry: AuditEntry): Promise<void> {
  await ensureAuditTable();
  const pool = getPool();

  await pool.query(
    `INSERT INTO survey_audit_trail
       (id, timestamp, survey_id, project_id, user_id, operation,
        inputs, outputs, corrections, formula, reference,
        software_version, checksum, previous_hash, chain_hash,
        duration_ms, accuracy_check)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     ON CONFLICT (id) DO NOTHING`,
    [
      entry.id,
      entry.timestamp,
      entry.surveyId,
      entry.projectId,
      entry.userId,
      entry.operation,
      JSON.stringify(entry.inputs),
      JSON.stringify(entry.outputs),
      JSON.stringify(entry.correctionsApplied),
      entry.formula,
      entry.reference,
      entry.softwareVersion,
      entry.checksum,
      entry.previousHash,
      entry.chainHash,
      entry.durationMs,
      entry.accuracyCheck ? JSON.stringify(entry.accuracyCheck) : null,
    ]
  );
}

/**
 * Store multiple audit entries in a single transaction.
 */
export async function storeAuditEntriesBatch(entries: AuditEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await ensureAuditTable();
  const pool = getPool();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const entry of entries) {
      await client.query(
        `INSERT INTO survey_audit_trail
           (id, timestamp, survey_id, project_id, user_id, operation,
            inputs, outputs, corrections, formula, reference,
            software_version, checksum, previous_hash, chain_hash,
            duration_ms, accuracy_check)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (id) DO NOTHING`,
        [
          entry.id,
          entry.timestamp,
          entry.surveyId,
          entry.projectId,
          entry.userId,
          entry.operation,
          JSON.stringify(entry.inputs),
          JSON.stringify(entry.outputs),
          JSON.stringify(entry.correctionsApplied),
          entry.formula,
          entry.reference,
          entry.softwareVersion,
          entry.checksum,
          entry.previousHash,
          entry.chainHash,
          entry.durationMs,
          entry.accuracyCheck ? JSON.stringify(entry.accuracyCheck) : null,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Read ────────────────────────────────────────────────────────────────

/**
 * Get all audit entries for a survey, ordered by timestamp.
 */
export async function getAuditEntriesBySurvey(surveyId: string): Promise<AuditEntry[]> {
  await ensureAuditTable();
  const pool = getPool();

  const result = (await pool.query(
    `SELECT * FROM survey_audit_trail
     WHERE survey_id = $1
     ORDER BY timestamp ASC`,
    [surveyId]
  )) as { rows: AuditTrailRow[] };

  return result.rows.map(rowToAuditEntry);
}

/**
 * Get all audit entries for a project, ordered by timestamp.
 */
export async function getAuditEntriesByProject(projectId: string): Promise<AuditEntry[]> {
  await ensureAuditTable();
  const pool = getPool();

  const result = (await pool.query(
    `SELECT * FROM survey_audit_trail
     WHERE project_id = $1
     ORDER BY timestamp ASC`,
    [projectId]
  )) as { rows: AuditTrailRow[] };

  return result.rows.map(rowToAuditEntry);
}

/**
 * Get a single audit entry by ID.
 */
export async function getAuditEntryById(id: string): Promise<AuditEntry | null> {
  await ensureAuditTable();
  const pool = getPool();

  const result = (await pool.query(
    `SELECT * FROM survey_audit_trail WHERE id = $1`,
    [id]
  )) as { rows: AuditTrailRow[] };

  return result.rows.length > 0 ? rowToAuditEntry(result.rows[0]) : null;
}

/**
 * Get audit entries by operation type (for analytics).
 */
export async function getAuditEntriesByOperation(
  operation: AuditOperation,
  limit: number = 100
): Promise<AuditEntry[]> {
  await ensureAuditTable();
  const pool = getPool();

  const result = (await pool.query(
    `SELECT * FROM survey_audit_trail
     WHERE operation = $1
     ORDER BY timestamp DESC
     LIMIT $2`,
    [operation, limit]
  )) as { rows: AuditTrailRow[] };

  return result.rows.map(rowToAuditEntry);
}

/**
 * Get audit trail statistics for a project.
 */
export async function getAuditStats(projectId: string): Promise<{
  totalEntries: number;
  operations: Record<string, number>;
  accuracyChecks: { passed: number; failed: number };
  timespan: { first: string | null; last: string | null };
}> {
  await ensureAuditTable();
  const pool = getPool();

  const statsResult = (await pool.query(
    `SELECT
       COUNT(*) as total,
       operation,
       COUNT(*) as count
     FROM survey_audit_trail
     WHERE project_id = $1
     GROUP BY operation`,
    [projectId]
  )) as { rows: Array<{ operation: string; total: string | number; count: string | number }> };

  const accuracyResult = (await pool.query(
    `SELECT
       (accuracy_check->>'passed')::boolean as passed,
       COUNT(*) as count
     FROM survey_audit_trail
     WHERE project_id = $1 AND accuracy_check IS NOT NULL
     GROUP BY (accuracy_check->>'passed')::boolean`,
    [projectId]
  )) as { rows: Array<{ passed: boolean; count: string | number }> };

  const timespanResult = (await pool.query(
    `SELECT
       MIN(timestamp) as first,
       MAX(timestamp) as last
     FROM survey_audit_trail
     WHERE project_id = $1`,
    [projectId]
  )) as { rows: Array<{ first: Date | null; last: Date | null }> };

  const operations: Record<string, number> = {};
  for (const row of statsResult.rows) {
    operations[row.operation] = parseInt(String(row.count), 10);
  }

  let passed = 0;
  let failed = 0;
  for (const row of accuracyResult.rows) {
    if (row.passed) passed = parseInt(String(row.count), 10);
    else failed = parseInt(String(row.count), 10);
  }

  return {
    totalEntries: parseInt(String(statsResult.rows[0]?.total ?? '0'), 10),
    operations,
    accuracyChecks: { passed, failed },
    timespan: {
      first: timespanResult.rows[0]?.first ? new Date(timespanResult.rows[0].first).toISOString() : null,
      last: timespanResult.rows[0]?.last ? new Date(timespanResult.rows[0].last).toISOString() : null,
    },
  };
}

// ─── Chain Verification ──────────────────────────────────────────────────

/**
 * Verify the integrity of the audit chain for a project.
 * Reads all entries in order and checks hash chain continuity.
 */
export async function verifyAuditChain(projectId: string): Promise<{
  valid: boolean;
  totalEntries: number;
  brokenAt: number | null;
  brokenEntryId: string | null;
  details: string;
}> {
  const entries = await getAuditEntriesByProject(projectId);

  if (entries.length === 0) {
    return { valid: true, totalEntries: 0, brokenAt: null, brokenEntryId: null, details: 'No entries to verify.' };
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Check previous hash link
    const expectedPrevious = i === 0 ? null : entries[i - 1].chainHash;
    if (entry.previousHash !== expectedPrevious) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenAt: i,
        brokenEntryId: entry.id,
        details: `Chain break at entry ${i} (${entry.id}): previousHash mismatch`,
      };
    }

    // Verify checksum
    const { createHash } = await import('crypto');
    const data = JSON.stringify({ inputs: entry.inputs, outputs: entry.outputs });
    const expectedChecksum = createHash('sha256').update(data).digest('hex');
    if (entry.checksum !== expectedChecksum) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenAt: i,
        brokenEntryId: entry.id,
        details: `Checksum mismatch at entry ${i} (${entry.id}): data tampered`,
      };
    }
  }

  return {
    valid: true,
    totalEntries: entries.length,
    brokenAt: null,
    brokenEntryId: null,
    details: `All ${entries.length} entries verified. Chain intact.`,
  };
}

// ─── Row Mapper ──────────────────────────────────────────────────────────

function rowToAuditEntry(row: AuditTrailRow): AuditEntry {
  return {
    id: row.id as string,
    timestamp: (row.timestamp as Date).toISOString(),
    surveyId: row.survey_id as string,
    projectId: row.project_id as string,
    userId: row.user_id as string,
    operation: row.operation as AuditOperation,
    inputs: typeof row.inputs === 'string' ? ((JSON.parse(row.inputs as string) as unknown) as Record<string, unknown>) : (row.inputs as Record<string, unknown>),
    outputs: typeof row.outputs === 'string' ? ((JSON.parse(row.outputs as string) as unknown) as Record<string, unknown>) : (row.outputs as Record<string, unknown>),
    correctionsApplied: typeof row.corrections === 'string' ? ((JSON.parse(row.corrections as string) as unknown) as AuditEntry['correctionsApplied']) : (row.corrections as AuditEntry['correctionsApplied']),
    formula: row.formula as string,
    reference: row.reference as string,
    softwareVersion: row.software_version as string,
    checksum: row.checksum as string,
    previousHash: row.previous_hash as string | null,
    chainHash: row.chain_hash as string,
    durationMs: row.duration_ms as number,
    accuracyCheck: row.accuracy_check
      ? (typeof row.accuracy_check === 'string' ? ((JSON.parse(row.accuracy_check as string) as unknown) as AuditEntry['accuracyCheck']) : row.accuracy_check)
      : null,
  };
}
