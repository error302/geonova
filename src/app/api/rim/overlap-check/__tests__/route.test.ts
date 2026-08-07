/** @jest-environment node */
/**
 * API-level tests for POST /api/rim/overlap-check.
 *
 * Unlike the unit suites, these run the REAL detectOverlaps pipeline
 * (lazy-loaded turf + proj4) end-to-end through the apiHandler wrapper —
 * auth, rate limiting, zod validation, and response shaping are all
 * exercised. Only the external plumbing (DB, auth session, rate limit)
 * is mocked; the geometry is real, so this locks the statutory gate
 * behavior in at the API boundary: a shared RIM boundary (edge-touching
 * parcels) must NOT be rejected, while a genuine overlap must be.
 *
 * Coordinates are the same Kenya UTM 37S squares (EPSG:21037) used by
 * overlapDetection.test.ts, so the API contract is pinned to the exact
 * same geometry the engine integration tests cover.
 */
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

jest.mock('@/lib/security/rateLimit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 10 }),
  getClientIdentifier: jest.fn().mockReturnValue('test-client'),
}))

jest.mock('@/lib/logger', () => ({
  auditLog: jest.fn(),
}))

import { POST } from '../route'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'
import type { QueryResultRow } from 'pg'
import type { ParcelForOverlap } from '@/lib/rim/overlapDetection'

const mockDb = db.query as jest.MockedFunction<typeof db.query>
const mockSession = getServerSession as jest.MockedFunction<typeof getServerSession>

/** Wrap mock rows into a pg QueryResult-like shape. */
function mr(rows: QueryResultRow[]) {
  return {
    rows,
    command: '' as const,
    rowCount: rows.length,
    oid: 0 as const,
    fields: [] as Array<never>,
  }
}

function createAuthSession() {
  return {
    user: { id: 'user-1', email: 'test@metardu.com', name: 'Test' },
    expires: new Date().toISOString(),
  }
}

// ─── Fixtures: 200 m × 200 m squares in UTM 37S (EPSG:21037) ──────────────
const NEW_PARCEL: ParcelForOverlap = {
  parcelNumber: 'LR 1000/1',
  vertices: [
    { easting: 200000, northing: 9900000 },
    { easting: 200000, northing: 9900200 },
    { easting: 200200, northing: 9900200 },
    { easting: 200200, northing: 9900000 },
  ],
}

/** Shares NEW_PARCEL's eastern boundary exactly (both lie on easting = 200200). */
const EDGE_TOUCHING_PARCEL: ParcelForOverlap = {
  parcelNumber: 'LR 1000/4',
  vertices: [
    { easting: 200200, northing: 9900000 },
    { easting: 200200, northing: 9900200 },
    { easting: 200400, northing: 9900200 },
    { easting: 200400, northing: 9900000 },
  ],
}

/** 100 m × 100 m overlap with NEW_PARCEL. */
const OVERLAPPING_PARCEL: ParcelForOverlap = {
  parcelNumber: 'LR 1000/2',
  vertices: [
    { easting: 200100, northing: 9900100 },
    { easting: 200100, northing: 9900300 },
    { easting: 200300, northing: 9900300 },
    { easting: 200300, northing: 9900100 },
  ],
}

function postBody(newParcel: ParcelForOverlap, existingParcels: ParcelForOverlap[]) {
  return JSON.stringify({ newParcel, existingParcels })
}

/** Typed view of the success response so assertions need no unsafe casts. */
interface OverlapCheckSuccess {
  hasOverlaps: boolean
  overlaps: Array<{ existingParcelNumber: string; overlapAreaSqm: number; overlapPercent: number }>
  newParcelAreaSqm: number
  elapsedMs: number
  checkedCount: number
  skippedCount: number
  formatted: string
}

describe('POST /api/rim/overlap-check', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSession.mockResolvedValue(createAuthSession())
    // apiHandler's org-context lookup runs on every authenticated request.
    // It must resolve EMPTY rows, else setCurrentOrgId() is called and the
    // mock factory would need to expose it (the route itself never queries).
    mockDb.mockResolvedValue(mr([]))
  })

  it('ignores shared RIM boundaries (edge-touching parcels) at the API gate', async () => {
    const req = new NextRequest('http://localhost/api/rim/overlap-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: postBody(NEW_PARCEL, [EDGE_TOUCHING_PARCEL]),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const data = (await res.json()) as OverlapCheckSuccess
    expect(data.hasOverlaps).toBe(false)
    expect(data.overlaps).toHaveLength(0)
    expect(data.checkedCount).toBe(1)
    expect(data.skippedCount).toBe(0)
    expect(data.formatted).toMatch(/No overlaps detected/)
  })

  it('flags genuine overlaps at the API gate', async () => {
    const req = new NextRequest('http://localhost/api/rim/overlap-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: postBody(NEW_PARCEL, [OVERLAPPING_PARCEL]),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const data = (await res.json()) as OverlapCheckSuccess
    expect(data.hasOverlaps).toBe(true)
    expect(data.overlaps).toHaveLength(1)
    expect(data.overlaps[0].existingParcelNumber).toBe('LR 1000/2')
    // 100 m × 100 m intersection; turf round-trips through lon/lat, so allow distortion
    expect(data.overlaps[0].overlapAreaSqm).toBeGreaterThan(9500)
    expect(data.overlaps[0].overlapAreaSqm).toBeLessThan(10500)
    expect(data.newParcelAreaSqm).toBe(40000)
    expect(data.checkedCount).toBe(1)
    expect(data.skippedCount).toBe(0)
  })

  it('rejects a malformed payload with 400 VALIDATION_ERROR', async () => {
    // existingParcels entry is missing its required `vertices` array
    const req = new NextRequest('http://localhost/api/rim/overlap-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newParcel: NEW_PARCEL,
        existingParcels: [{ parcelNumber: 'LR 1000/2' }],
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)

    const data = (await res.json()) as { error: string; code: string }
    expect(data.error).toMatch(/validation/i)
    expect(data.code).toBe('VALIDATION_ERROR')
  })

  it('requires authentication (401 when no session)', async () => {
    mockSession.mockResolvedValue(null)
    const req = new NextRequest('http://localhost/api/rim/overlap-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: postBody(NEW_PARCEL, [EDGE_TOUCHING_PARCEL]),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)

    const data = (await res.json()) as { error: string; code: string }
    expect(data.code).toBe('UNAUTHORIZED')
  })
})
