export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { compareAsBuiltToDesign, type ComparisonInput } from '@/lib/survey/asBuiltComparison'
import { z } from 'zod'

const schema = z.object({
  designPoints: z.array(z.object({
    id: z.string(), e: z.number(), n: z.number(), rl: z.number(),
    th: z.number().default(2.0), description: z.string().optional(),
  })),
  asBuiltPoints: z.array(z.object({
    id: z.string().optional(), e: z.number(), n: z.number(),
    rl: z.number().optional(), description: z.string().optional(),
  })),
  toleranceH: z.number().default(0.025),
  toleranceV: z.number().default(0.015),
  proximityMaxM: z.number().default(5.0),
})

export const POST = apiHandler(
  { auth: true, schema, rateLimit: { max: 30, windowMs: 60000 } },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof schema>
    const report = compareAsBuiltToDesign(body as ComparisonInput)
    return NextResponse.json({ data: report })
  },
)
