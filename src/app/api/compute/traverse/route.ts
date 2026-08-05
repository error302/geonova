export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { z } from 'zod'

const traverseSchema = z.object({
  task: z.enum(['forward', 'adjust']),
  method: z.enum(['bowditch', 'transit']).default('bowditch'),
  surveyType: z.string().default('cadastral'),
  startPoint: z.object({
    name: z.string(),
    easting: z.number(),
    northing: z.number(),
  }),
  legs: z.array(z.object({
    station: z.string(),
    bearing: z.number().min(0).max(360),
    distance: z.number().positive(),
  })),
  closingPoint: z.object({
    easting: z.number(),
    northing: z.number(),
  }).optional(),
})

export const POST = apiHandler(
  { auth: true, schema: traverseSchema, rateLimit: { max: 50, windowMs: 60000 } },
  async (req, ctx) => {
    const { task, method, surveyType, startPoint, legs, closingPoint } = ctx.body as z.infer<typeof traverseSchema>

    // Validate: cadastral and control traverses require closing control point per Survey Regulations Reg 60 & 67
    const requiresClosingControl = ['cadastral', 'control', 'boundary', 'engineering', 'mining'].includes(surveyType)
    if (task === 'adjust' && requiresClosingControl && !closingPoint) {
      return NextResponse.json(
        { error: 'Closing control point is required for cadastral/control/boundary/engineering/mining traverses per Survey Regulations Reg. 60(2)(c) and Reg. 67. Swinging/hanging traverses are prohibited.' },
        { status: 400 }
      )
    }

    // Validate: closing control must be a DIFFERENT point from start for cadastral surveys
    // Source: Basak Ch.10-11 — A closed traverse "begins and ends at points whose positions on plan are known."
    // With only 1 known point, the traverse has no absolute position check.
    if (task === 'adjust' && requiresClosingControl && closingPoint) {
      const coordDiff = Math.abs(closingPoint.easting - startPoint.easting) + Math.abs(closingPoint.northing - startPoint.northing)
      if (coordDiff < 0.001) {
        return NextResponse.json(
          { error: 'Closing control point must be DIFFERENT from starting control point. A cadastral traverse requires minimum 2 distinct known control points for position verification per Survey Regulations Reg. 60(2)(c) and Reg. 67. A 1-point traverse has no absolute position check.' },
          { status: 400 }
        )
      }
    }

    const { forwardTraverse, bowditchAdjustment, transitAdjustment, evaluateTraverseClosure, TRAVERSE_PRECISION_STANDARDS } = await import('@/lib/engine/traverse')
    const { coordinateArea } = await import('@/lib/engine/area')

    const distances = legs.map((l) => l.distance)
    const bearings = legs.map((l) => l.bearing)

    if (task === 'forward') {
      const result = forwardTraverse({
        start: startPoint,
        stations: legs.map((l) => l.station),
        distances,
        bearings,
      })

      return NextResponse.json({
        task: 'traverse_forward',
        legs: result.legs,
        totalDistance: result.totalDistance,
        endPoint: result.end,
      })
    }

    const points = legs.map((l) => ({ name: l.station, easting: 0, northing: 0 }))
    const traverseInput = {
      points: [startPoint, ...points],
      distances,
      bearings,
      closingPoint,
    }

    const adjusted = method === 'transit'
      ? transitAdjustment(traverseInput)
      : bowditchAdjustment(traverseInput)

    const validSurveyTypes = Object.keys(TRAVERSE_PRECISION_STANDARDS) as string[]
    const validatedSurveyType = validSurveyTypes.includes(surveyType) ? surveyType : 'cadastral'

    const closure = evaluateTraverseClosure(
      adjusted.linearError,
      adjusted.totalDistance,
      validatedSurveyType as import('@/lib/engine/traverse').SurveyTypeKey
    )

    const coordinates = adjusted.legs.map((leg) => ({
      easting: leg.adjEasting,
      northing: leg.adjNorthing,
    }))

    const areaResult = coordinateArea(coordinates)

    const errorMm = adjusted.linearError * 1000
    const ratioStr = `1:${Math.round(closure.ratio)}`

    return NextResponse.json({
      task: 'traverse_adjust',
      method,
      surveyType: validatedSurveyType,
      legs: adjusted.legs,
      closingErrorE: adjusted.closingErrorE,
      closingErrorN: adjusted.closingErrorN,
      linearError: adjusted.linearError,
      linearErrorMm: errorMm,
      precisionRatio: closure.ratio,
      precisionRatioStr: ratioStr,
      precisionMinimum: closure.minimum,
      passesQA: closure.passes,
      precisionGrade: adjusted.precisionGrade,
      totalDistance: adjusted.totalDistance,
      isClosed: closure.passes,
      adjustedAreaM2: areaResult.areaSqm,
      adjustedAreaHa: areaResult.areaHa,
      message: closure.passes
        ? `${adjusted.precisionGrade.charAt(0).toUpperCase() + adjusted.precisionGrade.slice(1)} closure: ${ratioStr} (error ${errorMm.toFixed(1)}mm) - PASSES QA`
        : `Insufficient precision: ${ratioStr} (error ${errorMm.toFixed(1)}mm) - BELOW ${surveyType} MINIMUM 1:${closure.minimum}`,
    })
  }
)

export const GET = apiHandler({ auth: true }, async () => {
  return NextResponse.json({
    endpoint: '/api/compute/traverse',
    description: 'Run traverse computations: forward traverse and adjustment (Bowditch or Transit)',
    tasks: ['forward', 'adjust'],
    methods: ['bowditch', 'transit'],
  })
})