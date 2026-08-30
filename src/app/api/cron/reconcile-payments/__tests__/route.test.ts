/**
 * @jest-environment node
 *
 * Contract tests for the general payments reconciliation sweep
 * (/api/cron/reconcile-payments).
 *
 * Pins: the API_ADMIN_KEY bearer gate (fail-closed), stale-intent expiry
 * (only pending/processing older than 48h — never completed/failed rows),
 * stale Till-claim flagging (metadata.staleReview, never auto-failed), and
 * the monitoring summary shape.
 */
import type { NextRequest } from 'next/server'
import { makeRequest } from '@/test-utils/request'
import { mr } from '@/test-utils/mock-rows'

jest.mock('@/lib/db', () => ({
  db: { query: jest.fn() },
}))
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { POST } from '../route'
import { db } from '@/lib/db'

const mockDbQuery = db.query as jest.MockedFunction<typeof db.query>

const KEY = 'cron-admin-key-9d3f'

beforeEach(() => {
  jest.clearAllMocks()
  process.env.API_ADMIN_KEY = KEY
})

afterEach(() => {
  delete process.env.API_ADMIN_KEY
})

function cronRequest(bearer?: string): NextRequest {
  return makeRequest('/api/cron/reconcile-payments', {
    method: 'POST',
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
  }) as NextRequest
}

describe('POST /api/cron/reconcile-payments — auth', () => {
  test('missing bearer → 401', async () => {
    const res = await POST(cronRequest())
    expect(res.status).toBe(401)
    expect(mockDbQuery).not.toHaveBeenCalled()
  })

  test('wrong key → 401', async () => {
    const res = await POST(cronRequest('wrong-key'))
    expect(res.status).toBe(401)
    expect(mockDbQuery).not.toHaveBeenCalled()
  })

  test('no API_ADMIN_KEY configured → 401 (fail closed, never open)', async () => {
    delete process.env.API_ADMIN_KEY
    const res = await POST(cronRequest(KEY))
    expect(res.status).toBe(401)
    expect(mockDbQuery).not.toHaveBeenCalled()
  })

  test('correct key → sweep runs', async () => {
    mockDbQuery
      .mockResolvedValueOnce(mr([{ id: 'i1', payment_method: 'mpesa' }])) // expired intents
      .mockResolvedValueOnce(mr([])) // flagged claims
      .mockResolvedValueOnce(mr([{ status: 'completed', count: '3' }])) // intent summary
      .mockResolvedValueOnce(mr([{ status: 'pending_review', count: '2' }])) // claim summary

    const res = await POST(cronRequest(KEY))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.expiredIntents).toBe(1)
    expect(body.expiredIntentIds).toEqual(['i1'])
    expect(body.intentStatusCounts).toEqual({ completed: 3 })
    expect(body.tillClaimStatusCounts).toEqual({ pending_review: 2 })
  })
})

describe('POST /api/cron/reconcile-payments — stale-intent expiry SQL', () => {
  beforeEach(() => {
    mockDbQuery
      .mockResolvedValueOnce(mr([]))
      .mockResolvedValueOnce(mr([]))
      .mockResolvedValueOnce(mr([]))
      .mockResolvedValueOnce(mr([]))
  })

  test('expires ONLY pending/processing intents older than 48h — guarded + idempotent', async () => {
    await POST(cronRequest(KEY))

    const [sql, params] = mockDbQuery.mock.calls[0]
    expect(sql).toContain("SET status = 'failed'")
    expect(sql).toContain("WHERE status IN ('pending', 'processing')")
    expect(sql).toContain('expired_stale_intent')
    // The age cutoff is a parameter (48 hours), applied on created_at
    expect(sql).toContain('created_at < NOW() -')
    expect(params).toEqual(['48'])
  })

  test('never touches completed or failed intents', async () => {
    await POST(cronRequest(KEY))
    const [sql] = mockDbQuery.mock.calls[0]
    // The status guard in the WHERE clause is the idempotency contract:
    // completed/failed rows fall outside the predicate on every re-run.
    expect(sql).toMatch(/WHERE status IN \('pending', 'processing'\)/)
  })
})

describe('POST /api/cron/reconcile-payments — stale Till-claim flagging', () => {
  beforeEach(() => {
    mockDbQuery
      .mockResolvedValueOnce(mr([]))
      .mockResolvedValueOnce(mr([]))
      .mockResolvedValueOnce(mr([]))
      .mockResolvedValueOnce(mr([]))
  })

  test('flags pending_review Till claims older than 7 days — does NOT auto-fail them', async () => {
    await POST(cronRequest(KEY))

    const [sql, params] = mockDbQuery.mock.calls[1]
    expect(sql).toContain('"staleReview":true')
    // The claim stays pending_review — human adjudication, not auto-reject
    expect(sql).toContain("WHERE status = 'pending_review'")
    expect(sql).toContain("payment_method = 'mpesa_till'")
    expect(sql).toContain('created_at < NOW() -')
    expect(params).toEqual(['7'])
  })

  test('re-running is a no-op: already-flagged claims are excluded', async () => {
    await POST(cronRequest(KEY))
    const [sql] = mockDbQuery.mock.calls[1]
    // The COALESCE guard means a second sweep updates nothing
    expect(sql).toContain("COALESCE(metadata->>'staleReview', 'false') <> 'true'")
  })
})

describe('POST /api/cron/reconcile-payments — failure handling', () => {
  test('DB error → 500 with a generic message (no internals leaked)', async () => {
    mockDbQuery.mockRejectedValueOnce(new Error('connection refused'))
    const res = await POST(cronRequest(KEY))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Reconciliation sweep failed')
  })
})
