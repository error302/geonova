import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface SchemeParcelRow {
  id: string
  parcel_number: string | null
  lr_number_proposed: string | null
  area_ha: string | number | null
  status: string | null
  revision_number: string | null
  block_id: string
  block_number: string | null
  block_name: string | null
  is_closed: boolean | null
  perimeter: string | number | null
  linear_error: string | number | null
  precision_ratio: string | number | null
  accuracy_order: string | null
  computed_area_ha: string | number | null
  station_name: string | null
  easting: string | number | null
  northing: string | number | null
  elevation: string | number | null
}

interface ParcelCoord {
  station: string | null
  easting: number
  northing: number
  elevation: number | null
}

interface ParcelAgg {
  id: string
  parcel_number: string | null
  lr_number_proposed: string | null
  block_number: string | null
  block_name: string | null
  area_ha: string | number | null
  status: string | null
  revision_number: string | null
  is_closed: boolean | null
  perimeter: string | number | null
  linear_error: string | number | null
  precision_ratio: string | number | null
  accuracy_order: string | null
  computed_area_ha: string | number | null
  coordinates: ParcelCoord[]
}

type GeoGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPoint'; coordinates: number[][] }
  | null

export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, _ctx) => {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  const { rows: parcels } = await db.query<SchemeParcelRow>(
    `SELECT
      p.id, p.parcel_number, p.lr_number_proposed, p.area_ha, p.status,
      p.revision_number,
      b.id as block_id, b.block_number, b.block_name,
      pt.is_closed, pt.perimeter, pt.linear_error, pt.precision_ratio,
      pt.accuracy_order, pt.computed_area_ha,
      tc.station_name, tc.easting, tc.northing, tc.elevation
     FROM parcels p
     JOIN blocks b ON b.id = p.block_id
     LEFT JOIN parcel_traverses pt ON pt.parcel_id = p.id AND pt.status IN ('computed', 'approved')
     LEFT JOIN traverse_coordinates tc ON tc.traverse_id = pt.id
     WHERE b.project_id = $1
     ORDER BY b.block_number, p.parcel_number`,
    [projectId]
  )

  // Group by parcel
  const parcelMap = new Map<string, ParcelAgg>()
  for (const row of parcels) {
    let agg = parcelMap.get(row.id)
    if (!agg) {
      agg = {
        id: row.id,
        parcel_number: row.parcel_number,
        lr_number_proposed: row.lr_number_proposed,
        block_number: row.block_number,
        block_name: row.block_name,
        area_ha: row.area_ha,
        status: row.status,
        revision_number: row.revision_number,
        is_closed: row.is_closed,
        perimeter: row.perimeter,
        linear_error: row.linear_error,
        precision_ratio: row.precision_ratio,
        accuracy_order: row.accuracy_order,
        computed_area_ha: row.computed_area_ha,
        coordinates: [],
      }
      parcelMap.set(row.id, agg)
    }
    if (row.easting !== null && row.northing !== null) {
      agg.coordinates.push({
        station: row.station_name,
        easting: Number(row.easting),
        northing: Number(row.northing),
        elevation: row.elevation ? Number(row.elevation) : null,
      })
    }
  }

  const features = Array.from(parcelMap.values()).map(p => {
    const coords = p.coordinates
    let geometry: GeoGeometry

    if (coords.length >= 3) {
      const ring = coords.map((c) => [c.easting, c.northing])
      ring.push(ring[0]) // close
      geometry = { type: 'Polygon', coordinates: [ring] }
    } else if (coords.length > 0) {
      geometry = { type: 'MultiPoint', coordinates: coords.map((c) => [c.easting, c.northing]) }
    } else {
      geometry = null
    }

    return {
      type: 'Feature',
      properties: {
        parcel_number: p.parcel_number,
        lr_number: p.lr_number_proposed,
        block_number: p.block_number,
        block_name: p.block_name,
        area_ha: p.computed_area_ha || p.area_ha,
        status: p.status,
        revision: p.revision_number,
        is_closed: p.is_closed,
        perimeter: p.perimeter,
        linear_error: p.linear_error,
        precision_ratio: p.precision_ratio,
        accuracy_order: p.accuracy_order,
        coordinate_count: coords.length,
      },
      geometry,
    }
  }).filter(f => f.geometry !== null)

  return NextResponse.json({
    type: 'FeatureCollection',
    features,
    name: 'metardu_scheme_export',
    crs: {
      type: 'name',
      properties: { name: 'urn:ogc:def:crs:EPSG::21037' }, // Arc 1960 / UTM Zone 37S (Kenya cadastral datum)
    },
  })
})
