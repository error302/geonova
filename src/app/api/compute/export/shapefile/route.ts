import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { generateShapefileZip } from '@/lib/export/shapefile'

export const dynamic = 'force-dynamic'

/**
 * POST /api/compute/export/shapefile
 *
 * Accepts `{ projectId }`, fetches survey points and boundary data from the
 * database, and returns a downloadable ZIP containing ESRI Shapefile packages
 * (.shp, .shx, .dbf, .prj, .cpg) for beacons, boundaries, and parcels.
 */
export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const body = ctx.body as { projectId?: string }
  if (!body.projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  }

  const projectId = body.projectId

  // Fetch project survey points and boundary data
  const { rows: project } = await db.query(
    'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
    [projectId, ctx.userId]
  )
  if (!project.length) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const { rows: points } = await db.query(
    `SELECT point_name, easting, northing, elevation, point_type, description
     FROM survey_points WHERE project_id = $1 ORDER BY point_name`,
    [projectId]
  )

  const boundary = project[0].boundary_data || {}
  const adjustedStations = boundary.adjustedStations || []

  const beacons = points.map(p => ({
    station: p.point_name,
    easting: Number(p.easting),
    northing: Number(p.northing),
    elevation: Number(p.elevation || 0),
    beacon_class: p.point_type || '',
    description: p.description || '',
  }))

  const boundaries: Array<{
    from: string
    to: string
    from_easting: number
    from_northing: number
    to_easting: number
    to_northing: number
    distance: number
    bearing: string
  }> = []

  for (let i = 0; i < adjustedStations.length; i++) {
    const from = adjustedStations[i]
    const to = adjustedStations[(i + 1) % adjustedStations.length]
    if (from && to) {
      const dE = (to.adjustedEasting || 0) - (from.adjustedEasting || 0)
      const dN = (to.adjustedNorthing || 0) - (from.adjustedNorthing || 0)
      const bearingDeg = ((Math.atan2(dE, dN) * 180) / Math.PI + 360) % 360

      // Format bearing as DMS string
      const deg = Math.floor(bearingDeg)
      const minFloat = (bearingDeg - deg) * 60
      const min = Math.floor(minFloat)
      const sec = ((minFloat - min) * 60).toFixed(2)
      const bearingDMS = `${String(deg).padStart(3, '0')}°${String(min).padStart(2, '0')}'${sec.padStart(5, '0')}"`

      boundaries.push({
        from: from.pointName || `S${i + 1}`,
        to: to.pointName || `S${(i + 1) % adjustedStations.length + 1}`,
        from_easting: from.adjustedEasting || 0,
        from_northing: from.adjustedNorthing || 0,
        to_easting: to.adjustedEasting || 0,
        to_northing: to.adjustedNorthing || 0,
        distance: Math.sqrt(dE * dE + dN * dN),
        bearing: bearingDMS,
      })
    }
  }

  const parcels = adjustedStations.length >= 3 ? [{
    id: project[0].lr_number || 'PARCEL_001',
    lr_number: project[0].lr_number,
    area_sqm: project[0].area_ha ? project[0].area_ha * 10000 : 0,
    area_ha: project[0].area_ha || 0,
    coordinates: adjustedStations.map((s: any) => [
      s.adjustedEasting || 0,
      s.adjustedNorthing || 0,
    ] as [number, number]),
  }] : []

  const zip = await generateShapefileZip({
    beacons,
    boundaries,
    parcels,
    projection: {
      zone: project[0].utm_zone || 37,
      hemisphere: (project[0].hemisphere || 'S') as 'N' | 'S',
      datum: project[0].datum || 'Arc 1960',
      ellipsoid: project[0].datum === 'Arc 1960' ? 'Clarke 1880 (RGS)' : 'WGS 84',
    },
  })

  const safeName = (project[0].lr_number || project[0].name || 'survey')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase()

  return new NextResponse(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName}_shapefiles.zip"`,
    },
  })
})

/**
 * GET /api/compute/export/shapefile
 *
 * Returns endpoint metadata.
 */
export const GET = apiHandler({ auth: false, rateLimit: { max: 20, windowMs: 60000 } }, async () => {
  return NextResponse.json({
    endpoint: '/api/compute/export/shapefile',
    method: 'POST',
    description: 'Generate a ZIP of ESRI Shapefiles (.shp/.shx/.dbf/.prj) for a project.',
    accepts: { projectId: 'string (required)' },
    produces: 'application/zip (binary download)',
  })
})
