import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { requireProjectOwnership } from '@/lib/auth/ownership'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const SchemeMapQuerySchema = z.object({
  project_id: z.string().uuid({ message: 'project_id must be a valid UUID' }),
})

// ─── DB Row Interfaces ───────────────────────────────────────────────────────

interface ParcelRow {
  parcel_id: string
  parcel_number: string
  lr_number_proposed: string | null
  area_ha: number | null
  parcel_status: string
  block_id: string
  block_number: string
  station_name: string | null
  easting: number | string | null
  northing: number | string | null
  elevation: number | string | null
}

interface BlockRow {
  id: string
  block_number: string
  block_name: string
  description: string | null
}

interface CoordinateEntry {
  station: string
  easting: number
  northing: number
  elevation: number | null
}

interface GeoJSONFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: {
    type: string
    coordinates: number[] | number[][] | number[][][]
  }
}

export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')

  const queryParsed = SchemeMapQuerySchema.safeParse({ project_id: projectId })
  if (!queryParsed.success) {
    return NextResponse.json({ error: 'Invalid project_id', details: queryParsed.error.issues }, { status: 400 })
  }

  // IDOR protection — verify project ownership before returning
  // sensitive cadastral data (blocks, parcels, traverse coordinates)
  const ownership = await requireProjectOwnership(queryParsed.data.project_id, ctx.userId)
  if (!ownership.ok) return ownership.error ?? NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get all blocks for the project
  const { rows: blocks } = await db.query<BlockRow>(
    'SELECT id, block_number, block_name, description FROM blocks WHERE project_id = $1 ORDER BY block_number',
    [projectId]
  )

  // Get all parcels with traverse coordinates
  const { rows: parcels } = await db.query<ParcelRow>(
    `SELECT
      p.id as parcel_id, p.parcel_number, p.lr_number_proposed, p.area_ha, p.status as parcel_status,
      b.id as block_id, b.block_number,
      tc.station_name, tc.easting, tc.northing, tc.elevation
     FROM parcels p
     JOIN blocks b ON b.id = p.block_id
     LEFT JOIN traverse_coordinates tc ON tc.traverse_id = (
       SELECT id FROM parcel_traverses WHERE parcel_id = p.id AND status IN ('computed', 'approved')
       ORDER BY computed_at DESC LIMIT 1
     )
     WHERE b.project_id = $1
     ORDER BY b.block_number, p.parcel_number, tc.station_name`,
    [projectId]
  )

  // Group parcels by block, group coordinates by parcel
  const parcelMap = new Map<string, CoordinateEntry[]>()
  parcels.forEach((row) => {
    if (!parcelMap.has(row.parcel_id)) {
      parcelMap.set(row.parcel_id, [])
    }
    if (row.easting !== null && row.northing !== null) {
      const existing = parcelMap.get(row.parcel_id)
      if (existing) {
        existing.push({
          station: row.station_name || '',
          easting: Number(row.easting),
          northing: Number(row.northing),
          elevation: row.elevation ? Number(row.elevation) : null,
        })
      }
    }
  })

  // Build GeoJSON features for parcels
  const features: GeoJSONFeature[] = []

  // Add parcel boundary polygons (from traverse coordinates)
  const seenParcels = new Set<string>()
  parcels.forEach((row) => {
    if (seenParcels.has(row.parcel_id)) return
    seenParcels.add(row.parcel_id)

    const coords = parcelMap.get(row.parcel_id) || []
    if (coords.length >= 3) {
      // Close the polygon
      const ring = coords.map(c => [c.easting, c.northing])
      ring.push(ring[0]) // close ring

      features.push({
        type: 'Feature',
        properties: {
          type: 'parcel',
          parcel_id: row.parcel_id,
          parcel_number: row.parcel_number,
          lr_number: row.lr_number_proposed,
          block_number: row.block_number,
          area_ha: row.area_ha,
          status: row.parcel_status,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [ring],
        },
      })
    } else if (coords.length > 0) {
      // Not enough points for polygon, add as point
      coords.forEach(c => {
        features.push({
          type: 'Feature',
          properties: {
            type: 'parcel_point',
            parcel_id: row.parcel_id,
            parcel_number: row.parcel_number,
            block_number: row.block_number,
            station: c.station,
          },
          geometry: {
            type: 'Point',
            coordinates: [c.easting, c.northing],
          },
        })
      })
    }
  })

  // Add block centroids
  const blockParcelMap = new Map<string, ParcelRow[]>()
  parcels.forEach((row) => {
    if (!blockParcelMap.has(row.block_id)) blockParcelMap.set(row.block_id, [])
    const blockList = blockParcelMap.get(row.block_id)
    if (blockList) blockList.push(row)
  })

  blocks.forEach((block) => {
    const blockParcels = blockParcelMap.get(block.id) || []
    if (blockParcels.length > 0) {
      const allCoords = blockParcels
        .filter((r) => r.easting !== null)
        .map((r) => [Number(r.easting), Number(r.northing)])

      if (allCoords.length > 0) {
        const centroid = allCoords.reduce(
          (acc, c) => [acc[0] + c[0], acc[1] + c[1]],
          [0, 0]
        ).map((sum) => sum / allCoords.length)

        features.push({
          type: 'Feature',
          properties: {
            type: 'block_label',
            block_id: block.id,
            block_number: block.block_number,
            block_name: block.block_name,
            parcel_count: new Set(blockParcels.map((r) => r.parcel_id)).size,
          },
          geometry: {
            type: 'Point',
            coordinates: centroid,
          },
        })
      }
    }
  })

  // Calculate bounds
  const allEasting = features
    .filter(f => f.geometry.type === 'Polygon')
    .flatMap(f => (f.geometry.coordinates as number[][][])[0].map((c) => c[0]))
  const allNorthing = features
    .filter(f => f.geometry.type === 'Polygon')
    .flatMap(f => (f.geometry.coordinates as number[][][])[0].map((c) => c[1]))

  const bounds = (allEasting.length > 0 && allNorthing.length > 0)
    ? [Math.min(...allEasting), Math.min(...allNorthing), Math.max(...allEasting), Math.max(...allNorthing)]
    : null

  return NextResponse.json({
    type: 'FeatureCollection',
    features,
    bounds,
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::21037' } }, // Arc 1960 / UTM Zone 37S (Kenya cadastral datum)
  })
})
