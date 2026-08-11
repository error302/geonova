export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { KenCORSStation } from '@/types/kencors'
import { logger } from '@/lib/logger'

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const KenCORSQuerySchema = z.object({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  status: z.enum(['ONLINE', 'DEGRADED', 'OFFLINE']).optional(),
  county: z.string().max(100).optional(),
})

const DEFAULT_STATIONS: KenCORSStation[] = [
  {
    id: 'NAIB',
    name: 'Nairobi',
    shortCode: 'NAIB',
    county: 'Nairobi',
    latitude: -1.2921,
    longitude: 36.8219,
    elevation: 1661.0,
    status: 'ONLINE',
    lastHeartbeat: new Date().toISOString(),
    mountPoints: [
      { name: 'NAIB0', format: 'RTCM3', navSystem: 'GPS+GLO+GAL+BDS', network: 'KENYANET' }
    ]
  },
  {
    id: 'MSAB',
    name: 'Mombasa',
    shortCode: 'MSAB',
    county: 'Mombasa',
    latitude: -4.0435,
    longitude: 39.6682,
    elevation: 17.0,
    status: 'ONLINE',
    lastHeartbeat: new Date().toISOString(),
    mountPoints: [
      { name: 'MSAB0', format: 'RTCM3', navSystem: 'GPS+GLO+GAL', network: 'KENYANET' }
    ]
  },
  {
    id: 'KSMB',
    name: 'Kisumu',
    shortCode: 'KSMB',
    county: 'Kisumu',
    latitude: -0.0917,
    longitude: 34.7680,
    elevation: 1134.0,
    status: 'ONLINE',
    lastHeartbeat: new Date().toISOString(),
    mountPoints: [
      { name: 'KSMB0', format: 'RTCM3', navSystem: 'GPS+GLO+GAL', network: 'KENYANET' }
    ]
  },
  {
    id: 'ELDB',
    name: 'Eldoret',
    shortCode: 'ELDB',
    county: 'Uasin Gishu',
    latitude: 0.5143,
    longitude: 35.2698,
    elevation: 2085.0,
    status: 'ONLINE',
    lastHeartbeat: new Date().toISOString(),
    mountPoints: [
      { name: 'ELDB0', format: 'RTCM3', navSystem: 'GPS+GLO+GAL', network: 'KENYANET' }
    ]
  },
  {
    id: 'NKRB',
    name: 'Nakuru',
    shortCode: 'NKRB',
    county: 'Nakuru',
    latitude: -0.3031,
    longitude: 36.0800,
    elevation: 1861.0,
    status: 'ONLINE',
    lastHeartbeat: new Date().toISOString(),
    mountPoints: [
      { name: 'NKRB0', format: 'RTCM3', navSystem: 'GPS+GLO+GAL', network: 'KENYANET' }
    ]
  },
  {
    id: 'THIB',
    name: 'Thika',
    shortCode: 'THIB',
    county: 'Kiambu',
    latitude: -1.0334,
    longitude: 37.0692,
    elevation: 1452.0,
    status: 'DEGRADED',
    lastHeartbeat: new Date(Date.now() - 3600000).toISOString(),
    mountPoints: [
      { name: 'THIB0', format: 'RTCM3', navSystem: 'GPS+GLO+GAL', network: 'KENYANET' }
    ]
  },
  {
    id: 'NDRB',
    name: 'Nyeri',
    shortCode: 'NDRB',
    county: 'Nyeri',
    latitude: -0.4197,
    longitude: 36.9553,
    elevation: 1759.0,
    status: 'OFFLINE',
    lastHeartbeat: new Date(Date.now() - 86400000).toISOString(),
    mountPoints: [
      { name: 'NDRB0', format: 'RTCM3', navSystem: 'GPS+GLO+GAL', network: 'KENYANET' }
    ]
  }
]

export async function GET(request: NextRequest) {
  try {
    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams: Record<string, unknown> = {}

    const bboxParam = searchParams.get('bbox')
    if (bboxParam) {
      try {
        queryParams.bbox = JSON.parse(bboxParam)
      } catch {
        return NextResponse.json({ error: 'Invalid bbox parameter — must be JSON array of 4 numbers' }, { status: 400 })
      }
    }
    const statusParam = searchParams.get('status')
    if (statusParam) queryParams.status = statusParam
    const countyParam = searchParams.get('county')
    if (countyParam) queryParams.county = countyParam

    const parsed = KenCORSQuerySchema.safeParse(queryParams)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.issues }, { status: 400 })
    }

    const { bbox, status, county } = parsed.data

    const apiKey = process.env.KENCORS_API_KEY

    let stations: KenCORSStation[] = DEFAULT_STATIONS

    if (apiKey) {
      try {
        const response = await fetch('https://kencors.go.ke/api/v1/stations', {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        })

        if (response.ok) {
          const data: unknown = await response.json()
          if (Array.isArray(data)) {
            stations = data as KenCORSStation[]
          }
        }
      } catch (apiError) {
        logger.error('KenCORS API error:', { error: apiError })
      }
    }

    // Apply filters
    if (bbox) {
      const [minLon, minLat, maxLon, maxLat] = bbox
      stations = stations.filter(s =>
        s.longitude >= minLon && s.longitude <= maxLon &&
        s.latitude >= minLat && s.latitude <= maxLat
      )
    }

    if (status) {
      stations = stations.filter(s => s.status === status)
    }

    if (county) {
      stations = stations.filter(s => s.county.toLowerCase() === county.toLowerCase())
    }

    return NextResponse.json({ stations })

  } catch (error) {
    logger.error('KenCORS stations error:', { error: error })
    return NextResponse.json(
      { error: 'Failed to fetch KenCORS stations', stations: DEFAULT_STATIONS },
      { status: 200 }
    )
  }
}
