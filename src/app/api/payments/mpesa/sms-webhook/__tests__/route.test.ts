/**
 * @jest-environment node
 *
 * Contract tests for the merchant-phone SMS ingestion webhook
 * (/api/payments/mpesa/sms-webhook) — the zero-Daraja Till pipeline's trust
 * boundary.
 *
 * Pinned guarantees (payments contract-test pass, 2026-08-30):
 *   1. AUTH FAILS CLOSED: no configured secret → 401 (the old check failed
 *      OPEN, allowing any non-empty bearer on unconfigured deployments)
 *   2. Wrong secret → 401; correct bearer (or ?secret=) → processed
 *   3. Amount verification before auto-activation: SMS amount must match
 *      the claimed plan's price — mismatch routes to manual review with a
 *      fraudFlag, NOTHING is credited
 *   4. Auto-activation is transactional + idempotent (conditional claim
 *      UPDATE; duplicate SMS → already_processed, no double credit)
 *   5. Unclaimed payments are recorded with a per-transaction provider_id
 *      (the old sentinel collided with migration 055's unique index)
 */
import type { NextRequest } from 'next/server'
import { makeRequest } from '@/test-utils/request'
import { mr } from '@/test-utils/mock-rows'

jest.mock('@/lib/db', () => {
  const query = jest.fn()
  const getClient = jest.fn()
  return { __esModule: true, default: { query, getClient }, db: { query, getClient } }
})
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/email-templates/paymentReceipt', () => ({
  paymentReceiptEmail: { render: jest.fn(() => ({ subject: 's', html: 'h', text: 't' })) },
}))
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { POST } from '../route'
import db from '@/lib/db'
import type { PlanId } from '@/lib/subscription/catalog'

const mockDbQuery = db.query as jest.MockedFunction<typeof db.query>
const mockGetClient = db.getClient as jest.MockedFunction<typeof db.getClient>

const SECRET = 'test-webhook-secret-3f2a'
const CLAIM_USER = '22222222-2222-2222-2222-222222222222'

/** Canonical customer-confirmation SMS shape (from smsParser.test.ts). */
const SMS_OK_500 = {
  sms: 'SHK489XZY1 Confirmed. Ksh500.00 paid to METARDU BUILDERS AND ENGINEERS on 15/8/26 at 2:30 PM. For balance dial *234#.',
}
const SMS_WRONG_AMOUNT = {
  sms: 'QHK389XZY1 Confirmed. Ksh100.00 paid to METARDU BUILDERS AND ENGINEERS on 15/8/26 at 2:30 PM.',
}

function webhookRequest(body: unknown, bearer?: string): NextRequest {
  return makeRequest('/api/payments/mpesa/sms-webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body,
  }) as NextRequest
}

function txClient(opts: { claimRowCount?: number } = {}) {
  const q = jest.fn().mockImplementation((sql: string) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return Promise.resolve(mr([]))
    }
    if (
      typeof sql === 'string' &&
      (sql.includes("AND status = 'pending_review'") || sql.includes("AND status = 'unclaimed_payment'"))
    ) {
      return Promise.resolve({
        rows: [],
        rowCount: opts.claimRowCount ?? 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      })
    }
    return Promise.resolve(mr([]))
  })
  const release = jest.fn()
  mockGetClient.mockResolvedValue({ query: q, release } as never)
  return q
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.MPESA_SMS_WEBHOOK_SECRET = SECRET
  delete process.env.API_ADMIN_KEY
  delete process.env.WORKER_SECRET
})

afterEach(() => {
  delete process.env.MPESA_SMS_WEBHOOK_SECRET
})

