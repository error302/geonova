export interface ParsedPoint {
  pointId: string
  easting?: number
  northing?: number
  elevation?: number
  code?: string
  rawData: Record<string, string>
}

export interface ParseResult {
  format: 'gsi' | 'jobxml' | 'topcon' | 'csv' | 'unknown'
  points: ParsedPoint[]
  errors: string[]
  warnings: string[]
  metadata: Record<string, string>
}

function detectFormat(content: string, filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || ''
  if (ext === 'gsi' || ext === 'xml') {
    const trimmed = content.trim()
    if (trimmed.startsWith('*') && trimmed.includes('21.') && trimmed.includes('22.')) return 'gsi'
    if (trimmed.startsWith('<')) return 'jobxml'
  }
  if (ext === 'csv' || ext === 'txt') {
    const lines = content.split('\n').filter((l: any) => l.trim())
    if (lines[0]?.toLowerCase().includes('pt') && lines[0]?.toLowerCase().includes('n')) return 'topcon'
    if (lines[0]?.toLowerCase().includes('point') || lines[0]?.toLowerCase().includes('easting')) return 'csv'
  }
  const trimmed = content.trim()
  if (trimmed.startsWith('*') && trimmed.includes('21.') && trimmed.includes('22.')) return 'gsi'
  if (trimmed.startsWith('<')) return 'jobxml'
  return 'unknown'
}

function parseGSI(content: string): ParseResult {
  const points: ParsedPoint[] = []
  const errors: string[] = []
  const warnings: string[] = []
  const metadata: Record<string, string> = { format: 'Leica GSI' }

  const lines = content.split('\n').filter((l: any) => l.trim())
  let pointCount = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('*')) continue

    const words = trimmed.split(/\s+/)
    const pointData: Record<string, string> = {}

    for (const word of words) {
      if (!word.includes('.')) continue
      const dotIdx = word.indexOf('.')
      const key = word.substring(0, dotIdx)
      const value = word.substring(dotIdx + 1)
      pointData[key] = value
    }

    if (Object.keys(pointData).length === 0) continue

    const pointId = pointData['1']?.replace(/^0+/, '') || `P${pointCount + 1}`
    const easting = parseFloat(pointData['21']) / 10000
    const northing = parseFloat(pointData['22']) / 10000
    const elevation = pointData['23'] ? parseFloat(pointData['23']) / 10000 : undefined
    const code = pointData['33']?.replace(/\+/g, ' ').trim() || undefined

    if (!isNaN(easting) && !isNaN(northing)) {
      points.push({ pointId, easting, northing, elevation, code, rawData: pointData })
      pointCount++
    } else {
      warnings.push(`Point ${pointId}: Missing or invalid coordinates — skipped`)
    }
  }

  if (points.length === 0) {
    errors.push('No valid coordinate points found in GSI file. Ensure file contains GSI-8 or GSI-16 format with 21/22 word codes.')
  }

  return { format: 'gsi', points, errors, warnings, metadata }
}

function parseJobXML(content: string): ParseResult {
  const points: ParsedPoint[] = []
  const errors: string[] = []
  const warnings: string[] = []
  const metadata: Record<string, string> = { format: 'Trimble JobXML' }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/xml')

    const jobName = doc.querySelector('Job')?.getAttribute('name') || doc.querySelector('Name')?.textContent || ''
    metadata['job'] = jobName

    const obsElements = doc.querySelectorAll('Obs, Point, Observation')
    let pointCount = 0

    for (const obs of Array.from(obsElements)) {
      const getAttr = (el: Element, name: string) =>
        el.getAttribute(name) || el.querySelector(name)?.textContent || ''

      const pointId = getAttr(obs as Element, 'name') || getAttr(obs as Element, 'id') || getAttr(obs as Element, 'pt') || `P${pointCount + 1}`
      const rawEl = obs as Element

      const easting = parseFloat(getAttr(rawEl, 'east') || getAttr(rawEl, 'easting') || rawEl.querySelector('Easting')?.textContent || '')
      const northing = parseFloat(getAttr(rawEl, 'north') || getAttr(rawEl, 'northing') || rawEl.querySelector('Northing')?.textContent || '')
      const elevation = parseFloat(getAttr(rawEl, 'z') || getAttr(rawEl, 'elev') || rawEl.querySelector('Elevation')?.textContent || '')
      const code = getAttr(rawEl, 'code') || getAttr(rawEl, 'desc') || undefined

      if (!isNaN(easting) && !isNaN(northing)) {
        points.push({
          pointId: String(pointId),
          easting,
          northing,
          elevation: isNaN(elevation) ? undefined : elevation,
          code: code || undefined,
          rawData: {},
        })
        pointCount++
      }
    }
  } catch {
    errors.push('Failed to parse JobXML. Ensure valid XML format.')
  }

  if (points.length === 0) {
    errors.push('No valid coordinate points found in JobXML file.')
  }

  return { format: 'jobxml', points, errors, warnings, metadata }
}

