export const dynamic = 'force-dynamic'

/**
 * GET    /api/admin/licenses/[licenseId]/seats   — List seats for license
 * POST   /api/admin/licenses/[licenseId]/seats   — Assign seat
 * DELETE /api/admin/licenses/[licenseId]/seats   — Revoke seat (?seatId=xxx)
 */

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import {
  assignLicenseSeat,
  revokeLicenseSeat,
  getLicenseSeats,
  getDepartmentUsage,
} from '@/lib/enterprise/governmentLicensing'
import { z } from 'zod'

const assignSeatSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['admin', 'surveyor', 'viewer']).default('surveyor'),
})

export const GET = apiHandler(
  { auth: true, roles: ['super_admin', 'admin'] , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { licenseId } = ctx.params
    const url = new URL(req.url)
    const includeUsage = url.searchParams.get('usage') === 'true'

    const seats = await getLicenseSeats(licenseId)

    if (includeUsage) {
      const usage = await getDepartmentUsage(licenseId)
      return NextResponse.json({ data: { seats, usage } })
    }

    return NextResponse.json({ data: seats })
  }
)

export const POST = apiHandler(
  { auth: true, roles: ['super_admin'], schema: assignSeatSchema , rateLimit: { max: 60, windowMs: 60000 } },
  async (_req, ctx) => {
    const { licenseId } = ctx.params
    const body = ctx.body as z.infer<typeof assignSeatSchema>

    try {
      const seat = await assignLicenseSeat(licenseId, body.userId, body.role)
      return NextResponse.json({ data: seat }, { status: 201 })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign seat'
      return NextResponse.json(
        { error: message, code: 'SEAT_ASSIGNMENT_FAILED' },
        { status: 400 }
      )
    }
  }
)

export const DELETE = apiHandler(
  { auth: true, roles: ['super_admin'] , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, _ctx) => {
    const url = new URL(req.url)
    const seatId = url.searchParams.get('seatId')

    if (!seatId) {
      return NextResponse.json(
        { error: 'seatId query parameter is required', code: 'MISSING_PARAM' },
        { status: 400 }
      )
    }

    await revokeLicenseSeat(seatId)
    return NextResponse.json({ success: true })
  }
)
