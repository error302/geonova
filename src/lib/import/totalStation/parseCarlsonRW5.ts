/**
 * METARDU — Carlson SurvCE / FieldGenius RAW / RW5 Parser (.raw, .rw5)
 * 
 * Standard TDS / Carlson raw format parser for total station and GNSS records.
 * Record types:
 * - JB: Job Header (JB,NMjob,DT08-26-2026,TM14:30:00)
 * - MO: Mode / Units (MO,AD0,UN1,SF1.000,EC0,EO0.0,AU0)
 * - SP: Store Point (SP,PN101,N 1000.500,E 2000.500,EL 100.200,--TREE)
 * - OC: Occupied Station (OC,OP10,N 1000.0,E 2000.0,EL 100.0,--STN1)
 * - BK: Backsight (BK,OP10,BP1,BS180.0000,BC0.0000)
 * - SS: Side Shot (SS,OP10,FP101,AR120.3015,ZE88.1520,SD145.230,--TOPO)
 * - GPS: GNSS RTK Point (GPS,PN101,LA-1.2864,LN36.8172,EL1798.20,--GCP1)
 */

export interface CarlsonPoint {
  pointId: string
  northing: number
  easting: number
  elevation: number
  code?: string
  rawType: 'SP' | 'OC' | 'GPS' | 'SS'
}

export interface CarlsonRw5Parsed {
  records: CarlsonPoint[]
  jobName?: string
  warnings: string[]
  pointCount: number
}

export function parseCarlsonRW5(content: string): CarlsonRw5Parsed {
  const records: CarlsonPoint[] = []
  const warnings: string[] = []
  let jobName: string | undefined

  const lines = content.split(/\r?\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = line.split(',').map((p) => p.trim())
    const tag = parts[0].toUpperCase()

    if (tag === 'JB') {
      const nmPart = parts.find((p) => p.startsWith('NM'))
      if (nmPart) jobName = nmPart.replace(/^NM/, '')
    } else if (tag === 'SP' || tag === 'OC') {
      // Store Point or Occupied Station
      // SP,PN101,N 1000.500,E 2000.500,EL 100.200,--TREE
      let pointId = ''
      let northing = NaN
      let easting = NaN
      let elevation = 0
      let code = ''

      for (let j = 1; j < parts.length; j++) {
        const part = parts[j]
        if (part.startsWith('PN') || part.startsWith('OP')) {
          pointId = part.replace(/^(PN|OP)/, '')
        } else if (part.startsWith('EL ') || part.startsWith('EL') || part.startsWith('Z ') || part.startsWith('Z')) {
          elevation = parseFloat(part.replace(/^(EL|Z)\s*/, ''))
        } else if (part.startsWith('N ') || /^N[\d.-]/.test(part)) {
          northing = parseFloat(part.replace(/^N\s*/, ''))
        } else if (part.startsWith('E ') || /^E[\d.-]/.test(part)) {
          easting = parseFloat(part.replace(/^E\s*/, ''))
        } else if (part.startsWith('--')) {
          code = part.replace(/^--/, '')
        }
      }

      if (pointId && !isNaN(northing) && !isNaN(easting)) {
        records.push({
          pointId,
          northing,
          easting,
          elevation: isNaN(elevation) ? 0 : elevation,
          code: code || undefined,
          rawType: tag as 'SP' | 'OC',
        })
      }
    } else if (tag === 'GPS') {
      // GPS,PN101,LA-1.2864,LN36.8172,EL1798.20,--GCP1
      let pointId = ''
      let elevation = 0
      let code = ''

      for (let j = 1; j < parts.length; j++) {
        const part = parts[j]
        if (part.startsWith('PN')) pointId = part.replace(/^PN/, '')
        else if (part.startsWith('EL')) elevation = parseFloat(part.replace(/^EL\s*/, ''))
        else if (part.startsWith('--')) code = part.replace(/^--/, '')
      }

      // If followed by an SP record on subsequent line, SP will capture coordinates.
      // If standalone GPS, we note the point ID.
      if (pointId && !records.some((r) => r.pointId === pointId)) {
        // Will be filled if SP is present
      }
    }
  }

  if (records.length === 0) {
    warnings.push('No SP (Store Point) or OC (Occupied Station) coordinate records found in RAW/RW5 file.')
  }

  return {
    records,
    jobName,
    warnings,
    pointCount: records.length,
  }
}
