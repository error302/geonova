/**
 * Tests for auth/ownership — IDOR protection helpers.
 *
 * These tests mock the `db` module to verify the ownership-check logic
 * without needing a real database. The helpers are critical security
 * primitives — every API route that takes a project_id, survey_point_id,
 * or version_id should call them.
 */

// Mock the db module before importing the unit under test.
jest.mock('@/lib/db', () => ({
  db: { query: jest.fn() },
  setCurrentUserId: jest.fn(),
  setCurrentOrgId: jest.fn(),
}))

// Mock NextResponse — the real implementation needs the Next.js runtime
// which isn't available in Jest's jsdom environment. We replace it with
// a minimal stub that records the body + status for assertions.
const mockJson = jest.fn((body: unknown, init?: { status?: number }) => {
  const resp = {
    status: init?.status ?? 200,
    _body: body,
    async json() { return this._body },
  }
  return resp
})
jest.mock('next/server', () => ({
  NextResponse: { json: mockJson },
}))

import { db } from '@/lib/db'
import {
  requireProjectOwnership,
  requireSurveyPointOwnership,
  requireVersionOwnership,
} from '../ownership'

const mockDb = db.query as jest.MockedFunction<typeof db.query>

// Helper to build a fake pg QueryResult-like object
function rows(rows: any[]) {
  return {
    rows,
    command: '' as const,
    rowCount: rows.length,
    oid: 0 as const,
    fields: [] as any[],
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('requireProjectOwnership', () => {
  it('returns ok:true when the project belongs to the user', async () => {
    mockDb.mockResolvedValueOnce(rows([{ user_id: 'user-1' }]))
    const result = await requireProjectOwnership('proj-1', 'user-1')
    expect(result.ok).toBe(true)
    expect(result.projectUserId).toBe('user-1')
    expect(result.error).toBeUndefined()
  })

  it('returns ok:false with 404 when the project does not exist', async () => {
    mockDb.mockResolvedValueOnce(rows([]))
    const result = await requireProjectOwnership('missing', 'user-1')
    expect(result.ok).toBe(false)
    expect(result.error).toBeDefined()
    // Verify the error response is a 404
    const resp = result.error!
    expect(resp.status).toBe(404)
  })

  it('returns ok:false with 403 when the project belongs to another user', async () => {
    mockDb.mockResolvedValueOnce(rows([{ user_id: 'user-2' }]))
    const result = await requireProjectOwnership('proj-1', 'user-1')
    expect(result.ok).toBe(false)
    expect(result.projectUserId).toBe('user-2')
    expect(result.error).toBeDefined()
    expect(result.error!.status).toBe(403)
  })

  it('returns ok:true for legacy projects with null user_id (no lockout)', async () => {
    // Projects created before user_id was added must remain accessible
    mockDb.mockResolvedValueOnce(rows([{ user_id: null }]))
    const result = await requireProjectOwnership('legacy-1', 'user-1')
    expect(result.ok).toBe(true)
    expect(result.projectUserId).toBeNull()
  })

  it('returns ok:true when called with no userId (legacy compatibility)', async () => {
    mockDb.mockResolvedValueOnce(rows([{ user_id: null }]))
    const result = await requireProjectOwnership('proj-1', undefined)
    expect(result.ok).toBe(true)
  })

  it('queries the projects table with the correct SQL', async () => {
    mockDb.mockResolvedValueOnce(rows([{ user_id: 'user-1' }]))
    await requireProjectOwnership('proj-1', 'user-1')
    expect(mockDb).toHaveBeenCalledTimes(1)
    const [sql, params] = mockDb.mock.calls[0]
    expect(sql).toContain('SELECT user_id FROM projects')
    expect(sql).toContain('WHERE id = $1')
    expect(params).toEqual(['proj-1'])
  })
})

describe('requireSurveyPointOwnership', () => {
  it('returns ok:true when the survey point belongs to the user project', async () => {
    mockDb.mockResolvedValueOnce(rows([{ user_id: 'user-1' }]))
    const result = await requireSurveyPointOwnership('sp-1', 'user-1')
    expect(result.ok).toBe(true)
    expect(result.projectUserId).toBe('user-1')
  })

  it('returns ok:false with 404 when the survey point does not exist', async () => {
    mockDb.mockResolvedValueOnce(rows([]))
    const result = await requireSurveyPointOwnership('missing', 'user-1')
    expect(result.ok).toBe(false)
    expect(result.error!.status).toBe(404)
  })

  it('returns ok:false with 403 when the survey point belongs to another user', async () => {
    mockDb.mockResolvedValueOnce(rows([{ user_id: 'user-2' }]))
    const result = await requireSurveyPointOwnership('sp-1', 'user-1')
    expect(result.ok).toBe(false)
    expect(result.error!.status).toBe(403)
  })

  it('joins survey_points to projects via project_id', async () => {
    mockDb.mockResolvedValueOnce(rows([{ user_id: 'user-1' }]))
    await requireSurveyPointOwnership('sp-1', 'user-1')
    const [sql, params] = mockDb.mock.calls[0]
    expect(sql).toContain('survey_points sp')
    expect(sql).toContain('JOIN projects p')
    expect(sql).toContain('ON p.id = sp.project_id')
    expect(sql).toContain('WHERE sp.id = $1')
    expect(params).toEqual(['sp-1'])
  })
})

describe('requireVersionOwnership', () => {
  it('returns ok:true when the version belongs to the user project', async () => {
    mockDb.mockResolvedValueOnce(rows([{ user_id: 'user-1' }]))
    const result = await requireVersionOwnership('v-1', 'user-1')
    expect(result.ok).toBe(true)
    expect(result.projectUserId).toBe('user-1')
  })

  it('returns ok:false with 404 when the version does not exist', async () => {
    mockDb.mockResolvedValueOnce(rows([]))
    const result = await requireVersionOwnership('missing', 'user-1')
    expect(result.ok).toBe(false)
    expect(result.error!.status).toBe(404)
  })

  it('returns ok:false with 403 when the version belongs to another user', async () => {
    mockDb.mockResolvedValueOnce(rows([{ user_id: 'user-2' }]))
    const result = await requireVersionOwnership('v-1', 'user-1')
    expect(result.ok).toBe(false)
    expect(result.error!.status).toBe(403)
  })

  it('uses LEFT JOIN (version may not have a project_id for legacy entries)', async () => {
    mockDb.mockResolvedValueOnce(rows([{ user_id: null }]))
    await requireVersionOwnership('v-1', 'user-1')
    const [sql] = mockDb.mock.calls[0]
    expect(sql).toContain('LEFT JOIN projects p')
  })
})

describe('Error response shape (consistency check)', () => {
  it('all 404 errors include a code: NOT_FOUND field', async () => {
    mockDb.mockResolvedValueOnce(rows([]))
    const result = await requireProjectOwnership('missing', 'user-1')
    const json = await result.error!.json()
    expect(json.code).toBe('NOT_FOUND')
  })

  it('all 403 errors include a code: FORBIDDEN field', async () => {
    mockDb.mockResolvedValueOnce(rows([{ user_id: 'other' }]))
    const result = await requireProjectOwnership('p', 'user-1')
    const json = await result.error!.json()
    expect(json.code).toBe('FORBIDDEN')
  })
})
