export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { extractDesignPointsFromDXF } from '@/lib/survey/dxfDesignExtractor'
import { computeSettingOut, type InstrumentStation, type Backsight, type DesignPoint } from '@/lib/computations/settingOutEngine'
import { z } from 'zod'

const schema = z.object({
  dxfContent: z.string().min(1),
  stationE: z.number(),
  stationN: z.number(),
  stationRL: z.number().default(0),
  stationIH: z.number().default(1.5),
  backsightE: z.number(),
  backsightN: z.number(),
  layerFilter: z.array(z.string()).optional(),
})

export const POST = apiHandler(
  { auth: true, schema, rateLimit: { max: 20, windowMs: 60000 } },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof schema>

    const extraction = extractDesignPointsFromDXF(body.dxfContent, {
      layerFilter: body.layerFilter,
    })

    if (extraction.points.length === 0) {
      return NextResponse.json(
        { error: 'No design points found in DXF', warnings: extraction.warnings },
        { status: 400 },
      )
    }

    const station: InstrumentStation = {
      e: body.stationE, n: body.stationN, rl: body.stationRL, ih: body.stationIH,
    }
    const backsight: Backsight = { e: body.backsightE, n: body.backsightN }

    const result = computeSettingOut(station, backsight, extraction.points)

    return NextResponse.json({
      data: result,
      warnings: extraction.warnings,
      layersFound: extraction.layersFound,
    })
  },
)
