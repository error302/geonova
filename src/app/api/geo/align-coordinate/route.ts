/**
 * API: POST /api/geo/align-coordinate
 *
 * Align a coordinate to a target ITRF frame and epoch using the rigorous
 * Rodrigues' rotation formula + 14-parameter ITRF frame transformation.
 *
 * This is the math a boundary commission would use to compare coordinates
 * observed in different decades and different reference frames.
 *
 * Request body:
 *   {
 *     "coordinate": {
 *       "latitude": -1.2921,
 *       "longitude": 36.8219,
 *       "height": 1795,
 *       "frame": "ITRF2008",
 *       "epoch": 2010.0
 *     },
 *     "targetFrame": "ITRF2014",
 *     "targetEpoch": 2026.0
 *   }
 *
 * Response:
 *   {
 *     "latitude": ...,
 *     "longitude": ...,
 *     "height": ...,
 *     "frame": "ITRF2014",
 *     "epoch": 2026.0,
 *     "displacement": { "de": ..., "dn": ..., "du": ... },
 *     "velocity": { "ve": ..., "vn": ..., "vu": ... },
 *     "provenance": "Propagated from epoch 2010.000 to 2026.000 using EXACT Rodrigues' rotation formula...",
 *     "frameTransformProvenance": "Transformed from ITRF2008 to ITRF2014..."
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { alignCoordinate } from '@/lib/geo/epochManagerRigorous'
import type { ReferenceFrame } from '@/lib/geo/epochManager'

const CoordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(360),
  height: z.number(),
  frame: z.enum(['ITRF2014', 'ITRF2008', 'ITRF2020', 'WGS84_G1762', 'WGS84_G1674', 'WGS84_G1150', 'UNKNOWN']),
  epoch: z.number().min(1900).max(2100),
})

const RequestSchema = z.object({
  coordinate: CoordinateSchema,
  targetFrame: z.enum(['ITRF2014', 'ITRF2008', 'ITRF2020', 'WGS84_G1762', 'WGS84_G1674', 'WGS84_G1150', 'UNKNOWN']),
  targetEpoch: z.number().min(1900).max(2100),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        },
        { status: 400 },
      )
    }

    const { coordinate, targetFrame, targetEpoch } = parsed.data

    const result = alignCoordinate(
      {
        ...coordinate,
        frame: coordinate.frame as ReferenceFrame,
      },
      targetFrame as ReferenceFrame,
      targetEpoch,
    )

    return NextResponse.json({
      latitude: result.latitude,
      longitude: result.longitude,
      height: result.height,
      frame: result.frame,
      epoch: result.epoch,
      displacement: result.displacement,
      velocity: result.velocity,
      dtYears: result.dtYears,
      provenance: result.provenance,
      frameTransformProvenance: result.frameTransformProvenance,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to align coordinate',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/geo/align-coordinate',
    method: 'POST',
    description: 'Align a coordinate to a target ITRF frame and epoch using the rigorous Rodrigues\' rotation formula + 14-parameter ITRF frame transformation.',
    example: {
      coordinate: {
        latitude: -1.2921,
        longitude: 36.8219,
        height: 1795,
        frame: 'ITRF2008',
        epoch: 2010.0,
      },
      targetFrame: 'ITRF2014',
      targetEpoch: 2026.0,
    },
  })
}
