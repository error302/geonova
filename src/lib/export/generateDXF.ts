/**
 * DXF Export Generator
 * Generates DXF files from survey data for CAD import
 * 
 * GeoNova Calculation Standards: N.N. Basak
 * - Full floating point precision in calculations
 * - Round only at display/export layer
 */

export interface SurveyPoint {
  name: string
  easting: number
  northing: number
  elevation?: number
  is_control?: boolean
}

export interface TraverseLeg {
  from: string
  to: string
  distance: number
  bearing: number
  adjEasting?: number
  adjNorthing?: number
}

export interface DXFExportOptions {
  projectName: string
  points: SurveyPoint[]
  traverseLegs?: TraverseLeg[]
  includeElevations?: boolean
}

function escapeDxfString(str: string): string {
  return str.replace(/[{}\\]/g, '\\$1')
}

export function generateDXF(options: DXFExportOptions): string {
  const { 
    points, 
    traverseLegs = [], 
    includeElevations = true 
  } = options

  let dxf = `  0
SECTION
  2
HEADER
  9
$ACADVER
  1
AC1015
  9
$INSUNITS
 70
6
  0
ENDSEC
  0
SECTION
  2
TABLES
  0
TABLE
  2
LTYPE
 70
3
  0
LTYPE
  2
CONTINUOUS
 70
0
  3
Solid line
 72
65
 73
0
 40
0.0
  0
LTYPE
  2
DASHED
 70
0
  3
Dashed
 72
65
 73
2
 40
2.0
 49
-1.0
 49
0.5
  0
LTYPE
  2
DOTTED
 70
0
  3
Dotted
 72
65
 73
2
 40
1.0
 49
-0.5
 49
0.25
  0
  0
ENDTAB
  0
TABLE
  2
LAYER
 70
6
  0
LAYER
  2
CONTROL_POINTS
 70
0
 62
1
  6
CONTINUOUS
  0
LAYER
  2
SURVEY_POINTS
 70
0
 62
7
  6
CONTINUOUS
  0
LAYER
  2
TRAVERSE_LINES
 70
0
 62
5
  6
CONTINUOUS
  0
LAYER
  2
POINT_LABELS
 70
0
 62
7
  6
CONTINUOUS
  0
LAYER
  2
ELEVATIONS
 70
0
 62
3
  6
CONTINUOUS
  0
  0
ENDTAB
  0
ENDSEC
  0
SECTION
  2
ENTITIES
`

  const controlPoints = points.filter(p => p.is_control)
  const surveyPoints = points.filter(p => !p.is_control)

  for (const pt of controlPoints) {
    dxf += drawPointMarker(pt, 'CONTROL_POINTS')
    dxf += addPointLabel(pt, 'POINT_LABELS')
    if (includeElevations && pt.elevation !== undefined) {
      dxf += addElevationLabel(pt, 'ELEVATIONS')
    }
  }

  for (const pt of surveyPoints) {
    dxf += drawPointMarker(pt, 'SURVEY_POINTS')
    dxf += addPointLabel(pt, 'POINT_LABELS')
    if (includeElevations && pt.elevation !== undefined) {
      dxf += addElevationLabel(pt, 'ELEVATIONS')
    }
  }

  for (const leg of traverseLegs) {
    if (leg.adjEasting !== undefined && leg.adjNorthing !== undefined) {
      const fromPoint = points.find(p => p.name === leg.from)
      const toPoint = points.find(p => p.name === leg.to)
      
      if (fromPoint && toPoint) {
        dxf += `  0
LINE
  8
TRAVERSE_LINES
 10
${fromPoint.easting.toFixed(6)}
 20
${fromPoint.northing.toFixed(6)}
 30
0.0
 11
${toPoint.easting.toFixed(6)}
 21
${toPoint.northing.toFixed(6)}
 31
0.0
`
      }
    }
  }

  dxf += `  0
ENDSEC
  0
EOF
`

  return dxf
}

function drawPointMarker(pt: SurveyPoint, layer: string): string {
  const size = 0.5

  return `  0
POLYLINE
  8
${layer}
 66
1
 70
0
  0
VERTEX
  8
${layer}
 10
${(pt.easting - size).toFixed(6)}
 20
${pt.northing.toFixed(6)}
 30
0.0
  0
VERTEX
  8
${layer}
 10
${(pt.easting + size).toFixed(6)}
 20
${pt.northing.toFixed(6)}
 30
0.0
  0
VERTEX
  8
${layer}
 10
${pt.easting.toFixed(6)}
 20
${(pt.northing - size).toFixed(6)}
 30
0.0
  0
VERTEX
  8
${layer}
 10
${pt.easting.toFixed(6)}
 20
${(pt.northing + size).toFixed(6)}
 30
0.0
  0
SEQEND
  8
${layer}
  0
CIRCLE
  8
${layer}
 10
${pt.easting.toFixed(6)}
 20
${pt.northing.toFixed(6)}
 30
0.0
 40
${(size * 0.3).toFixed(6)}
`
}

function addPointLabel(pt: SurveyPoint, layer: string): string {
  return `  0
TEXT
  8
${layer}
 10
${(pt.easting + 1).toFixed(6)}
 20
${(pt.northing + 1).toFixed(6)}
 30
0.0
 40
1.0
  1
${escapeDxfString(pt.name)}
 72
1
 11
${(pt.easting + 1).toFixed(6)}
 21
${(pt.northing + 1).toFixed(6)}
 31
0.0
`
}

function addElevationLabel(pt: SurveyPoint, layer: string): string {
  if (pt.elevation === undefined) return ''
  
  return `  0
TEXT
  8
${layer}
 10
${(pt.easting + 1).toFixed(6)}
 20
${(pt.northing - 1).toFixed(6)}
 30
0.0
 40
0.8
  1
RL:${pt.elevation.toFixed(3)}
 72
1
 11
${(pt.easting + 1).toFixed(6)}
 21
${(pt.northing - 1).toFixed(6)}
 31
0.0
`
}

export function downloadDXF(options: DXFExportOptions): void {
  const dxfString = generateDXF(options)
  const blob = new Blob([dxfString], { type: 'application/dxf' })
  const url = URL.createObjectURL(blob)
  
  const date = new Date().toISOString().split('T')[0]
  const filename = `${options.projectName.replace(/\s+/g, '_')}_${date}.dxf`
  
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function generateDXFFromProject(
  projectName: string,
  points: SurveyPoint[],
  traverseResult?: {
    legs: Array<{
      from: string
      to: string
      adjEasting: number
      adjNorthing: number
    }>
  }
): string {
  return generateDXF({
    projectName,
    points,
    traverseLegs: traverseResult?.legs.map(l => ({
      from: l.from,
      to: l.to,
      distance: 0,
      bearing: 0,
      adjEasting: l.adjEasting,
      adjNorthing: l.adjNorthing
    })) || []
  })
}
