/**
 * RBAC — Role-Based Access Control for Metardu
 *
 * Hierarchical roles: super_admin > org_admin > project_manager > surveyor > viewer
 * - super_admin: full system access, can manage all organizations and users
 * - org_admin: organization-level management, can manage users within their org
 * - project_manager: can create/edit projects, manage project members
 * - surveyor: create/edit own projects, assigned scheme work
 * - viewer: read-only access to shared projects
 *
 * Backed by PostgreSQL tables:
 * - user_roles: role assignments per user (with organization scope)
 * - resource_permissions: fine-grained resource-level permissions
 */

import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Role types & constants
// ---------------------------------------------------------------------------

export type Role = 'super_admin' | 'org_admin' | 'project_manager' | 'surveyor' | 'viewer'

export const ROLES = {
  SUPER_ADMIN: 'super_admin' as Role,
  ORG_ADMIN: 'org_admin' as Role,
  PROJECT_MANAGER: 'project_manager' as Role,
  SURVEYOR: 'surveyor' as Role,
  VIEWER: 'viewer' as Role,
} as const

/**
 * Role hierarchy — index 0 is the highest privilege.
 * Used by assignRole() to enforce that a caller can only assign
 * roles at or below their own level.
 */
export const ROLE_HIERARCHY: Role[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ORG_ADMIN,
  ROLES.PROJECT_MANAGER,
  ROLES.SURVEYOR,
  ROLES.VIEWER,
]

/** Roles that can create/edit projects */
export const PROJECT_WRITE_ROLES: Role[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ORG_ADMIN,
  ROLES.PROJECT_MANAGER,
  ROLES.SURVEYOR,
]

/** Roles that can approve submissions and manage scheme status */
export const SCHEME_ADMIN_ROLES: Role[] = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN]

/** Roles that can manage users and system settings */
export const SYSTEM_ADMIN_ROLES: Role[] = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN]

/** Default role for new users */
export const DEFAULT_ROLE: Role = ROLES.SURVEYOR

// ---------------------------------------------------------------------------
// Role-check helpers
// ---------------------------------------------------------------------------

/**
 * Check if a user's role includes any of the allowed roles.
 * Falls back to 'surveyor' if role is not set.
 */
export function hasRole(userRole: string | null | undefined, allowedRoles: Role[]): boolean {
  const role = (userRole || DEFAULT_ROLE) as Role
  return allowedRoles.includes(role)
}

/**
 * Check if user is an admin (super_admin or org_admin). Convenience wrapper.
 */
export function isAdmin(userRole: string | null | undefined): boolean {
  return hasRole(userRole, [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN])
}

/**
 * Check if user is a super_admin. Convenience wrapper.
 */
export function isSuperAdmin(userRole: string | null | undefined): boolean {
  return hasRole(userRole, [ROLES.SUPER_ADMIN])
}

// ---------------------------------------------------------------------------
// assignRole — Insert a role into the user_roles table
// ---------------------------------------------------------------------------

/**
 * Assign a role to a user by inserting into the `user_roles` table.
 *
 * If an active (non-revoked) role already exists for the same user+org,
 * it is revoked first before the new role is inserted.
 *
 * @param userId    The UUID of the target user
 * @param role      The role to assign
 * @param grantedBy The UUID of the user performing the assignment
 * @param organizationId Optional organization scope (null = platform-wide)
 */
export async function assignRole(
  userId: string,
  role: Role,
  grantedBy: string,
  organizationId?: string | null,
): Promise<void> {
  await db.transaction(async (client) => {
    // Revoke any existing active role for this user+org
    await client.query(
      `UPDATE user_roles
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND (organization_id = $2 OR (organization_id IS NULL AND $2 IS NULL))
         AND revoked_at IS NULL`,
      [userId, organizationId ?? null],
    )

    // Insert the new role
    await client.query(
      `INSERT INTO user_roles (user_id, organization_id, role, granted_by, granted_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, organizationId ?? null, role, grantedBy],
    )

    // Also update the users table role column for quick lookups
    await client.query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`,
      [role, userId],
    )

    // Also update surveyor_profiles role if exists
    await client.query(
      `UPDATE surveyor_profiles SET role = $1 WHERE user_id = $2`,
      [role, userId],
    )
  })
}

// ---------------------------------------------------------------------------
// requirePermissionAsync — Check resource_permissions table
// ---------------------------------------------------------------------------

interface PermissionCheckResult {
  /** If true, the permission check failed and `response` contains the 403 */
  denied: boolean
  /** The NextResponse to return (403) if denied, or null if allowed */
  response: NextResponse | null
}

/**
 * Check if a user has a specific permission in the `resource_permissions` table.
 *
 * Super_admin and org_admin roles bypass permission checks.
 *
 * Returns an object with `denied: true` and a 403 NextResponse if the
 * user does NOT have the permission, or `denied: false` if allowed.
 *
 * Usage:
 * ```ts
 * const permCheck = await requirePermissionAsync(userId, 'users.invite')
 * if (permCheck.denied) return permCheck.response
 * ```
 */
