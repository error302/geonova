/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * METARDU — Central API Client
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ponytail: native fetch + Zod parse, no axios. One error path, one place to
 * add retry / cache / telemetry. Replaces the ~217 inline `fetch()` calls
 * scattered across client components.
 *
 * Server-side: apiHandler (src/lib/apiHandler.ts) already enforces auth,
 * validates the request body with Zod, and returns a uniform error envelope:
 *   { error: string, code: string, issues?: ZodIssue[] }
 *
 * Client-side: this `api()` function mirrors that contract. Use the SAME Zod
 * schema on both sides — the server validates input, the client validates
 * output. One source of truth.
 */

import type { ZodSchema, ZodIssue } from 'zod'
import { z } from 'zod'
import { logger } from '@/lib/logger'

// ─── Error Types ───────────────────────────────────────────────────────────

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'DUPLICATE'
  | 'FOREIGN_KEY_VIOLATION'
  | 'PERMISSION_DENIED'
  | 'INTERNAL_ERROR'
  | 'CONFLICT'
  | 'CONFLICT_CHECK_REQUIRED'
  | 'INVALID_BODY'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | (string & {})

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly issues?: ZodIssue[]
  readonly body?: unknown

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    opts?: { issues?: ZodIssue[]; body?: unknown },
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.issues = opts?.issues
    this.body = opts?.body
  }

  get isUnauthorized(): boolean { return this.code === 'UNAUTHORIZED' || this.status === 401 }
  get isForbidden(): boolean { return this.code === 'FORBIDDEN' || this.code === 'PERMISSION_DENIED' || this.status === 403 }
  get isValidation(): boolean { return this.code === 'VALIDATION_ERROR' }
  get isNotFound(): boolean { return this.code === 'NOT_FOUND' || this.status === 404 }
  get isRateLimited(): boolean { return this.code === 'RATE_LIMITED' || this.status === 429 }
}

// ─── Core `api()` Function ─────────────────────────────────────────────────

export async function api<T>(
  path: string,
  schema: ZodSchema<T>,
  init?: RequestInit,
): Promise<T> {
  const bodyIsObj = init?.body !== undefined && typeof init.body === 'object' && !(init.body instanceof FormData) && !(init.body instanceof Blob)
  const r = await fetch(path, {
    ...init,
    body: bodyIsObj ? JSON.stringify(init.body) : init?.body,
    headers: {
      ...(init?.body !== undefined && bodyIsObj ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (r.status === 204) {
    return undefined as unknown as T
  }

  const text = await r.text()
  let parsed: unknown = undefined
  if (text) {
    try { parsed = JSON.parse(text) }
    catch { parsed = text }
  }

  if (!r.ok) {
    const errBody = (parsed && typeof parsed === 'object' && parsed !== null) ? parsed as Record<string, unknown> : {}
    const code = (errBody.code as ApiErrorCode) ?? guessCodeFromStatus(r.status)
    const message = (errBody.error as string) ?? r.statusText ?? 'API request failed'
    const issues = errBody.issues as ZodIssue[] | undefined
    throw new ApiError(r.status, code, message, { issues, body: parsed })
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    if (process.env.NODE_ENV !== 'production') {
      logger.error(`[api] Response schema mismatch for ${path}:`,  { error: result.error.issues })
    }
    throw new ApiError(r.status, 'INTERNAL_ERROR', `Response schema mismatch for ${path}`, {
      issues: result.error.issues,
      body: parsed,
    })
  }

  return result.data
}

function guessCodeFromStatus(status: number): ApiErrorCode {
  switch (status) {
    case 400: return 'BAD_REQUEST'
    case 401: return 'UNAUTHORIZED'
    case 403: return 'FORBIDDEN'
    case 404: return 'NOT_FOUND'
    case 409: return 'CONFLICT'
    case 429: return 'RATE_LIMITED'
    case 500: return 'INTERNAL_ERROR'
    default: return 'INTERNAL_ERROR'
  }
}

// ─── `apiGet()` — Cached GET helper ────────────────────────────────────────

const _cache = new Map<string, { t: number; v: unknown; promise: Promise<unknown> | null }>()

export async function apiGet<T>(
  path: string,
  schema: ZodSchema<T>,
  opts?: { ttlMs?: number; signal?: AbortSignal; init?: RequestInit },
): Promise<T> {
  const ttl = opts?.ttlMs ?? 30_000
  if (ttl > 0) {
    const hit = _cache.get(path)
    if (hit) {
      if (Date.now() - hit.t < ttl) return hit.v as T
      if (hit.promise) return hit.promise as Promise<T>
    }
  }

  const promise = api<T>(path, schema, { ...opts?.init, signal: opts?.signal })
  if (ttl > 0) {
    _cache.set(path, { t: Date.now(), v: undefined as unknown, promise })
    try {
      const v = await promise
      _cache.set(path, { t: Date.now(), v, promise: null })
      return v
    } catch (err) {
      _cache.delete(path)
      throw err
    }
  }
  return promise
}

export function apiInvalidate(pathOrPrefix: string): void {
  _cache.delete(pathOrPrefix)
  for (const key of _cache.keys()) {
    if (key.startsWith(pathOrPrefix)) _cache.delete(key)
  }
}

export function apiInvalidateAll(): void {
  _cache.clear()
}

// ─── Convenience helpers ───────────────────────────────────────────────────

export async function apiPost<T>(
  path: string,
  schema: ZodSchema<T>,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  return api(path, schema, { ...init, method: 'POST', body: body as BodyInit })
}

export async function apiPatch<T>(
  path: string,
  schema: ZodSchema<T>,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  return api(path, schema, { ...init, method: 'PATCH', body: body as BodyInit })
}

export async function apiPut<T>(
  path: string,
  schema: ZodSchema<T>,
  body: unknown,
  init?: RequestInit,
): Promise<T> {
  return api(path, schema, { ...init, method: 'PUT', body: body as BodyInit })
}

export async function apiDelete<T = void>(
  path: string,
  schema?: ZodSchema<T>,
  init?: RequestInit,
): Promise<T | void> {
  if (schema) {
    return api<T>(path, schema, { ...init, method: 'DELETE' })
  }
  const zNullable = z.null().optional() as ZodSchema<null | undefined>
  await api<null | undefined>(path, zNullable, { ...init, method: 'DELETE' })
}