function parseTopconGTS(content: string): ParseResult {
  const points: ParsedPoint[] = []
  const errors: string[] = []
  const warnings: string[] = []
  const metadata: Record<string, string> = { format: 'Topcon GTS' }

  const lines = content.split('\n').filter((l: any) => l.trim())
  const header = lines[0]?.toLowerCase() || ''
  const hasHeader = header.includes('pt') || header.includes('n') || header.includes('e')

  const dataLines = hasHeader ? lines.slice(1) : lines
  let pointCount = 0

  for (const line of dataLines) {
    const parts = line.split(/[,\t\s]+/).filter((p: any) => p.trim())
    if (parts.length < 3) continue

    const pointId = parts[0].trim()
    const n = parseFloat(parts[1])
    const e = parseFloat(parts[2])
    const z = parts[3] ? parseFloat(parts[3]) : undefined
    const code = parts[4]?.trim() || undefined

    if (!isNaN(n) && !isNaN(e)) {
      points.push({
        pointId,
        easting: e,
        northing: n,
        elevation: z && !isNaN(z) ? z : undefined,
        code,
        rawData: {},
      })
      pointCount++
    } else {
      warnings.push(`Line "${line}": Invalid numeric data — skipped`)
    }
  }

  if (points.length === 0) {
    errors.push('No valid coordinate points found. Expected format: PT, N, E, Z, CD (comma or tab separated).')
  }

  return { format: 'topcon', points, errors, warnings, metadata }
}

function parseCSV(content: string): ParseResult {
  const points: ParsedPoint[] = []
  const errors: string[] = []
  const warnings: string[] = []
  const metadata: Record<string, string> = { format: 'Generic CSV' }

  const lines = content.split('\n').filter((l: any) => l.trim())
  if (lines.length < 2) {
    errors.push('CSV file must have at least a header row and one data row.')
    return { format: 'csv', points, errors, warnings, metadata }
  }

  const header = lines[0].toLowerCase()
  const cols = lines[0].split(/[,\t]+/).map((c: any) => c.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''))

  const pidIdx = cols.findIndex(c => c.includes('id') || c.includes('label') || c === 'pt' || c === 'point')
  const eIdx = cols.findIndex(c => c.includes('east') || c === 'e' || c === 'x')
  const nIdx = cols.findIndex(c => c.includes('north') || c === 'n' || c === 'y')
  const zIdx = cols.findIndex(c => c.includes('elev') || c.includes('z') || c.includes('height') || c === 'rl')
  const codeIdx = cols.findIndex(c => c.includes('code') || c.includes('desc') || c.includes('cd'))

  if (eIdx === -1 || nIdx === -1) {
    errors.push('CSV must contain at least Easting (E) and Northing (N) columns.')
    return { format: 'csv', points, errors, warnings, metadata }
  }

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/[,\t]+/).map((p: any) => p.trim())
    const pointId = pidIdx >= 0 ? (parts[pidIdx] || `P${i}`) : `P${i}`
    const easting = parseFloat(parts[eIdx])
    const northing = parseFloat(parts[nIdx])
    const elevation = zIdx >= 0 && parts[zIdx] ? parseFloat(parts[zIdx]) : undefined
    const code = codeIdx >= 0 ? parts[codeIdx] : undefined

    if (!isNaN(easting) && !isNaN(northing)) {
      points.push({
        pointId,
        easting,
        northing,
        elevation: elevation && !isNaN(elevation) ? elevation : undefined,
        code: code || undefined,
        rawData: {},
      })
    } else {
      warnings.push(`Row ${i + 1}: Invalid coordinates — skipped`)
    }
  }

  metadata['pointCount'] = String(points.length)
  return { format: 'csv', points, errors, warnings, metadata }
}

export function parseTotalStationFile(content: string, filename: string): ParseResult {
  const format = detectFormat(content, filename)
  switch (format) {
    case 'gsi': return parseGSI(content)
    case 'jobxml': return parseJobXML(content)
    case 'topcon': return parseTopconGTS(content)
    case 'csv': return parseCSV(content)
    default: {
      const csvResult = parseCSV(content)
      if (csvResult.points.length > 0) return csvResult
      return {
        format: 'unknown',
        points: [],
        errors: ['Unknown file format. Supported formats: Leica GSI, Trimble JobXML, Topcon GTS, and Generic CSV.'],
        warnings: [],
        metadata: {},
      }
    }
  }
}

export function parseTraverseCSV(content: string): {
  headers: string[]
  rows: string[][]
  errors: string[]
} {
  const lines = content.split('\n').filter((l: any) => l.trim())
  if (lines.length < 2) return { headers: [], rows: [], errors: ['File is empty or has no data rows'] }

  const headers = lines[0].split(/[,\t]+/).map((h: any) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const rows = lines.slice(1).map((line: any) =>
    line.split(/[,\t]+/).map((cell: any) => cell.trim())
  ).filter((r: any) => r.some((c: any) => c.length > 0))

  const errors: string[] = []
  if (!headers.some((h: any) => h.includes('station'))) errors.push('Missing "station" column')
  if (!headers.some((h: any) => h.includes('slope_dist') || h.includes('dist') || h.includes('sd'))) {
    errors.push('Missing slope distance column (slope_dist, dist, or sd)')
  }

  return { headers, rows, errors }
}
