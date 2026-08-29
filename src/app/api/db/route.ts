export const dynamic = 'force-dynamic'

/**
 * /api/db — Database proxy for client-side queries
 *
 * Client components send query specs here, this route executes them
 * against the VM PostgreSQL. Auth is verified via NextAuth session.
 *
 * SECURITY:
 * - Table whitelist prevents arbitrary table access
 * - User-scoped tables automatically filter by session user_id
 * - Admin-only tables restricted to ADMIN_EMAILS
 * - Rate-limited to prevent abuse
 * - Parameterized queries prevent SQL injection
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiHandler } from '@/lib/apiHandler'
import { setCurrentUserId } from '@/lib/db'
import { getPool } from '@/lib/db'
import { QueryBuilder } from '@/lib/db/queryBuilder'
import { checkProjectAccess } from '@/lib/security/projectAccess'
import { env } from '@/lib/env'

// ponytail: Phase 6 Batch 7 — typed request body for /api/db proxy.
// Browser client posts this shape; server-side narrowing guards each field.
interface DbFilter {
  op: string
  column: string
  value: unknown
}

interface DbOrderClause {
  column: string
  ascending: boolean
}

interface DbRequestBody {
  table?: string
  operation?: string
  columns?: string
  filters?: DbFilter[]
  orFilters?: string[]
  order?: DbOrderClause[]
  limit?: number
  offset?: number
  single?: boolean
  maybeSingle?: boolean
  count?: string
  head?: boolean
  payload?: Record<string, unknown> | Record<string, unknown>[]
  onConflict?: string
}

// Tables that can be queried without authentication
const PUBLIC_TABLES = new Set([
  'benchmarks', 'survey_standards', 'countries', 'professional_bodies',
])

// Tables that are scoped to the authenticated user's ID
const USER_SCOPED_TABLES = new Set([
  'projects', 'profiles',
  'project_members', 'user_subscriptions',
  'collaboration_sessions', 'cpd_activities', 'peer_reviews',
  'peer_review_payments', 'digital_signatures', 'cleaned_datasets',
  'cadastra_validations', 'mine_twins', 'workflows', 'bathymetric_surveys',
  'usv_missions', 'safety_incidents', 'geofusion_projects', 'geofusion_layers',
  'deed_plans', 'survey_reports', 'parcel_metadata', 'gnss_sessions',
  'signatures', 'equipment', 'equipment_calibrations', 'job_applications',
  'job_reviews', 'payment_history', 'render_jobs', 'project_submissions',
  'submission_documents', 'import_sessions', 'online_service_logs',
  'surveyor_profiles', 'plan_usage', 'field_projects',
  'scheme_details', 'blocks', 'parcel_traverses',
  'traverse_observations', 'traverse_coordinates', 'block_assignments',
  'scheme_activity_log',
  'survey_firms', 'raw_observations', 'control_points', 'road_centrelines',
  'levelling_observations', 'monitoring_epochs', 'data_audit',
  'fieldbooks', 'cpd_records', 'cpd_certificates', 'notifications',
])

// Tables scoped to project_id (not user_id).
// SECURITY (audit C-02, 2026-08-30): every access to these tables through
// this proxy now REQUIRES a project_id scope (eq filter on read/update/delete,
// payload field on insert/upsert) that is verified against project
// ownership/membership before the query is built.
const PROJECT_SCOPED_TABLES = new Set([
  'survey_points', 'parcels', 'alignments', 'cross_sections',
  'project_fieldbook_entries', 'survey_epochs', 'leveling_runs',
  'parcel_traverses', 'network_adjustments',
  'mining_surveys', 'hydro_surveys', 'gnss_sessions',
  'peer_review_requests', 'supporting_documents',
  'project_sheets', 'survey_photos',
])

// Tables that are read-only for all authenticated users
const READ_ONLY_SHARED_TABLES = new Set([
  'benchmarks', 'survey_standards', 'countries', 'professional_bodies',
  'land_law_cases', 'land_law_regulations', 'nlims_cache',
  'public_beacons',
])

// Tables accessible only by admins
const ADMIN_ONLY_TABLES = new Set([
  'audit_logs', 'analytics_events', 'rate_limit_events',
  'enterprise_organizations', 'enterprise_members', 'enterprise_invitations',
  'enterprise_settings',
])

// Public browse tables
const PUBLIC_BROWSE_TABLES = new Set([
  'jobs', 'job_missions', 'newsletter_subscribers', 'feedback',
  'survey_type_expand', 'community',
])

// Build the full allowlist from all sets
const ALLOWED_TABLES = new Set([
  ...Array.from(USER_SCOPED_TABLES),
  ...Array.from(PROJECT_SCOPED_TABLES),
  ...Array.from(READ_ONLY_SHARED_TABLES),
  ...Array.from(ADMIN_ONLY_TABLES),
  ...Array.from(PUBLIC_BROWSE_TABLES),
])

// NEVER allow these tables through the proxy
const FORBIDDEN_TABLES = new Set([
  'password_reset_tokens', 'users',
])

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const adminEmails = (env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())
  return adminEmails.includes(email.toLowerCase())
}

// Note: This route uses apiHandler({ auth: false }) because it has conditional auth
// (public tables don't need auth). We handle auth manually inside the handler
// and set RLS context ourselves when a session is found.
export const POST = apiHandler({ auth: false, rateLimit: { max: 120, windowMs: 60000 } }, async (request, ctx) => {
  const body = ctx.body as DbRequestBody
  const { table, operation, columns, filters, orFilters, order, limit, offset, single, maybeSingle, count, head, payload, onConflict } = body

  // ─── Table validation ─────────────────────────────────────────
  if (!table || FORBIDDEN_TABLES.has(table as string)) {
    return NextResponse.json(
      { data: null, error: { message: 'Access denied', code: 'FORBIDDEN' } },
      { status: 403 }
    )
  }

  if (!ALLOWED_TABLES.has(table as string)) {
    return NextResponse.json(
      { data: null, error: { message: `Table not allowed: ${table}`, code: 'FORBIDDEN' } },
      { status: 403 }
    )
  }

  // ─── Auth check ───────────────────────────────────────────────
  let userId: string | null = null
  let userEmail: string | null = null

  if (!PUBLIC_TABLES.has(table as string)) {
    // /api/db uses apiHandler({ auth: false }) for conditional auth, so
    // ctx.session is NOT populated by the wrapper. Fetch the session here
    // directly so authenticated (non-public) tables are properly gated.
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { data: null, error: { message: 'Not authenticated', code: 'AUTH_REQUIRED' } },
        { status: 401 }
      )
    }
    userId = (session.user as { id: string }).id
    userEmail = session.user.email ?? null

    // Set RLS context
    if (userId) {
      setCurrentUserId(userId)
    }
  }

  // ─── Admin-only table check ───────────────────────────────────
  if (ADMIN_ONLY_TABLES.has(table as string) && !isAdmin(userEmail)) {
    return NextResponse.json(
      { data: null, error: { message: 'Admin access required', code: 'FORBIDDEN' } },
      { status: 403 }
    )
  }

  // ─── Read-only shared table check ────────────────────────────
  if (READ_ONLY_SHARED_TABLES.has(table as string) && operation !== 'select') {
    return NextResponse.json(
      { data: null, error: { message: 'This table is read-only', code: 'FORBIDDEN' } },
      { status: 403 }
    )
  }

  // ─── Public browse tables are read-only (audit C-02) ─────────
  // Previously any authenticated caller could insert/update/delete
  // newsletter_subscribers (email harvesting), feedback and community rows.
  if (PUBLIC_BROWSE_TABLES.has(table as string) && operation !== 'select') {
    return NextResponse.json(
      { data: null, error: { message: 'This table is read-only', code: 'FORBIDDEN' } },
      { status: 403 }
    )
  }

  // ─── Update payload sanitization (audit C-02) ────────────────
  // Ownership/identity columns can never be rewritten through an UPDATE:
  // stripping them prevents transferring a row to another user or project.
  if (operation === 'update' && payload && !Array.isArray(payload)) {
    const sanitized = payload as Record<string, unknown>
    delete sanitized.id
    delete sanitized.user_id
    delete sanitized.project_id
  }

  // ─── Project-scoped tenancy check (audit C-02) ───────────────
  // Every read/write of a project-scoped table must name exactly one
  // project, and the caller must own or be a member of that project.
  let projectScopeId: string | null = null
  if (PROJECT_SCOPED_TABLES.has(table as string)) {
    const isWritePayloadOp = operation === 'insert' || operation === 'upsert'
    let targetProjectId: string | null = null

    if (isWritePayloadOp) {
      const rows = Array.isArray(payload) ? payload : (payload ? [payload] : [])
      const first = rows[0] as Record<string, unknown> | undefined
      const firstPid = first && typeof first.project_id === 'string' ? first.project_id : null
      // Every row must target the SAME project — mixed-project writes are
      // rejected outright so one verified project can't shield another.
      const allSame = rows.every(
        (r) => (r as Record<string, unknown>).project_id === firstPid,
      )
      targetProjectId = firstPid && allSame ? firstPid : null
    } else {
      const filterList = Array.isArray(filters) ? (filters as DbFilter[]) : []
      for (const f of filterList) {
        if (f.op === 'eq' && f.column === 'project_id' && typeof f.value === 'string') {
          targetProjectId = f.value
          break
        }
      }
    }

    if (!targetProjectId || !userId) {
      return NextResponse.json(
        {
          data: null,
          error: {
            message: 'A project_id filter (or payload field) naming a project you have access to is required for this table',
            code: 'PROJECT_SCOPE_REQUIRED',
          },
        },
        { status: 403 }
      )
    }

    const access = await checkProjectAccess(userId, targetProjectId)
    if (!access.allowed) {
      return NextResponse.json(
        { data: null, error: { message: 'You do not have access to this project', code: 'FORBIDDEN' } },
        { status: 403 }
      )
    }
    projectScopeId = targetProjectId
  }

  let qb = new QueryBuilder(getPool(), table as string)

  // Apply operation
  if (operation === 'select') {
    qb = qb.select((columns as string) || '*', { count: count ? 'exact' : undefined, head: head as boolean | undefined })
  } else if (operation === 'insert') {
    const insertPayload = payload as Record<string, unknown> | Record<string, unknown>[]
    // For user-scoped tables, inject user_id into the payload
    if (USER_SCOPED_TABLES.has(table as string) && userId) {
      if (Array.isArray(insertPayload)) {
        for (const row of insertPayload) { row.user_id = userId }
      } else if (insertPayload) {
        insertPayload.user_id = userId
      }
    }
    qb = qb.insert(insertPayload)
  } else if (operation === 'update') {
    qb = qb.update(payload as Record<string, unknown>)
  } else if (operation === 'delete') {
    qb = qb.delete()
  } else if (operation === 'upsert') {
    const upsertPayload = payload as Record<string, unknown> | Record<string, unknown>[]
    if (USER_SCOPED_TABLES.has(table as string) && userId) {
      if (Array.isArray(upsertPayload)) {
        for (const row of upsertPayload) { row.user_id = userId }
      } else if (upsertPayload) {
        upsertPayload.user_id = userId
      }
    }
    // onConflict (e.g. 'user_id,parcel_number') is validated synchronously
    // inside upsert() via validateIdentifier — each comma-separated column
    // must match the strict identifier allowlist, so it cannot inject SQL.
    qb = qb.upsert(upsertPayload, onConflict ? { onConflict } : undefined)
    // Tenant guards (audit C-02): a crafted ON CONFLICT (id) payload must not
    // be able to flip a victim row's user_id/project_id through the
    // DO UPDATE branch. The guard restricts updates to rows already inside
    // the caller's verified scope.
    if (USER_SCOPED_TABLES.has(table as string) && userId) {
      qb = qb.withConflictGuard('user_id', userId)
    }
    if (PROJECT_SCOPED_TABLES.has(table as string) && projectScopeId) {
      qb = qb.withConflictGuard('project_id', projectScopeId)
    }
  }

  // ─── User-scoped row-level security ──────────────────────────
  if (USER_SCOPED_TABLES.has(table as string) && userId) {
    qb = qb.eq('user_id', userId)
  }

  // ─── Project-scoped row-level security (audit C-02) ──────────
  // Hard-scope the query to the verified project, regardless of any
  // client-supplied filters (belt and braces with the access check above).
  if (PROJECT_SCOPED_TABLES.has(table as string) && projectScopeId) {
    qb = qb.eq('project_id', projectScopeId)
  }

  // Apply filters
  const filterArr = filters as DbFilter[] | undefined
  if (Array.isArray(filterArr)) {
    for (const f of filterArr) {
      const method = f.op
      // Prevent client from overriding user_id filter on scoped tables
      if (USER_SCOPED_TABLES.has(table as string) && f.column === 'user_id') continue
      // Prevent client from overriding the verified project scope
      if (PROJECT_SCOPED_TABLES.has(table as string) && f.column === 'project_id') continue

      if (method === 'eq') qb = qb.eq(f.column, f.value)
      else if (method === 'neq') qb = qb.neq(f.column, f.value)
      else if (method === 'gt') qb = qb.gt(f.column, f.value)
      else if (method === 'gte') qb = qb.gte(f.column, f.value)
      else if (method === 'lt') qb = qb.lt(f.column, f.value)
      else if (method === 'lte') qb = qb.lte(f.column, f.value)
      else if (method === 'like') qb = qb.like(f.column, f.value as string)
      else if (method === 'ilike') qb = qb.ilike(f.column, f.value as string)
      else if (method === 'in') qb = qb.in(f.column, f.value as unknown[])
      else if (method === 'is') qb = qb.is(f.column, f.value)
      else if (method === 'contains') qb = qb.contains(f.column, f.value)
    }
  }

  // Apply OR filters
  const orFilterArr = orFilters as string[] | undefined
  if (Array.isArray(orFilterArr)) {
    for (const of_ of orFilterArr) {
      qb = qb.or(of_)
    }
  }

  // Apply order
  const orderArr = order as DbOrderClause[] | undefined
  if (Array.isArray(orderArr)) {
    for (const o of orderArr) {
      qb = qb.order(o.column, { ascending: o.ascending })
    }
  }

  // Apply limit/offset
  if (limit != null) qb = qb.limit(limit as number)
  if (offset != null) {
    qb = qb.range(offset as number, (offset as number) + ((limit as number) ?? 50) - 1)
  }

  // Apply single/maybeSingle
  if (single) qb = qb.single()
  else if (maybeSingle) qb = qb.maybeSingle()

  // Execute
  const result = await qb
  return NextResponse.json(result)
})
