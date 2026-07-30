export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import {
  getUserCPDForYear,
  getTotalCPDForYear,
  getCPDSummary,
  generateCPDCertificate,
  verifyCPDCertificate,
  addManualCPDEntry,
  getPendingCPDEntries,
} from '@/lib/cpd'
import type { CPDActivity } from '@/types/cpd'

/**
 * /api/cpd — Continuing Professional Development API
 *
 * GET — Fetch CPD records for a user.
 *   - Requires auth. Non-admin users can only view their own records.
 *   - Admins can view any user's records by passing ?userId=X
 *   - If no userId is passed, defaults to the authenticated user.
 *   - ?action=verify&code=XXX — public certificate verification (no auth)
 *   - ?action=summary — returns just the summary (total, pending, cap)
 *   - ?action=pending — admin only: list pending manual entries
 *
 * POST — Submit a manual CPD entry (training, conference, etc.)
 *   - Requires auth. Creates a pending entry that needs admin approval.
 *   - Only TRAINING_COMPLETED, CONFERENCE_ATTENDED, MANUAL_ENTRY allowed.
 *
 * AUDIT FIX (2026-07-05): Was auth:false on GET — anyone could read any
 * user's CPD records. Now requires auth (except for the public verify action).
 */

const ADMIN_ROLES = ['super_admin', 'admin', 'org_admin']

export const GET = apiHandler({ auth: true, rateLimit: { max: 20, windowMs: 60_000 } }, async (request, ctx) => {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const code = searchParams.get('code')

  // ── Public certificate verification (no auth needed, but checked above) ──
  // This lets third parties (ISK, employers) verify a CPD certificate by code.
  if (action === 'verify' && code) {
    const cert = await verifyCPDCertificate(code)
    if (!cert) return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    return NextResponse.json({ certificate: cert })
  }

  // ── Admin: list pending manual entries ──
  if (action === 'pending') {
    const userRole = (ctx.session?.user as { role?: string })?.role ?? 'surveyor'
    if (!ADMIN_ROLES.includes(userRole)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    const pending = await getPendingCPDEntries(50)
    return NextResponse.json({ pending })
  }

  // ── Determine target user ──
  // Non-admins can only view their own records. Admins can view any user.
  const requestedUserId = searchParams.get('userId')
  const userRole = (ctx.session?.user as { role?: string })?.role ?? 'surveyor'
  const userId = requestedUserId && ADMIN_ROLES.includes(userRole)
    ? requestedUserId
    : ctx.userId!

  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : new Date().getFullYear()

  // ── Summary only (for dashboard widgets) ──
  if (action === 'summary') {
    const summary = await getCPDSummary(userId, year)
    return NextResponse.json({ summary, year })
  }

  // ── Full records ──
  const [records, total] = await Promise.all([
    getUserCPDForYear(userId, year),
    getTotalCPDForYear(userId, year),
  ])

  return NextResponse.json({ records, total, year })
})

// ── Zod schema for manual entry ──
import { z } from 'zod'

const ManualEntrySchema = z.object({
  activity: z.enum(['TRAINING_COMPLETED', 'CONFERENCE_ATTENDED', 'MANUAL_ENTRY']),
  description: z.string().min(10, 'Description must be at least 10 characters').max(500),
  points: z.number().min(0).max(50, 'Maximum 50 points per manual entry'),
  referenceId: z.string().max(200).optional(),
})

export const POST = apiHandler(
  {
    auth: true,
    schema: ManualEntrySchema,
    rateLimit: { max: 10, windowMs: 60_000 },
    // P0-3 (2026-07-24): Wire manual CPD submissions into the tamper-evident
    // audit chain. Manual CPD entries are a fraud vector per FRAUD_PREVENTION.md
    // (self-awarded points, fake training). The chain entry proves the
    // submission was made by this user at this time, and is tamper-detectable
    // via verifyChain() if anyone later tries to modify or delete it.
    auditChain: {
      entityType: 'system',
      action: 'submit',
      entityIdParam: undefined, // no URL param — falls back to body.id / 'unknown'
      reason: 'manual CPD entry submission (pending admin approval)',
    },
  },
  async (req, ctx) => {
    const body = ctx.body as z.infer<typeof ManualEntrySchema>

    const recordId = await addManualCPDEntry(
      ctx.userId!,
      body.activity as CPDActivity,
      body.description,
      body.points,
      body.referenceId
    )

    if (!recordId) {
      return NextResponse.json(
        { error: 'A CPD entry with this reference ID already exists (duplicate prevention)' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      {
        id: recordId,
        message: 'CPD entry submitted. It will count toward your total after admin approval.',
        status: 'pending_approval',
      },
      { status: 201 }
    )
  }
)
