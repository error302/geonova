/**
 * Submission Domain Model Types
 * Phase 13: Canonical Submission Package System
 */

import type { SurveyType } from './project'

// ============================================================================
// Core Submission Types
// ============================================================================

export interface ProjectSubmission {
  id: string
  project_id: string
  surveyor_profile_id: string
  submission_number: string // e.g. "RS149_2025_002_R00"
  revision_code: string // "R00", "R01", etc.
  submission_year: number
  package_status: PackageStatus
  required_sections: SubmissionSection[]
  generated_artifacts: Record<string, string> // section_id → storage path
  supporting_attachments: Record<string, string> // slot_id → storage path
  validation_results: ValidationResult[]
  metadata: SubmissionMetadata
  created_at: string
  updated_at: string
}

export type PackageStatus = 'draft' | 'incomplete' | 'ready' | 'submitted'

export interface SubmissionSection {
  id: SubmissionSectionId
  order: number
  label: string
  required: boolean
  status: SectionStatus
  artifact_key?: string
  description?: string
}

export type SubmissionSectionId =
  | 'surveyor_report'
  | 'index'
  | 'coordinate_list'
  | 'working_diagram'
  | 'theoretical_comps'
  | 'rtk_result'
  | 'consistency_checks'
  | 'area_computations'

export type SectionStatus = 'missing' | 'pending' | 'ready'

export interface ValidationResult {
  section_id: string
  passed: boolean
  message: string
  severity: 'error' | 'warning' | 'info'
}

export interface SubmissionMetadata {
  survey_type?: SurveyType
  area_hectares?: number
  client_name?: string
  project_location?: string
  computed_by?: string
  checked_by?: string
  submission_date?: string
}

// ============================================================================
// Submission Package Structure
// ============================================================================

export interface SubmissionPackage {
  submission: ProjectSubmission
  project: SubmissionProjectData
  surveyor: SubmissionSurveyorData
  computed_sections: ComputedSection[]
  attachments: SubmissionAttachment[]
  validation: PackageValidation
}

export interface SubmissionProjectData {
  id: string
  name: string
  location: string
  lr_number?: string
  folio_number?: string
  register_number?: string
  fir_number?: string
  registration_block?: string
  registration_district?: string
  locality?: string
  computations_no?: string
  field_book_no?: string
  file_reference?: string
  survey_type: SurveyType
  area_hectares?: number
}

export interface SubmissionSurveyorData {
  id: string
  full_name: string
  registration_number: string // e.g. "RS149"
  firm_name?: string
  seal_url?: string
  signature_url?: string
}

export interface ComputedSection {
  section_id: SubmissionSectionId
  status: SectionStatus
  artifact_path?: string
  generated_at?: string
  generated_by?: string
}

export interface SubmissionAttachment {
  slot_id: string
  label: string
  required: boolean
  file_path?: string
  file_name?: string
  file_size?: number
  uploaded_at?: string
  mime_type?: string
}

export interface PackageValidation {
  ready: boolean
  blockers: ValidationResult[]
  warnings: ValidationResult[]
  info: ValidationResult[]
}

// ============================================================================
// Submission Section Definitions (Benchmark-Aligned)
// ============================================================================

export const SUBMISSION_SECTIONS: SubmissionSection[] = [
  {
    id: 'surveyor_report',
    order: 1,
    label: "Surveyor's Report",
    required: true,
    status: 'missing',
    description: 'Narrative report with approval reference, datum reference, method narrative, and conclusion'
  },
  {
    id: 'index',
    order: 2,
    label: 'Index to Computations',
    required: true,
    status: 'missing',
    description: 'Package manifest listing all sections and their status'
  },
  {
    id: 'coordinate_list',
    order: 3,
    label: 'Final Coordinate List',
    required: true,
    status: 'missing',
    description: 'Station, northings, eastings, class of beacon, description'
  },
  {
    id: 'working_diagram',
    order: 4,
    label: 'Working Diagram',
    required: true,
    status: 'missing',
    description: 'Technical drawing with coordinates, bearings, distances'
  },
  {
    id: 'theoretical_comps',
    order: 5,
    label: 'Theoretical Computations',
    required: true,
    status: 'missing',
    description: 'Datum joins, delta northings/eastings, distances, bearings'
  },
  {
    id: 'rtk_result',
    order: 6,
    label: 'RTK / Field Result Bundle',
    required: false,
    status: 'missing',
    description: 'GNSS RTK raw output and field results'
  },
  {
    id: 'consistency_checks',
    order: 7,
    label: 'Consistency Checks',
    required: true,
    status: 'missing',
    description: 'Computed vs plan values, delta N/E, status'
  },
  {
    id: 'area_computations',
    order: 8,
    label: 'Area Computations',
    required: true,
    status: 'missing',
    description: 'Parcel-by-parcel area, total area, F/R area, discrepancy'
  }
]

// ============================================================================
// Attachment Slot Definitions
// ============================================================================

export interface AttachmentSlot {
  id: string
  label: string
  required: boolean
  accepts: string[] // MIME types
  max_size_mb: number
  help_text: string
  category: 'approval' | 'consent' | 'technical' | 'field_data'
}

