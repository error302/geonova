import { NextRequest, NextResponse } from 'next/server'
import { transformCoordinates, getSupportedSystems, CoordinateSystem } from '@/lib/online/coordinates'

interface CoordinatePoint {
  latitude?: number
  longitude?: number
  easting?: number
  northing?: number
  zone?: number
  hemisphere?: 'N' | 'S'
  id?: string
  name?: string
  elevation?: number
}

interface BatchTransformRequest {
  points: CoordinatePoint[]
  fromSystem: CoordinateSystem
  toSystem: CoordinateSystem
}

interface TransformResult {
  id?: string
  name?: string
  latitude?: number
  longitude?: number
  easting?: number
  northing?: number
  zone?: number
  hemisphere?: string
  elevation?: number
  success: boolean
  error?: string
  fromSystem?: string
  toSystem?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: BatchTransformRequest = await request.json()
    const { points, fromSystem, toSystem } = body

    if (!points || !Array.isArray(points) || points.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid points array' },
        { status: 400 }
      )
    }

    if (!fromSystem || !toSystem) {
      return NextResponse.json(
        { error: 'Missing required parameters: fromSystem, toSystem' },
        { status: 400 }
      )
    }

    const validSystems: CoordinateSystem[] = [
      'WGS84', 'UTM', 'ARC1960', 'HARTEBEESTHOEK94',
      'ADINDAN', 'CAPE', 'ED50', 'PSAD56'
    ]

    if (!validSystems.includes(fromSystem) || !validSystems.includes(toSystem)) {
      return NextResponse.json(
        { error: 'Invalid coordinate system' },
        { status: 400 }
      )
    }

    const results: TransformResult[] = []
    let successCount = 0
    let errorCount = 0

    for (const point of points) {
      try {
        const result = await transformCoordinates(
          {
            latitude: point.latitude,
            longitude: point.longitude,
            easting: point.easting,
            northing: point.northing,
            zone: point.zone,
            hemisphere: point.hemisphere
          },
          fromSystem,
          toSystem
        )

        results.push({
          id: point.id,
          name: point.name,
          latitude: result.latitude,
          longitude: result.longitude,
          easting: result.easting,
          northing: result.northing,
          zone: result.zone,
          hemisphere: result.hemisphere,
          elevation: point.elevation,
          success: true
        })
        successCount++
      } catch (error) {
        results.push({
          id: point.id,
          name: point.name,
          success: false,
          error: error instanceof Error ? error.message : 'Transform failed'
        })
        errorCount++
      }
    }

    return NextResponse.json({
      fromSystem,
      toSystem,
      totalPoints: points.length,
      successCount,
      errorCount,
      results
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Batch transformation failed' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/coordinates/batch',
    description: 'Batch coordinate transformation',
    systems: getSupportedSystems(),
    maxPoints: 1000,
    example: {
      points: [
        { id: '1', name: 'BM001', latitude: -25.747867, longitude: 28.229271 },
        { id: '2', name: 'BM002', latitude: -25.748000, longitude: 28.230000 }
      ],
      fromSystem: 'WGS84',
      toSystem: 'UTM'
    }
  })
}
