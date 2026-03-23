/**
 * Strict Global API Response Envelope
 * Complies with Priority Pillar 10/10 for API Design.
 * Never leak internal implementation details via error bounds.
 */

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  meta?: Record<string, any>
}

export function apiSuccess<T>(data: T, meta?: Record<string, any>): ApiResponse<T> {
  return {
    data,
    error: null,
    meta,
  }
}

export function apiError(error: string, meta?: Record<string, any>): ApiResponse<null> {
  return {
    data: null,
    error,
    meta,
  }
}
