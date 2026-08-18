/**
 * apiHandler — Standardized API route wrapper for METARDU.
 *
 * Solves G1 (auth enforcement), G2 (Zod validation), G7 (error handling)
 * in a single composable function that every API route uses.
 *
 * When auth:true, automatically sets RLS context via setCurrentUserId()
 * so that PostgreSQL row-level security policies work correctly.
 *
 * Usage:
 * export const GET = apiHandler({ auth: true }, async (req, ctx) => { ... })
 * export const POST = apiHandler({ auth: true, schema: CreateProjectSchema }, async (req, ctx) => { ... })
 * export const POST = apiHandler({ auth: false, rateLimit: { max: 3, windowMs: 60000 } }, async (req, ctx) => { ... })
 * export const POST = apiHandler({ auth: true, rawBody: true }, async (req, ctx) => { ... })  // no JSON parse
 *
 * Method-level overrides (different auth/validation per HTTP method):
 * export const GET = apiHandler({ auth: false }, async (req, ctx) => { ... })
 * export const POST = apiHandler({ auth: true, schema }, async (req, ctx) => { ... })
 * export const PATCH = apiHandler({ auth: true, schema, optimisticLock: true }, async (req, ctx) => { ... })
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth as getSession } from '@/lib/auth-v5'
import { rateLimit, getClientIdentifier } from '@/lib/security/rateLimit'
import { logger, auditLog } from '@/lib/logger'
import { setCurrentUserId, setCurrentOrgId } from '@/lib/db'
import { db } from '@/lib/db'
import { captureError } from '@/lib/monitoring/sentry'
import { routeHitsTotal } from '@/lib/monitoring/metrics'
import { normalizePath } from '@/lib/monitoring/middleware-tracker'
import { appendAuditEntry } from '@/lib/audit/auditLog'
import type { AuditEntityType, AuditAction } from '@/lib/audit/auditHash'
import type { ZodSchema } from 'zod'
import type { Session } from 'next-auth'

export interface ApiHandlerContext {
  session: Session | null
  userId: string
  body: unknown
  params: Record<string, string>
}

/**
 * Tamper-evident audit chain configuration for a route.
 *
 * AUDIT FIX (C3, 2026-07-02): The audit_chain table and appendAuditEntry()
 * function existed but were only called in 4 files. This option lets any
 * route opt into the tamper-evident log with one line:
 *
 *   export const POST = apiHandler({
 *     auth: true,
 *     auditChain: {
 *       entityType: 'parcel',
 *       action: 'update',
 *       entityIdParam: 'id',         // URL param name
 *       projectIdFromBody: 'projectId', // optional: body field name
 *     },
 *     schema: UpdateParcelSchema,
 *   }, async (req, ctx) => { ... })
 *
 * The entry is appended AFTER the handler returns a 2xx response, so
 * failed mutations are not recorded. Audit chain failures are logged
 * but do NOT block the response — the mutation has already happened.
 */
export interface AuditChainConfig {
  /** Entity type for the audit entry (e.g., 'parcel', 'traverse', 'document'). */
  entityType: AuditEntityType
  /** Action for the audit entry (e.g., 'create', 'update', 'delete', 'generate'). */
  action: AuditAction
  /**
   * Name of the URL parameter containing the entity ID.
   * For /api/parcels/[id], this is 'id'.
   * If not found in params, falls back to body.id.
   */
  entityIdParam?: string
  /**
   * Name of the body field containing the project ID (optional).
   * If not found, projectId is omitted from the audit entry.
   */
  projectIdFromBody?: string
  /**
   * Name of the URL parameter containing the project ID (optional).
   * Takes precedence over projectIdFromBody.
   */
  projectIdFromParam?: string
  /**
   * Optional reason text for the audit entry (e.g., "boundary adjustment").
   * Defaults to `${method} ${pathname}`.
   */
  reason?: string
}

export interface ApiHandlerOptions {
  auth?: boolean
  schema?: ZodSchema
  rateLimit?: { max: number; windowMs: number }
  audit?: string
  roles?: string[]
  rawBody?: boolean
  /**
   * Enable optimistic locking for PATCH/PUT requests.
   * Requires the request body to include an `updated_at` field.
   * The handler should check that the DB's updated_at matches the submitted value.
   * If there's a mismatch, returns 409 Conflict.
   */
  optimisticLock?: boolean
  /**
   * Tamper-evident audit chain configuration. When set, the handler
   * appends an entry to the audit_chain table after a successful (2xx)
   * response. See AuditChainConfig for details.
   */
  auditChain?: AuditChainConfig
  /**
   * Attach an X-Request-Id header to the response for distributed tracing.
   * Defaults to true (audit H3 fix, 2026-07-02). Set to false to opt out.
   */
  requestId?: boolean
  /**
   * Emit structured JSON log lines for errors (level, message, timestamp,
   * requestId, userId, path, method). Defaults to true. Set to false to
   * keep the legacy `console.error('[apiHandler] ...')` format.
   */
  structuredLogs?: boolean
}

