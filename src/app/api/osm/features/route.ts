/**
 * API: GET /api/osm/features
 *
 * Proxy to the Python worker's Pyrosm endpoint.
 * Returns OSM features (buildings, roads, POIs) within a bounding box.
 *
 * Query params:
 *   minlon, minlat, maxlon, maxlat — bounding box in WGS84
 *   types — comma-separated: buildings,roads,pois,natural
 */

import { NextRequest, NextResponse } from 'next/server'

const PYTHON_WORKER_URL = process.env.PYTHON_WORKER_URL || 'http://localhost:8001'
const WORKER_SECRET = process.env.WORKER_SECRET || ''  // P0-5: fail-closed, no dev fallback

export async function GET(request: NextRequest) {
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

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Python worker unavailable',
        message: err instanceof Error ? err.message : 'Unknown error',
        fallback: true,
        setup_instructions: 'Start the Python worker: cd python_worker && uvicorn main:app --port 8001',
      },
      { status: 503 },
    )
  }
}
