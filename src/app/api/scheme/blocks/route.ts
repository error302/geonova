import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler } from '@/lib/apiHandler'
import { CreateBlockSchema } from '@/lib/validation/apiSchemas'

export const dynamic = 'force-dynamic'

export const POST = apiHandler(
  {
    auth: true,
    schema: CreateBlockSchema,
    audit: 'block_created',
    rateLimit: { max: 60, windowMs: 60000 },
    // P1-3 (2026-07-24): Scheme block creation is a cadastral mutation —
    // blocks contain parcels whose boundaries are legally binding.
    auditChain: {
      entityType: 'parcel',
      action: 'create',
      projectIdFromBody: 'project_id',
      reason: 'scheme block creation',
    },
  },
  async (req, ctx) => {
    const { project_id, block_number, block_name, description } = ctx.body as {
      project_id: string; block_number: string; block_name?: string; description?: string
    }

    const projectCheck = await db.query(
      'SELECT id, project_type FROM projects WHERE id = $1 AND user_id = $2',
      [project_id, ctx.userId]
    )
    if (projectCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    if (projectCheck.rows[0].project_type !== 'scheme') {
      return NextResponse.json({ error: 'Only scheme projects can have blocks' }, { status: 400 })
    }

    const dupCheck = await db.query(
      'SELECT id FROM blocks WHERE project_id = $1 AND block_number = $2',
      [project_id, block_number]
    )
    if (dupCheck.rows.length > 0) {
      return NextResponse.json({ error: `Block "${block_number}" already exists in this project` }, { status: 409 })
    }

    const result = await db.query(
      `INSERT INTO blocks (project_id, block_number, block_name, description)
      VALUES ($1, $2, $3, $4) RETURNING *`,
      [project_id, block_number, block_name || null, description || null]
    )

    return NextResponse.json({ data: result.rows[0] }, { status: 201 })
  }
)

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json({ error: 'project_id query parameter is required' }, { status: 400 })
    }

    const projectCheck = await db.query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, ctx.userId]
    )
    if (projectCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const result = await db.query(
      `SELECT b.*,
      COALESCE(pc.parcel_count, 0) as parcel_count,
      COALESCE(pc.completed_count, 0) as completed_count
      FROM blocks b
      LEFT JOIN (
        SELECT block_id,
        COUNT(*) as parcel_count,
        COUNT(*) FILTER (WHERE status IN ('approved', 'submitted')) as completed_count
        FROM parcels
        GROUP BY block_id
      ) pc ON pc.block_id = b.id
      WHERE b.project_id = $1
      ORDER BY b.block_number ASC`,
      [projectId]
    )

    return NextResponse.json({ data: result.rows })
  }
)
