// ============================================================
// METARDU — RIM Editor API Route
// Resurvey and Index Map CRUD + PDF Generation
//
// GET    /api/rim?projectId=xxx              → List RIM sections
// POST   /api/rim                             → Create section / add parcel / add beacon / generate PDF
// PUT    /api/rim                             → Update section
// DELETE /api/rim?rimSectionId=xxx            → Delete section + related parcels & beacons
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import db from '@/lib/db'
import { apiSuccess, apiError } from '@/lib/api/response'
// AUDIT FIX (2026-07-03): createRimTables import removed — function deleted.
import { generateRimPdf } from '@/lib/rim'
import type { RimSection, RimParcel, RimBeacon } from '@/lib/rim'

interface RimSectionWithCounts extends RimSection {
  parcel_count?: number
  beacon_count?: number
}

export const dynamic = 'force-dynamic'

// ────────────────────────────────────────────────────────────
// GET — List RIM sections for a project
// ────────────────────────────────────────────────────────────

export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (request, ctx) => {
  const projectId = request.nextUrl.searchParams.get('projectId')
  if (!projectId) {
    return NextResponse.json(apiError('projectId is required'), { status: 400 })
  }

  const { rows } = await db.query<RimSectionWithCounts>(
    `SELECT
       rs.*,
       (SELECT COUNT(*)::int FROM rim_parcels WHERE rim_section_id = rs.id) AS parcel_count,
       (SELECT COUNT(*)::int FROM rim_beacons WHERE rim_section_id = rs.id) AS beacon_count
     FROM rim_sections rs
     WHERE rs.user_id = $1 AND rs.project_id = $2
     ORDER BY rs.updated_at DESC`,
    [ctx.userId, projectId],
  )

  return NextResponse.json(apiSuccess(rows))
})

// ────────────────────────────────────────────────────────────
// POST — Create section / add parcel / add beacon / generate PDF
// ────────────────────────────────────────────────────────────

