/**
 * @jest-environment node
 *
 * END-TO-END tests for /api/cpd (audit H9 follow-up "make it work",
 * 2026-08-31).
 *
 * The page previously rendered through a stub's field shape (blank rows,
 * "Invalid Date"); the honesty pass rewired it to the real API. These tests
 * pin the FULL data flow at the API boundary so it cannot silently regress:
 *
 *   1. GET returns the REAL cpd_records field shape INCLUDING the approval
 *      state — `approved` and `rejection_reason` must be exposed, because
 *      the page distinguishes "Counted" / "Pending approval" / "Rejected"
 *      (previously every pending entry rendered as verified).
 *   2. GET ?action=summary returns the approved-only total + pending count
 *      + annual cap (the page's summary cards use this).
 *   3. POST creates manual entries with approved=FALSE through the real
 *      zod schema (pending entries must NOT count toward the total).
 *   4. POST validation rejects short descriptions and out-of-range points.
 *   5. Non-admin users cannot read another user's records.
 *   6. GET ?action=verify is the public certificate verification path.
 */
import type { NextRequest } from 'next/server'

jest.mock('@/lib/db', () => ({
  db: { query: jest.fn() },
  setCurrentUserId: jest.fn(),
  setCurrentOrgId: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/security/rateLimit', () =>
  jest.requireActual<typeof import('@/test-utils/rate-limit')>('@/test-utils/rate-limit').mockRateLimitModule())

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  auditLog: jest.fn(),
}))

import { GET, POST } from '../route'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { createAuthSession } from '@/test-utils/auth-session'
import { mr } from '@/test-utils/mock-rows'
import { makeRequest } from '@/test-utils/request'

const mockDb = db.query as jest.MockedFunction<typeof db.query>
const mockSession = getServerSession as jest.MockedFunction<typeof getServerSession>

const USER = '11111111-1111-1111-1111-111111111111'
const OTHER_USER = '99999999-9999-9999-9999-999999999999'

/** Row shape as lib/cpd.ts's SELECT * returns it from cpd_records. */
function cpdRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    user_id: USER,
    activity: 'JOB_COMPLETED',
    points: 3,
    description: 'Completed survey job',
    earned_at: new Date('2026-05-01T10:00:00Z'),
    reference_id: 'job-42',
    verifiable: true,
    approved: true,
    rejection_reason: null,
    ...overrides,
  }
}

