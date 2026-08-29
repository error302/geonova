import { db } from '@/lib/db'

/**
 * Project access verification (audit H-05, 2026-08-30).
 *
 * Central ownership/membership check for project-scoped resources. Every
 * route that reads or mutates data belonging to a project MUST call one of
 * these helpers before touching the resource. Six routes previously skipped
 * this check (IDOR cluster), reading or destroying other users' data by
 * simply knowing a UUID.
 */

export interface ProjectAccessResult {
  allowed: boolean
  /** true when the caller owns the project outright */
  isOwner: boolean
  /** member role when the caller is a member but not the owner */
  memberRole: string | null
}

/**
 * Verify the user owns the project or is an active member of it.
 */
export async function checkProjectAccess(
  userId: string,
  projectId: string
): Promise<ProjectAccessResult> {
  const { rows } = await db.query<{ user_id: string; member_role: string | null }>(
    `SELECT p.user_id, m.role AS member_role
       FROM projects p
       LEFT JOIN project_members m ON m.project_id = p.id AND m.user_id = $2
      WHERE p.id = $1
      LIMIT 1`,
    [projectId, userId]
  )
  if (rows.length === 0) {
    return { allowed: false, isOwner: false, memberRole: null }
  }
  const row = rows[0]
  if (row.user_id === userId) {
    return { allowed: true, isOwner: true, memberRole: null }
  }
  if (row.member_role) {
    return { allowed: true, isOwner: false, memberRole: row.member_role }
  }
  return { allowed: false, isOwner: false, memberRole: null }
}

/**
 * Verify the user OWNS the project (membership is not enough).
 */
export async function checkProjectOwnership(
  userId: string,
  projectId: string
): Promise<boolean> {
  const { rows } = await db.query<{ user_id: string }>(
    'SELECT user_id FROM projects WHERE id = $1 LIMIT 1',
    [projectId]
  )
  return rows.length > 0 && rows[0].user_id === userId
}

/**
 * Resolve project ownership for a versioned entity (audit H-05).
 *
 * Versioned entities are either the project row itself, a table with a
 * direct project_id, or a traverse child that reaches the project through
 * parcel_traverses. Returns the owning project's access result.
 */
export async function checkVersionedEntityAccess(
  userId: string,
  entityType: string,
  entityId: string
): Promise<ProjectAccessResult> {
  if (entityType === 'projects') {
    const { rows } = await db.query<{ user_id: string }>(
      'SELECT user_id FROM projects WHERE id = $1 LIMIT 1',
      [entityId]
    )
    if (rows.length === 0) return { allowed: false, isOwner: false, memberRole: null }
    return rows[0].user_id === userId
      ? { allowed: true, isOwner: true, memberRole: null }
      : { allowed: false, isOwner: false, memberRole: null }
  }

  if (entityType === 'traverse_observations') {
    const { rows } = await db.query<{ project_id: string }>(
      `SELECT pt.project_id
         FROM parcel_traverses pt
         JOIN traverse_observations e ON e.traverse_id = pt.id
        WHERE e.id = $1
        LIMIT 1`,
      [entityId]
    )
    if (rows.length === 0) return { allowed: false, isOwner: false, memberRole: null }
    return checkProjectAccess(userId, rows[0].project_id)
  }

  if (entityType === 'traverse_history') {
    const { rows } = await db.query<{ project_id: string }>(
      `SELECT pt.project_id
         FROM parcel_traverses pt
         JOIN traverse_history e ON e.parcel_traverse_id = pt.id
        WHERE e.id = $1
        LIMIT 1`,
      [entityId]
    )
    if (rows.length === 0) return { allowed: false, isOwner: false, memberRole: null }
    return checkProjectAccess(userId, rows[0].project_id)
  }

  // Everything else in VERSIONED_ENTITY_TYPES carries a direct project_id
  const { rows } = await db.query<{ project_id: string }>(
    `SELECT project_id FROM ${entityType} WHERE id = $1 LIMIT 1`,
    [entityId]
  )
  if (rows.length === 0) return { allowed: false, isOwner: false, memberRole: null }
  return checkProjectAccess(userId, rows[0].project_id)
}
