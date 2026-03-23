import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { callPythonCompute } from '@/lib/compute/pythonService'
import { generateDXF } from '@/lib/export/generateDXF'
import { generateGeoJSON } from '@/lib/export/generateGeoJSON'
import { cutFillVolumeFromSignedSections, surfaceCutFillVolumeGrid, volumeFromSections } from '@/lib/engine/volume'
import { apiSuccess, apiError } from '@/lib/api/response'

const taskSchema = z.object({
  task: z.enum(['volume', 'tin', 'contours', 'raster_analysis', 'seabed', 'export_dxf', 'export_geojson']),
  payload: z.unknown(),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = taskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(apiError('Invalid request.', { issues: parsed.error.issues }), { status: 400 })
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
        return NextResponse.json(apiSuccess({ task, kind: 'cross_section', method, cutVolume: r.cutVolume, fillVolume: r.fillVolume, netVolume: r.netVolume, segments: r.segments }))
      }
      const r = volumeFromSections(sections, method === 'end_area' ? 'end_area' : 'prismoidal')
      return NextResponse.json(apiSuccess({ task, kind: 'cross_section', method: r.method, totalVolume: r.totalVolume, segments: r.segments }))
    }

    const surface = z
      .object({
        kind: z.literal('surface'),
        method: z.literal('grid_idw').default('grid_idw'),
        gridSpacing: z.number().positive(),
        power: z.number().positive().optional(),
        maxDistance: z.number().positive().optional(),
        existing: z.array(z.object({ easting: z.number(), northing: z.number(), elevation: z.number() })).min(3),
        design: z.array(z.object({ easting: z.number(), northing: z.number(), elevation: z.number() })).min(3),
      })
      .safeParse(payload)

    if (!surface.success) {
      return NextResponse.json(
        apiError('Invalid volume payload. Supported: cross_section (end_area/prismoidal/cut_fill) or surface (grid_idw).', { python_required: false }),
        { status: 400 }
      )
    }

    const r = surfaceCutFillVolumeGrid({
      existing: surface.data.existing,
      design: surface.data.design,
      gridSpacing: surface.data.gridSpacing,
      power: surface.data.power,
      maxDistance: surface.data.maxDistance,
    })
    return NextResponse.json(apiSuccess({
      task,
      kind: 'surface',
      method: r.method,
      cutVolume: r.cutVolume,
      fillVolume: r.fillVolume,
      netVolume: r.netVolume,
      cellCount: r.cellCount,
      bbox: r.bbox,
      warnings: r.warnings,
    }))
  }

  if (task === 'export_dxf') {
    const schema = z.object({
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

    const parsedExport = schema.safeParse(payload)
    if (!parsedExport.success) {
      return NextResponse.json(apiError('Invalid export_dxf payload.', { issues: parsedExport.error.issues }), { status: 400 })
    }

    const input = parsedExport.data
    const dxf = generateDXF({
      projectName: input.projectName,
      points: input.points,
      traverseLegs: input.traverseLegs ?? [],
      includeElevations: input.includeElevations,
    })

    return NextResponse.json(apiSuccess({
      task,
      kind: 'dxf',
      filename: `${input.projectName.replace(/\s+/g, '_')}.dxf`,
      dxf,
      python_required: false,
    }))
  }

  if (task === 'export_geojson') {
    const schema = z.object({
      projectName: z.string().min(1),
      utmZone: z.number().int().min(1).max(60).optional(),
      hemisphere: z.enum(['N', 'S']).optional(),
      points: z.array(
        z.object({
          id: z.string().optional(),
          name: z.string().min(1),
          easting: z.number(),
          northing: z.number(),
          elevation: z.number().nullable().optional(),
          is_control: z.boolean().optional(),
          control_order: z.string().optional(),
        })
      ),
    })

    const parsedExport = schema.safeParse(payload)
    if (!parsedExport.success) {
      return NextResponse.json(
        apiError('Invalid export_geojson payload.', { issues: parsedExport.error.issues }),
        { status: 400 }
      )
    }

    const input = parsedExport.data
    const geojson = generateGeoJSON(input.points, input.projectName, input.utmZone, input.hemisphere)
    return NextResponse.json(apiSuccess({
      task,
      kind: 'geojson',
      filename: `${input.projectName.replace(/\s+/g, '_')}.geojson`,
      geojson,
      python_required: false,
    }))
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
  if (!python.ok) return NextResponse.json(apiError(python.error, { fallback: python.fallback ?? true, details: python.details, python_required: true }), { status: python.status })
  
  // Return the python value directly since the python microservice should now be enveloped securely as well
  return NextResponse.json(python.value)
}

export async function GET() {
  return NextResponse.json(apiSuccess({
    endpoint: '/api/compute',
    description: 'Compute Gateway: routes heavy tasks to Python, keeps deterministic survey math in TS.',
    tasks: ['volume', 'tin', 'contours', 'raster_analysis', 'seabed', 'export_dxf', 'export_geojson'],
  }))
}
