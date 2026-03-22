# Survey Plan Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a professional SVG-based survey plan renderer that produces A3 landscape Boundary Identification Plans indistinguishable from a real surveyor's stamped plan, with interactive browser preview and PDF export.

**Architecture:** Pure TypeScript renderer class (zero React deps) → React client component viewer → svg2pdf.js PDF export. Three distinct layers, each testable in isolation.

**Tech Stack:** TypeScript, SVG, svg2pdf.js, jsPDF, React, Share Tech Mono font

---

## File Structure

```
src/
  lib/
    reports/
      surveyPlan/
        types.ts        # SurveyPlanData + all sub-interfaces
        geometry.ts     # Coordinate transforms, scale, bearing math
        symbols.ts      # SVG path builders: monuments, arrows, scale bar, border
        renderer.ts     # SurveyPlanRenderer class — orchestrates all layers
  components/
    SurveyPlanViewer.tsx   # Client: SVG preview + zoom controls
    SurveyPlanExport.tsx   # Client: svg2pdf.js → PDF download
  app/
    project/[id]/documents/page.tsx  # Add Survey Plan tab
```

**Delete after migration:** `src/lib/reports/surveyPlan.ts` (old jsPDF-only generator)

---

## Dependency Installation

- [ ] **Step 1: Install svg2pdf.js**

```bash
cd "C:\Users\ADMIN\Desktop\Survey -ENG" && npm install svg2pdf.js
```
Verify: `npm ls svg2pdf.js` shows version installed.

---

## Task 1: Types (`src/lib/reports/surveyPlan/types.ts`)

**File:** Create: `src/lib/reports/surveyPlan/types.ts`

- [ ] **Step 1: Write types**

```typescript
export type MonumentType = 'found' | 'set' | 'masonry_nail' | 'iron_pin'

export interface BoundaryPoint {
  name: string
  easting: number
  northing: number
}

export interface ControlPoint extends BoundaryPoint {
  elevation?: number
  monumentType: MonumentType
  beaconDescription?: string
}

export interface AdjacentLot {
  id: string
  boundaryPoints: Array<{ easting: number; northing: number }>
}

export interface Building {
  easting: number      // centroid easting
  northing: number     // centroid northing
  width_m: number
  height_m: number
  rotation_deg: number
  label?: string
}

export interface SurveyPlanData {
  project: {
    name: string
    location: string
    municipality?: string
    utm_zone: number
    hemisphere: 'N' | 'S'
    datum?: string
    client_name?: string
    surveyor_name?: string
    surveyor_licence?: string
    firm_name?: string
    firm_address?: string
    firm_phone?: string
    firm_email?: string
    drawing_no?: string
    reference?: string
    plan_title?: string
    area_sqm?: number
    area_ha?: number
    parcel_id?: string
  }
  parcel: {
    boundaryPoints: BoundaryPoint[]
    area_sqm: number
    perimeter_m: number
  }
  controlPoints: ControlPoint[]
  adjacentLots?: AdjacentLot[]
  buildings?: Building[]
}

export interface PlanOptions {
  paperSize?: 'a3' | 'a4'
  scale?: number         // override auto-scale, e.g. 500 for 1:500
  includeGrid?: boolean  // default true
  includePanel?: boolean // default true
  language?: string      // for certificate text, default 'en'
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/reports/surveyPlan/types.ts
git commit -m "feat(surveyPlan): add TypeScript interfaces for plan data"
```

---

## Task 2: Geometry (`src/lib/reports/surveyPlan/geometry.ts`)

**File:** Create: `src/lib/reports/surveyPlan/geometry.ts`
**Purpose:** All coordinate math — transforms, bearing/distance calculation, scale selection, angle utilities.

- [ ] **Step 1: Write geometry utilities**

```typescript
const DPI = 96
const MM_PER_INCH = 25.4
const PX_PER_MM = DPI / MM_PER_INCH   // ≈ 3.78 px per mm
const PX_PER_M = PX_PER_MM * 1000      // ≈ 3780 px per metre

// Standard survey plan scales (smallest → largest)
export const STANDARD_SCALES = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000]

export const PAGE_WIDTH_MM = 420   // A3 landscape
export const PAGE_HEIGHT_MM = 297

export function mmToPx(mm: number): number {
  return mm * PX_PER_MM
}

export function mToPx(m: number): number {
  return m * PX_PER_M
}

export function pxToM(px: number): number {
  return px / PX_PER_M
}

export function selectScale(drawingWidthPx: number, drawingWidthM: number): number {
  const rawScale = drawingWidthPx / drawingWidthM
  return STANDARD_SCALES.find(s => s >= rawScale) || 50000
}

export function calcScaleLabel(scale: number): string {
  return `1:${scale.toLocaleString()}`
}

export function calcScaleBarMetres(scale: number): number {
  // Scale bar shows 200m for 1:500, 500m for 1:1000, etc.
  const base = scale >= 1000 ? 500 : 200
  return base
}

export function bearingFromDelta(dE: number, dN: number): number {
  // Returns bearing in DEGREES (0-360, clockwise from north)
  const rad = Math.atan2(dE, dN)
  let deg = rad * 180 / Math.PI
  if (deg < 0) deg += 360
  return deg
}

export function bearingToDMS(deg: number): string {
  const d = Math.floor(deg)
  const mFloat = (deg - d) * 60
  const m = Math.floor(mFloat)
  const s = (mFloat - m) * 60
  return `${d}\u00B0${m}'${s.toFixed(1)}"`
}

