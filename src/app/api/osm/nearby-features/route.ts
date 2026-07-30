/**
 * API: POST /api/osm/nearby-features
 *
 * Proxy to the Python worker's OSMPythonTools endpoint.
 * Finds named OSM features (roads, schools, hospitals, water, boundaries)
 * near a point using the Overpass API.
 *
 * Body:
 *   { "lat": -1.2921, "lon": 36.8219, "radius": 500, "feature_types": ["roads", "schools"] }
 */

import { NextRequest, NextResponse } from 'next/server'

const PYTHON_WORKER_URL = process.env.PYTHON_WORKER_URL || 'http://localhost:8001'
const WORKER_SECRET = process.env.WORKER_SECRET || ''  // P0-5: fail-closed, no dev fallback

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lat, lon, radius = 500, feature_types } = body

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

    const data = await res.json()
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
