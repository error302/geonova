/**
 * API: GET /api/osm/features
 *
 * Proxy to the Python worker's Pyrosm endpoint.
 * Returns OSM features (buildings, roads, POIs) within a bounding box.
 *
 * Query params:
 *   minlon, minlat, maxlon, maxlat — bounding box in WGS84
 *   types — comma-separated: buildings,roads,pois,natural
 *
 * SECURITY (audit H-12, 2026-08-30): requires an authenticated session and
 * is rate-limited. The bounding box is validated and capped (~0.25 degrees)
 * so anonymous parties can no longer drive arbitrary PBF parsing load.
 */

import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'

const PYTHON_WORKER_URL = process.env.PYTHON_WORKER_URL || 'http://localhost:8001'
const WORKER_SECRET = process.env.WORKER_SECRET || ''  // P0-5: fail-closed, no dev fallback

// ~28km square — plenty for any survey context view
const MAX_BBOX_DEGREES = 0.25

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 30, windowMs: 60000 } },
  async (request: NextRequest) => {
    const searchParams = request.nextUrl.searchParams
    const minlon = searchParams.get('minlon')
    const minlat = searchParams.get('minlat')
    const maxlon = searchParams.get('maxlon')
    const maxlat = searchParams.get('maxlat')
    const types = searchParams.get('types') || 'buildings,roads,pois'

    if (!minlon || !minlat || !maxlon || !maxlat) {
      return NextResponse.json(
        { error: 'Missing required params: minlon, minlat, maxlon, maxlat' },
        { status: 400 },
      )
    }

    const nums = [Number(minlon), Number(minlat), Number(maxlon), Number(maxlat)]
    if (nums.some((n) => !Number.isFinite(n))) {
      return NextResponse.json({ error: 'Bounding box params must be numbers' }, { status: 400 })
    }
    const [minLonV, minLatV, maxLonV, maxLatV] = nums
    if (Math.abs(maxLonV - minLonV) > MAX_BBOX_DEGREES || Math.abs(maxLatV - minLatV) > MAX_BBOX_DEGREES) {
      return NextResponse.json(
        { error: `Bounding box too large (max ${MAX_BBOX_DEGREES} degrees per side)` },
        { status: 400 },
      )
    }

    try {
      const params = new URLSearchParams({ minlon, minlat, maxlon, maxlat, types })
      const res = await fetch(`${PYTHON_WORKER_URL}/osm/features?${params}`, {
        headers: { 'X-Worker-Secret': WORKER_SECRET },
      })

      if (!res.ok) {
        return NextResponse.json(
          { error: `Worker returned ${res.status}`, fallback: true },
          { status: res.status },
        )
      }

      const data: unknown = await res.json()
      return NextResponse.json(data)
    } catch (err) {
      return NextResponse.json(
        {
          error: 'Python worker unavailable',
          message: err instanceof Error ? err.message : 'Unknown error',
          fallback: true,
        },
        { status: 503 },
      )
    }
  }
)
