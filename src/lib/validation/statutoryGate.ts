/**
 * Statutory Validation Gate
 * =========================
 *
 * The single pre-export checkpoint that runs all statutory and regulatory
 * validation rules in sequence and decides whether a survey deliverable
 * (deed plan, NLIMS payload, statutory workbook) is allowed to leave the
 * system.
 *
 * Why this exists
 * ---------------
 * Before this gate, the codebase had four isolated validators:
 *   - toleranceEngine.ts          (traverse + leveling numeric tolerances)
 *   - traverseValidation.ts       (angular misclosure only)
 *   - levelingValidation.ts       (arithmetic + closure)
 *   - nlimsExporter.validateNLIMSExport()  (schema shapes only)
 *
 * Each one validated a single concern, but nothing ran them all together.
 * A surveyor could generate a deed plan with a failed traverse closure
 * and the system would happily produce a PDF that ArdhiSasa would reject
 * on first submission. This gate closes that gap.
 *
 * Design
 * ------
 * - Pure function. No DB calls, no side effects. Callers fetch project
 *   data and assemble the input. This makes the gate trivially testable.
 * - Rules are tagged with their regulatory source (Cap 299, RDM 1.1,
 *   ArdhiSasa spec) so violations cite the exact clause the surveyor
 *   needs to fix.
 * - Three severity levels:
 *     'block' — export is refused. The deliverable will be rejected by
 *               ArdhiSasa / Survey of Kenya / the relevant authority.
 *     'warn'  — export proceeds, but the surveyor should review. The
 *               deliverable may pass but with caveats.
 *     'info'  — informational note. No action required.
 * - Rules are versioned (RULE_VERSION below). When regulations update,
 *   bump the version and add a changelog entry. This makes it possible
 *   to know which rule set a given validation result was evaluated
 *   against — important for audits and dispute resolution.
 *
 * Usage
 * -----
 *   import { runStatutoryGate } from '@/lib/validation/statutoryGate'
 *
 *   const result = await runStatutoryGate(input)
 *   if (!result.passed) {
 *     // refuse export, show violations to surveyor
 *   }
 *
 * Regulatory references
 * ---------------------
 * - Survey Act Cap 299 (Kenya) — boundary tolerances, beacon placement,
 *   angular misclosure limits
 * - Survey Regulations 1994 — procedural requirements
 * - RDM 1.1 (2023) Table 5.1 — levelling closure: 10√K mm ordinary,
 *   5√K mm precise; traverse precision ratios per survey class
 * - ArdhiSasa portal submission specification (2024) — parcel shape
 *   requirements, beacon nomenclature, area reconciliation tolerance
 * - Kenya Land Registration Act 2012 — submission types and encumbrances
 */

import type { SurveyType } from '@/types/project'
import {
  checkTolerance,
  type ToleranceProfile,
  type ToleranceCheckResult,
} from './toleranceEngine'
import { validateTraverse } from './traverseValidation'
import { validateLevelingClosure } from './levelingValidation'
import { stoppingSightDistance, minimumRadius } from '@/lib/engineering/compute'
import { shoelaceArea } from '@/lib/engine/area'

// ─── Rule versioning ────────────────────────────────────────────────────

/**
 * Bump this when any rule's threshold, message, or severity changes.
 * Record the change in CHANGELOG below.
 *
 * CHANGELOG:
 *   1.2.0 (2026-07) — Added ardhisasa.rim_overlap rule: blocks
 *     submission when the new parcel overlaps existing RIM parcels.
 *     Overlap detection is async (turf geometry), pre-computed by
 *     the loader and passed in via input.rimOverlaps.
 *   1.1.0 (2026-07) — Added KeNHA/KeRRA engineering design rules:
 *     minimum horizontal curve radius, stopping sight distance,
 *     superelevation rate cap. Rules sourced from RDM 1.1 §2.3,
 *     AASHTO Green Book, KeNHA Road Design Manual.
 *   1.0.0 (2026-07) — Initial gate. Consolidates toleranceEngine +
 *     traverseValidation + levelingValidation + nlimsExporter schema
 *     checks into a single pre-export gate. Rules sourced from
 *     Cap 299, RDM 1.1 (2023), ArdhiSasa spec (2024).
 */
export const RULE_VERSION = '1.2.0'

// ─── Types ──────────────────────────────────────────────────────────────

export type Severity = 'block' | 'warn' | 'info'

export type RegulatorySource =
  | 'cap299'           // Survey Act Cap 299
  | 'survey_regs_1994' // Survey Regulations 1994
  | 'rdm_1_1'          // RDM 1.1 (2023)
  | 'ardhisasa'        // ArdhiSasa portal spec
  | 'lra_2012'         // Land Registration Act 2012
  | 'sok_standard'     // Survey of Kenya general standard
  | 'metardu_qc'       // METARDU internal quality control (cross-checks)

