export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { z } from 'zod'

import { generateDXF } from '@/lib/export/generateDXF'

const requestSchema = z.object({
  projectName: z.string().min(1),
  includeElevations: z.boolean().optional(),
  points: z.array(
    z.object({
      name: z.string().min(1),
      easting: z.number(),
      northing: z.number(),
      elevation: z.number().optional(),
      is_control: z.boolean().optional(),
    })
  ),
  traverseLegs: z
    .array(
      z.object({
        from: z.string().min(1),
        to: z.string().min(1),
        distance: z.number().optional().default(0),
        bearing: z.number().optional().default(0),
      })
    )
    .optional(),
})

export async function POST(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const body: unknown = await request.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.', issues: parsed.error.issues }, { status: 400 })
  }

  const input = parsed.data
  const dxf = generateDXF({
    projectName: input.projectName,
    points: input.points.map((p) => ({
      name: p.name,
      easting: p.easting,
      northing: p.northing,
      elevation: p.elevation,
      is_control: p.is_control,
    })),
    traverseLegs: input.traverseLegs?.map((l) => ({ from: l.from, to: l.to, distance: l.distance, bearing: l.bearing })) ?? [],
    includeElevations: input.includeElevations,
  })

  return NextResponse.json({
    kind: 'dxf',
    filename: `${input.projectName.replace(/\s+/g, '_')}.dxf`,
    dxf,
    python_required: false,
  })
}

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  return NextResponse.json({
    endpoint: '/api/compute/export/dxf',
    description: 'DXF export (TypeScript-only).',
    python_required: false,
  })
}
