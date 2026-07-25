/**
 * /api/cpd/approve — Admin approval for manual CPD entries
 *
 * POST — Approve or reject a pending manual CPD entry.
 *   - Admin only (super_admin, admin, org_admin)
 *   - Body: { recordId, action: 'approve' | 'reject', reason?: string }
 *
 * AUDIT FIX (2026-07-05): New endpoint. Previously manual CPD entries
 * were auto-approved (counted immediately) with no oversight — a user
 * could claim 50 points for a fake conference and it would count toward
 * their ISK renewal total. Now an admin must approve each manual entry.
 *
 * The database trigger (039_cpd_fraud_prevention.sql) logs every approval
 * and rejection to the tamper-evident audit_chain.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/lib/apiHandler'
import { approveCPDEntry, rejectCPDEntry } from '@/lib/cpd'

const ADMIN_ROLES = ['super_admin', 'admin', 'org_admin']

const ApproveSchema = z.object({
  recordId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
})

export const POST = apiHandler(
  { auth: true, schema: ApproveSchema, rateLimit: { max: 30, windowMs: 60_000 } },
  async (req, ctx) => {
    // ── Admin role check ──
    const userRole = (ctx.session?.user as { role?: string })?.role ?? 'surveyor'
    if (!ADMIN_ROLES.includes(userRole)) {
      return NextResponse.json(
        { error: 'Admin access required to approve CPD entries', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const body = ctx.body as z.infer<typeof ApproveSchema>

    if (body.action === 'approve') {
      const success = await approveCPDEntry(body.recordId, ctx.userId!)
      if (!success) {
        return NextResponse.json(
          { error: 'CPD entry not found or already approved', code: 'NOT_FOUND' },
          { status: 404 }
        )
      }
      return NextResponse.json({
        success: true,
        message: 'CPD entry approved. Points now count toward the user\'s annual total.',
      })
    }

    if (body.action === 'reject') {
      if (!body.reason) {
        return NextResponse.json(
          { error: 'A rejection reason is required', code: 'REASON_REQUIRED' },
          { status: 400 }
        )
      }
      const success = await rejectCPDEntry(body.recordId, ctx.userId!, body.reason)
      if (!success) {
        return NextResponse.json(
          { error: 'CPD entry not found or already processed', code: 'NOT_FOUND' },
          { status: 404 }
        )
      }
      return NextResponse.json({
        success: true,
        message: 'CPD entry rejected. Points set to 0. Reason recorded for audit trail.',
      })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "approve" or "reject".', code: 'INVALID_ACTION' },
      { status: 400 }
    )
  }
)
