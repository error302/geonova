/**
 * Survey Workspace layout constants and shared types.
 *
 * Single source of truth for the map Survey Workspace chrome so the header,
 * nav rail, panels, drawers, and controls all agree on sizes and stacking
 * order. Import from 'use client' components — no server-only deps.
 */

/** Height of the workspace header bar (px). */
export const MAP_HEADER_HEIGHT = 56

/** Width of the persistent nav rail (px). */
export const NAV_RAIL_WIDTH = 64

/** Width of the collapsible workspace panel (px). */
export const WORKSPACE_PANEL_WIDTH = 320

/** Width of the details drawer (px). */
export const DETAILS_DRAWER_WIDTH = 340

/** Central z-index scale for the workspace chrome. */
export const Z_INDEX = {
  map: 0,
  base: 0,
  watermark: 1,
  mapOverlay: 100,
  mapControls: 200,
  contextualToolbar: 300,
  toolbar: 300,
  leftPanel: 400,
  panel: 400,
  navRail: 450,
  rightDrawer: 500,
  drawer: 500,
  bottomDrawer: 600,
  workflow: 600,
  header: 700,
  modal: 1000,
  toast: 1100,
} as const

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
}

export const SURVEY_WORKFLOWS: SurveyWorkflowDef[] = [
  { id: 'point_collection', label: 'Collect Points', description: 'Capture boundary / control points on the ground or from imagery.', shortcut: 'P' },
  { id: 'traverse', label: 'Traverse', description: 'Run a traverse loop, then close and adjust it.', shortcut: 'T' },
  { id: 'stakeout', label: 'Stake Out', description: 'GPS stakeout of a point, beacon, or parcel corner.', shortcut: 'S' },
  { id: 'measure_distance', label: 'Measure Distance', description: 'Measure a distance between two points on the map.', shortcut: 'M' },
  { id: 'measure_area', label: 'Measure Area', description: 'Measure an area by tracing a polygon.', shortcut: 'A' },
  { id: 'vertex_editing', label: 'Edit Vertices', description: 'Snap and move parcel / boundary vertices.', shortcut: 'V' },
  { id: 'import_review', label: 'Review Import', description: 'Review and clean imported data (GeoJSON, KML, WKT, DXF).', shortcut: 'I' },
]

export interface WorkspaceNavItem {
  id: string
  label: string
  href?: string
  icon: string
}

/** App-level navigation rail for the survey workspace. */
export const WORKSPACE_NAV: WorkspaceNavItem[] = [
  { id: 'projects', label: 'Projects', href: '/dashboard', icon: 'folder' },
  { id: 'map', label: 'Map', href: '/map', icon: 'map' },
  { id: 'survey', label: 'Survey', href: '/tools', icon: 'compass' },
  { id: 'cogo', label: 'COGO', href: '/tools', icon: 'calculator' },
  { id: 'data', label: 'Data', href: '/registry', icon: 'database' },
  { id: 'reports', label: 'Reports', href: '/reports', icon: 'file' },
  { id: 'layers', label: 'Layers', icon: 'layers' },
  { id: 'settings', label: 'Settings', href: '/settings', icon: 'settings' },
]