/**
 * GET /api/quality/surveyor/[userId]?dateFrom=2026-01-01&dateTo=2026-07-01
 *
 * Compute per-surveyor quality metrics from the audit chain.
 * Returns closure rates, gate pass rates, average precision, and a
 * 0-100 quality score.
 *
 * SECURITY: Only the surveyor themselves or an admin can view metrics.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { computeSurveyorMetrics, formatSurveyorMetrics, computeQualityScore } from '@/lib/quality/scoring'

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 30, windowMs: 60000 } },
  async (req, ctx) => {
    const { userId } = ctx.params

    // Only the surveyor themselves or an admin can view metrics
    const requestingUserId = ctx.userId
    const requestingRole = (ctx.session?.user as { role?: string })?.role
    if (userId !== requestingUserId && requestingRole !== 'super_admin' && requestingRole !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: can only view your own metrics', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const url = new URL(req.url)
    const dateFrom = url.searchParams.get('dateFrom') || undefined
    const dateTo = url.searchParams.get('dateTo') || undefined

    const metrics = await computeSurveyorMetrics({
      userId,
      dateFrom,
      dateTo,
    })

    const qualityScore = computeQualityScore(metrics)

    return apiSuccess({
      metrics,
      qualityScore,
      formatted: formatSurveyorMetrics(metrics),
    })
  }
)
