export const dynamic = 'force-dynamic'

/**
 * Level Network Adjustment API
 *
 * POST /api/compute/level-network
 *
 * Accepts leveling observations and control points, runs weighted LSQ
 * adjustment, and returns adjusted RLs with residuals and misclosure check.
 */

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { z } from 'zod'
import { adjustLevelNetwork } from '@/lib/survey/digitalLevel/levelNetworkAdjustment'
import { generateBenchmarkSheet, validateBenchmarkSheet } from '@/lib/survey/digitalLevel/benchmarkSheet'
import { LevelObservation, LevelControlPoint } from '@/lib/survey/digitalLevel/digitalLevelTypes'

const LevelObservationSchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  heightDifference: z.number(),
  distance: z.number().optional(),
  order: z.enum(['first', 'second', 'third']).optional(),
})

const LevelControlPointSchema = z.object({
  id: z.string().min(1),
  rl: z.number(),
  name: z.string().optional(),
  description: z.string().optional(),
})

const LevelNetworkRequestSchema = z.object({
  observations: z.array(LevelObservationSchema).min(1),
  controlPoints: z.array(LevelControlPointSchema).min(1),
  order: z.enum(['first', 'second', 'third']).optional(),
  metadata: z.object({
    projectName: z.string().optional(),
    surveyor: z.string().optional(),
    date: z.string().optional(),
    instrument: z.string().optional(),
    staff: z.string().optional(),
    remarks: z.string().optional(),
  }).optional(),
})

export const POST = apiHandler(
  { auth: true, schema: LevelNetworkRequestSchema, audit: 'compute_level_network' , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const data = ctx.body as z.infer<typeof LevelNetworkRequestSchema>

    // Run adjustment
    const result = adjustLevelNetwork(
      data.observations as LevelObservation[],
      data.controlPoints as LevelControlPoint[],
      data.order || 'third'
    )

    // Generate benchmark sheet
    const sheet = generateBenchmarkSheet(result, data.controlPoints as LevelControlPoint[], {
      projectName: data.metadata?.projectName,
      surveyor: data.metadata?.surveyor,
      date: data.metadata?.date,
      instrument: data.metadata?.instrument,
      staff: data.metadata?.staff,
      remarks: data.metadata?.remarks,
    })

    // Validate sheet
    const validation = validateBenchmarkSheet(sheet)

    return NextResponse.json({
      adjustment: result,
      benchmarkSheet: sheet,
      validation,
    })
  }
)
