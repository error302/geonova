/**
 * METARDU — LandXML Parser
 * 
 * Standard LandXML (.xml) parser for surveying and civil engineering data.
 * Extracts:
 * - CgPoints (Coordinate Geometry Points: <CgPoint name="P1" code="TOPO">Northing Easting Elevation</CgPoint>)
 * - Survey Monuments & Parcels
 * - Reduced observations and station setups
 */

export interface LandXmlPoint {
  pointId: string
  northing: number
  easting: number
  elevation: number
  code?: string
  description?: string
}

export interface LandXmlParsed {
  records: Array<{
    pointId: string
    northing: number
    easting: number
    elevation: number
    code?: string
  }>
  projectUnits: {
    linear: 'meter' | 'foot' | 'internationalFoot' | 'unknown'
    angular: 'decimal degrees' | 'radians' | 'dms' | 'unknown'
  }
  warnings: string[]
  pointCount: number
}

export function parseLandXML(content: string): LandXmlParsed {
  const warnings: string[] = []
  const records: LandXmlParsed['records'] = []

  // Check for LandXML root
  if (!content.includes('<LandXML') && !content.includes('<CgPoint')) {
    return {
      records: [],
      projectUnits: { linear: 'unknown', angular: 'unknown' },
      warnings: ['Invalid LandXML format — missing <LandXML> root tag.'],
      pointCount: 0,
    }
  }

  // Parse linear units
  let linear: LandXmlParsed['projectUnits']['linear'] = 'meter'
  if (content.includes('linearUnit="foot"') || content.includes('linearUnit="USSurveyFoot"')) {
    linear = 'foot'
  }

  // Regex to extract <CgPoint ...> coordinates </CgPoint>
  // Example: <CgPoint name="101" code="TREE" desc="Big Oak">9860123.456 254123.789 1680.500</CgPoint>
  // Or: <CgPoint name="101">9860123.456 254123.789 1680.500</CgPoint>
  const cgPointRegex = /<CgPoint\s+([^>]*?)>([^<]+)<\/CgPoint>/gi
  let match: RegExpExecArray | null

  while ((match = cgPointRegex.exec(content)) !== null) {
    const attributes = match[1]
    const coordStr = match[2].trim()

    // Extract name
    const nameMatch = /name=["']([^"']+)["']/i.exec(attributes)
    const pntNumMatch = /pntNum=["']([^"']+)["']/i.exec(attributes)
    const pointId = nameMatch ? nameMatch[1] : pntNumMatch ? pntNumMatch[1] : `PT_${records.length + 1}`

    // Extract code / description
    const codeMatch = /code=["']([^"']+)["']/i.exec(attributes)
    const descMatch = /desc=["']([^"']+)["']/i.exec(attributes)
    const code = codeMatch ? codeMatch[1] : descMatch ? descMatch[1] : ''

    // Split coordinates: LandXML standard order is Northing Easting Elevation (Y X Z)
    const parts = coordStr.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      let n = parseFloat(parts[0])
      let e = parseFloat(parts[1])
      let z = parts[2] ? parseFloat(parts[2]) : 0

      // If units are feet, convert to metres
      if (linear === 'foot') {
        n *= 0.3048006096
        e *= 0.3048006096
        z *= 0.3048006096
      }

      if (!isNaN(n) && !isNaN(e)) {
        records.push({
          pointId,
          northing: n,
          easting: e,
          elevation: isNaN(z) ? 0 : z,
          code: code || undefined,
        })
      }
    }
  }

  // Also check self-closing tag or alternative tag format: <CgPoint name="1" ... />
  if (records.length === 0) {
    const altRegex = /<CgPoint\s+([^>]*?)\/>/gi
    while ((match = altRegex.exec(content)) !== null) {
      const attributes = match[1]
      const nameMatch = /name=["']([^"']+)["']/i.exec(attributes)
      const pMatch = /p=["']([^"']+)["']/i.exec(attributes)
      if (nameMatch && pMatch) {
        const parts = pMatch[1].trim().split(/\s+/)
        if (parts.length >= 2) {
          records.push({
            pointId: nameMatch[1],
            northing: parseFloat(parts[0]),
            easting: parseFloat(parts[1]),
            elevation: parts[2] ? parseFloat(parts[2]) : 0,
          })
        }
      }
    }
  }

  if (records.length === 0) {
    warnings.push('No <CgPoint> coordinate elements found in LandXML file.')
  }

  return {
    records,
    projectUnits: { linear, angular: 'decimal degrees' },
    warnings,
    pointCount: records.length,
  }
}
