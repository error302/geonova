/**
 * API Handler Tests — tests the core apiHandler wrapper
 * Run: npx jest src/app/api/__tests__/apiHandler.test.ts
 */

import { describe, it, expect } from '@jest/globals'
import { ApiError } from '@/lib/api/client'

describe('ApiError', () => {
  it('ApiError is constructable with status, code, message', () => {
    const err = new ApiError(401, 'UNAUTHORIZED', 'Not authenticated')
    expect(err.status).toBe(401)
    expect(err.code).toBe('UNAUTHORIZED')
    expect(err.message).toBe('Not authenticated')
    expect(err.isUnauthorized).toBe(true)
    expect(err.isForbidden).toBe(false)
    expect(err.isValidation).toBe(false)
    expect(err.isNotFound).toBe(false)
  })

  it('isForbidden returns true for 403 and PERMISSION_DENIED', () => {
    const err = new ApiError(403, 'FORBIDDEN', 'Forbidden')
    expect(err.isForbidden).toBe(true)
    const err2 = new ApiError(403, 'PERMISSION_DENIED', 'Denied')
    expect(err2.isForbidden).toBe(true)
  })

  it('isValidation returns true for VALIDATION_ERROR', () => {
    const err = new ApiError(400, 'VALIDATION_ERROR', 'Bad request', {
      issues: [{ code: 'custom', path: ['name'], message: 'Required' }],
    })
    expect(err.isValidation).toBe(true)
    expect(err.issues).toHaveLength(1)
  })

  it('isNotFound returns true for 404 and NOT_FOUND', () => {
    const err = new ApiError(404, 'NOT_FOUND', 'Not found')
    expect(err.isNotFound).toBe(true)
  })

  it('isRateLimited returns true for 429', () => {
    const err = new ApiError(429, 'RATE_LIMITED', 'Too many requests')
    expect(err.isRateLimited).toBe(true)
  })
})
