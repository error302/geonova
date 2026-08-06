import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler, ValidationError, NotFoundError } from '@/lib/api/handler'
import { CreateTraverseObservationSchema } from '@/lib/validation/apiSchemas'

interface ParcelOwnerRow {
  id: string
  project_id: string
}

interface TraverseRow {
  id: string
  project_id: string
}

interface TraverseCheckRow {
  id: string
}

interface ParcelTraverseRow {
  id: string
  parcel_id: string
  project_id: string
  opening_station: string | null
  opening_easting: number | null
  opening_northing: number | null
  opening_rl: number | null
  closing_station: string | null
  closing_easting: number | null
  closing_northing: number | null
  closing_rl: number | null
  bs_bearing: number | null
  is_closed: boolean | null
  total_perimeter: number | null
  linear_error: number | null
  precision_ratio: number | null
  accuracy_order: string | null
  computed_area_ha: number | null
  created_at: Date
  updated_at: Date
}

interface TraverseObservationRow {
  id: string
  traverse_id: string
  observation_order: number
  station: string
  bs: string | null
  fs: string | null
  hcl_deg: string | null
  hcl_min: string | null
  hcl_sec: string | null
  hcr_deg: string | null
  hcr_min: string | null
  hcr_sec: string | null
  slope_dist: number | null
  va_deg: string | null
  va_min: string | null
  va_sec: string | null
  ih: number | null
  th: number | null
  remarks: string | null
}

interface TraverseCoordinateRow {
  id: string
  traverse_id: string
  station: string
  easting: number
  northing: number
  rl: number | null
}

export const dynamic = 'force-dynamic'

