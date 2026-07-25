/**
 * @module workflowAutomation
 *
 * Project Workflow Automation Engine.
 *
 * THE BOTTLENECK THIS SOLVES:
 *   METARDU has 73 standalone tools, but they're not chained together.
 *   A surveyor enters traverse data in the field book, then must manually
 *   navigate to /tools/traverse to adjust, then /tools/area to compute
 *   area, then /tools/title-comparison to check dimensions, etc.
 *
 *   This module defines what should AUTOMATICALLY run for each project
 *   type when data is saved — no manual tool navigation needed.
 *
 * HOW IT WORKS:
 *   1. Surveyor saves field book data (or imports points, or enters alignment)
 *   2. The save endpoint calls runWorkflowAutomation(projectId, trigger)
 *   3. The engine looks up which automations are registered for this
 *      project type + trigger
 *   4. Each automation runs its computation module
 *   5. Results are stored in the project's automation_results table
 *   6. The project dashboard shows what was auto-computed + any issues
 *
 * AUTOMATION TRIGGERS:
 *   - fieldbook_saved: traverse/leveling observations saved
 *   - points_imported: CSV/instrument points imported
 *   - alignment_entered: road design alignment data entered
 *   - drone_processed: WebODM processing completed
 *   - pre_export: before generating deed plan / report
 *
 * AUTOMATIONS BY PROJECT TYPE:
 *
 *   TOPOGRAPHIC:
 *     fieldbook_saved → auto-classify feature codes → generate TIN (with breaklines)
 *       → filter DTM (CSF) → generate contours → compute slope analysis
 *     points_imported → same chain
 *
 *   ENGINEERING:
 *     alignment_entered → compute curve elements → generate chainage table
 *       → generate staking table → generate cross-sections
 *     fieldbook_saved → reduce levels → compute volumes → mass haul optimization
 *       → grade analysis
 *
 *   CADASTRAL:
 *     fieldbook_saved → Bowditch adjustment → compute area → cross-checks
 *       → title dimension comparison → statutory gate
 *     pre_export → run all cross-checks → statutory gate → block if fails
 */

import type { SurveyType } from '@/types/project'

export type AutomationTrigger =
  | 'fieldbook_saved'
  | 'points_imported'
  | 'alignment_entered'
  | 'drone_processed'
  | 'pre_export'

export type AutomationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface AutomationStep {
  /** Unique ID for this automation step */
  id: string
  /** Human-readable name */
  name: string
  /** What this step does */
  description: string
  /** The computation module to run */
  module: string
  /** Whether this step is blocking (must pass before export) */
  blocking: boolean
  /** Status of this step */
  status: AutomationStatus
  /** Result message (if completed) */
  result?: string
  /** Error message (if failed) */
  error?: string
  /** Timestamp of last run */
  lastRun?: string
}

export interface AutomationChain {
  /** The trigger that starts this chain */
  trigger: AutomationTrigger
  /** Steps to run in sequence */
  steps: AutomationStep[]
}

export interface ProjectAutomationState {
  projectId: string
  surveyType: SurveyType
  /** All automation chains for this project type */
  chains: AutomationChain[]
  /** Steps that have issues (failed or have warnings) */
  issues: AutomationStep[]
  /** Whether the project is ready for export */
  exportReady: boolean
  /** Summary */
  summary: string
}

// ─── Automation Definitions ─────────────────────────────────────────────────

