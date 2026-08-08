/** @jest-environment node */
/**
 * Tests for /api/scheme/blocks endpoint
 * Tests validation, auth, and CRUD operations
 */

jest.mock('@/lib/db', () => ({
  db: { query: jest.fn() },
  setCurrentUserId: jest.fn(),
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

// POST route enables apiHandler auditChain, which calls appendAuditEntry
// AFTER the 2xx response. Without mocking this module, the real function
// issues 2 extra db.query calls (chain tail SELECT + INSERT), breaking the
// deterministic call-count assertions below.
jest.mock('@/lib/audit/auditLog', () => ({
  appendAuditEntry: jest.fn().mockResolvedValue({ id: 'audit-entry-1' }),
}))

import { POST, GET } from '../blocks/route'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'

const mockDb = db.query as jest.MockedFunction<typeof db.query>
const mockSession = getServerSession as jest.MockedFunction<typeof getServerSession>

const TEST_UUID = '00000000-0000-0000-0000-000000000001'

/** Wrap mock rows into a pg QueryResult-like shape */
// eslint-disable-next-line
function mr(rows: any[]) {
  return { rows, command: '' as const, rowCount: rows.length, oid: 0 as const, fields: [] as any }
}

function createMockRequest(body: any): NextRequest {
  return new NextRequest('http://localhost/api/scheme/blocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function createAuthSession(userId = 'user-1') {
  return {
    user: { id: userId, email: 'test@metardu.com', name: 'Test User' },
    expires: new Date().toISOString(),
  }
}

describe('POST /api/scheme/blocks', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should reject unauthenticated requests', async () => {
    mockSession.mockResolvedValue(null)
    const req = createMockRequest({ project_id: TEST_UUID, block_number: '1' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('should require project_id', async () => {
    mockSession.mockResolvedValue(createAuthSession())
    const req = createMockRequest({ block_number: '1' })
    const res = await POST(req)
    const data = (await res.json()) as { error: string; issues: { path: (string | number)[] }[] }
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/validation/i)
    const fieldPaths = data.issues.map((e) => e.path.join('.'))
    expect(fieldPaths.some((f: string) => f.includes('project_id'))).toBe(true)
  })

  it('should require block_number', async () => {
    mockSession.mockResolvedValue(createAuthSession())
    const req = createMockRequest({ project_id: TEST_UUID })
    const res = await POST(req)
    const data = (await res.json()) as { error: string; issues: { path: (string | number)[] }[] }
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/validation/i)
    const fieldPaths = data.issues.map((e) => e.path.join('.'))
    expect(fieldPaths.some((f: string) => f.includes('block_number'))).toBe(true)
  })

  it('should create a block with valid input', async () => {
    mockSession.mockResolvedValue(createAuthSession())
    // First mock call: apiHandler's organization_members lookup (returns no orgs)
    // Then: route's project check, route's dup check, route's INSERT
    mockDb
      .mockResolvedValueOnce(mr([]))                                                                              // org lookup
      .mockResolvedValueOnce(mr([{ id: 1, project_type: 'scheme' }]))                                              // project check
      .mockResolvedValueOnce(mr([]))                                                                               // dup check
      .mockResolvedValueOnce(mr([{ id: 'block-1', block_number: '1', project_id: TEST_UUID, block_name: 'Block A' }])) // INSERT

    const req = createMockRequest({ project_id: TEST_UUID, block_number: '1', block_name: 'Block A' })
    const res = await POST(req)
    const data = (await res.json()) as { data: { block_number: string; block_name: string } }

    expect(res.status).toBe(201)
    expect(data.data.block_number).toBe('1')
    expect(data.data.block_name).toBe('Block A')
    expect(mockDb).toHaveBeenCalledTimes(4)
  })

  it('should reject duplicate block_number for same project', async () => {
    mockSession.mockResolvedValue(createAuthSession())
    // org lookup, then project check, then dup check (returns existing block)
    mockDb
      .mockResolvedValueOnce(mr([]))                                                                              // org lookup
      .mockResolvedValueOnce(mr([{ id: 1, project_type: 'scheme' }]))                                              // project check
      .mockResolvedValueOnce(mr([{ id: 'existing-block' }]))                                                       // dup check

    const req = createMockRequest({ project_id: TEST_UUID, block_number: '1' })
    const res = await POST(req)
    const data = (await res.json()) as { error: string }

    expect(res.status).toBe(409)
    expect(data.error).toMatch(/duplicate|already exists/i)
  })
})

describe('GET /api/scheme/blocks', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should reject unauthenticated requests', async () => {
    mockSession.mockResolvedValue(null)
    const req = new NextRequest(`http://localhost/api/scheme/blocks?project_id=${TEST_UUID}`)
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('should require project_id parameter', async () => {
    mockSession.mockResolvedValue(createAuthSession())
    const req = new NextRequest('http://localhost/api/scheme/blocks')
    const res = await GET(req)
    const data = await res.json()
    expect(res.status).toBe(400)
  })

  it('should return blocks with parcel counts', async () => {
    mockSession.mockResolvedValue(createAuthSession())
    // First mock: apiHandler's org lookup. Then: route's project check, route's GET blocks.
    mockDb
      .mockResolvedValueOnce(mr([]))                                                                                  // org lookup
      .mockResolvedValueOnce(mr([{ id: 1 }]))                                                                          // project check
      .mockResolvedValueOnce(mr([
        { id: 'b1', block_number: '1', block_name: 'A', parcel_count: 5, completed_count: 3 },
        { id: 'b2', block_number: '2', block_name: 'B', parcel_count: 3, completed_count: 0 },
      ]))

    const req = new NextRequest(`http://localhost/api/scheme/blocks?project_id=${TEST_UUID}`)
    const res = await GET(req)
    const data = (await res.json()) as { data: { parcel_count: number }[] }

    expect(res.status).toBe(200)
    expect(data.data).toHaveLength(2)
    expect(data.data[0].parcel_count).toBe(5)
  })
})
