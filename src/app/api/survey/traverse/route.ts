export const dynamic = 'force-dynamic'

/**
 * Traverse Computation API Route
 *
 * Accepts raw observations, runs them through the correction pipeline,
 * performs traverse adjustment, and returns adjusted coordinates.
 *
 * SECURITY: Requires authentication. Previously unauthenticated —
 * pure math so no data leak, but unauthenticated CPU-heavy work
 * was a DoS vector.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import {
  processObservation,
  KENYA_DEFAULT_CONFIG,
  type PipelineConfig,
  type RawObservation,
} from '@/lib/survey/pipeline/correction-pipeline';
import {
  bowditchAdjustment,
  type TraverseStation,
  type TraverseLeg,
} from '@/lib/survey/traverse/engine';
import {
  leastSquaresAdjustment,
  type LSObservation,
  type LSStation,
} from '@/lib/survey/traverse/least-squares';
import { TraverseComputeSchema } from '@/lib/validation/apiSchemas';
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  // SECURITY: Require authentication to prevent DoS via unauthenticated compute
  const { error } = await requireAuth()
  if (error) return error

  try {
    const rawBody = await request.json().catch(() => null)
    const parsed = TraverseComputeSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 422 }
      )
    }

    const { observations, stations, method, order, config } = parsed.data

    // Step 1: Process all observations through the correction pipeline
    const pipelineConfig = { ...KENYA_DEFAULT_CONFIG, ...config } as PipelineConfig
    const processedObservations = observations.map(obs =>
      processObservation(obs as RawObservation, pipelineConfig)
    )

    // Step 2: Build traverse legs from processed observations
    const legs: TraverseLeg[] = processedObservations.map(obs => ({
      fromStation: obs.fromStation,
      toStation: obs.toStation,
      bearing: obs.gridBearing ?? obs.trueBearing ?? 0,
      distance: obs.gridDistance,
      stdDevDistance: 0.005 + obs.gridDistance * 0.00002, // 5mm + 20ppm
      stdDevBearing: 5, // 5 arc-seconds
    }))

    // Step 3: Perform traverse adjustment
    let result;

    if (method === 'bowditch') {
      result = bowditchAdjustment(stations as TraverseStation[], legs, order)
    } else {
      // Build least squares inputs from processed observations
      const lsStations: LSStation[] = stations.map(s => ({
        name: s.name,
        easting: s.easting ?? 0,
        northing: s.northing ?? 0,
        isFixed: s.isFixed ?? false,
      }))

      const lsObservations: LSObservation[] = processedObservations.map(obs => ({
        type: 'distance' as const,
        fromStation: obs.fromStation,
        toStation: obs.toStation,
        value: obs.gridDistance,
        stdDev: 0.005 + obs.gridDistance * 0.00002, // 5mm + 20ppm
      }))

      result = leastSquaresAdjustment(lsStations, lsObservations)
    }

    return NextResponse.json({
      processedObservations,
      adjustmentResult: result,
      pipelineConfig,
      correctionsApplied: processedObservations.map(obs => ({
        from: obs.fromStation,
        to: obs.toStation,
        rawDistance: obs.rawSlopeDistance,
        gridDistance: obs.gridDistance,
        atmosphericPPM: obs.atmosphericPPM,
        seaLevelPPM: obs.seaLevelPPM,
        lineScaleFactor: obs.lineScaleFactor,
        convergence: obs.convergence,
        warnings: obs.warnings,
      })),
    })
  } catch (error) {
    logger.error('Traverse computation error:', { error: error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Computation failed' },
      { status: 500 }
    );
  }
}
