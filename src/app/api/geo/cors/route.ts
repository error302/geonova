import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { findNearestCORS } from '@/lib/geo/cors'

export const dynamic = 'force-dynamic'

export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (request, _ctx) => {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  if (lat < -5 || lat > 5 || lng < 33 || lng > 42) {
    return NextResponse.json({
      error: 'Coordinates outside Kenya bounds. Ensure you are using geographic coordinates (WGS84).'
    }, { status: 400 })
  }

  const results = findNearestCORS(lat, lng)
  return NextResponse.json({ results })
})
