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

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiHandler } from '@/lib/apiHandler'
import { setCurrentUserId } from '@/lib/db'
import { getPool } from '@/lib/db'
import { QueryBuilder } from '@/lib/db/queryBuilder'
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
const PROJECT_SCOPED_TABLES = new Set([
  'survey_points', 'parcels', 'alignments', 'cross_sections',
  'project_fieldbook_entries', 'survey_epochs', 'leveling_runs',
  'parcel_traverses', 'network_adjustments',
  'mining_surveys', 'hydro_surveys', 'gnss_sessions',
  'peer_review_requests', 'supporting_documents',
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
  'project_sheets', 'survey_photos',
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
  const { table, operation, columns, filters, orFilters, order, limit, offset, single, maybeSingle, count, head, payload } = body

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
    qb = qb.upsert(upsertPayload)
  }

  // ─── User-scoped row-level security ──────────────────────────
  if (USER_SCOPED_TABLES.has(table as string) && userId) {
    qb = qb.eq('user_id', userId)
  }

  // Apply filters
  const filterArr = filters as DbFilter[] | undefined
  if (Array.isArray(filterArr)) {
    for (const f of filterArr) {
      const method = f.op
      // Prevent client from overriding user_id filter on scoped tables
      if (USER_SCOPED_TABLES.has(table as string) && f.column === 'user_id') continue

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