export interface Violation {
  /** Rule identifier, e.g. 'cap299.angular_misclosure' */
  rule: string
  /** Regulatory source citation */
  source: RegulatorySource
  /** Severity — 'block' refuses export */
  severity: Severity
  /** Human-readable message (will be shown to the surveyor) */
  message: string
  /** Actual measured value, where applicable */
  actual?: number
  /** Allowable threshold, where applicable */
  allowable?: number
  /** Unit of actual/allowable */
  unit?: string
  /** Which input field the violation relates to */
  field?: string
}

export interface StatutoryGateInput {
  surveyType: SurveyType

  /** Traverse observations — required for cadastral, engineering, geodetic */
  traverse?: {
    stationCount: number
    /** Angular misclosure in seconds of arc (signed) */
    angularMisclosureSeconds?: number
    /** Linear misclosure (closing error) in metres */
    linearErrorM: number
    /** Total traverse perimeter in metres */
    totalDistanceM: number
    /** Precision ratio as the large number, e.g. 5000 means 1:5000 */
    precisionRatio: number
  }

  /** Leveling observations — required for engineering, topographic, deformation */
  leveling?: {
    sumBS: number
    sumFS: number
    firstRL: number
    lastRL: number
    distanceKm: number
    type: 'ordinary' | 'precise'
  }

  /** Resulting parcels — required for cadastral submissions */
  parcels?: {
    /** Vertices — only easting/northing are required; name is optional */
    vertices: Array<{ easting: number; northing: number; name?: string }>
    parcelNumber: string
  }[]

  /** Parent parcel — required for subdivisions and mutations */
  parentParcel?: {
    areaHectares: number
    vertices: Array<{ easting: number; northing: number; name?: string }>
  }

  /** Surveyor credentials — always required */
  surveyor: {
    name: string
    licenseNumber: string
  }

  /** Engineering design parameters — required for engineering surveyType.
   *  Used by KeNHA/KeRRA design rules (curve radius, sight distance). */
  engineering?: {
    /** Design speed in km/h (e.g. 80 for rural highway, 50 for urban) */
    designSpeedKph: number
    /** Horizontal curve radius in metres (the actual designed radius) */
    horizontalCurveRadiusM?: number
    /** Road grade in percent (positive uphill). Used for SSD adjustment. */
    gradePercent?: number
    /** Available sight distance in metres (the actual measured/available SSD) */
    availableSightDistanceM?: number
    /** Superelevation rate as decimal (e.g. 0.07 for 7%) */
    superelevation?: number
    /** Side friction factor (default 0.15 per AASHTO) */
    sideFriction?: number
  }

  /** Submission type — affects which rules apply */
  submissionType?:
    | 'mutation'
    | 'subdivision'
    | 'amalgamation'
    | 'new_registration'
    | 'boundary_adjustment'

  /**
   * Override the tolerance profile. If omitted, the gate selects based on
   * surveyType (cadastral → 'cadastral', engineering → 'engineering',
   * geodetic → 'control', others → 'cadastral' as the default).
   */
  toleranceProfileOverride?: ToleranceProfile

  /**
   * Area reconciliation tolerance in hectares. Default: 0.001 ha (10 m²).
   * Per ArdhiSasa spec, subdivisions must reconcile to within this tolerance.
   */
  areaToleranceHectares?: number

  /**
   * RIM overlap detection results — pre-computed by the loader (since
   * the geometry check is async and the gate is pure-sync). When
   * present, the ardhisasa.rim_overlap rule fires.
   *
   * Use loadRimOverlaps() from rim/overlapDetection.ts to populate
   * this field before calling runStatutoryGate().
   */
  rimOverlaps?: Array<{
    existingParcelNumber: string
    overlapAreaSqm: number
    overlapPercent: number
  }>
}

export interface StatutoryGateResult {
  /** True iff zero 'block' violations */
  passed: boolean
  /** All violations, ordered by severity (block → warn → info) */
  violations: Violation[]
  /** Which tolerance profile was applied */
  profile: ToleranceProfile
  /** ISO timestamp of evaluation */
  evaluatedAt: string
  /** Rule set version */
  ruleVersion: string
  /** Summary counts by severity */
  summary: {
    block: number
    warn: number
    info: number
    total: number
  }
}

// ─── Rule helpers ───────────────────────────────────────────────────────

function selectProfile(input: StatutoryGateInput): ToleranceProfile {
  if (input.toleranceProfileOverride) return input.toleranceProfileOverride
  switch (input.surveyType) {
    case 'geodetic':
      return 'control'
    case 'engineering':
      return 'engineering'
    case 'cadastral':
    case 'topographic':
    case 'drone':
    case 'deformation':
    default:
      return 'cadastral'
  }
}

