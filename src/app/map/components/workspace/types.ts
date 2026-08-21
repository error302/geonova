/**
 * Survey Workspace Types & Layout Definitions
 */

export type SurveyWorkflow =
  | 'idle'
  | 'point_collection'
  | 'traverse'
  | 'stakeout'
  | 'measure_distance'
  | 'measure_area'
  | 'vertex_editing'
  | 'import_review'

export interface SurveyWorkflowDef {
  id: SurveyWorkflow
  label: string
  description: string
  shortcut: string
  accent: string
}

export const SURVEY_WORKFLOWS: SurveyWorkflowDef[] = [
  { id: 'point_collection', label: 'Add Point', description: 'Capture boundary & control points with coordinates or GNSS.', shortcut: 'P', accent: '#3B82F6' },
  { id: 'traverse', label: 'Traverse', description: 'Occupied stations, angle/distance reduction & Bowditch adjustment.', shortcut: 'T', accent: '#10B981' },
  { id: 'stakeout', label: 'Stakeout', description: 'Target beacon navigation, live dE/dN offsets & radar guidance.', shortcut: 'S', accent: '#D17B47' },
  { id: 'measure_distance', label: 'Measure Distance', description: 'Segment and total geodesic distance with bearings.', shortcut: 'M', accent: '#8B5CF6' },
  { id: 'measure_area', label: 'Measure Area', description: 'Enclosed polygon boundary area and perimeter closure.', shortcut: 'A', accent: '#EC4899' },
  { id: 'vertex_editing', label: 'Edit Vertices', description: 'Snap, move, add or delete boundary vertices.', shortcut: 'V', accent: '#F59E0B' },
  { id: 'import_review', label: 'Import Review', description: 'Verify and assign layers to GeoJSON, KML, DXF or WKT.', shortcut: 'I', accent: '#06B6D4' },
]

export type PanelTab = 'tools' | 'layers' | 'data' | 'workflows'
