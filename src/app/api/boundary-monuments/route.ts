export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { z } from 'zod'

/**
 * GET /api/boundary-monuments
 *
 * Search boundary monuments by:
 *   - boundary_name (e.g., 'Kenya-Tanzania')
 *   - monument_number (e.g., 'KEN-TZ-042')
 *   - proximity (lat, lon, radiusKm)
 *   - verification_status
 *   - condition
 *
 * Returns: { data: BoundaryMonument[], count: number }
 */

const searchSchema = z.object({
  boundary_name: z.string().optional(),
  monument_number: z.string().optional(),
  lat: z.coerce.number().optional(),
  lon: z.coerce.number().optional(),
  radiusKm: z.coerce.number().optional(),
  verification_status: z.string().optional(),
  condition: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
})

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 60, windowMs: 60000 } },
  async (req, _ctx) => {
    const { searchParams } = new URL(req.url)
    const params = searchSchema.parse(Object.fromEntries(searchParams))

    let sql = `SELECT * FROM boundary_monuments WHERE 1=1`
    const values: unknown[] = []
    let idx = 1

    if (params.boundary_name) {
      sql += ` AND boundary_name ILIKE $${idx++}`
      values.push(`%${params.boundary_name}%`)
    }
    if (params.monument_number) {
      sql += ` AND monument_number ILIKE $${idx++}`
      values.push(`%${params.monument_number}%`)
    }
    if (params.verification_status) {
      sql += ` AND verification_status = $${idx++}`
      values.push(params.verification_status)
    }
    if (params.condition) {
      sql += ` AND condition = $${idx++}`
      values.push(params.condition)
    }

    // Proximity search using ST_DWithin (geographic)
    if (params.lat !== undefined && params.lon !== undefined && params.radiusKm) {
      sql += ` AND geom IS NOT NULL AND ST_DWithin(geom, ST_SetSRID(ST_MakePoint($${idx}, $${idx + 1}), 4326)::geography, $${idx + 2})`
      values.push(params.lon, params.lat, params.radiusKm * 1000)
      idx += 3
    }

    sql += ` ORDER BY boundary_name, monument_number LIMIT $${idx++}`
    values.push(params.limit)

    const { rows } = await db.query(sql, values)

    return NextResponse.json({ data: rows, count: rows.length })
  },
)

/**
 * POST /api/boundary-monuments
 *
 * Create a new boundary monument.
 */
const createSchema = z.object({
  monument_number: z.string().min(1).max(100),
  monument_type: z.string().default('pillar'),
  boundary_name: z.string().min(1).max(200),
  treaty_reference: z.string().min(1).max(500),
  treaty_date: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  elevation: z.number().optional(),
  easting: z.number().optional(),
  northing: z.number().optional(),
  utm_zone: z.number().int().min(1).max(60).default(37),
  hemisphere: z.string().default('S'),
  datum: z.string().default('Arc 1960'),
  epsg_code: z.string().default('EPSG:21037'),
  coordinate_epoch: z.number().optional(),
  reference_frame: z.string().default('ITRF2014'),
  observation_date: z.string().optional(),
  sigma_e: z.number().optional(),
  sigma_n: z.number().optional(),
  sigma_h: z.number().optional(),
  sigma_en: z.number().default(0),
  confidence_level: z.number().default(0.95),
  physical_description: z.string().optional(),
  material: z.string().optional(),
  dimensions: z.string().optional(),
  marker_text: z.string().optional(),
  photo_url: z.string().optional(),
  county: z.string().optional(),
  sub_county: z.string().optional(),
  locality: z.string().optional(),
  sheet_number: z.string().optional(),
  condition: z.string().default('good'),
  condition_notes: z.string().optional(),
  last_inspected_date: z.string().optional(),
  verification_status: z.string().default('pending'),
  verified_by: z.string().optional(),
  verified_date: z.string().optional(),
  verification_notes: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
})

export const POST = apiHandler(
  {
    auth: true,
    schema: createSchema,
    rateLimit: { max: 30, windowMs: 60000 },
    auditChain: {
      entityType: 'document',
      action: 'create',
      reason: 'Boundary monument created',
    },
  },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof createSchema>

    // Build the geometry if lat/lon provided
    let geomSql = `NULL`
    const values: unknown[] = []
    const cols: string[] = []
    const placeholders: string[] = []
    let idx = 1

    for (const [key, val] of Object.entries(body)) {
      if (val === undefined) continue
      cols.push(key)
      values.push(val)
      placeholders.push(`$${idx++}`)
    }

    // Add created_by
    cols.push('created_by')
    values.push(ctx.userId)
    placeholders.push(`$${idx++}`)

    // Add geom if lat + lon provided
    if (body.latitude !== undefined && body.longitude !== undefined) {
      cols.push('geom')
      values.push(`SRID=4326;POINT(${body.longitude} ${body.latitude})`)
      placeholders.push(`ST_GeomFromText($${idx++}, 4326)`)
    }

    const sql = `INSERT INTO boundary_monuments (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`
    const { rows } = await db.query(sql, values)

    return NextResponse.json({ data: rows[0] }, { status: 201 })
  },
)
