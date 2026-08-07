// ============================================================
// Phase 25: Scheme / Large Project Types
// Cadastral subdivision scheme support (ward-level, adjudication, etc.)
//
// The wire-crossing shapes (Parcel, Block, SchemeDetails, status unions)
// now derive from the shared zod schemas in @/lib/validation/scheme — the
// scheme API routes validate their responses with the same schemas, so the
// client types and the server responses cannot drift. This module keeps the
// UI-only constants (labels/colors) and the request-input interfaces.
// ============================================================

import type { ParcelStatus, SchemeStatus } from '@/lib/validation/scheme'

export type {
  Block,
  Parcel,
  ParcelStatus,
  SchemeDetails,
  SchemeStatus,
} from '@/lib/validation/scheme'

export type ProjectType = 'small' | 'medium' | 'scheme'

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
