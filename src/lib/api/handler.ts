/**
 * apiHandler — Next-generation standardized API route wrapper for METARDU.
 *
 * @deprecated (audit H3, 2026-07-02): Use `@/lib/apiHandler` (v1) instead.
 *   The v1 handler now has feature parity with this v2:
 *     - X-Request-Id header (opt-in via `requestId: true`, default true)
 *     - Structured JSON error logging (opt-in via `structuredLogs: true`, default true)
 *     - Tamper-evident audit chain (opt-in via `auditChain` option)
 *     - Optimistic locking support
 *     - Org-aware RLS context
 *   This v2 file is kept for the 5 routes that import it, but new routes
 *   should use v1. A future cleanup will migrate the 5 v2 consumers and
 *   delete this file.
 *
 * This is the v2 handler that builds on lessons from the original
 * `@/lib/apiHandler`. It provides:
 *
 *   - Automatic try/catch with standardized error response format
 *   - Consistent error-to-HTTP-status mapping (Zod → 422, AppError subclasses → proper codes)
 *   - PostgreSQL error code mapping (23505 → 409, 23503 → 400)
 *   - Optional `requireAuth` with automatic session checking and RLS context
 *   - Optional `requiredRole` for role-based access control
 *   - Optional Zod schema validation for request bodies with validated `ctx.input`
 *   - X-Request-Id header on every response for distributed tracing
 *   - Structured error logging with request context
 *
 * Usage:
 *   export const GET = apiHandler({
 *     requireAuth: true,
 *     handler: async (ctx) => { ... }
 *   })
 *
 *   export const POST = apiHandler({
 *     requireAuth: true,
 *     requiredRole: ['admin', 'super_admin'],
 *     schema: createProjectSchema,
 *     handler: async (ctx) => { ... }
 *   })
 *
 * Backward compatibility:
 *   The original `@/lib/apiHandler` is untouched. Existing routes that import
 *   from `@/lib/apiHandler` continue to work without changes. New and
 *   refactored routes should import from `@/lib/api/handler`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { setCurrentUserId } from '@/lib/db'
import { captureError } from '@/lib/monitoring/sentry'
import { rateLimit, getClientIdentifier } from '@/lib/security/rateLimit'
import { auditLog } from '@/lib/logger'
import type { ZodSchema } from 'zod'
import type { Session } from 'next-auth'
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
} from './errors'

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * Context object passed to every handler function.
 * Provides request, validated input, auth info, and route params.
 */
export interface ApiContext<TInput = unknown> {
  /** The original Next.js request object */
  req: NextRequest
  /** Route parameters extracted from the URL (e.g. [id]) */
  params: Record<string, string>
  /** Validated request body — typed when a Zod schema is provided */
  input: TInput
  /** Authenticated user ID (set when requireAuth is true) */
  userId: string
  /** Authenticated user email (set when requireAuth is true) */
  userEmail: string
  /** Authenticated user role (set when requireAuth is true) */
  userRole: string
  /** Full NextAuth session (available when requireAuth is true) */
  session: Session | null
}

/**
 * Configuration for an apiHandler-wrapped route.
 */
export interface ApiHandlerConfig<TInput = unknown> {
  /** Whether to require authentication. Defaults to false. */
  requireAuth?: boolean
  /** Roles allowed to access this route. Requires requireAuth: true. */
  requiredRole?: string[]
  /** Zod schema for request body validation. Validated data becomes ctx.input. */
  schema?: ZodSchema<TInput>
  /** Rate limiting configuration */
  rateLimit?: { max: number; windowMs: number }
  /** Audit action name — logged via auditLog when auth is present */
  audit?: string
  /**
   * Enable optimistic locking for PATCH/PUT requests.
   * Requires ctx.input to include an `updated_at` field.
   */
  optimisticLock?: boolean
  /**
   * Skip JSON body parsing (e.g. for file uploads or raw body handling).
   * ctx.input will be undefined.
   */
  rawBody?: boolean
  /** The actual route handler logic */
  handler: (ctx: ApiContext<TInput>) => Promise<NextResponse>
}

/** Standardized error response shape */
interface ErrorResponse {
  error: string
  code?: string
  details?: unknown
}

// ─── Request ID generation ─────────────────────────────────────────────────────

let _requestCounter = 0

function generateRequestId(): string {
  _requestCounter++
  // Combine timestamp + counter + random for uniqueness across instances
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `req_${ts}_${_requestCounter}_${rand}`
}

// ─── Zod error formatting ──────────────────────────────────────────────────────

interface ZodIssue {
  path: (string | number)[]
  message: string
  code: string
}

interface ZodErrorLike {
  issues: ZodIssue[]
  flatten?: () => { fieldErrors: Record<string, string[]> }
}

