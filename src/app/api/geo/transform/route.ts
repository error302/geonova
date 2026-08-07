export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { transformCoordinates, TransformInput } from '@/lib/geo/transform'
import { GeoTransformSchema } from '@/lib/validation/apiSchemas'

export const POST = apiHandler({ auth: true, schema: GeoTransformSchema, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const body = ctx.body as z.infer<typeof GeoTransformSchema>

  const transformInput: TransformInput & { projectId?: string } = {
    fromCRS: body.fromCRS,
    toCRS: body.toCRS,
    points: body.points.map(p => ({ id: p.id, x: p.x, y: p.y, z: p.z })),
    projectId: (body as any).projectId,
  }

  const result = transformCoordinates(transformInput)

  await db.query<never>(
    `INSERT INTO online_service_logs (
      user_id, project_id, service, input_summary, status
    ) VALUES ($1, $2, $3, $4, $5)`,
    [
      ctx.userId,
      (body as any).projectId ?? null,
      'coordinate-transform',
      `${body.points.length} points, ${body.fromCRS} → ${body.toCRS}`,
      'success',
    ]
  )

  return NextResponse.json(result)
})
