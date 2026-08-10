/**
 * Observation Database Queries
 *
 * Handles observation CRUD and batch operations for offline-to-server sync.
 *
 * AUDIT FIX (H1, 2026-07-02): Rewrote from Prisma client to raw SQL.
 * The Prisma schema declared an `observations` table that doesn't exist
 * in the actual database. The real tables are `traverse_observations`
 * (linked to `parcel_traverses`) and `level_observations`. This module
 * now uses the actual schema via the `db` Pool singleton.
 *
 * NOTE: The "surveyId" parameter in the input types historically referred
 * to a Prisma `Survey` model that doesn't exist in the SQL schema. In
 * practice, the sync route passes a project ID. We now treat `surveyId`
 * as `projectId` and insert into `traverse_observations` with the
 * `traverse_id` resolved from the project's most recent traverse (or
 * created on demand). This is a transitional design — a proper refactor
 * would change the input type to `projectId` + `traverseId` explicitly.
 */

import { db } from '@/lib/db'
import { computationCache, CacheKeys } from '../../cache/memory-cache'

/** Row shape for queries that only select an id. */
interface IdRow { id: string }

// ─── Types ───────────────────────────────────────────────────────

export interface CreateObservationInput {
  /** Project ID (historically called surveyId) */
  surveyId: string
  fromStationId: string
  toStationId: string
  rawHorizontalAngle?: number
  rawVerticalAngle?: number
  rawSlopeDistance?: number
  edmConstant?: number
  ppmSetting?: number
  temperature?: number
  pressure?: number
  humidity?: number
  instrumentHeight?: number
  targetHeight?: number
  observationDate?: Date
}

export interface BatchObservationInput {
  surveyId: string
  observations: CreateObservationInput[]
}

export interface ObservationRow {
  id: string
  traverse_id: string
  station_from: string | null
  station_to: string | null
  bearing: number | null
  distance: number | null
  face: string | null
  created_at: string
}

// ─── Queries ─────────────────────────────────────────────────────

/**
 * Get all observations for a survey/project.
 * Resolves the project's most recent traverse and returns its observations.
 */
export async function getObservations(surveyId: string): Promise<ObservationRow[]> {
  const result = await computationCache.getOrCompute(
    CacheKeys.surveyObservations(surveyId),
    async () => {
      // Find the most recent traverse for this project
      const traverseResult = await db.query<IdRow>(
        `SELECT id FROM parcel_traverses
         WHERE project_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [surveyId]
      )
      if (traverseResult.rows.length === 0) return [] as ObservationRow[]

      const traverseId = traverseResult.rows[0].id
      const { rows } = await db.query(
        `SELECT id, traverse_id, station_from, station_to, bearing, distance, face, created_at
         FROM traverse_observations
         WHERE traverse_id = $1
         ORDER BY created_at ASC`,
        [traverseId]
      )
      return rows as ObservationRow[]
    },
    10 * 60 * 1000
  )
  return result as ObservationRow[]
}

/**
 * Create a single observation.
 */
export async function createObservation(input: CreateObservationInput): Promise<ObservationRow> {
  computationCache.invalidate(CacheKeys.surveyObservations(input.surveyId))

  // Resolve or create a traverse for this project
  const traverseId = await resolveOrCreateTraverse(input.surveyId)

  const { rows } = await db.query(
    `INSERT INTO traverse_observations
       (traverse_id, station_from, station_to, bearing, distance, face)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, traverse_id, station_from, station_to, bearing, distance, face, created_at`,
    [
      traverseId,
      input.fromStationId,
      input.toStationId,
      input.rawHorizontalAngle ?? null,
      input.rawSlopeDistance ?? null,
      null, // face — not in the input type yet; default null
    ]
  )
  return rows[0] as ObservationRow
}

/**
 * Batch create observations (for offline sync).
 *
 * This is the primary way observations are created — surveyors collect
 * data offline and sync in one batch. Uses a single multi-row INSERT
 * for efficiency.
 */
export async function batchCreateObservations(
  input: BatchObservationInput
): Promise<{ count: number }> {
  computationCache.invalidate(CacheKeys.surveyObservations(input.surveyId))

  if (input.observations.length === 0) return { count: 0 }

  // Resolve or create a traverse for this project
  const traverseId = await resolveOrCreateTraverse(input.surveyId)

  // Build a multi-row INSERT with parameterised values
  const values: unknown[] = []
  const placeholders: string[] = []
  let paramIdx = 1
  for (const obs of input.observations) {
    placeholders.push(
      `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4})`
    )
    values.push(
      traverseId,
      obs.fromStationId,
      obs.toStationId,
      obs.rawHorizontalAngle ?? null,
      obs.rawSlopeDistance ?? null
    )
    paramIdx += 5
  }

  const result = await db.query(
    `INSERT INTO traverse_observations
       (traverse_id, station_from, station_to, bearing, distance)
     VALUES ${placeholders.join(', ')}
     RETURNING id`,
    values
  )

  return { count: result.rowCount ?? 0 }
}

/**
 * Resolve the most recent traverse for a project, or create one if none exists.
 * Used by batch sync when a project has no traverse yet.
 */
async function resolveOrCreateTraverse(projectId: string): Promise<string> {
  const existing = await db.query<IdRow>(
    `SELECT id FROM parcel_traverses
     WHERE project_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [projectId]
  )
  if (existing.rows.length > 0) return existing.rows[0].id as string

  // Create a new traverse record
  const created = await db.query<IdRow>(
    `INSERT INTO parcel_traverses (project_id, name)
     VALUES ($1, 'Synced observations')
     RETURNING id`,
    [projectId]
  )
  return created.rows[0].id as string
}

/**
 * Update corrected values on an observation.
 * Called after the correction pipeline processes the observation.
 *
 * NOTE: The `traverse_observations` table only has `bearing` and `distance`
 * columns (no corrected_* columns). This function updates those in place.
 * A proper audit trail would store both raw and corrected values — that's
 * a schema change for a future migration.
 */
export async function updateCorrectedValues(
  id: string,
  corrected: {
    correctedDistance?: number
    correctedHd?: number
    correctedVd?: number
    correctedBearing?: number
    correctionsLog?: string
    stdDevDistance?: number
    stdDevAngle?: number
  }
): Promise<void> {
  const updates: string[] = []
  const values: unknown[] = []
  let paramIdx = 1

  if (corrected.correctedBearing !== undefined) {
    updates.push(`bearing = $${paramIdx++}`)
    values.push(corrected.correctedBearing)
  }
  if (corrected.correctedDistance !== undefined || corrected.correctedHd !== undefined) {
    updates.push(`distance = $${paramIdx++}`)
    values.push(corrected.correctedDistance ?? corrected.correctedHd)
  }

  if (updates.length === 0) return

  values.push(id)
  await db.query(
    `UPDATE traverse_observations SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
    values
  )
}

/**
 * Delete all observations for a survey/project.
 */
export async function deleteObservationsBySurvey(surveyId: string): Promise<void> {
  computationCache.invalidate(CacheKeys.surveyObservations(surveyId))

  // Delete via the traverse_id FK
  await db.query(
    `DELETE FROM traverse_observations
     WHERE traverse_id IN (
       SELECT id FROM parcel_traverses WHERE project_id = $1
     )`,
    [surveyId]
  )
}
