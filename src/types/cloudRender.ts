export type RenderType =
  | 'LARGE_SURVEY_PLAN'
  | 'MASS_HAUL_DIAGRAM'
  | 'CROSS_SECTION_SERIES'
  | 'TRAVERSE_NETWORK'
  | 'CONTOUR_MAP'

export type RenderStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETE' | 'FAILED'

export type RenderFormat = 'SVG' | 'PDF' | 'DXF' | 'PNG'

export interface RenderJob {
  id: string
  userId: string
  projectId?: string
  type: RenderType
  status: RenderStatus
  inputData: Record<string, unknown>
  outputUrl?: string
  outputFormat: RenderFormat
  pointCount?: number
  estimatedSeconds?: number
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  createdAt: string
}
