export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { generateAllSections } from '@/lib/compute/surveyReportSections'
import { computeReportCompleteness } from '@/lib/compute/reportCompleteness'
import { buildSubmissionNumber, normaliseRegistrationNo, validateSubmissionNumber } from '@/lib/submission/format'
import type { SurveyReportInput, ControlPoint, LevellingRun } from '@/types/surveyReport'

interface ProjectRow {
  name: string | null
  client_name: string | null
  client_address: string | null
  surveyor_name: string | null
  surveyor_registration_number: string | null
  submission_number: string | null
  location: string | null
  start_date: string | null
  end_date: string | null
  utm_zone: number | null
  hemisphere: string | null
}

interface SurveyPointRow {
  id: string
  name: string | null
  control_order: string | null
  easting: string | number
  northing: string | number
  elevation: string | number | null
  source: string | null
  description: string | null
  mark_type: string | null
}

interface LevellingRunRow {
  run_id: string | null
  id: string
  from_bm: string | null
  to_bm: string | null
  distance: string | number | null
  misclosure: string | number | null
  allowable: string | number | null
  passes: boolean | null
}

interface TraverseRow {
  precision_ratio: string | number | null
}

export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { projectId, input } = ctx.body as { projectId?: string; input?: Partial<SurveyReportInput> }

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
  }

  const { rows: projectRows } = await db.query<ProjectRow>(
    'SELECT * FROM projects WHERE id = $1 LIMIT 1',
    [projectId]
  )

  if (projectRows.length === 0) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  const project = projectRows[0]

  const { rows: points } = await db.query<SurveyPointRow>(
    'SELECT * FROM survey_points WHERE project_id = $1 AND is_control = true',
    [projectId]
  )

  const controlPoints: ControlPoint[] = (points || []).map((p) => ({
    id: p.name || p.id,
    order: (p.control_order as 'PRIMARY' | 'SECONDARY' | 'TERTIARY') || 'TERTIARY',
    easting: Number(p.easting),
    northing: Number(p.northing),
    elevation: Number(p.elevation || 0),
    source: (p.source as 'GNSS' | 'TOTAL_STATION' | 'EXISTING') || 'GNSS',
    description: p.description || '',
    markType: p.mark_type || 'Concrete Beacon'
  }))

  const benchmarks = controlPoints.filter((cp) =>
    cp.markType.toLowerCase().includes('bm') ||
    cp.markType.toLowerCase().includes('benchmark')
  )

  let levellingRuns: LevellingRun[] = []
  try {
    const { rows: levelingRunsData } = await db.query<LevellingRunRow>(
      'SELECT * FROM leveling_runs WHERE project_id = $1',
      [projectId]
    )

    levellingRuns = (levelingRunsData || []).map((run) => ({
      runId: run.run_id || run.id,
      fromBM: run.from_bm || 'BM1',
      toBM: run.to_bm || 'BM2',
      distance: Number(run.distance || 0),
      misclosure: Number(run.misclosure || 0),
      allowable: Number(run.allowable || 10),
      passes: run.passes ?? true
    }))
  } catch {
    // Ignore missing table error
  }

  let traversePrecision: number | undefined
  try {
    const { rows: traverseData } = await db.query<TraverseRow>(
      'SELECT precision_ratio FROM traverse_results WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
      [projectId]
    )

    if (traverseData.length > 0 && traverseData[0].precision_ratio) {
      traversePrecision = Number(traverseData[0].precision_ratio)
    }
  } catch {
    // No traverse data yet
  }

  const registrationNo = normaliseRegistrationNo(
    input?.surveyorRegistrationNumber || project.surveyor_registration_number || ''
  )
  const fallbackSubmissionNo = registrationNo
    ? buildSubmissionNumber({ registrationNo, year: new Date().getFullYear(), sequence: 1, revision: 0 })
    : ''
  const inputSubmissionNumber = input?.submissionNumber || ''
  const submissionNumber = validateSubmissionNumber(inputSubmissionNumber)
    ? inputSubmissionNumber
    : (project.submission_number || fallbackSubmissionNo)

  const defaultInput: SurveyReportInput = {
    projectId,
    reportTitle: input?.reportTitle || `${project.name} — Survey Report`,
    reportNumber: input?.reportNumber || `SR-${Date.now().toString(36).toUpperCase()}`,
    revisionNumber: input?.revisionNumber || 'Rev 0',
    clientName: input?.clientName || project.client_name || '',
    clientAddress: input?.clientAddress || project.client_address || '',
    firmName: input?.firmName || '',
    firmAddress: input?.firmAddress || '',
    firmIskNumber: input?.firmIskNumber || '',
    surveyorName: input?.surveyorName || project.surveyor_name || '',
    surveyorRegistrationNumber: registrationNo,
    surveyorIskNumber: input?.surveyorIskNumber || '',
    reportDate: input?.reportDate || new Date().toISOString().split('T')[0],
    submissionNumber,
    projectLocation: input?.projectLocation || project.location || '',
    county: input?.county || '',
    projectPurpose: input?.projectPurpose || '',
    siteDescription: input?.siteDescription || '',
    surveyPeriodStart: input?.surveyPeriodStart || project.start_date || '',
    surveyPeriodEnd: input?.surveyPeriodEnd || project.end_date || '',
    scopeItems: input?.scopeItems || [],
    equipment: input?.equipment || [],
    personnel: input?.personnel || [],
    datum: input?.datum || 'ARC1960',
    projection: input?.projection || `UTM Zone ${project.utm_zone || 37}${project.hemisphere || 'S'}`,
    controlPoints: input?.controlPoints || controlPoints,
    surveyMethod: input?.surveyMethod || 'GNSS_RTK',
    instrumentUsed: input?.instrumentUsed || '',
    traverseAccuracy: input?.traverseAccuracy || (traversePrecision ? `1:${Math.round(traversePrecision).toLocaleString()}` : undefined),
    levellingMisclosure: input?.levellingMisclosure || (levellingRuns.length > 0 ? `${levellingRuns[0].misclosure.toFixed(3)} mm` : undefined),
    levellingRuns: input?.levellingRuns || levellingRuns,
    conclusions: input?.conclusions || [],
    recommendations: input?.recommendations || []
  }

  const sections = generateAllSections(
    defaultInput,
    controlPoints,
    benchmarks,
    levellingRuns,
    traversePrecision
  )

  const completeness = computeReportCompleteness(defaultInput, sections)

  return NextResponse.json({
    sections,
    completeness,
    input: defaultInput
  })
})
