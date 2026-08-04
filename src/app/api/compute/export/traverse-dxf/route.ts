import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { generateTraverseDXF } from '@/lib/export/traverseDXF'

export const dynamic = 'force-dynamic'

/**
 * POST /api/compute/export/traverse-dxf
 *
 * Accepts `{ projectId }`, fetches traverse data from the database,
 * and returns a downloadable DXF file containing a professional traverse plan.
 *
 * Flow:
 * 1. Verify project ownership
 * 2. Fetch project metadata (name, lr_number, county, datum, surveyor_name)
 * 3. Fetch traverse coordinates and observations for all parcels in the project
 * 4. Build station/leg arrays and misclosure data
 * 5. Call generateTraverseDXF() to produce the DXF string
 * 6. Return as a downloadable DXF response
 */
export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const body = ctx.body as { projectId?: string }
  const { projectId } = body

  if (!projectId) {
    return NextResponse.json(
      { error: 'projectId is required' },
      { status: 400 },
    )
  }

  // ── Verify project ownership ────────────────────────────────────────────
  const { rows: projects } = await db.query(
    `SELECT p.id, p.name, p.location, p.project_type,
            p.surveyor_name,
            sd.scheme_number, sd.datum, sd.county
     FROM projects p
     LEFT JOIN scheme_details sd ON sd.project_id = p.id
     WHERE p.id = $1 AND p.user_id = $2`,
    [projectId, ctx.userId],
  )

  if (projects.length === 0) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 },
    )
  }

  const project = projects[0]

  // ── Fetch traverse data for all parcels in this project ─────────────────
  const { rows: traverses } = await db.query(
    `SELECT pt.id AS traverse_id,
            pt.parcel_id,
            pt.is_closed,
            pt.linear_error,
            pt.precision_ratio,
            pt.total_perimeter,
            pt.accuracy_order,
            p.parcel_number,
            p.lr_number_proposed,
            b.block_number
     FROM parcel_traverses pt
     JOIN parcels p ON p.id = pt.parcel_id
     JOIN blocks b ON b.id = p.block_id
     WHERE b.project_id = $1
       AND pt.status IN ('computed', 'approved')
     ORDER BY b.block_number, p.parcel_number`,
    [projectId],
  )

  if (traverses.length === 0) {
    return NextResponse.json(
      { error: 'No computed traverses found for this project' },
      { status: 404 },
    )
  }

  // ── Fetch coordinates and observations for each traverse ────────────────
  const stations: Array<{
    name: string
    easting: number
    northing: number
    adjustedEasting?: number
    adjustedNorthing?: number
  }> = []

  const legs: Array<{
    from: string
    to: string
    bearing: number
    distance: number
  }> = []

  let totalAngularMisclosure = 0
  let totalLinearError = 0
  let worstPrecisionRatio = 0

  // Track station names to avoid duplicates across parcels
  const seenStations = new Set<string>()

  for (const traverse of traverses) {
    // Fetch coordinates for this traverse
    const { rows: coords } = await db.query(
      `SELECT station, easting, northing, rl
       FROM traverse_coordinates
       WHERE traverse_id = $1
       ORDER BY station`,
      [traverse.traverse_id],
    )

    // Fetch observations for this traverse
    const { rows: observations } = await db.query(
      `SELECT station, bs, fs,
              hcl_deg, hcl_min, hcl_sec,
              hcr_deg, hcr_min, hcr_sec,
              slope_dist
       FROM traverse_observations
       WHERE traverse_id = $1
       ORDER BY observation_order`,
      [traverse.traverse_id],
    )

    // Build station entries (unique by name)
    for (const c of coords) {
      const stationName = `${c.station}`
      // Prefix with block-parcel to avoid name collisions across parcels
      const uniqueKey = `${traverse.block_number}-${traverse.parcel_number}-${c.station}`
      const displayName = traverses.length > 1
        ? `${traverse.block_number}/${traverse.parcel_number}:${c.station}`
        : c.station

      stations.push({
        name: seenStations.has(stationName) ? displayName : stationName,
        easting: Number(c.easting),
        northing: Number(c.northing),
      })
      seenStations.add(stationName)
    }

    // Build leg entries from observations
    for (let i = 0; i < observations.length; i++) {
      const obs = observations[i]
      const fromStation = obs.station
      const toStation = obs.fs

      // Compute forward bearing from horizontal circle readings (CR - CL)
      const clTotal = (obs.hcl_deg || 0) + (obs.hcl_min || 0) / 60 + (obs.hcl_sec || 0) / 3600
      const crTotal = (obs.hcr_deg || 0) + (obs.hcr_min || 0) / 60 + (obs.hcr_sec || 0) / 3600
      let bearing = crTotal - clTotal
      if (bearing < 0) bearing += 360

      legs.push({
        from: fromStation,
        to: toStation,
        bearing: bearing,
        distance: Number(obs.slope_dist) || 0,
      })
    }

    // Accumulate misclosure data
    if (traverse.linear_error != null) {
      totalLinearError += Number(traverse.linear_error)
    }
    if (traverse.precision_ratio != null) {
      const ratio = Number(traverse.precision_ratio)
      if (ratio > worstPrecisionRatio) worstPrecisionRatio = ratio
    }
  }

  // Compute angular misclosure (sum of bearings around a closed traverse)
  if (legs.length >= 3) {
    const bearingSum = legs.reduce((sum, leg) => sum + leg.bearing, 0)
    // Theoretical sum for a closed traverse: (n - 2) * 180
    const n = legs.length
    const theoreticalSum = (n - 2) * 180
    totalAngularMisclosure = bearingSum - theoreticalSum
  }

  // ── Determine datum string ──────────────────────────────────────────────
  const datum = project.datum || 'Arc 1960 / UTM Zone 37S'

  // ── Generate DXF ───────────────────────────────────────────────────────
  const dxfString = generateTraverseDXF({
    stations,
    legs,
    misclosure: {
      angular: totalAngularMisclosure,
      linear: totalLinearError,
      precisionRatio: worstPrecisionRatio || 0,
    },
    projectInfo: {
      name: project.name,
      lrNumber: project.scheme_number || project.name,
      county: project.county || '—',
      datum,
      surveyor: project.surveyor_name || '—',
    },
  })

  // ── Build filename ──────────────────────────────────────────────────────
  const safeName = (project.name || 'traverse').replace(/[^a-zA-Z0-9_-]/g, '_')
  const date = new Date().toISOString().split('T')[0]
  const filename = `Traverse_${safeName}_${date}.dxf`

  // ── Return as downloadable DXF response ─────────────────────────────────
  return new NextResponse(dxfString, {
    status: 200,
    headers: {
      'Content-Type': 'application/dxf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

/**
 * GET /api/compute/export/traverse-dxf
 *
 * Returns endpoint metadata.
 */
export const GET = apiHandler({ auth: false, rateLimit: { max: 20, windowMs: 60000 } }, async () => {
  return NextResponse.json({
    endpoint: '/api/compute/export/traverse-dxf',
    method: 'POST',
    description: 'Generate a traverse-specific DXF export for a project.',
    python_required: false,
    accepts: { projectId: 'string (required)' },
    produces: 'application/dxf (binary download)',
  })
})