const TOPO_AUTOMATIONS: Record<AutomationTrigger, AutomationStep[]> = {
  fieldbook_saved: [
    { id: 'feature_code', name: 'Feature Code Classification', description: 'Auto-classify points from instrument codes', module: 'featureCodeAutomation', blocking: false, status: 'pending' },
    { id: 'tin_generation', name: 'TIN Generation (Breakline-Enforced)', description: 'Build TIN with breakline enforcement', module: 'tinWithBreaklines', blocking: true, status: 'pending' },
    { id: 'dtm_filter', name: 'DTM Filtering (CSF)', description: 'Classify ground vs non-ground points', module: 'pointCloudClassification', blocking: false, status: 'pending' },
    { id: 'contour_generation', name: 'Contour Generation', description: 'Extract contours from ground-only DTM', module: 'realTimeContours', blocking: true, status: 'pending' },
    { id: 'slope_analysis', name: 'Slope Analysis', description: 'Compute slope classes (flat/gentle/moderate/steep/cliff)', module: 'slopeAnalysis', blocking: false, status: 'pending' },
  ],
  points_imported: [
    { id: 'feature_code', name: 'Feature Code Classification', description: 'Auto-classify imported points', module: 'featureCodeAutomation', blocking: false, status: 'pending' },
    { id: 'tin_generation', name: 'TIN Generation (Breakline-Enforced)', description: 'Build TIN with breakline enforcement', module: 'tinWithBreaklines', blocking: true, status: 'pending' },
    { id: 'dtm_filter', name: 'DTM Filtering (CSF)', description: 'Classify ground vs non-ground', module: 'pointCloudClassification', blocking: false, status: 'pending' },
    { id: 'contour_generation', name: 'Contour Generation', description: 'Extract contours from DTM', module: 'realTimeContours', blocking: true, status: 'pending' },
  ],
  alignment_entered: [],
  drone_processed: [
    { id: 'pointcloud_import', name: 'Point Cloud Import', description: 'Import LAS/LAZ from drone processing', module: 'pointCloudImport', blocking: true, status: 'pending' },
    { id: 'tin_generation', name: 'TIN Generation', description: 'Build TIN from drone point cloud', module: 'tinWithBreaklines', blocking: true, status: 'pending' },
    { id: 'contour_generation', name: 'Contour Generation', description: 'Extract contours from drone DTM', module: 'realTimeContours', blocking: true, status: 'pending' },
    { id: 'volume_computation', name: 'Volume Computation', description: 'Compute cut/fill volumes (grid + TIN cross-check)', module: 'pointCloudVolume', blocking: false, status: 'pending' },
  ],
  pre_export: [
    { id: 'cross_checks', name: 'Calculation Cross-Checks', description: 'Run 6 independent verification methods', module: 'calculationCrossCheck', blocking: true, status: 'pending' },
    { id: 'statutory_gate', name: 'Statutory Validation Gate', description: 'Check Cap. 299 + RDM 1.1 compliance', module: 'statutoryGate', blocking: true, status: 'pending' },
  ],
}

const ENGINEERING_AUTOMATIONS: Record<AutomationTrigger, AutomationStep[]> = {
  fieldbook_saved: [
    { id: 'level_reduction', name: 'Level Reduction', description: 'Reduce levels (Rise & Fall + Height of Collimation)', module: 'leveling', blocking: true, status: 'pending' },
    { id: 'closure_check', name: 'Closure Check (10√K mm)', description: 'Verify leveling closure per RDM 1.1', module: 'levelingValidation', blocking: true, status: 'pending' },
    { id: 'volume_computation', name: 'Volume Computation', description: 'Compute cut/fill from cross-sections', module: 'pointCloudVolume', blocking: false, status: 'pending' },
    { id: 'mass_haul', name: 'Mass Haul Optimization', description: 'Free-haul, overhaul, borrow/spoil', module: 'massHaulOptimization', blocking: false, status: 'pending' },
  ],
  points_imported: [
    { id: 'tin_generation', name: 'TIN Generation', description: 'Build TIN from survey points', module: 'tinWithBreaklines', blocking: true, status: 'pending' },
    { id: 'volume_computation', name: 'Volume Computation', description: 'Compute cut/fill (grid + TIN cross-check)', module: 'pointCloudVolume', blocking: false, status: 'pending' },
  ],
  alignment_entered: [
    { id: 'curve_elements', name: 'Curve Element Computation', description: 'Compute T, L, E, M from IP data', module: 'stakingTable', blocking: true, status: 'pending' },
    { id: 'chainage_table', name: 'Chainage Table Generation', description: 'Generate IP/TP1/MID/TP2 schedule', module: 'stakingTable', blocking: false, status: 'pending' },
    { id: 'staking_table', name: 'Batch Staking Table', description: 'Generate stakes at regular intervals', module: 'stakingTable', blocking: false, status: 'pending' },
    { id: 'grade_analysis', name: 'Grade Analysis', description: 'Sustained grades, critical lengths, climbing lane warrants', module: 'p2Modules.gradeAnalysis', blocking: false, status: 'pending' },
  ],
  drone_processed: [
    { id: 'volume_computation', name: 'Volume Computation', description: 'Cut/fill from drone surfaces', module: 'pointCloudVolume', blocking: true, status: 'pending' },
    { id: 'progressive_tracking', name: 'Progressive Volume Tracking', description: 'Compare epochs, compute progress %', module: 'progressiveVolumeTracking', blocking: false, status: 'pending' },
  ],
  pre_export: [
    { id: 'cross_checks', name: 'Calculation Cross-Checks', description: 'Run independent verification', module: 'calculationCrossCheck', blocking: true, status: 'pending' },
    { id: 'statutory_gate', name: 'Statutory Validation Gate', description: 'Check RDM 1.1 compliance', module: 'statutoryGate', blocking: true, status: 'pending' },
  ],
}