// shoelaceArea is imported from @/lib/engine/area (canonical implementation)

// ─── Rule implementations ──────────────────────────────────────────────

/**
 * Rule: Traverse precision ratio meets profile minimum.
 * Source: RDM 1.1 Table 2.4; Cap 299 §17 (cadastral precision).
 */
function ruleTraversePrecision(
  input: StatutoryGateInput,
  profile: ToleranceProfile,
  violations: Violation[]
): void {
  if (!input.traverse) return
  const { precisionRatio, totalDistanceM } = input.traverse
  if (totalDistanceM <= 0) return

  const minimums: Record<ToleranceProfile, number> = {
    cadastral: 5000,   // 1:5000
    engineering: 10000, // 1:10000
    control: 20000,    // 1:20000
  }
  const required = minimums[profile]

  if (precisionRatio < required) {
    violations.push({
      rule: 'rdm_1_1.traverse_precision',
      source: 'rdm_1_1',
      severity: 'block',
      message: `Traverse precision 1:${Math.round(precisionRatio)} is below the ${profile} minimum of 1:${required}. ArdhiSasa will reject this submission.`,
      actual: precisionRatio,
      allowable: required,
      unit: '1:X',
      field: 'traverse.precisionRatio',
    })
  }
}

/**
 * Rule: Angular misclosure within ±√n × profile factor.
 * Source: Cap 299 §18; RDM 1.1 Table 2.4.
 * Note: toleranceEngine uses seconds; traverseValidation uses minutes.
 * We use seconds throughout the gate for consistency and convert.
 */
function ruleAngularMisclosure(
  input: StatutoryGateInput,
  profile: ToleranceProfile,
  violations: Violation[]
): void {
  if (!input.traverse?.angularMisclosureSeconds) return
  const { stationCount, angularMisclosureSeconds } = input.traverse
  if (stationCount <= 0) return

  // toleranceEngine uses seconds-of-arc with factor × √n
  // Cadastral: 60"×√n, Engineering: 30"×√n, Control: 10"×√n
  const factors: Record<ToleranceProfile, number> = {
    cadastral: 60,
    engineering: 30,
    control: 10,
  }
  const allowableSeconds = factors[profile] * Math.sqrt(stationCount)
  const actual = Math.abs(angularMisclosureSeconds)

  if (actual > allowableSeconds) {
    violations.push({
      rule: 'cap299.angular_misclosure',
      source: 'cap299',
      severity: 'block',
      message: `Angular misclosure ${actual.toFixed(1)}" exceeds the allowable ±${allowableSeconds.toFixed(1)}" for ${stationCount} stations (${profile} profile). Re-observe angles before submission.`,
      actual,
      allowable: allowableSeconds,
      unit: 'arc-seconds',
      field: 'traverse.angularMisclosureSeconds',
    })
  }
}

/**
 * Rule: Linear misclosure within RDM 1.1 tolerance.
 * Source: RDM 1.1 Table 5.1 (10√K mm cadastral, 8√K mm engineering, 4√K mm control).
 */
function ruleLinearMisclosure(
  input: StatutoryGateInput,
  profile: ToleranceProfile,
  violations: Violation[]
): void {
  if (!input.traverse) return
  const { linearErrorM, totalDistanceM } = input.traverse
  if (totalDistanceM <= 0) return

  const mmPerKmFactors: Record<ToleranceProfile, number> = {
    cadastral: 10,
    engineering: 8,
    control: 4,
  }
  const allowableMm = mmPerKmFactors[profile] * Math.sqrt(totalDistanceM / 1000)
  const actualMm = Math.abs(linearErrorM) * 1000

  if (actualMm > allowableMm) {
    violations.push({
      rule: 'rdm_1_1.linear_misclosure',
      source: 'rdm_1_1',
      severity: 'block',
      message: `Linear misclosure ${actualMm.toFixed(1)} mm exceeds the allowable ${allowableMm.toFixed(1)} mm (${mmPerKmFactors[profile]}√K mm per RDM 1.1 Table 5.1, ${profile} profile).`,
      actual: actualMm,
      allowable: allowableMm,
      unit: 'mm',
      field: 'traverse.linearErrorM',
    })
  }
}

/**
 * Rule: Leveling arithmetic check (ΣBS − ΣFS = Last RL − First RL).
 * Source: Survey Regulations 1994 §12; standard surveying practice.
 */