type HandlerFn = (
  req: NextRequest,
  ctx: ApiHandlerContext
) => Promise<NextResponse>

export function apiHandler(
  options: ApiHandlerOptions,
  handler: HandlerFn
): (req: NextRequest, context?: { params?: Record<string, string | string[]> }) => Promise<NextResponse> {
  const {
    auth = true,
    schema,
    rateLimit: rlConfig,
    audit: auditAction,
    roles,
    rawBody,
    auditChain,
    requestId: enableRequestId = true,
    structuredLogs = true,
  } = options

  // AUDIT FIX (H3, 2026-07-02): Generate a per-request ID for distributed
  // tracing. Added to the response as X-Request-Id header and to error logs.
  const generateRequestId = (): string => {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  }

  return async (req, context) => {
    const reqId = enableRequestId ? generateRequestId() : undefined
    let userId = 'anonymous'
    try {
      // Route-hit metric (2026-08-08): record every apiHandler-wrapped
      // request by normalized path (dynamic segments → [id]) so
      // api-row-sweep --traffic can weight batch plans by real route
      // usage (high-traffic routes typed first). Best-effort — a metrics
      // registry failure must never break the route.
      try {
        routeHitsTotal.inc({ method: req.method, path: normalizePath(req.nextUrl.pathname) })
      } catch {
        // metrics registry unavailable — ignore
      }
      if (rlConfig) {
        const identifier = getClientIdentifier(req)
        const { allowed, remaining } = await rateLimit(identifier, rlConfig.max, rlConfig.windowMs)
        if (!allowed) {
          return NextResponse.json(
            { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
            { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining) } }
          )
        }
      }

      let session: Session | null = null
      if (auth) {
        const s = await getSession()
        if (!s?.user) {
          return NextResponse.json(
            { error: 'Authentication required', code: 'UNAUTHORIZED' },
            { status: 401 }
          )
        }
        session = s

        // Set RLS context so PostgreSQL current_user_id() works
        const uid = (s.user as { id?: string }).id
        if (uid) {
          setCurrentUserId(String(uid))

          // AUDIT FIX (C6, 2026-07-02): Look up the user's active organization
          // and set the org RLS context. A user can be a member of multiple
          // orgs; we pick the most recently active one. Routes can override
          // this by calling setCurrentOrgId() explicitly (e.g. after the
          // user switches orgs via the UI).
          try {
            const orgResult = await db.query(
              `SELECT om.organization_id
               FROM organization_members om
               WHERE om.user_id = $1 AND om.is_active = TRUE
               ORDER BY om.accepted_at DESC NULLS LAST, om.invited_at DESC
               LIMIT 1`,
              [uid]
            )
            if (orgResult.rows.length > 0) {
              setCurrentOrgId(String(orgResult.rows[0].organization_id))
            }
          } catch {
            // Organizations table may not exist yet (pre-migration 028).
            // Silent fail — org context stays null, RLS falls back to user_id.
          }
        }

        if (roles && roles.length > 0) {
          const userRole = (session.user as { role?: string }).role ?? 'surveyor'
          if (!roles.includes(userRole)) {
            return NextResponse.json(
              { error: 'Insufficient permissions', code: 'FORBIDDEN' },
              { status: 403 }
            )
          }
        }
      }

      userId = (session?.user as { id?: string })?.id ?? 'anonymous'

      let body: unknown = undefined
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'DELETE' && !rawBody) {
        try {
          body = await req.json()
        } catch {
          return NextResponse.json(
            { error: 'Invalid JSON body', code: 'INVALID_BODY' },
            { status: 400 }
          )
        }

        if (schema) {
          const parsed = schema.safeParse(body)
          if (!parsed.success) {
            return NextResponse.json(
              { error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues },
              { status: 400 }
            )
          }
          body = parsed.data
        }

        // Optimistic locking check for PATCH/PUT
        if (options.optimisticLock && (req.method === 'PATCH' || req.method === 'PUT')) {
          const bodyObj = body as Record<string, unknown>
          if (!bodyObj.updated_at) {
            return NextResponse.json(
              { error: 'Optimistic locking requires updated_at field', code: 'CONFLICT_CHECK_REQUIRED' },
              { status: 400 }
            )
          }
        }
      }

      const rawParams = context?.params || {}
      const params: Record<string, string> = {}
      for (const [key, val] of Object.entries(rawParams)) {
        params[key] = Array.isArray(val) ? val[0] : val
      }

      const ctx: ApiHandlerContext = {
        // When auth: false, session is null — callers must handle this
        session: session as Session,
        userId,
        body,
        params,
      }

      const result = await handler(req, ctx)

      if (auditAction && auth) {
        auditLog(userId, auditAction, `${req.method} ${req.nextUrl.pathname}`)
      }

      // Tamper-evident audit chain (audit C3 fix, 2026-07-02).
      // Only append for 2xx responses — failed mutations are not audited
      // in the chain (they're still in the audit_logs table via DB triggers).
      if (auditChain && auth && result.status >= 200 && result.status < 300) {
        try {
          const entityId =
            (auditChain.entityIdParam && params[auditChain.entityIdParam]) ||
            (body as Record<string, unknown> | undefined)?.id as string | undefined ||
            'unknown'

          let projectId: string | undefined
          if (auditChain.projectIdFromParam && params[auditChain.projectIdFromParam]) {
            projectId = params[auditChain.projectIdFromParam]
          } else if (auditChain.projectIdFromBody) {
            const bodyObj = body as Record<string, unknown> | undefined
            const pid = bodyObj?.[auditChain.projectIdFromBody]
            if (typeof pid === 'string') projectId = pid
          }

          await appendAuditEntry({
            projectId,
            userId,
            entityType: auditChain.entityType,
            entityId: String(entityId),
            action: auditChain.action,
            payload: {
              metadata: {
                method: req.method,
                path: req.nextUrl.pathname,
                reason: auditChain.reason,
                status: result.status,
                timestamp: new Date().toISOString(),
              },
            },
          })
        } catch (auditErr) {
          // Audit chain failure should NOT block the response — the
          // mutation has already happened. Log and continue.
          logger.warn(
            `[apiHandler] appendAuditEntry failed for ${req.method} ${req.nextUrl.pathname}:`,
            { error: auditErr instanceof Error ? auditErr.message : String(auditErr) }
          )
        }
      }

      // AUDIT FIX (H3, 2026-07-02): Attach X-Request-Id to successful
      // responses too (not just errors) for end-to-end tracing.
      if (reqId && result.headers) {
        result.headers.set('X-Request-Id', reqId)
      }

      return result
    } catch (err: unknown) {
      // AUDIT FIX (H3, 2026-07-02): Structured JSON logging (opt-in by default).
      // Includes requestId, userId, path, method for distributed tracing.
      if (structuredLogs) {
        logger.error(err instanceof Error ? err.message : String(err), {
          requestId: reqId,
          userId,
          path: req.nextUrl.pathname,
          method: req.method,
          stack: err instanceof Error ? err.stack : undefined,
        })
      } else {
        logger.error('[apiHandler] Unhandled error:', { error: err })
      }

      // Send to Sentry (only in production, key scrubbed by beforeSend)
      captureError(err instanceof Error ? err : new Error(String(err)), {
        path: req.nextUrl.pathname,
        method: req.method,
        userId,
        requestId: reqId,
      })

      const pgCode = (err as { code?: string })?.code
      const errorResponse = (status: number, error: string, code: string) => {
        const headers: Record<string, string> = {}
        if (reqId) headers['X-Request-Id'] = reqId
        return NextResponse.json({ error, code, ...(reqId ? { requestId: reqId } : {}) }, { status, headers })
      }

      if (pgCode === '23505') {
        return errorResponse(409, 'This record already exists', 'DUPLICATE')
      }
      if (pgCode === '23503') {
        return errorResponse(400, 'Referenced record not found', 'FOREIGN_KEY_VIOLATION')
      }
      if (pgCode === '42501') {
        return errorResponse(403, 'Permission denied', 'PERMISSION_DENIED')
      }

      return errorResponse(500, 'Internal server error', 'INTERNAL_ERROR')
    }
  }
}