export function distance(e1: number, n1: number, e2: number, n2: number): number {
  const dE = e2 - e1
  const dN = n2 - n1
  return Math.sqrt(dE * dE + dN * dN)
}

export function midpoint(e1: number, n1: number, e2: number, n2: number): [number, number] {
  return [(e1 + e2) / 2, (n1 + n2) / 2]
}

// Angle of a segment in degrees (0 = east, 90 = north, -90 = south, 180/-180 = west)
export function segmentAngle(e1: number, n1: number, e2: number, n2: number): number {
  const rad = Math.atan2(e2 - e1, n2 - n1)
  return rad * 180 / Math.PI
}

// Whether text would be upside-down at this angle
// textAngle: pass raw segment angle; if |angle| > 90, add 180
export function textAngleForSegment(e1: number, n1: number, e2: number, n2: number): number {
  let angle = segmentAngle(e1, n1, e2, n2)
  // Keep text readable: if pointing left (|angle| > 90), flip
  if (angle > 90 || angle < -90) {
    angle += 180
  }
  return angle
}

// Offset a point perpendicular to a line by `offsetPx` pixels
export function offsetFromMidpoint(
  e1: number, n1: number, e2: number, n2: number,
  offsetM: number
): [number, number] {
  const dE = e2 - e1
  const dN = n2 - n1
  const len = Math.sqrt(dE * dE + dN * dN)
  // Perpendicular: rotate 90° (swap and negate one component)
  // Positive offset = left of travel direction
  const perpE = -dN / len
  const perpN = dE / len
  const [mx, my] = midpoint(e1, n1, e2, n2)
  return [mx + perpE * offsetM, my + perpN * offsetM]
}

export function centroid(points: Array<{ easting: number; northing: number }>): [number, number] {
  const n = points.length
  if (n === 0) return [0, 0]
  const sumE = points.reduce((s, p) => s + p.easting, 0)
  const sumN = points.reduce((s, p) => s + p.northing, 0)
  return [sumE / n, sumN / n]
}

