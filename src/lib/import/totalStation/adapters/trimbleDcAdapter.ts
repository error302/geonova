import { parseTrimbleDC } from '../parseTrimbleDC'
import { UnifiedImportResult } from '../unifiedTypes'

export function adaptTrimbleDC(content: string): UnifiedImportResult {
  const parsed = parseTrimbleDC(content)

  return {
    format: 'trimble_dc',
    instrument: 'Trimble DC',
    stationName: parsed.stationSetups[0]?.stationId || '',
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
