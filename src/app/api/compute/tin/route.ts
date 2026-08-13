export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { z } from 'zod'
import { generateTIN, interpolateElevation, type TINPoint } from '@/lib/compute/tin'

const TINPointSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
})

const TINRequestSchema = z.object({
  project_id: z.string().uuid().optional(),
  points: z.array(TINPointSchema).min(3).max(50000),
  query_points: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
})

export const POST = apiHandler(
  { auth: true, schema: TINRequestSchema, audit: 'compute_tin' , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const data = ctx.body as z.infer<typeof TINRequestSchema>

    const triangles = generateTIN(data.points as TINPoint[])

    let interpolations: Array<{ x: number; y: number; elevation: number | null }> = []
    if (data.query_points) {
      interpolations = data.query_points.map((qp): { x: number; y: number; elevation: number | null } => ({
        x: qp.x,
        y: qp.y,
        elevation: interpolateElevation(triangles, qp.x, qp.y),
      }))
    }

    return NextResponse.json(apiSuccess({
      triangle_count: triangles.length,
      point_count: data.points.length,
      triangles: triangles.slice(0, 1000), // Cap response size — client can paginate
      interpolations,
      python_required: false,
    }))
  }
)

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 60, windowMs: 60000 } },
  async () => {
    return NextResponse.json(apiSuccess({
      endpoint: '/api/compute/tin',
      description: 'Triangulated Irregular Network generation (native TypeScript via Delaunator).',
      python_required: false,
    }))
  }
)
