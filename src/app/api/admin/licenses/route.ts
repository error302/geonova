export const dynamic = 'force-dynamic'

/**
 * GET  /api/admin/licenses        — List all government licenses (paginated)
 * POST /api/admin/licenses        — Create new license (super_admin only)
 */

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import {
  listGovernmentLicenses,
  createGovernmentLicense,
} from '@/lib/enterprise/governmentLicensing'
import { z } from 'zod'

const createLicenseSchema = z.object({
  departmentName: z.string().min(1, 'Department name is required'),
  country: z.string().min(1, 'Country is required'),
  licenseKey: z.string().min(6, 'License key must be at least 6 characters'),
  maxSeats: z.number().int().positive().default(10),
  expiresAt: z.string().transform((v) => new Date(v)),
  features: z.array(z.string()).default([]),
  contactEmail: z.string().email().optional().default(''),
  contactName: z.string().optional().default(''),
  tier: z.enum(['basic', 'professional', 'enterprise']).default('professional'),
})

export const GET = apiHandler(
  { auth: true, roles: ['super_admin', 'admin'] , rateLimit: { max: 60, windowMs: 60000 } },
  async (req) => {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') ?? '1', 10)
    const pageSize = parseInt(url.searchParams.get('pageSize') ?? '20', 10)
    const activeOnly = url.searchParams.get('activeOnly') === 'true'

    const result = await listGovernmentLicenses({
      page: isNaN(page) ? 1 : page,
      pageSize: isNaN(pageSize) ? 20 : Math.min(pageSize, 100),
      activeOnly,
    })

    return NextResponse.json(result)
  }
)

export const POST = apiHandler(
  { auth: true, roles: ['super_admin'], schema: createLicenseSchema , rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const body = ctx.body as z.infer<typeof createLicenseSchema>

    const license = await createGovernmentLicense({
      departmentName: body.departmentName,
      country: body.country,
      licenseKey: body.licenseKey,
      maxSeats: body.maxSeats,
      usedSeats: 0,
      active: true,
      issuedAt: new Date(),
      expiresAt: body.expiresAt,
      features: body.features,
      contactEmail: body.contactEmail,
      contactName: body.contactName,
      tier: body.tier,
    })

    return NextResponse.json({ data: license }, { status: 201 })
  }
)
