export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { z } from 'zod'
import type { LevelingInput } from '@/lib/engine/leveling'

const levelingSchema = z.object({
  surveyType: z.enum(['engineering', 'mining', 'monitoring']),
  method: z.enum(['rise_and_fall', 'height_of_collimation']),
  openingRL: z.number(),
  closingRL: z.number().optional(),
  readings: z.array(z.object({
    station: z.string(),
    bs: z.number().optional(),
    is: z.number().optional(),
    fs: z.number().optional(),
  })),
})

export const POST = apiHandler(
  { auth: true, schema: levelingSchema, rateLimit: { max: 50, windowMs: 60000 } },
  async (req, ctx) => {
    const { method, openingRL, closingRL, readings } = ctx.body as z.infer<typeof levelingSchema>

    const { riseAndFall, heightOfCollimation } = await import('@/lib/engine/leveling')

    const totalStations = readings.filter((r) => r.bs !== undefined).length
    const distanceKm = totalStations / 1000

    const input: LevelingInput = {
      readings,
      openingRL,
      closingRL,
      method,
      distanceKm: Math.max(distanceKm, 0.001),
    }

    const result = method === 'height_of_collimation'
      ? heightOfCollimation(input)
      : riseAndFall(input)

    const misclosureMm = Math.abs(result.misclosure) * 1000
    const allowableMm = result.allowableMisclosure * 1000

    return NextResponse.json({
      task: 'leveling',
      method: result.method,
      readings: result.readings,
      misclosure: result.misclosure,
      misclosureMm,
      allowableMm,
      arithmeticCheck: result.arithmeticCheck,
      isAcceptable: result.isAcceptable,
      closureStatus: result.isAcceptable ? 'acceptable' : 'excessive',
      message: result.isAcceptable
        ? `Closure within tolerance (${misclosureMm.toFixed(1)}mm / ${allowableMm.toFixed(1)}mm)`
        : `Closure exceeds tolerance (${misclosureMm.toFixed(1)}mm / ${allowableMm.toFixed(1)}mm)`,
    })
  }
)

export const GET = apiHandler({ auth: true }, async () => {
  return NextResponse.json({
    endpoint: '/api/compute/leveling',
    description: 'Run leveling computations with 10√K mm closure check (RDM 1.1)',
    methods: ['rise_and_fall', 'height_of_collimation'],
    surveyTypes: ['engineering', 'mining', 'monitoring'],
  })
})