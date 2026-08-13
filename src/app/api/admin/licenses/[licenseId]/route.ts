export const dynamic = 'force-dynamic'

/**
 * GET    /api/admin/licenses/[licenseId]       — Get license details
 * PUT    /api/admin/licenses/[licenseId]       — Update license
 * DELETE /api/admin/licenses/[licenseId]       — Deactivate license
 */

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import {
  getGovernmentLicense,
  renewLicense,
  deactivateLicense,
} from '@/lib/enterprise/governmentLicensing'
import { z } from 'zod'

interface GovernmentLicenseRow {
  id: string
  department_name: string | null
  country: string | null
  license_key: string | null
  max_seats: number | null
  used_seats: number | null
  active: boolean
  issued_at: Date | string | null
  expires_at: Date | string | null
  features: string[] | null
  contact_email: string | null
  contact_name: string | null
  tier: string | null
}

const updateLicenseSchema = z.object({
  departmentName: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  maxSeats: z.number().int().positive().optional(),
  active: z.boolean().optional(),
  expiresAt: z.string().transform((v) => new Date(v)).optional(),
  features: z.array(z.string()).optional(),
  contactEmail: z.string().email().optional(),
  contactName: z.string().optional(),
  tier: z.enum(['basic', 'professional', 'enterprise']).optional(),
})

export const GET = apiHandler(
  { auth: true, roles: ['super_admin', 'admin'] , rateLimit: { max: 60, windowMs: 60000 } },
  async (_req, ctx) => {
    const { licenseId } = ctx.params

    const license = await getGovernmentLicense(licenseId)
    if (!license) {
      return NextResponse.json(
        { error: 'License not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: license })
  }
)

export const PUT = apiHandler(
  { auth: true, roles: ['super_admin'], schema: updateLicenseSchema , rateLimit: { max: 60, windowMs: 60000 } },
  async (_req, ctx) => {
    const { licenseId } = ctx.params
    const body = ctx.body as z.infer<typeof updateLicenseSchema>

    const existing = await getGovernmentLicense(licenseId)
    if (!existing) {
      return NextResponse.json(
        { error: 'License not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // If expiresAt is provided, treat as a renewal
    if (body.expiresAt) {
      const updated = await renewLicense(licenseId, body.expiresAt)
      return NextResponse.json({ data: updated })
    }

    // Otherwise perform a general update
    const setClauses: string[] = ['updated_at = NOW()']
    const values: unknown[] = []
    let paramIdx = 1

    const fieldMap: Record<string, string> = {
      departmentName: 'department_name',
      country: 'country',
      maxSeats: 'max_seats',
      active: 'active',
      contactEmail: 'contact_email',
      contactName: 'contact_name',
      tier: 'tier',
    }

    for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
      if ((body as Record<string, unknown>)[jsKey] !== undefined) {
        setClauses.push(`${dbCol} = $${paramIdx}`)
        values.push((body as Record<string, unknown>)[jsKey])
        paramIdx++
      }
    }

    if (body.features !== undefined) {
      setClauses.push(`features = $${paramIdx}`)
      values.push(body.features)
      paramIdx++
    }

    if (setClauses.length <= 1) {
      return NextResponse.json({ data: existing })
    }

    values.push(licenseId)
    const result = await db.query<GovernmentLicenseRow>(
      `UPDATE government_licenses SET ${setClauses.join(', ')}
       WHERE id = $${paramIdx} RETURNING *`,
      values
    )

    const updatedRow = result.rows[0]
    return NextResponse.json({
      data: {
        id: updatedRow.id,
        departmentName: updatedRow.department_name,
        country: updatedRow.country,
        licenseKey: updatedRow.license_key,
        maxSeats: updatedRow.max_seats,
        usedSeats: updatedRow.used_seats,
        active: updatedRow.active,
        issuedAt: updatedRow.issued_at,
        expiresAt: updatedRow.expires_at,
        features: updatedRow.features ?? [],
        contactEmail: updatedRow.contact_email ?? '',
        contactName: updatedRow.contact_name ?? '',
        tier: updatedRow.tier,
      },
    })
  }
)

export const DELETE = apiHandler(
  { auth: true, roles: ['super_admin'] , rateLimit: { max: 60, windowMs: 60000 } },
  async (_req, ctx) => {
    const { licenseId } = ctx.params

    try {
      await deactivateLicense(licenseId)
      return NextResponse.json({ success: true })
    } catch {
      return NextResponse.json(
        { error: 'License not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
  }
)