function ruleLevelingArithmetic(
  input: StatutoryGateInput,
  _profile: ToleranceProfile,
  violations: Violation[]
): void {
  if (!input.leveling) return
  const { sumBS, sumFS, firstRL, lastRL } = input.leveling
  const expected = lastRL - firstRL
  const actual = sumBS - sumFS
  const diff = Math.abs(actual - expected)

  // 1 mm tolerance for arithmetic check (rounding in field notes)
  if (diff > 0.001) {
    violations.push({
      rule: 'survey_regs_1994.leveling_arithmetic',
      source: 'survey_regs_1994',
      severity: 'block',
      message: `Leveling arithmetic check failed: (ΣBS − ΣFS) = ${actual.toFixed(4)} m but (Last RL − First RL) = ${expected.toFixed(4)} m. Difference ${diff.toFixed(4)} m indicates a booking or reduction error.`,
      actual,
      allowable: expected,
      unit: 'm',
      field: 'leveling.sumBS',
    })
  }
}

/**
 * Rule: Leveling closure within RDM 1.1 tolerance.
 * Source: RDM 1.1 Table 5.1 — 10√K mm ordinary, 5√K mm precise.
 */
function ruleLevelingClosure(
  input: StatutoryGateInput,
  _profile: ToleranceProfile,
  violations: Violation[]
): void {
  if (!input.leveling) return
  const { sumBS, sumFS, firstRL, lastRL, distanceKm, type } = input.leveling
  if (distanceKm <= 0) return

  const result = validateLevelingClosure(sumBS, sumFS, firstRL, lastRL, distanceKm, type)
  if (!result.passed) {
    if (!result.arithmeticCheck) {
      // Already reported by ruleLevelingArithmetic — don't double-report
      return
    }
    const closingErrorMm = Math.abs(result.closingError) * 1000
    const allowableMm = result.allowableMisclosure * 1000
    violations.push({
      rule: 'rdm_1_1.leveling_closure',
      source: 'rdm_1_1',
      severity: 'block',
      message: `Leveling closure ${closingErrorMm.toFixed(1)} mm exceeds the allowable ${allowableMm.toFixed(1)} mm (${type === 'precise' ? '5' : '10'}√K mm per RDM 1.1 Table 5.1).`,
      actual: closingErrorMm,
      allowable: allowableMm,
      unit: 'mm',
      field: 'leveling.closingError',
    })
  }
}

/**
 * Rule: Parcel has at least 3 vertices.
 * Source: ArdhiSasa spec §3.2 — minimum polygon geometry.
 */
function ruleParcelVertexCount(
  input: StatutoryGateInput,
  _profile: ToleranceProfile,
  violations: Violation[]
): void {
  if (!input.parcels) return
  for (let i = 0; i < input.parcels.length; i++) {
    const parcel = input.parcels[i]
    if (parcel.vertices.length < 3) {
      violations.push({
        rule: 'ardhisasa.parcel_min_vertices',
        source: 'ardhisasa',
        severity: 'block',
        message: `Parcel "${parcel.parcelNumber || `#${i + 1}`}" has only ${parcel.vertices.length} vertices. Minimum 3 required for a valid polygon.`,
        actual: parcel.vertices.length,
        allowable: 3,
        unit: 'vertices',
        field: `parcels[${i}].vertices`,
      })
    }
  }
}

/**
 * Rule: Area reconciliation for subdivisions and mutations.
 * Source: ArdhiSasa spec §4.1; LRA 2012 §26.
 *
 * Sum of resulting parcel areas must equal parent parcel area within
 * tolerance (default 0.001 ha = 10 m²).
 */
function ruleAreaReconciliation(
  input: StatutoryGateInput,
  _profile: ToleranceProfile,
  violations: Violation[]
): void {
  if (!input.parcels || !input.parentParcel) return
  if (
    input.submissionType !== 'subdivision' &&
    input.submissionType !== 'mutation'
  ) {
    return
  }

  const sumOfParts = input.parcels.reduce(
    (sum, p) => sum + shoelaceArea(p.vertices) / 10000,
    0
  )
  const parentArea = input.parentParcel.areaHectares
  const diff = Math.abs(parentArea - sumOfParts)
  const tolerance = input.areaToleranceHectares ?? 0.001

  if (diff > tolerance) {
    violations.push({
      rule: 'ardhisasa.area_reconciliation',
      source: 'ardhisasa',
      severity: 'block',
      message: `Area mismatch: parent ${parentArea.toFixed(4)} ha vs sum of parts ${sumOfParts.toFixed(4)} ha. Difference ${diff.toFixed(4)} ha exceeds tolerance ${tolerance} ha. ArdhiSasa will reject this submission.`,
      actual: diff,
      allowable: tolerance,
      unit: 'ha',
      field: 'parentParcel.areaHectares',
    })
  }
}

/**
 * Rule: Surveyor license format.
 * Source: ISK/EKB licensing standard.
 *
 * Format: ISK/LS/YYYY/NNN. Warn-only — older surveyors may have legacy
 * formats that ArdhiSasa still accepts.
 */
