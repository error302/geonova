import { NextResponse } from 'next/server'
import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth/session'
import { viewportQueryResponseSchema, type ViewportFeature } from '@/lib/validation/viewportQuery'

export const dynamic = 'force-dynamic'

// ─── DB Row Interfaces ───────────────────────────────────────────────────────

interface ParcelRow {
  id: string
  parcel_number: string
  area_ha: string | number | null
  status: string | null
  geojson: string | null
}

interface BeaconRow {
  id: string
  point_name: string | null
  easting: string | number
  northing: string | number
}

interface FieldRecordRow {
  id: string
  fr_number: string | null
  easting: string | number
  northing: string | number
  county: string | null
  locality: string | null
  survey_year: string | number | null
  surveyor_name: string | null
  is_verified: boolean | null
}


/**
 * GET /api/spatial-index?west=&south=&east=&north=
 *
 * Returns GeoJSON features (parcels, beacons, field records) within
 * the given WGS84 bounding box. Uses PostGIS ST_MakeEnvelope + ST_Intersects.
 *
 * This powers the dynamic viewport query — as surveyors pan the map,
 * nearby spatial data loads automatically.
 *
 * Query params:
 *   - west, south, east, north: WGS84 bounding box
 *   - limit: max features (default 200, max 500)
 *   - types: comma-separated feature types to include (parcel,beacon,field_record)
 */
export const GET = apiHandler(
  { auth: true, rateLimit: { max: 60, windowMs: 60000 } },
  async (req, _ctx) => {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const west = parseFloat(url.searchParams.get('west') || '')
    const south = parseFloat(url.searchParams.get('south') || '')
    const east = parseFloat(url.searchParams.get('east') || '')
    const north = parseFloat(url.searchParams.get('north') || '')
    const limit = Math.min(500, parseInt(url.searchParams.get('limit') || '200', 10))
    const types = url.searchParams.get('types')?.split(',') || ['parcel', 'beacon', 'field_record']

    if (!isFinite(west) || !isFinite(south) || !isFinite(east) || !isFinite(north)) {
      return NextResponse.json({ error: 'Invalid bounding box' }, { status: 400 })
    }

    const features: ViewportFeature[] = []

    // 1. Fetch parcels in viewport (join projects for ownership)
    // AUDIT FIX (2026-07-03): parcels.geometry → parcels.geom,
    // removed non-existent owner_name/lr_number, JOIN projects
    // (parcels has no user_id), errors logged not swallowed.
    if (types.includes('parcel')) {
      try {
        const result = await db.query<ParcelRow>(
          `SELECT p.id, p.parcel_number, p.area_ha, p.status,
                  ST_AsGeoJSON(ST_Transform(p.geom, 4326)) as geojson
           FROM parcels p
           JOIN projects pr ON pr.id = p.project_id
           WHERE pr.user_id = $1
             AND p.geom IS NOT NULL
             AND p.geom && ST_Transform(ST_MakeEnvelope($2, $3, $4, $5, 4326), 21037)
           LIMIT $6`,
          [user.id, west, south, east, north, Math.floor(limit / 2)],
        )

        for (const row of result.rows) {
          if (row.geojson) {
            features.push({
              id: `parcel-${row.id}`,
              type: 'parcel',
              geometry: JSON.parse(row.geojson) as ViewportFeature['geometry'],
              properties: {
                parcelNumber: row.parcel_number,
                areaHa: row.area_ha ? parseFloat(String(row.area_ha)) : null,
                status: row.status || 'pending',
              },
            })
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console -- viewport query failure log, not user-facing
        console.error('[spatial-index] parcel query failed:', err)
      }
    }

    // 2. Fetch beacons in viewport
    if (types.includes('beacon')) {
      try {
        // Transform WGS84 bbox to EPSG:21037 for beacon query
        const result = await db.query<BeaconRow>(
          `SELECT id, point_name, easting, northing
           FROM survey_points
           WHERE project_id IN (SELECT id FROM projects WHERE user_id = $1)
             AND easting BETWEEN $2 AND $3
             AND northing BETWEEN $4 AND $5
           LIMIT $6`,
          [
            user.id,
            // Approximate transform: WGS84 to UTM 37S (simplified)
            // In production, use ST_Transform for accuracy
            west * 111000, // rough easting
            east * 111000,
            south * 111000,
            north * 111000,
            Math.floor(limit / 3),
          ],
        )

        for (const row of result.rows) {
          features.push({
            id: `beacon-${row.id}`,
            type: 'beacon',
            geometry: {
              type: 'Point',
              coordinates: [parseFloat(String(row.easting)), parseFloat(String(row.northing))],
            },
            properties: {
              beaconNumber: row.point_name || '',
              beaconType: 'concrete',
            },
          })
        }
      } catch (err) {
        // eslint-disable-next-line no-console -- viewport query failure log, not user-facing
        console.error('[spatial-index] beacon query failed:', err)
      }
    }
    if (types.includes('field_record')) {
      try {
        const result = await db.query<FieldRecordRow>(
          `SELECT id, fr_number, easting, northing, county, locality,
                  survey_year, surveyor_name, is_verified
           FROM field_records
           WHERE easting BETWEEN $1 AND $2
             AND northing BETWEEN $3 AND $4
           LIMIT $5`,
          [
            west * 111000,
            east * 111000,
            south * 111000,
            north * 111000,
            Math.floor(limit / 4),
          ],
        )

        for (const row of result.rows) {
          features.push({
            id: `fr-${row.id}`,
            type: 'field_record',
            geometry: {
              type: 'Point',
              coordinates: [parseFloat(String(row.easting)), parseFloat(String(row.northing))],
            },
            properties: {
              frNumber: row.fr_number,
              county: row.county,
              locality: row.locality,
              surveyYear: row.survey_year,
              surveyorName: row.surveyor_name,
              isVerified: row.is_verified,
            },
          })
        }
      } catch (err) {
        // eslint-disable-next-line no-console -- viewport query failure log, not user-facing
        console.error('[spatial-index] field_record query failed:', err)
      }
    }

    // Validate the response against the shared schema — the same one the
    // client hook derives its type from. If this ever fails, the response and
    // the client viewport shape have drifted; fail loudly instead of silently
    // shipping a mismatched payload.
    const payload = {
      type: 'FeatureCollection' as const,
      features,
      count: features.length,
      bbox: [west, south, east, north],
    }
    const parsed = viewportQueryResponseSchema.safeParse(payload)
    if (!parsed.success) {
      // eslint-disable-next-line no-console -- internal response drift log, not user-facing
      console.error('[spatial-index] response validation failed:', parsed.error.issues)
      return NextResponse.json({ error: 'Internal response validation failed' }, { status: 500 })
    }
    return apiSuccess(parsed.data)
  },
)
