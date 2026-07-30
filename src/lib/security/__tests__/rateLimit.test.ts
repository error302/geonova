/**
 * Tests for rateLimit — middleware-level rate limiting.
 *
 * Tests cover:
 *   - RATE_LIMITS constant structure (the export that was missing and
 *     broke every API request from 2026-05-29 to 2026-07-05)
 *   - RateLimitCategory type
 *   - In-memory rate limit counter (no env vars = in-memory fallback)
 *   - getClientIdentifier (X-Forwarded-For parsing)
 */

import { rateLimit, getClientIdentifier, RATE_LIMITS, type RateLimitCategory } from '../rateLimit'

const ORIGINAL_UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const ORIGINAL_UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
})

afterAll(() => {
  if (ORIGINAL_UPSTASH_URL !== undefined) process.env.UPSTASH_REDIS_REST_URL = ORIGINAL_UPSTASH_URL
  if (ORIGINAL_UPSTASH_TOKEN !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = ORIGINAL_UPSTASH_TOKEN
})

describe('RATE_LIMITS (the export that was missing for 6 weeks)', () => {
  it('is a Record<RateLimitCategory, {max, windowMs}>', () => {
    expect(RATE_LIMITS).toBeDefined()
    expect(typeof RATE_LIMITS).toBe('object')
  })

  it('includes the api category (default for /api/* routes)', () => {
    expect(RATE_LIMITS.api).toBeDefined()
    expect(typeof RATE_LIMITS.api.max).toBe('number')
    expect(typeof RATE_LIMITS.api.windowMs).toBe('number')
  })

  it('includes all 6 categories referenced by middleware.ts', () => {
    const requiredCategories: RateLimitCategory[] = [
      'api', 'auth', 'submission', 'upload', 'mpesa', 'export',
    ]
    for (const cat of requiredCategories) {
      expect(RATE_LIMITS[cat]).toBeDefined()
      expect(RATE_LIMITS[cat].max).toBeGreaterThan(0)
      expect(RATE_LIMITS[cat].windowMs).toBeGreaterThan(0)
    }
  })

  it('auth has a tighter limit than api (slows brute-force attempts)', () => {
    expect(RATE_LIMITS.auth.max).toBeLessThan(RATE_LIMITS.api.max)
  })

  it('submission/mpesa/upload have tighter limits than api (heavy work)', () => {
    expect(RATE_LIMITS.submission.max).toBeLessThanOrEqual(RATE_LIMITS.api.max)
    expect(RATE_LIMITS.mpesa.max).toBeLessThanOrEqual(RATE_LIMITS.api.max)
    expect(RATE_LIMITS.upload.max).toBeLessThanOrEqual(RATE_LIMITS.api.max)
  })

  it('all windows are in milliseconds', () => {
    for (const cat of Object.keys(RATE_LIMITS) as RateLimitCategory[]) {
      const w = RATE_LIMITS[cat].windowMs
      expect(w).toBeGreaterThanOrEqual(1000)
      expect(w).toBeLessThanOrEqual(60 * 60 * 1000)
    }
  })
})

describe('rateLimit (in-memory implementation)', () => {
  it('allows the first request', async () => {
    const r = await rateLimit('test-allow-first', 5, 60000)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(4)
  })

  it('counts down the remaining quota', async () => {
    const id = 'test-countdown'
    await rateLimit(id, 5, 60000)
    await rateLimit(id, 5, 60000)
    const r = await rateLimit(id, 5, 60000)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(2)
  })

  it('blocks requests after the quota is exhausted', async () => {
    const id = 'test-block'
    for (let i = 0; i < 5; i++) {
      await rateLimit(id, 5, 60000)
    }
    const r = await rateLimit(id, 5, 60000)
    expect(r.allowed).toBe(false)
    expect(r.remaining).toBe(0)
  })

  it('uses separate counters per identifier', async () => {
    await rateLimit('ip-A', 3, 60000)
    await rateLimit('ip-A', 3, 60000)
    const r = await rateLimit('ip-B', 3, 60000)
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(2)
  })

  it('accepts default parameters (60 req/min)', async () => {
    const r = await rateLimit('test-defaults')
    expect(r.allowed).toBe(true)
  })
})

describe('getClientIdentifier', () => {
  it('extracts the first IP from X-Forwarded-For', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(getClientIdentifier(req)).toBe('1.2.3.4')
  })

  it('handles a single IP in X-Forwarded-For', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    expect(getClientIdentifier(req)).toBe('1.2.3.4')
  })

  it('trims whitespace around IPs', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '  1.2.3.4  , 5.6.7.8' },
    })
    expect(getClientIdentifier(req)).toBe('1.2.3.4')
  })

  it('returns "unknown" when X-Forwarded-For is missing', () => {
    const req = new Request('https://example.com')
    expect(getClientIdentifier(req)).toBe('unknown')
  })

  it('returns "unknown" when X-Forwarded-For is empty', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '' },
    })
    expect(getClientIdentifier(req)).toBe('unknown')
  })
})