function ruleSurveyorLicense(
  input: StatutoryGateInput,
  _profile: ToleranceProfile,
  violations: Violation[]
): void {
  const { name, licenseNumber } = input.surveyor
  if (!name?.trim()) {
    violations.push({
      rule: 'sok_standard.surveyor_name_required',
      source: 'sok_standard',
      severity: 'block',
      message: 'Surveyor name is required for statutory submission.',
      field: 'surveyor.name',
    })
  }
  if (!licenseNumber?.trim()) {
    violations.push({
      rule: 'sok_standard.surveyor_license_required',
      source: 'sok_standard',
      severity: 'block',
      message: 'Surveyor license number is required for statutory submission.',
      field: 'surveyor.licenseNumber',
    })
    return
  }
  if (!/^ISK\/LS\/\d{4}\/\d{3,4}$/i.test(licenseNumber)) {
    violations.push({
      rule: 'sok_standard.surveyor_license_format',
      source: 'sok_standard',
      severity: 'warn',
      message: `License number "${licenseNumber}" does not match the ISK/LS/YYYY/NNN format. Submission may still be accepted but verify with ISK.`,
      field: 'surveyor.licenseNumber',
    })
  }
}

/**
 * Rule: Beacon nomenclature per SoK standards.
 * Source: Survey of Kenya beacon naming convention.
 *
 * Patterns: KP/XX/YY, MB/XXX, IRP/XXX, RMB/XXX.
 * Warn-only — non-standard names are accepted but flagged.
 */
function ruleBeaconNomenclature(
  input: StatutoryGateInput,
  _profile: ToleranceProfile,
  violations: Violation[]
): void {
  if (!input.parcels) return
  const pattern = /^(KP|MB|IRP|RMB)\/?\d+\/?\d+$/i
  for (let i = 0; i < input.parcels.length; i++) {
    const parcel = input.parcels[i]
    // Inspect vertex names as potential beacon IDs
    for (let j = 0; j < parcel.vertices.length; j++) {
      const v = parcel.vertices[j]
      if (v.name && !pattern.test(v.name)) {
        violations.push({
          rule: 'sok_standard.beacon_nomenclature',
          source: 'sok_standard',
          severity: 'warn',
          message: `Beacon "${v.name}" in parcel "${parcel.parcelNumber || `#${i + 1}`}" does not match SoK nomenclature (KP/MB/IRP/RMB patterns).`,
          field: `parcels[${i}].vertices[${j}].name`,
        })
        // One warning per parcel is enough; don't spam
        break
      }
    }
  }
}

/**
 * Rule: Minimum traverse station count for cadastral.
 * Source: Cap 299 §17 — a cadastral parcel requires a closed traverse
 * with at least 3 stations.
 */
function ruleMinStationCount(
  input: StatutoryGateInput,
  _profile: ToleranceProfile,
  violations: Violation[]
): void {
  if (input.surveyType !== 'cadastral') return
  if (!input.traverse) return
  if (input.traverse.stationCount < 3) {
    violations.push({
      rule: 'cap299.min_stations',
      source: 'cap299',
      severity: 'block',
      message: `Cadastral survey requires at least 3 traverse stations. Currently ${input.traverse.stationCount}.`,
      actual: input.traverse.stationCount,
      allowable: 3,
      unit: 'stations',
      field: 'traverse.stationCount',
    })
  }
}

// ─── Engineering design rules (KeNHA / KeRRA / RDM 1.1 §2.3) ───────────

/**
 * Rule: Horizontal curve radius meets minimum for design speed.
 * Source: RDM 1.1 §2.3.2; AASHTO Green Book; KeNHA Road Design Manual.
 *
 * R_min = V² / (127 × (e + f))
 *   V = design speed km/h
 *   e = superelevation (default 0.07)
 *   f = side friction (default 0.15)
 *
 * Fires only when input.engineering.horizontalCurveRadiusM is provided.
 */
function ruleMinHorizontalCurveRadius(
  input: StatutoryGateInput,
  _profile: ToleranceProfile,
  violations: Violation[]
): void {
  if (!input.engineering) return
  const { designSpeedKph, horizontalCurveRadiusM, superelevation, sideFriction } = input.engineering
  if (horizontalCurveRadiusM === undefined || designSpeedKph <= 0) return

  const e = superelevation ?? 0.07
  const f = sideFriction ?? 0.15
  const minR = minimumRadius(designSpeedKph, e, f)

  if (horizontalCurveRadiusM < minR) {
    violations.push({
      rule: 'rdm_1_1.min_curve_radius',
      source: 'rdm_1_1',
      severity: 'block',
      message: `Horizontal curve radius ${horizontalCurveRadiusM.toFixed(1)} m is below the minimum ${minR.toFixed(1)} m for design speed ${designSpeedKph} km/h (e=${(e * 100).toFixed(0)}%, f=${f}). Per RDM 1.1 §2.3.2 — vehicles cannot safely negotiate this curve at design speed.`,
      actual: horizontalCurveRadiusM,
      allowable: minR,
      unit: 'm',
      field: 'engineering.horizontalCurveRadiusM',
    })
  }
}

