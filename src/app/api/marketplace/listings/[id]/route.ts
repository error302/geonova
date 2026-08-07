/**
 * /api/marketplace/listings/[id]
 *
 * GET    — Get a single listing by ID
 * PATCH  — Mark sold or update fields (owner only)
 * DELETE — Delete a listing (owner only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { apiSuccess, apiError } from '@/lib/api/response'
import { db } from '@/lib/db'

interface InstrumentListingRow {
  id: string
  type: string
  category: string
  title: string
  brand: string | null
  model: string | null
  condition: string | null
  year: number | null
  description: string | null
  price: string
  currency: string | null
  rent_period: string | null
  location: string | null
  country: string | null
  seller_name: string
  seller_contact: string
  images: unknown
  verified: boolean
  sold: boolean
  user_id: string
  created_at: string | Date
  updated_at: string | Date
}
export const dynamic = 'force-dynamic'

function rowToListing(row: InstrumentListingRow) {
  return {
    id: row.id,
    type: row.type,
    category: row.category,
    title: row.title,
    brand: row.brand,
    model: row.model,
    condition: row.condition,
    year: row.year ?? undefined,
    description: row.description,
    price: Number(row.price),
    currency: row.currency,
    rentPeriod: row.rent_period ?? undefined,
    location: row.location,
    country: row.country,
    sellerName: row.seller_name,
    sellerContact: row.seller_contact,
    images: row.images || [],
    verified: row.verified ?? false,
    sold: row.sold ?? false,
    userId: row.user_id,
    postedAt: row.created_at,
  }
}

// ── GET ────────────────────────────────────────────────────────────────────

export const GET = apiHandler({ auth: false, rateLimit: { max: 20, windowMs: 60000 } }, async (req, ctx) => {
  const { id } = ctx.params

  const { rows } = await db.query<InstrumentListingRow>(
    'SELECT * FROM instrument_listings WHERE id = $1',
    [id]
  )

  if (rows.length === 0) {
    return NextResponse.json(apiError('Listing not found'), { status: 404 })
  }

  return NextResponse.json(apiSuccess(rowToListing(rows[0])))
})

// ── PATCH ──────────────────────────────────────────────────────────────────

export const PATCH = apiHandler({ auth: true, optimisticLock: true }, async (req, ctx) => {
  const { id } = ctx.params
  const body = ctx.body as Record<string, unknown>

  // Verify ownership
  const { rows: existing } = await db.query<InstrumentListingRow>(
    'SELECT user_id, updated_at FROM instrument_listings WHERE id = $1',
    [id]
  )
  if (existing.length === 0) {
    return NextResponse.json(apiError('Listing not found'), { status: 404 })
  }
  if (existing[0].user_id !== ctx.userId) {
    return NextResponse.json(apiError('You can only edit your own listings'), { status: 403 })
  }

  // T1.8 FIX (2026-07-09): Optimistic lock guard moved to the SQL WHERE clause.

  // Build dynamic SET clause for allowed fields
  const allowedFields: Record<string, unknown> = {}
  if ('sold' in body) allowedFields.sold = Boolean(body.sold)
  if ('title' in body) allowedFields.title = String(body.title).slice(0, 200)
  if ('description' in body) allowedFields.description = String(body.description).slice(0, 2000)
  if ('price' in body) allowedFields.price = parseFloat(String(body.price))
  if ('sold' in body) allowedFields.sold = Boolean(body.sold)

  const setClauses: string[] = ['updated_at = NOW()']
  const params: unknown[] = []
  let idx = 1

  for (const [key, value] of Object.entries(allowedFields)) {
    setClauses.push(`${key} = $${idx++}`)
    params.push(value)
  }

  params.push(id)
  // T1.8: Add the optimistic lock guard to the WHERE clause
  const clientUpdatedAt = body.updated_at as string | undefined
  if (!clientUpdatedAt) {
    return NextResponse.json(apiError('updated_at is required for optimistic locking'), { status: 409 })
  }
  params.push(clientUpdatedAt)

  const { rows } = await db.query<InstrumentListingRow>(
    `UPDATE instrument_listings SET ${setClauses.join(', ')} WHERE id = $${idx} AND updated_at = $${idx + 1} RETURNING *`,
    params
  )

  if (rows.length === 0) {
    return NextResponse.json(
      apiError('This listing was modified by another user. Please refresh and try again.'),
      { status: 409 }
    )
  }

  return NextResponse.json(apiSuccess(rowToListing(rows[0])))
})

// ── DELETE ─────────────────────────────────────────────────────────────────

export const DELETE = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { id } = ctx.params

  // Verify ownership
  const { rows: existing } = await db.query<InstrumentListingRow>(
    'SELECT user_id FROM instrument_listings WHERE id = $1',
    [id]
  )
  if (existing.length === 0) {
    return NextResponse.json(apiError('Listing not found'), { status: 404 })
  }
  if (existing[0].user_id !== ctx.userId) {
    return NextResponse.json(apiError('You can only delete your own listings'), { status: 403 })
  }

  await db.query<never>('DELETE FROM instrument_listings WHERE id = $1', [id])

  return NextResponse.json(apiSuccess({ deleted: true }))
})
