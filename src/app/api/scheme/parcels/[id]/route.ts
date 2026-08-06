import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler } from '@/lib/apiHandler'
import { UpdateParcelSchema } from '@/lib/validation/apiSchemas'

interface ParcelCheckRow {
  id: string
  project_id: string
  block_id: string
  parcel_number?: string
  updated_at?: Date
}

export const dynamic = 'force-dynamic'

export const PATCH = apiHandler(
  { auth: true, schema: UpdateParcelSchema, optimisticLock: true, audit: 'parcel_updated',
    auditChain: { entityType: 'parcel', action: 'update', entityIdParam: 'id' },
    rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const parcelId = ctx.params.id
    const validated = ctx.body as Record<string, unknown> & {
      parcel_number?: string; lr_number_proposed?: string; lr_number_confirmed?: string;
      area_ha?: number; status?: string; assigned_surveyor?: string | null; notes?: string;
      updated_at?: string
    }

    const check = await db.query<ParcelCheckRow>(
      `SELECT p.id, p.project_id, p.block_id, p.updated_at FROM parcels p
      JOIN projects pr ON pr.id = p.project_id
      WHERE p.id = $1 AND pr.user_id = $2`,
      [parcelId, ctx.userId]
    )
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 })
    }

    if (validated.parcel_number) {
      const dupCheck = await db.query(
        `SELECT id FROM parcels WHERE block_id = $1 AND parcel_number = $2 AND id != $3`,
        [check.rows[0].block_id, validated.parcel_number, parcelId]
      )
      if (dupCheck.rows.length > 0) {
        return NextResponse.json(
          { error: `Parcel "${validated.parcel_number}" already exists in this block` },
          { status: 409 }
        )
      }
    }

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    const fieldMap: Record<string, any> = {
      parcel_number: validated.parcel_number,
      lr_number_proposed: validated.lr_number_proposed,
      lr_number_confirmed: validated.lr_number_confirmed,
      area_ha: validated.area_ha,
      status: validated.status,
      assigned_surveyor: validated.assigned_surveyor,
      notes: validated.notes,
    }

    for (const [field, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        updates.push(`"${field}" = $${paramIndex++}`)
        values.push(value)
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(parcelId)
    // T1.8 FIX (2026-07-09): Optimistic lock guard in the SQL WHERE clause itself.
    // The old checkOptimisticLock() did SELECT → JS check → UPDATE without the guard,
    // allowing a TOCTOU race. Now the UPDATE is atomic: if updated_at changed,
    // 0 rows are returned and we send 409.
    const clientUpdatedAt = validated.updated_at
    if (!clientUpdatedAt) {
      return NextResponse.json({ error: 'updated_at is required for optimistic locking', code: 'CONFLICT' }, { status: 409 })
    }
    values.push(clientUpdatedAt)
    const result = await db.query(
      `UPDATE parcels SET ${updates.join(', ')} WHERE id = $${paramIndex} AND updated_at = $${paramIndex + 1} RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'This parcel was modified by another user. Please refresh and try again.', code: 'CONFLICT' },
        { status: 409 }
      )
    }

    return NextResponse.json({ data: result.rows[0] })
  }
)

export const DELETE = apiHandler(
  { auth: true, audit: 'parcel_deleted' , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const parcelId = ctx.params.id

    const check = await db.query<ParcelCheckRow>(
      `SELECT p.id, p.parcel_number FROM parcels p
      JOIN projects pr ON pr.id = p.project_id
      WHERE p.id = $1 AND pr.user_id = $2`,
      [parcelId, ctx.userId]
    )
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 })
    }

    await db.query('DELETE FROM parcels WHERE id = $1', [parcelId])

    return NextResponse.json({
      message: `Parcel "${check.rows[0].parcel_number}" deleted successfully`
    })
  }
)
