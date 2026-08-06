import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { z } from 'zod'

interface NextNumRow {
  next_num: number
}

interface ParcelCountRow {
  total: number
  computed: number
}

export const dynamic = 'force-dynamic'

const createSubmissionSchema = z.object({
  project_id: z.string().min(1),
  notes: z.string().optional(),
})

export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (request, ctx) => {
  const projectId = request.nextUrl.searchParams.get('project_id')

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  const { rows } = await db.query(
    `SELECT s.*, u.full_name as submitted_by_name
     FROM submissions s
     LEFT JOIN users u ON u.id = s.submitted_by
     WHERE s.project_id = $1
     ORDER BY s.submission_number DESC`,
    [projectId]
  )

  return NextResponse.json({ data: rows })
})

export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (request, ctx) => {
  const parsed = createSubmissionSchema.safeParse(ctx.body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }

  const { project_id, notes } = parsed.data

  // Get next submission number
  const { rows: existing } = await db.query<NextNumRow>(
    'SELECT COALESCE(MAX(submission_number), 0) + 1 as next_num FROM submissions WHERE project_id = $1',
    [project_id]
  )
  const nextNum = existing[0].next_num

  // Count parcels and traverses
  const { rows: parcelCounts } = await db.query<ParcelCountRow>(
    `SELECT COUNT(*)::int as total, 
      COUNT(CASE WHEN pt.status IN ('computed', 'approved') THEN 1 END)::int as computed
     FROM parcels p
     JOIN blocks b ON b.id = p.block_id
     LEFT JOIN parcel_traverses pt ON pt.parcel_id = p.id
     WHERE b.project_id = $1`,
    [project_id]
  )

  const { rows } = await db.query(
    `INSERT INTO submissions (project_id, submission_number, submitted_by, 
      status, documents, parcel_count, deed_plan_count, review_notes)
     VALUES ($1, $2, $3, 'submitted', '[]'::jsonb, $4, $5, $6)
     RETURNING *`,
    [project_id, nextNum, ctx.userId, parcelCounts[0].total, parcelCounts[0].computed, notes || null]
  )

  return NextResponse.json({ data: rows[0] }, { status: 201 })
})
