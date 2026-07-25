/**
 * RIM Overlap Detection
 * =====================
 *
 * Detects boundary overlaps between a new survey parcel and existing
 * parcels on the same Registry Index Map (RIM) sheet. ArdhiSasa
 * rejects overlapping parcels; catching this in-office saves a
 * rejection cycle.
 *
 * How it works
 * ------------
 * Given a new parcel's vertices and a list of existing parcels (from
 * the RIM database, filtered by map sheet), compute the geometric
 * intersection of the new parcel with each existing one. If any
 * intersection has non-zero area, it's an overlap.
 *
 * The actual geometry uses turf's intersect() via turfHelpers.ts.
 * This module wraps it with survey-specific logic:
 *   - Filter by map sheet (parcels on different sheets can't overlap)
 *   - Report overlap area + percentage of the new parcel
 *   - Threshold: any overlap > 0.01 m² is flagged (sub-centimeter
 *     overlaps are numerical noise, not real conflicts)
 *
 * Integration
 * -----------
 * - Statutory gate: a new rule 'ardhisasa.rim_overlap' blocks
 *   submission if any overlap is detected
 * - UI: a pre-submission check button on the submission page calls
 *   /api/rim/overlap-check to show overlaps before export
 *
 * Usage
 * -----
 *   import { detectOverlaps } from '@/lib/rim/overlapDetection'
 *
 *   const result = await detectOverlaps({
 *     newParcel: { parcelNumber: 'LR 123/456', vertices: [...] },
 *     existingParcels: [
 *       { parcelNumber: 'LR 123/455', vertices: [...] },
 *       { parcelNumber: 'LR 123/457', vertices: [...] },
 *     ],
 *   })
 *
 *   if (result.hasOverlaps) {
 *     for (const overlap of result.overlaps) {
 *       console.warn(`${overlap.existingParcelNumber}: ${overlap.overlapAreaSqm.toFixed(1)} m²`)
 *     }
 *   }
 */

import { calculateIntersection } from '@/lib/map/turfHelpers'
import { shoelaceArea } from '@/lib/engine/area'

// ─── Types ──────────────────────────────────────────────────────────────

/** A parcel with boundary vertices in projected CRS (EPSG:21037). */
export interface ParcelForOverlap {
  parcelNumber: string
  /** Boundary vertices — minimum 3 for a valid polygon. */
  vertices: Array<{ easting: number; northing: number; name?: string }>
}

/** A single overlap between the new parcel and an existing one. */
export interface OverlapResult {
  /** Parcel number of the existing parcel that overlaps. */
  existingParcelNumber: string
  /** Vertices of the overlap polygon (the intersection area). */
  overlapVertices: Array<{ easting: number; northing: number }>
  /** Overlap area in square metres. */
  overlapAreaSqm: number
  /** Overlap area as a percentage of the new parcel's total area. */
  overlapPercent: number
}

/** Result of an overlap detection check. */
export interface OverlapDetectionResult {
  /** True if any overlap was found. */
  hasOverlaps: boolean
  /** List of all overlaps found (empty if none). */
  overlaps: OverlapResult[]
  /** The new parcel's area in m², for context. */
  newParcelAreaSqm: number
  /** Total time spent on the check, in milliseconds. */
  elapsedMs: number
  /** Number of existing parcels checked. */
  checkedCount: number
  /** Number of existing parcels skipped (invalid geometry). */
  skippedCount: number
}

// ─── Thresholds ─────────────────────────────────────────────────────────

/**
 * Overlap areas below this threshold are treated as numerical noise
 * and ignored. 0.01 m² = 100 cm² — sub-centimeter slivers from
 * coordinate rounding, not real boundary conflicts.
 */
const MIN_OVERLAP_AREA_SQM = 0.01