/**
 * Rule: Available sight distance meets stopping sight distance (SSD).
 * Source: RDM 1.1 §2.3.3; AASHTO Green Book; KeNHA Road Design Manual.
 *
 * SSD = 0.278 × V × T + V² / (254 × (f + G))
 *   T = 2.5s perception-reaction
 *   f = 0.35 friction
 *   G = grade percent
 *
 * Fires only when input.engineering.availableSightDistanceM is provided.
 */
function ruleStoppingSightDistance(
  input: StatutoryGateInput,
  _profile: ToleranceProfile,
  violations: Violation[]
): void {
  if (!input.engineering) return
  const { designSpeedKph, availableSightDistanceM, gradePercent } = input.engineering
  if (availableSightDistanceM === undefined || designSpeedKph <= 0) return

  const grade = gradePercent ?? 0
  const requiredSSD = stoppingSightDistance(designSpeedKph, grade)

  if (availableSightDistanceM < requiredSSD) {
    violations.push({
      rule: 'rdm_1_1.sight_distance',
      source: 'rdm_1_1',
      severity: 'block',
      message: `Available sight distance ${availableSightDistanceM.toFixed(1)} m is below the required stopping sight distance ${requiredSSD.toFixed(1)} m for design speed ${designSpeedKph} km/h${grade !== 0 ? ` at ${grade}% grade` : ''}. Per RDM 1.1 §2.3.3 — unsafe stopping distance.`,
      actual: availableSightDistanceM,
      allowable: requiredSSD,
      unit: 'm',
      field: 'engineering.availableSightDistanceM',
    })
  }
}

/**
 * Rule: Superelevation rate within Kenyan maximum.
 * Source: KeNHA Road Design Manual §3.4; AASHTO Green Book.
 *
 * Maximum superelevation:
 *   - 7% for rural highways (default)
 *   - 4% for urban areas (lower due to slow traffic and turning vehicles)
 *   - 10% absolute maximum (rare, only on private toll roads)
 *
 * Fires only when input.engineering.superelevation is provided.
 * Warns above 7%, blocks above 10%.
 */
function ruleSuperelevationRate(
  input: StatutoryGateInput,
  _profile: ToleranceProfile,
  violations: Violation[]
): void {
  if (!input.engineering) return
  const { superelevation } = input.engineering
  if (superelevation === undefined) return

  const ePercent = superelevation * 100
  const MAX_NORMAL = 7 // 7% rural
  const MAX_ABSOLUTE = 10 // 10% hard cap

  if (ePercent > MAX_ABSOLUTE) {
    violations.push({
      rule: 'kenha.superelevation_absolute_max',
      source: 'ardhisasa', // reuse source enum — KeNHA isn't separately enumerated
      severity: 'block',
      message: `Superelevation ${(ePercent).toFixed(1)}% exceeds the absolute maximum ${MAX_ABSOLUTE}% per KeNHA Road Design Manual §3.4. Vehicles may slide sideways on wet pavement.`,
      actual: ePercent,
      allowable: MAX_ABSOLUTE,
      unit: '%',
      field: 'engineering.superelevation',
    })
  } else if (ePercent > MAX_NORMAL) {
    violations.push({
      rule: 'kenha.superelevation_high',
      source: 'ardhisasa',
      severity: 'warn',
      message: `Superelevation ${(ePercent).toFixed(1)}% exceeds the normal maximum ${MAX_NORMAL}% for rural highways. Acceptable only with explicit KeNHA approval.`,
      actual: ePercent,
      allowable: MAX_NORMAL,
      unit: '%',
      field: 'engineering.superelevation',
    })
  }
}

// ─── RIM overlap rule (ArdhiSasa pre-flight) ────────────────────────────

/**
 * Rule: New parcel must not overlap existing RIM parcels.
 * Source: ArdhiSasa portal submission spec §4.2 — overlapping parcels
 * are rejected on first submission.
 *
 * The overlap detection itself is async (turf geometry), so it's
 * pre-computed by the loader and passed in via input.rimOverlaps.
 * This rule just checks the results and emits violations.
 */
