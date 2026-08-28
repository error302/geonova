/**
 * Shared topographic drawing entity model.
 *
 * One survey project → one entity list → many consumers:
 *   • DXF export          (entitiesToDxfString)
 *   • On-screen preview   (TopoEntityCanvas / Konva)
 *   • PDF plan rendering  (future deliverable engine)
 *   • Server-side exports (pure functions, no DOM dependency except dxf-writer)
 *
 * All geometry is in world coordinates (easting/northing metres).
 */
import Drawing from 'dxf-writer'
import {
  type SurveyPointWithCode,
  type LayerMappingResult,
  mapPointsToLayers,
  aciToHex,
  DXF_LINE_TYPE_PATTERNS,
} from '@/lib/topo/featureCodes'
import type { ContourLine } from '@/lib/topo/contourGenerator'

// ─── Entity model ───────────────────────────────────────────────────────────

export interface Extents {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type DrawingEntity =
  | { kind: 'line'; layer: string; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'polyline'; layer: string; pts: Array<[number, number]>; closed?: boolean }
  | { kind: 'point'; layer: string; e: number; n: number }
  | { kind: 'text'; layer: string; e: number; n: number; height: number; text: string; rotation?: number }

export interface DrawingLayerInfo {
  name: string
  colorHex: string
  lineTypeName: string
}

export interface TopoEntitySettings {
  scale: number
  includeSpotHeights: boolean
  includeTitleBlock: boolean
  gridTickInterval: number
  includeLabels: boolean
  includeLegend: boolean
}

export interface TopoEntityOptions {
  projectName?: string
  /** Pre-generated contours to draw (from generateContours). */
  contours?: ContourLine[]
  /** Draw contour elevation labels on index contours. Default true when contours provided. */
  labelContours?: boolean
}

const STANDARD_ANNOTATION_LAYERS: Array<[string, string, string]> = [
  ['ANNOTATIONS', '#00ff00', 'CONTINUOUS'],
  ['SPOT_HEIGHTS', '#00ff00', 'CONTINUOUS'],
  ['BORDER', '#ffffff', 'CONTINUOUS'],
  ['NORTH_ARROW', '#ffffff', 'CONTINUOUS'],
  ['SCALE_BAR', '#ffffff', 'CONTINUOUS'],
  ['TITLE_BLOCK', '#ffffff', 'CONTINUOUS'],
  ['LEGEND', '#ffffff', 'CONTINUOUS'],
  ['GRID', '#808080', 'DASHED'],
  ['CONTOURS', '#8b4513', 'CONTINUOUS'],
  ['CONTOUR_I', '#c06010', 'CONTINUOUS'],
]

// ─── Builder ────────────────────────────────────────────────────────────────

export function computeExtents(points: Array<{ easting: number; northing: number }>, paddingFactor = 0.15): Extents {
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.easting < minX) minX = p.easting
    if (p.easting > maxX) maxX = p.easting
    if (p.northing < minY) minY = p.northing
    if (p.northing > maxY) maxY = p.northing
  }
  if (!isFinite(minX)) return { minX: 0, maxX: 100, minY: 0, maxY: 100 }
  const padding = Math.max(maxX - minX, maxY - minY) * paddingFactor
  return {
    minX: minX - padding,
    maxX: maxX + padding,
    minY: minY - padding,
    maxY: maxY + padding,
  }
}

/**
 * Build the complete drawing as a render-agnostic entity list.
 * Mirrors the original DXF generator so exports and previews stay identical.
 */
