/** @jest-environment node */
/**
 * API-level tests for POST /api/cron/trial-reminders.
 *
 * The scheduler sends two branded touches to Pro-trial users who never
 * upgraded:
 *   1. trialEnding — primary touch inside the 3-day window
 *      (user_subscriptions.trial_reminder_sent_at, migration 048).
 *   2. trialExpiring — final touch inside the last 24 hours
 *      (user_subscriptions.trial_reminder_2_sent_at, migration 049).
 *
 * DB and mail are mocked (db.query + sendTemplatedEmail), so these tests
 * pin the contract the real job relies on:
 *   - the window predicates and batch caps in the SELECT SQL,
 *   - the guarded, per-touch UPDATEs that make the job idempotent,
 *   - the Bearer API_ADMIN_KEY auth gate,
 *   - send-failure vs unconfigured-mail-service semantics.
 */
jest.mock('@/lib/db', () => ({
  db: { query: jest.fn() },
}))

jest.mock('@/lib/email-templates', () => ({
  sendTemplatedEmail: jest.fn(),
}))

import { POST } from '../route'
import { db } from '@/lib/db'
import { sendTemplatedEmail } from '@/lib/email-templates'
import { NextRequest } from 'next/server'
import { mr } from '@/test-utils/mock-rows'

const mockDb = db.query as jest.MockedFunction<typeof db.query>
const mockSend = sendTemplatedEmail as jest.MockedFunction<typeof sendTemplatedEmail>


interface TrialRow {
  user_id: string
  email: string
  full_name: string | null
  trial_ends_at: string
  currency: string | null
}

interface ReminderResponse {
  success: boolean
  sent3Day: number
  sent24h: number
  sent: number
  failed: number
  failedDetails: Array<{ email: string; error: string }>
  skipped: number
}

function trialRow(overrides: Partial<TrialRow> = {}): TrialRow {
  return {
    user_id: 'user-1',
    email: 'ada@example.com',
    full_name: 'Ada Surveyor',
    trial_ends_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    currency: 'KES',
    ...overrides,
  }
}

function authedRequest() {
  return new NextRequest('http://localhost/api/cron/trial-reminders', {
    method: 'POST',
    headers: { authorization: 'Bearer test-admin-key' },
  })
}