function formatZodDetails(err: ZodErrorLike): Record<string, string[]> {
  // Prefer flatten() if available (structured per-field)
  if (typeof err.flatten === 'function') {
    return err.flatten().fieldErrors
  }
  // Fallback: group issues by path
  const grouped: Record<string, string[]> = {}
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_root'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(issue.message)
  }
  return grouped
}

// ─── Error response builder ────────────────────────────────────────────────────

function buildErrorResponse(
  error: unknown,
  requestId: string
): NextResponse {
  const headers = { 'X-Request-Id': requestId }

  // 1. Our custom AppError hierarchy — direct mapping
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      } satisfies ErrorResponse,
      { status: error.statusCode, headers }
    )
  }

  // 2. ZodError — 422 with structured validation details
  if (error && typeof error === 'object' && 'issues' in error && Array.isArray((error as ZodErrorLike).issues)) {
    const zodErr = error as ZodErrorLike
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: formatZodDetails(zodErr),
      } satisfies ErrorResponse,
      { status: 422, headers }
    )
  }

  // 3. PostgreSQL error codes
  const pgCode = (error as { code?: string })?.code
  if (pgCode === '23505') {
    return NextResponse.json(
      { error: 'This record already exists', code: 'DUPLICATE' } satisfies ErrorResponse,
      { status: 409, headers }
    )
  }
  if (pgCode === '23503') {
    return NextResponse.json(
      { error: 'Referenced record not found', code: 'FOREIGN_KEY_VIOLATION' } satisfies ErrorResponse,
      { status: 400, headers }
    )
  }
  if (pgCode === '42501') {
    return NextResponse.json(
      { error: 'Permission denied', code: 'PERMISSION_DENIED' } satisfies ErrorResponse,
      { status: 403, headers }
    )
  }

  // 4. Generic fallback — 500, no information leakage
  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' } satisfies ErrorResponse,
    { status: 500, headers }
  )
}

// ─── Structured error logger ───────────────────────────────────────────────────

function logError(
  error: unknown,
  context: {
    method: string
    path: string
    userId: string
    requestId: string
  }
) {
  const isAppError = error instanceof AppError
  const status = isAppError ? error.statusCode : 500
  const code = isAppError ? error.code : 'INTERNAL_ERROR'
  const message = error instanceof Error ? error.message : String(error)

  const logLevel = status >= 500 ? 'error' : 'warn'

  if (logLevel === 'error') {
    console.error(
      JSON.stringify({
        level: 'error',
        message: `[apiHandler] ${context.method} ${context.path} → ${status}`,
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
        userId: context.userId,
        errorCode: code,
        errorMessage: message,
        stack: error instanceof Error ? error.stack : undefined,
      })
    )
  } else {
    console.warn(
      JSON.stringify({
        level: 'warn',
        message: `[apiHandler] ${context.method} ${context.path} → ${status}`,
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
        userId: context.userId,
        errorCode: code,
        errorMessage: message,
      })
    )
  }
}

// ─── Main apiHandler function ──────────────────────────────────────────────────

/**
 * Higher-order function that wraps a Next.js API route handler with
 * standardized error handling, auth checking, validation, and response formatting.
 *
 * @example
 * // Simple authenticated GET
 * export const GET = apiHandler({
 *   requireAuth: true,
 *   handler: async (ctx) => {
 *     const data = await db.query('SELECT * FROM projects WHERE user_id = $1', [ctx.userId])
 *     return NextResponse.json({ data: data.rows })
 *   },
 * })
 *
 * @example
 * // POST with Zod validation and role check
 * export const POST = apiHandler({
 *   requireAuth: true,
 *   requiredRole: ['admin'],
 *   schema: createProjectSchema,
 *   handler: async (ctx) => {
 *     // ctx.input is fully typed and validated
 *     const project = await createProject(ctx.input)
 *     return NextResponse.json({ data: project }, { status: 201 })
 *   },
 * })
 */
