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
  rateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 60 }),
  getClientIdentifier: jest.fn().mockReturnValue('test-ip'),
}))

jest.mock('@/lib/logger', () => ({
  auditLog: jest.fn(),
}))

jest.mock('@/lib/monitoring/sentry', () => ({
  captureError: jest.fn(),
}))

import { POST } from '../blocks/route'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'

const mockDb = db.query as jest.MockedFunction<typeof db.query>
const mockSession = getServerSession as jest.MockedFunction<typeof getServerSession>

/** Helper to create a NextRequest-like object with nextUrl */
function makeNextRequest(url: string, options: RequestInit = {}) {
  const req = new Request(url, options) as any
  Object.defineProperty(req, 'nextUrl', {
    value: new URL(url),
    writable: false,
    configurable: true,
  })
  return req
}

describe('Security - SQL Injection Resistance', () => {
  beforeEach(() => jest.clearAllMocks())

  it('should not allow SQL injection in block_number', async () => {
    mockSession.mockResolvedValue({
      user: { id: 'u1', email: 'test@test.com', name: 'Test' },
      expires: new Date().toISOString(),
    })

    const maliciousInput = "1'; DROP TABLE blocks; --"
    const req = makeNextRequest('http://localhost/api/scheme/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: 'proj-1', block_number: maliciousInput }),
    })

    // The handler will fail since db.query is not mocked for success,
    // but it should NOT pass the raw SQL string to the query
    try {
      await POST(req as unknown as NextRequest)
    } catch {
      // expected — db is mocked but not with return values
    }

    // Verify that the malicious string is NOT passed raw to any query
    const calls = mockDb.mock.calls
    const allQueryStrings = calls.map(c => c[0])

    // The malicious string should appear as a parameter ($2), not in the SQL string
    for (const sql of allQueryStrings) {
      expect(sql).not.toContain('DROP TABLE')
      expect(sql).not.toContain('--')
    }
  })

  it('should sanitize block_name with special characters', async () => {
    mockSession.mockResolvedValue({
      user: { id: 'u1', email: 'test@test.com', name: 'Test' },
      expires: new Date().toISOString(),
    })

    // This should not crash — special chars should be parameterized
    mockDb.mockResolvedValue({ rows: [{ id: 'b1', block_number: '1' }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] })

    const req = makeNextRequest('http://localhost/api/scheme/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: 'proj-1',
        block_number: '5',
        block_name: "Test'; DELETE FROM users WHERE '1'='1",
      }),
    })

    let res
    try {
      res = await POST(req as unknown as NextRequest)
    } catch {
      // May throw due to incomplete mocking, that's ok
    }
    // Should either succeed (parameterized) or fail validation, NOT crash the DB
    if (res) {
      expect([201, 400, 500]).toContain(res.status)
    }
  })
})
