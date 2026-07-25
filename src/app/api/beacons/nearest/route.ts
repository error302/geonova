/**
 * GET /api/beacons/nearest?lat=-1.2921&lon=36.8219&radiusKm=10&limit=5&types=TRIG,BM
 *
 * Find the nearest survey control points (trig beacons, bench marks)
 * to a coordinate. Uses haversine distance for accuracy. Cached in-
 * memory for offline field use.
 *
 * Response: { beacons: BeaconSearchResult[], total, radiusKm, elapsedMs }
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { findNearestBeacons, formatBeaconResults, type BeaconType } from '@/lib/survey/beaconLookup'

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 60, windowMs: 60000 } },
  async (req, _ctx) => {
    const url = new URL(req.url)
    const lat = parseFloat(url.searchParams.get('lat') || '')
    const lon = parseFloat(url.searchParams.get('lon') || '')

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return NextResponse.json(
        { error: 'lat and lon query params are required and must be numbers' },
        { status: 400 }
      )
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return NextResponse.json(
        { error: 'lat must be -90 to 90, lon must be -180 to 180' },
        { status: 400 }
      )
    }

    const radiusKm = parseFloat(url.searchParams.get('radiusKm') || '50')
    const limit = parseInt(url.searchParams.get('limit') || '10', 10)
    const typesParam = url.searchParams.get('types')
    const types = typesParam
      ? (typesParam.split(',').filter(Boolean) as BeaconType[])
      : undefined
    const country = url.searchParams.get('country') || undefined

    const result = await findNearestBeacons({
      latitude: lat,
      longitude: lon,
      radiusKm,
      limit,
      types,
      country,
    })

    return apiSuccess({
      beacons: result.beacons,
      total: result.total,
      radiusKm: result.radiusKm,
      elapsedMs: result.elapsedMs,
      fromCache: result.fromCache,
      formatted: formatBeaconResults(result),
    })
  }
)