function ruleRimOverlap(
  input: StatutoryGateInput,
  _profile: ToleranceProfile,
  violations: Violation[]
): void {
  if (!input.rimOverlaps || input.rimOverlaps.length === 0) return

  for (const overlap of input.rimOverlaps) {
    violations.push({
      rule: 'ardhisasa.rim_overlap',
      source: 'ardhisasa',
      severity: 'block',
      message: `New parcel overlaps existing parcel "${overlap.existingParcelNumber}" by ${overlap.overlapAreaSqm.toFixed(1)} m² (${overlap.overlapPercent.toFixed(2)}% of the new parcel). ArdhiSasa will reject this submission — resolve the boundary conflict first.`,
      actual: overlap.overlapAreaSqm,
      allowable: 0,
      unit: 'm²',
      field: 'parcels',
    })
  }
}

// ─── Rule registry ─────────────────────────────────────────────────────

interface RuleDef {
  id: string
  description: string
  source: RegulatorySource
  severity: Severity
  run: (input: StatutoryGateInput, profile: ToleranceProfile, violations: Violation[]) => void
}

const RULES: RuleDef[] = [
  {
    id: 'cap299.min_stations',
    description: 'Cadastral survey requires ≥3 traverse stations',
    source: 'cap299',
    severity: 'block',
    run: ruleMinStationCount,
  },
  {
    id: 'cap299.angular_misclosure',
    description: 'Angular misclosure within ±√n × profile factor',
    source: 'cap299',
    severity: 'block',
    run: ruleAngularMisclosure,
  },
  {
    id: 'rdm_1_1.traverse_precision',
    description: 'Traverse precision ratio meets profile minimum',
    source: 'rdm_1_1',
    severity: 'block',
    run: ruleTraversePrecision,
  },
  {
    id: 'rdm_1_1.linear_misclosure',
    description: 'Linear misclosure within RDM 1.1 tolerance',
    source: 'rdm_1_1',
    severity: 'block',
    run: ruleLinearMisclosure,
  },
  {
    id: 'survey_regs_1994.leveling_arithmetic',
    description: 'Leveling arithmetic check (ΣBS−ΣFS = Last RL−First RL)',
    source: 'survey_regs_1994',
    severity: 'block',
    run: ruleLevelingArithmetic,
  },
  {
    id: 'rdm_1_1.leveling_closure',
    description: 'Leveling closure within RDM 1.1 tolerance',
    source: 'rdm_1_1',
    severity: 'block',
    run: ruleLevelingClosure,
  },
  {
    id: 'ardhisasa.parcel_min_vertices',
    description: 'Parcel has ≥3 vertices for valid polygon',
    source: 'ardhisasa',
    severity: 'block',
    run: ruleParcelVertexCount,
  },
  {
    id: 'ardhisasa.area_reconciliation',
    description: 'Subdivision: sum of parts equals parent area within tolerance',
    source: 'ardhisasa',
    severity: 'block',
    run: ruleAreaReconciliation,
  },
  {
    id: 'sok_standard.surveyor_license',
    description: 'Surveyor name and license number present, format valid',
    source: 'sok_standard',
    severity: 'block',
    run: ruleSurveyorLicense,
  },
  {
    id: 'sok_standard.beacon_nomenclature',
    description: 'Beacon names match SoK patterns (KP/MB/IRP/RMB)',
    source: 'sok_standard',
    severity: 'warn',
    run: ruleBeaconNomenclature,
  },
  {
    id: 'rdm_1_1.min_curve_radius',
    description: 'Horizontal curve radius ≥ R_min for design speed (RDM 1.1 §2.3.2)',
    source: 'rdm_1_1',
    severity: 'block',
    run: ruleMinHorizontalCurveRadius,
  },
  {
    id: 'rdm_1_1.sight_distance',
    description: 'Available sight distance ≥ stopping sight distance (RDM 1.1 §2.3.3)',
    source: 'rdm_1_1',
    severity: 'block',
    run: ruleStoppingSightDistance,
  },
  {
    id: 'kenha.superelevation_rate',
    description: 'Superelevation within KeNHA max (7% normal, 10% absolute)',
    source: 'ardhisasa',
    severity: 'warn',
    run: ruleSuperelevationRate,
  },
  {
    id: 'ardhisasa.rim_overlap',
    description: 'New parcel must not overlap existing RIM parcels',
    source: 'ardhisasa',
    severity: 'block',
    run: ruleRimOverlap,
  },
]

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Run all statutory validation rules against the input.
 *
 * Returns a result with `passed: true` iff zero 'block' violations.
 * Callers should refuse to produce the export when `passed === false`
 * and surface the violations to the surveyor.
 *
 * The function is pure — no DB calls, no side effects. Callers are
 * responsible for assembling the input from project data.
 */
