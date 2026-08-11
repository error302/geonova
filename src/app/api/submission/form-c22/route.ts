export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import { generateFormC22Pdf } from '@/lib/generators/formC22'
import type { FormC22Input } from '@/lib/generators/formC22'
import { logger } from '@/lib/logger'

/**
 * POST /api/submission/form-c22
 *
 * Generates a Form C22 (Computation Sheet) PDF for a given project.
 *
 * Body: { projectId: string }
 * Query: ?format=json  (returns metadata JSON instead of the PDF binary)
 *
 * Fetches project metadata + traverse results from the DB, assembles
 * a FormC22Input, and streams the generated PDF back as a download.
 */
export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const body = ctx.body as {
    projectId?: string
    format?: string
    county?: string
    division?: string
    district?: string
    locality?: string
    surveyType?: string
    revision?: string
    parcelNumber?: string
    referenceNumber?: string
  }
  const { projectId } = body

  // Build overrides from body fields (only include non-empty values)
  const overrides = {
    county: body.county || undefined,
    division: body.division || undefined,
    district: body.district || undefined,
    locality: body.locality || undefined,
    surveyType: body.surveyType || undefined,
    revision: body.revision || undefined,
    parcelNumber: body.parcelNumber || undefined,
    referenceNumber: body.referenceNumber || undefined,
  }

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  }

  // ── 1. Fetch project row ──────────────────────────────────────────────
  const { rows: projectRows } = await db.query<ProjectRow>(
    `SELECT
       p.id, p.name, p.survey_type, p.lr_number, p.location,
       p.registration_district, p.locality, p.ref_no, p.area_ha,
       p.boundary_data,
       sp.isk_number  AS surveyor_isk,
       sp.firm_name   AS surveyor_firm,
       u.full_name    AS surveyor_name
     FROM projects p
     LEFT JOIN surveyor_profiles sp ON sp.user_id = p.user_id
     LEFT JOIN users u             ON u.id = p.user_id
     WHERE p.id = $1 AND p.user_id = $2
     LIMIT 1`,
    [projectId, ctx.userId]
  )

  if (projectRows.length === 0) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const proj = projectRows[0]

  // ── 2. Fetch traverse results (most recent) ───────────────────────────
  const { rows: traverseRows } = await db.query<TraverseResultRow>(
    `SELECT results
     FROM traverse_results
     WHERE project_id = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [projectId]
  )

  // ── 3. Assemble FormC22Input ──────────────────────────────────────────
  const input = assembleFormC22Input(proj, traverseRows[0]?.results ?? null, overrides)

  // ── 4. Format=json metadata branch ────────────────────────────────────
  if (body.format === 'json') {
    return NextResponse.json({
      success: true,
      metadata: {
        projectName: input.projectName,
        lrNumber: input.lrNumber,
        county: input.county,
        stationCount: input.stations.length,
        areaHa: input.areaHa,
        precisionRatio: input.precisionRatio,
        angularMisclosureSec: input.angularMisclosureSec,
        linearMisclosureM: input.linearMisclosureM,
      },
    })
  }

  // ── 5. Generate PDF ──────────────────────────────────────────────────
  const pdfBuffer = generateFormC22Pdf(input)

  // ── 6. Audit log ──────────────────────────────────────────────────────
  try {
    await db.query<never>(
      `INSERT INTO form_c22_audits
         (project_id, generated_by, station_count, area_ha, precision_ratio, angular_misclosure_sec, linear_misclosure_m, file_size_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        projectId,
        ctx.userId,
        input.stations.length,
        input.areaHa,
        input.precisionRatio,
        input.angularMisclosureSec,
        input.linearMisclosureM,
        (pdfBuffer as unknown as Uint8Array).length,
      ]
    )
  } catch (auditErr) {
    // Audit failure should not block the PDF response
    logger.error('[form-c22] audit log failed:', { error: auditErr })
  }

  const safeName = (input.lrNumber || input.projectName || 'unknown')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase()

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="form-c22-${safeName}.pdf"`,
    },
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ProjectRow {
  name: string
  survey_type: string | null
  lr_number: string | null
  location: string | null
  registration_district: string | null
  locality: string | null
  ref_no: string | null
  area_ha: number | null
  boundary_data: Record<string, unknown> | null
  surveyor_isk: string | null
  surveyor_firm: string | null
  surveyor_name: string | null
}

interface TraverseResultRow {
  results: Record<string, unknown> | null
}

/**
 * Build a FormC22Input from the project row and optional traverse results.
 *
 * When traverse results are available the closure statistics are populated
 * from the computed data.  Otherwise sensible defaults are used so the PDF
 * still generates (useful for pre-computation previews).
 */
function assembleFormC22Input(
  proj: ProjectRow,
  traverseResults: Record<string, unknown> | null,
  overrides?: {
    county?: string
    division?: string
    district?: string
    locality?: string
    surveyType?: string
    revision?: string
    parcelNumber?: string
    referenceNumber?: string
  }
): FormC22Input {
  // ── Stations from boundary_data (saved by CadastralComputeIntegration) ─
  const stations = extractStations(proj.boundary_data)

  // ── Closure data from traverse results JSONB ──────────────────────────
  const closure = extractClosure(traverseResults)

  return {
    projectName: proj.name || 'Untitled Project',
    lrNumber: proj.lr_number || '',
    parcelNumber: overrides?.parcelNumber || '',
    county: overrides?.county || proj.registration_district || '',
    division: overrides?.division || '',
    district: overrides?.district || '',
    locality: overrides?.locality || proj.locality || '',
    surveyType: overrides?.surveyType || proj.survey_type || '',
    surveyorName: proj.surveyor_name || '',
    iskNumber: proj.surveyor_isk || '',
    firmName: proj.surveyor_firm || '',
    referenceNumber: overrides?.referenceNumber || proj.ref_no || '',
    revision: overrides?.revision || '',
    stations,
    angularMisclosureSec: closure.angularMisclosureSec,
    angularToleranceSec: closure.angularToleranceSec,
    linearMisclosureM: closure.linearMisclosureM,
    perimeterM: closure.perimeterM,
    precisionRatio: closure.precisionRatio,
    areaM2: closure.areaM2,
    areaHa: closure.areaHa,
  }
}

/**
 * Extract stations array from `projects.boundary_data.adjustedStations`.
 *
 * Each entry from CadastralComputeIntegration looks like:
 *   { pointName, originalEasting, originalNorthing, adjustedEasting, adjustedNorthing }
 *
 * For C22 we also need to compute raw departures/latitudes and corrections.
 */
function extractStations(
  boundaryData: Record<string, unknown> | null
): FormC22Input['stations'] {
  if (!boundaryData?.adjustedStations || !Array.isArray(boundaryData.adjustedStations)) {
    return []
  }

  const raw: Array<Record<string, number>> = boundaryData.adjustedStations as Array<Record<string, number>>

  if (raw.length < 3) return []

  // Compute per-leg departures, latitudes, and the Bowditch corrections
  const n = raw.length
  const legs: Array<{
    dE: number
    dN: number
    dist: number
    bearing: number
  }> = []

  for (let i = 0; i < n; i++) {
    const curr = raw[i]
    const next = raw[(i + 1) % n]
    const dE = (next.adjustedEasting ?? 0) - (curr.adjustedEasting ?? 0)
    const dN = (next.adjustedNorthing ?? 0) - (curr.adjustedNorthing ?? 0)
    const dist = Math.sqrt(dE * dE + dN * dN)
    const bearing = ((Math.atan2(dE, dN) * 180) / Math.PI + 360) % 360
    legs.push({ dE, dN, dist, bearing })
  }

  const perimeter = legs.reduce((s, l) => s + l.dist, 0)
  const sumDE = legs.reduce((s, l) => s + l.dE, 0)
  const sumDN = legs.reduce((s, l) => s + l.dN, 0)

  // Distribute the misclosure proportionally (Bowditch)
  return legs.map((leg, i) => {
    const ratio = perimeter > 0 ? leg.dist / perimeter : 0
    const corrE = -sumDE * ratio
    const corrN = -sumDN * ratio

    // Observed distance = raw distance (already stored as leg distance)
    // Observed bearing = bearing from adjusted coords (best we have)
    const stationFrom = raw[i]
    const stationTo = raw[(i + 1) % n]

    return {
      label: String(stationFrom.pointName ?? `ST${i + 1}`),
      observedBearing: leg.bearing,
      observedDistance: leg.dist,
      easting: (stationFrom.adjustedEasting ?? 0) - corrE,
      northing: (stationFrom.adjustedNorthing ?? 0) - corrN,
      adjustedEasting: stationTo.adjustedEasting ?? 0,
      adjustedNorthing: stationTo.adjustedNorthing ?? 0,
      departureRaw: leg.dE,
      latitudeRaw: leg.dN,
      departureCorrection: corrE,
      latitudeCorrection: corrN,
    }
  })
}

/**
 * Extract closure statistics from traverse_results JSONB.
 */
function extractClosure(
  results: Record<string, unknown> | null
): {
  angularMisclosureSec: number
  angularToleranceSec: number
  linearMisclosureM: number
  perimeterM: number
  precisionRatio: number
  areaM2: number
  areaHa: number
} {
  const defaults = {
    angularMisclosureSec: 0,
    angularToleranceSec: 30, // 30″ for a typical cadastral traverse
    linearMisclosureM: 0,
    perimeterM: 0,
    precisionRatio: 10000,
    areaM2: 0,
    areaHa: 0,
  }

  if (!results) return defaults

  // The JSONB structure from traverse_runner may vary — handle common shapes
  const r = results as Record<string, Record<string, unknown>>

  // Try nested shape: { adjustedStations: { linearMisclosure, ... } }
  const adj = r.adjustedStations ?? r.adjustedStations as Record<string, unknown> | undefined
  const misc = r.misclosure ?? r.closure ?? r.summary ?? {} as Record<string, unknown>

  return {
    angularMisclosureSec: toNum(adj?.angularMisclosure ?? misc?.angularMisclosure ?? 0),
    angularToleranceSec: toNum(adj?.angularTolerance ?? misc?.angularTolerance ?? defaults.angularToleranceSec),
    linearMisclosureM: toNum(adj?.linearMisclosure ?? misc?.linearMisclosure ?? misc?.linearMisclosureM ?? 0),
    perimeterM: toNum(adj?.perimeter ?? misc?.perimeter ?? 0),
    precisionRatio: toNum(adj?.precisionRatio ?? misc?.precisionRatio ?? defaults.precisionRatio),
    areaM2: toNum(r.areaM2 ?? r.area_sqm ?? r.computedAreaM2 ?? 0),
    areaHa: toNum(r.areaHa ?? r.area_hectares ?? 0),
  }
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0
  const n = Number(v)
  return isFinite(n) ? n : 0
}
