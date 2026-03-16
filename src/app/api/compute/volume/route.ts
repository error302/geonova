import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { cutFillVolumeFromSignedSections, volumeFromSections } from '@/lib/engine/volume'
import { callPythonCompute } from '@/lib/compute/pythonService'

const crossSectionSchema = z.object({
  kind: z.literal('cross_section'),
  method: z.enum(['end_area', 'prismoidal', 'cut_fill']),
  sections: z
    .array(
      z.object({
        chainage: z.number(),
        area: z.number(),
      })
    )
    .min(2),
})

const surfaceSchema = z.object({
  kind: z.literal('surface'),
  // payload is forwarded to python (TIN/GRID comparisons, etc.)
  payload: z.record(z.any()),
})

const requestSchema = z.union([crossSectionSchema, surfaceSchema])

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.', issues: parsed.error.issues }, { status: 400 })
  }

  const input = parsed.data

  if (input.kind === 'cross_section') {
    const sections = input.sections
    if (input.method === 'cut_fill') {
      const r = cutFillVolumeFromSignedSections(sections)
      return NextResponse.json({
        kind: 'cross_section',
        method: 'cut_fill',
        cutVolume: r.cutVolume,
        fillVolume: r.fillVolume,
        netVolume: r.netVolume,
        segments: r.segments,
      })
    }

    const r = volumeFromSections(sections, input.method === 'end_area' ? 'end_area' : 'prismoidal')
    return NextResponse.json({
      kind: 'cross_section',
      method: r.method,
      totalVolume: r.totalVolume,
      segments: r.segments,
    })
  }

  const python = await callPythonCompute<any>('/surface/volume', input.payload, { timeoutMs: 15000 })
  if (!python.ok) {
    return NextResponse.json(
      { error: python.error, fallback: python.fallback ?? true, details: python.details, python_required: true },
      { status: python.status }
    )
  }
  return NextResponse.json(python.value)
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/compute/volume',
    description: 'Volume computation: TS cross-sections, optional Python surface cut/fill.',
    python_optional: true,
  })
}

