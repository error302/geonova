// ============================================================
// Phase 25: Scheme / Large Project Types
// Cadastral subdivision scheme support (ward-level, adjudication, etc.)
// ============================================================

export type ProjectType = 'small' | 'medium' | 'scheme'

export type SchemeStatus =
  | 'planning'
  | 'field_in_progress'
  | 'computation'
  | 'plan_generation'
  | 'review'
  | 'submitted'
  | 'approved'

export type ParcelStatus =
  | 'pending'
  | 'field_complete'
  | 'computed'
  | 'plan_generated'
  | 'submitted'
  | 'approved'

export interface SchemeDetails {
  id: number
  project_id: number
  scheme_number: string | null
  county: string | null
  sub_county: string | null
  ward: string | null
  planned_parcels: number
  adjudication_section: string | null
  status: SchemeStatus
  created_at: string
  updated_at: string
}

export interface Block {
  id: number
  project_id: number
  block_number: string
  block_name: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export interface Parcel {
  id: number
  project_id: number
  block_id: number
  parcel_number: string
  lr_number_proposed: string | null
  lr_number_confirmed: string | null
  area_ha: number | null
  status: ParcelStatus
  assigned_surveyor: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateSchemeProjectInput {
  name: string
  location: string
  utm_zone: number
  hemisphere: string
  survey_type: string
  country?: string
  datum?: string
  client_name?: string
  surveyor_name?: string
  // Scheme-specific fields
  scheme_number?: string
  county?: string
  sub_county?: string
  ward?: string
  planned_parcels?: number
  adjudication_section?: string
}

export interface CreateSmallProjectInput {
  name: string
  location: string
  utm_zone: number
  hemisphere: string
  survey_type: string
  country?: string
  datum?: string
  client_name?: string
  surveyor_name?: string
}

export const SCHEME_STATUS_LABELS: Record<SchemeStatus, string> = {
  planning: 'Planning',
  field_in_progress: 'Field Work In Progress',
  computation: 'Computation',
  plan_generation: 'Plan Generation',
  review: 'Under Review',
  submitted: 'Submitted',
  approved: 'Approved',
}

export const PARCEL_STATUS_LABELS: Record<ParcelStatus, string> = {
  pending: 'Pending',
  field_complete: 'Field Complete',
  computed: 'Computed',
  plan_generated: 'Plan Generated',
  submitted: 'Submitted',
  approved: 'Approved',
}

export const PARCEL_STATUS_COLORS: Record<ParcelStatus, string> = {
  pending: 'bg-gray-100 text-gray-700 border-gray-200',
  field_complete: 'bg-blue-100 text-blue-700 border-blue-200',
  computed: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  plan_generated: 'bg-green-100 text-green-700 border-green-200',
  submitted: 'bg-purple-100 text-purple-700 border-purple-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}
