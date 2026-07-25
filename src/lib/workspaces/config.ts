/**
 * Contextual Workspaces
 * =====================
 *
 * Filter-based workspace configuration. Instead of one cluttered UI
 * showing every tool, the interface morphs based on the active
 * workspace: Cadastral, Engineering, or Topographic.
 *
 * Design principles
 * -----------------
 * - FILTER, not FORK. Same shell, same components, different tool
 *   palette. We don't build three separate apps — that triples
 *   maintenance burden for no gain.
 * - AUTO-DETECT from project type. When a surveyor opens a cadastral
 *   project, the workspace switches automatically. Manual override
 *   is available for cross-discipline work.
 * - ESCAPE HATCH. A surveyor doing a cadastral subdivision that
 *   needs a topo survey for the access road can pull in topo tools
 *   temporarily without leaving the cadastral workspace.
 *
 * What a workspace controls
 * -------------------------
 * - Which tool categories appear in the sidebar (Calculations,
 *   Coordinates, Engineering, Volumes, Documents, etc.)
 * - Which map layers are enabled by default (parcels, alignments,
 *   contours, control points)
 * - Which hotkeys are active (COGO shortcuts in Cadastral, profile
 *   shortcuts in Engineering)
 * - Which document types are offered in the submission page
 *
 * Usage
 * -----
 *   import { getWorkspaceConfig, autoDetectWorkspace } from '@/lib/workspaces/config'
 *
 *   // Auto-detect from project type
 *   const workspace = autoDetectWorkspace(project.survey_type)
 *   const config = getWorkspaceConfig(workspace)
 *
 *   // In the sidebar component:
 *   const visibleCategories = config.toolCategories  // ['Calculations', 'Coordinates', 'Documents', ...]
 *
 *   // Escape hatch: surveyor manually switches
 *   const engConfig = getWorkspaceConfig('engineering')
 */

import type { SurveyType } from '@/types/project'

// ─── Workspace definition ──────────────────────────────────────────────

export type WorkspaceId = 'cadastral' | 'engineering' | 'topographic'

export interface WorkspaceConfig {
  id: WorkspaceId
  label: string
  description: string
  /** Tool categories shown in the sidebar. Others are hidden. */
  toolCategories: string[]
  /** Map layers enabled by default when this workspace is active. */
  defaultMapLayers: string[]
  /** Hotkey sets active in this workspace. */
  hotkeySets: string[]
  /** Document types offered in the submission page. */
  documentTypes: string[]
  /** Accent color for the workspace badge in the UI. */
  accentColor: string
  /** Icon name (lucide-react) for the workspace switcher. */
  icon: string
}

// ─── Workspace configs ─────────────────────────────────────────────────

const WORKSPACE_CONFIGS: Record<WorkspaceId, WorkspaceConfig> = {
  cadastral: {
    id: 'cadastral',
    label: 'Cadastral',
    description: 'Boundary surveys, deed plans, mutations, RIM. Focused on legal property definition.',
    toolCategories: [
      'Calculations',
      'Coordinates',
      'Documents',
      'Field Books',
      'Validation',
    ],
    defaultMapLayers: [
      'parcels',
      'control_points',
      'beacons',
      'scheme_blocks',
    ],
    hotkeySets: ['cogo', 'traverse', 'parcel_editing'],
    documentTypes: [
      'deed-plan',
      'form-c22',
      'area-computation',
      'traverse-computation-sheet',
      'mutation-form',
      'rim',
      'boundary-shapefile',
      'control-schedule',
    ],
    accentColor: '#D17B47', // sienna — matches control point color
    icon: 'LandPlot',
  },

  engineering: {
    id: 'engineering',
    label: 'Engineering',
    description: 'Road design, alignments, levels, earthworks, setting out. Focused on construction.',
    toolCategories: [
      'Calculations',
      'Coordinates',
      'Engineering',
      'Volumes',
      'Documents',
      'Field Books',
      'Validation',
    ],
    defaultMapLayers: [
      'alignments',
      'control_points',
      'cross_sections',
      'longitudinal_profiles',
      'design_surface',
    ],
    hotkeySets: ['alignment', 'profile', 'cross_section'],
    documentTypes: [
      'traverse-report',
      'levelling-report',
      'longitudinal-section',
      'volumetric-report',
      'setting-out-dxf',
      'control-schedule',
    ],
    accentColor: '#C89759', // ochre — matches road color
    icon: 'Building2',
  },

  topographic: {
    id: 'topographic',
    label: 'Topographic',
    description: 'Tacheometry, DTM, contours, volumes. Focused on terrain representation.',
    toolCategories: [
      'Calculations',
      'Coordinates',
      'Volumes',
      'Documents',
      'Field Books',
      'Validation',
    ],
    defaultMapLayers: [
      'topo_points',
      'contours',
      'dtm',
      'control_points',
      'orthophoto',
    ],
    hotkeySets: ['tacheometry', 'feature_coding', 'contour'],
    documentTypes: [
      'topographic-plan',
      'volumetric-report',
      'control-schedule',
      'field-book',
    ],
    accentColor: '#5A7551', // dark sage — matches vegetation
    icon: 'Mountain',
  },
}