const CADASTRAL_AUTOMATIONS: Record<AutomationTrigger, AutomationStep[]> = {
  fieldbook_saved: [
    { id: 'traverse_adjustment', name: 'Traverse Adjustment (Bowditch)', description: 'Run Bowditch adjustment on traverse observations', module: 'traverse', blocking: true, status: 'pending' },
    { id: 'area_computation', name: 'Area Computation', description: 'Compute parcel area (Shoelace + cross-check)', module: 'area', blocking: true, status: 'pending' },
    { id: 'closure_check', name: 'Closure + Precision Check', description: 'Verify misclosure + precision ratio per Cap. 299', module: 'traverseValidation', blocking: true, status: 'pending' },
    { id: 'cross_checks', name: 'Calculation Cross-Checks', description: 'Area, bearing, distance, closure cross-checks', module: 'calculationCrossCheck', blocking: false, status: 'pending' },
    { id: 'title_comparison', name: 'Title Dimension Comparison', description: 'Compare surveyed vs title deed dimensions', module: 'titleAndDispute', blocking: false, status: 'pending' },
  ],
  points_imported: [],
  alignment_entered: [],
  drone_processed: [],
  pre_export: [
    { id: 'cross_checks', name: 'Final Cross-Checks', description: 'Run all 6 independent verification methods', module: 'calculationCrossCheck', blocking: true, status: 'pending' },
    { id: 'statutory_gate', name: 'Statutory Validation Gate', description: 'Cap. 299 + RDM 1.1 + ArdhiSasa compliance', module: 'statutoryGate', blocking: true, status: 'pending' },
    { id: 'deed_plan_check', name: 'Deed Plan Validation', description: 'Verify deed plan format + SoK compliance', module: 'deedPlan', blocking: true, status: 'pending' },
  ],
}

const GEODETIC_AUTOMATIONS: Record<AutomationTrigger, AutomationStep[]> = {
  fieldbook_saved: [
    { id: 'lsq_adjustment', name: 'Least Squares Adjustment', description: 'Run network adjustment with error ellipses', module: 'leastSquaresAdjustment', blocking: true, status: 'pending' },
    { id: 'precision_check', name: 'Precision Check', description: 'Verify a posteriori reference variance', module: 'traverseValidation', blocking: true, status: 'pending' },
  ],
  points_imported: [],
  alignment_entered: [],
  drone_processed: [],
  pre_export: [
    { id: 'statutory_gate', name: 'Statutory Validation Gate', description: 'Check control survey standards', module: 'statutoryGate', blocking: true, status: 'pending' },
  ],
}