export function runStatutoryGate(input: StatutoryGateInput): StatutoryGateResult {
  const profile = selectProfile(input)
  const violations: Violation[] = []

  for (const rule of RULES) {
    try {
      rule.run(input, profile, violations)
    } catch (err) {
      // A rule throwing should never block the export silently —
      // record it as a warning so the surveyor knows the gate
      // didn't fully evaluate.
      violations.push({
        rule: rule.id,
        source: rule.source,
        severity: 'warn',
        message: `Internal error evaluating rule "${rule.id}": ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  // ── AUDIT FIX (2026-07-05): Run calculation cross-checks ──
  // Independent verification that catches computation errors the
  // rule-based checks above might miss (e.g., a precision ratio that
  // doesn't match the reported misclosure and distance).
  try {
    if (input.traverse) {
      const t = input.traverse

      // Cross-check: precision ratio should equal totalDistance / linearError
      // If these don't agree, the precision was computed incorrectly.
      if (t.totalDistanceM > 0 && t.linearErrorM > 0) {
        const computedRatio = Math.round(t.totalDistanceM / t.linearErrorM)
        if (Math.abs(computedRatio - t.precisionRatio) > 1) {
          violations.push({
            rule: 'cross_check.precision_ratio_consistency',
            source: 'metardu_qc',
            severity: 'warn',
            message: `Precision ratio cross-check: reported 1:${t.precisionRatio} vs computed 1:${computedRatio} (distance=${t.totalDistanceM.toFixed(1)}m / misclosure=${t.linearErrorM.toFixed(3)}m). Values disagree — check the precision calculation.`,
          })
        }
      }

      // Cross-check: if linearErrorM is 0 but angularMisclosure is non-zero
      // (or vice versa), something is wrong
      if (t.linearErrorM === 0 && t.angularMisclosureSeconds && Math.abs(t.angularMisclosureSeconds) > 1) {
        violations.push({
          rule: 'cross_check.zero_linear_misclosure',
          source: 'metardu_qc',
          severity: 'warn',
          message: `Linear misclosure is 0 but angular misclosure is ${t.angularMisclosureSeconds.toFixed(1)}". This is suspicious — a traverse with angular error should also have linear error. Check if the traverse was properly closed.`,
        })
      }
    }
  } catch {
    // Cross-check module not available — non-blocking
  }

  // Order violations by severity: block → warn → info
  const order: Record<Severity, number> = { block: 0, warn: 1, info: 2 }
  violations.sort((a, b) => order[a.severity] - order[b.severity])

  const summary = {
    block: violations.filter((v) => v.severity === 'block').length,
    warn: violations.filter((v) => v.severity === 'warn').length,
    info: violations.filter((v) => v.severity === 'info').length,
    total: violations.length,
  }

  return {
    passed: summary.block === 0,
    violations,
    profile,
    evaluatedAt: new Date().toISOString(),
    ruleVersion: RULE_VERSION,
    summary,
  }
}

/**
 * Format a gate result as a human-readable string for display in the UI
 * or inclusion in a validation report.
 */
export function formatGateResult(result: StatutoryGateResult): string {
  const lines: string[] = []
  const status = result.passed ? 'PASS' : 'BLOCKED'
  lines.push(`Statutory Validation: ${status}`)
  lines.push(`Profile: ${result.profile}`)
  lines.push(`Rule version: ${result.ruleVersion}`)
  lines.push(`Evaluated: ${result.evaluatedAt}`)
  lines.push(
    `Summary: ${result.summary.block} block, ${result.summary.warn} warn, ${result.summary.info} info`
  )
  lines.push('')

  if (result.violations.length === 0) {
    lines.push('All checks passed. No violations.')
    return lines.join('\n')
  }

  const labels: Record<Severity, string> = {
    block: 'BLOCK',
    warn: 'WARN',
    info: 'INFO',
  }
  for (const v of result.violations) {
    lines.push(`[${labels[v.severity]}] ${v.rule} (${v.source})`)
    lines.push(`  ${v.message}`)
    if (v.actual !== undefined && v.allowable !== undefined) {
      lines.push(`  Actual: ${v.actual} ${v.unit ?? ''} | Allowable: ${v.allowable} ${v.unit ?? ''}`)
    }
    if (v.field) {
      lines.push(`  Field: ${v.field}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * List all registered rules. Useful for building UI that shows the
 * surveyor exactly which checks will be run before they submit.
 */
export function listRules(): ReadonlyArray<{
  id: string
  description: string
  source: RegulatorySource
  severity: Severity
}> {
  return RULES.map(({ id, description, source, severity }) => ({
    id,
    description,
    source,
    severity,
  }))
}

// ─── Backwards-compat: re-export existing validators ────────────────────
// These are still useful for callers that want to run a single check
// in isolation (e.g. live form validation in the field book UI).

export { checkTolerance, type ToleranceCheckResult }
export { validateTraverse }
export { validateLevelingClosure }