// ─── Auto-detection ────────────────────────────────────────────────────

/**
 * Map SurveyType to WorkspaceId.
 *
 * Cadastral → cadastral workspace
 * Engineering → engineering workspace
 * Topographic → topographic workspace
 * Geodetic → cadastral (control survey work is closest to cadastral
 *   in terms of tools needed — COGO, traverses, coordinate schedules)
 * Drone → topographic (drone surveys produce topo-style data)
 * Deformation → engineering (monitoring work uses engineering tools)
 */
export function autoDetectWorkspace(surveyType: SurveyType | string): WorkspaceId {
  const normalized = String(surveyType).toLowerCase()
  if (normalized.includes('cadastral') || normalized.includes('boundary')) {
    return 'cadastral'
  }
  if (normalized.includes('engineering') || normalized.includes('road') || normalized.includes('construction')) {
    return 'engineering'
  }
  if (normalized.includes('topographic') || normalized.includes('topo')) {
    return 'topographic'
  }
  if (normalized.includes('geodetic') || normalized.includes('control')) {
    return 'cadastral'
  }
  if (normalized.includes('drone') || normalized.includes('uav')) {
    return 'topographic'
  }
  if (normalized.includes('deformation') || normalized.includes('monitor')) {
    return 'engineering'
  }
  // Default fallback
  return 'cadastral'
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Get the full configuration for a workspace.
 * @throws {Error} if the workspace id is unknown
 */
export function getWorkspaceConfig(id: WorkspaceId): WorkspaceConfig {
  const config = WORKSPACE_CONFIGS[id]
  if (!config) {
    throw new Error(`Unknown workspace: ${id}. Valid workspaces: ${Object.keys(WORKSPACE_CONFIGS).join(', ')}`)
  }
  return config
}

/**
 * List all available workspaces (for the switcher UI).
 */
export function listWorkspaces(): WorkspaceConfig[] {
  return Object.values(WORKSPACE_CONFIGS)
}

/**
 * Check if a tool category should be visible in the given workspace.
 */
export function isToolCategoryVisible(workspaceId: WorkspaceId, category: string): boolean {
  const config = getWorkspaceConfig(workspaceId)
  return config.toolCategories.includes(category)
}

/**
 * Check if a document type should be offered in the given workspace.
 */
export function isDocumentTypeAvailable(workspaceId: WorkspaceId, documentType: string): boolean {
  const config = getWorkspaceConfig(workspaceId)
  return config.documentTypes.includes(documentType)
}

/**
 * Get the default map layers for a workspace.
 * The map component uses this to decide which layers to enable on load.
 */
export function getDefaultMapLayers(workspaceId: WorkspaceId): string[] {
  return getWorkspaceConfig(workspaceId).defaultMapLayers
}