const DRONE_AUTOMATIONS: Record<AutomationTrigger, AutomationStep[]> = {
  fieldbook_saved: [
    { id: 'gcp_validation', name: 'GCP Validation', description: 'Validate ground control point residuals', module: 'gcpValidation', blocking: true, status: 'pending' },
  ],
  points_imported: [
    { id: 'pointcloud_import', name: 'Point Cloud Import', description: 'Import LAS/LAZ/PLY', module: 'pointCloudImport', blocking: true, status: 'pending' },
    { id: 'tin_generation', name: 'TIN Generation', description: 'Build TIN from point cloud', module: 'tinWithBreaklines', blocking: true, status: 'pending' },
    { id: 'contour_generation', name: 'Contour Generation', description: 'Extract contours', module: 'realTimeContours', blocking: false, status: 'pending' },
    { id: 'volume_computation', name: 'Volume Computation', description: 'Cut/fill volumes', module: 'pointCloudVolume', blocking: false, status: 'pending' },
  ],
  alignment_entered: [],
  drone_processed: [
    { id: 'orthophoto_import', name: 'Orthophoto Import', description: 'Import orthophoto GeoTIFF', module: 'orthophotoViewer', blocking: false, status: 'pending' },
    { id: 'pointcloud_import', name: 'Point Cloud Import', description: 'Import LAS from WebODM', module: 'pointCloudImport', blocking: true, status: 'pending' },
    { id: 'tin_generation', name: 'TIN Generation', description: 'Build TIN from drone point cloud', module: 'tinWithBreaklines', blocking: true, status: 'pending' },
    { id: 'contour_generation', name: 'Contour Generation', description: 'Extract contours from drone DTM', module: 'realTimeContours', blocking: true, status: 'pending' },
    { id: 'volume_computation', name: 'Volume Computation', description: 'Cut/fill volumes (grid + TIN cross-check)', module: 'pointCloudVolume', blocking: false, status: 'pending' },
  ],
  pre_export: [
    { id: 'statutory_gate', name: 'Statutory Validation Gate', description: 'Check drone survey standards', module: 'statutoryGate', blocking: true, status: 'pending' },
  ],
}

const AUTOMATION_REGISTRY: Record<SurveyType, Record<AutomationTrigger, AutomationStep[]>> = {
  topographic: TOPO_AUTOMATIONS,
  engineering: ENGINEERING_AUTOMATIONS,
  cadastral: CADASTRAL_AUTOMATIONS,
  geodetic: GEODETIC_AUTOMATIONS,
  drone: DRONE_AUTOMATIONS,
  deformation: GEODETIC_AUTOMATIONS, // same as geodetic
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get the automation chains for a project type.
 * Call this when the project loads to show the surveyor what will auto-run.
 */
export function getAutomationChains(
  surveyType: SurveyType,
): Record<AutomationTrigger, AutomationStep[]> {
  return AUTOMATION_REGISTRY[surveyType] || {}
}

/**
 * Get the automation chain for a specific trigger.
 * Call this when data is saved to run the appropriate automations.
 */
export function getAutomationChain(
  surveyType: SurveyType,
  trigger: AutomationTrigger,
): AutomationStep[] {
  const registry = AUTOMATION_REGISTRY[surveyType]
  if (!registry) return []
  return registry[trigger] || []
}

/**
 * Get all blocking steps for a project type (pre-export).
 * These are the steps that MUST pass before the project can be exported.
 */
export function getBlockingSteps(
  surveyType: SurveyType,
  trigger: AutomationTrigger = 'pre_export',
): AutomationStep[] {
  return getAutomationChain(surveyType, trigger).filter(s => s.blocking)
}

/**
 * Get a human-readable summary of what will auto-run for a project.
 */
export function getAutomationSummary(surveyType: SurveyType): string {
  const chains = getAutomationChains(surveyType)
  const allSteps = Object.values(chains).flat()
  const blockingCount = allSteps.filter(s => s.blocking).length
  return `${allSteps.length} automation steps (${blockingCount} blocking) configured for ${surveyType} surveys. ` +
    `Tools run automatically when data is saved — no manual tool navigation needed.`
}

/**
 * Check if a project is ready for export based on automation status.
 */
export function checkExportReady(
  surveyType: SurveyType,
  stepResults: AutomationStep[],
): { ready: boolean; blockingIssues: AutomationStep[] } {
  const exportSteps = stepResults.filter(s =>
    getBlockingSteps(surveyType, 'pre_export').some(bs => bs.id === s.id)
  )
  const blockingIssues = exportSteps.filter(s => s.status === 'failed' || s.status === 'pending')
  return {
    ready: blockingIssues.length === 0,
    blockingIssues,
  }
}
