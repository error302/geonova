export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { z } from 'zod'
import type { DeedPlanInput, DeedPlanOutput } from '@/types/deedPlan'
import { computeBoundaryLegs, computeArea, computeClosureCheck } from '@/lib/compute/deedPlan'
import { renderDeedPlanSVG } from '@/lib/compute/deedPlanRenderer'
import { runStatutoryGate, type StatutoryGateResult } from '@/lib/validation/statutoryGate'

const BoundaryPointSchema = z.object({
  id: z.string().optional(),
  easting: z.number(),
  northing: z.number(),
  elevation: z.number().optional(),
  markType: z.string().optional(),
  markStatus: z.string().optional(),
  description: z.string().optional(),
})

const DeedPlanRequestSchema = z.object({
  surveyNumber: z.string().optional(),
  drawingNumber: z.string().optional(),
  parcelNumber: z.string().optional(),
  locality: z.string().optional(),
  area: z.number().optional(),
  registrationSection: z.string().optional(),
  county: z.string().optional(),
  utmZone: z.number().optional(),
  hemisphere: z.enum(['N', 'S']).optional(),
  scale: z.enum(['500', '1000', '2500', '5000']).optional(),
  datum: z.enum(['ARC1960', 'WGS84']).optional(),
  projectionType: z.enum(['UTM', 'Cassini']).optional(),
  // Grid-to-ground correction (RDM 1.1)
  scaleFactor: z.number().optional(),
  meanElevation: z.number().optional(),
  gridArea: z.number().optional(),
  // SRVY2025-1 submission
  submissionNumber: z.string().optional(),
  sheetNumber: z.number().optional(),
  totalSheets: z.number().optional(),
  boundaryPoints: z.array(BoundaryPointSchema).min(3, 'A deed plan requires at least 3 boundary points'),
  abuttalNorth: z.string().optional(),
  abuttalSouth: z.string().optional(),
  abuttalEast: z.string().optional(),
  abuttalWest: z.string().optional(),
  surveyorName: z.string().optional(),
  iskNumber: z.string().optional(),
  firmName: z.string().optional(),
  firmAddress: z.string().optional(),
  surveyDate: z.string().optional(),
  signatureDate: z.string().optional(),
  clientName: z.string().optional(),
  titleDeedNumber: z.string().optional(),
  firNumber: z.string().optional(),
  registryMapSheet: z.string().optional(),
  drawnBy: z.string().optional(),
  checkedBy: z.string().optional(),
  controlClass: z.enum(['FIRST', 'SECOND', 'THIRD', 'FOURTH']).optional(),
})

