/**
 * Ownership check helpers — IDOR protection.
 *
 * Shared utilities for verifying that a project belongs to the
 * requesting user. Used by API routes that take a project_id or
 * entity id parameter to prevent IDOR (Insecure Direct Object
 * Reference) attacks.
 *
 * Why this exists
 * ---------------
 * Migration 011 disabled PostgreSQL RLS, so authorization must
 * happen in the application layer. Before this helper, many routes
 * fetched project data by id without checking user_id — any
 * authenticated user could read or modify any other user's projects.
 *
 * Usage
 * -----
 *   import { requireProjectOwnership } from '@/lib/auth/ownership'
 *
 *   export const GET = apiHandler(
 *     { auth: true },
 *     async (req, ctx) => {
 *       const ownership = await requireProjectOwnership(ctx.params.id, ctx.userId)
 *       if (ownership.error) return ownership.error  // 403 or 404
 *       // ... route logic ...
 *     }
 *   )
 */

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export interface OwnershipResult {
  /** True if the user owns the project. If false, `error` is set. */
  ok: boolean
  /** Pre-built NextResponse (403 or 404) to return if ok is false. */
  error?: NextResponse
  /** The project's user_id (may be null for legacy projects). */
  projectUserId?: string | null
}

/**
 * Verify that the requesting user owns the project.
 *
 * Returns { ok: true } if the project exists and belongs to the user
 * (or has no user_id — legacy projects are accessible to all).
 * Returns { ok: false, error } with a 404 if the project doesn't exist,
 * or a 403 if it belongs to another user.
 *
 * Callers should return early on error:
 *   const own = await requireProjectOwnership(id, userId)
 *   if (!own.ok) return own.error!
 */
export async function requireProjectOwnership(
  projectId: string,
  userId: string | undefined | null
): Promise<OwnershipResult> {
  const result = await db.query(
    'SELECT user_id FROM projects WHERE id = $1',
    [projectId]
  )

  if (result.rows.length === 0) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: 'Project not found', code: 'NOT_FOUND' },
        { status: 404 }
      ),
    }
  }

  const projectUserId = result.rows[0].user_id as string | null

  // Legacy projects with no user_id are accessible to all authenticated users.
  // (Prevents lockout for data created before user_id was added.)
  if (projectUserId && userId && projectUserId !== userId) {
    return {
      ok: false,
      projectUserId,
      error: NextResponse.json(
        { error: 'Forbidden: project belongs to another user', code: 'FORBIDDEN' },
        { status: 403 }
      ),
    }
  }

  return { ok: true, projectUserId }
}

/**
 * Verify ownership of a survey point by walking up to its project.
 *
 * survey_points → projects (via project_id) → user_id
 *
 * Use this for routes like /api/survey-points/[id] that take a
 * resource id which belongs to a project indirectly.
 */
export async function requireSurveyPointOwnership(
  surveyPointId: string,
  userId: string | undefined | null
): Promise<OwnershipResult> {
  const result = await db.query(
    `SELECT p.user_id
     FROM survey_points sp
     JOIN projects p ON p.id = sp.project_id
     WHERE sp.id = $1`,
    [surveyPointId]
  )

  if (result.rows.length === 0) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: 'Survey point not found', code: 'NOT_FOUND' },
        { status: 404 }
      ),
    }
  }

  const projectUserId = result.rows[0].user_id as string | null

  if (projectUserId && userId && projectUserId !== userId) {
    return {
      ok: false,
      projectUserId,
      error: NextResponse.json(
        { error: 'Forbidden: resource belongs to another user', code: 'FORBIDDEN' },
        { status: 403 }
      ),
    }
  }

  return { ok: true, projectUserId }
}

/**
 * Verify ownership of a versioned entity by walking up to its project.
 *
 * entity_versions → projects (via project_id) → user_id
 *
 * Use this for /api/versions/[id]/* routes.
 */
export async function requireVersionOwnership(
  versionId: string,
  userId: string | undefined | null
): Promise<OwnershipResult> {
  const result = await db.query(
    `SELECT p.user_id
     FROM entity_versions ev
     LEFT JOIN projects p ON p.id = ev.project_id
     WHERE ev.id = $1`,
    [versionId]
  )

  if (result.rows.length === 0) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: 'Version not found', code: 'NOT_FOUND' },
        { status: 404 }
      ),
    }
  }

  const projectUserId = result.rows[0].user_id as string | null

  if (projectUserId && userId && projectUserId !== userId) {
    return {
      ok: false,
      projectUserId,
      error: NextResponse.json(
        { error: 'Forbidden: resource belongs to another user', code: 'FORBIDDEN' },
        { status: 403 }
      ),
    }
  }

  return { ok: true, projectUserId }
}
