/**
 * API: POST /api/survey/robust-adjustment
 *
 * Run a robust LSA (Huber/IGG3/Tukey IRLS) adjustment.
 *
 * Body:
 *   {
 *     "stations": [{ id, name, easting, northing, elevation, isFixed }],
 *     "observations": [{ type, from, to, deltaE, deltaN, deltaH, ... }],
 *     "options": { "weightFunction": "huber", ... }
 *   }
 *
 * Response:
 *   {
 *     "adjustedStations": [...],
 *     "sigmaZero": 0.005,
 *     "iterations": 8,
 *     "converged": true,
 *     "finalWeights": [1, 0.005, 1, ...],
 *     "blunders": [{ "index": 1, "type": "coordinate_diff", ... }],
 *     "blunderCount": 1,
 *     "method": "huber",
 *     "summary": "Robust LSA (HUBER) converged in 8 iterations. σ₀=0.0050, dof=2. 1 blunder(s) detected and down-weighted."
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adjustNetworkRobust, type WeightFunction } from '@/lib/survey/robustEstimation'
import type { NetworkStation, GenericObservation } from '@/lib/survey/lsaIterative'

const StationSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  easting: z.number(),
  northing: z.number(),
  elevation: z.number(),
  isFixed: z.boolean(),
})

const ObservationSchema = z.object({
  type: z.enum(['coordinate_diff', 'slope_distance', 'horizontal_direction', 'zenith_angle', 'height_difference']),
  from: z.string().optional(),
  to: z.string().optional(),
  deltaE: z.number().optional(),
  deltaN: z.number().optional(),
  deltaH: z.number().optional(),
  distance: z.number().optional(),
  direction: z.number().optional(),
  zenith: z.number().optional(),
  stdDevE: z.number().positive().optional(),
  stdDevN: z.number().positive().optional(),
  stdDevH: z.number().positive().optional(),
  stdDevDistance: z.number().positive().optional(),
  stdDevDirection: z.number().positive().optional(),
  stdDevZenith: z.number().positive().optional(),
})

const RequestSchema = z.object({
  stations: z.array(StationSchema).min(2),
  observations: z.array(ObservationSchema).min(1),
  options: z.object({
    weightFunction: z.enum(['huber', 'igg3', 'tukey']).optional(),
    huberC: z.number().positive().optional(),
    igg3K0: z.number().positive().optional(),
    igg3K1: z.number().positive().optional(),
    tukeyC: z.number().positive().optional(),
    maxIterations: z.number().positive().optional(),
    convergenceThreshold: z.number().positive().optional(),
    alpha: z.number().positive().optional(),
  }).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const { stations, observations, options } = parsed.data

    const result = adjustNetworkRobust(
      stations as NetworkStation[],
      observations as GenericObservation[],
      options ? {
        weightFunction: options.weightFunction as WeightFunction,
        huberC: options.huberC,
        igg3K0: options.igg3K0,
        igg3K1: options.igg3K1,
        tukeyC: options.tukeyC,
        maxIterations: options.maxIterations,
        convergenceThreshold: options.convergenceThreshold,
        alpha: options.alpha,
      } : undefined,
    )

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to run robust adjustment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/survey/robust-adjustment',
    method: 'POST',
    description: 'Robust LSA (Huber/IGG3/Tukey IRLS) for blunder-resistant adjustment',
    weightFunctions: ['huber', 'igg3', 'tukey'],
  })
}
