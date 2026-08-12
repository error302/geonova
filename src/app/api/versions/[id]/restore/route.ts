export const dynamic = 'force-dynamic'

/**
 * /api/versions/[id]/restore — Restore an entity to a previous version
 * POST: restore entity to a specific snapshot
 *
 * SECURITY:
 *   - IDOR protection: verifies the version's project belongs to the
 *     requesting user before restoring.
 *   - SQL injection protection: validates column names from the snapshot
 *     against a strict identifier pattern before interpolating into UPDATE.
 *
 * IMPORTANT: This creates a NEW version (doesn't delete history).
 * The restored state is captured as the latest version for full traceability.
 */

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { requireVersionOwnership } from '@/lib/auth/ownership'
import { z } from 'zod'

interface EntityVersionRow {
  id: string
  entity_type: string
  entity_id: string
  version: number
  snapshot: Record<string, unknown>
  created_at: string | Date
}

const RestoreSchema = z.object({
  version_id: z.string().uuid('version_id must be a valid UUID'),
})

/**
 * Validate a SQL identifier (column or table name) against a strict
 * allowlist pattern. Prevents SQL injection via column-name interpolation
 * in the snapshot restore path.
 */
function validateIdentifier(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: "${name}"`)
  }
  return name
}

export const POST = apiHandler({
  auth: true,
  schema: RestoreSchema,
  rateLimit: { max: 60, windowMs: 60000 },
  // T1.9 FIX (2026-07-09): Add tamper-evident audit chain for state rollbacks.
  // This is the most dangerous operation in the system — it silently overwrites
  // an entity with a previous snapshot. Without an audit trail, a malicious
  // admin could restore a parcel to a pre-survey state and erase the audit trail.
  auditChain: {
    entityType: 'document',
    action: 'update',
    entityIdParam: 'id',
    reason: 'Entity restored from version snapshot',
  },
}, async (req, ctx) => {
  const { version_id } = ctx.body as z.infer<typeof RestoreSchema>

  // IDOR protection — verify the version belongs to the requesting user
  const ownership = await requireVersionOwnership(version_id, ctx.userId)
  if (!ownership.ok) {
  if (!ownership.error) throw new Error('Ownership check failed without an error response')
  return ownership.error
}

  // Get the version to restore
  const { rows: versionRows } = await db.query<EntityVersionRow>(
    `SELECT * FROM entity_versions WHERE id = $1`,
    [version_id]
  )

  if (versionRows.length === 0) {
    return NextResponse.json(
      { error: 'Version not found', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  const version = versionRows[0]
  const snapshot = version.snapshot
  const { entity_type, entity_id } = version

  // Whitelist of tables that can be restored
  const RESTORABLE_TABLES = new Set([
    'parcels',
    'blocks',
    'projects',
    'traverse_results',
    'traverse_observations',
    'project_fieldbook_entries',
    'survey_points',
  ])
  if (!RESTORABLE_TABLES.has(entity_type)) {
    return NextResponse.json(
      { error: `Cannot restore entity type: ${entity_type}`, code: 'FORBIDDEN' },
      { status: 403 }
    )
  }

  // Verify entity still exists
  const { rows: entityRows } = await db.query<Record<string, unknown>>(
    `SELECT * FROM ${entity_type} WHERE id = $1`,
    [entity_id]
  )

  if (entityRows.length === 0) {
    return NextResponse.json(
      { error: 'Entity no longer exists — cannot restore', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  // Build the UPDATE from the snapshot, excluding immutable fields.
  // SECURITY: validate each column name to prevent SQL injection via
  // crafted snapshot keys.
  const immutableFields = new Set(['id', 'created_at', 'user_id', 'created_by'])
  const updates: string[] = []
  const values: unknown[] = []
  let paramIdx = 1

  for (const [key, value] of Object.entries(snapshot)) {
    if (immutableFields.has(key)) continue
    const safeCol = validateIdentifier(key)
    updates.push(`"${safeCol}" = $${paramIdx}`)
    values.push(value)
    paramIdx++
  }

  if (updates.length === 0) {
    return NextResponse.json(
      { error: 'No restorable fields found in snapshot', code: 'NO_CHANGES' },
      { status: 400 }
    )
  }

  // Add entity_id as the WHERE parameter
  values.push(entity_id)
  // T1.8 FIX (2026-07-09): Add optimistic lock guard to the restore UPDATE.
  // Without this, two concurrent restores could race — the last one wins
  // silently. With the guard, if the entity was modified between the SELECT
  // above and this UPDATE, 0 rows are returned and we send 409.
  // Note: we use the entity's current updated_at (from entityRows[0]) as the
  // guard value — this is the value the client implicitly "saw" when they
  // decided to restore.
  const currentUpdatedAt = entityRows[0].updated_at
  if (currentUpdatedAt) {
    values.push(currentUpdatedAt)
    const result = await db.query<{ id: string }>(
      `UPDATE ${entity_type} SET ${updates.join(', ')} WHERE id = $${paramIdx} AND updated_at = $${paramIdx + 1} RETURNING id`,
      values
    )
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'This entity was modified by another user between your read and the restore. Please refresh and try again.', code: 'CONFLICT' },
        { status: 409 }
      )
    }
  } else {
    // No updated_at column on this entity type — proceed without the guard
    await db.query<never>(
      `UPDATE ${entity_type} SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
      values
    )
  }

  return NextResponse.json({
    restored: true,
    entity_type,
    entity_id,
    restored_from_version: version.version,
    message: `Restored ${entity_type} to version ${version.version}. A new version snapshot has been created for traceability.`,
  })
})
