/**
 * Shared scheme parcel schemas — single source of truth for the cadastral
 * scheme parcel/block shapes that cross the client/server boundary.
 *
 * The client types (re-exported by src/types/scheme.ts) derive from these
 * schemas via `z.infer`, and the scheme API routes validate their responses
 * with the same schemas before returning — so the client parcel shape and the
 * server response can never drift apart. Deliberately free of any
 * `'use client'` directive so API routes (server) and scheme pages (client)
 * can both import it.
 *
 * Wire-shape notes (matching what the Postgres driver + NextResponse.json
 * actually produce):
 *   - UUID columns (id, project_id, block_id, assigned_surveyor) arrive as
 *     strings, not numbers — the old hand-written `number` ids were wrong.
 *   - NUMERIC columns (area_ha, planned_parcels) arrive as strings from pg;
 *     `z.coerce.number()` accepts both the raw string and the JSON number, so
 *     the server emits a real number and the client keeps `number`.
 *   - TIMESTAMPTZ columns are Date objects pre-serialization and ISO strings
 *     after; the timestamp schema accepts both and normalises to ISO.
 */
import { z } from 'zod'

export const schemeStatusSchema = z.enum([
  'planning',
  'field_in_progress',
  'computation',
  'plan_generation',
  'review',
  'submitted',
  'approved',
])

export const parcelStatusSchema = z.enum([
  'pending',
  'field_complete',
  'computed',
  'plan_generated',
  'submitted',
  'approved',
])

const idSchema = z.string().min(1)

/** Accepts a pg Date or an ISO string; normalises to an ISO string. */
const isoTimestampSchema = z
  .union([z.date(), z.string()])
  .transform((v) => (v instanceof Date ? v.toISOString() : v))

export const parcelSchema = z.object({
  id: idSchema,
  project_id: idSchema,
  block_id: idSchema,
  parcel_number: z.string(),
  lr_number_proposed: z.string().nullable(),
  lr_number_confirmed: z.string().nullable(),
  area_ha: z.coerce.number().nullable(),
  status: parcelStatusSchema,
  assigned_surveyor: idSchema.nullable(),
  notes: z.string().nullable(),
  created_at: isoTimestampSchema,
  updated_at: isoTimestampSchema,
})

/** A parcel row joined with its block name — the GET /scheme/parcels shape. */
export const parcelWithBlockSchema = parcelSchema.extend({
  block_number: z.string(),
  block_name: z.string().nullable(),
})

export const blockSchema = z.object({
  id: idSchema,
  project_id: idSchema,
  block_number: z.string(),
  block_name: z.string().nullable(),
  description: z.string().nullable(),
  created_at: isoTimestampSchema,
  updated_at: isoTimestampSchema,
})

export const schemeDetailsSchema = z.object({
  id: idSchema,
  project_id: idSchema,
  scheme_number: z.string().nullable(),
  county: z.string().nullable(),
  sub_county: z.string().nullable(),
  ward: z.string().nullable(),
  planned_parcels: z.coerce.number(),
  adjudication_section: z.string().nullable(),
  status: schemeStatusSchema,
  created_at: isoTimestampSchema,
  updated_at: isoTimestampSchema,
})

/** Response wrappers — the `{ data: ... }` envelope the routes emit. */
export const parcelResponseSchema = z.object({ data: parcelSchema })
export const parcelListResponseSchema = z.object({ data: z.array(parcelSchema) })
export const parcelWithBlockListResponseSchema = z.object({ data: z.array(parcelWithBlockSchema) })

export type Parcel = z.infer<typeof parcelSchema>
export type ParcelWithBlock = z.infer<typeof parcelWithBlockSchema>
export type Block = z.infer<typeof blockSchema>
export type SchemeDetails = z.infer<typeof schemeDetailsSchema>
export type ParcelStatus = z.infer<typeof parcelStatusSchema>
export type SchemeStatus = z.infer<typeof schemeStatusSchema>
