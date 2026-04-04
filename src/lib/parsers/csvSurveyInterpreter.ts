import { SurveyDataset, ObservationType } from '../observations/types'
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
    const lines = csvText.trim().split('\n').filter((l: any) => l.trim())
    if (lines.length < 2) {
      return { ok: false, error: 'File must have headers and at least one row', warnings }
    }
    
    // Parse headers
    const headers = lines[0].split(',').map((h: any) => h.trim())
    
    // Parse rows
    const rows = lines.slice(1).map((line: any) => {
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
    
    // Build observations
    const observations = rows.map((row, i) => ({
      id: `obs_${i}`,
      station: row['Station'] || row['station'] || row['Point'] || row['point'] || `P${i}`,
      target: row['Target'] || row['target'],
      type: mapRowToType(row, headers),
      value1: parseFloat(Object.values(row).find((v: any) => !isNaN(parseFloat(v))) || '0'),
      raw: Object.values(row).join(',')
    }))
    
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

function mapRowToType(row: Record<string, string>, headers: string[]): ObservationType {
  const h = headers.map((h: any) => h.toLowerCase())
  if (h.includes('bs') && row['BS']) return 'BS'
  if (h.includes('fs') && row['FS']) return 'FS'
  if (h.includes('is') && row['IS']) return 'IS'
  if (h.includes('bearing')) return 'BEARING'
  if (h.includes('angle')) return 'ANGLE'
  if (h.includes('distance')) return 'DISTANCE'
  return 'COORDINATE'
}