describe('/api/cpd (end-to-end through apiHandler)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSession.mockResolvedValue(createAuthSession(USER))
    mockDb.mockResolvedValue(mr([]))
  })

  // ─── 1. GET full records ────────────────────────────────────────────────

  it('returns the real cpd_records shape including approval state', async () => {
    mockDb.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM cpd_records') && sql.includes('ORDER BY')) {
        return mr([
          cpdRow({ id: 'a', approved: true, points: 3 }),
          cpdRow({
            id: 'b', activity: 'TRAINING_COMPLETED', points: 8,
            approved: false, rejection_reason: null, reference_id: null,
          }),
          cpdRow({
            id: 'c', activity: 'CONFERENCE_ATTENDED', points: 0,
            approved: false, rejection_reason: 'no evidence provided',
          }),
        ])
      }
      if (sql.includes('COALESCE(SUM(points)')) {
        return mr([{ total: '3' }])
      }
      return mr([])
    })

    const res = await GET(makeRequest('/api/cpd?year=2026') as NextRequest)
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      records: Array<{ approved?: boolean; rejectionReason?: string; points: number }>
      total: number
      year: number
    }

    expect(data.records).toHaveLength(3)
    // approval state must survive the row → API mapping
    expect(data.records[0].approved).toBe(true)
    expect(data.records[1].approved).toBe(false)
    expect(data.records[2].rejectionReason).toBe('no evidence provided')
    // total counts APPROVED records only (the pending 8 and rejected 0 excluded)
    expect(data.total).toBe(3)
  })

  it('scopes queries to the authenticated user', async () => {
    mockDb.mockResolvedValue(mr([]))
    await GET(makeRequest('/api/cpd?year=2026') as NextRequest)
    for (const call of mockDb.mock.calls) {
      const sql = String(call[0])
      if (sql.includes('FROM cpd_records')) {
        expect(sql).toContain('user_id = $1')
      }
    }
  })
  it('rejects unauthenticated access', async () => {
    mockSession.mockResolvedValue(null)
    const res = await GET(makeRequest('/api/cpd?year=2026') as NextRequest)
    expect(res.status).toBe(401)
  })

  it('non-admins cannot request another user’s records', async () => {
    mockDb.mockResolvedValue(mr([]))
    const res = await GET(makeRequest(`/api/cpd?userId=${OTHER_USER}`) as NextRequest)
    expect(res.status).toBe(200)
    // the query must still bind the OWN user id, not the requested one
    const calls: Array<[string, unknown]> = mockDb.mock.calls.map(
      (c: unknown[]) => [String(c[0]), c[1]])
    const recordsCall = calls.find(([sql]) =>
      sql.includes('FROM cpd_records') && sql.includes('ORDER BY'))
    expect(recordsCall).toBeDefined()
    expect(recordsCall?.[1]).toContain(USER)
    expect(recordsCall?.[1]).not.toContain(OTHER_USER)
  })

  // ─── 2. GET ?action=summary ─────────────────────────────────────────────

  it('summary returns approved total, pending count and cap', async () => {
    mockDb.mockImplementation(async (sql: string) => {
      if (sql.includes('FILTER (WHERE approved = TRUE)')) {
        return mr([{ total: '12', pending_count: '2' }])
      }
      return mr([])
    })

    const res = await GET(makeRequest('/api/cpd?action=summary&year=2026') as NextRequest)
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      summary: { total: number; pending: number; cap: number; remaining: number }
    }
    expect(data.summary.total).toBe(12)
    expect(data.summary.pending).toBe(2)
    expect(data.summary.cap).toBe(100)
    expect(data.summary.remaining).toBe(88)
  })

  // ─── 3. GET ?action=verify (public certificate verification) ────────────

  it('verify looks up certificates case-insensitively by code', async () => {
    mockDb.mockImplementation(async (sql: string) => {
      if (sql.includes('cpd_certificates')) {
        return mr([{
          id: 'cert-1', user_id: USER, year: 2026, total_points: 20,
          verification_code: 'ABCD12', generated_at: new Date('2026-06-01'),
          pdf_path: null, profile_name: 'Jane Surveyor', isk_number: 'ISK/1234',
          cpd_records: [],
        }])
      }
      return mr([])
    })

    const res = await GET(makeRequest('/api/cpd?action=verify&code=abcd12') as NextRequest)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { certificate: { verificationCode: string } }
    expect(data.certificate.verificationCode).toBe('ABCD12')
  })

  // ─── 4. POST manual entries ─────────────────────────────────────────────

  it('creates a manual entry as PENDING (approved=false) through the real schema', async () => {
    const insertedParams: unknown[] = []
    mockDb.mockImplementation(async (sql: unknown, params?: unknown[]) => {
      const sqlText = String(sql)
      if (sqlText.includes('INSERT INTO cpd_records')) {
        insertedParams.push(...(params ?? []))
        return mr([{ id: 'new-cpd-id' }])
      }
      if (sqlText.includes('COALESCE(SUM(points)')) {
        return mr([{ total: '0' }]) // annual cap check
      }
      if (sqlText.includes('SELECT id FROM cpd_records')) {
        return mr([]) // no duplicate
      }
      return mr([])
    })

    const res = await POST(makeRequest('/api/cpd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        activity: 'TRAINING_COMPLETED',
        description: 'Attended a two-day GIS training workshop',
        points: 8,
        referenceId: 'CERT-2026-001',
      },
    }) as NextRequest)

    expect(res.status).toBe(201)
    const data = (await res.json()) as { id: string; status: string }
    expect(data.id).toBe('new-cpd-id')
    expect(data.status).toBe('pending_approval')

    // the INSERT must hard-code approved=FALSE — pending entries never count
    const insertSql = String(mockDb.mock.calls.find(
      ([sql]) => String(sql).includes('INSERT INTO cpd_records'),
    )?.[0] ?? '')
    expect(insertSql).toMatch(/,\s*FALSE\s*,\s*\$1/)   // approved literal before awarded_by
    expect(insertedParams).toContain(USER)
  })

  it('rejects descriptions shorter than 10 characters', async () => {
    const res = await POST(makeRequest('/api/cpd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { activity: 'MANUAL_ENTRY', description: 'short', points: 1 },
    }) as NextRequest)
    expect(res.status).toBe(400)
  })

  it('rejects points above the 50-point cap', async () => {
    const res = await POST(makeRequest('/api/cpd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { activity: 'TRAINING_COMPLETED', description: 'A very long training indeed', points: 51 },
    }) as NextRequest)
    expect(res.status).toBe(400)
  })

  it('rejects non-manual activity types (they are system-awarded)', async () => {
    const res = await POST(makeRequest('/api/cpd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { activity: 'JOB_COMPLETED', description: 'Completed a survey job', points: 3 },
    }) as NextRequest)
    expect(res.status).toBe(400)
  })
})
