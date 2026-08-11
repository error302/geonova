/**
 * Centralized input validation for all API routes.
 * Uses Zod schemas + custom sanitizers for defense in depth.
 *
 * Every API route should validate its input through this module
 * rather than trusting raw request bodies/params directly.
 */
import { z } from 'zod'

// ─── Common reusable schemas ──────────────────────────────────────────────────

export const schemas = {
  /** UUID v4 validation */
  uuid: z.string().uuid(),

  /** RFC 5321 compliant email (max 254 chars) */
  email: z.string().email().max(254),

  /** Project / submission name */
  projectName: z.string().min(1).max(200).trim(),

  /** Kenya county code: 3-digit string */
  countyCode: z.string().regex(/^\d{3}$/).length(3),

  /** Land parcel number — free-form, max 50 chars */
  parcelNumber: z.string().max(50).trim(),

  /** Strictly positive number (> 0) */
  positiveNumber: z.number().positive(),

  /** Non-negative number (>= 0) */
  nonNegativeNumber: z.number().nonnegative(),

  /** Geographic coordinate: longitude or latitude range */
  coordinate: z.number().min(-180).max(180),

  /** Surveying bearing: 0–360 degrees */
  bearing: z.number().min(0).max(360),

  /** Pagination controls with sensible defaults */
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().positive().max(500).default(50),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }),

  /** ISO 8601 date range filter */
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
} as const

// ─── ValidationError ──────────────────────────────────────────────────────────

/**
 * Thrown by `validateInput` when Zod parsing fails.
 * Carries structured field-level details for the API response.
 */
export class ValidationError extends Error {
  details: Array<{ field: string; message: string }>

  constructor(
    message: string,
    details?: Array<{ field: string; message: string }>
  ) {
    super(message)
    this.name = 'ValidationError'
    this.details = details || []
  }
}

// ─── validateInput ────────────────────────────────────────────────────────────

/**
 * Validate unknown input against a Zod schema.
 *
 * @throws {ValidationError} with field-level details on the first failure.
 * @returns The fully typed & parsed output of the schema.
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    const firstError = result.error.issues[0]
    throw new ValidationError(
      firstError?.message || 'Invalid input',
      result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }))
    )
  }
  return result.data
}

// ─── sanitizeObject ───────────────────────────────────────────────────────────

/**
 * Recursively sanitize all string values in a plain object.
 *
 * Strips:
 *  - `<script>` tags (including content between open/close)
 *  - HTML event-handler attributes (`onclick=`, `onerror=`, …)
 *  - Null bytes (`\0`) which can cause downstream issues
 *  - Leading/trailing whitespace
 *
 * Non-string values (numbers, booleans, nested objects/arrays) are
 * recursed into without modification.
 *
 * @returns A new sanitized object — the input is never mutated.
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T
): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item: unknown) =>
      typeof item === 'object' && item !== null && !Array.isArray(item)
        ? sanitizeObject(item as Record<string, unknown>)
        : typeof item === 'string'
          ? sanitizeString(item)
          : item
    ) as unknown as T
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      sanitized[key] = value
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value)
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item: unknown) =>
        typeof item === 'object' && item !== null && !Array.isArray(item)
          ? sanitizeObject(item as Record<string, unknown>)
          : typeof item === 'string'
            ? sanitizeString(item)
            : item
      )
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized as T
}

/** Internal: sanitize a single string value. */
function sanitizeString(str: string): string {
  return str
    .replace(/\0/g, '')                                           // Remove null bytes
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Strip script tags + content
    .replace(/<\s*\/?script[^>]*>/gi, '')                          // Catch edge-case broken tags
    .replace(/\bon\w+\s*=\s*[^>]*>/gi, '')                        // Strip inline event handlers
    .replace(/javascript\s*:/gi, '')                              // Strip javascript: URIs
    .trim()
}

// ─── CSP nonce generator ──────────────────────────────────────────────────────

/**
 * Generate a cryptographically random nonce for Content-Security-Policy headers.
 *
 * Usage in middleware:
 *   const nonce = generateNonce()
 *   response.headers.set('x-nonce', nonce)
 *
 * In layout / page `<head>`:
 *   <script nonce={headers.get('x-nonce')} ...>
 */
export function generateNonce(): string {
  const array = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(array)
  } else {
    // Fallback — only used in environments without Web Crypto API
    for (let i = 0; i < 16; i++) array[i] = Math.floor(Math.random() * 256)
  }
  return Buffer.from(array).toString('base64')
}