export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (request, ctx) => {
  // AUDIT FIX (2026-07-03): Removed `await createRimTables()` call.
  // Tables are created by migrations — no need to CREATE TABLE IF NOT
  // EXISTS on every POST.

  const body = ctx.body as Record<string, unknown>
  const { action } = body

  // ── Create Section ────────────────────────────────────────
  if (action === 'create_section') {
    const data = body.data as Partial<RimSection> | undefined
    if (!data?.project_id) {
      return NextResponse.json(apiError('project_id is required'), { status: 400 })
    }

    const { rows } = await db.query<RimSection>(
      `INSERT INTO rim_sections (
         user_id, project_id, section_name, registry, district,
         map_sheet_number, scale, datum, projection,
         total_area, parcels_count, status, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        ctx.userId,
        data.project_id,
        data.section_name || '',
        data.registry || '',
        data.district || '',
        data.map_sheet_number || '',
        data.scale || '1:2500',
        data.datum || 'Arc 1960',
        data.projection || 'UTM Zone 37S',
        data.total_area || 0,
        data.parcels_count || 0,
        data.status || 'draft',
        data.notes || '',
      ],
    )

    return NextResponse.json(apiSuccess(rows[0]), { status: 201 })
  }

  // ── Add Parcel ────────────────────────────────────────────
  if (action === 'add_parcel') {
    const { rimSectionId, ...parcelData } = (body.data as Partial<RimParcel> & { rimSectionId?: string }) ?? {}

    if (!rimSectionId) {
      return NextResponse.json(apiError('rimSectionId is required'), { status: 400 })
    }

    const { rows } = await db.query<RimParcel>(
      `INSERT INTO rim_parcels (
         rim_section_id, parcel_number, area, land_use,
         owner_name, beacon_count, northings, eastings, is_landmark
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        rimSectionId,
        parcelData?.parcel_number || '',
        parcelData?.area || 0,
        parcelData?.land_use || '',
        parcelData?.owner_name || '',
        parcelData?.beacon_count || 0,
        parcelData?.northings || [],
        parcelData?.eastings || [],
        parcelData?.is_landmark || false,
      ],
    )

    // Update parcels_count on the section
    await db.query<never>(
      `UPDATE rim_sections
       SET parcels_count = (SELECT COUNT(*) FROM rim_parcels WHERE rim_section_id = $1),
           updated_at = NOW()
       WHERE id = $1`,
      [rimSectionId],
    )

    return NextResponse.json(apiSuccess(rows[0]), { status: 201 })
  }

  // ── Add Beacon ────────────────────────────────────────────
  if (action === 'add_beacon') {
    const { rimSectionId, ...beaconData } = (body.data as Partial<RimBeacon> & { rimSectionId?: string }) ?? {}

    if (!rimSectionId) {
      return NextResponse.json(apiError('rimSectionId is required'), { status: 400 })
    }

    const { rows } = await db.query<RimBeacon>(
      `INSERT INTO rim_beacons (
         rim_section_id, beacon_number, easting, northing,
         description, type, survey_status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        rimSectionId,
        beaconData?.beacon_number || '',
        beaconData?.easting || 0,
        beaconData?.northing || 0,
        beaconData?.description || '',
        beaconData?.type || 'Pillar',
        beaconData?.survey_status || 'Original',
      ],
    )

    return NextResponse.json(apiSuccess(rows[0]), { status: 201 })
  }

  // ── Generate PDF ──────────────────────────────────────────
  if (action === 'generate_pdf') {
    const { rimSectionId } = body

    if (!rimSectionId) {
      return NextResponse.json(apiError('rimSectionId is required'), { status: 400 })
    }

    // Fetch section
    const sectionResult = await db.query<RimSection>(
      'SELECT * FROM rim_sections WHERE id = $1 AND user_id = $2',
      [rimSectionId, ctx.userId],
    )
    if (sectionResult.rows.length === 0) {
      return NextResponse.json(apiError('RIM section not found'), { status: 404 })
    }
    const section: RimSection = sectionResult.rows[0]

    // Fetch parcels
    const parcelsResult = await db.query<RimParcel>(
      'SELECT * FROM rim_parcels WHERE rim_section_id = $1 ORDER BY parcel_number',
      [rimSectionId],
    )
    const parcels: RimParcel[] = parcelsResult.rows

    // Fetch beacons
    const beaconsResult = await db.query<RimBeacon>(
      'SELECT * FROM rim_beacons WHERE rim_section_id = $1 ORDER BY beacon_number',
      [rimSectionId],
    )
    const beacons: RimBeacon[] = beaconsResult.rows

    // Generate PDF
    const pdfBytes = generateRimPdf(section, parcels, beacons)
    const buffer = Buffer.from(pdfBytes)

    const filename = `RIM_${section.map_sheet_number || 'draft'}_${section.section_name.replace(/\s+/g, '_')}.pdf`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
      },
    })
  }

  return NextResponse.json(
    apiError(`Unknown action: ${action || '(missing)'}. Supported: create_section, add_parcel, add_beacon, generate_pdf`),
    { status: 400 },
  )
})

// ────────────────────────────────────────────────────────────
// PUT — Update RIM section
// ────────────────────────────────────────────────────────────

export const PUT = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (request, ctx) => {
  const body = ctx.body as Record<string, unknown>
  const { action, id, data } = body

  if (action === 'update_section') {
    if (!id) {
      return NextResponse.json(apiError('id is required'), { status: 400 })
    }

    // Build dynamic SET clause from provided fields
    const fields: string[] = []
    const values: unknown[] = []
    let paramIdx = 1

    const allowedFields = [
      'section_name', 'registry', 'district', 'map_sheet_number',
      'scale', 'datum', 'projection', 'total_area', 'parcels_count',
      'status', 'notes',
    ] as const

    const dataObj = (data ?? {}) as Record<string, unknown>
    for (const field of allowedFields) {
      if (dataObj[field] !== undefined) {
        fields.push(`${field} = $${paramIdx}`)
        values.push(dataObj[field])
        paramIdx++
      }
    }

    if (fields.length === 0) {
      return NextResponse.json(apiError('No fields to update'), { status: 400 })
    }

    // Always update updated_at
    fields.push(`updated_at = NOW()`)
    values.push(ctx.userId) // for WHERE clause

    const sql = `UPDATE rim_sections SET ${fields.join(', ')}
                 WHERE id = $${paramIdx} AND user_id = $${paramIdx + 1}
                 RETURNING *`

    const { rows } = await db.query<RimSection>(sql, [...values, id, ctx.userId])

    if (rows.length === 0) {
      return NextResponse.json(apiError('RIM section not found'), { status: 404 })
    }

    return NextResponse.json(apiSuccess(rows[0]))
  }

  return NextResponse.json(
    apiError(`Unknown action: ${action || '(missing)'}. Supported: update_section`),
    { status: 400 },
  )
})

// ────────────────────────────────────────────────────────────
// DELETE — Remove RIM section and all related data
// ────────────────────────────────────────────────────────────

export const DELETE = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (request, ctx) => {
  const rimSectionId = request.nextUrl.searchParams.get('rimSectionId')
  if (!rimSectionId) {
    return NextResponse.json(apiError('rimSectionId is required'), { status: 400 })
  }

  // CASCADE deletes parcels and beacons automatically via FK ON DELETE CASCADE
  const { rows } = await db.query<Pick<RimSection, 'id'>>(
    `DELETE FROM rim_sections
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [rimSectionId, ctx.userId],
  )

  if (rows.length === 0) {
    return NextResponse.json(apiError('RIM section not found'), { status: 404 })
  }

  return NextResponse.json(apiSuccess({ deleted: true, id: rows[0].id }))
})
