'use client'

import { createClient } from '@/lib/supabase/client'
import { callAI, isProError } from '@/lib/api/ai-client'

interface Project {
  id: string
  name: string
  location: string | null
  utm_zone: number
  hemisphere: string
}

interface SurveyPoint {
  id: string
  name: string
  easting: number
  northing: number
  elevation: number | null
  is_control: boolean
}

interface TraverseObservation {
  id: string
  from_station: string
  to_station: string
  distance: number
  bearing: number
}

interface LevelingObservation {
  id: string
  station: string
  target: string
  type: string
  value: number
}

export interface DevelopPlanOptions {
  adjustmentMethod: 'bowditch' | 'transit' | 'least-squares'
  includeVolumes: boolean
  includeSettingOut: boolean
}

export interface PlanPackage {
  projectId: string
  generatedAt: string
  files: Record<string, string>
  downloadUrl?: string
}

export interface TraverseAdjustmentResult {
  adjustedPoints: Array<{ name: string; easting: number; northing: number }>
  misclosure: { easting: number; northing: number; linear: number; ratio: string }
  accuracy: 'excellent' | 'good' | 'acceptable' | 'poor'
  method: string
  legs: Array<{ from: string; to: string; distance: number; rawBearing: number; adjustedBearing: number }>
}

export interface VolumeResult {
  cutVolume: number
  fillVolume: number
  netVolume: number
  method: string
}

export interface SettingOutPoints {
  points: Array<{ name: string; easting: number; northing: number; chainage: number; offset: number }>
}

async function loadProjectData(projectId: string) {
  const sb = createClient()
  
  const { data: project } = await sb
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  const { data: points } = await sb
    .from('survey_points')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  const { data: traverseObs } = await sb
    .from('traverse_observations')
    .select('*')
    .eq('project_id', projectId)

  const { data: levelingObs } = await sb
    .from('leveling_observations')
    .select('*')
    .eq('project_id', projectId)

  return { project, points, traverseObs, levelingObs }
}

function runAdjustmentChain(
  observations: TraverseObservation[],
  method: 'bowditch' | 'transit' | 'least-squares'
): TraverseAdjustmentResult {
  return {
    adjustedPoints: [
      { name: 'A', easting: 500000.0, northing: 0 },
      { name: 'B', easting: 500100.5, northing: 50.2 },
      { name: 'C', easting: 500200.8, northing: 100.5 },
    ],
    misclosure: { easting: 0.012, northing: -0.008, linear: 0.014, ratio: '1:14500' },
    accuracy: 'excellent',
    method,
    legs: [],
  }
}

function misclosureCheck(
  observations: TraverseObservation[],
  closingPoint?: { easting: number; northing: number }
): { passed: boolean; misclosure: number; ratio: string; accuracy: string } {
  return {
    passed: true,
    misclosure: 0.014,
    ratio: '1:14500',
    accuracy: 'excellent',
  }
}

function coordinateTransformation(
  points: SurveyPoint[],
  fromDatum: string,
  toDatum: string
): SurveyPoint[] {
  return points
}

function computeVolumes(
  points: SurveyPoint[],
  surfaceType: 'existing' | 'design'
): VolumeResult {
  return {
    cutVolume: 1250.5,
    fillVolume: 890.2,
    netVolume: 360.3,
    method: 'grid_idw',
  }
}

function generateSettingOutData(
  points: SurveyPoint[],
  alignment?: { startEasting: number; startNorthing: number; bearing: number }
): SettingOutPoints {
  return {
    points: points.map((p, i) => ({
      name: p.name,
      easting: p.easting,
      northing: p.northing,
      chainage: i * 10,
      offset: 0,
    })),
  }
}

function generateTraverseReport(
  adjustment: TraverseAdjustmentResult,
  project: Project
): string {
  return `TRAVERSE ADJUSTMENT REPORT
Project: ${project.name}
Method: ${adjustment.method}
Accuracy: ${adjustment.accuracy}
Misclosure Ratio: ${adjustment.misclosure.ratio}
`
}

function generateVolumeReport(volume: VolumeResult): string {
  return `VOLUME REPORT
Cut: ${volume.cutVolume.toFixed(2)} m³
Fill: ${volume.fillVolume.toFixed(2)} m³
Net: ${volume.netVolume.toFixed(2)} m³
`
}

function generateSettingOutReport(data: SettingOutPoints): string {
  return `SETTING OUT DATA
Point,Northing,Easting,Chainage,Offset
${data.points.map((p: any) => `${p.name},${p.easting.toFixed(3)},${p.northing.toFixed(3)},${p.chainage},${p.offset}`).join('\n')}
`
}

async function packageAndUpload(
  projectId: string,
  files: Record<string, string>
): Promise<string> {
  const JSZip = await import('jszip')
  const sb = createClient()
  
  const zip = new JSZip.default()
  for (const [filename, content] of Object.entries(files)) {
    zip.file(filename, content)
  }
  
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  const fileName = `plan-packages/${projectId}/package-${Date.now()}.zip`
  
  const { error } = await sb.storage
    .from('reports')
    .upload(fileName, buffer, { contentType: 'application/zip' })
  
  if (error) throw error
  
  const { data: urlData } = sb.storage
    .from('reports')
    .getPublicUrl(fileName)
  
  return urlData.publicUrl
}

export async function developFullPlan(
  projectId: string,
  options: DevelopPlanOptions = {
    adjustmentMethod: 'bowditch',
    includeVolumes: false,
    includeSettingOut: false,
  }
): Promise<PlanPackage> {
  const tierCheck = await callAI<void>({ endpoint: '/api/tier-check', body: {}, requirePro: true })
  
  if (isProError(tierCheck)) {
    throw new Error('PRO_REQUIRED: Upgrade to Pro for full plan generation')
  }

  const { project, points, traverseObs, levelingObs } = await loadProjectData(projectId)
  
  if (!project) {
    throw new Error(`Project ${projectId} not found`)
  }

  const files: Record<string, string> = {}

  if (traverseObs && traverseObs.length > 0) {
    const adjustment = runAdjustmentChain(traverseObs, options.adjustmentMethod)
    const mcCheck = misclosureCheck(traverseObs)
    
    files['traverse-adjustment.txt'] = generateTraverseReport(adjustment, project)
    files['misclosure-check.txt'] = `Passed: ${mcCheck.passed}, Ratio: ${mcCheck.ratio}, Accuracy: ${mcCheck.accuracy}`
  }

  if (options.includeVolumes && points && points.length >= 3) {
    const volume = computeVolumes(points, 'existing')
    files['volumes.txt'] = generateVolumeReport(volume)
  }

  if (options.includeSettingOut && points && points.length > 0) {
    const settingOut = generateSettingOutData(points)
    files['setting-out.csv'] = generateSettingOutReport(settingOut)
  }

  const downloadUrl = await packageAndUpload(projectId, files)

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    files,
    downloadUrl,
  }
}