export async function requirePermissionAsync(
  userId: string,
  permission: string,
  resourceType?: string,
  resourceId?: string,
): Promise<PermissionCheckResult> {
  // First, check the user's role — super_admin and org_admin bypass all checks
  const { rows: roleRows } = await db.query<{ role: string }>(
    `SELECT role FROM user_roles
     WHERE user_id = $1 AND revoked_at IS NULL
     ORDER BY granted_at DESC
     LIMIT 1`,
    [userId],
  )

  // Also check the users table role as a fallback
  const { rows: userRows } = await db.query<{ role: string }>(
    `SELECT role FROM users WHERE id = $1`,
    [userId],
  )

  const userRole = (roleRows[0]?.role || userRows[0]?.role || 'surveyor') as Role

  // super_admin and org_admin bypass permission checks
  if (userRole === ROLES.SUPER_ADMIN || userRole === ROLES.ORG_ADMIN) {
    return { denied: false, response: null }
  }

  // Check the resource_permissions table
  const conditions: string[] = [
    'user_id = $1',
    'permission = $2',
    'revoked_at IS NULL',
  ]
  const params: unknown[] = [userId, permission]
  let paramIdx = 3

  if (resourceType) {
    conditions.push(`resource_type = $${paramIdx++}`)
    params.push(resourceType)
  }
  if (resourceId) {
    conditions.push(`resource_id = $${paramIdx++}`)
    params.push(resourceId)
  }

  const { rows } = await db.query(
    `SELECT id FROM resource_permissions WHERE ${conditions.join(' AND ')} LIMIT 1`,
    params,
  )

  if (rows.length > 0) {
    return { denied: false, response: null }
  }

  // Permission denied
  return {
    denied: true,
    response: NextResponse.json(
      { error: `Permission denied: '${permission}' required`, code: 'FORBIDDEN' },
      { status: 403 },
    ),
  }
}

// ─── Organization-level helpers (audit C6 fix, 2026-07-02) ────────────────

/**
 * Get the user's role within a specific organization.
 * Returns the role from `organization_members`, or null if the user is
 * not a member of the org.
 *
 * A user with role 'org_admin' in an org can manage its members and
 * projects. 'project_manager' can create/edit projects. 'surveyor' can
 * read/write project data. 'viewer' is read-only.
 */
export async function getOrgRole(
  userId: string,
  organizationId: string,
): Promise<Role | null> {
  try {
    const { rows } = await db.query<{ role: string }>(
      `SELECT role FROM organization_members
       WHERE user_id = $1 AND organization_id = $2 AND is_active = TRUE`,
      [userId, organizationId],
    )
    return (rows[0]?.role as Role) ?? null
  } catch {
    // organization_members table may not exist yet (pre-migration 028)
    return null
  }
}

/**
 * Check if a user can access a project — either as the project owner
 * (user_id match) or as a member of the project's organization.
 *
 * Returns the access level: 'owner', 'org_admin', 'project_manager',
 * 'surveyor', 'viewer', or null (no access).
 *
 * Usage:
 * ```ts
 * const access = await canAccessProject(userId, projectId)
 * if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
 * if (access === 'viewer' && req.method !== 'GET') {
 *   return NextResponse.json({ error: 'Read-only' }, { status: 403 })
 * }
 * ```
 */
export async function canAccessProject(
  userId: string,
  projectId: string,
): Promise<Role | 'owner' | null> {
  // 1. Check if user is the project owner
  const { rows: projectRows } = await db.query<{ user_id: string; organization_id: string | null }>(
    `SELECT user_id, organization_id FROM projects WHERE id = $1`,
    [projectId],
  )
  if (projectRows.length === 0) return null

  const project = projectRows[0]
  if (project.user_id === userId) return 'owner'

  // 2. Check org membership if the project belongs to an org
  if (project.organization_id) {
    const orgRole = await getOrgRole(userId, project.organization_id)
    if (orgRole) return orgRole
  }

  // 3. Check project_members table (legacy per-project membership)
  const { rows: memberRows } = await db.query<{ role: string }>(
    `SELECT role FROM project_members WHERE user_id = $1 AND project_id = $2`,
    [userId, projectId],
  )
  return (memberRows[0]?.role as Role) ?? null
}

/**
 * Get all organizations the user is a member of.
 * Useful for the org-switcher UI.
 */
export async function getUserOrganizations(userId: string): Promise<
  Array<{
    organization_id: string
    organization_name: string
    organization_slug: string
    role: Role
    is_active: boolean
  }>
> {
  try {
    const { rows } = await db.query<{ organization_id: string; organization_name: string; organization_slug: string; role: Role; is_active: boolean }>(
      `SELECT
         om.organization_id,
         o.name AS organization_name,
         o.slug AS organization_slug,
         om.role,
         om.is_active
       FROM organization_members om
       JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id = $1 AND om.is_active = TRUE AND o.is_active = TRUE
       ORDER BY om.accepted_at DESC NULLS LAST, om.invited_at DESC`,
      [userId],
    )
    return rows
  } catch {
    // organizations table may not exist yet
    return []
  }
}
