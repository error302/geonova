export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { buildTIN, computeCutFill, computeStockpileVolume, type SurfacePoint } from '@/lib/survey/surfaceTIN'
import { z } from 'zod'

const schema = z.object({
  mode: z.enum(['cut_fill', 'stockpile']),
  designPoints: z.array(z.object({ x: z.number(), y: z.number(), z: z.number() })).optional(),
  groundPoints: z.array(z.object({ x: z.number(), y: z.number(), z: z.number() })).optional(),
  surfacePoints: z.array(z.object({ x: z.number(), y: z.number(), z: z.number() })).optional(),
  gridSpacing: z.number().default(5.0),
  datumRL: z.number().optional(),
})

export const POST = apiHandler(
  { auth: true, schema, rateLimit: { max: 10, windowMs: 60000 } },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof schema>

    if (body.mode === 'cut_fill') {
      if (!body.designPoints || !body.groundPoints || body.designPoints.length < 3 || body.groundPoints.length < 3) {
        return NextResponse.json({ error: 'Both designPoints (≥3) and groundPoints (≥3) required for cut_fill mode' }, { status: 400 })
      }
      const designTIN = buildTIN(body.designPoints as SurfacePoint[])
      const groundTIN = buildTIN(body.groundPoints as SurfacePoint[])
      const result = computeCutFill(designTIN, groundTIN, body.gridSpacing)
      return NextResponse.json({ data: result })
    } else {
      if (!body.surfacePoints || body.surfacePoints.length < 3 || body.datumRL === undefined) {
        return NextResponse.json({ error: 'surfacePoints (≥3) and datumRL required for stockpile mode' }, { status: 400 })
      }
      const tin = buildTIN(body.surfacePoints as SurfacePoint[])
      const result = computeStockpileVolume(tin, body.datumRL, body.gridSpacing)
      return NextResponse.json({ data: result })
    }
  },
)
