export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { buildAlignment, organizeShotsByChainage, type PIPoint, type FieldShot } from '@/lib/survey/corridorEngine'
import { z } from 'zod'

const schema = z.object({
  piPoints: z.array(z.object({
    id: z.string(), e: z.number(), n: z.number(), chainage: z.number().optional(),
  })).min(2),
  shots: z.array(z.object({
    e: z.number(), n: z.number(), rl: z.number(),
    name: z.string().optional(), code: z.string().optional(),
  })),
  interval: z.number().default(20),
  startChainage: z.number().default(0),
})

export const POST = apiHandler(
  { auth: true, schema, rateLimit: { max: 20, windowMs: 60000 } },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof schema>
    const alignment = buildAlignment(body.piPoints as PIPoint[], body.startChainage)
    const groups = organizeShotsByChainage(body.shots as FieldShot[], alignment, body.interval)
    return NextResponse.json({ data: { alignment, crossSections: groups } })
  },
)
