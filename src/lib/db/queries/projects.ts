/**
 * Project Database Queries
 *
 * All project-related database operations with cache integration.
 *
 * AUDIT FIX (H1, 2026-07-02): Rewrote from Prisma client to raw SQL.
 * The Prisma schema declared a `Project` model with camelCase fields
 * (surveyorLicense, surveyType, etc.) that don't exist in the actual
 * `projects` table (which uses snake_case: no surveyor_license column,
 * survey_type as VARCHAR, user_id as the owner FK). Now uses the real
 * schema. Surveyor info comes from the `users` + `surveyor_profiles`
 * tables, not from project columns.
 */

import { db } from '@/lib/db'
import { projectCache, CacheKeys } from '../../cache/memory-cache'

// ─── Types ───────────────────────────────────────────────────────

export interface CreateProjectInput {
  name: string
  description?: string
  surveyType?: string
  surveyOrder?: number
  county?: string
  subCounty?: string
  lrNumber?: string
  datum?: string
  projection?: string
  zone?: number
  surveyorName: string
  surveyorLicense: string
}

// ─── Queries ─────────────────────────────────────────────────────

/**
 * Get a project by ID (with caching).
 */
export async function getProject(id: string) {
  return projectCache.getOrCompute(
    CacheKeys.project(id),
    async () => {
      const { rows } = await db.query(
        `SELECT p.*,
                u.full_name AS owner_name,
                u.email AS owner_email,
                sp.firm_name,
                sp.license_number AS surveyor_license
         FROM projects p
         LEFT JOIN users u ON u.id = p.user_id
         LEFT JOIN surveyor_profiles sp ON sp.user_id = p.user_id
         WHERE p.id = $1`,
        [id]
      )
      return rows[0] ?? null
    },
    5 * 60 * 1000 // 5 min TTL
  )
}

/**
 * List projects for a surveyor (with caching).
 *
 * NOTE: The Prisma version filtered by `surveyorLicense` on the project
 * row. The real schema has no such column — projects are owned by a
 * user (user_id FK), and the surveyor's license is on surveyor_profiles.
 * This version joins through user_id → surveyor_profiles.license_number.
 */
export async function listProjects(
  surveyorLicense: string,
  page: number = 1,
  pageSize: number = 20
) {
  return projectCache.getOrCompute(
    CacheKeys.projectList(surveyorLicense, page),
    async () => {
      const offset = (page - 1) * pageSize
      const [projectsResult, countResult] = await Promise.all([
        db.query(
          `SELECT p.*, u.full_name AS owner_name
           FROM projects p
           JOIN surveyor_profiles sp ON sp.user_id = p.user_id
           LEFT JOIN users u ON u.id = p.user_id
           WHERE sp.license_number = $1
           ORDER BY p.updated_at DESC
           LIMIT $2 OFFSET $3`,
          [surveyorLicense, pageSize, offset]
        ),
        db.query<{ total: number }>(
          `SELECT COUNT(*)::INTEGER AS total
           FROM projects p
           JOIN surveyor_profiles sp ON sp.user_id = p.user_id
           WHERE sp.license_number = $1`,
          [surveyorLicense]
        ),
      ])
      return {
        projects: projectsResult.rows,
        total: countResult.rows[0]?.total ?? 0,
        page,
        pageSize,
      }
    },
    2 * 60 * 1000 // 2 min TTL
  )
}

/**
 * Create a new project.
 *
 * NOTE: The input type includes surveyorName + surveyorLicense for
 * backward compat with callers, but the real `projects` table has no
 * such columns. We resolve the user_id from surveyor_profiles.license_number
 * and store the project under that user. If no matching surveyor is
 * found, the project is created without an owner (user_id = NULL) and
 * a warning is logged.
 */
export async function createProject(input: CreateProjectInput) {
  // Resolve user_id from surveyor license
  const surveyorResult = await db.query<{ user_id: string }>(
    `SELECT user_id FROM surveyor_profiles WHERE license_number = $1`,
    [input.surveyorLicense]
  )
  const userId = surveyorResult.rows[0]?.user_id ?? null

  if (!userId) {
    console.warn(
      `[createProject] No surveyor found with license "${input.surveyorLicense}". ` +
        `Project will be created without an owner.`
    )
  }

  const { rows } = await db.query(
    `INSERT INTO projects
       (name, survey_type, client_name, lr_number, locality,
        utm_zone, hemisphere, datum, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.name,
      input.surveyType ?? 'CADASTRAL',
      input.surveyorName, // stored in client_name (closest column)
      input.lrNumber ?? null,
      input.county ?? null,
      input.zone ?? 37,
      'S',
      input.datum ?? 'Arc 1960',
      userId,
    ]
  )

  // Invalidate project list cache
  projectCache.invalidatePattern(`projects:${input.surveyorLicense}:`)

  return rows[0]
}

/**
 * Update a project.
 */
export async function updateProject(
  id: string,
  data: Partial<CreateProjectInput> & { status?: string }
) {
  const updates: string[] = []
  const values: unknown[] = []
  let paramIdx = 1

  // Map input fields to actual columns
  if (data.name !== undefined) {
    updates.push(`name = $${paramIdx++}`)
    values.push(data.name)
  }
  if (data.surveyType !== undefined) {
    updates.push(`survey_type = $${paramIdx++}`)
    values.push(data.surveyType)
  }
  if (data.lrNumber !== undefined) {
    updates.push(`lr_number = $${paramIdx++}`)
    values.push(data.lrNumber)
  }
  if (data.county !== undefined) {
    updates.push(`locality = $${paramIdx++}`)
    values.push(data.county)
  }
  if (data.zone !== undefined) {
    updates.push(`utm_zone = $${paramIdx++}`)
    values.push(data.zone)
  }
  if (data.datum !== undefined) {
    updates.push(`datum = $${paramIdx++}`)
    values.push(data.datum)
  }

  if (updates.length === 0) {
    // Nothing to update — return current row
    const { rows } = await db.query(`SELECT * FROM projects WHERE id = $1`, [id])
    return rows[0] ?? null
  }

  updates.push(`updated_at = NOW()`)
  values.push(id)

  const { rows } = await db.query(
    `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    values
  )

  // Invalidate cache
  projectCache.invalidate(CacheKeys.project(id))

  return rows[0] ?? null
}

/**
 * Delete a project and all related data.
 */
export async function deleteProject(id: string) {
  const { rows } = await db.query(
    `DELETE FROM projects WHERE id = $1 RETURNING user_id`,
    [id]
  )

  if (rows.length > 0) {
    // Invalidate cache
    projectCache.invalidate(CacheKeys.project(id))
    // We don't have surveyorLicense here; invalidate all project list caches
    projectCache.invalidatePattern(`projects:`)
  }

  return rows[0] ?? null
}
