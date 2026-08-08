import type { SurveyDataset, SurveyObservation } from '../workflows/workflowEngine'
import { detectSurveyType } from './surveyDetector'

export interface CSVInterpretResult {
  ok: boolean
  dataset?: SurveyDataset
  error?: string
  warnings: string[]
}

export function interpretCSV(csvText: string): CSVInterpretResult {
  const warnings: string[] = []
  
  try {
    const lines = csvText.trim().split('\n').filter((l) => l.trim())
    if (lines.length < 2) {
      return { ok: false, error: 'File must have headers and at least one row', warnings }
    }
    
    // Parse headers
    const headers = lines[0].split(',').map((h) => h.trim())
    
    // Parse rows
    const rows = lines.slice(1).map((line) => {
      const values = line.split(',')
      const row: Record<string, string> = {}
      headers.forEach((h, i) => {
        row[h] = (values[i] || '').trim()
      })
      return row
    })
    
    // Detect survey type
    const surveyType = detectSurveyType(headers, rows)
    
    if (surveyType === 'unknown') {
      warnings.push('Could not auto-detect survey type. Check column headers.')
    }
    
    // Build observations. For multi-measurement rows, value1/value2 must map to
    // the workflow engine's expectations rather than the first numeric cell.
    const observations = rows.map((row, i) => {
      const values = valuesForSurveyType(row, headers, surveyType)

      return {
        id: `obs_${i}`,
        station: pick(row, ['Station', 'station', 'Point', 'point', 'From', 'from']) || `P${i + 1}`,
        target: pick(row, ['Target', 'target', 'To', 'to']),
        type: mapRowToType(row, headers, surveyType),
        value1: values.value1,
        value2: values.value2,
        value3: values.value3,
      }
    })
    
    // Extract metadata
    const metadata: SurveyDataset['metadata'] = {}
    if (headers.includes('Station') || headers.includes('station')) {
      metadata.station = rows[0]?.['Station'] || rows[0]?.['station']
    }
    
    return {
      ok: true,
      dataset: { 
        surveyType, 
        observations,
        metadata 
      },
      warnings
    }
    
  } catch (err) {
    return { ok: false, error: 'Failed to parse CSV file', warnings }
  }
}

function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== '') return row[key]
  }
  return undefined
}

function readNumber(row: Record<string, string>, keys: string[], fallback = 0): number {
  const raw = pick(row, keys)
  if (raw === undefined) return fallback
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : fallback
}

function readOptionalNumber(row: Record<string, string>, keys: string[]): number | undefined {
  const raw = pick(row, keys)
  if (raw === undefined) return undefined
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : undefined
}

function valuesForSurveyType(
  row: Record<string, string>,
  headers: string[],
  surveyType: SurveyDataset['surveyType']
) {
  if (surveyType === 'traverse') {
    return {
      value1: readNumber(row, ['Bearing', 'bearing', 'WCB', 'wcb', 'Azimuth', 'azimuth']),
      value2: readNumber(row, ['Distance', 'distance', 'Length', 'length']),
    }
  }

  if (surveyType === 'radiation') {
    return {
      value1: readNumber(row, ['Bearing', 'bearing', 'Angle', 'angle', 'WCB', 'wcb', 'Azimuth', 'azimuth']),
      value2: readNumber(row, ['Distance', 'distance', 'Length', 'length']),
      value3: readOptionalNumber(row, ['VerticalAngle', 'verticalAngle', 'VA', 'va']),
    }
  }

  if (surveyType === 'leveling') {
    return {
      value1: readNumber(row, ['BS', 'bs', 'IS', 'is', 'FS', 'fs']),
    }
  }

  if (surveyType === 'coordinates') {
    return {
      value1: readNumber(row, ['Easting', 'easting', 'X', 'x']),
      value2: readNumber(row, ['Northing', 'northing', 'Y', 'y']),
      value3: readOptionalNumber(row, ['Elevation', 'elevation', 'RL', 'rl']),
    }
  }

  const firstNumeric = Object.values(row).find((v) => !isNaN(parseFloat(v)))
  return { value1: parseFloat(firstNumeric || '0') }
}

function mapRowToType(
  row: Record<string, string>,
  headers: string[],
  surveyType: SurveyDataset['surveyType']
): SurveyObservation['type'] {
  const h = headers.map((h: any) => h.toLowerCase())
  if (surveyType === 'traverse') return 'BEARING'
  if (surveyType === 'radiation') return h.includes('bearing') || h.includes('wcb') || h.includes('azimuth') ? 'BEARING' : 'ANGLE'
  if (surveyType === 'coordinates') return 'COORDINATE'
  if (h.includes('bs') && row['BS']) return 'BS'
  if (h.includes('fs') && row['FS']) return 'FS'
  if (h.includes('is') && row['IS']) return 'IS'
  if (h.includes('bearing')) return 'BEARING'
  if (h.includes('angle')) return 'ANGLE'
  if (h.includes('distance')) return 'DISTANCE'
  return 'COORDINATE'
}