describe('POST /api/payments/mpesa/sms-webhook — auth fails CLOSED', () => {
  test('no secret configured → 401 (previously: ANY bearer was accepted)', async () => {
    delete process.env.MPESA_SMS_WEBHOOK_SECRET
    const res = await POST(webhookRequest(SMS_OK_500, 'attacker-guesses-anything'))
    expect(res.status).toBe(401)
    expect(mockDbQuery).not.toHaveBeenCalled()
  })

  test('no bearer at all → 401', async () => {
    const res = await POST(webhookRequest(SMS_OK_500))
    expect(res.status).toBe(401)
  })

  test('wrong secret → 401', async () => {
    const res = await POST(webhookRequest(SMS_OK_500, 'wrong-secret'))
    expect(res.status).toBe(401)
  })

  test('correct bearer secret → processed', async () => {
    mockDbQuery.mockResolvedValue(mr([])) // no pending claim, no existing payment
    const res = await POST(webhookRequest(SMS_OK_500, SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.action).toBe('recorded_unclaimed_payment')
  })

  test('correct secret via ?secret= query param → processed', async () => {
    mockDbQuery.mockResolvedValue(mr([]))
    const req = makeRequest(`/api/payments/mpesa/sms-webhook?secret=${encodeURIComponent(SECRET)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: SMS_OK_500,
    }) as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/payments/mpesa/sms-webhook — unparseable input', () => {
  test('SMS without a transaction code → 422 with the raw text echoed', async () => {
    const res = await POST(webhookRequest({ sms: 'hello world no code here' }, SECRET))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toContain('transaction code')
    expect(body.rawText).toContain('hello world')
  })

  test('empty body → 400', async () => {
    const res = await POST(webhookRequest({ sms: '' }, SECRET))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/payments/mpesa/sms-webhook — auto-match with amount verification', () => {
  test('matching amounts: claim completed + subscription granted in ONE transaction', async () => {
    mockDbQuery
      .mockResolvedValueOnce(
        mr([
          {
            id: 'claim-1',
            user_id: CLAIM_USER,
            amount: '500',
            currency: 'KES',
            metadata: { planId: 'pro', mpesaCode: 'SHK489XZY1' },
          },
        ])
      ) // pending claim lookup
      .mockResolvedValue(mr([{ id: 'u1', email: 'surveyor@example.test', name: 'Test' }])) // user lookup for receipt

    const clientQuery = txClient({ claimRowCount: 1 })

    const res = await POST(webhookRequest(SMS_OK_500, SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.action).toBe('activated_pending_claim')
    expect(body.planId).toBe('pro')

    // Transaction: BEGIN → conditional claim UPDATE → user_subscriptions upsert → COMMIT
    const beginIdx = clientQuery.mock.calls.findIndex((c) => c[0] === 'BEGIN')
    const commitIdx = clientQuery.mock.calls.findIndex((c) => c[0] === 'COMMIT')
    expect(beginIdx).toBeGreaterThanOrEqual(0)
    expect(commitIdx).toBeGreaterThan(beginIdx)

    const subCall = clientQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO user_subscriptions')
    )
    expect(subCall).toBeDefined()
    // The subscription grant targets the CLAIM owner, keyed on user_id
    expect(JSON.stringify(subCall?.[1])).toContain(CLAIM_USER)
  })

  test('SMS amount ≠ claimed plan price → routed to manual review, NOTHING credited', async () => {
    mockDbQuery.mockResolvedValueOnce(
      mr([
        {
          id: 'claim-1',
          user_id: CLAIM_USER,
          amount: '100',
          currency: 'KES',
          metadata: { planId: 'pro', mpesaCode: 'QHK389XZY1' },
        },
      ])
    )

    const res = await POST(webhookRequest(SMS_WRONG_AMOUNT, SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.action).toBe('routed_to_manual_review')
    expect(body.reason).toBe('amount_mismatch')

    // The claim was flipped to pending_review with a fraudFlag — via db.query
    const flagCall = mockDbQuery.mock.calls.find(
      ([sql, params]) =>
        typeof sql === 'string' &&
        sql.includes("SET status = 'pending_review'") &&
        JSON.stringify(params).includes('amount_mismatch')
    )
    expect(flagCall).toBeDefined()
    // No transaction → no subscription grant
    expect(mockGetClient).not.toHaveBeenCalled()
  })

  test('duplicate SMS (claim already processed) → already_processed, no double credit', async () => {
    mockDbQuery
      .mockResolvedValueOnce(
        mr([
          {
            id: 'claim-1',
            user_id: CLAIM_USER,
            amount: '500',
            currency: 'KES',
            metadata: { planId: 'pro' as PlanId },
          },
        ])
      )
      .mockResolvedValue(mr([]))

    const clientQuery = txClient({ claimRowCount: 0 }) // someone else claimed it first

    const res = await POST(webhookRequest(SMS_OK_500, SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.action).toBe('already_processed')

    const rolledBack = clientQuery.mock.calls.some((c) => c[0] === 'ROLLBACK')
    expect(rolledBack).toBe(true)
    const subCall = clientQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO user_subscriptions')
    )
    expect(subCall).toBeUndefined()
  })
})

describe('POST /api/payments/mpesa/sms-webhook — unclaimed payment recording', () => {
  test('records an unclaimed payment with a per-transaction provider_id', async () => {
    mockDbQuery.mockResolvedValue(mr([])) // no claim, no existing payment

    const res = await POST(webhookRequest(SMS_OK_500, SECRET))
    expect(res.status).toBe(200)

    const insertCall = mockDbQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes("status, transaction_id, metadata") && sql.includes('unclaimed_payment')
    )
    expect(insertCall).toBeDefined()
    // provider_id must be TILL_<till>_<code> — the old sentinel 'TILL_3370347'
    // collided on the second SMS (migration 055 unique index).
    const params = JSON.stringify(insertCall?.[1])
    expect(params).toMatch(/TILL_3370347_SHK489XZY1/)
    expect(params).toContain('500') // amount recorded
  })

  test('already-known transaction code is NOT re-inserted', async () => {
    mockDbQuery
      .mockResolvedValueOnce(mr([])) // no pending claim
      .mockResolvedValueOnce(mr([{ id: 'existing', status: 'completed' }])) // known payment

    const res = await POST(webhookRequest(SMS_OK_500, SECRET))
    expect(res.status).toBe(200)

    const insertCall = mockDbQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('unclaimed_payment')
    )
    expect(insertCall).toBeUndefined()
  })
})
