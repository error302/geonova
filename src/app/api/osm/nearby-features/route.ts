/**
 * API: POST /api/osm/nearby-features
 *
 * Proxy to the Python worker's OSMPythonTools endpoint.
 * Finds named OSM features (roads, schools, hospitals, water, boundaries)
 * near a point using the Overpass API.
 *
 * Body:
 *   { "lat": -1.2921, "lon": 36.8219, "radius": 500, "feature_types": ["roads", "schools"] }
 *
 * SECURITY (audit H-12, 2026-08-30): requires an authenticated session, is
 * rate-limited, and the radius is capped (2000m) — previously unbounded,
 * letting anonymous callers drive arbitrarily large Overpass queries.
 */

import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'

const PYTHON_WORKER_URL = process.env.PYTHON_WORKER_URL || 'http://localhost:8001'
const WORKER_SECRET = process.env.WORKER_SECRET || ''  // P0-5: fail-closed, no dev fallback

const MAX_RADIUS_METERS = 2000

export const POST = apiHandler(
  { auth: true, rateLimit: { max: 20, windowMs: 60000 } },
  async (request: NextRequest) => {
    try {
      const body = (await request.json().catch(() => ({}))) as { lat?: number; lon?: number; radius?: number; feature_types?: string[] }
      const { lat, lon, feature_types } = body
      const radius = Math.min(Math.max(Number(body.radius ?? 500), 50), MAX_RADIUS_METERS)

      if (typeof lat !== 'number' || typeof lon !== 'number') {
        return NextResponse.json(
          { error: 'lat and lon must be numbers' },
          { status: 400 },
        )
      }

      const res = await fetch(`${PYTHON_WORKER_URL}/osm/nearby-features`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Worker-Secret': WORKER_SECRET,
        },
        body: JSON.stringify({
          lat,
          lon,
          radius,
          feature_types: feature_types || ['roads', 'schools', 'health', 'water', 'boundaries'],
        }),
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
