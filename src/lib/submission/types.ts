import type { GNSSObservationReport } from './gnssObservationReport'

export type SubmissionStatus =
  | 'draft'
  | 'qa_failed'
  | 'qa_passed'
  | 'submitted'
  | 'approved'

export type SurveySubtype =
  // Extended per-method subtypes (validateSubmission's SUBTYPE_TO_SURVEY_TYPE).
  | 'cadastral_subdivision'
  | 'cadastral_amalgamation'
  | 'cadastral_resurvey'
  | 'cadastral_mutation'
  | 'topographic_site'
  | 'topographic_corridor'
  | 'engineering_road'
  | 'engineering_bridge'
  | 'engineering_dam'
  | 'geodetic_control'
  | 'mining'
  | 'hydrographic'
  | 'drone'
  | 'deformation'
  // Raw project survey types — assembleSubmission sources subtype directly
  // from projects.survey_type, so these are valid runtime values too.
  | 'cadastral'
  | 'engineering'
  | 'topographic'
  | 'geodetic'
  | 'drone'
  | 'deformation'

export interface SubmissionSurveyorIdentity {
  registrationNumber: string
  iskNumber: string
  verifiedIsk: boolean
  fullName: string
  firmName: string
  isKMemberActive: boolean
}

export interface SubmissionPoint {
  pointName: string
  easting: number
  northing: number
  adjustedEasting: number
  adjustedNorthing: number
  observedBearing: number
  observedDistance: number
}

export interface TraverseResult {
  points: SubmissionPoint[]
  angularMisclosure: number
  linearMisclosure: number
  precisionRatio: string
  closingErrorE: number
  closingErrorN: number
  adjustmentMethod: 'bowditch' | 'transit'
  areaM2: number
  perimeterM: number
}

export interface ParcelDetails {
  lrNumber: string
  parcelNumber: string
  county: string
  division: string
  district: string
  locality: string
  areaM2: number
  perimeterM: number
  clientName?: string
}

export interface SupportingDocument {
  type: 'ppa2' | 'lcb_consent' | 'mutation_form' | 'beacon_cert'
  label: string
  required: boolean
  fileUrl: string | null
  uploadedAt: string | null
}

export interface SubmissionPackage {
  submissionRef: string
  projectId: string
  surveyor: SubmissionSurveyorIdentity
  subtype: SurveySubtype
  parcel: ParcelDetails
  traverse: TraverseResult
  supportingDocs: SupportingDocument[]
  generatedAt: string
  revision: number
  // Grid-to-ground correction
  scaleFactor?: number
  meanElevation?: number
  // SRVY2025-1 submission
  controlClass?: 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH'
  // Stored GNSS observation report (if saved via /api/submission/gnss-observation-report).
  // The QA gate blocks assembly on a FAILED session unless an override reason is given.
  gnss?: GNSSObservationReport | null
}

export interface QAGateResult {
  passed: boolean
  blockers: QABlocker[]
  warnings: QAWarning[]
}

export interface QABlocker {
  code: string
  message: string
  field?: string
}

export interface QAWarning {
  code: string
  message: string
}
