/**
 * Unified Total Station Import — Single Entry Point
 *
 * Usage:
 *   import { importTotalStation } from '@/lib/import/totalStation/unifiedImport'
 *
 *   const result = importTotalStation(fileContent, 'traverse.dat')
 *   // result.format, result.observations, result.rawPoints, etc.
 *
 * Pipeline:  detectFormat → parse → adapt → UnifiedImportResult
 */

import { detectTotalStationFormat } from './detectFormat'
import { adaptGSI } from './adapters/gsiAdapter'
import { adaptSDR } from './adapters/sdrAdapter'
import { adaptSouth } from './adapters/southAdapter'
import { adaptTopcon } from './adapters/topconAdapter'
import { adaptJobXML } from './adapters/jobXmlAdapter'
import {
  UnifiedImportResult,
  UnifiedRawPoint,
} from './unifiedTypes'

/**
 * Import a total station data file of any supported format.
 *
 * @param content  - Raw file content as a string
 * @param filename - File name (used for extension-based format detection)
 * @returns UnifiedImportResult with observations, raw points, and diagnostics
 */
export function importTotalStation(
  content: string,
  filename: string = 'unknown.dat'
): UnifiedImportResult {
  const format = detectTotalStationFormat(content, filename)

  switch (format) {
    case 'gsi':
      return adaptGSI(content)

    case 'sokkia':
      return adaptSDR(content)

    case 'south':
      return adaptSouth(content)

    case 'topcon':
      return adaptTopcon(content)

    case 'jobxml':
      return adaptJobXML(content)

    default:
      return unknownFormatFallback(content, filename)
  }
}

/**
 * Fallback for unrecognised formats.
 *
 * Attempts a simple CSV-like coordinate parse so that even
 * completely unknown formats don't return a hard error if they
 * happen to be comma-delimited coordinate files.
 */
function unknownFormatFallback(
  content: string,
  filename: string
): UnifiedImportResult {
  const errors: string[] = [
    'Unrecognised total station format for file "' + filename + '"',
  ]
  const warnings: string[] = []
  const rawPoints: UnifiedRawPoint[] = []

  // Attempt CSV coordinate extraction as a last resort
  const lines = content.trim().split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const parts = line.split(',')
    if (parts.length >= 4) {
      const id = parts[0] ? parts[0].trim() : ''
      const n = parseFloat(parts[1])
      const e = parseFloat(parts[2])
      const el = parseFloat(parts[3])
      if (id && !isNaN(n) && !isNaN(e)) {
        rawPoints.push({
          id: id,
          easting: e,
          northing: n,
          elevation: isNaN(el) ? 0 : el,
          code: parts[4] ? parts[4].trim() : '',
        })
      }
    }
  }

  if (rawPoints.length > 0) {
    warnings.push(
      'Format was "unknown" but ' +
        rawPoints.length +
        ' coordinate rows were extracted by CSV fallback'
    )
  }

  return {
    format: 'unknown',
    instrument: 'Unknown',
    stationName: rawPoints.length > 0 ? rawPoints[0].id : '',
    stationCoords: rawPoints.length > 0
      ? {
          easting: rawPoints[0].easting,
          northing: rawPoints[0].northing,
          elevation: rawPoints[0].elevation,
        }
      : undefined,
    observations: [],
    meanedObservations: [],
    rawPoints: rawPoints,
    errors: errors,
    warnings: warnings,
  }
}

// Re-export types for convenience
export type {
  UnifiedObservation,
  UnifiedRawPoint,
  UnifiedImportResult,
} from './unifiedTypes'