export function buildTopoEntities(
  points: SurveyPointWithCode[],
  settings: TopoEntitySettings,
  options: TopoEntityOptions = {},
): { entities: DrawingEntity[]; layers: DrawingLayerInfo[]; layerResults: LayerMappingResult[]; extents: Extents } {
  const { projectName = 'Topographic Survey', contours = [], labelContours = true } = options
  const entities: DrawingEntity[] = []

  // ─── Layers ──────────────────────────────────────────────────────────────
  const layerResults = mapPointsToLayers(points)
  const layerMap = new Map<string, DrawingLayerInfo>()

  for (const [name, colorHex, lt] of STANDARD_ANNOTATION_LAYERS) {
    layerMap.set(name, { name, colorHex, lineTypeName: lt })
  }
  for (const lr of layerResults) {
    if (!layerMap.has(lr.layer)) {
      layerMap.set(lr.layer, {
        name: lr.layer,
        colorHex: aciToHex(lr.color),
        lineTypeName:
          DXF_LINE_TYPE_PATTERNS[lr.lineType as keyof typeof DXF_LINE_TYPE_PATTERNS]?.name ?? lr.lineType,
      })
    }
  }

  const extents = computeExtents(points)
  const { minX, maxX, minY, maxY } = extents
  const worldW = maxX - minX
  const worldH = maxY - minY
  const inset = worldW * 0.01

  // ─── Grid ticks ──────────────────────────────────────────────────────────
  {
    const gi = settings.gridTickInterval
    const gx0 = Math.floor(minX / gi) * gi
    const gy0 = Math.floor(minY / gi) * gi
    for (let x = gx0; x <= maxX; x += gi) {
      entities.push({ kind: 'line', layer: 'GRID', x1: x, y1: minY, x2: x, y2: minY + 2 })
      entities.push({ kind: 'line', layer: 'GRID', x1: x, y1: maxY - 2, x2: x, y2: maxY })
    }
    for (let y = gy0; y <= maxY; y += gi) {
      entities.push({ kind: 'line', layer: 'GRID', x1: minX, y1: y, x2: minX + 2, y2: y })
      entities.push({ kind: 'line', layer: 'GRID', x1: maxX - 2, y1: y, x2: maxX, y2: y })
    }
  }

  // ─── Spot heights (cross marks + RL labels) ──────────────────────────────
  if (settings.includeSpotHeights) {
    const tick = worldW * 0.005
    for (const p of points) {
      if (p.code.toUpperCase() !== 'SH') continue
      entities.push({ kind: 'line', layer: 'SPOT_HEIGHTS', x1: p.easting - tick, y1: p.northing, x2: p.easting + tick, y2: p.northing })
      entities.push({ kind: 'line', layer: 'SPOT_HEIGHTS', x1: p.easting, y1: p.northing - tick, x2: p.easting, y2: p.northing + tick })
      if (p.elevation !== undefined) {
        entities.push({
          kind: 'text', layer: 'SPOT_HEIGHTS',
          e: p.easting + tick * 1.5, n: p.northing + tick * 0.5,
          height: worldW * 0.008, text: p.elevation.toFixed(3),
        })
      }
    }
  }

  // ─── Contours ────────────────────────────────────────────────────────────
  for (const c of contours) {
    const layer = c.isIndex ? 'CONTOUR_I' : 'CONTOURS'
    for (const ring of c.coordinates) {
      if (ring.length < 2) continue
      entities.push({ kind: 'polyline', layer, pts: ring, closed: true })
      if (c.isIndex && labelContours) {
        const mid = ring[Math.floor(ring.length / 4)]
        entities.push({
          kind: 'text', layer: 'ANNOTATIONS',
          e: mid[0], n: mid[1],
          height: worldW * 0.006,
          text: c.elevation.toFixed(1),
        })
      }
    }
  }

  // ─── Feature-coded polylines & point markers ─────────────────────────────
  for (const lr of layerResults) {
    for (const poly of lr.polylines) {
      if (poly.length >= 2) {
        entities.push({ kind: 'polyline', layer: lr.layer, pts: poly.map(p => [p.e, p.n] as [number, number]) })
      }
    }
    for (const pt of lr.points) {
      entities.push({ kind: 'point', layer: lr.layer, e: pt.e, n: pt.n })
    }
  }

  // ─── Labels ──────────────────────────────────────────────────────────────
  if (settings.includeLabels) {
    for (const lr of layerResults) {
      for (const pt of lr.points) {
        if (pt.label) {
          entities.push({
            kind: 'text', layer: 'ANNOTATIONS',
            e: pt.e + worldW * 0.006, n: pt.n + worldH * 0.006,
            height: worldW * 0.007, text: pt.label,
          })
        }
      }
    }
  }

  // ─── Border ──────────────────────────────────────────────────────────────
  entities.push({ kind: 'polyline', layer: 'BORDER', pts: [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]], closed: true })
  entities.push({
    kind: 'polyline', layer: 'BORDER',
    pts: [
      [minX + inset, minY + inset], [maxX - inset, minY + inset],
      [maxX - inset, maxY - inset], [minX + inset, maxY - inset],
    ],
    closed: true,
  })

  // ─── North arrow ─────────────────────────────────────────────────────────
  {
    const ax = maxX - worldW * 0.06
    const ay = maxY - worldH * 0.06
    const len = worldW * 0.04
    entities.push({ kind: 'line', layer: 'NORTH_ARROW', x1: ax, y1: ay - len, x2: ax, y2: ay + len })
    entities.push({ kind: 'line', layer: 'NORTH_ARROW', x1: ax, y1: ay + len, x2: ax - len * 0.2, y2: ay + len * 0.6 })
    entities.push({ kind: 'line', layer: 'NORTH_ARROW', x1: ax, y1: ay + len, x2: ax + len * 0.2, y2: ay + len * 0.6 })
    entities.push({ kind: 'text', layer: 'NORTH_ARROW', e: ax, n: ay + len * 1.3, height: worldW * 0.012, text: 'N' })
  }

  // ─── Scale bar ───────────────────────────────────────────────────────────
  {
    const sbX = minX + inset
    const sbY = minY - inset * 2
    const sbLen = worldW * 0.15
    entities.push({ kind: 'line', layer: 'SCALE_BAR', x1: sbX, y1: sbY, x2: sbX + sbLen, y2: sbY })
    entities.push({ kind: 'line', layer: 'SCALE_BAR', x1: sbX, y1: sbY - inset * 0.3, x2: sbX, y2: sbY + inset * 0.3 })
    entities.push({ kind: 'line', layer: 'SCALE_BAR', x1: sbX + sbLen, y1: sbY - inset * 0.3, x2: sbX + sbLen, y2: sbY + inset * 0.3 })
    entities.push({
      kind: 'text', layer: 'SCALE_BAR',
      e: sbX + sbLen / 2, n: sbY - inset * 0.8,
      height: worldW * 0.008, text: `Scale 1:${settings.scale}`,
    })
  }

  // ─── Title block ─────────────────────────────────────────────────────────
  if (settings.includeTitleBlock) {
    const tbX = minX + inset * 2
    const tbY = minY - inset * 5
    const titleSize = worldW * 0.012
    const subSize = worldW * 0.008
    const date = new Date().toISOString().split('T')[0]

    entities.push({ kind: 'text', layer: 'TITLE_BLOCK', e: tbX, n: tbY, height: titleSize, text: 'REPUBLIC OF KENYA — TOPOGRAPHIC SURVEY' })
    entities.push({ kind: 'text', layer: 'TITLE_BLOCK', e: tbX, n: tbY - titleSize * 2, height: subSize, text: `Project: ${projectName}` })
    entities.push({ kind: 'text', layer: 'TITLE_BLOCK', e: tbX, n: tbY - titleSize * 3.5, height: subSize, text: `Scale: 1:${settings.scale}` })
    entities.push({ kind: 'text', layer: 'TITLE_BLOCK', e: tbX, n: tbY - titleSize * 5, height: subSize, text: `Total Points: ${points.length}  |  Layers: ${layerResults.length}` })
    entities.push({ kind: 'text', layer: 'TITLE_BLOCK', e: tbX, n: tbY - titleSize * 6.5, height: subSize * 0.85, text: `Date: ${date}  |  Generated by METARDU` })
    entities.push({ kind: 'text', layer: 'TITLE_BLOCK', e: tbX, n: tbY - titleSize * 8, height: subSize * 0.85, text: `Coordinate System: Arc 1960 / UTM Zone ${minX > 500000 ? '37S' : '36N'}` })
  }

  // ─── Legend ──────────────────────────────────────────────────────────────
  if (settings.includeLegend && layerResults.length > 0) {
    const lgX = maxX - worldW * 0.2
    const lgY = maxY - inset * 2
    const rowH = worldH * 0.025
    const textH = worldW * 0.007

    entities.push({ kind: 'text', layer: 'LEGEND', e: lgX, n: lgY, height: textH * 1.4, text: 'LEGEND' })

    let row = 0
    for (const lr of layerResults) {
      const y = lgY - rowH * (row + 1)
      if (y < minY + inset * 5) break
      entities.push({ kind: 'line', layer: lr.layer, x1: lgX, y1: y, x2: lgX + worldW * 0.015, y2: y })
      entities.push({ kind: 'text', layer: 'LEGEND', e: lgX + worldW * 0.02, n: y, height: textH, text: `${lr.layer} (${lr.points.length} pts)` })
      row++
    }
  }

  return {
    entities,
    layers: [...layerMap.values()],
    layerResults,
    extents,
  }
}