export const POST = apiHandler({
  requireAuth: true,
  schema: CreateTraverseObservationSchema,
  audit: 'traverse_saved',
  rateLimit: { max: 60, windowMs: 60000 },
  handler: async (ctx) => {
    const { parcel_id, observations, ...config } = ctx.input

    // Validate: closing control point required per Survey Regulations Reg 60 & 67
    // Swinging/hanging traverses are prohibited for cadastral surveys
    if (!config.closing_easting || !config.closing_northing) {
      throw new ValidationError(
        'Closing control point coordinates (closing_easting, closing_northing) are required per Survey Regulations Reg. 60(2)(c) and Reg. 67. A traverse must close between two previously fixed stations. Swinging/hanging traverses are prohibited.'
      )
    }

    // FIXED: Validate that closing control point is DIFFERENT from opening control point.
    // A cadastral traverse requires minimum 2 DISTINCT known control points for position
    // verification. Using the same point for both opening and closing is equivalent to a
    // 1-point (hanging/swinging) traverse with no absolute position check.
    // Source: Basak Ch.10-11, Survey Regulations Reg. 60(2)(c) and Reg. 67
    const coordDiff = Math.abs(config.closing_easting - config.opening_easting) +
                       Math.abs(config.closing_northing - config.opening_northing)
    if (coordDiff < 0.001) {
      throw new ValidationError(
        'Closing control point must be DIFFERENT from opening control point. A cadastral traverse requires minimum 2 distinct known control points for position verification per Survey Regulations Reg. 60(2)(c) and Reg. 67. A 1-point traverse has no absolute position check.'
      )
    }

    const parcelCheck = await db.query<ParcelOwnerRow>(
      `SELECT p.id, p.project_id FROM parcels p
      JOIN projects pr ON pr.id = p.project_id
      WHERE p.id = $1 AND pr.user_id = $2`,
      [parcel_id, ctx.userId]
    )
    if (parcelCheck.rows.length === 0) {
      throw new NotFoundError('Parcel not found')
    }

    const projectId = parcelCheck.rows[0].project_id
    const isClosed = config.closing_easting !== undefined && config.closing_northing !== undefined

    const bsBearing = (config.backsight_bearing_deg || 0) +
      (config.backsight_bearing_min || 0) / 60 +
      (config.backsight_bearing_sec || 0) / 3600

    const upsertResult = await db.query<TraverseRow>(
      `INSERT INTO parcel_traverses (
        parcel_id, project_id, opening_station, closing_station,
        opening_easting, opening_northing, opening_rl,
        closing_easting, closing_northing, backsight_bearing, is_closed, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'computed')
      ON CONFLICT (parcel_id) DO UPDATE SET
        opening_station = EXCLUDED.opening_station,
        closing_station = EXCLUDED.closing_station,
        opening_easting = EXCLUDED.opening_easting,
        opening_northing = EXCLUDED.opening_northing,
        opening_rl = EXCLUDED.opening_rl,
        closing_easting = EXCLUDED.closing_easting,
        closing_northing = EXCLUDED.closing_northing,
        backsight_bearing = EXCLUDED.backsight_bearing,
        is_closed = EXCLUDED.is_closed,
        status = 'computed',
        updated_at = NOW()
      RETURNING *`,
      [
        parcel_id, projectId, config.opening_station, config.closing_station || null,
        config.opening_easting, config.opening_northing, config.opening_rl || null,
        config.closing_easting || null, config.closing_northing || null, bsBearing, isClosed,
      ]
    )

    const traverseId = upsertResult.rows[0].id

    await db.query<never>('DELETE FROM traverse_observations WHERE traverse_id = $1', [traverseId])
    await db.query<never>('DELETE FROM traverse_coordinates WHERE traverse_id = $1', [traverseId])

    for (let i = 0; i < observations.length; i++) {
      const obs = observations[i]
      await db.query<never>(
        `INSERT INTO traverse_observations (
          traverse_id, observation_order, station, bs, fs,
          hcl_deg, hcl_min, hcl_sec, hcr_deg, hcr_min, hcr_sec,
          slope_dist, va_deg, va_min, va_sec, ih, th, remarks
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          traverseId, i + 1, obs.station, obs.bs, obs.fs,
          obs.hcl_deg, obs.hcl_min, obs.hcl_sec, obs.hcr_deg, obs.hcr_min, obs.hcr_sec,
          obs.slope_dist || null, obs.va_deg, obs.va_min, obs.va_sec, obs.ih, obs.th,
          obs.remarks || null,
        ]
      )
    }

    const { computeTraverse } = await import('@/lib/computations/traverseEngine')
    const result = computeTraverse({
      openingEasting: config.opening_easting,
      openingNorthing: config.opening_northing,
      openingRL: config.opening_rl,
      openingStation: config.opening_station,
      closingEasting: config.closing_easting,
      closingNorthing: config.closing_northing,
      closingStation: config.closing_station,
      backsightBearingDeg: config.backsight_bearing_deg || 0,
      backsightBearingMin: config.backsight_bearing_min || 0,
      backsightBearingSec: config.backsight_bearing_sec || 0,
      observations: observations.map(obs => ({
        station: obs.station,
        bs: obs.bs,
        fs: obs.fs,
        hclDeg: String(obs.hcl_deg),
        hclMin: String(obs.hcl_min),
        hclSec: String(obs.hcl_sec),
        hcrDeg: String(obs.hcr_deg),
        hcrMin: String(obs.hcr_min),
        hcrSec: String(obs.hcr_sec),
        slopeDist: String(obs.slope_dist || 0),
        vaDeg: String(obs.va_deg),
        vaMin: String(obs.va_min),
        vaSec: String(obs.va_sec),
        ih: String(obs.ih),
        th: String(obs.th),
        remarks: obs.remarks,
      })),
    })

    for (const coord of result.coordinates) {
      await db.query<never>(
        `INSERT INTO traverse_coordinates (traverse_id, station, easting, northing, rl)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (traverse_id, station) DO UPDATE SET
          easting = EXCLUDED.easting, northing = EXCLUDED.northing, rl = EXCLUDED.rl`,
        [traverseId, coord.station, coord.easting, coord.northing, coord.rl || null]
      )
    }

    let computedAreaHa: number | null = null
    if (result.coordinates.length >= 3) {
      const { coordinateArea } = await import('@/lib/engine/area')
      const areaResult = coordinateArea(
        result.coordinates.map(c => ({ easting: c.easting, northing: c.northing }))
      )
      computedAreaHa = areaResult.areaHa
    }

    await db.query<never>(
      `UPDATE parcel_traverses SET
        total_perimeter = $2, linear_error = $3, precision_ratio = $4,
        accuracy_order = $5, computed_area_ha = $6
      WHERE id = $1`,
      [traverseId, result.totalPerimeter, result.linearError, result.precisionRatio, result.accuracyOrder, computedAreaHa]
    )

    if (computedAreaHa !== null) {
      await db.query<never>(
        `UPDATE parcels SET area_ha = $2, status = 'computed' WHERE id = $1`,
        [parcel_id, computedAreaHa]
      )
    }

    return NextResponse.json({
      data: {
        traverse: upsertResult.rows[0],
        legs: result.legs,
        coordinates: result.coordinates,
        area_ha: computedAreaHa,
        accuracy: {
          order: result.accuracyOrder,
          precision_ratio: result.precisionRatio,
          linear_error: result.linearError,
          formula: result.formula,
          is_closed: result.isClosed,
        },
      },
    }, { status: 201 })
  },
})

export const GET = apiHandler({
  requireAuth: true,
  rateLimit: { max: 60, windowMs: 60000 },
  handler: async (ctx) => {
    const { searchParams } = new URL(ctx.req.url)
    const parcelId = searchParams.get('parcel_id')

    if (!parcelId) {
      throw new ValidationError('parcel_id is required')
    }

    const check = await db.query<TraverseCheckRow>(
      `SELECT pt.id FROM parcel_traverses pt
      JOIN parcels p ON p.id = pt.parcel_id
      JOIN projects pr ON pr.id = p.project_id
      WHERE pt.parcel_id = $1 AND pr.user_id = $2`,
      [parcelId, ctx.userId]
    )

    if (check.rows.length === 0) {
      return NextResponse.json({ data: null })
    }

    const traverseId = check.rows[0].id

    const [traverseRes, obsRes, coordsRes] = await Promise.all([
      db.query<ParcelTraverseRow>('SELECT * FROM parcel_traverses WHERE id = $1', [traverseId]),
      db.query<TraverseObservationRow>('SELECT * FROM traverse_observations WHERE traverse_id = $1 ORDER BY observation_order', [traverseId]),
      db.query<TraverseCoordinateRow>('SELECT * FROM traverse_coordinates WHERE traverse_id = $1 ORDER BY station', [traverseId]),
    ])

    return NextResponse.json({
      data: {
        traverse: traverseRes.rows[0],
        observations: obsRes.rows,
        coordinates: coordsRes.rows,
      },
    })
  },
})
