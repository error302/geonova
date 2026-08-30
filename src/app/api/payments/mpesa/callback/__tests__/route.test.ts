/**
 * @jest-environment node
 *
 * Contract tests for the Daraja STK Push callback route.
 *
 * WHY CONTRACT TESTS: this route is the money path. It must behave
 * identically no matter how Safaricom delivers — success, user-cancelled,
 * amount-mismatch, missing metadata, or THE SAME CALLBACK TWICE (Daraja
 * retries). The fixtures in src/lib/payments/__tests__/fixtures/mpesa/ pin
 * the recorded payload shapes; these tests pin the ROUTE's side effects:
 * which SQL runs, in what transaction, and what gets credited.
 *
 * The guarantees pinned here (audit C-05, H-01):
 *   1. IP gate: only Safaricom IPs (rightmost XFF hop / CF-Connecting-IP)
 *   2. Success credits exactly once: intent completed + payment_history row
 *      (ON CONFLICT DO NOTHING) + user_subscriptions upsert, all in ONE
 *      transaction gated by a conditional UPDATE
 *   3. Double delivery is a no-op: early 'completed' exit, or the rowCount=0
 *      rollback path — never a double credit
 *   4. Amount verification FAILS CLOSED (mismatch / missing metadata →
 *      intent failed + fraudFlag, zero credits)
 *   5. Failure result codes fail the intent, credit nothing
 */
import type { NextRequest } from 'next/server'
import { makeRequest } from '@/test-utils/request'

jest.mock('@/lib/db', () => {
  const query = jest.fn()
  const getClient = jest.fn()
  return { __esModule: true, default: { query, getClient }, db: { query, getClient } }
})
jest.mock('@/lib/payments/mpesa', () => ({
  getMpesaService: jest.fn(),
}))
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
import { getMpesaService } from '@/lib/payments/mpesa'
import { mr } from '@/test-utils/mock-rows'
import successPayload from '@/lib/payments/__tests__/fixtures/mpesa/callback-success.json'
import amountMismatchPayload from '@/lib/payments/__tests__/fixtures/mpesa/callback-amount-mismatch.json'
import noMetadataPayload from '@/lib/payments/__tests__/fixtures/mpesa/callback-no-metadata.json'
import userCancelledPayload from '@/lib/payments/__tests__/fixtures/mpesa/callback-user-cancelled.json'

const mockDbQuery = db.query as jest.MockedFunction<typeof db.query>
const mockGetClient = db.getClient as jest.MockedFunction<typeof db.getClient>
const mockGetMpesaService = getMpesaService as jest.MockedFunction<typeof getMpesaService>

const SAFARICOM_IP = '196.201.214.200'
const USER_ID = '11111111-1111-1111-1111-111111111111'

function callbackRequest(payload: unknown, ip = SAFARICOM_IP): NextRequest {
  return makeRequest('/api/payments/mpesa/callback', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': ip,
    },
    body: payload,
  }) as NextRequest
}

/** Real parseCallback implementation from the lib (pure function). */
const { MpesaService } = jest.requireActual('@/lib/payments/mpesa') as typeof import('@/lib/payments/mpesa')
const realService = new (MpesaService as any)({} as never)

beforeEach(() => {
  jest.clearAllMocks()
  // Route uses getMpesaService() for config presence + parseCallback.
  mockGetMpesaService.mockReturnValue(realService as never)
})

/**
 * SQL-aware transaction client mock: returns results by matching the SQL
 * text instead of call order (BEGIN/COMMIT consume results too, so naive
 * mockResolvedValueOnce sequencing shifts by one and breaks assertions).
 */
function txClient(opts: { claimRowCount?: number } = {}) {
  const q = jest.fn().mockImplementation((sql: string) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return Promise.resolve(mr([]))
    }
    // Conditional claim UPDATEs: the rowCount IS the semantics
    // (1 = this call won the race, 0 = someone else already did it).
    if (
      typeof sql === 'string' &&
      (sql.includes("AND status <> 'completed'") ||
        sql.includes("AND status = 'unclaimed_payment'") ||
        sql.includes("AND status = 'pending_review'"))
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

describe('POST /api/payments/mpesa/callback — IP gate (C-05)', () => {
  test('rejects non-Safaricom IPs with 403 before touching the DB', async () => {
    const res = await POST(callbackRequest(successPayload, '1.2.3.4'))
    expect(res.status).toBe(403)
    expect(mockDbQuery).not.toHaveBeenCalled()
  })

  test('rejects requests with spoofed XFF chains — rightmost hop wins', async () => {
    // Attacker sets XFF: "196.201.214.200, 1.2.3.4" — behind an appending
    // proxy the LAST hop (1.2.3.4) is what our proxy observed. CF header
    // absent in this request shape: use x-forwarded-for instead.
    const req = makeRequest('/api/payments/mpesa/callback', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': `${SAFARICOM_IP}, 1.2.3.4`,
      },
      body: successPayload,
    }) as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(403)
  })
})

