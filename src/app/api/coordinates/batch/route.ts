export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { z } from 'zod'

interface BatchPointInput {
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

interface BatchResultItem {
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
}

const transformBatchSchema = z.object({
  points: z.array(z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    easting: z.number().optional(),
    northing: z.number().optional(),
    zone: z.number().optional(),
    hemisphere: z.enum(['N', 'S']).optional(),
    id: z.string().optional(),
    name: z.string().optional(),
    elevation: z.number().optional(),
  })).min(1).max(1000),
  fromSystem: z.enum(['WGS84', 'UTM', 'ARC1960', 'HARTEBEESTHOEK94', 'ADINDAN', 'CAPE', 'ED50', 'PSAD56']),
  toSystem: z.enum(['WGS84', 'UTM', 'ARC1960', 'HARTEBEESTHOEK94', 'ADINDAN', 'CAPE', 'ED50', 'PSAD56']),
})

export const POST = apiHandler(
  { auth: true, schema: transformBatchSchema, rateLimit: { max: 10, windowMs: 60000 } },
  async (req, ctx) => {
    const { transformCoordinates } = await import('@/lib/online/coordinates')

    const { points, fromSystem, toSystem } = ctx.body as {
      points: BatchPointInput[]
      fromSystem: Parameters<typeof transformCoordinates>[1]
      toSystem: Parameters<typeof transformCoordinates>[1]
    }

    const results: BatchResultItem[] = []
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
            hemisphere: point.hemisphere,
          },
          fromSystem,
          toSystem
        )

        if (!result.success || !result.result) {
          throw new Error(result.error || 'Transform failed')
        }

        results.push({
          id: point.id,
          name: point.name,
          latitude: result.result.latitude,
          longitude: result.result.longitude,
          easting: result.result.easting,
          northing: result.result.northing,
          zone: result.result.zone,
          hemisphere: result.result.hemisphere,
          elevation: point.elevation,
          success: true,
        })
        successCount++
      } catch (error) {
        results.push({
          id: point.id,
          name: point.name,
          success: false,
          error: error instanceof Error ? error.message : 'Transform failed',
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
      results,
    })
  }
)

export const GET = apiHandler({ auth: true }, async () => {
  const { getSupportedSystems } = await import('@/lib/online/coordinates')
  return NextResponse.json({
    endpoint: '/coordinates/batch',
    description: 'Batch coordinate transformation',
    systems: getSupportedSystems(),
    maxPoints: 1000,
  })
})