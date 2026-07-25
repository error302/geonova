export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { generateTopoDXF, type TopoPoint } from '@/lib/export/topoDXF'
import { z } from 'zod'

const schema = z.object({
  points: z.array(z.object({
    easting: z.number(), northing: z.number(),
    elevation: z.number().optional(),
    code: z.string().optional(),
    pointNumber: z.string().optional(),
  })),
  projectName: z.string().default('Topographic Survey'),
  drawElevations: z.boolean().default(true),
  drawPointNumbers: z.boolean().default(true),
})

export const POST = apiHandler(
  { auth: true, schema, rateLimit: { max: 10, windowMs: 60000 } },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof schema>
    const dxf = generateTopoDXF(body.points as TopoPoint[], {
      projectName: body.projectName,
      drawElevations: body.drawElevations,
      drawPointNumbers: body.drawPointNumbers,
    })
    return NextResponse.json({
      content: dxf,
      filename: `${body.projectName.replace(/[^a-zA-Z0-9]/g, '_')}_topo.dxf`,
      mimeType: 'application/dxf',
      pointCount: body.points.length,
    })
  },
)
