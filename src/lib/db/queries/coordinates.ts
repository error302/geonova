/**
 * Coordinate Database Queries
 *
 * AUDIT FIX (H1, 2026-07-02): Rewrote from Prisma client to raw SQL.
 * The Prisma schema declared a `Coordinate` model with camelCase fields
 * and a relation to a `Station` model — neither exists in the actual
 * database. Coordinates are stored in `survey_points` (with CRS/
 * accuracy/provenance columns added by migration 027) and
 * `traverse_coordinates` (for adjusted traverse stations).
 *
 * This module now writes to `survey_points` using the real schema.
 * The `surveyId` parameter is treated as `projectId` (the Prisma
 * `Survey` model didn't exist in SQL).
 */

import { db } from '@/lib/db'
import { computationCache, CacheKeys } from '../../cache/memory-cache'

/** Row shape for queries that only select an id. */
interface IdRow { id: string }

// ─── Types ───────────────────────────────────────────────────────

export interface CreateCoordinateInput {
  /** Project ID (historically called surveyId) */
  surveyId: string
  stationId: string
  easting: number
  northing: number
  elevation?: number
  datum?: string
  projection?: string
  zone?: number
  stdDevEasting?: number
  stdDevNorthing?: number
  stdDevElevation?: number
  errorEllipseSemiMajor?: number
  errorEllipseSemiMinor?: number
  errorEllipseOrientation?: number
  confidenceLevel?: number
  pointScaleFactor?: number
  gridConvergence?: number
  isFixed?: boolean
}

// ─── Queries ─────────────────────────────────────────────────────

/**
 * Get all coordinates (survey_points) for a survey/project.
 */
export async function getCoordinates(surveyId: string) {
  return computationCache.getOrCompute(
    CacheKeys.surveyCoordinates(surveyId),
    async () => {
      const { rows } = await db.query(
        `SELECT id, point_name, easting, northing, elevation,
                datum, projection, utm_zone, hemisphere,
                std_dev_e, std_dev_n, std_dev_z,
                error_ellipse_major, error_ellipse_minor, error_ellipse_orient,
                confidence_level, is_control, source, observation_date,
                created_at, updated_at
         FROM survey_points
         WHERE project_id = $1
           AND easting IS NOT NULL
           AND northing IS NOT NULL
         ORDER BY point_name ASC`,
        [surveyId]
      )
      return rows
    },
    30 * 60 * 1000
  )
}

/**
 * Create or update a coordinate (survey_point).
 * Uses upsert on (project_id, point_name) to handle re-computation gracefully.
 */
export async function upsertCoordinate(input: CreateCoordinateInput) {
  computationCache.invalidate(CacheKeys.surveyCoordinates(input.surveyId))

  // Try to find an existing point with the same name in this project
  const existing = await db.query<IdRow>(
    `SELECT id FROM survey_points
     WHERE project_id = $1 AND point_name = $2`,
    [input.surveyId, input.stationId]
  )

  if (existing.rows.length > 0) {
    // Update existing point
    const id = existing.rows[0].id
    await db.query(
      `UPDATE survey_points SET
         easting = $1,
         northing = $2,
         elevation = $3,
         datum = COALESCE($4, datum),
         utm_zone = COALESCE($5, utm_zone),
         std_dev_e = $6,
         std_dev_n = $7,
         std_dev_z = $8,
         error_ellipse_major = $9,
         error_ellipse_minor = $10,
         error_ellipse_orient = $11,
         confidence_level = COALESCE($12, confidence_level),
         source = 'adjusted',
         updated_at = NOW()
       WHERE id = $13`,
      [
        input.easting,
        input.northing,
        input.elevation ?? null,
        input.datum ?? null,
        input.zone ?? null,
        input.stdDevEasting ?? null,
        input.stdDevNorthing ?? null,
        input.stdDevElevation ?? null,
        input.errorEllipseSemiMajor ?? null,
        input.errorEllipseSemiMinor ?? null,
        input.errorEllipseOrientation ?? null,
        input.confidenceLevel ?? null,
        id,
      ]
    )
    return { id, updated: true }
  }

  // Insert new point
  const { rows } = await db.query<IdRow>(
    `INSERT INTO survey_points
       (project_id, point_name, easting, northing, elevation,
        datum, projection, utm_zone,
        std_dev_e, std_dev_n, std_dev_z,
        error_ellipse_major, error_ellipse_minor, error_ellipse_orient,
        confidence_level, is_control, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'adjusted')
     RETURNING id`,
    [
      input.surveyId,
      input.stationId,
      input.easting,
      input.northing,
      input.elevation ?? null,
      input.datum ?? null,
      input.projection ?? 'UTM',
      input.zone ?? null,
      input.stdDevEasting ?? null,
      input.stdDevNorthing ?? null,
      input.stdDevElevation ?? null,
      input.errorEllipseSemiMajor ?? null,
      input.errorEllipseSemiMinor ?? null,
      input.errorEllipseOrientation ?? null,
      input.confidenceLevel ?? 95,
      input.isFixed ?? false,
    ]
  )
  return { id: rows[0].id, updated: false }
}

/**
 * Batch upsert coordinates (after traverse adjustment).
 * Uses a transaction for atomic batch operation.
 */
export async function batchUpsertCoordinates(coords: CreateCoordinateInput[]) {
  // Invalidate all relevant caches
  const surveyIds = new Set(coords.map(c => c.surveyId))
  for (const id of surveyIds) {
    computationCache.invalidate(CacheKeys.surveyCoordinates(id))
  }

  await db.transaction(async (client) => {
    for (const coord of coords) {
      // Reuse the upsert logic but within the transaction
      const existing = await client.query<IdRow>(
        `SELECT id FROM survey_points
         WHERE project_id = $1 AND point_name = $2`,
        [coord.surveyId, coord.stationId]
      )

      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE survey_points SET
             easting = $1, northing = $2, elevation = $3,
             std_dev_e = $4, std_dev_n = $5, std_dev_z = $6,
             error_ellipse_major = $7, error_ellipse_minor = $8,
             error_ellipse_orient = $9,
             source = 'adjusted', updated_at = NOW()
           WHERE id = $10`,
          [
            coord.easting,
            coord.northing,
            coord.elevation ?? null,
            coord.stdDevEasting ?? null,
            coord.stdDevNorthing ?? null,
            coord.stdDevElevation ?? null,
            coord.errorEllipseSemiMajor ?? null,
            coord.errorEllipseSemiMinor ?? null,
            coord.errorEllipseOrientation ?? null,
            existing.rows[0].id,
          ]
        )
      } else {
        await client.query(
          `INSERT INTO survey_points
             (project_id, point_name, easting, northing, elevation,
              datum, utm_zone, is_control, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'adjusted')`,
          [
            coord.surveyId,
            coord.stationId,
            coord.easting,
            coord.northing,
            coord.elevation ?? null,
            coord.datum ?? null,
            coord.zone ?? null,
            coord.isFixed ?? false,
          ]
        )
      }
    }
  })
}
