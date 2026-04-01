export interface ProjectSubmission {
  id: string
  project_id: string
  surveyor_profile_id: string
  submission_number: string      // e.g. "RS149_2025_002_R00"
  revision_code: string          // "R00", "R01", etc.
  submission_year: number
  package_status: 'draft' | 'incomplete' | 'ready' | 'submitted'
  required_sections: SubmissionSection[]
  generated_artifacts: Record<string, string>   // section_id → storage path
  supporting_attachments: Record<string, string> // slot_id → storage path
  validation_results: ValidationResult[]
  created_at: string
  updated_at: string
}

export interface SubmissionSection {
  id: string
  order: number
  label: string
  required: boolean
  status: 'missing' | 'pending' | 'ready'
  artifact_key?: string
}

export interface ValidationResult {
  section_id: string
  passed: boolean
  message: string
}

// Benchmark-aligned section order (matches 5 acres compilation + 4 acres theoretical)
export const SUBMISSION_SECTIONS: SubmissionSection[] = [
  { id: 'surveyor_report',       order: 1, label: "Surveyor",          required: true,  status: 'missing' },
  { id: 'index',                 order: 2, label: 'Index to Computations',       required: true,  status: 'missing' },
  { id: 'coordinate_list',       order: 3, label: 'Final Coordinate List',       required: true,  status: 'missing' },
  { id: 'working_diagram',       order: 4, label: 'Working Diagram',             required: true,  status: 'missing' },
  { id: 'theoretical_comps',     order: 5, label: 'Theoretical Computations',    required: true,  status: 'missing' },
  { id: 'rtk_result',            order: 6, label: 'RTK / Field Result Bundle',   required: false, status: 'missing' },
  { id: 'consistency_checks',    order: 7, label: 'Consistency Checks',          required: true,  status: 'missing' },
  { id: 'area_computations',     order: 8, label: 'Area Computations',           required: true,  status: 'missing' },
]

export interface SurveyorProfile {
  id: string
  user_id: string
  full_name: string
  registration_number: string   // e.g. "RS149" — used in submission number
  firm_name?: string
  seal_url?: string             // Supabase storage path to seal image
  signature_url?: string
}

export interface AttachmentSlot {
  id: string
  label: string
  required: boolean
  accepts: string[]    // MIME types
  maxSizeMB: number
  helpText: string
}

export const BOUNDARY_ATTACHMENT_SLOTS: AttachmentSlot[] = [
  {
    id: 'ppa2',
    label: 'Physical Planning Approval (PPA2)',
    required: true,
    accepts: ['application/pdf', 'image/jpeg', 'image/png'],
    maxSizeMB: 10,
    helpText: 'Approval from local authority for subdivision',
  },
  {
    id: 'lcb_consent',
    label: 'Land Control Board Consent',
    required: true,
    accepts: ['application/pdf'],
    maxSizeMB: 10,
    helpText: 'Required for subdivisions under the Land Control Act',
  },
  {
    id: 'mutation_form',
    label: 'Mutation Form / Subdivision Scheme',
    required: true,
    accepts: ['application/pdf', 'image/jpeg'],
    maxSizeMB: 20,
    helpText: 'Signed by landowner and registered surveyor',
  },
  {
    id: 'rtk_raw',
    label: 'RTK Raw Output',
    required: false,
    accepts: ['text/csv', 'text/plain', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/xml'],
    maxSizeMB: 50,
    helpText: 'Raw GNSS field data from RTK session',
  },
  {
    id: 'field_book_export',
    label: 'Digital Field Book Export',
    required: false,
    accepts: ['text/csv', '.fbk', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/xml'],
    maxSizeMB: 20,
    helpText: 'Exported from total station or GNSS instrument',
  },
]

export interface PackageValidation {
  ready: boolean
  blockers: string[]
  warnings: string[]
}

