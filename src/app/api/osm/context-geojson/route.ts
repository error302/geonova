/**
 * API: POST /api/osm/context-geojson
 *
 * Proxy to the Python worker's context-geojson endpoint.
 *
 * SECURITY (audit H-12, 2026-08-30): requires an authenticated session, is
 * rate-limited, and the radius is capped (2000m).
 */

import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'

const PYTHON_WORKER_URL = process.env.PYTHON_WORKER_URL || 'http://localhost:8001'
const WORKER_SECRET = process.env.WORKER_SECRET || ''

const MAX_RADIUS_METERS = 2000

export const POST = apiHandler(
  { auth: true, rateLimit: { max: 20, windowMs: 60000 } },
  async (request: NextRequest) => {
    try {
      const body = (await request.json().catch(() => ({}))) as { lat?: number; lon?: number; radius?: number }
      const { lat, lon } = body
      const radius = Math.min(Math.max(Number(body.radius), 50), MAX_RADIUS_METERS)

      if (lat === undefined || lon === undefined || body.radius === undefined) {
        return NextResponse.json(
          { error: 'Missing required params: lat, lon, radius' },
          { status: 400 },
        )
      }

      const res = await fetch(`${PYTHON_WORKER_URL}/osm/context-geojson`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Worker-Secret': WORKER_SECRET,
        },
        body: JSON.stringify({ lat, lon, radius }),
      })

      if (!res.ok) {
        return NextResponse.json(
          { error: `Worker returned ${res.status}` },
          { status: res.status },
        )
      }

      const data = (await res.json()) as unknown
      return NextResponse.json(data)
    } catch (err) {
      return NextResponse.json(
        {
          error: 'Python worker unavailable or failed to process',
          message: err instanceof Error ? err.message : 'Unknown',
        },
        { status: 503 },
      )
    }
  }
)
