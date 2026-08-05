export const dynamic = 'force-dynamic'

/**
 * METARDU — Sign Plan API Route (Phase 3 Enhanced)
 *
 * Accepts projectId, loads survey plan data from the database,
 * generates the SVG → PDF, applies the digital signature using
 * surveyor credentials from the project, stores the signature
 * record, and returns the signed PDF bytes.
 *
 * POST /api/sign-plan
 * Body: { projectId: string }
 * Response: PDF binary (application/pdf) or JSON error
 */

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { log } from '@/lib/logger'
import { generateSignedPdf, type SignedPdfResult } from '@/lib/reports/surveyPlan/signedPdfExport'
import type { SurveyPlanData, MonumentType, FenceOffset, AdjacentLot, ControlPoint } from '@/lib/reports/surveyPlan/types'
import { z } from 'zod'

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const SignPlanBodySchema = z.object({
  projectId: z.string().uuid({ message: 'projectId must be a valid UUID' }),
})

// ─── DB Row Interfaces ───────────────────────────────────────────────────────

interface BoundaryPointRow {
  name: string
  easting: string | number
  northing: string | number
  elevation: string | number | null
  monument_type: string | null
  beacon_description: string | null
}

interface AdjacentLotRow {
  id: string
  boundary_points: string | Record<string, unknown>[]
  plan_reference: string | null
}

interface FenceOffsetRow {
  segment_index: string | number
  type: string | null
  offset_metres: string | number
  callout_text: string | null
}

interface BuildingRow {
  easting: string | number
  northing: string | number
  width_m: string | number
  height_m: string | number
  rotation_deg: string | number
  label: string | null
}

interface ProjectRow {
  name: string | null
  location: string | null
  municipality: string | null
  utm_zone: number | null
  hemisphere: string | null
  datum: string | null
  client_name: string | null
  surveyor_name: string | null
  surveyor_licence: string | null
  firm_name: string | null
  firm_address: string | null
  firm_phone: string | null
  firm_email: string | null
  drawing_no: string | null
  reference: string | null
  plan_title: string | null
  area_sqm: string | number | null
  area_ha: string | number | null
  parcel_id: string | null
  street: string | null
  road_class: string | null
  isk_reg_no: string | null
  version: string | null
  sheet_no: number | null
  total_sheets: number | null
  north_rotation_deg: number | null
  lr_number: string | null
  plot_parcel_number: string | null
  folio_number: string | null
  register_number: string | null
  fir_number: string | null
  file_reference: string | null
}

interface ProfileRow {
  full_name: string | null
  isk_number: string | null
  firm_name: string | null
}

