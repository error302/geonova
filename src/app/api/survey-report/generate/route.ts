import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { generateAllSections } from '@/lib/compute/surveyReportSections'
import { computeReportCompleteness } from '@/lib/compute/reportCompleteness'
import { riseAndFall } from '@/lib/engine/leveling'
import type { SurveyReportInput, SectionContent, ControlPoint, LevellingRun } from '@/types/surveyReport'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, input } = body as { projectId: string; input: Partial<SurveyReportInput> }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
    }

    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { data: points } = await supabase
      .from('survey_points')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_control', true)

    const controlPoints: ControlPoint[] = (points || []).map((p: any) => ({
      id: p.name || p.id,
      order: (p.control_order as 'PRIMARY' | 'SECONDARY' | 'TERTIARY') || 'TERTIARY',
      easting: p.easting,
      northing: p.northing,
      elevation: p.elevation || 0,
      source: (p.source as 'GNSS' | 'TOTAL_STATION' | 'EXISTING') || 'GNSS',
      description: p.description || '',
      markType: p.mark_type || 'Concrete Beacon'
    }))

    const benchmarks = controlPoints.filter((cp: any) => 
      cp.markType.toLowerCase().includes('bm') || 
      cp.markType.toLowerCase().includes('benchmark')
    )

    const { data: levelingRunsData } = await supabase
      .from('leveling_runs')
      .select('*')
      .eq('project_id', projectId)

    const levellingRuns: LevellingRun[] = (levelingRunsData || []).map((run: any) => ({
      runId: run.run_id || run.id,
      fromBM: run.from_bm || 'BM1',
      toBM: run.to_bm || 'BM2',
      distance: run.distance || 0,
      misclosure: run.misclosure || 0,
      allowable: run.allowable || 10,
      passes: run.passes ?? true
    }))

    let traversePrecision: number | undefined
    try {
      const { data: traverseData } = await supabase
        .from('traverse_results')
        .select('precision_ratio')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (traverseData?.precision_ratio) {
        traversePrecision = traverseData.precision_ratio
      }
    } catch {
      // No traverse data yet
    }

    const defaultInput: SurveyReportInput = {
      projectId,
      reportTitle: input.reportTitle || `${project.name} — Survey Report`,
      reportNumber: input.reportNumber || `SR-${Date.now().toString(36).toUpperCase()}`,
      revisionNumber: input.revisionNumber || 'Rev 0',
      clientName: input.clientName || project.client_name || '',
      clientAddress: input.clientAddress || project.client_address || '',
      firmName: input.firmName || '',
      firmAddress: input.firmAddress || '',
      firmIskNumber: input.firmIskNumber || '',
      surveyorName: input.surveyorName || project.surveyor_name || '',
      surveyorIskNumber: input.surveyorIskNumber || '',
      reportDate: input.reportDate || new Date().toISOString().split('T')[0],
      projectLocation: input.projectLocation || project.location || '',
      county: input.county || '',
      projectPurpose: input.projectPurpose || '',
      siteDescription: input.siteDescription || '',
      surveyPeriodStart: input.surveyPeriodStart || project.start_date || '',
      surveyPeriodEnd: input.surveyPeriodEnd || project.end_date || '',
      scopeItems: input.scopeItems || [],
      equipment: input.equipment || [],
      personnel: input.personnel || [],
      datum: input.datum || 'ARC1960',
      projection: input.projection || `UTM Zone ${project.utm_zone || 37}${project.hemisphere || 'S'}`,
      controlPoints: input.controlPoints || controlPoints,
      surveyMethod: input.surveyMethod || 'GNSS_RTK',
      instrumentUsed: input.instrumentUsed || '',
      traverseAccuracy: input.traverseAccuracy || (traversePrecision ? `1:${Math.round(traversePrecision).toLocaleString()}` : undefined),
      levellingMisclosure: input.levellingMisclosure || (levellingRuns.length > 0 ? `${levellingRuns[0].misclosure.toFixed(3)} mm` : undefined),
      levellingRuns: input.levellingRuns || levellingRuns,
      conclusions: input.conclusions || [],
      recommendations: input.recommendations || []
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
  } catch (error) {
    console.error('Survey report generate error:', error)
    return NextResponse.json(
      { error: 'Failed to generate survey report' },
      { status: 500 }
    )
  }
}