// ─── DXF writer (one of many consumers of the entity list) ──────────────────

export function entitiesToDxfString(entities: DrawingEntity[], layers: DrawingLayerInfo[]): string {
  const drawing = new Drawing()
  drawing.setUnits('Meters')

  // Register line types used by layers
  for (const [, pattern] of Object.entries(DXF_LINE_TYPE_PATTERNS)) {
    if (pattern.elements.length > 0) {
      drawing.addLineType(pattern.name, pattern.name, pattern.elements)
    }
  }
  for (const l of layers) {
    try {
      drawing.addLayer(l.name, aciFromHex(l.colorHex), l.lineTypeName)
    } catch {
      drawing.addLayer(l.name, 7, 'CONTINUOUS')
    }
  }

  const active = new Set<string>()
  function setLayer(layer: string) {
    if (active.has(layer)) return
    drawing.setActiveLayer(layer)
    active.add(layer)
  }

  for (const e of entities) {
    switch (e.kind) {
      case 'line':
        setLayer(e.layer)
        drawing.drawLine(e.x1, e.y1, e.x2, e.y2)
        break
      case 'polyline':
        setLayer(e.layer)
        for (let i = 0; i < e.pts.length - 1; i++) {
          drawing.drawLine(e.pts[i][0], e.pts[i][1], e.pts[i + 1][0], e.pts[i + 1][1])
        }
        if (e.closed && e.pts.length > 2) {
          const last = e.pts[e.pts.length - 1]
          drawing.drawLine(last[0], last[1], e.pts[0][0], e.pts[0][1])
        }
        break
      case 'point':
        setLayer(e.layer)
        drawing.drawPoint(e.e, e.n)
        break
      case 'text':
        setLayer(e.layer)
        drawing.drawText(e.e, e.n, e.height, e.rotation ?? 0, e.text)
        break
    }
  }

  return drawing.toDxfString()
}

/** Resolve nearest ACI colour from a hex string (dxf-writer accepts ACI integers). */
function aciFromHex(hex: string): number {
  const entries: Array<[string, number]> = [
    ['#ff0000', 1], ['#ffff00', 2], ['#00ff00', 3], ['#00ffff', 4],
    ['#0000ff', 5], ['#ff00ff', 6], ['#ffffff', 7], ['#808080', 8], ['#c0c0c0', 9],
  ]
  const norm = hex.toLowerCase()
  for (const [h, aci] of entries) {
    if (norm === h) return aci
  }
  // Fallback: derive an approximate ACI from luminance
  const r = parseInt(norm.slice(1, 3), 16) || 0
  const g = parseInt(norm.slice(3, 5), 16) || 0
  const b = parseInt(norm.slice(5, 7), 16) || 0
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  if (lum > 200) return 7
  if (lum < 40) return 250
  return 8
}