export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 },
  auditChain: { entityType: 'document', action: 'sign', projectIdFromBody: 'projectId' } }, async (req, ctx) => {
  const parsed = SignPlanBodySchema.safeParse(ctx.body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues, code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }
  const { projectId } = parsed.data

  // ── Load project data ──
  const { rows: projectRows } = await db.query<ProjectRow>(
    `SELECT id, name, location, municipality, utm_zone, hemisphere, datum,
            client_name, surveyor_name, surveyor_licence, firm_name, firm_address,
            firm_phone, firm_email, drawing_no, reference, plan_title, area_sqm,
            area_ha, parcel_id, street, road_class, isk_reg_no, version,
            sheet_no, total_sheets, north_rotation_deg, lr_number, plot_parcel_number,
            folio_number, register_number, fir_number, file_reference
     FROM projects WHERE id = $1 LIMIT 1`,
    [projectId],
  )

  if (projectRows.length === 0) {
    return NextResponse.json(
      { error: 'Project not found', code: 'NOT_FOUND' },
      { status: 404 },
    )
  }

  const project = projectRows[0]

  // ── Load boundary points ──
  const { rows: boundaryRows } = await db.query<BoundaryPointRow>(
    `SELECT name, easting, northing, elevation, monument_type, beacon_description
     FROM boundary_points WHERE project_id = $1 ORDER BY sequence`,
    [projectId],
  )

  if (boundaryRows.length < 3) {
    return NextResponse.json(
      { error: 'Project must have at least 3 boundary points', code: 'INSUFFICIENT_POINTS' },
      { status: 400 },
    )
  }

  // ── Load adjacent lots ──
  const { rows: adjacentRows } = await db.query<AdjacentLotRow>(
    `SELECT id, boundary_points, plan_reference FROM adjacent_lots WHERE project_id = $1`,
    [projectId],
  )

  // ── Load fence offsets ──
  const { rows: fenceRows } = await db.query<FenceOffsetRow>(
    `SELECT segment_index, type, offset_metres, callout_text FROM fence_offsets WHERE project_id = $1`,
    [projectId],
  )

  // ── Load buildings ──
  const { rows: buildingRows } = await db.query<BuildingRow>(
    `SELECT easting, northing, width_m, height_m, rotation_deg, label FROM buildings WHERE project_id = $1`,
    [projectId],
  )

  // ── Load surveyor profile ──
  const { rows: profileResult } = await db.query<ProfileRow>(
    'SELECT full_name, isk_number, firm_name FROM profiles WHERE id = $1 LIMIT 1',
    [ctx.userId],
  )
  const profile = profileResult[0]

  // ── Build SurveyPlanData ──
  const surveyPlanData: SurveyPlanData = {
    project: {
      name: project.name || 'Untitled Project',
      location: project.location || '',
      municipality: project.municipality || undefined,
      utm_zone: project.utm_zone || 37,
      hemisphere: (project.hemisphere || 'S') as 'N' | 'S',
      datum: (project.datum || 'ARC1960') as 'ARC1960' | 'WGS84' | 'WGS84Geographic',
      client_name: project.client_name || undefined,
      surveyor_name: project.surveyor_name || profile?.full_name || '',
      surveyor_licence: project.surveyor_licence || '',
      firm_name: project.firm_name || profile?.firm_name || '',
      firm_address: project.firm_address || undefined,
      firm_phone: project.firm_phone || undefined,
      firm_email: project.firm_email || undefined,
      drawing_no: project.drawing_no || undefined,
      reference: project.reference || undefined,
      plan_title: project.plan_title || undefined,
      area_sqm: project.area_sqm ? Number(project.area_sqm) : undefined,
      area_ha: project.area_ha ? Number(project.area_ha) : undefined,
      parcel_id: project.parcel_id || project.lr_number || '',
      street: project.street || undefined,
      road_class: project.road_class || undefined,
      iskRegNo: project.isk_reg_no || profile?.isk_number || '',
      version: project.version || undefined,
      sheetNo: project.sheet_no != null ? String(project.sheet_no) : undefined,
      totalSheets: project.total_sheets != null ? String(project.total_sheets) : undefined,
      northRotationDeg: project.north_rotation_deg || undefined,
      lrNumber: project.lr_number || undefined,
      plotParcelNumber: project.plot_parcel_number || undefined,
      folioNumber: project.folio_number || undefined,
      registerNumber: project.register_number || undefined,
      firNumber: project.fir_number || undefined,
      fileReference: project.file_reference || undefined,
    },
    parcel: {
      boundaryPoints: boundaryRows.map((row) => ({
        name: row.name,
        easting: parseFloat(String(row.easting)),
        northing: parseFloat(String(row.northing)),
      })),
      area_sqm: parseFloat(String(project.area_sqm)) || 0,
      perimeter_m: computePerimeter(boundaryRows),
    },
    controlPoints: boundaryRows.map((row): ControlPoint => ({
      name: row.name,
      easting: parseFloat(String(row.easting)),
      northing: parseFloat(String(row.northing)),
      elevation: row.elevation ? parseFloat(String(row.elevation)) : undefined,
      monumentType: (row.monument_type || 'found') as MonumentType,
      beaconDescription: row.beacon_description || undefined,
    })),
    adjacentLots: adjacentRows.map((row): AdjacentLot => ({
      id: row.id,
      boundaryPoints: (typeof row.boundary_points === 'string'
        ? JSON.parse(row.boundary_points)
        : row.boundary_points || []) as AdjacentLot['boundaryPoints'],
      planReference: row.plan_reference || undefined,
    })),
    fenceOffsets: fenceRows.map((row): FenceOffset => ({
      segmentIndex: parseInt(String(row.segment_index), 10),
      type: (row.type || 'fence_on_boundary') as FenceOffset['type'],
      offsetMetres: parseFloat(String(row.offset_metres)) || 0,
      calloutText: row.callout_text || undefined,
    })),
    buildings: buildingRows.map((row) => ({
      easting: parseFloat(String(row.easting)),
      northing: parseFloat(String(row.northing)),
      width_m: parseFloat(String(row.width_m)) || 10,
      height_m: parseFloat(String(row.height_m)) || 8,
      rotation_deg: parseFloat(String(row.rotation_deg)) || 0,
      label: row.label || undefined,
    })),
  }

  // ── Generate signed PDF ──
  try {
    const signerName = profile?.full_name || project.surveyor_name || ctx.session?.user?.email || 'Unknown Surveyor'
    const iskNumber = profile?.isk_number || project.isk_reg_no || 'Unknown ISK'
    const firmName = profile?.firm_name || project.firm_name || ''

    const result: SignedPdfResult = await generateSignedPdf(surveyPlanData, {
      signerName,
      iskNumber,
      firmName,
      signatureMethod: 'CERTIFICATE',
      documentId: project.drawing_no || projectId,
    })

    // ── Store signature record in database ──
    const { rows: sigRows } = await db.query<{ id: string; signed_at: Date }>(
      `INSERT INTO signatures (user_id, project_id, signature_data, signer_name, isk_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, signed_at`,
      [
        ctx.userId,
        projectId,
        result.documentHash,
        signerName,
        iskNumber,
      ],
    )

    if (sigRows.length === 0) {
      log({
        level: 'error',
        message: 'Failed to insert digital signature into database',
        metadata: { user_id: ctx.userId, project_id: projectId },
      })
      // Continue anyway — the PDF is still valid
    }

    log({
      level: 'info',
      message: 'Signed PDF generated successfully',
      metadata: {
        user_id: ctx.userId,
        project_id: projectId,
        document_hash: result.documentHash.substring(0, 16),
        verification_token: result.verificationToken,
      },
    })

    // ── Return the signed PDF as binary ──
    return new NextResponse(Buffer.from(result.pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${(project.name || 'survey-plan').replace(/\s+/g, '_')}_signed.pdf"`,
        'X-Document-Hash': result.documentHash.substring(0, 16),
        'X-Verification-Token': result.verificationToken,
        'X-Signed-At': result.signedAt,
      },
    })
  } catch (err) {
    log({
      level: 'error',
      message: 'Failed to generate signed PDF',
      metadata: {
        user_id: ctx.userId,
        project_id: projectId,
        error: err instanceof Error ? err.message : String(err),
      },
    })
    return NextResponse.json(
      { error: 'Failed to generate signed PDF', code: 'PDF_GENERATION_FAILED' },
      { status: 500 },
    )
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PointWithCoords {
  easting: string | number
  northing: string | number
}

function computePerimeter(points: PointWithCoords[]): number {
  let perimeter = 0
  for (let i = 0; i < points.length; i++) {
    const from = points[i]
    const to = points[(i + 1) % points.length]
    const dx = parseFloat(String(to.easting)) - parseFloat(String(from.easting))
    const dy = parseFloat(String(to.northing)) - parseFloat(String(from.northing))
    perimeter += Math.sqrt(dx * dx + dy * dy)
  }
  return perimeter
}
