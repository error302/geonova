export const dynamic = 'force-dynamic'

/**
 * Corrections API Route
 *
 * Apply corrections to a single observation or batch of observations.
 * Returns corrected values with full audit trail.
 *
 * SECURITY: Requires authentication. Previously unauthenticated —
 * pure math so no data leak, but unauthenticated CPU-heavy work
 * was a DoS vector.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import {
  processObservation,
  processObservations,
  generateCorrectionReport,
  KENYA_DEFAULT_CONFIG,
  type PipelineConfig,
  type RawObservation,
} from '@/lib/survey/pipeline/correction-pipeline';
import { CorrectionsSchema } from '@/lib/validation/apiSchemas';
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  // SECURITY: Require authentication to prevent DoS via unauthenticated compute
  const { error } = await requireAuth()
  if (error) return error

  try {
    const rawBody: unknown = await request.json().catch(() => null)
    const parsed = CorrectionsSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 422 }
      )
    }

    const { observation, observations, config, report } = parsed.data

    const pipelineConfig = { ...KENYA_DEFAULT_CONFIG, ...config } as PipelineConfig

    if (observation) {
      // Single observation
      const result = processObservation(observation as RawObservation, pipelineConfig)
      return NextResponse.json({ result })
    }

    if (observations && observations.length > 0) {
      // Batch observations
      const results = processObservations(observations as RawObservation[], pipelineConfig)

      if (report) {
        const correctionReport = generateCorrectionReport(results)
        return NextResponse.json({ results, report: correctionReport })
      }

      return NextResponse.json({ results })
    }

    return NextResponse.json(
      { error: 'Provide observation or observations' },
      { status: 400 }
    )
  } catch (error) {
    logger.error('Corrections API error:', { error: error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Correction failed' },
      { status: 500 }
    );
  }
}
