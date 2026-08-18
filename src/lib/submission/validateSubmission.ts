import type {
  SubmissionPackage,
  QAGateResult,
  QABlocker,
  QAWarning
} from './types'

import { TRAVERSE_PRECISION_STANDARDS, angularClosureTolerance } from '@/lib/engine/traverse'

const SUBTYPE_TO_SURVEY_TYPE: Record<string, keyof typeof TRAVERSE_PRECISION_STANDARDS> = {
  cadastral_subdivision: 'cadastral',
  cadastral_amalgamation: 'cadastral',
  cadastral_resurvey: 'cadastral',
  cadastral_mutation: 'cadastral',
  topographic_site: 'topographic',
  topographic_corridor: 'topographic',
  engineering_road: 'engineering',
  engineering_bridge: 'engineering',
  engineering_dam: 'engineering',
  geodetic_control: 'geodetic',
  mining: 'mining',
  hydrographic: 'hydrographic',
  drone: 'drone',
  deformation: 'deformation',
}

/**
 * Survey types whose primary field methodology is GNSS (static/RTK/PPK
 * baselines rather than traverse or levelling): geodetic control networks,
 * drone/UAV photogrammetry (GNSS base stations + GCPs), and deformation
 * monitoring (GNSS monitoring arrays). For these subtypes the GNSS
 * observation report is a REQUIRED package artifact — assembly blocks
 * without one.
 */
const GNSS_BASED_SURVEY_TYPES = new Set<string>(['geodetic', 'drone', 'deformation'])

/**
 * True when a submission subtype is GNSS-based, i.e. its survey type is one
 * of {@link GNSS_BASED_SURVEY_TYPES}. Accepts both the extended subtype
 * (`geodetic_control`) and the raw project survey type (`geodetic`), since
 * `pkg.subtype` is sourced from `projects.survey_type` at assembly time.
 */
export function isGNSSBasedSubtype(subtype: string): boolean {
  const surveyType = SUBTYPE_TO_SURVEY_TYPE[subtype]
  return surveyType
    ? GNSS_BASED_SURVEY_TYPES.has(surveyType)
    : GNSS_BASED_SURVEY_TYPES.has(subtype)
}

export interface ValidateSubmissionOptions {
  /**
   * Reason recorded by the surveyor to override a FAILED GNSS session QC
   * gate. When present and non-empty, a `fail`-verdict GNSS report becomes
   * a warning instead of a blocker (the reason is embedded in the QA
   * result and lands in the package manifest for audit).
   */
  gnssOverrideReason?: string
}

export function validateSubmission(
  pkg: SubmissionPackage,
  opts?: ValidateSubmissionOptions
): QAGateResult {
  const blockers: QABlocker[] = []
  const warnings: QAWarning[] = []

  if (!pkg.surveyor.registrationNumber) {
    blockers.push({
      code: 'NO_REG_NUMBER',
      message: 'Surveyor registration number is missing. Update your profile before submitting.'
    })
  }

  if (!pkg.surveyor.isKMemberActive) {
    warnings.push({
      code: 'ISK_INACTIVE',
      message: 'ISK membership may not be current. Verify before submission to Director of Surveys.'
    })
  }

  if (!pkg.parcel.lrNumber) {
    blockers.push({
      code: 'NO_LR_NUMBER',
      message: 'LR Number is required for cadastral submission.'
    })
  }

  if (!pkg.parcel.county) {
    blockers.push({
      code: 'NO_COUNTY',
      message: 'County is required on Form No. 4.'
    })
  }

  if (!pkg.parcel.district) {
    blockers.push({
      code: 'NO_DISTRICT',
      message: 'District is required for cadastral submission per Survey Act Cap 299.'
    })
  }

  if (!pkg.parcel.locality) {
    warnings.push({
      code: 'NO_LOCALITY',
      message: 'Locality not specified. Recommended for Director of Surveys clarity.'
    })
  }

  const surveyType = SUBTYPE_TO_SURVEY_TYPE[pkg.subtype] || 'cadastral'
  const requiredPrecision = TRAVERSE_PRECISION_STANDARDS[surveyType]
  const precisionParts = pkg.traverse.precisionRatio.split(':')
  const denominator = parseInt(precisionParts[1], 10)

  if (isNaN(denominator) || denominator < requiredPrecision) {
    blockers.push({
      code: 'PRECISION_FAILURE',
      message: `Traverse precision ${pkg.traverse.precisionRatio} does not meet minimum 1:${requiredPrecision} required for ${pkg.subtype}.`
    })
  }

  if (pkg.traverse.points.length < 3) {
    blockers.push({
      code: 'INSUFFICIENT_POINTS',
      message: 'A minimum of 3 survey points are required.'
    })
  }

  const requiredDocs = pkg.supportingDocs.filter(d => d.required)
  const missingDocs = requiredDocs.filter(d => !d.fileUrl)

  missingDocs.forEach(doc => {
    blockers.push({
      code: `MISSING_DOC_${doc.type.toUpperCase()}`,
      message: `${doc.label} is required for this submission type and has not been uploaded.`
    })
  })

  if (pkg.parcel.areaM2 <= 0) {
    blockers.push({
      code: 'INVALID_AREA',
      message: 'Computed parcel area is zero or negative. Check traverse computation.'
    })
  }

  const angularTolerance = angularClosureTolerance(pkg.traverse.points.length)
  if (pkg.traverse.angularMisclosure > angularTolerance) {
    blockers.push({
      code: 'ANGULAR_MISCLOSURE_EXCEEDED',
      message: `Angular misclosure ${(pkg.traverse.angularMisclosure).toFixed(1)}" exceeds 20√n = ${(20 * Math.sqrt(pkg.traverse.points.length)).toFixed(1)}" limit.`
    })
  }

  const perimeterKm = pkg.traverse.perimeterM / 1000
  const levellingTolerance = 10 * Math.sqrt(perimeterKm)
  if (pkg.traverse.linearMisclosure > levellingTolerance / 1000) {
    warnings.push({
      code: 'LEVELLING_TOLERANCE_WARNING',
      message: `Linear misclosure may exceed 10√K mm tolerance. Verify levelling computations per RDM 1.1 Table 5.1.`
    })
  }

  if (pkg.revision > 1) {
    warnings.push({
      code: 'MULTIPLE_REVISIONS',
      message: `This is revision R${pkg.revision.toString().padStart(2, '0')}. Ensure all previous comments from Director of Surveys have been addressed.`
    })
  }

  // ── GNSS required-artifact gate ──
  // For GNSS-based survey subtypes (geodetic control, drone, deformation)
  // the observation report is a required package artifact: a package cannot
  // be assembled without it. Unlike a FAILED-session override, an absent
  // report cannot be overridden — the session must be processed and the
  // report saved first.
  if (isGNSSBasedSubtype(pkg.subtype) && !pkg.gnss) {
    blockers.push({
      code: 'GNSS_REPORT_REQUIRED',
      field: 'gnss',
      message: `GNSS observation report is required for ${pkg.subtype} submissions. Process the baseline session and save the report from the GNSS Baseline tool before assembling.`
    })
  }

  // ── GNSS session QC gate ──
  // A FAILED GNSS session (from /api/submission/gnss-observation-report)
  // blocks assembly unless the surveyor records an override reason. The
  // reason flows into the QA result and the package manifest so the
  // override is auditable by the boundary commission.
  if (pkg.gnss) {
    if (pkg.gnss.verdict === 'fail') {
      const failIssues = (pkg.gnss.issues ?? [])
        .filter(i => i.level === 'fail')
        .slice(0, 3)
        .map(i => i.message)
      const override = opts?.gnssOverrideReason?.trim()
      if (override) {
        warnings.push({
          code: 'GNSS_QC_OVERRIDE',
          message: `GNSS session QC FAILED but overridden: "${override}" (report ${pkg.gnss.reportId}).`
        })
      } else {
        blockers.push({
          code: 'GNSS_QC_FAILED',
          field: 'gnss',
          message: failIssues.length > 0
            ? `GNSS session QC FAILED (${failIssues.join('; ')}). Record an override reason to assemble anyway.`
            : 'GNSS session QC FAILED. Record an override reason to assemble anyway.'
        })
      }
    } else if (pkg.gnss.verdict === 'warn') {
      warnings.push({
        code: 'GNSS_QC_WARNING',
        message: 'GNSS session QC passed with warnings. Verify signal quality before submission to Director of Surveys.'
      })
    }
  }

  return {
    passed: blockers.length === 0,
    blockers,
    warnings
  }
}

