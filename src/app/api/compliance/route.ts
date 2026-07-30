export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { checkRegulatoryCompliance, type ComplianceInput } from '@/lib/survey/regulatoryCompliance'
import { z } from 'zod'

const schema = z.object({
  surveyType: z.string(),
  stationCount: z.number().int(),
  closesBetweenFixedPoints: z.boolean(),
  datumVerified: z.boolean(),
  beaconsReferenced: z.boolean(),
  reducedToMSL: z.boolean(),
  correctionsApplied: z.boolean(),
  twoRoundsObserved: z.boolean(),
  areaHa: z.number().optional(),
  coordinatesOnPlan: z.boolean(),
  precisionRatio: z.number().optional(),
})

export const POST = apiHandler(
  { auth: true, schema, rateLimit: { max: 20, windowMs: 60000 } },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof schema>

    const report = checkRegulatoryCompliance({
      surveyType: body.surveyType,
      stationCount: body.stationCount,
      closesBetweenFixedPoints: body.closesBetweenFixedPoints,
      datumVerified: body.datumVerified,
      beaconsReferenced: body.beaconsReferenced,
      reducedToMSL: body.reducedToMSL,
      correctionsApplied: body.correctionsApplied,
      twoRoundsObserved: body.twoRoundsObserved,
      areaHa: body.areaHa,
      coordinatesOnPlan: body.coordinatesOnPlan,
      toleranceResult: body.precisionRatio ? {
        status: body.precisionRatio >= 10000 ? 'pass' : 'fail',
        summary: '',
        rdmChecks: { passed: body.precisionRatio >= 10000, checks: [], overallGrade: null },
        achievedOrder: null,
        requiredOrder: '',
        precisionRatio: body.precisionRatio,
        linearMisclosureMm: 0,
        perimeterKm: 0,
        worstLeg: null,
        hasEnoughData: true,
        recommendations: [],
        timestamp: new Date().toISOString(),
      } : undefined,
    })

    return NextResponse.json({ data: report })
  },
)
