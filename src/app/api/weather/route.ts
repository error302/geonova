export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'

/**
 * GET /api/weather?lat=X&lon=Y
 *
 * Returns current weather (temperature, pressure, humidity) from open-meteo.
 *
 * AUDIT FIX (2026-07-05): Previously unauthenticated and unprotected —
 * anyone could call this endpoint, each call triggering an outbound fetch
 * to open-meteo.com (potential DDOS amplification and IP exhaustion).
 * Now requires auth + 30 req/min rate limit.
 */
export const GET = apiHandler(
  { auth: true, rateLimit: { max: 30, windowMs: 60_000 } },
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get('lat')
    const lon = searchParams.get('lon')

    if (!lat || !lon) {
      return NextResponse.json({ error: 'lat and lon required' }, { status: 400 })
    }

    const latitude = parseFloat(lat)
    const longitude = parseFloat(lon)

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', String(latitude))
    url.searchParams.set('longitude', String(longitude))
    url.searchParams.set('current', 'temperature_2m,surface_pressure,relative_humidity_2m')
    url.searchParams.set('timezone', 'auto')

    const response = await fetch(url.toString(), {
      // Don't let a slow upstream hang our request indefinitely
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Weather service unavailable' }, { status: 503 })
    }

    const data = await response.json() as {
      current: {
        temperature_2m: number
        surface_pressure: number
        relative_humidity_2m: number
      }
    }

    return NextResponse.json({
      temperature: data.current.temperature_2m,
      pressure: data.current.surface_pressure,
      humidity: data.current.relative_humidity_2m,
      fetchedAt: new Date().toISOString(),
    })
  },
)
