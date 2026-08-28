export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { db } from '@/lib/db'
import { z } from 'zod'

import { generateGeoJSON, type SurveyPoint } from '@/lib/export/generateGeoJSON'

// ─── DB Row Interfaces ───────────────────────────────────────────────────────

interface ProjectRow {
  name: string
  utm_zone: number | null
  hemisphere: string | null
}

interface PointRow {
  point_name: string
  easting: number | string | null
  northing: number | string | null
  elevation: number | string | null
  point_type: string
}

interface AdjustedStation {
  pointName?: string
  name?: string
  index?: number
  adjustedEasting?: number
  easting?: number
  adjustedNorthing?: number
  northing?: number
  elevation?: number | null
  isControl?: boolean
  is_control?: boolean
  controlOrder?: string
  control_order?: string
}

interface BoundaryDataRow {
  boundary_data: { adjustedStations?: AdjustedStation[] } | null
}

const directSchema = z.object({
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

const projectIdSchema = z.object({
  projectId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const body: unknown = await request.json().catch(() => null)

  // ── Mode A: Direct points payload ──
  const directParsed = directSchema.safeParse(body)
  if (directParsed.success) {
    const input = directParsed.data
    const geojson = generateGeoJSON(input.points as SurveyPoint[], input.projectName, input.utmZone, input.hemisphere)
    return NextResponse.json({
      kind: 'geojson',
      filename: `${input.projectName.replace(/\s+/g, '_')}.geojson`,
      geojson,
      python_required: false,
    })
  }

  // ── Mode B: projectId — fetch from DB ──
  const projectParsed = projectIdSchema.safeParse(body)
  if (projectParsed.success) {
    const { projectId } = projectParsed.data

    const { rows: project } = await db.query<ProjectRow>(
      'SELECT name, utm_zone, hemisphere FROM projects WHERE id = $1',
      [projectId]
    )
    if (!project.length) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const proj = project[0]
    const { rows: points } = await db.query<PointRow>(
      `SELECT point_name, easting, northing, elevation, point_type
       FROM survey_points WHERE project_id = $1 ORDER BY point_name`,
      [projectId]
    )

    // Also fetch adjusted stations from boundary_data
    const { rows: projFull } = await db.query<BoundaryDataRow>(
      'SELECT boundary_data FROM projects WHERE id = $1',
      [projectId]
    )
    const adjustedStations = projFull[0]?.boundary_data?.adjustedStations || []

    // Prefer adjusted stations, fall back to raw survey_points
    const surveyPoints: SurveyPoint[] = adjustedStations.length > 0
      ? adjustedStations.map((s: AdjustedStation) => ({
          name: s.pointName || s.name || `S${s.index || 0}`,
          easting: s.adjustedEasting || s.easting || 0,
          northing: s.adjustedNorthing || s.northing || 0,
          elevation: s.elevation || null,
          is_control: s.isControl || s.is_control || false,
          control_order: s.controlOrder || s.control_order || '',
        }))
      : points.map((p: any) => ({
          name: p.point_name,
          easting: Number(p.easting),
          northing: Number(p.northing),
          elevation: p.elevation != null ? Number(p.elevation) : null,
          is_control: p.point_type === 'control',
          control_order: '',
        }))

    if (surveyPoints.length === 0) {
      return NextResponse.json({ error: 'No points found for this project' }, { status: 404 })
    }

    const geojson = generateGeoJSON(
      surveyPoints,
      proj.name,
      proj.utm_zone ?? undefined,
      proj.hemisphere as 'N' | 'S' | undefined,
    )

    return NextResponse.json({
      kind: 'geojson',
      filename: `${(proj.name || 'survey').replace(/\s+/g, '_')}.geojson`,
      geojson,
      python_required: false,
    })
  }

  return NextResponse.json({ error: 'Invalid request. Provide { projectId } or { projectName, points[] }' }, { status: 400 })
}

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  return NextResponse.json({
    endpoint: '/api/compute/export/geojson',
    description: 'GeoJSON export. Accepts { projectId } or { projectName, points[] }.',
    python_required: false,
  })
}
