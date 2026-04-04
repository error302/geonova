/**
 * /api/db — Database proxy for client-side queries
 * 
 * Client components send query specs here, this route executes them
 * against the VM PostgreSQL. Auth is verified via NextAuth session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Pool } from 'pg'
import { QueryBuilder } from '@/lib/db/queryBuilder'
import { env } from '@/lib/env'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    const connectionString = env.DATABASE_URL
    if (connectionString) {
      pool = new Pool({ connectionString, max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 })
    } else if (env.DB_HOST && env.DB_NAME && env.DB_USER) {
      pool = new Pool({
        host: env.DB_HOST,
        port: env.DB_PORT ?? 5432,
        database: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      })
    } else {
      throw new Error('Database not configured')
    }
  }
  return pool
}

// Tables that can be queried without authentication
const PUBLIC_TABLES = new Set([
  'benchmarks', 'survey_standards', 'countries', 'professional_bodies',
])

// All known tables (whitelist to prevent SQL injection via table names)
const ALLOWED_TABLES = new Set([
  'projects', 'survey_points', 'parcels', 'alignments', 'profiles', 'cross_sections',
  'project_members', 'user_subscriptions', 'newsletter_subscribers', 'feedback',
  'analytics_events', 'rate_limit_events', 'survey_epochs', 'project_fieldbook_entries',
  'leveling_runs', 'collaboration_sessions', 'jobs', 'job_missions', 'audit_logs',
  'survey_type_expand', 'cpd_activities', 'peer_reviews', 'peer_review_payments',
  'digital_signatures', 'cleaned_datasets', 'cadastra_validations', 'mine_twins',
  'workflows', 'bathymetric_surveys', 'usv_missions', 'safety_incidents',
  'geofusion_projects', 'geofusion_layers', 'deed_plans', 'survey_reports',
  'parcel_metadata', 'gnss_sessions', 'benchmarks', 'nlims_cache',
  'signatures', 'equipment', 'equipment_calibrations', 'job_applications',
  'job_reviews', 'professional_bodies', 'enterprise_organizations',
  'enterprise_members', 'enterprise_invitations', 'enterprise_settings',
  'payment_history', 'render_jobs', 'land_law_cases', 'land_law_regulations',
  'project_submissions', 'submission_documents', 'import_sessions',
  'online_service_logs', 'users', 'point_history', 'project_sheets',
  'survey_photos', 'plan_usage', 'surveyor_profiles', 'countries',
  'survey_standards', 'password_reset_tokens',
])

const OP_MAP: Record<string, string> = {
  eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=',
  like: 'LIKE', ilike: 'ILIKE', in: 'IN', is: 'IS',
  not_eq: '!=', not_is: 'IS NOT', contains: '@>',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { table, operation, columns, filters, orFilters, order, limit, offset, single, maybeSingle, count, head, payload } = body

    if (!table || !ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ data: null, error: { message: `Table not allowed: ${table}`, code: 'FORBIDDEN' } }, { status: 403 })
    }

    // Auth check — public tables skip this
    if (!PUBLIC_TABLES.has(table)) {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return NextResponse.json({ data: null, error: { message: 'Not authenticated', code: 'AUTH_REQUIRED' } }, { status: 401 })
      }
    }

    const p = getPool()
    let qb = new QueryBuilder(p, table)

    // Apply operation
    if (operation === 'select') {
      qb = qb.select(columns || '*', { count: count ? 'exact' : undefined, head }) as any
    } else if (operation === 'insert') {
      qb = qb.insert(payload) as any
    } else if (operation === 'update') {
      qb = qb.update(payload) as any
    } else if (operation === 'delete') {
      qb = qb.delete() as any
    } else if (operation === 'upsert') {
      qb = qb.upsert(payload) as any
    }

    // Apply filters
    if (Array.isArray(filters)) {
      for (const f of filters) {
        const method = f.op as keyof typeof OP_MAP
        if (method === 'eq') qb = qb.eq(f.column, f.value) as any
        else if (method === 'neq') qb = qb.neq(f.column, f.value) as any
        else if (method === 'gt') qb = qb.gt(f.column, f.value) as any
        else if (method === 'gte') qb = qb.gte(f.column, f.value) as any
        else if (method === 'lt') qb = qb.lt(f.column, f.value) as any
        else if (method === 'lte') qb = qb.lte(f.column, f.value) as any
        else if (method === 'like') qb = qb.like(f.column, f.value) as any
        else if (method === 'ilike') qb = qb.ilike(f.column, f.value) as any
        else if (method === 'in') qb = qb.in(f.column, f.value) as any
        else if (method === 'is') qb = qb.is(f.column, f.value) as any
        else if (method === 'contains') qb = qb.contains(f.column, f.value) as any
      }
    }

    // Apply OR filters
    if (Array.isArray(orFilters)) {
      for (const of of orFilters) {
        qb = qb.or(of) as any
      }
    }

    // Apply order
    if (Array.isArray(order)) {
      for (const o of order) {
        qb = qb.order(o.column, { ascending: o.ascending }) as any
      }
    }

    // Apply limit/offset
    if (limit != null) qb = qb.limit(limit) as any
    if (offset != null) {
      qb = (qb as any).range(offset, offset + (limit ?? 50) - 1)
    }

    // Apply single/maybeSingle
    if (single) qb = qb.single() as any
    else if (maybeSingle) qb = qb.maybeSingle() as any

    // Execute
    const result = await qb
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[/api/db] Error:', err.message)
    return NextResponse.json(
      { data: null, error: { message: err.message || 'Internal error', code: 'INTERNAL' } },
      { status: 500 }
    )
  }
}