export const POST = apiHandler(
  { auth: true, schema: DeedPlanRequestSchema, audit: 'deed_plan_generated',
    auditChain: { entityType: 'document', action: 'generate', projectIdFromBody: 'projectId' },
    rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const raw = ctx.body as z.infer<typeof DeedPlanRequestSchema>

    const input: DeedPlanInput = {
      surveyNumber: raw.surveyNumber || '',
      drawingNumber: raw.drawingNumber || '',
      parcelNumber: raw.parcelNumber || '',
      locality: raw.locality || '',
      area: raw.area || 0,
      registrationSection: raw.registrationSection || '',
      county: raw.county || '',
      utmZone: raw.utmZone || 37,
      hemisphere: raw.hemisphere || 'S',
      scale: (Number(raw.scale) || 1000) as 500 | 1000 | 2500 | 5000,
      datum: raw.datum || 'ARC1960',
      projectionType: (raw.projectionType || 'UTM') as 'UTM' | 'Cassini',
      boundaryPoints: raw.boundaryPoints.map((p, i) => ({
        id: p.id || `P${i + 1}`,
        easting: p.easting,
        northing: p.northing,
        elevation: p.elevation,
        markType: (p.markType || 'CONCRETE_BEACON') as import('@/types/deedPlan').BeaconType,
        markStatus: (p.markStatus || 'SET') as import('@/types/deedPlan').BeaconStatus,
        description: p.description,
      })),
      abuttalNorth: raw.abuttalNorth || '',
      abuttalSouth: raw.abuttalSouth || '',
      abuttalEast: raw.abuttalEast || '',
      abuttalWest: raw.abuttalWest || '',
      surveyorName: raw.surveyorName || '',
      iskNumber: raw.iskNumber || '',
      firmName: raw.firmName || '',
      firmAddress: raw.firmAddress || '',
      surveyDate: raw.surveyDate || '',
      signatureDate: raw.signatureDate || '',
      clientName: raw.clientName,
      titleDeedNumber: raw.titleDeedNumber,
      firNumber: raw.firNumber,
      registryMapSheet: raw.registryMapSheet,
      drawnBy: raw.drawnBy,
      checkedBy: raw.checkedBy,
      // SRVY2025-1
      submissionNumber: raw.submissionNumber,
      sheetNumber: raw.sheetNumber,
      totalSheets: raw.totalSheets,
      // Grid-to-ground
      scaleFactor: raw.scaleFactor,
      meanElevation: raw.meanElevation,
      gridArea: raw.gridArea,
      controlClass: raw.controlClass,
    }

    const bearingSchedule = computeBoundaryLegs(input.boundaryPoints)
    const area = computeArea(input.boundaryPoints)
    const closureCheck = computeClosureCheck(input.boundaryPoints)

    // ── AUDIT FIX (2026-07-05): Run cross-checks before generating deed plan ──
    // These independent verification methods catch computation errors
    // that could lead to incorrect boundaries and encroachment disputes.
    const crossCheckIssues: string[] = []

    try {
      const { crossCheckArea, crossCheckClosure } = await import('@/lib/engine/calculationCrossCheck')

      // Convert boundary points to Point2D format for cross-checks
      const points2D = input.boundaryPoints.map(p => ({
        easting: p.easting,
        northing: p.northing,
      }))

      // Area cross-check: Shoelace vs. triangulation
      const areaCheck = crossCheckArea(points2D)
      if (!areaCheck.passed) {
        crossCheckIssues.push(`Area cross-check failed: ${areaCheck.message}`)
      }

      // Closure cross-check: coordinate round-trip
      if (points2D.length >= 2) {
        const start = points2D[0]
        const end = points2D[points2D.length - 1]
        const linearError = Math.sqrt(
          closureCheck.closingErrorE ** 2 + closureCheck.closingErrorN ** 2
        )
        const closureCheckResult = crossCheckClosure(
          start.easting, start.northing,
          end.easting, end.northing,
          linearError, 0,
          0.001
        )
        if (!closureCheckResult.passed) {
          crossCheckIssues.push(`Closure cross-check failed: ${closureCheckResult.message}`)
        }
      }
    } catch {
      // Cross-check module not available — non-blocking but log
      console.warn('[deed-plan] Cross-check module not available')
    }

    // If cross-checks found issues, include them in the output as warnings
    if (crossCheckIssues.length > 0) {
      console.warn('[deed-plan] Cross-check issues:', crossCheckIssues)
    }

    // ── AUDIT FIX (2026-07-05): Run statutory gate ──
    let gateResult: StatutoryGateResult | null = null
    try {
      const linearError = Math.sqrt(
        closureCheck.closingErrorE ** 2 + closureCheck.closingErrorN ** 2
      )
      const precisionRatioNum = linearError > 0
        ? Math.round(closureCheck.perimeter / linearError)
        : 999999

      gateResult = runStatutoryGate({
        surveyType: 'cadastral',
        surveyor: {
          name: input.surveyorName || 'Unknown',
          licenseNumber: input.iskNumber || 'N/A',
        },
        traverse: {
          stationCount: input.boundaryPoints.length,
          linearErrorM: linearError,
          totalDistanceM: closureCheck.perimeter,
          precisionRatio: precisionRatioNum,
        },
        parcels: [{
          vertices: input.boundaryPoints.map(p => ({
            easting: p.easting,
            northing: p.northing,
          })),
          parcelNumber: input.parcelNumber || '',
        }],
      })

      if (!gateResult.passed) {
        console.warn('[deed-plan] Statutory gate blocked:', gateResult.summary)
      }
    } catch (err) {
      console.warn('[deed-plan] Statutory gate failed to run:', err)
    }

    const svg = renderDeedPlanSVG({ ...input, area }, bearingSchedule, closureCheck)

    const output: DeedPlanOutput = {
      svg,
      bearingSchedule,
      coordinateSchedule: input.boundaryPoints,
      closureCheck,
      ...(crossCheckIssues.length > 0 ? { crossCheckWarnings: crossCheckIssues } : {}),
      ...(gateResult ? { statutoryGate: gateResult } : {}),
    }

    return NextResponse.json(output)
  }
)
