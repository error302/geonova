import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')
  const radius = parseFloat(searchParams.get('radius') || '10')
  const limit = parseInt(searchParams.get('limit') || '10')

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 })
  }

  try {
    const latitude = parseFloat(lat)
    const longitude = parseFloat(lon)

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
    }

    // Get all active benchmarks (simple approach without PostGIS)
    const supabase = createClient()
    const { data: benchmarks, error } = await supabase
      .from('benchmarks')
      .select('*')
      .eq('status', 'ACTIVE')
      .limit(100)

    if (error) throw error

    // Calculate distance for each benchmark and filter
    const results = (benchmarks || [])
      .map((bm: any) => ({
        ...bm,
        distanceKm: calculateDistance(latitude, longitude, bm.latitude, bm.longitude)
      }))
      .filter((bm: any) => bm.distanceKm <= radius)
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
      .slice(0, limit)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Benchmark lookup error:', error)
    return NextResponse.json({ error: 'Failed to lookup benchmarks' }, { status: 500 })
  }
}