export function getSubmissionChecklist(subtype: string): { code: string; label: string; required: boolean }[] {
  const surveyType = SUBTYPE_TO_SURVEY_TYPE[subtype] || 'cadastral'
  const minPrecision = TRAVERSE_PRECISION_STANDARDS[surveyType]
  
  const base = [
    { code: 'COORD_SYS', label: 'Coordinate system specified (Arc 1960 / UTM Zone 37S)', required: true },
    { code: 'SURVEYOR_PROFILE', label: 'Licensed surveyor profile complete (ISK Reg. No.)', required: true },
    { code: 'LR_NUMBER', label: 'LR Number specified', required: true },
    { code: 'COUNTY', label: 'County specified', required: true },
    { code: 'DISTRICT', label: 'District specified', required: true },
    { code: 'AREA_COMPUTED', label: 'Parcel area computed and > 0', required: true },
    { code: 'PRECISION', label: `Traverse precision meets 1:${minPrecision}`, required: true },
    { code: 'BEACONS', label: 'Beacon types and positions verified', required: true },
    { code: 'FORM_NO4', label: 'Form No. 4 (Mutation Form) generated', required: true },
    { code: 'DXF_PLAN', label: 'DXF plan with TitleBlock generated', required: true },
  ]

  const cadastralExtras = [
    { code: 'PPA2', label: 'PPA2 (Permission to Amend) attached', required: true },
    { code: 'LCB_CONSENT', label: 'Land Control Board consent attached', required: true },
    { code: 'BEACON_CERT', label: 'Beacon completion certificate attached', required: true },
    { code: 'SEARCH_CERT', label: 'Official search certificate attached', required: false },
  ]

  const topoExtras = [
    { code: 'CONTOURS', label: 'Contour interval matches spec', required: true },
    { code: 'SPOT_HEIGHTS', label: 'Spot heights verified against field book', required: true },
    { code: 'IDW_COMPUTED', label: 'IDW interpolation completed', required: true },
  ]

  const engineeringExtras = [
    { code: 'HORIZONTAL_CURVE', label: 'Horizontal curve computation verified', required: true },
    { code: 'SUPERELEVATION', label: 'Superelevation within RDM 1.1 limits', required: true },
    { code: 'VERTICAL_CURVE', label: 'Vertical curve K-value meets SSD requirements', required: true },
    { code: 'EARTHWORKS', label: 'Cross-section volumes computed', required: false },
  ]

  if (subtype.startsWith('cadastral')) {
    return [...base, ...cadastralExtras]
  }
  if (subtype.startsWith('topographic')) {
    return [...base, ...topoExtras]
  }
  if (subtype.startsWith('engineering')) {
    return [...base, ...engineeringExtras]
  }

  return base
}
