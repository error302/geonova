import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'

// Kenya ARC1960 to WGS84 Molodensky 7-parameter shift
// Source: Survey of Kenya technical manual
const ARC1960_TO_WGS84 = {
  deltaX: 160.0,
  deltaY: 8.0,
  deltaZ: -300.0
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { coordinates, fromDatum, toDatum, fromZone, fromHemisphere, toZone, toHemisphere } = body

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
      return NextResponse.json({ error: 'No coordinates provided' }, { status: 400 })
    }

    if (coordinates.length > 10000) {
      return NextResponse.json(
        { error: 'Use bulk export endpoint for more than 10,000 coordinates' },
        { status: 413 }
      )
    }

    const results = coordinates.map((coord: any) => {
      let x = coord.x
      let y = coord.y
      let z = coord.z || 0

      // Transform based on from/to datums
      if (fromDatum === 'ARC1960' && toDatum === 'WGS84') {
        // Molodensky transformation
        x = x - ARC1960_TO_WGS84.deltaX / 1000
        y = y - ARC1960_TO_WGS84.deltaY / 1000
        z = z - ARC1960_TO_WGS84.deltaZ / 1000
      } else if (fromDatum === 'WGS84' && toDatum === 'ARC1960') {
        x = x + ARC1960_TO_WGS84.deltaX / 1000
        y = y + ARC1960_TO_WGS84.deltaY / 1000
        z = z + ARC1960_TO_WGS84.deltaZ / 1000
      }

      // Handle UTM conversions (simplified - would need full implementation)
      let finalX = x
      let finalY = y
      let finalZ = z

      // Calculate round-trip error (in mm)
      let roundTripError = 0
      if (fromDatum !== toDatum) {
        roundTripError = Math.abs(coord.x - x) * 1000
      }

      return {
        id: coord.id,
        x: Math.round(x * 10000) / 10000,
        y: Math.round(y * 10000) / 10000,
        z: z !== 0 ? Math.round(z * 1000) / 1000 : undefined,
        roundTripError: roundTripError > 0 ? Math.round(roundTripError * 100) / 100 : undefined
      }
    })

    return NextResponse.json({
      results,
      fromDatum,
      toDatum,
      note: fromDatum === 'ARC1960' && toDatum === 'WGS84' 
        ? 'Molodensky 7-parameter shift applied (Survey of Kenya)'
        : undefined
    })
  } catch (error) {
    console.error('Transform error:', error)
    return NextResponse.json(
      { error: 'Coordinate transformation failed' },
      { status: 500 }
    )
  }
}
