export interface SDRRecord {
  pointId: string
  easting?: number
  northing?: number
  elevation?: number
}

export function parseSDR(content: string): {
  ok: boolean
  records: SDRRecord[]
  warnings: string[]
} {
  const warnings: string[] = []
  const records: SDRRecord[] = []
  const lines = content.trim().split('\n')

  for (const line of lines) {
    if (!line.startsWith('08')) continue

    const parts = line.substring(2).split(',')
    if (parts.length < 4) continue

    const pointId = parts[0]?.trim()
    const northing = parseFloat(parts[1])
    const easting = parseFloat(parts[2])
    const elevation = parseFloat(parts[3])

    if (!pointId || isNaN(easting) || isNaN(northing)) continue

    records.push({ pointId, easting, northing, elevation })
  }

  return { ok: true, records, warnings }
}
