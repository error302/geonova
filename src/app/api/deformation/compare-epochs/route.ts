export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { compareEpochs, type EpochSet, type DeformationTolerance } from '@/lib/survey/deformationMonitoring'
import { z } from 'zod'

const schema = z.object({
  baseline: z.custom<EpochSet>(),
  current: z.custom<EpochSet>(),
  tolerance: z.object({
    horizontal: z.number().optional(),
    vertical: z.number().optional(),
  }).optional(),
  confidenceLevel: z.number().default(0.95),
})

export const POST = apiHandler(
  { auth: true, schema, rateLimit: { max: 20, windowMs: 60000 } },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof schema>
    const report = compareEpochs(body.baseline, body.current, body.tolerance || {}, body.confidenceLevel)
    return NextResponse.json({ data: report })
  },
)
