import { NextRequest, NextResponse } from 'next/server'

const PYTHON_WORKER_URL = process.env.PYTHON_WORKER_URL || 'http://localhost:8001'
const WORKER_SECRET = process.env.WORKER_SECRET || ''

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lat, lon, radius } = body

    if (lat === undefined || lon === undefined || radius === undefined) {
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

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Python worker unavailable or failed to process',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 503 },
    )
  }
}
