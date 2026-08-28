import { parseCarlsonRW5 } from '../parseCarlsonRW5'
import { UnifiedImportResult } from '../unifiedTypes'

export function adaptCarlsonRW5(content: string): UnifiedImportResult {
  const parsed = parseCarlsonRW5(content)

  return {
    format: 'carlson_rw5',
    instrument: 'Carlson SurvCE / FieldGenius',
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
