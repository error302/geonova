export interface TopconRecord {
  pointId: string
  easting?: number
  northing?: number
  elevation?: number
  code?: string
}

export function parseTopcon(content: string): {
  ok: boolean
  records: TopconRecord[]
  warnings: string[]
} {
  const warnings: string[] = []
  const records: TopconRecord[] = []
  const lines = content.trim().split('\n')

  for (const line of lines) {
    const parts = line.trim().split(',')
    if (parts.length < 4) continue

    const pointId = parts[0]?.trim()
    const northing = parseFloat(parts[1])
    const easting = parseFloat(parts[2])
    const elevation = parseFloat(parts[3])
    const code = parts[4]?.trim()

    if (!pointId || isNaN(northing) || isNaN(easting)) {
      warnings.push(`Skipped invalid row: ${line.trim()}`)
      continue
    }

    records.push({ pointId, easting, northing, elevation, code })
  }

  return { ok: true, records, warnings }
}
