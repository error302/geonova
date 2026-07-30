/**
 * API: POST /api/osm/auto-abuttals
 *
 * Proxy to the Python worker's auto-abuttals endpoint.
 * Auto-populates deed plan abuttals (N/S/E/W) from nearby OSM features.
 *
 * Body:
 *   { "lat": -1.2921, "lon": 36.8219, "radius": 200 }
 *
 * Response:
 *   { "north": "Mombasa Road (120m E)", "south": "...", "east": "...", "west": "..." }
 */

import { NextRequest, NextResponse } from 'next/server'

const PYTHON_WORKER_URL = process.env.PYTHON_WORKER_URL || 'http://localhost:8001'
const WORKER_SECRET = process.env.WORKER_SECRET || ''  // P0-5: fail-closed, no dev fallback

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lat, lon, radius = 200 } = body

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return NextResponse.json(
        { error: 'lat and lon must be numbers' },
        { status: 400 },
      )
    }

    const res = await fetch(`${PYTHON_WORKER_URL}/osm/auto-abuttals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': WORKER_SECRET,
      },
      body: JSON.stringify({ lat, lon, radius }),
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
