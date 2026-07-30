export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { generateSpotHeightSchedule, type SpotHeightPoint } from '@/lib/topo/spotHeightSchedule'
import { z } from 'zod'

const schema = z.object({
  points: z.array(z.object({
    pointNumber: z.string(),
    easting: z.number(), northing: z.number(), rl: z.number(),
    code: z.string().optional(), description: z.string().optional(),
  })),
  projectName: z.string(),
  surveyorName: z.string(),
  surveyorLicense: z.string().optional(),
  datum: z.string().default('Arc 1960'),
  utmZone: z.number().default(37),
  benchmark: z.string().optional(),
  benchmarkRL: z.number().optional(),
})

export const POST = apiHandler(
  { auth: true, schema, rateLimit: { max: 10, windowMs: 60000 } },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof schema>
    const buffer = await generateSpotHeightSchedule(body.points as SpotHeightPoint[], {
      projectName: body.projectName,
      surveyorName: body.surveyorName,
      surveyorLicense: body.surveyorLicense,
      datum: body.datum,
      utmZone: body.utmZone,
      benchmark: body.benchmark,
      benchmarkRL: body.benchmarkRL,
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${body.projectName.replace(/[^a-zA-Z0-9]/g, '_')}_spot_heights.xlsx"`,
      },
    })
  },
)