export const BOUNDARY_ATTACHMENT_SLOTS: AttachmentSlot[] = [
  {
    id: 'ppa2',
    label: 'Physical Planning Approval (PPA2)',
    required: true,
    accepts: ['application/pdf', 'image/jpeg', 'image/png'],
    max_size_mb: 10,
    help_text: 'Approval from local authority for subdivision',
    category: 'approval'
  },
  {
    id: 'lcb_consent',
    label: 'Land Control Board Consent',
    required: true,
    accepts: ['application/pdf'],
    max_size_mb: 10,
    help_text: 'Required for subdivisions under the Land Control Act',
    category: 'consent'
  },
  {
    id: 'mutation_form',
    label: 'Mutation Form / Subdivision Scheme',
    required: true,
    accepts: ['application/pdf', 'image/jpeg'],
    max_size_mb: 20,
    help_text: 'Signed by landowner and registered surveyor',
    category: 'approval'
  },
  {
    id: 'rtk_raw',
    label: 'RTK Raw Output',
    required: false,
    accepts: ['.csv', '.txt', '.xlsx', '.rinex', '.obs', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    max_size_mb: 50,
    help_text: 'Raw GNSS field data from RTK session',
    category: 'field_data'
  },
  {
    id: 'field_book_export',
    label: 'Digital Field Book Export',
    required: false,
    accepts: ['.csv', '.fbk', '.xlsx', '.landxml', 'text/csv'],
    max_size_mb: 20,
    help_text: 'Exported from total station or GNSS instrument',
    category: 'field_data'
  }
]

// ============================================================================
// Computation Workbook Types
// ============================================================================

export interface SubmissionWorkbookData {
  submission: ProjectSubmission
  project: SubmissionProjectData
  surveyor: SubmissionSurveyorData
  coordinate_list: CoordinateListEntry[]
  datum_joins: DatumJoinEntry[]
  consistency_of_datum: ConsistencyDatumEntry[]
  theoretical_computations: TheoreticalComputationEntry[]
  rtk_results?: RTKResultEntry[]
  consistency_checks: ConsistencyCheckEntry[]
  area_computations: AreaComputationEntry[]
}

export interface CoordinateListEntry {
  station: string
  northings: number
  eastings: number
  heights?: number
  beacon_class: 'new' | 'old' | 'theoretical' | 'I.P.C.U.'
  description?: string
}

export interface DatumJoinEntry {
  from: string
  to: string
  delta_northing: number
  delta_easting: number
  distance: number
  bearing: string
}

export interface ConsistencyDatumEntry {
  station: string
  adopted_northing: number
  adopted_easting: number
  plan_northing: number
  plan_easting: number
  delta_northing: number
  delta_easting: number
}

export interface TheoreticalComputationEntry {
  line: string
  bearing: string
  distance: number
  delta_northing: number
  delta_easting: number
}

export interface RTKResultEntry {
  point_id: string
  northing: number
  easting: number
  elevation: number
  solution_type: 'fixed' | 'float' | 'differential'
  hdop: number
  satellites: number
}

export interface ConsistencyCheckEntry {
  station: string
  computed_n: number
  computed_e: number
  plan_n: number
  plan_e: number
  delta_n: number
  delta_e: number
  status: 'pass' | 'fail'
}

export interface AreaComputationEntry {
  parcel: string
  area_sqm: number
  area_ha: number
  fr_area?: number
  discrepancy?: number
  status: 'valid' | 'check_required'
}

// ============================================================================
// Shapefile Export Types
// ============================================================================

export interface ShapefileData {
  beacons: ShapefileBeacon[]
  boundaries: ShapefileBoundary[]
  parcels: ShapefileParcel[]
  projection: ShapefileProjection
}

export interface ShapefileBeacon {
  station: string
  easting: number
  northing: number
  elevation?: number
  beacon_class: string
  description?: string
}

export interface ShapefileBoundary {
  from: string
  to: string
  from_easting: number
  from_northing: number
  to_easting: number
  to_northing: number
  bearing: string
  distance: number
}

export interface ShapefileParcel {
  id: string
  lr_number?: string
  area_sqm: number
  area_ha: number
  coordinates: [number, number][] // [easting, northing] pairs
}

export interface ShapefileProjection {
  zone: number
  hemisphere: 'N' | 'S'
  datum: string
  ellipsoid: string
}

// ============================================================================
// Legacy Submission Types (for compatibility)
// ============================================================================

export type DocumentStatus = 'missing' | 'pending' | 'generating' | 'ready' | 'error'

export interface ProjectDocument {
  id: string
  document_id?: string // For DB compatibility
  type: string
  label: string
  description?: string
  required: boolean
  status: DocumentStatus
  fileUrl?: string
  file_url?: string // DB compatibility
  uploadedAt?: string
  uploaded_at?: string // DB compatibility
  generatedAt?: string
  generated_at?: string // DB compatibility
  errorMessage?: string
  error_message?: string
}

export interface SubmissionDocument {
  id: string
  label: string
  description: string
  format: string
  surveyTypes: string[]
  requiredData: string[]
}

export interface ProjectSubmissionRecord {
  id: string
  project_id: string
  user_id: string
  surveyor_profile_user_id: string | null
  submission_year: number
  sequence_number: number | null
  revision_number: number
  submission_number: string | null
  package_status: PackageStatus
  required_documents: unknown[]
  generated_artifacts: Record<string, unknown>
  supporting_attachments: Record<string, unknown>
  validation_results: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type SubmissionPackageStatus = PackageStatus

export interface SurveyorDocumentProfile {
  userId: string
  name: string
  firm: string
  licence: string
  phone: string
  email: string
  address: string
  county: string
  sealImagePath: string
  profilePublic: boolean
  verifiedLicence: boolean
}

/**
 * P2-1 Phase 13 Workstream 2 (2026-07-24): DB-backed surveyor profile.
 * The single source of truth for surveyor identity in all official
 * document generation, submission numbering, and deed plan signing.
 * Replaces localStorage-based identity lookup.
 */
export interface SurveyorProfile {
  id: string
  user_id: string
  full_name: string
  registration_number: string   // e.g. "RS149" — used in submission number
  firm_name?: string
  seal_url?: string             // storage path to seal image
  signature_url?: string
}
