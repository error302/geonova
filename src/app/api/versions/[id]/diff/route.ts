export const dynamic = 'force-dynamic'

/**
 * /api/versions/[id]/diff — Compare two versions of an entity
 * GET: get diff between two versions
 *
 * SECURITY: IDOR protection — verifies the version's project belongs
 * to the requesting user before returning snapshot field values.
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
  snapshot: unknown
  created_at: Date
  updated_at: Date
}

const DiffQuerySchema = z.object({
  compare_with: z.coerce.number().int().min(1, 'compare_with must be a positive version number'),
})

export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { id } = ctx.params

  // IDOR protection — verify the version belongs to the requesting user
  const ownership = await requireVersionOwnership(id, ctx.userId)
  if (!ownership.ok) {
  if (!ownership.error) throw new Error('Ownership check failed without an error response')
  return ownership.error
}

  const { searchParams } = new URL(req.url)

  // Validate query params via Zod
  const parsed = DiffQuerySchema.safeParse({
    compare_with: searchParams.get('compare_with'),
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const { compare_with } = parsed.data

  // Get the target version
  const { rows: targetRows } = await db.query<EntityVersionRow>(
    `SELECT * FROM entity_versions WHERE id = $1`,
    [id]
  )

  if (targetRows.length === 0) {
    return NextResponse.json(
      { error: 'Version not found', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  const target = targetRows[0]

  // Get the comparison version
  const { rows: compareRows } = await db.query<EntityVersionRow>(
    `SELECT * FROM entity_versions
     WHERE entity_type = $1 AND entity_id = $2 AND version = $3`,
    [target.entity_type, target.entity_id, compare_with]
  )

  if (compareRows.length === 0) {
    return NextResponse.json(
      { error: `Version ${compare_with} not found for this entity`, code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  const compare = compareRows[0]

  // Compute diff between the two snapshots
  const targetSnapshot = target.snapshot as Record<string, unknown>
  const compareSnapshot = compare.snapshot as Record<string, unknown>

  const changes: Array<{
    field: string
    old_value: unknown
    new_value: unknown
  }> = []

  const allKeys = Array.from(new Set([
    ...Object.keys(targetSnapshot),
    ...Object.keys(compareSnapshot),
  ]))

  for (const key of allKeys) {
    // Skip internal fields
    if (['id', 'created_at', 'updated_at'].includes(key)) continue

    const oldVal = compareSnapshot[key]
    const newVal = targetSnapshot[key]

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, old_value: oldVal, new_value: newVal })
    }
  }

  return NextResponse.json({
    entity_type: target.entity_type,
    entity_id: target.entity_id,
    from_version: compare.version,
    to_version: target.version,
    from_date: compare.created_at,
    to_date: target.created_at,
    changes,
    change_count: changes.length,
  })
})