export function apiHandler<TInput = unknown>(
  config: ApiHandlerConfig<TInput>
): (req: NextRequest, context?: { params?: Record<string, string | string[]> }) => Promise<NextResponse> {
  const {
    requireAuth = false,
    requiredRole,
    schema,
    rateLimit: rlConfig,
    audit: auditAction,
    optimisticLock,
    rawBody,
    handler,
  } = config

  return async (req, context) => {
    const requestId = generateRequestId()
    // ByteByteGo audit: distributed tracing — extract/generate trace context
    let traceId = ''
    try {
      const { getTraceContext } = await import('@/lib/monitoring/tracing')
      const traceCtx = getTraceContext(req)
      traceId = traceCtx.traceId
    } catch {}
    let userId = 'anonymous'
    let userEmail = ''
    let userRole = ''

    try {
      // ─── Rate limiting ─────────────────────────────────────────────────
      if (rlConfig) {
        const identifier = getClientIdentifier(req)
        const { allowed, remaining } = await rateLimit(identifier, rlConfig.max, rlConfig.windowMs)
        if (!allowed) {
          throw new RateLimitError('Too many requests. Please try again later.', {
            remaining,
          })
        }
      }

      // ─── Authentication ────────────────────────────────────────────────
      let session: Session | null = null

      if (requireAuth) {
        const s = await getServerSession(authOptions)
        if (!s?.user) {
          throw new AuthenticationError('Authentication required')
        }
        session = s

        userId = String((s.user as { id?: string }).id ?? 'anonymous')
        userEmail = String(s.user.email ?? '')
        userRole = String((s.user as { role?: string }).role ?? 'surveyor')

        // Set RLS context so PostgreSQL current_user_id() works
        if (userId && userId !== 'anonymous') {
          setCurrentUserId(userId)
        }

        // Role-based access control
        if (requiredRole && requiredRole.length > 0) {
          if (!requiredRole.includes(userRole)) {
            throw new AuthorizationError(
              `Insufficient permissions. Required: ${requiredRole.join(' or ')}, got: ${userRole}`
            )
          }
        }
      }

      // ─── Request body parsing & validation ─────────────────────────────
      let input: TInput = undefined as TInput

      if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'DELETE' && !rawBody) {
        try {
          const rawBody = await req.json()

          if (schema) {
            const parsed = schema.safeParse(rawBody)
            if (!parsed.success) {
              throw new ValidationError('Validation failed', formatZodDetails(parsed.error as unknown as ZodErrorLike))
            }
            input = parsed.data as TInput
          } else {
            input = rawBody as TInput
          }
        } catch (err) {
          // If it's already a ValidationError from schema parsing, re-throw
          if (err instanceof ValidationError) throw err
          // JSON parse failure
          throw new ValidationError('Invalid JSON body', { parseError: true })
        }

        // Optimistic locking check for PATCH/PUT
        if (optimisticLock && (req.method === 'PATCH' || req.method === 'PUT')) {
          const bodyObj = input as Record<string, unknown>
          if (!bodyObj.updated_at) {
            throw new ValidationError('Optimistic locking requires updated_at field', {
              field: 'updated_at',
            })
          }
        }
      }

      // ─── Route params ──────────────────────────────────────────────────
      const rawParams = context?.params || {}
      const params: Record<string, string> = {}
      for (const [key, val] of Object.entries(rawParams)) {
        params[key] = Array.isArray(val) ? val[0] : val ?? ''
      }

      // ─── Build context and call handler ────────────────────────────────
      const ctx: ApiContext<TInput> = {
        req,
        params,
        input,
        userId,
        userEmail,
        userRole,
        session,
      }

      const result = await handler(ctx)

      // ─── Audit logging ─────────────────────────────────────────────────
      if (auditAction && requireAuth && userId !== 'anonymous') {
        auditLog(userId, auditAction, `${req.method} ${req.nextUrl.pathname}`)
      }

      // ─── Attach X-Request-Id to successful responses ──────────────────
      result.headers.set('X-Request-Id', requestId)
      if (traceId) result.headers.set('X-Trace-Id', traceId)
      return result
    } catch (err: unknown) {
      // ─── Structured logging ────────────────────────────────────────────
      logError(err, {
        method: req.method,
        path: req.nextUrl.pathname,
        userId,
        requestId,
      })

      // ─── Sentry capture ────────────────────────────────────────────────
      captureError(
        err instanceof Error ? err : new Error(String(err)),
        {
          path: req.nextUrl.pathname,
          method: req.method,
          userId,
          requestId,
        }
      )

      // ─── Build standardized error response ─────────────────────────────
      const response = buildErrorResponse(err, requestId)
      return response
    }
  }
}

// ─── Convenience response helpers ──────────────────────────────────────────────

/**
 * Return a success JSON response with optional status code.
 */
export function apiSuccess(data: unknown, status = 200, headers?: Record<string, string>): NextResponse {
  return NextResponse.json(data, { status, headers })
}

/**
 * Return a 201 Created response.
 */
export function apiCreated(data: unknown): NextResponse {
  return NextResponse.json(data, { status: 201 })
}

/**
 * Return a 204 No Content response.
 */
export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

/**
 * Check optimistic locking conflict inside a handler.
 * Call this after fetching the current DB row but before applying updates.
 *
 * @returns NextResponse (409) if conflict detected, null if no conflict
 *
 * @example
 * const conflict = checkOptimisticLock(ctx.input, dbRow)
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

// Re-export error classes for convenience
export {
  AppError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
} from './errors'