describe('POST /api/cron/trial-reminders', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.API_ADMIN_KEY = 'test-admin-key'
    mockSend.mockResolvedValue({ success: true })
    // Default: no trials are in either window (both SELECTs return empty).
    mockDb.mockResolvedValue(mr([]))
  })

  // ─── Auth gate ────────────────────────────────────────────────────────
  it('rejects with 401 when API_ADMIN_KEY is not configured', async () => {
    delete process.env.API_ADMIN_KEY
    const res = await POST(authedRequest())
    expect(res.status).toBe(401)
    expect(mockDb).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('rejects with 401 on a wrong bearer key', async () => {
    const req = new NextRequest('http://localhost/api/cron/trial-reminders', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-key' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(mockDb).not.toHaveBeenCalled()
  })

  // ─── Window predicates ────────────────────────────────────────────────
  it('queries the 3-day window with days/batch params and the idempotency guard', async () => {
    const res = await POST(authedRequest())
    expect(res.status).toBe(200)

    const [sql3Day, params3Day] = mockDb.mock.calls[0] as [string, unknown[]]
    expect(sql3Day).toContain("s.status = 'trial'")
    expect(sql3Day).toContain('s.trial_ends_at IS NOT NULL')
    expect(sql3Day).toContain('s.trial_reminder_sent_at IS NULL')
    expect(sql3Day).toContain('s.trial_ends_at > NOW()')
    expect(sql3Day).toContain("s.trial_ends_at <= NOW() + make_interval(days => $1)")
    expect(sql3Day).toContain('LIMIT $2')
    expect(params3Day).toEqual([3, 100])

    const [sql24h, params24h] = mockDb.mock.calls[1] as [string, unknown[]]
    expect(sql24h).toContain('s.trial_reminder_2_sent_at IS NULL')
    expect(sql24h).toContain("s.trial_ends_at <= NOW() + interval '24 hours'")
    expect(sql24h).toContain('LIMIT $1')
    expect(params24h).toEqual([100])
  })

  it('reports zero sent when no trials are in either window', async () => {
    const res = await POST(authedRequest())
    const data = (await res.json()) as ReminderResponse
    expect(data).toMatchObject({ success: true, sent: 0, sent3Day: 0, sent24h: 0, failed: 0, skipped: 0 })
    expect(mockSend).not.toHaveBeenCalled()
  })

  // ─── 3-day primary touch ──────────────────────────────────────────────
  it('sends trialEnding for a trial in the 3-day window and marks the touch column', async () => {
    const row = trialRow()
    mockDb
      .mockResolvedValueOnce(mr([row]))
      .mockResolvedValueOnce(mr([], 1)) // UPDATE: 1 row marked
      .mockResolvedValueOnce(mr([])) // 24h SELECT: empty

    const res = await POST(authedRequest())
    const data = (await res.json()) as ReminderResponse
    expect(data).toMatchObject({ success: true, sent3Day: 1, sent24h: 0, sent: 1, failed: 0 })

    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockSend).toHaveBeenCalledWith('trialEnding', {
      to: row.email,
      name: row.full_name,
      trialEndsAt: row.trial_ends_at,
      planPriceNote: 'KES 500/month',
    })

    // The marking UPDATE is guarded so a re-run cannot double-send.
    const [updateSql, updateParams] = mockDb.mock.calls[1] as [string, unknown[]]
    expect(updateSql).toContain('UPDATE user_subscriptions')
    expect(updateSql).toContain('trial_reminder_sent_at = NOW()')
    expect(updateSql).toContain('trial_reminder_sent_at IS NULL')
    expect(updateParams).toEqual([row.user_id])
  })

  it('falls back to an empty display name when full_name is null', async () => {
    mockDb
      .mockResolvedValueOnce(mr([trialRow({ full_name: null })]))
      .mockResolvedValueOnce(mr([], 1))
      .mockResolvedValueOnce(mr([]))

    await POST(authedRequest())
    expect(mockSend).toHaveBeenCalledWith('trialEnding', expect.objectContaining({ name: '' }))
  })

  it('builds the plan price note from the subscription currency', async () => {
    mockDb
      .mockResolvedValueOnce(mr([trialRow({ currency: 'UGX' })]))
      .mockResolvedValueOnce(mr([], 1))
      .mockResolvedValueOnce(mr([]))

    await POST(authedRequest())
    expect(mockSend).toHaveBeenCalledWith('trialEnding', expect.objectContaining({ planPriceNote: 'UGX 15000/month' }))
  })

  // ─── 24-hour final touch ──────────────────────────────────────────────
  it('sends trialExpiring in the last 24 hours even when the 3-day window is empty', async () => {
    const row = trialRow({ user_id: 'user-2', email: 'ben@example.com' })
    mockDb
      .mockResolvedValueOnce(mr([])) // 3-day SELECT: empty
      .mockResolvedValueOnce(mr([row])) // 24h SELECT: one user
      .mockResolvedValueOnce(mr([], 1)) // UPDATE: 1 row marked

    const res = await POST(authedRequest())
    const data = (await res.json()) as ReminderResponse
    expect(data).toMatchObject({ success: true, sent3Day: 0, sent24h: 1, sent: 1 })

    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockSend).toHaveBeenCalledWith('trialExpiring', expect.objectContaining({ to: row.email }))

    const [updateSql, updateParams] = mockDb.mock.calls[2] as [string, unknown[]]
    expect(updateSql).toContain('trial_reminder_2_sent_at = NOW()')
    expect(updateSql).toContain('trial_reminder_2_sent_at IS NULL')
    expect(updateParams).toEqual([row.user_id])
  })

  it('sends both touches when a trial sits in both windows', async () => {
    mockDb
      .mockResolvedValueOnce(mr([trialRow()]))
      .mockResolvedValueOnce(mr([], 1))
      .mockResolvedValueOnce(mr([trialRow({ user_id: 'user-2', email: 'ben@example.com' })]))
      .mockResolvedValueOnce(mr([], 1))

    const res = await POST(authedRequest())
    const data = (await res.json()) as ReminderResponse
    expect(data).toMatchObject({ sent: 2, sent3Day: 1, sent24h: 1 })
    expect(mockSend).toHaveBeenCalledTimes(2)
    expect(mockSend.mock.calls.map((c) => c[0])).toEqual(['trialEnding', 'trialExpiring'])
  })

  // ─── Idempotency ──────────────────────────────────────────────────────
  it('does not resend on a second run once the touch column is set', async () => {
    // First run: one user in the 3-day window → sent and marked.
    mockDb
      .mockResolvedValueOnce(mr([trialRow()]))
      .mockResolvedValueOnce(mr([], 1))
      .mockResolvedValueOnce(mr([]))
    await POST(authedRequest())
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockDb).toHaveBeenCalledTimes(3)

    // Second run: the guarded SELECT now returns nothing for that user
    // (the column was set), so nothing is sent again.
    mockDb.mockClear()
    mockSend.mockClear()
    mockDb.mockResolvedValueOnce(mr([])).mockResolvedValueOnce(mr([]))

    const res = await POST(authedRequest())
    const data = (await res.json()) as ReminderResponse
    expect(mockSend).not.toHaveBeenCalled()
    expect(data.sent).toBe(0)
    // Only the two SELECTs ran — no marking UPDATE for a skipped batch.
    expect(mockDb).toHaveBeenCalledTimes(2)
  })

  // ─── Failure / skip semantics ─────────────────────────────────────────
  it('records send failures and skips unconfigured mail service, marking neither', async () => {
    mockSend
      .mockResolvedValueOnce({ success: false, error: 'SMTP 550' })
      .mockResolvedValueOnce({ success: false, error: 'Email service not configured' })
    mockDb.mockResolvedValueOnce(
      mr([
        trialRow({ user_id: 'u-fail', email: 'fail@example.com' }),
        trialRow({ user_id: 'u-skip', email: 'skip@example.com' }),
      ])
    )

    const res = await POST(authedRequest())
    const data = (await res.json()) as ReminderResponse
    expect(data).toMatchObject({ sent3Day: 0, failed: 1, skipped: 1 })
    expect(data.failedDetails).toEqual([{ email: 'fail@example.com', error: 'SMTP 550' }])

    // Neither user got a marking UPDATE — only the two SELECTs ran.
    expect(mockDb).toHaveBeenCalledTimes(2)
    const onlySelects = mockDb.mock.calls.every((c) => (c[0] as string).startsWith('SELECT'))
    expect(onlySelects).toBe(true)
  })
})
