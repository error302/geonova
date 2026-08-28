import { parseLandXML } from '../parseLandXML'
import { UnifiedImportResult } from '../unifiedTypes'

export function adaptLandXML(content: string): UnifiedImportResult {
  const parsed = parseLandXML(content)

  return {
    format: 'landxml',
    instrument: 'LandXML Universal',
    stationName: '',
    observations: [],
    meanedObservations: [],
    rawPoints: parsed.records.map((r) => ({
      id: r.pointId,
      northing: r.northing,
      easting: r.easting,
      elevation: r.elevation,
      code: r.code || '',
    })),
    warnings: parsed.warnings,
    errors: [],
  }
}
