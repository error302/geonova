/**
 * DXF Export Generator (TypeScript-only)
 *
 * Blueprint alignment:
 * - Core exports must not depend on Python services.
 * - Uses the installed `dxf-writer` dependency to produce CAD-ready DXF.
 *
 * Notes:
 * - Coordinates are exported in the project CRS (typically UTM metres).
 * - No intermediate rounding is performed in calculations; DXF writer receives full JS float values.
 */

import Drawing from 'dxf-writer'

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

export function generateDXF(options: DXFExportOptions): string {
  const { points, traverseLegs = [], includeElevations = true } = options

  const drawing = new Drawing()
  drawing.setUnits('Meters')

  drawing.addLineType('DASHED', 'Dashed', [-1.0, 0.5])
  drawing.addLineType('DOTTED', 'Dotted', [-0.5, 0.25])

  drawing.addLayer('POINTS_CONTROL', Drawing.ACI.RED, 'CONTINUOUS')
  drawing.addLayer('POINTS_SURVEY', Drawing.ACI.YELLOW, 'CONTINUOUS')
  drawing.addLayer('TRAVERSE', Drawing.ACI.CYAN, 'CONTINUOUS')
  drawing.addLayer('LABELS', Drawing.ACI.WHITE, 'CONTINUOUS')

  const byName = new Map(points.map((p: any) => [p.name, p] as const))

  // Points + labels
  for (const p of points) {
    drawing.setActiveLayer(p.is_control ? 'POINTS_CONTROL' : 'POINTS_SURVEY')
    drawing.drawPoint(p.easting, p.northing)

    drawing.setActiveLayer('LABELS')
    const label =
      includeElevations && typeof p.elevation === 'number' ? `${p.name} (${p.elevation})` : p.name
    drawing.drawText(p.easting + 0.5, p.northing + 0.5, 1.5, 0, label)
  }

  // Traverse lines (if coordinates can be resolved)
  if (traverseLegs.length > 0) {
    drawing.setActiveLayer('TRAVERSE')
    for (const leg of traverseLegs) {
      const from = byName.get(leg.from)
      const to = byName.get(leg.to)
      if (!from || !to) continue
      drawing.drawLine(from.easting, from.northing, to.easting, to.northing)
    }
  }

  return drawing.toDxfString()
}

export function downloadDXF(options: DXFExportOptions): void {
  const dxfString = generateDXF(options)
  const blob = new Blob([dxfString], { type: 'application/dxf' })
  const url = URL.createObjectURL(blob)

  const date = new Date().toISOString().split('T')[0]
  const filename = `${options.projectName.replace(/\\s+/g, '_')}_${date}.dxf`

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
    traverseLegs:
      traverseResult?.legs.map((l: any) => ({
        from: l.from,
        to: l.to,
        distance: 0,
        bearing: 0,
        adjEasting: l.adjEasting,
        adjNorthing: l.adjNorthing,
      })) || [],
  })
}

