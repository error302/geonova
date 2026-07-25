/**
 * Control Point Verification API
 * GET /api/control-points/verifications — list verifications
 * POST /api/control-points/verifications — create verification record
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { z } from 'zod'

const querySchema = z.object({
  point_type: z.enum(['survey_point', 'beacon', 'boundary_monument']).optional(),
  point_id: z.string().uuid().optional(),
  condition: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
})

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 60, windowMs: 60000 } },
  async (req, _ctx) => {
    const { searchParams } = new URL(req.url)
    const params = querySchema.parse(Object.fromEntries(searchParams))

    let sql = `SELECT * FROM control_point_verifications WHERE 1=1`
    const values: unknown[] = []
    let idx = 1

    if (params.point_type) { sql += ` AND point_type = $${idx++}`; values.push(params.point_type) }
    if (params.point_id) { sql += ` AND point_id = $${idx++}`; values.push(params.point_id) }
    if (params.condition) { sql += ` AND condition = $${idx++}`; values.push(params.condition) }
    sql += ` ORDER BY verification_date DESC LIMIT $${idx++}`; values.push(params.limit)

    const { rows } = await db.query(sql, values)
    return NextResponse.json({ data: rows, count: rows.length })
  },
)

const createSchema = z.object({
  point_type: z.enum(['survey_point', 'beacon', 'boundary_monument']),
  point_id: z.string().uuid(),
  point_name: z.string().optional(),
  verification_date: z.string(),
  verifier_name: z.string().optional(),
  verifier_license: z.string().optional(),
  measured_easting: z.number().optional(),
  measured_northing: z.number().optional(),
  measured_elevation: z.number().optional(),
  published_easting: z.number().optional(),
  published_northing: z.number().optional(),
  published_elevation: z.number().optional(),
  condition: z.enum(['good', 'fair', 'poor', 'disturbed', 'destroyed', 'missing']).default('good'),
  condition_notes: z.string().optional(),
  instrument_used: z.string().optional(),
  method: z.enum(['gnss_static', 'gnss_rtk', 'total_station', 'level']).optional(),
  photo_url: z.string().optional(),
  recommendation: z.string().optional(),
})

export const POST = apiHandler(
  { auth: true, schema: createSchema, rateLimit: { max: 30, windowMs: 60000 },
    auditChain: { entityType: 'control_point' as const, action: 'validate' as const, reason: 'Control point verified on site' } },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof createSchema>

    let deltaE: number | null = null, deltaN: number | null = null, deltaH: number | null = null
    let horizontalDisplacement: number | null = null
    let displacementStatus = 'not_measured'

    if (body.measured_easting != null && body.published_easting != null &&
        body.measured_northing != null && body.published_northing != null) {
      deltaE = body.measured_easting - body.published_easting
      deltaN = body.measured_northing - body.published_northing
      horizontalDisplacement = Math.sqrt(deltaE ** 2 + deltaN ** 2)
      if (body.measured_elevation != null && body.published_elevation != null) {
        deltaH = body.measured_elevation - body.published_elevation
      }
      displacementStatus = horizontalDisplacement <= 0.005 ? 'within_tolerance' : 'exceeds_tolerance'
    }

    const { rows } = await db.query(
      `INSERT INTO control_point_verifications
        (point_type, point_id, point_name, verification_date, verified_by,
         verifier_name, verifier_license,
         measured_easting, measured_northing, measured_elevation,
         published_easting, published_northing, published_elevation,
         delta_e, delta_n, delta_h, horizontal_displacement,
         condition, condition_notes, displacement_status,
         instrument_used, method, photo_url, recommendation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING *`,
      [body.point_type, body.point_id, body.point_name, body.verification_date, ctx.userId,
       body.verifier_name, body.verifier_license,
       body.measured_easting ?? null, body.measured_northing ?? null, body.measured_elevation ?? null,
       body.published_easting ?? null, body.published_northing ?? null, body.published_elevation ?? null,
       deltaE, deltaN, deltaH, horizontalDisplacement,
       body.condition, body.condition_notes ?? null, displacementStatus,
       body.instrument_used ?? null, body.method ?? null, body.photo_url ?? null, body.recommendation ?? null],
    )

    return NextResponse.json({ data: rows[0] }, { status: 201 })
  },
)
