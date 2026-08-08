export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { transformCoordinates, getSupportedSystems } from '@/lib/online/coordinates'
import { z } from 'zod'

const transformRequestSchema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  easting: z.number().optional(),
  northing: z.number().optional(),
  zone: z.number().optional(),
  hemisphere: z.enum(['N', 'S']).optional(),
  fromSystem: z.enum(['WGS84', 'UTM', 'ARC1960', 'HARTEBEESTHOEK94', 'ADINDAN', 'CAPE', 'ED50', 'PSAD56']),
  toSystem: z.enum(['WGS84', 'UTM', 'ARC1960', 'HARTEBEESTHOEK94', 'ADINDAN', 'CAPE', 'ED50', 'PSAD56']),
})

export const POST = apiHandler(
  { auth: true, schema: transformRequestSchema, rateLimit: { max: 120, windowMs: 60000 } },
  async (req, ctx) => {
    const { latitude, longitude, easting, northing, zone, hemisphere, fromSystem, toSystem } =
      ctx.body as z.infer<typeof transformRequestSchema>

    const result = await transformCoordinates(
      { latitude, longitude, easting, northing, zone, hemisphere },
      fromSystem,
      toSystem
    )

    return NextResponse.json(result)
  }
)

export const GET = apiHandler({ auth: true }, async () => {
  return NextResponse.json({ systems: getSupportedSystems() })
})