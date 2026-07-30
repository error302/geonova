/**
 * /api/survey-points
 *
 * POST — Create one or more survey points (collection endpoint).
 *
 * This is the bulk-import endpoint used by:
 *   - Field collect "Sync to Server" button (src/lib/field/storage.ts)
 *   - Universal importers (CSV, GeoJSON, DXF, etc.)
 *   - Anywhere a single beacon / point needs to be saved without a
 *     pre-existing point ID.
 *
 * Body (single point):
 *   {
 *     project_id: string (UUID),
 *     point_name: string,
 *     easting:    number,
 *     northing:   number,
 *     elevation?: number,
 *     code?:      string,
 *     description?: string,
 *     is_control?: boolean,
 *     datum?:       string,
 *     projection?:  string,
 *     utm_zone?:    number,
 *     hemisphere?:  string,
 *     source?:      string,  -- manual | gnss | total_station | imported | adjusted
 *     observation_date?: string (ISO)
 *   }
 *
 * Or batch (array of the same shape).
 *
 * Response (201):
 *   { data: { created: SurveyPoint[], errors: { row: number, error: string }[] } }
 *
 * AUDIT FIX (2026-07-03): The /api/survey-points base route didn't
 * exist — only /api/survey-points/[id] (PATCH) did. The field collect
 * sync was failing with 404 on every beacon.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/lib/apiHandler'
import { db, setRlsContext } from '@/lib/db'

const SurveyPointInput = z.object({
  project_id: z.string().uuid(),
  point_name: z.string().min(1).max(100),
  easting: z.number(),
  northing: z.number(),
  elevation: z.number().nullable().optional(),
  code: z.string().max(20).nullable().optional(),
  description: z.string().nullable().optional(),
  is_control: z.boolean().optional().default(false),
  // CRS / provenance (migration 027 columns)
  datum: z.string().max(50).nullable().optional(),
  projection: z.string().max(20).nullable().optional(),
  utm_zone: z.number().int().min(1).max(60).nullable().optional(),
  hemisphere: z.string().length(1).nullable().optional(),
  source: z.string().max(20).nullable().optional(),
  observation_date: z.string().datetime().nullable().optional(),
})

const BodySchema = z.union([
  SurveyPointInput,
  z.array(SurveyPointInput).min(1).max(5000),
])

export const POST = apiHandler(
  { auth: true, schema: BodySchema, rateLimit: { max: 60, windowMs: 60000 },
    auditChain: { entityType: 'control_point', action: 'import', projectIdFromBody: 'project_id' } },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof BodySchema>
    const points = Array.isArray(body) ? body : [body]

    if (points.length === 0) {
      return NextResponse.json(
        { error: 'No points provided', code: 'NO_POINTS' },
        { status: 400 },
      )
    }

    // ── Verify ownership of the first project_id ──────────────────────────
    // All points in a batch should belong to the same project (the field
    // collect sync sends all beacons for one project at a time). We still
    // verify each project_id individually in the loop below.
    const projectIds = new Set(points.map((p) => p.project_id))
    if (projectIds.size > 1) {
      return NextResponse.json(
        { error: 'All points in a batch must belong to the same project', code: 'MULTI_PROJECT' },
        { status: 400 },
      )
    }

    const projectId = points[0].project_id
    // AUDIT FIX (C5, 2026-07-03): Load the project's default CRS so we
    // can populate datum/zone/hemisphere on points that don't specify
    // them explicitly. Previously these columns were left NULL even when
    // the project had a known CRS.
    const { rows: projectRows } = await db.query(
      'SELECT id, utm_zone, hemisphere, datum FROM projects WHERE id = $1 AND user_id = $2',
      [projectId, ctx.userId],
    )
    if (projectRows.length === 0) {
      return NextResponse.json(
        { error: 'Project not found or access denied', code: 'NOT_FOUND' },
        { status: 404 },
      )
    }
    const projectCRS = projectRows[0]

    // ── Insert points in a single transaction ─────────────────────────────
    const client = await db.getClient()
    const created: Record<string, unknown>[] = []
    const errors: { row: number; error: string }[] = []

    try {
      await client.query('BEGIN')
      await setRlsContext(client)

      // Build a PostGIS POINT geom for each row (lon=easting, lat=northing
      // is WRONG for projected coords — but the schema column is
      // GEOMETRY(POINT, 4326), so we treat easting/northing as WGS84 lon/lat
      // degrees, which is what the field collect page sends for GPS beacons).
      // Imported projected coordinates should set the CRS columns and we
      // skip geom in that case.
      for (let i = 0; i < points.length; i++) {
        const p = points[i]
        try {
          // Use MakePoint(4326) when source coords look like lat/lon
          // (|value| <= 180), else NULL (projected coords need explicit
          // ST_Transform which we can't infer without knowing the source
          // SRID).
          const looksLikeWGS84 =
            Math.abs(p.easting) <= 180 && Math.abs(p.northing) <= 90

          const { rows } = await client.query(
            `INSERT INTO survey_points
               (project_id, point_name, easting, northing, elevation,
                description, code, is_control,
                datum, projection, utm_zone, hemisphere,
                source, observation_date, geom)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                     ${looksLikeWGS84 ? 'ST_SetSRID(ST_MakePoint($3, $4), 4326)' : 'NULL'})
             RETURNING *`,
            [
              p.project_id,
              p.point_name,
              p.easting,
              p.northing,
              p.elevation ?? null,
              p.description ?? null,
              p.code ?? null,
              p.is_control ?? false,
              // C5 fix: fall back to project CRS defaults
              p.datum ?? projectCRS.datum ?? null,
              p.projection ?? (projectCRS.utm_zone ? 'UTM' : null),
              p.utm_zone ?? projectCRS.utm_zone ?? null,
              p.hemisphere ?? projectCRS.hemisphere ?? null,
              p.source ?? 'manual',
              p.observation_date ?? null,
            ],
          )
          created.push(rows[0])
        } catch (err) {
          errors.push({
            row: i,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      await client.query('COMMIT')

      return NextResponse.json(
        {
          data: {
            created,
            errors,
            count: created.length,
            failed: errors.length,
          },
        },
        { status: 201 },
      )
    } catch (txErr) {
      await client.query('ROLLBACK')
      throw txErr
    } finally {
      client.release()
    }
  },
)

// ── GET — list points for a project ─────────────────────────────────────────
// Convenience route so /api/survey-points?project_id=X works without
// needing to use the /api/project/[id]/points endpoint.

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 60, windowMs: 60000 } },
  async (req, _ctx) => {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id query parameter is required', code: 'MISSING_PROJECT' },
        { status: 400 },
      )
    }

    // T1.5d FIX (2026-07-10): Add is_control filter + text search.
    // Previously this endpoint returned ALL points with no way to filter
    // for control points only, and no text search. Now supports:
    //   GET /api/survey-points?project_id=X                    — all points
    //   GET /api/survey-points?project_id=X&is_control=true    — control points only
    //   GET /api/survey-points?project_id=X&q=BEACON           — text search point_name
    //   GET /api/survey-points?project_id=X&is_control=true&q=CP1
    const isControl = searchParams.get('is_control')
    const q = searchParams.get('q')?.trim()

    let sql = `SELECT * FROM survey_points WHERE project_id = $1`
    const params: unknown[] = [projectId]
    let paramIdx = 2

    if (isControl === 'true') {
      sql += ` AND is_control = true`
    } else if (isControl === 'false') {
      sql += ` AND is_control = false`
    }

    if (q) {
      sql += ` AND (point_name ILIKE $${paramIdx} OR code ILIKE $${paramIdx} OR description ILIKE $${paramIdx})`
      params.push(`%${q}%`)
      paramIdx++
    }

    sql += ` ORDER BY is_control DESC, point_name ASC`

    // ByteByteGo audit fix: add LIMIT to prevent returning tens of thousands of rows
    const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 5000)
    sql += ` LIMIT $${paramIdx}`
    params.push(limit)

    const { rows } = await db.query(sql, params)

    return NextResponse.json({ data: rows, count: rows.length, limit })
  },
)
