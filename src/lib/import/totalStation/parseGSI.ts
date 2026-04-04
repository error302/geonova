/**
 * Leica GSI Format Parser
 * GSI-8 and GSI-16 formats
 */

export interface GSIRecord {
  pointId: string
  easting?: number
  northing?: number
  elevation?: number
  horizontalAngle?: number
  verticalAngle?: number
  slopeDistance?: number
  reflectorHeight?: number
  instrumentHeight?: number
}

export function parseGSI(content: string): {
  ok: boolean
  records: GSIRecord[]
  warnings: string[]
  format: 'GSI-8' | 'GSI-16' | 'unknown'
} {
  const warnings: string[] = []
  const records: GSIRecord[] = []
  const lines = content.trim().split('\n').filter((l: any) => l.trim())

  if (!lines.length) {
    return { ok: false, records: [], warnings: ['Empty file'], format: 'unknown' }
  }

  const firstLine = lines[0].trim()
  const format = firstLine.startsWith('*') ? 'GSI-16' : 'GSI-8'
  const wordLength = format === 'GSI-16' ? 24 : 16

  for (const line of lines) {
    const cleanLine = line.trim().replace(/^\*/, '')
    const record: GSIRecord = { pointId: '' }

    let pos = 0
    while (pos < cleanLine.length) {
      const word = cleanLine.substring(pos, pos + wordLength).trim()
      if (!word) { pos += wordLength; continue }

      const wi = word.substring(0, 2)
      const value = word.substring(7)

      const numValue = parseFloat(value)

      switch (wi) {
        case '11': record.pointId = value.replace(/^0+/, '') || '0'; break
        case '81': record.easting = numValue / 1000; break
        case '82': record.northing = numValue / 1000; break
        case '83': record.elevation = numValue / 1000; break
        case '21': record.horizontalAngle = numValue / 100000; break
        case '22': record.verticalAngle = numValue / 100000; break
        case '31': record.slopeDistance = numValue / 1000; break
        case '87': record.reflectorHeight = numValue / 1000; break
        case '88': record.instrumentHeight = numValue / 1000; break
      }

      pos += wordLength
    }

    if (record.pointId) records.push(record)
  }

  return { ok: true, records, warnings, format }
}
