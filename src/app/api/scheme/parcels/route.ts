import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler } from '@/lib/apiHandler'
import { CreateParcelSchema } from '@/lib/validation/apiSchemas'
import {
  parcelResponseSchema,
  parcelWithBlockListResponseSchema,
  type Parcel,
  type ParcelWithBlock,
} from '@/lib/validation/scheme'

interface BlockOwnerRow {
  id: string
  project_id: string
}

export const dynamic = 'force-dynamic'

export const POST = apiHandler(
  { auth: true, schema: CreateParcelSchema, audit: 'parcel_created' , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { block_id, parcel_number, lr_number_proposed, area_ha, notes } = ctx.body as {
      block_id: string; parcel_number: string; lr_number_proposed?: string;
      area_ha?: number; notes?: string
    }

    const blockCheck = await db.query<BlockOwnerRow>(
      `SELECT b.id, b.project_id FROM blocks b
      JOIN projects p ON p.id = b.project_id
      WHERE b.id = $1 AND p.user_id = $2`,
      [block_id, ctx.userId]
    )
    if (blockCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Block not found in this project' }, { status: 404 })
    }

    const projectId = blockCheck.rows[0].project_id

    const dupCheck = await db.query<{ id: string }>(
      'SELECT id FROM parcels WHERE block_id = $1 AND parcel_number = $2',
      [block_id, parcel_number]
    )
    if (dupCheck.rows.length > 0) {
      return NextResponse.json(
        { error: `Parcel "${parcel_number}" already exists in this block` },
        { status: 409 }
      )
    }

    const result = await db.query<Parcel>(
      `INSERT INTO parcels (project_id, block_id, parcel_number, lr_number_proposed, area_ha, status, notes)
      VALUES ($1, $2, $3, $4, $5, 'pending', $6) RETURNING *`,
      [projectId, block_id, parcel_number, lr_number_proposed || null, area_ha || null, notes || null]
    )

    // Validate the created row against the shared parcel schema — the same one
    // the client type derives from. If it drifts (e.g. an out-of-enum status
    // or a non-UUID id), fail loudly instead of shipping a mismatched parcel.
    const parsed = parcelResponseSchema.safeParse({ data: result.rows[0] })
    if (!parsed.success) {
      // eslint-disable-next-line no-console -- internal response drift log, not user-facing
      console.error('[scheme/parcels] response validation failed:', parsed.error.issues)
      return NextResponse.json({ error: 'Internal response validation failed' }, { status: 500 })
    }
    return NextResponse.json(parsed.data, { status: 201 })
  }
)

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { searchParams } = new URL(req.url)
    const blockId = searchParams.get('block_id')
    const projectId = searchParams.get('project_id')

    if (!blockId && !projectId) {
      return NextResponse.json(
        { error: 'block_id or project_id query parameter is required' },
        { status: 400 }
      )
    }

    if (blockId) {
      const check = await db.query<{ id: string }>(
        `SELECT b.id FROM blocks b
        JOIN projects p ON p.id = b.project_id
        WHERE b.id = $1 AND p.user_id = $2`,
        [blockId, ctx.userId]
      )
      if (check.rows.length === 0) {
        return NextResponse.json({ error: 'Block not found' }, { status: 404 })
      }

      const result = await db.query<ParcelWithBlock>(
        `SELECT p.*, b.block_number, b.block_name
        FROM parcels p
        JOIN blocks b ON b.id = p.block_id
        WHERE p.block_id = $1
        ORDER BY p.parcel_number ASC`,
        [blockId]
      )

      const parsed = parcelWithBlockListResponseSchema.safeParse({ data: result.rows })
      if (!parsed.success) {
        // eslint-disable-next-line no-console -- internal response drift log, not user-facing
        console.error('[scheme/parcels] response validation failed:', parsed.error.issues)
        return NextResponse.json({ error: 'Internal response validation failed' }, { status: 500 })
      }
      return NextResponse.json(parsed.data)
    }

    if (projectId) {
      const check = await db.query<{ id: string }>(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, ctx.userId]
      )
      if (check.rows.length === 0) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }

      const result = await db.query<ParcelWithBlock>(
        `SELECT p.*, b.block_number, b.block_name
        FROM parcels p
        JOIN blocks b ON b.id = p.block_id
        WHERE p.project_id = $1
        ORDER BY b.block_number ASC, p.parcel_number ASC`,
        [projectId]
      )

      const parsed = parcelWithBlockListResponseSchema.safeParse({ data: result.rows })
      if (!parsed.success) {
        // eslint-disable-next-line no-console -- internal response drift log, not user-facing
        console.error('[scheme/parcels] response validation failed:', parsed.error.issues)
        return NextResponse.json({ error: 'Internal response validation failed' }, { status: 500 })
      }
      return NextResponse.json(parsed.data)
    }

    return NextResponse.json({ data: [] })
  }
)