// shoelaceArea is imported from @/lib/engine/area (canonical implementation)

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Detect overlaps between a new parcel and a list of existing parcels.
 *
 * This is the core detection function. It's async because turf's
 * intersect() is loaded lazily (heavy dependency).
 *
 * @param newParcel - The parcel being submitted (new survey)
 * @param existingParcels - Existing parcels on the same RIM sheet
 * @returns Overlap detection result
 */
export async function detectOverlaps(params: {
  newParcel: ParcelForOverlap
  existingParcels: ParcelForOverlap[]
}): Promise<OverlapDetectionResult> {
  const startTime = Date.now()
  const { newParcel, existingParcels } = params

  const newParcelAreaSqm = shoelaceArea(newParcel.vertices)
  const overlaps: OverlapResult[] = []
  let skippedCount = 0

  for (const existing of existingParcels) {
    // Skip parcels with invalid geometry
    if (existing.vertices.length < 3) {
      skippedCount++
      continue
    }

    try {
      const intersection = await calculateIntersection(
        newParcel.vertices as any,
        existing.vertices as any
      )

      if (!intersection || intersection.length < 3) {
        continue
      }

      const overlapAreaSqm = shoelaceArea(intersection)

      // Ignore sub-threshold overlaps (numerical noise)
      if (overlapAreaSqm < MIN_OVERLAP_AREA_SQM) {
        continue
      }

      const overlapPercent = newParcelAreaSqm > 0
        ? (overlapAreaSqm / newParcelAreaSqm) * 100
        : 0

      overlaps.push({
        existingParcelNumber: existing.parcelNumber,
        overlapVertices: intersection,
        overlapAreaSqm,
        overlapPercent,
      })
    } catch (err) {
      // Turf can throw on degenerate polygons. Skip and continue.
      skippedCount++
      console.warn(
        `[overlapDetection] Failed to check against ${existing.parcelNumber}:`,
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  // Sort overlaps by area descending — biggest conflicts first
  overlaps.sort((a, b) => b.overlapAreaSqm - a.overlapAreaSqm)

  return {
    hasOverlaps: overlaps.length > 0,
    overlaps,
    newParcelAreaSqm,
    elapsedMs: Date.now() - startTime,
    checkedCount: existingParcels.length,
    skippedCount,
  }
}

/**
 * Quick boolean check: does the new parcel overlap ANY existing parcel?
 *
 * Faster than detectOverlaps() because it returns as soon as the first
 * overlap is found, without computing all overlaps. Use this for
 * real-time validation (e.g. as the surveyor draws the boundary).
 */
export async function hasAnyOverlap(params: {
  newParcel: ParcelForOverlap
  existingParcels: ParcelForOverlap[]
}): Promise<boolean> {
  const { newParcel, existingParcels } = params

  for (const existing of existingParcels) {
    if (existing.vertices.length < 3) continue

    try {
      const intersection = await calculateIntersection(
        newParcel.vertices as any,
        existing.vertices as any
      )
      if (intersection && intersection.length >= 3) {
        const area = shoelaceArea(intersection)
        if (area >= MIN_OVERLAP_AREA_SQM) {
          return true // early exit
        }
      }
    } catch {
      // skip
    }
  }

  return false
}

/**
 * Format an overlap detection result as a human-readable summary.
 * Useful for display in the UI or inclusion in a validation report.
 */
export function formatOverlapResult(result: OverlapDetectionResult): string {
  if (!result.hasOverlaps) {
    return `No overlaps detected. Checked ${result.checkedCount} existing parcel(s) in ${result.elapsedMs}ms.`
  }

  const lines: string[] = [
    `Found ${result.overlaps.length} overlap(s) in ${result.elapsedMs}ms:`,
    '',
  ]

  for (const overlap of result.overlaps) {
    lines.push(
      `  ${overlap.existingParcelNumber}: ${overlap.overlapAreaSqm.toFixed(1)} m² (${overlap.overlapPercent.toFixed(2)}% of new parcel)`
    )
  }

  return lines.join('\n')
}
