export const dynamic = 'force-dynamic'

/**
 * /api/versions — Entity version history
 * GET: list version history for an entity
 * POST: create manual snapshot
 */

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { z } from 'zod'

/** Entity types that support versioning — moved to shared module to avoid Next.js route type inference */
import { VERSIONED_ENTITY_TYPES, type VersionedEntityType } from '@/lib/validation/versionedEntities'

interface EntityVersionRow {
  id: string
  entity_type: string
  entity_id: string
  version: number
  snapshot: Record<string, unknown> | null
  delta: Record<string, unknown> | null
  change_summary: string | null
  created_by: string | null
  created_at: Date | string
}

const ListVersionsSchema = z.object({
  entity_type: z.enum(VERSIONED_ENTITY_TYPES),
  entity_id: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, _ctx) => {
  const { searchParams } = new URL(req.url)

  // Validate query params via Zod
  const parsed = ListVersionsSchema.safeParse({
    entity_type: searchParams.get('entity_type'),
    entity_id: searchParams.get('entity_id'),
    limit: searchParams.get('limit'),
    offset: searchParams.get('offset'),
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { entity_type, entity_id, limit, offset } = parsed.data

  const { rows } = await db.query<EntityVersionRow>(
    `SELECT id, entity_type, entity_id, version, snapshot, delta, change_summary, created_by, created_at
     FROM entity_versions
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY version DESC
     LIMIT $3 OFFSET $4`,
    [entity_type, entity_id, limit, offset]
  )

  const { rows: countRows } = await db.query<{ total: string }>(
    `SELECT COUNT(*) as total FROM entity_versions WHERE entity_type = $1 AND entity_id = $2`,
    [entity_type, entity_id]
  )

  return NextResponse.json({
    data: rows,
    total: parseInt(countRows[0]?.total || '0'),
    limit,
    offset,
  })
})

const CreateSnapshotSchema = z.object({
  entity_type: z.enum(VERSIONED_ENTITY_TYPES),
  entity_id: z.string().uuid(),
  change_summary: z.string().max(500).optional(),
})

export const POST = apiHandler({ auth: true, schema: CreateSnapshotSchema }, async (req, ctx) => {
  const { entity_type, entity_id, change_summary } = ctx.body as z.infer<typeof CreateSnapshotSchema>

  // Get current state from the source table
  const { rows: entityRows } = await db.query<Record<string, unknown>>(
    `SELECT * FROM ${entity_type} WHERE id = $1`,
    [entity_id]
  )

  if (entityRows.length === 0) {
    return NextResponse.json(
      { error: 'Entity not found', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  // Get next version number
  const { rows: versionRows } = await db.query<{ next_version: number }>(
    `SELECT COALESCE(MAX(version), 0) + 1 as next_version
     FROM entity_versions WHERE entity_type = $1 AND entity_id = $2`,
    [entity_type, entity_id]
  )

  const nextVersion = versionRows[0]?.next_version || 1

  // Insert snapshot
  const { rows } = await db.query<EntityVersionRow>(
    `INSERT INTO entity_versions (entity_type, entity_id, version, snapshot, change_summary, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [entity_type, entity_id, nextVersion, JSON.stringify(entityRows[0]), change_summary || null, ctx.userId]
  )

  return NextResponse.json({ data: rows[0] }, { status: 201 })
})
