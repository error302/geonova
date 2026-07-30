import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler } from '@/lib/apiHandler'
import { UpdateBlockSchema } from '@/lib/validation/apiSchemas'

export const dynamic = 'force-dynamic'

export const PATCH = apiHandler(
  {
    auth: true,
    schema: UpdateBlockSchema,
    optimisticLock: true,
    audit: 'block_updated',
    rateLimit: { max: 60, windowMs: 60000 },
    // P1-3 (2026-07-24): Scheme block updates are cadastral mutations.
    auditChain: {
      entityType: 'parcel',
      action: 'update',
      entityIdParam: 'id',
      reason: 'scheme block update',
    },
  },
  async (req, ctx) => {
    const blockId = ctx.params.id
    const validated = ctx.body as Record<string, unknown> & {
      block_number?: string; block_name?: string; description?: string; updated_at?: string
    }

    const check = await db.query(
      `SELECT b.id, b.project_id, b.updated_at FROM blocks b
      JOIN projects p ON p.id = b.project_id
      WHERE b.id = $1 AND p.user_id = $2`,
      [blockId, ctx.userId]
    )
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    if (validated.block_number) {
      const dupCheck = await db.query(
        `SELECT id FROM blocks WHERE project_id = $1 AND block_number = $2 AND id != $3`,
        [check.rows[0].project_id, validated.block_number, blockId]
      )
      if (dupCheck.rows.length > 0) {
        return NextResponse.json({ error: `Block "${validated.block_number}" already exists` }, { status: 409 })
      }
    }

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (validated.block_number !== undefined) {
      updates.push(`block_number = $${paramIndex++}`)
      values.push(validated.block_number)
    }
    if (validated.block_name !== undefined) {
      updates.push(`block_name = $${paramIndex++}`)
      values.push(validated.block_name || null)
    }
    if (validated.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(validated.description || null)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(blockId)
    // T1.8 FIX (2026-07-09): Optimistic lock guard in the SQL WHERE clause.
    const clientUpdatedAt = validated.updated_at
    if (!clientUpdatedAt) {
      return NextResponse.json({ error: 'updated_at is required for optimistic locking', code: 'CONFLICT' }, { status: 409 })
    }
    values.push(clientUpdatedAt)
    const result = await db.query(
      `UPDATE blocks SET ${updates.join(', ')} WHERE id = $${paramIndex} AND updated_at = $${paramIndex + 1} RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'This block was modified by another user. Please refresh and try again.', code: 'CONFLICT' },
        { status: 409 }
      )
    }

    return NextResponse.json({ data: result.rows[0] })
  }
)

export const DELETE = apiHandler(
  {
    auth: true,
    audit: 'block_deleted',
    rateLimit: { max: 60, windowMs: 60000 },
    auditChain: {
      entityType: 'parcel',
      action: 'delete',
      entityIdParam: 'id',
      reason: 'scheme block deletion',
    },
  },
  async (req, ctx) => {
    const blockId = ctx.params.id

    const check = await db.query(
      `SELECT b.id, b.project_id, b.block_number FROM blocks b
      JOIN projects p ON p.id = b.project_id
      WHERE b.id = $1 AND p.user_id = $2`,
      [blockId, ctx.userId]
    )
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    await db.query('DELETE FROM blocks WHERE id = $1', [blockId])

    return NextResponse.json({
      message: `Block "${check.rows[0].block_number}" deleted successfully`
    })
  }
)
