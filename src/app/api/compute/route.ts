import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { callPythonCompute } from '@/lib/compute/pythonService'
import { cutFillVolumeFromSignedSections, volumeFromSections } from '@/lib/engine/volume'

const taskSchema = z.object({
  task: z.enum(['volume', 'tin', 'contours', 'raster_analysis', 'seabed', 'export_dxf', 'export_geojson']),
  payload: z.unknown(),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = taskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.', issues: parsed.error.issues }, { status: 400 })
  }

  const { task, payload } = parsed.data

  if (task === 'volume') {
    const cross = z
      .object({
        kind: z.literal('cross_section'),
        method: z.enum(['end_area', 'prismoidal', 'cut_fill']),
        sections: z.array(z.object({ chainage: z.number(), area: z.number() })).min(2),
      })
      .safeParse(payload)

    if (cross.success) {
      const { method, sections } = cross.data
      if (method === 'cut_fill') {
        const r = cutFillVolumeFromSignedSections(sections)
        return NextResponse.json({ task, kind: 'cross_section', method, cutVolume: r.cutVolume, fillVolume: r.fillVolume, netVolume: r.netVolume, segments: r.segments })
      }
      const r = volumeFromSections(sections, method === 'end_area' ? 'end_area' : 'prismoidal')
      return NextResponse.json({ task, kind: 'cross_section', method: r.method, totalVolume: r.totalVolume, segments: r.segments })
    }

    const python = await callPythonCompute<any>('/surface/volume', payload, { timeoutMs: 15000 })
    if (!python.ok) return NextResponse.json({ error: python.error, fallback: python.fallback ?? true, details: python.details, python_required: true }, { status: python.status })
    return NextResponse.json(python.value)
  }

  const mapping: Record<string, string> = {
    tin: '/surface/tin',
    contours: '/terrain/contours',
    raster_analysis: '/raster/analyze',
    seabed: '/hydro/seabed',
    export_dxf: '/export/dxf',
    export_geojson: '/export/geojson',
  }

  const python = await callPythonCompute<any>(mapping[task], payload, { timeoutMs: 30000 })
  if (!python.ok) return NextResponse.json({ error: python.error, fallback: python.fallback ?? true, details: python.details, python_required: true }, { status: python.status })
  return NextResponse.json(python.value)
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/compute',
    description: 'Compute Gateway: routes heavy tasks to Python, keeps deterministic survey math in TS.',
    tasks: ['volume', 'tin', 'contours', 'raster_analysis', 'seabed', 'export_dxf', 'export_geojson'],
  })
}

