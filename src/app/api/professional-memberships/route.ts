/**
 * /api/professional-memberships
 *
 * GET  — List the authenticated user's professional memberships
 * POST — Submit a new membership for verification (documentary proof)
 *
 * AUDIT FIX (H10, 2026-07-03): Replaces the self-attested
 * `surveyor_profiles.verified_isk` boolean with a proper documentary-
 * proof workflow: surveyor uploads their practising certificate,
 * an admin reviews it, and only VERIFIED memberships unlock
 * statutory document generation.
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/lib/apiHandler'
import db from '@/lib/db'
import { validateMembershipNumber, PROFESSIONAL_BODY_NAMES } from '@/types/professionalBody'

const SubmitMembershipSchema = z.object({
  body: z.enum(['ISK', 'EBK', 'ISU', 'RICS', 'FIG', 'OTHER']),
  membershipNumber: z.string().min(1).max(100),
  membershipGrade: z.string().max(50).optional(),
  expiresAt: z.string().optional(),  // ISO date
  supportingDocPath: z.string().max(500).optional(),
  supportingDocHash: z.string().max(64).optional(),
})

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 60, windowMs: 60000 } },
  async (_req, ctx) => {
    const { rows } = await db.query(
      `SELECT id, body, membership_number, membership_grade,
              verification_status, verification_method, verified_at,
              verification_notes, rejection_reason, expires_at,
              supporting_doc_path, created_at, updated_at
         FROM professional_memberships
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [ctx.userId],
    )
    return NextResponse.json({ data: rows })
  },
)

export const POST = apiHandler(
  {
    auth: true,
    schema: SubmitMembershipSchema,
    rateLimit: { max: 10, windowMs: 60000 },
    // P0-3 (2026-07-24): Wire membership submissions into the tamper-evident
    // audit chain. ISK/EBK membership claims are a fraud vector — a surveyor
    // could submit a fake membership number, get verified, then generate
    // statutory documents. The chain entry proves who submitted what and
    // when, and is tamper-detectable if anyone later alters the record.
    auditChain: {
      entityType: 'system',
      action: 'submit',
      reason: 'professional membership submission (pending admin verification)',
    },
  },
  async (_req, ctx) => {
    const input = ctx.body as z.infer<typeof SubmitMembershipSchema>

    // Validate the membership number format
    const validation = validateMembershipNumber(input.body, input.membershipNumber)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.warning || 'Invalid membership number', code: 'INVALID_FORMAT' },
        { status: 400 },
      )
    }

    // Check for duplicate (same body + number for this user)
    const existing = await db.query(
      `SELECT id FROM professional_memberships
        WHERE user_id = $1 AND body = $2 AND membership_number = $3`,
      [ctx.userId, input.body, input.membershipNumber],
    )
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'You have already submitted this membership number', code: 'DUPLICATE' },
        { status: 409 },
      )
    }

    // Insert — status starts as PENDING
    const { rows } = await db.query(
      `INSERT INTO professional_memberships
         (user_id, body, membership_number, membership_grade,
          verification_status, verification_method, expires_at,
          supporting_doc_path, supporting_doc_hash)
       VALUES ($1, $2, $3, $4, 'PENDING', 'DOCUMENT', $5, $6, $7)
       RETURNING *`,
      [
        ctx.userId,
        input.body,
        input.membershipNumber,
        input.membershipGrade || null,
        input.expiresAt || null,
        input.supportingDocPath || null,
        input.supportingDocHash || null,
      ],
    )

    return NextResponse.json(
      {
        data: rows[0],
        warning: validation.warning,
        message: `Membership submitted for review. An administrator will verify your ${PROFESSIONAL_BODY_NAMES[input.body]} certificate. You'll be notified when verification is complete.`,
      },
      { status: 201 },
    )
  },
)
