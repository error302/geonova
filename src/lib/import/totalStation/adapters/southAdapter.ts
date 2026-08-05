/**
 * South / Nikon Adapter
 *
 * The South parser produces both coordinate points and SS observation
 * records with DMS angles, slope distance, and instrument/target heights.
 *
 * This adapter:
 *  - Maps SouthCoordinatePoint[] → UnifiedRawPoint[]
 *  - Maps SouthObservation[]   → UnifiedObservation[] (with DMS→decimal conversion)
 *  - For observations with only FL measurements, meanedObservations
 *    mirrors the raw observations (no FR face to average with).
 */

import { parseSouthData } from '../parseSouth'
import {
  UnifiedObservation,
  UnifiedRawPoint,
  UnifiedImportResult,
} from '../unifiedTypes'

/**
 * Convert DMS components (degrees, minutes, seconds) to decimal degrees.
 */
function dmsToDecimal(deg: number, min: number, sec: number): number {
  const sign = deg < 0 ? -1 : 1
  return sign * (Math.abs(deg) + min / 60 + sec / 3600)
}

/**
 * Adapt a South .dat/.dc file content string into the unified import result.
 */
export function adaptSouth(content: string): UnifiedImportResult {
  const parsed = parseSouthData(content)
  const warnings = [...parsed.warnings]
  const errors = [...parsed.errors]

  // ── Coordinate points ───────────────────────────────────────────────

  const rawPoints: UnifiedRawPoint[] = parsed.coordinates.map(function (pt) {
    return {
      id: String(pt.pointNumber),
      easting: pt.easting,
      northing: pt.northing,
      elevation: pt.elevation,
      code: pt.code,
    }
  })

  // ── Observations ────────────────────────────────────────────────────

  const observations: UnifiedObservation[] = parsed.observations.map(function (obs) {
    const hz = dmsToDecimal(obs.hclDeg, obs.hclMin, obs.hclSec)
    const va = dmsToDecimal(obs.vaDeg, obs.vaMin, obs.vaSec)

    return {
      stationId: obs.station,
      targetId: obs.target,
      face: 'F1',   // South SS records don't encode face
      horizontalAngle: hz,
      verticalAngle: va,
      slopeDistance: obs.slopeDistance,
      prismHeight: obs.targetHeight,
      instrumentHeight: obs.instrumentHeight,
    }
  })

  // ── Meaned observations ─────────────────────────────────────────────
  // South doesn't provide FL/FR pairs in the SS records we parse,
  // so we carry the raw observations forward as-is.

  const meanedObservations: UnifiedObservation[] = observations.map(function (obs) {
    return Object.assign({}, obs)
  })

  // ── Station name (first observation's station if available) ─────────

  let stationName = ''
  if (observations.length > 0) {
    stationName = observations[0].stationId
  } else if (rawPoints.length > 0) {
    stationName = rawPoints[0].id
  }

  // ── Station coordinates (look up station name in raw points) ────────

  let stationCoords: UnifiedImportResult['stationCoords'] = undefined
  if (stationName) {
    const match = rawPoints.find(function (p) { return p.id === stationName })
    if (match) {
      stationCoords = {
        easting: match.easting,
        northing: match.northing,
        elevation: match.elevation,
      }
    }
  }

  return {
    format: 'south',
    instrument: 'South',
    stationName: stationName,
    stationCoords: stationCoords,
    observations: observations,
    meanedObservations: meanedObservations,
    rawPoints: rawPoints,
    errors: errors,
    warnings: warnings,
  }
}
