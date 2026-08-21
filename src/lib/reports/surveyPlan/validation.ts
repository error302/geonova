import type { DeedPlanInput, ClosureCheck, DeedPlanValidationResult } from '@/types/deedPlan'

/**
 * Pre-render validation for deed plan data.
 *
 * Runs before rendering so a surveyor is not handed an SVG that is missing
 * statutory identifiers or has an unusable geometry. `errors` block the plan,
 * `warnings` and `missingFields` are surfaced but non-blocking.
 */

/** Fields expected on a submission-grade deed plan (Survey Act Cap. 299). */
const REQUIRED_FIELDS: Array<{ key: keyof DeedPlanInput; label: string }> = [
  { key: 'surveyNumber', label: 'Survey Number' },
  { key: 'parcelNumber', label: 'Parcel Number' },
  { key: 'locality', label: 'Locality' },
  { key: 'county', label: 'County' },
  { key: 'surveyorName', label: 'Surveyor Name' },
  { key: 'iskNumber', label: 'ISK Number' },
  { key: 'firmName', label: 'Firm Name' },
]

export function validateDeedPlanData(
  input: Partial<DeedPlanInput>,
  closureCheck?: ClosureCheck,
): DeedPlanValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const missingFields: string[] = []

  // ── Geometry ─────────────────────────────────────────────────────────────
  const pts = input.boundaryPoints || []
  if (pts.length < 3) {
    errors.push(`At least 3 boundary points are required (got ${pts.length}).`)
  } else {
    const bad = pts.filter(
      (p) => !Number.isFinite(p.easting) || !Number.isFinite(p.northing),
    )
    if (bad.length > 0) {
      errors.push(`Boundary points with invalid coordinates: ${bad.map((p) => p.id).join(', ')}.`)
    } else {
      // Zero-area or degenerate polygon (area collapses to ~0).
      let twice = 0
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]
        const b = pts[(i + 1) % pts.length]
        twice += a.easting * b.northing - b.easting * a.northing
      }
      if (Math.abs(twice / 2) < 1e-6) {
        errors.push('Boundary points form a degenerate polygon (zero area).')
      }
    }
  }

  // ── Required statutory fields ────────────────────────────────────────────
  for (const field of REQUIRED_FIELDS) {
    const value = input[field.key]
    if (typeof value !== 'string' || value.trim() === '') {
      missingFields.push(field.label)
      errors.push(`Missing required field: ${field.label}.`)
    }
  }

  // ── Area ─────────────────────────────────────────────────────────────────
  const area = input.area ?? 0
  if (!Number.isFinite(area) || area <= 0) {
    warnings.push('Area is zero or missing — the plan will be generated without a computed area.')
  }

  // ── Closure ──────────────────────────────────────────────────────────────
  if (closureCheck) {
    if (!closureCheck.passes) {
      warnings.push(
        `Closure check failed: precision ratio ${closureCheck.precisionRatio} is below the 1:5000 minimum.`,
      )
    }
  }

  return { valid: errors.length === 0, errors, warnings, missingFields }
}