describe('POST /api/payments/mpesa/callback — success path credits exactly once', () => {
  test('completes the intent, writes payment_history, upserts user_subscriptions in ONE transaction', async () => {
    mockDbQuery
      .mockResolvedValueOnce(
        mr([
          {
            id: 'intent-1',
            user_id: USER_ID,
            plan_id: 'pro',
            amount: 500,
            currency: 'KES',
            status: 'pending',
          },
        ])
      ) // intent lookup by CheckoutRequestID
      .mockResolvedValue(mr([])) // receipt email user lookup (no email)

    const clientQuery = txClient({ claimRowCount: 1 }) // WE win the race

    const res = await POST(callbackRequest(successPayload))
    expect(res.status).toBe(200)

    // Transaction ordering: BEGIN → conditional UPDATE ... WHERE status <> 'completed'
    const beginIdx = clientQuery.mock.calls.findIndex((c) => c[0] === 'BEGIN')
    const commitIdx = clientQuery.mock.calls.findIndex((c) => c[0] === 'COMMIT')
    expect(beginIdx).toBeGreaterThanOrEqual(0)
    expect(commitIdx).toBeGreaterThan(beginIdx)

    const completeCall = clientQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes("SET status = 'completed'") && sql.includes("AND status <> 'completed'")
    )
    expect(completeCall).toBeDefined()

    const historyCall = clientQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO payment_history') && sql.includes('ON CONFLICT (provider_id) DO NOTHING')
    )
    expect(historyCall).toBeDefined()
    // payment_history carries the real paid amount + receipt number
    expect(historyCall?.[1]).toContain(500)
    expect(historyCall?.[1]).toContain('NLJ7RT61SV')

    const subCall = clientQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO user_subscriptions')
    )
    expect(subCall).toBeDefined()
  })
})

describe('POST /api/payments/mpesa/callback — DOUBLE DELIVERY (H-01 idempotency)', () => {
  test('early exit: already-completed intent returns ok without a transaction', async () => {
    mockDbQuery.mockResolvedValueOnce(
      mr([
        {
          id: 'intent-1',
          user_id: USER_ID,
          plan_id: 'pro',
          amount: 500,
          currency: 'KES',
          status: 'completed',
        },
      ])
    )

    const res = await POST(callbackRequest(successPayload))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
    // No transaction was started — nothing re-credited
    expect(mockGetClient).not.toHaveBeenCalled()
  })

  test('race loser: conditional UPDATE affects 0 rows → ROLLBACK, ok, no credit', async () => {
    mockDbQuery.mockResolvedValueOnce(
      mr([
        {
          id: 'intent-1',
          user_id: USER_ID,
          plan_id: 'pro',
          amount: 500,
          currency: 'KES',
          status: 'processing',
        },
      ])
    )

    const clientQuery = txClient({ claimRowCount: 0 }) // someone else already completed it

    const res = await POST(callbackRequest(successPayload))
    expect(res.status).toBe(200)

    const rolledBack = clientQuery.mock.calls.some((c) => c[0] === 'ROLLBACK')
    expect(rolledBack).toBe(true)
    // Crucially: NO payment_history insert, NO subscription write happened
    const historyCall = clientQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO payment_history')
    )
    expect(historyCall).toBeUndefined()
  })
})

describe('POST /api/payments/mpesa/callback — amount verification fails CLOSED (C-05)', () => {
  test('paid amount ≠ plan price → intent failed with fraudFlag, nothing credited', async () => {
    mockDbQuery.mockResolvedValueOnce(
      mr([
        {
          id: 'intent-1',
          user_id: USER_ID,
          plan_id: 'pro',
          amount: 500,
          currency: 'KES',
          status: 'pending',
        },
      ])
    )

    const res = await POST(callbackRequest(amountMismatchPayload))
    expect(res.status).toBe(200)

    const failCall = mockDbQuery.mock.calls.find(
      ([sql, params]) =>
        typeof sql === 'string' &&
        sql.includes("SET status = 'failed'") &&
        JSON.stringify(params).includes('amount_mismatch')
    )
    expect(failCall).toBeDefined()
    // No transaction → no credit
    expect(mockGetClient).not.toHaveBeenCalled()
  })

  test('callback with NO metadata (paidAmount 0) fails closed — the pre-C-05 hole', async () => {
    mockDbQuery.mockResolvedValueOnce(
      mr([
        {
          id: 'intent-1',
          user_id: USER_ID,
          plan_id: 'pro',
          amount: 500,
          currency: 'KES',
          status: 'pending',
        },
      ])
    )

    const res = await POST(callbackRequest(noMetadataPayload))
    expect(res.status).toBe(200)

    const failCall = mockDbQuery.mock.calls.find(
      ([sql, params]) =>
        typeof sql === 'string' &&
        sql.includes("SET status = 'failed'") &&
        JSON.stringify(params).includes('missing_callback_metadata')
    )
    expect(failCall).toBeDefined()
    expect(mockGetClient).not.toHaveBeenCalled()
  })
})

describe('POST /api/payments/mpesa/callback — user-cancelled callbacks', () => {
  test('non-zero ResultCode fails the intent, credits nothing, returns ok', async () => {
    mockDbQuery.mockResolvedValueOnce(
      mr([
        {
          id: 'intent-1',
          user_id: USER_ID,
          plan_id: 'pro',
          amount: 500,
          currency: 'KES',
          status: 'processing',
        },
      ])
    )

    const res = await POST(callbackRequest(userCancelledPayload))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })

    const failCall = mockDbQuery.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes("SET status = 'failed'")
    )
    expect(failCall).toBeDefined()
    expect(mockGetClient).not.toHaveBeenCalled()
  })
})

describe('POST /api/payments/mpesa/callback — payload validation', () => {
  test('missing CheckoutRequestID → 400', async () => {
    const res = await POST(callbackRequest({ Body: { stkCallback: {} } }))
    expect(res.status).toBe(400)
  })

  test('unknown CheckoutRequestID → 404, no credit', async () => {
    mockDbQuery.mockResolvedValueOnce(mr([]))
    const res = await POST(callbackRequest(successPayload))
    expect(res.status).toBe(404)
    expect(mockGetClient).not.toHaveBeenCalled()
  })

  test('M-Pesa unconfigured → 500', async () => {
    mockGetMpesaService.mockReturnValue(null)
    const res = await POST(callbackRequest(successPayload))
    expect(res.status).toBe(500)
  })
})
