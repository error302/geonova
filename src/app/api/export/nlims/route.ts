import { NextResponse } from 'next/server'
import { apiHandler, apiSuccess } from '@/lib/apiHandler'
import { exportToNLIMS, validateNLIMSExport, type NLIMSExportParams } from '@/lib/export/nlimsExporter'
import { runStatutoryGate, formatGateResult, type StatutoryGateInput } from '@/lib/validation/statutoryGate'
import { logger } from '@/lib/logger'
import { SRID_21037 } from '@/lib/map/projection'

export const dynamic = 'force-dynamic'

/**
 * POST /api/export/nlims
 *
 * Generate an NLIMS/ArdhiSasa submission payload from survey data.
 *
 * Two-stage validation:
 *   1. validateNLIMSExport — schema/shapes (parcel count, beacon nomenclature,
 *      area reconciliation). Fast, fails on structural errors.
 *   2. runStatutoryGate — regulatory rules (Cap 299, RDM 1.1, ArdhiSasa
 *      tolerances). Slower, fails on accuracy issues that would cause
 *      ArdhiSasa to reject the submission.
 *
 * The gate runs on whatever subset of input is available — if traverse
 * observations aren't supplied in the request, those rules are skipped
 * rather than failing. Callers who want a full pre-flight check should
 * load project data via statutoryGateLoader.loadGateInputForProject()
 * and merge it with the request body.
 */
export const POST = apiHandler(
  { auth: true, rateLimit: { max: 30, windowMs: 60000 } },
  async (req, ctx) => {
    const params = ctx.body as NLIMSExportParams

    // Stage 1: schema validation
    const validation = validateNLIMSExport(params)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'NLIMS validation failed', validation },
        { status: 400 },
      )
    }

    // Stage 2: statutory gate
    const gateInput = buildGateInputFromNLIMSParams(params)
    const gateResult = runStatutoryGate(gateInput)
    if (!gateResult.passed) {
      return NextResponse.json(
        {
          error: `Statutory validation failed — ${gateResult.summary.block} blocking violation(s)`,
          gate: gateResult,
          formatted: formatGateResult(gateResult),
        },
        { status: 422 }, // 422 Unprocessable Entity — schema OK, business rules failed
      )
    }

    const { payload, validation: val } = await exportToNLIMS(params)

    // Audit chain — record the NLIMS submission.
    // Tamper-evident proof that this payload left the system.
    try {
      const { appendAuditEntry } = await import('@/lib/audit/auditLog')
      await appendAuditEntry({
        projectId: null, // NLIMS submission may span multiple projects
        userId: ctx.userId,
        userName: params.surveyor.name || undefined,
        entityType: 'document',
        entityId: `nlims/${payload.submissionId}`,
        action: 'submit',
        payload: {
          new: {
            submissionType: params.submissionType,
            parcelCount: params.resultingParcels.length,
            integrityHash: payload.integrity.hash,
          },
          reason: 'NLIMS/ArdhiSasa submission generated',
          metadata: {
            gateRuleVersion: gateResult.ruleVersion,
            gatePassed: gateResult.passed,
          },
        },
      })
    } catch (auditErr) {
      // Don't block the export on audit failure
      logger.warn('[nlims/export] Audit chain append failed:', { error: auditErr })
    }

    return apiSuccess({
      payload,
      validation: val,
      gate: gateResult,
      downloadUrl: null,
    })
  },
)

/**
 * Build a partial StatutoryGateInput from the NLIMS export params.
 * The gate tolerates missing fields — rules whose inputs are absent
 * are skipped rather than failing.
 */
function buildGateInputFromNLIMSParams(params: NLIMSExportParams): StatutoryGateInput {
  return {
    surveyType: 'cadastral', // NLIMS submissions are inherently cadastral
    surveyor: {
      name: params.surveyor.name,
      licenseNumber: params.surveyor.licenseNumber,
    },
    submissionType: params.submissionType,
    parcels: params.resultingParcels.map((p) => ({
      parcelNumber: p.parcelNumber,
      vertices: p.vertices,
    })),
    parentParcel: params.parentParcel
      ? {
          areaHectares: params.parentParcel.areaHectares,
          vertices: params.parentParcel.vertices,
        }
      : undefined,
    areaToleranceHectares: params.areaToleranceHectares,
    // traverse and leveling are not carried in NLIMSExportParams —
    // callers who want full pre-flight should merge in project data
    // via statutoryGateLoader.mergeGateInput().
  }
}

/**
 * GET /api/export/nlims — Schema documentation
 */
export const GET = apiHandler(
  { auth: true },
  async (_req, _ctx) => {
    return apiSuccess({
      schema: {
        version: '1.0.0',
        standard: 'Kenya Land Registration Act 2012, Survey Act Cap 299',
        submissionTypes: ['mutation', 'subdivision', 'amalgamation', 'new_registration', 'boundary_adjustment'],
        beaconPatterns: ['KP/XX/YY', 'MB/XXX', 'IRP/XXX', 'RMB/XXX'],
        coordinateSystem: {
          datum: 'Arc 1960',
          projection: 'UTM Zone 37S',
          epsg: SRID_21037,
          precision: '3 decimal places (mm)',
        },
        areaTolerance: { default: '0.001 ha (10 m²)' },
        precisionThresholds: { urban: '1:10,000', rural: '1:5,000', topographic: '1:1,000' },
        statutoryGate: {
          ruleVersion: '1.0.0',
          sources: ['cap299', 'survey_regs_1994', 'rdm_1_1', 'ardhisasa', 'lra_2012', 'sok_standard'],
        },
      },
    })
  },
)