export function boundingBox(points: Array<{ easting: number; northing: number }>) {
  const eastings = points.map(p => p.easting)
  const northings = points.map(p => p.northing)
  return {
    minE: Math.min(...eastings),
    maxE: Math.max(...eastings),
    minN: Math.min(...northings),
    maxN: Math.max(...northings),
    rangeE: Math.max(...eastings) - Math.min(...eastings),
    rangeN: Math.max(...northings) - Math.min(...northings),
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/reports/surveyPlan/geometry.ts
git commit -m "feat(surveyPlan): add geometry utilities for coordinate transforms"
```

---

## Task 3: SVG Symbols (`src/lib/reports/surveyPlan/symbols.ts`)

**File:** Create: `src/lib/reports/surveyPlan/symbols.ts`
**Purpose:** Pure SVG path/string builders for all drawn elements — monuments, arrows, scale bar, borders. Zero business logic.

- [ ] **Step 1: Write symbol builders**

```typescript
// Colour constants
export const C_BLACK = '#000000'
export const C_GREEN = '#1A6B32'
export const C_RED = '#C0392B'
export const C_GRAY = '#888888'
export const C_GRID_MINOR = '#E0E4EC'
export const C_GRID_MAJOR = '#B0BDD0'
export const C_LOT_FILL = '#F5EDD6'
export const C_WARNING_BG = '#FFF9E6'

// ── Monuments ────────────────────────────────────────────────────────────────

export function svgFoundMonument(cx: number, cy: number): string {
  // Solid green filled square 10x10px
  const s = 5 // half-side
  return `<rect x="${cx - s}" y="${cy - s}" width="10" height="10" fill="${C_GREEN}" stroke="${C_BLACK}" stroke-width="0.5"/>`
}

export function svgSetMonument(cx: number, cy: number): string {
  // Open green circle r=5, stroke 2px
  return `<circle cx="${cx}" cy="${cy}" r="5" fill="none" stroke="${C_GREEN}" stroke-width="2"/>`
}

export function svgMasonryNail(cx: number, cy: number, calloutText?: string): string {
  // Solid red circle r=4 with white crosshair
  const nail = [
    `<circle cx="${cx}" cy="${cy}" r="4" fill="${C_RED}" stroke="${C_BLACK}" stroke-width="0.5"/>`,
    `<line x1="${cx - 3}" y1="${cy}" x2="${cx + 3}" y2="${cy}" stroke="white" stroke-width="0.8"/>`,
    `<line x1="${cx}" y1="${cy - 3}" x2="${cx}" y2="${cy + 3}" stroke="white" stroke-width="0.8"/>`,
  ].join('')

  if (!calloutText) return nail

  // Dashed leader line extending to the right
  const leaderEndX = cx + 30
  const leaderY = cy
  const leader = `<line x1="${cx + 5}" y1="${leaderY}" x2="${leaderEndX}" y2="${leaderY}" stroke="${C_RED}" stroke-width="0.6" stroke-dasharray="2,2"/>`

  // Callout text
  const lines = calloutText.split('\n')
  const textEls = lines.map((line, i) => {
    const yOffset = (i - (lines.length - 1) / 2) * 4
    return `<text x="${leaderEndX + 2}" y="${leaderY + yOffset}" font-family="Share Tech Mono, Courier New" font-size="4.5" fill="${C_RED}">${escapeXml(line)}</text>`
  }).join('')

  return nail + leader + textEls
}

export function svgIronPin(cx: number, cy: number): string {
  // Small solid red circle (smaller than nail)
  return `<circle cx="${cx}" cy="${cy}" r="2.5" fill="${C_RED}" stroke="${C_BLACK}" stroke-width="0.4"/>`
}

export function svgCornerDot(cx: number, cy: number): string {
  // Small filled black circle r=1.5 + open circle r=4
  return [
    `<circle cx="${cx}" cy="${cy}" r="1.5" fill="${C_BLACK}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="4" fill="none" stroke="${C_BLACK}" stroke-width="1.5"/>`,
  ].join('')
}

// ── North Arrow ──────────────────────────────────────────────────────────────

export function svgNorthArrow(x: number, y: number, heightPx: number): string {
  const shaftW = 2
  const shaftH = heightPx * 0.7
  const arrowW = heightPx * 0.35
  const arrowH = heightPx * 0.3

  // Shaft
  const shaft = `<rect x="${x - shaftW / 2}" y="${y}" width="${shaftW}" height="${shaftH}" fill="${C_BLACK}"/>`

  // North arrowhead (filled triangle pointing up)
  const northTipY = y - arrowH
  const northBaseY = y + 2
  const northArrow = `<polygon points="${x},${northTipY} ${x - arrowW / 2},${northBaseY} ${x + arrowW / 2},${northBaseY}" fill="${C_BLACK}"/>`

  // South arrowhead (outlined, pointing down)
  const southBaseY = y + shaftH
  const southTipY = y + shaftH + arrowH
  const southArrow = `<polygon points="${x},${southTipY} ${x - arrowW / 2},${southBaseY} ${x + arrowW / 2},${southBaseY}" fill="none" stroke="${C_BLACK}" stroke-width="1.5"/>`

  // N label
  const nLabel = `<text x="${x}" y="${northTipY - 6}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="11" font-weight="bold" fill="${C_BLACK}">N</text>`

  return shaft + northArrow + southArrow + nLabel
}

// ── Scale Bar ────────────────────────────────────────────────────────────────

export function svgScaleBar(
  x: number, y: number,
  barLengthPx: number,
  segmentMetres: number,
  numSegments: number = 4
): string {
  const segmentW = barLengthPx / numSegments
  const barH = 8
  const labelGap = 6

  const segments: string[] = []
  const labels: string[] = []

  for (let i = 0; i < numSegments; i++) {
    const sx = x + i * segmentW
    const filled = i % 2 === 0
    if (filled) {
      segments.push(`<rect x="${sx}" y="${y}" width="${segmentW}" height="${barH}" fill="${C_BLACK}"/>`)
    } else {
      segments.push(`<rect x="${sx}" y="${y}" width="${segmentW}" height="${barH}" fill="white" stroke="${C_BLACK}" stroke-width="0.8"/>`)
    }

    // Label above each break
    if (i < numSegments) {
      const labelText = (i * segmentMetres).toString()
      const labelX = sx
      labels.push(`<text x="${labelX}" y="${y - labelGap}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="7" fill="${C_BLACK}">${labelText}</text>`)
    }
  }

  // Final label
  labels.push(`<text x="${x + barLengthPx}" y="${y - labelGap}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="7" fill="${C_BLACK}">${numSegments * segmentMetres}</text>`)

  // SCALE and METRES labels below
  const scaleLabel = `<text x="${x}" y="${y + barH + 8}" font-family="Share Tech Mono, Courier New" font-size="7" fill="${C_BLACK}">SCALE</text>`
  const metresLabel = `<text x="${x}" y="${y + barH + 14}" font-family="Share Tech Mono, Courier New" font-size="7" fill="${C_BLACK}">METRES</text>`

  return segments.join('') + labels.join('') + scaleLabel + metresLabel
}

// ── Sheet Border ─────────────────────────────────────────────────────────────

export function svgSheetBorder(
  pageW: number, pageH: number,
  outerInset: number = 5,
  innerInset: number = 10
): string {
  const outer = `rect(x=${outerInset}, y=${outerInset}, w=${pageW - outerInset * 2}, h=${pageH - outerInset * 2}, stroke=2px)`
  const inner = `rect(x=${innerInset}, y=${innerInset}, w=${pageW - innerInset * 2}, h=${pageH - innerInset * 2}, stroke=1px)`
  return [
    `<rect x="${outerInset}" y="${outerInset}" width="${pageW - outerInset * 2}" height="${pageH - outerInset * 2}" fill="none" stroke="${C_BLACK}" stroke-width="2"/>`,
    `<rect x="${innerInset}" y="${innerInset}" width="${pageW - innerInset * 2}" height="${pageH - innerInset * 2}" fill="none" stroke="${C_BLACK}" stroke-width="1"/>`,
  ].join('')
}

// ── Right Panel Divider ──────────────────────────────────────────────────────

export function svgPanelDivider(x: number, pageH: number, topMargin: number, bottomMargin: number): string {
  return `<line x1="${x}" y1="${topMargin}" x2="${x}" y2="${pageH - bottomMargin}" stroke="${C_BLACK}" stroke-width="2"/>`
}

// ── Utility ──────────────────────────────────────────────────────────────────

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export function polylineFromPoints(
  points: Array<{ easting: number; northing: number }>,
  toSvgX: (m: number) => number,
  toSvgY: (m: number) => number,
  close: boolean = true
): string {
  const coords = points.flatMap(p => [toSvgX(p.easting), toSvgY(p.northing)])
  if (close) {
    // Close the polygon
    const first = points[0]
    coords.push(toSvgX(first.easting), toSvgY(first.northing))
  }
  // Group into pairs
  const pairs: string[] = []
  for (let i = 0; i < coords.length; i += 2) {
    pairs.push(`${coords[i]},${coords[i + 1]}`)
  }
  return `<polyline points="${pairs.join(' ')}" fill="none" stroke="${C_BLACK}"/>`
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/reports/surveyPlan/symbols.ts
git commit -m "feat(surveyPlan): add SVG symbol builders (monuments, arrows, scale bar)"
```

---

## Task 4: Renderer (`src/lib/reports/surveyPlan/renderer.ts`)

**File:** Create: `src/lib/reports/surveyPlan/renderer.ts`
**Purpose:** Orchestrates all layers. Returns complete SVG string. Pure TypeScript, zero React.

- [ ] **Step 1: Write the renderer**

The renderer is the most complex file. Key implementation notes:

```typescript
import type { SurveyPlanData, PlanOptions } from './types'
import {
  DPI, PX_PER_MM, PX_PER_M, PAGE_WIDTH_MM, PAGE_HEIGHT_MM,
  STANDARD_SCALES, mmToPx, mToPx, pxToM,
  bearingFromDelta, bearingToDMS, distance, midpoint,
  segmentAngle, textAngleForSegment, offsetFromMidpoint,
  centroid, boundingBox, selectScale, calcScaleLabel, calcScaleBarMetres,
} from './geometry'
import {
  svgFoundMonument, svgSetMonument, svgMasonryNail, svgIronPin,
  svgCornerDot, svgNorthArrow, svgScaleBar,
  svgSheetBorder, svgPanelDivider,
  escapeXml, polylineFromPoints,
  C_BLACK, C_GREEN, C_RED, C_GRAY, C_GRID_MINOR, C_GRID_MAJOR,
  C_LOT_FILL, C_WARNING_BG,
} from './symbols'

export class SurveyPlanRenderer {
  private data: SurveyPlanData
  private opts: Required<PlanOptions>
  
  // Page dimensions in pixels
  private pageW: number
  private pageH: number
  
  // Drawing area (73% left of page)
  private drawingAreaW: number
  private drawingAreaH: number
  private drawingX: number   // left edge of drawing
  private drawingY: number   // top edge of drawing
  
  // Panel (27% right)
  private panelX: number
  private panelW: number
  
  // Margins
  private margin: number = mmToPx(10)   // 10mm margin
  private titleBlockH: number = mmToPx(44) // 44mm footer
  
  // Scale
  private scale: number              // e.g. 500 for 1:500
  private mPerPx: number            // metres per pixel
  
  // Coordinate transforms
  private toSvgX: (m: number) => number
  private toSvgY: (m: number) => number
  
  constructor(data: SurveyPlanData, options?: PlanOptions) {
    this.data = data
    this.opts = {
      paperSize: options?.paperSize ?? 'a3',
      scale: options?.scale ?? 0,  // 0 = auto
      includeGrid: options?.includeGrid ?? true,
      includePanel: options?.includePanel ?? true,
      language: options?.language ?? 'en',
    }
    
    this.pageW = mmToPx(PAGE_WIDTH_MM)
    this.pageH = mmToPx(PAGE_HEIGHT_MM)
    
    // Drawing area: 73% of page width
    this.drawingAreaW = this.pageW * 0.73
    this.drawingAreaH = this.pageH - this.margin * 2 - this.titleBlockH
    this.drawingX = this.margin
    this.drawingY = this.margin
    
    this.panelX = this.drawingX + this.drawingAreaW
    this.panelW = this.pageW - this.panelX - this.margin
    
    // Compute scale and transforms
    this.computeScale()
  }
  
  private computeScale(): void {
    const parcel = this.data.parcel
    const bb = boundingBox(parcel.boundaryPoints)
    const drawingW = this.drawingAreaW - mmToPx(20)  // leave 10mm padding each side
    const drawingH = this.drawingAreaH - mmToPx(20)
    
    if (this.opts.scale > 0) {
      this.scale = this.opts.scale
    } else {
      const scaleByWidth = drawingW / bb.rangeE
      const scaleByHeight = drawingH / bb.rangeN
      const rawScale = Math.min(scaleByWidth, scaleByHeight) * PX_PER_M
      this.scale = STANDARD_SCALES.find(s => s >= rawScale) || 500
    }
    
    this.mPerPx = this.scale / PX_PER_M
    
    // Centre the drawing in the available area
    const paddedW = bb.rangeE * PX_PER_M
    const paddedH = bb.rangeN * PX_PER_M
    const offsetX = (drawingW - paddedW) / 2
    const offsetY = (drawingH - paddedH) / 2
    
    const minE = bb.minE
    const minN = bb.minN
    
    this.toSvgX = (m: number) => this.drawingX + mmToPx(10) + offsetX + (m - minE) * PX_PER_M
    this.toSvgY = (m: number) => this.drawingY + mmToPx(10) + offsetY + (m - minN) * PX_PER_M
  }
  
  // ── Layer Methods ──────────────────────────────────────────────────────────
  
  private drawBackground(): string {
    return `<rect x="0" y="0" width="${this.pageW}" height="${this.pageH}" fill="white"/>`
  }
  
  private drawGrid(): string {
    const parcel = this.data.parcel
    const bb = boundingBox(parcel.boundaryPoints)
    
    // Extend bounds slightly
    const gridMinE = Math.floor(bb.minE / 50) * 50 - 50
    const gridMaxE = Math.ceil(bb.maxE / 50) * 50 + 50
    const gridMinN = Math.floor(bb.minN / 50) * 50 - 50
    const gridMaxN = Math.ceil(bb.maxN / 50) * 50 + 50
    
    let gridSvg = ''
    
    // Minor lines (50m) and major lines (100m)
    for (let e = gridMinE; e <= gridMaxE; e += 50) {
      const x = this.toSvgX(e)
      const isMajor = e % 100 === 0
      const stroke = isMajor ? C_GRID_MAJOR : C_GRID_MINOR
      const width = isMajor ? 0.8 : 0.4
      const dash = isMajor ? 'none' : '2,4'
      gridSvg += `<line x1="${x}" y1="${this.toSvgY(gridMinN)}" x2="${x}" y2="${this.toSvgY(gridMaxN)}" stroke="${stroke}" stroke-width="${width}" stroke-dasharray="${dash}" opacity="0.7"/>`
      
      // Northing tick label (left margin)
      if (isMajor) {
        const lx = this.drawingX - 4
        const ly = this.toSvgY(e) + 3
        gridSvg += `<text x="${lx}" y="${ly}" text-anchor="end" font-family="Share Tech Mono, Courier New" font-size="8" fill="${C_BLACK}" opacity="0.6">${e}</text>`
      }
    }
    
    for (let n = gridMinN; n <= gridMaxN; n += 50) {
      const y = this.toSvgY(n)
      const isMajor = n % 100 === 0
      const stroke = isMajor ? C_GRID_MAJOR : C_GRID_MINOR
      const width = isMajor ? 0.8 : 0.4
      const dash = isMajor ? 'none' : '2,4'
      gridSvg += `<line x1="${this.toSvgX(gridMinE)}" y1="${y}" x2="${this.toSvgX(gridMaxE)}" y2="${y}" stroke="${stroke}" stroke-width="${width}" stroke-dasharray="${dash}" opacity="0.7"/>`
      
      // Easting tick label (bottom margin)
      if (isMajor) {
        const lx = this.toSvgX(n) - 4
        const ly = this.drawingY + this.drawingAreaH + 12
        gridSvg += `<text x="${lx}" y="${ly}" text-anchor="end" font-family="Share Tech Mono, Courier New" font-size="8" fill="${C_BLACK}" opacity="0.6" transform="rotate(-45,${lx},${ly})">${n}</text>`
      }
    }
    
    return gridSvg
  }
  
  private drawLotFill(): string {
    const pts = this.data.parcel.boundaryPoints
    if (pts.length < 3) return ''
    
    const coords = pts.flatMap(p => [this.toSvgX(p.easting), this.toSvgY(p.northing)])
    const pairs = []
    for (let i = 0; i < coords.length; i += 2) {
      pairs.push(`${coords[i]},${coords[i + 1]}`)
    }
    // Close polygon
    pairs.push(`${this.toSvgX(pts[0].easting)},${this.toSvgY(pts[0].northing)}`)
    
    return `<polygon points="${pairs.join(' ')}" fill="${C_LOT_FILL}" stroke="none"/>`
  }
  
  private drawBoundary(): string {
    const pts = this.data.parcel.boundaryPoints
    if (pts.length < 2) return ''
    
    const coords = pts.flatMap(p => [this.toSvgX(p.easting), this.toSvgY(p.northing)])
    // Close
    coords.push(this.toSvgX(pts[0].easting), this.toSvgY(pts[0].northing))
    const pairs = []
    for (let i = 0; i < coords.length; i += 2) {
      pairs.push(`${coords[i]},${coords[i + 1]}`)
    }
    
    return `<polyline points="${pairs.join(' ')}" fill="none" stroke="${C_BLACK}" stroke-width="2.5"/>`
  }
  
  private drawBoundaryLabels(): string {
    const pts = this.data.parcel.boundaryPoints
    let svg = ''
    
    for (let i = 0; i < pts.length; i++) {
      const from = pts[i]
      const to = pts[(i + 1) % pts.length]
      
      const dist = distance(from.easting, from.northing, to.easting, to.northing)
      const bearing = bearingFromDelta(to.easting - from.easting, to.northing - from.northing)
      const [mx, my] = midpoint(from.easting, from.northing, to.easting, to.northing)
      const angle = textAngleForSegment(from.easting, from.northing, to.easting, to.northing)
      
      // Bearing above line (offset 4px perpendicular — convert to metres)
      const [bx, by] = offsetFromMidpoint(from.easting, from.northing, to.easting, to.northing, 4 / PX_PER_M)
      svg += `<text transform="translate(${bx},${by}) rotate(${angle})" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="8.5" font-weight="bold" fill="${C_BLACK}">${bearingToDMS(bearing)}</text>`
      
      // Distance below line (offset 4px perpendicular — convert to metres)
      const [dx, dy] = offsetFromMidpoint(from.easting, from.northing, to.easting, to.northing, 4 / PX_PER_M)
      svg += `<text transform="translate(${dx},${dy}) rotate(${angle})" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="8" fill="${C_BLACK}">${dist.toFixed(2)} m</text>`
    }
    
    return svg
  }
  
  private drawMonuments(): string {
    let svg = ''
    const pts = this.data.parcel.boundaryPoints
    
    for (const pt of pts) {
      const cp = this.data.controlPoints.find(
        cp => cp.name === pt.name || (Math.abs(cp.easting - pt.easting) < 0.01 && Math.abs(cp.northing - pt.northing) < 0.01)
      )
      
      const cx = this.toSvgX(pt.easting)
      const cy = this.toSvgY(pt.northing)
      
      // Always draw corner dot
      svg += svgCornerDot(cx, cy)
      
      if (!cp) continue
      
      switch (cp.monumentType) {
        case 'found':
          svg += svgFoundMonument(cx, cy)
          break
        case 'set':
          svg += svgSetMonument(cx, cy)
          break
        case 'masonry_nail':
          svg += svgMasonryNail(cx, cy, 'Masonry Nail\n1-00 on production\nof boundary')
          break
        case 'iron_pin':
          svg += svgIronPin(cx, cy)
          break
      }
    }
    
    return svg
  }
  
  private drawBuildings(): string {
    return ''
  }
  
  private drawAdjacentLots(): string {
    const lots = this.data.adjacentLots
    if (!lots || lots.length === 0) return ''
    let svg = ''
    for (const lot of lots) {
      if (lot.boundaryPoints.length < 2) continue
      const pts = lot.boundaryPoints
      const coords = pts.flatMap(p => [this.toSvgX(p.easting), this.toSvgY(p.northing)])
      coords.push(this.toSvgX(pts[0].easting), this.toSvgY(pts[0].northing))
      const pairs = []
      for (let i = 0; i < coords.length; i += 2) pairs.push(`${coords[i]},${coords[i + 1]}`)
      svg += `<polyline points="${pairs.join(' ')}" fill="none" stroke="${C_BLACK}" stroke-width="1"/>`
    }
    return svg
  }
  
  private drawAdjacentLabels(): string {
    const lots = this.data.adjacentLots
    if (!lots || lots.length === 0) return ''
    let svg = ''
    for (const lot of lots) {
      const pts = lot.boundaryPoints
      if (pts.length < 2) continue
      const [ce, cn] = centroid(pts)
      // Determine side: check if centroid is to the left or right of the parcel centroid
      const parcelCentroid = centroid(this.data.parcel.boundaryPoints)
      const isLeft = ce < parcelCentroid[0]
      const isTop = cn > parcelCentroid[1]
      const px = this.toSvgX(ce)
      const py = this.toSvgY(cn)
      let transform = ''
      if (isLeft) {
        transform = `transform="translate(${px},${py}) rotate(-90)"`
      } else if (isTop) {
        transform = '' // horizontal
      } else {
        transform = `transform="translate(${px},${py}) rotate(90)"`
      }
      svg += `<text ${transform} x="${px}" y="${py}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="11" font-weight="bold" fill="${C_BLACK}" opacity="0.45">${escapeXml(lot.id)}</text>`
    }
    return svg
  }
  
  private drawLotNumber(): string {
    const pts = this.data.parcel.boundaryPoints
    const [ce, cn] = centroid(pts)
    const id = this.data.project.parcel_id || this.data.project.name || 'LOT'
    
    return `<text x="${this.toSvgX(ce)}" y="${this.toSvgY(cn)}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="28" font-weight="bold" fill="${C_BLACK}" opacity="0.12">${escapeXml(id)}</text>`
  }
  
  private drawAreaLabel(): string {
    const pts = this.data.parcel.boundaryPoints
    const [ce, cn] = centroid(pts)
    const area = this.data.parcel.area_sqm
    
    // Offset area label slightly below centroid
    const [ax, ay] = offsetFromMidpoint(pts[0].easting, pts[0].northing, pts[1].easting, pts[1].northing, 0.4)
    
    const ha = area / 10000
    return [
      `<text x="${ax}" y="${ay}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="11" fill="${C_BLACK}">${area.toFixed(2)} m\u00B2</text>`,
      `<text x="${ax}" y="${ay + 4.5}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="9" fill="${C_BLACK}">${ha.toFixed(4)} ha</text>`,
    ].join('')
  }
  
  private drawNorthArrow(): string {
    const x = this.drawingX + mmToPx(8)
    const y = this.drawingY + mmToPx(8)
    return svgNorthArrow(x, y + 30, mmToPx(10))
  }
  
  private drawScaleBar(): string {
    const scaleBarPx = mmToPx(40)  // 40mm wide scale bar
    const segmentMetres = calcScaleBarMetres(this.scale)
    const x = this.drawingX + mmToPx(8)
    const y = this.drawingY + this.drawingAreaH - mmToPx(15)
    return svgScaleBar(x, y, scaleBarPx, segmentMetres, 4)
  }
  
  private drawSheetBorder(): string {
    return svgSheetBorder(this.pageW, this.pageH)
  }
  
  private drawPanelDivider(): string {
    return svgPanelDivider(this.panelX, this.pageH, this.margin, this.titleBlockH + this.margin)
  }
  
  private drawRightPanel(): string {
    const p = this.data.project
    const leftPad = this.panelX + mmToPx(3)
    const rightPad = this.panelX + this.panelW - mmToPx(3)
    const panelInnerW = this.panelW - mmToPx(6)

    const svgParts: string[] = []
    svgParts.push(this.drawReportHeader(leftPad, rightPad, panelInnerW))
    svgParts.push(this.drawPlanInfoBox(leftPad, rightPad, panelInnerW))
    svgParts.push(this.drawLegend(leftPad, panelInnerW))
    svgParts.push(this.drawWarningBox(leftPad, rightPad, panelInnerW))
    svgParts.push(this.drawCertificate(leftPad, rightPad, panelInnerW))
    svgParts.push(this.drawCompanyFooter(leftPad, rightPad))
    return svgParts.join('')
  }

  private drawReportHeader(leftPad: number, rightPad: number, panelInnerW: number): string {
    const p = this.data.project
    const hasMun = !!p.municipality
    let y = this.margin + mmToPx(4)
    let svg = ''
    const text = (content: string, yPos: number, size: number, weight = 'normal', color = C_BLACK) =>
      `<text x="${leftPad}" y="${yPos}" font-family="Share Tech Mono, Courier New" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(content)}</text>`
    const hline = (y1: number) =>
      `<line x1="${leftPad}" y1="${y1}" x2="${rightPad}" y2="${y1}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += text('SURVEYOR\'S REAL PROPERTY REPORT', y, 5)
    svg += text(p.plan_title || 'BOUNDARY IDENTIFICATION PLAN', y + mmToPx(6), 9, 'bold')
    if (hasMun) svg += text(p.municipality, y + mmToPx(11), 16, 'bold')
    svg += text(`SCALE ${calcScaleLabel(this.scale)}`, y + mmToPx(hasMun ? 18 : 12), 8, 'bold')
    svg += hline(y + mmToPx(hasMun ? 21 : 15))
    svg += text(p.firm_name || '', y + mmToPx(hasMun ? 25 : 19), 8, 'bold')
    svg += text(`© ${new Date().getFullYear()}`, y + mmToPx(hasMun ? 28.5 : 22.5), 6)
    svg += text('Distances shown are in metres.', y + mmToPx(hasMun ? 33 : 27), 5, 'normal', '#555')
    svg += text('Divide by 0.3048 for feet.', y + mmToPx(hasMun ? 36 : 30), 5, 'normal', '#555')
    return svg
  }

  private drawPlanInfoBox(leftPad: number, rightPad: number, panelInnerW: number): string {
    const p = this.data.project
    const hasMun = !!p.municipality
    const startY = this.margin + mmToPx(hasMun ? 40 : 34)
    let y = startY
    let svg = ''
    const box = (yPos: number, h: number) =>
      `<rect x="${leftPad}" y="${yPos}" width="${panelInnerW}" height="${h}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    const row = (label: string, value: string) =>
      `<text x="${leftPad}" y="${y += mmToPx(4)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="#555">${escapeXml(label)}</text><text x="${leftPad + mmToPx(22)}" y="${y}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">${escapeXml(value)}</text>`
    svg += box(y, mmToPx(4))
    svg += `<text x="${leftPad}" y="${y + mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">PLAN INFORMATION</text>`
    y += mmToPx(4)
    const info: Array<[string, string]> = [
      ['Title Ref:', p.reference || '—'],
      ['Datum:', p.datum || 'WGS84'],
      ['UTM Zone:', `${p.utm_zone}${p.hemisphere}`],
      ['Area:', p.area_sqm ? `${p.area_sqm.toFixed(2)} m\u00B2` : '—'],
      ['Council:', p.municipality || '—'],
      ['Client:', p.client_name || '—'],
      ['Drawing No:', p.drawing_no || `MD-${Date.now().toString().slice(-6)}`],
    ]
    for (const [label, value] of info) svg += row(label, value)
    return svg
  }

  private drawLegend(leftPad: number, panelInnerW: number): string {
    const hasMun = !!this.data.project.municipality
    const afterInfo = this.margin + mmToPx(hasMun ? 40 : 34) + mmToPx(7 * 4 + 4 + 6)
    let y = afterInfo
    let svg = ''
    const box = (yPos: number, h: number) =>
      `<rect x="${leftPad}" y="${yPos}" width="${panelInnerW}" height="${h}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += box(y, mmToPx(4))
    svg += `<text x="${leftPad}" y="${y + mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">LEGEND</text>`
    const items = [
      { label: 'Subject boundary', symbol: `<line x1="0" y1="0" x2="20" y2="0" stroke="${C_BLACK}" stroke-width="2.5"/>` },
      { label: 'Adjacent boundary', symbol: `<line x1="0" y1="0" x2="20" y2="0" stroke="${C_BLACK}" stroke-width="1"/>` },
      { label: 'Found monument', symbol: `<rect x="0" y="-3" width="6" height="6" fill="${C_GREEN}" stroke="${C_BLACK}" stroke-width="0.5"/>` },
      { label: 'Set monument', symbol: `<circle cx="3" cy="0" r="3" fill="none" stroke="${C_GREEN}" stroke-width="1.5"/>` },
      { label: 'Masonry Nail', symbol: `<circle cx="3" cy="0" r="2.5" fill="${C_RED}"/>` },
      { label: 'Iron Pin', symbol: `<circle cx="3" cy="0" r="2" fill="${C_RED}" stroke="${C_BLACK}" stroke-width="0.4"/>` },
    ]
    for (const item of items) {
      svg += `<g transform="translate(${leftPad}, ${y += mmToPx(4)})">${item.symbol}</g>`
      svg += `<text x="${leftPad + mmToPx(10)}" y="${y}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(item.label)}</text>`
    }
    return svg
  }

  private drawWarningBox(leftPad: number, rightPad: number, panelInnerW: number): string {
    const hasMun = !!this.data.project.municipality
    const afterLegend = this.margin + mmToPx(hasMun ? 40 : 34) + mmToPx(7 * 4 + 4 + 6) + mmToPx(6 * 4 + 6)
    const y = afterLegend
    let svg = ''
    svg += `<rect x="${leftPad}" y="${y}" width="${panelInnerW}" height="${mmToPx(12)}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<rect x="${leftPad + 0.5}" y="${y + 0.5}" width="${panelInnerW - 1}" height="${mmToPx(12) - 1}" fill="${C_WARNING_BG}"/>`
    const lines = ['WARNING: Fence set-out pegs', 'must be verified on site.', 'Dimensions subject to', 'survey verification.']
    lines.forEach((line, i) => {
      svg += `<text x="${leftPad + mmToPx(2)}" y="${y + mmToPx(3) + i * mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="${i === 0 ? 'bold' : 'normal'}" fill="${C_BLACK}">${escapeXml(line)}</text>`
    })
    return svg
  }

  private drawCertificate(leftPad: number, rightPad: number, panelInnerW: number): string {
    const hasMun = !!this.data.project.municipality
    const afterWarning = this.margin + mmToPx(hasMun ? 40 : 34) + mmToPx(7 * 4 + 4 + 6) + mmToPx(6 * 4 + 6) + mmToPx(12 + 4)
    const y = afterWarning
    const p = this.data.project
    let svg = ''
    svg += `<rect x="${leftPad}" y="${y}" width="${panelInnerW}" height="${mmToPx(2)}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<text x="${leftPad}" y="${y + mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">CERTIFICATE</text>`
    svg += `<text x="${leftPad}" y="${y + mmToPx(7)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">I certify that this plan is correct and in accordance with applicable standards.</text>`
    const sigY = y + mmToPx(11)
    svg += `<line x1="${leftPad}" y1="${sigY}" x2="${leftPad + mmToPx(50)}" y2="${sigY}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<text x="${leftPad}" y="${sigY + mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">${escapeXml(p.surveyor_name || 'The Professional Licensed Surveyor')}</text>`
    if (p.surveyor_licence) svg += `<text x="${leftPad}" y="${sigY + mmToPx(6)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">Licence No: ${escapeXml(p.surveyor_licence)}</text>`
    return svg
  }

  private drawCompanyFooter(leftPad: number, rightPad: number): string {
    const hasMun = !!this.data.project.municipality
    const certY = this.margin + mmToPx(hasMun ? 40 : 34) + mmToPx(7 * 4 + 4 + 6) + mmToPx(6 * 4 + 6) + mmToPx(12 + 4) + mmToPx(20)
    const y = certY
    const p = this.data.project
    let svg = `<line x1="${leftPad}" y1="${y}" x2="${rightPad}" y2="${y}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    if (p.firm_phone) svg += `<text x="${leftPad}" y="${y + mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(p.firm_phone)}</text>`
    if (p.firm_email) svg += `<text x="${leftPad}" y="${y + mmToPx(6)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(p.firm_email)}</text>`
    return svg
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  render(): string {
    const layers: string[] = []
    layers.push(this.drawBackground())
    layers.push(this.drawSheetBorder())
    if (this.opts.includePanel) layers.push(this.drawPanelDivider())
    if (this.opts.includeGrid) layers.push(this.drawGrid())
    layers.push(this.drawLotFill())
    layers.push(this.drawAdjacentLots())
    layers.push(this.drawBoundary())
    layers.push(this.drawBoundaryLabels())
    layers.push(this.drawMonuments())
    layers.push(this.drawLotNumber())
    layers.push(this.drawAreaLabel())
    layers.push(this.drawAdjacentLabels())
    layers.push(this.drawBuildings())
    layers.push(this.drawNorthArrow())
    layers.push(this.drawScaleBar())
    if (this.opts.includePanel) layers.push(this.drawRightPanel())
    layers.push(this.drawSheetFooter())
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.pageW} ${this.pageH}" width="${this.pageW}" height="${this.pageH}" style="font-family: 'Share Tech Mono', 'Courier New', monospace;">${layers.join('\n')}</svg>`
  }

  getScale(): number { return this.scale }
}