/**
 * Check optimistic locking conflict inside a handler.
 * Call this after fetching the current DB row but before applying updates.
 *
 * @returns NextResponse (409) if conflict detected, null if no conflict
 *
 * @example
 * const conflict = checkOptimisticLock(ctx.body, dbRow)
 * if (conflict) return conflict
 */
export function checkOptimisticLock(
  requestBody: Record<string, unknown>,
  dbRow: { updated_at: string | Date | null }
): NextResponse | null {
  const clientUpdatedAt = requestBody.updated_at as string | undefined
  if (!clientUpdatedAt || !dbRow.updated_at) return null

  const clientTime = new Date(clientUpdatedAt).getTime()
  const dbTime = new Date(dbRow.updated_at).getTime()

  // Allow 1-second tolerance for clock drift / rounding
  if (Math.abs(clientTime - dbTime) > 1000) {
    return NextResponse.json(
      {
        error: 'This record was modified by another user. Please refresh and try again.',
        code: 'CONFLICT',
        db_updated_at: dbRow.updated_at,
      },
      { status: 409 }
    )
  }
  return null
}

/**
 * Standardized success response helpers
 */
export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function apiCreated(data: unknown) {
  return NextResponse.json(data, { status: 201 })
}

export function apiNoContent() {
  return new NextResponse(null, { status: 204 })
}