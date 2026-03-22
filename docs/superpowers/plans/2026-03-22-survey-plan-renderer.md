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
    // Helper closures for consistent text rendering
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
    const y = this.margin + mmToPx(4)
    let svg = ''
    const text = (content: string, yPos: number, size: number, weight: string = 'normal', color: string = C_BLACK): string =>
      `<text x="${leftPad}" y="${yPos}" font-family="Share Tech Mono, Courier New" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(content)}</text>`
    const line = (y1: number, y2: number): string =>
      `<line x1="${leftPad}" y1="${y1}" x2="${rightPad}" y2="${y2}" stroke="${C_BLACK}" stroke-width="0.5"/>`

    svg += text('SURVEYOR\'S REAL PROPERTY REPORT', y, 5)
    svg += text(p.plan_title || 'BOUNDARY IDENTIFICATION PLAN', y + mmToPx(6), 9, 'bold')
    if (p.municipality) svg += text(p.municipality, y + mmToPx(11), 16, 'bold')
    svg += text(`SCALE ${calcScaleLabel(this.scale)}`, y + mmToPx(p.municipality ? 18 : 12), 8, 'bold')
    svg += line(y + mmToPx(p.municipality ? 21 : 15), y + mmToPx(p.municipality ? 21.5 : 15.5))
    svg += text(p.firm_name || '', y + mmToPx(p.municipality ? 25 : 19), 8, 'bold')
    svg += text(`© ${new Date().getFullYear()}`, y + mmToPx(p.municipality ? 28.5 : 22.5), 6)
    svg += text('Distances shown are in metres.', y + mmToPx(p.municipality ? 33 : 27), 5, 'normal', '#555')
    svg += text('Divide by 0.3048 for feet.', y + mmToPx(p.municipality ? 36 : 30), 5, 'normal', '#555')
    return svg
  }

  private drawPlanInfoBox(leftPad: number, rightPad: number, panelInnerW: number): string {
    const p = this.data.project
    const startY = this.margin + mmToPx(p.municipality ? 40 : 34)
    let y = startY
    let svg = ''
    const box = (yPos: number, h: number) =>
      `<rect x="${leftPad}" y="${yPos}" width="${panelInnerW}" height="${h}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    const text = (label: string, value: string, yPos: number): string => {
      const labelW = mmToPx(22)
      return [
        `<text x="${leftPad}" y="${yPos}" font-family="Share Tech Mono, Courier New" font-size="5" fill="#555">${escapeXml(label)}</text>`,
        `<text x="${leftPad + labelW}" y="${yPos}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">${escapeXml(value)}</text>`,
      ].join('')
    }

    svg += box(y, mmToPx(4))
    svg += `<text x="${leftPad}" y="${y + mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">PLAN INFORMATION</text>`
    y += mmToPx(4)
    const info = [
      ['Title Ref:', p.reference || '—'],
      ['Datum:', p.datum || 'WGS84'],
      ['UTM Zone:', `${p.utm_zone}${p.hemisphere}`],
      ['Area:', p.area_sqm ? `${p.area_sqm.toFixed(2)} m\u00B2` : '—'],
      ['Council:', p.municipality || '—'],
      ['Client:', p.client_name || '—'],
      ['Drawing No:', p.drawing_no || `MD-${Date.now().toString().slice(-6)}`],
    ]
    for (const [label, value] of info) {
      svg += text(label, value, y += mmToPx(4))
    }
    return svg
  }

  private drawLegend(leftPad: number, panelInnerW: number): string {
    const afterInfo = this.margin + mmToPx(this.data.project.municipality ? 40 : 34) + mmToPx(7 * 4 + 4 + 6)
    let y = afterInfo
    let svg = ''
    const box = (yPos: number, h: number) =>
      `<rect x="${leftPad}" y="${yPos}" width="${panelInnerW}" height="${h}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += box(y, mmToPx(4))
    svg += `<text x="${leftPad}" y="${y + mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">LEGEND</text>`
    const legendItems = [
      { label: 'Subject boundary', symbol: `<line x1="0" y1="0" x2="20" y2="0" stroke="${C_BLACK}" stroke-width="2.5"/>` },
      { label: 'Adjacent boundary', symbol: `<line x1="0" y1="0" x2="20" y2="0" stroke="${C_BLACK}" stroke-width="1"/>` },
      { label: 'Found monument', symbol: `<rect x="0" y="-3" width="6" height="6" fill="${C_GREEN}" stroke="${C_BLACK}" stroke-width="0.5"/>` },
      { label: 'Set monument', symbol: `<circle cx="3" cy="0" r="3" fill="none" stroke="${C_GREEN}" stroke-width="1.5"/>` },
      { label: 'Masonry Nail', symbol: `<circle cx="3" cy="0" r="2.5" fill="${C_RED}"/>` },
    ]
    for (const item of legendItems) {
      svg += `<g transform="translate(${leftPad}, ${y += mmToPx(4)})">${item.symbol}</g>`
      svg += `<text x="${leftPad + mmToPx(10)}" y="${y}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(item.label)}</text>`
    }
    return svg
  }

  private drawWarningBox(leftPad: number, rightPad: number, panelInnerW: number): string {
    const afterLegend = this.margin + mmToPx(this.data.project.municipality ? 40 : 34) + mmToPx(7 * 4 + 4 + 6) + mmToPx(5 * 4 + 6)
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
    const afterWarning = this.margin + mmToPx(this.data.project.municipality ? 40 : 34) + mmToPx(7 * 4 + 4 + 6) + mmToPx(5 * 4 + 6) + mmToPx(12 + 4)
    const y = afterWarning
    const p = this.data.project
    let svg = ''
    svg += `<rect x="${leftPad}" y="${y}" width="${panelInnerW}" height="${mmToPx(2)}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<text x="${leftPad}" y="${y + mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">CERTIFICATE</text>`
    svg += `<text x="${leftPad}" y="${y + mmToPx(7)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">I certify that this plan is</text>`
    svg += `<text x="${leftPad}" y="${y + mmToPx(10)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">correct and in accordance</text>`
    svg += `<text x="${leftPad}" y="${y + mmToPx(13)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">with applicable standards.</text>`
    const sigY = y + mmToPx(18)
    svg += `<line x1="${leftPad}" y1="${sigY}" x2="${leftPad + mmToPx(50)}" y2="${sigY}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<text x="${leftPad}" y="${sigY + mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">${escapeXml(p.surveyor_name || 'The Professional Licensed Surveyor')}</text>`
    if (p.surveyor_licence) {
      svg += `<text x="${leftPad}" y="${sigY + mmToPx(6)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">Licence No: ${escapeXml(p.surveyor_licence)}</text>`
    }
    return svg
  }

  private drawCompanyFooter(leftPad: number, rightPad: number): string {
    const p = this.data.project
    // Position below certificate
    const certY = this.margin + mmToPx(this.data.project.municipality ? 40 : 34) + mmToPx(7 * 4 + 4 + 6) + mmToPx(5 * 4 + 6) + mmToPx(12 + 4) + mmToPx(25)
    const y = certY
    let svg = ''
    svg += `<line x1="${leftPad}" y1="${y}" x2="${rightPad}" y2="${y}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    if (p.firm_phone) svg += `<text x="${leftPad}" y="${y + mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(p.firm_phone)}</text>`
    if (p.firm_email) svg += `<text x="${leftPad}" y="${y + mmToPx(6)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(p.firm_email)}</text>`
    return svg
  }
    
    // 4. Scale text
    svg += text(`SCALE ${calcScaleLabel(this.scale)}`, leftPad, y += mmToPx(6), 8, 'bold')
    
    // Horizontal rule
    svg += line(leftPad, y += mmToPx(3), rightPad, y)
    
    // 5. Company name + year
    svg += text(p.firm_name || '', leftPad, y += mmToPx(4), 8, 'bold')
    svg += text(`© ${new Date().getFullYear()}`, leftPad, y += mmToPx(3.5), 6)
    
    // 6. Metric conversion note
    svg += text('Distances shown are in metres.', leftPad, y += mmToPx(5), 5, 'normal', '#555')
    svg += text('Divide by 0.3048 for feet.', leftPad, y += mmToPx(3), 5, 'normal', '#555')
    
    // 7. Plan Information box
    svg += box(leftPad, y += mmToPx(4), panelInnerW, mmToPx(2))
    svg += text('PLAN INFORMATION', leftPad, y += mmToPx(3.5), 5, 'bold')
    const info = [
      ['Title Ref:', p.reference || '—'],
      ['Datum:', p.datum || 'WGS84'],
      ['UTM Zone:', `${p.utm_zone}${p.hemisphere}`],
      ['Area:', p.area_sqm ? `${p.area_sqm.toFixed(2)} m\u00B2` : '—'],
      ['Client:', p.client_name || '—'],
      ['Drawing No:', p.drawing_no || `MD-${Date.now().toString().slice(-6)}`],
    ]
    for (const [label, value] of info) {
      svg += text(label, leftPad, y += mmToPx(4), 5, 'normal', '#555')
      svg += text(value, leftPad + mmToPx(25), y, 5, 'bold')
    }
    
    // 8. Legend
    svg += box(leftPad, y += mmToPx(4), panelInnerW, mmToPx(2))
    svg += text('LEGEND', leftPad, y += mmToPx(3.5), 5, 'bold')
    
    const legendItems = [
      { label: 'Subject boundary', symbol: `<line x1="0" y1="0" x2="20" y2="0" stroke="${C_BLACK}" stroke-width="2.5"/>` },
      { label: 'Adjacent boundary', symbol: `<line x1="0" y1="0" x2="20" y2="0" stroke="${C_BLACK}" stroke-width="1"/>` },
      { label: 'Found monument', symbol: `<rect x="0" y="-3" width="6" height="6" fill="${C_GREEN}" stroke="${C_BLACK}" stroke-width="0.5"/>` },
      { label: 'Set monument', symbol: `<circle cx="3" cy="0" r="3" fill="none" stroke="${C_GREEN}" stroke-width="1.5"/>` },
      { label: 'Masonry Nail', symbol: `<circle cx="3" cy="0" r="2.5" fill="${C_RED}"/>` },
    ]
    for (const item of legendItems) {
      svg += `<g transform="translate(${leftPad}, ${y += mmToPx(4)})">${item.symbol}</g>`
      svg += text(item.label, leftPad + mmToPx(10), y, 5)
    }
    
    // 9. Warning box
    svg += box(leftPad, y += mmToPx(4), panelInnerW, mmToPx(10), 0.5)
    svg += `<rect x="${leftPad + 0.5}" y="${y + 0.5}" width="${panelInnerW - 1}" height="${mmToPx(10) - 1}" fill="${C_WARNING_BG}"/>`
    svg += text('WARNING: Fence set-out pegs', leftPad + mmToPx(2), y += mmToPx(3), 5, 'bold')
    svg += text('must be verified on site.', leftPad + mmToPx(2), y += mmToPx(3), 5, 'bold')
    svg += text('Dimensions subject to', leftPad + mmToPx(2), y += mmToPx(3), 5)
    svg += text('survey verification.', leftPad + mmToPx(2), y += mmToPx(3), 5)
    
    // 10. Surveyor's Certificate
    svg += box(leftPad, y += mmToPx(3), panelInnerW, mmToPx(2))
    svg += text('CERTIFICATE', leftPad, y += mmToPx(3.5), 5, 'bold')
    svg += text('I certify that this plan is', leftPad, y += mmToPx(4), 5)
    svg += text('correct and in accordance', leftPad, y += mmToPx(3), 5)
    svg += text('with applicable standards.', leftPad, y += mmToPx(3), 5)
    
    // Signature line
    svg += line(leftPad, y += mmToPx(5), leftPad + mmToPx(50), y, 0.5)
    svg += text(p.surveyor_name || 'The Professional Licensed Surveyor', leftPad, y += mmToPx(3), 5, 'bold')
    if (p.surveyor_licence) {
      svg += text(`Licence No: ${p.surveyor_licence}`, leftPad, y += mmToPx(3), 5)
    }
    
    // 11. Company footer in panel
    svg += line(leftPad, y += mmToPx(5), rightPad, y)
    if (p.firm_phone) svg += text(p.firm_phone, leftPad, y += mmToPx(3), 5)
    if (p.firm_email) svg += text(p.firm_email, leftPad, y += mmToPx(3), 5)
    
    return svg
  }
  
  private drawSheetFooter(): string {
    const footerY = this.pageH - this.titleBlockH
    const footerH = this.titleBlockH
    
    let svg = `<rect x="${this.margin}" y="${footerY}" width="${this.pageW - this.margin * 2}" height="${footerH}" fill="#F8F8F8"/>`
    svg += `<line x1="${this.margin}" y1="${footerY}" x2="${this.pageW - this.margin}" y2="${footerY}" stroke="${C_BLACK}" stroke-width="2"/>`
    
    const p = this.data.project
    const cols = 8
    const colW = (this.pageW - this.margin * 2) / cols
    
    const fields = [
      ['Field', ''],
      ['Drawing', p.drawing_no || `MD-${Date.now().toString().slice(-6)}`],
      ['Checked', ''],
      ['Address', p.firm_address || ''],
      ['Date', new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
      ['Work Order', ''],
      ['Job No.', p.reference || ''],
      [p.firm_name || 'METARDU', ''],
    ]
    
    let x = this.margin
    for (let i = 0; i < cols; i++) {
      const [label, value] = fields[i] || ['', '']
      const cx = x + colW / 2
      svg += `<line x1="${x}" y1="${footerY}" x2="${x}" y2="${footerY + footerH}" stroke="${C_BLACK}" stroke-width="0.5"/>`
      
      if (i === cols - 1) {
        // Last column: company name, dark background
        svg += `<rect x="${x}" y="${footerY}" width="${colW}" height="${footerH}" fill="${C_BLACK}"/>`
        svg += `<text x="${cx}" y="${footerY + footerH / 2 + 4}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="11" font-weight="bold" fill="white">${escapeXml(label)}</text>`
      } else {
        svg += `<text x="${cx}" y="${footerY + mmToPx(4)}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="5" fill="#555">${escapeXml(label)}</text>`
        svg += `<text x="${cx}" y="${footerY + mmToPx(10)}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="7" font-weight="bold" fill="${C_BLACK}">${escapeXml(value)}</text>`
      }
      x += colW
    }
    
    return svg
  }
  
  // ── Public API ─────────────────────────────────────────────────────────────
  
  render(): string {
    const layers: string[] = []
    
    layers.push(this.drawBackground())
    layers.push(this.drawSheetBorder())
    
    if (this.opts.includePanel) {
      layers.push(this.drawPanelDivider())
    }
    
    if (this.opts.includeGrid) {
      layers.push(this.drawGrid())
    }
    
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
    
    if (this.opts.includePanel) {
      layers.push(this.drawRightPanel())
    }
    
    layers.push(this.drawSheetFooter())
    
    const svgContent = layers.join('\n')
    
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.pageW} ${this.pageH}" width="${this.pageW}" height="${this.pageH}" style="font-family: 'Share Tech Mono', 'Courier New', monospace;">${svgContent}</svg>`
  }
  
  getScale(): number { return this.scale }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/reports/surveyPlan/renderer.ts
git commit -m "feat(surveyPlan): add SurveyPlanRenderer class with all drawing layers"
```

---

## Task 5: Viewer Component (`src/components/SurveyPlanViewer.tsx`)

**File:** Create: `src/components/SurveyPlanViewer.tsx`

- [ ] **Step 1: Write the viewer**

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import type { SurveyPlanData, PlanOptions } from '@/lib/reports/surveyPlan/types'
import { SurveyPlanRenderer } from '@/lib/reports/surveyPlan/renderer'

interface SurveyPlanViewerProps {
  data: SurveyPlanData
  options?: PlanOptions
  className?: string
}

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 4.0]

export default function SurveyPlanViewer({ data, options, className = '' }: SurveyPlanViewerProps) {
  const [scale, setScale] = useState(1.0)
  const [svgContent, setSvgContent] = useState('')
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const renderer = new SurveyPlanRenderer(data, options)
      setSvgContent(renderer.render())
    } catch (e) {
      console.error('Survey plan render error:', e)
      setSvgContent('')
    } finally {
      setLoading(false)
    }
  }, [data, options])

  const zoomIn = () => {
    const idx = ZOOM_LEVELS.findIndex(z => z > scale)
    if (idx !== -1) setScale(ZOOM_LEVELS[idx])
  }

  const zoomOut = () => {
    const idx = ZOOM_LEVELS.findLastIndex(z => z < scale)
    if (idx !== -1) setScale(ZOOM_LEVELS[idx])
  }

  const fitToWidth = () => {
    if (!containerRef.current) return
    setScale(1.0)
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <button
          onClick={zoomOut}
          disabled={scale <= ZOOM_LEVELS[0]}
          className="px-2 py-1 text-sm rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30"
        >
          −
        </button>
        <span className="text-xs font-mono min-w-[48px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={zoomIn}
          disabled={scale >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
          className="px-2 py-1 text-sm rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30"
        >
          +
        </button>
        <button
          onClick={fitToWidth}
          className="px-2 py-1 text-xs rounded hover:bg-[var(--bg-tertiary)] border border-[var(--border)]"
        >
          Fit
        </button>
        <div className="flex-1" />
        {svgContent && (
          <a
            href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`}
            download={`${data.project.name.replace(/\s+/g, '_')}_Plan.svg`}
            className="px-3 py-1 text-xs rounded bg-[var(--accent)] text-black font-medium hover:opacity-80"
          >
            Download SVG
          </a>
        )}
      </div>

      {/* SVG Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-[#e8e8e8] p-4"
        style={{ cursor: 'grab' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
            Generating plan...
          </div>
        ) : svgContent ? (
          <div
            className="shadow-lg mx-auto"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              width: 'fit-content',
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
            No plan data available
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SurveyPlanViewer.tsx
git commit -m "feat(surveyPlan): add SurveyPlanViewer component with zoom controls"
```

---

## Task 6: Export Component (`src/components/SurveyPlanExport.tsx`)

**File:** Create: `src/components/SurveyPlanExport.tsx`

- [ ] **Step 1: Write the export component**

```tsx
'use client'

import { useState } from 'react'
import type { SurveyPlanData, PlanOptions } from '@/lib/reports/surveyPlan/types'
import { SurveyPlanRenderer } from '@/lib/reports/surveyPlan/renderer'

interface SurveyPlanExportProps {
  data: SurveyPlanData
  options?: PlanOptions
}

export default function SurveyPlanExport({ data, options }: SurveyPlanExportProps) {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      // Render SVG
      const renderer = new SurveyPlanRenderer(data, options)
      const svgString = renderer.render()

      // Create a temporary div with the SVG
      const container = document.createElement('div')
      container.innerHTML = svgString
      const svgEl = container.querySelector('svg')
      if (!svgEl) throw new Error('SVG element not found')

      // Dynamic import of svg2pdf (browser-only)
      const [{ default: Svg2Pdf }, { jsPDF }] = await Promise.all([
        import('svg2pdf.js'),
        import('jspdf'),
      ])

      // A3 landscape dimensions in mm
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a3',
      })

      // Add SVG to PDF
      await pdf.addSvg(svgEl, 0, 0, { width: 420, height: 297 })

      // Generate filename
      const date = new Date().toISOString().slice(0, 10)
      const filename = `${data.project.name.replace(/\s+/g, '_')}_Survey_Plan_${date}.pdf`

      pdf.save(filename)
    } catch (err) {
      console.error('PDF export error:', err)
      alert('Failed to export PDF. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-black rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
    >
      {exporting ? (
        <>
          <span className="animate-spin inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
          Generating...
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          Download PDF
        </>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SurveyPlanExport.tsx
git commit -m "feat(surveyPlan): add PDF export component with svg2pdf.js"
```

---

## Task 7: Integration — Documents Page (`src/app/project/[id]/documents/page.tsx`)

**File:** Modify: `src/app/project/[id]/documents/page.tsx`

- [ ] **Step 1: Read the current file**

```bash
head -50 src/app/project/[id]/documents/page.tsx
```

- [ ] **Step 2: Add Survey Plan tab**

Add a new tab button "Survey Plan" and a corresponding tab panel that renders `<SurveyPlanViewer>` with project data and `<SurveyPlanExport>` below it. Data sources:
- `parcel.boundaryPoints` → from parcel state
- `controlPoints` → from survey points where `is_control = true`
- Project metadata → from project store
- Surveyor details → from user profile

The exact implementation depends on how the documents page currently manages tabs. Add a tab and content section like the existing tabs.

- [ ] **Step 3: Commit**

```bash
git add src/app/project/[id]/documents/page.tsx
git commit -m "feat(surveyPlan): integrate viewer and export into documents page"
```

---

## Task 8: Delete Old Generator

**File:** Delete: `src/lib/reports/surveyPlan.ts`

- [ ] **Step 1: Delete the old file**

```bash
rm src/lib/reports/surveyPlan.ts
git add -A
git commit -m "refactor(surveyPlan): remove old jsPDF-only generator, replaced by SVG renderer"
```

---

## Task 9: Unit Tests

**File:** Create: `src/lib/reports/surveyPlan/__tests__/renderer.test.ts`

- [ ] **Step 1: Write tests for geometry utilities**

```typescript
import {
  bearingFromDelta, bearingToDMS, distance, midpoint,
  segmentAngle, textAngleForSegment, offsetFromMidpoint,
  centroid, boundingBox, selectScale, calcScaleLabel, calcScaleBarMetres,
} from '../geometry'

describe('bearingFromDelta', () => {
  it('north = 0°', () => {
    expect(bearingFromDelta(0, 10)).toBeCloseTo(0, 1)
  })
  it('east = 90°', () => {
    expect(bearingFromDelta(10, 0)).toBeCloseTo(90, 1)
  })
  it('south = 180°', () => {
    expect(bearingFromDelta(0, -10)).toBeCloseTo(180, 1)
  })
  it('west = 270°', () => {
    expect(bearingFromDelta(-10, 0)).toBeCloseTo(270, 1)
  })
  it('NE = 45°', () => {
    expect(bearingFromDelta(10, 10)).toBeCloseTo(45, 1)
  })
})

describe('bearingToDMS', () => {
  it('formats 42°15\'30"', () => {
    expect(bearingToDMS(42.25833)).toBe('42°15\'30.0"')
  })
  it('formats 0°0\'0"', () => {
    expect(bearingToDMS(0)).toBe('0°0\'0.0"')
  })
})

describe('distance', () => {
  it('100m east-west', () => {
    expect(distance(1000, 2000, 1100, 2000)).toBeCloseTo(100, 3)
  })
  it('50m diagonal', () => {
    expect(distance(0, 0, 35.36, 35.36)).toBeCloseTo(50, 1)
  })
})

describe('selectScale', () => {
  it('selects 500 for small drawings', () => {
    expect(selectScale(1000, 2)).toBe(500) // 500 px/m → 1:500
  })
  it('selects next scale up if raw is too large', () => {
    expect(selectScale(500, 2)).toBe(1000)
  })
})
```

- [ ] **Step 2: Write tests for renderer output**

```typescript
import { SurveyPlanRenderer } from '../renderer'
import type { SurveyPlanData } from '../types'

const mockData: SurveyPlanData = {
  project: {
    name: 'Test Survey',
    location: 'Nairobi',
    municipality: 'Nairobi County',
    utm_zone: 37,
    hemisphere: 'S',
    datum: 'WGS84',
    client_name: 'Test Client',
    surveyor_name: 'J. Doe',
    surveyor_licence: 'LS/2024/001',
    firm_name: 'Metro Surveyors',
    firm_address: '1 Survey St, Nairobi',
    firm_phone: '+254 700 000 000',
    firm_email: 'survey@metro.co.ke',
    drawing_no: 'MD-2024-001',
    reference: 'REF/2024/TEST',
    plan_title: 'Boundary Identification Plan',
    area_sqm: 5000,
    area_ha: 0.5,
    parcel_id: 'LR 12345',
  },
  parcel: {
    boundaryPoints: [
      { name: '1', easting: 5000, northing: 5000 },
      { name: '2', easting: 5100, northing: 5000 },
      { name: '3', easting: 5100, northing: 5050 },
      { name: '4', easting: 5000, northing: 5050 },
    ],
    area_sqm: 5000,
    perimeter_m: 200,
  },
  controlPoints: [
    { name: '1', easting: 5000, northing: 5000, monumentType: 'found' },
    { name: '2', easting: 5100, northing: 5000, monumentType: 'set' },
    { name: '3', easting: 5100, northing: 5050, monumentType: 'masonry_nail' },
    { name: '4', easting: 5000, northing: 5050, monumentType: 'iron_pin' },
  ],
}

describe('SurveyPlanRenderer', () => {
  it('produces valid SVG', () => {
    const renderer = new SurveyPlanRenderer(mockData)
    const svg = renderer.render()
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('viewBox')
  })

  it('includes lot fill', () => {
    const renderer = new SurveyPlanRenderer(mockData)
    const svg = renderer.render()
    expect(svg).toContain('#F5EDD6')
  })

  it('includes boundary labels', () => {
    const renderer = new SurveyPlanRenderer(mockData)
    const svg = renderer.render()
    // Check bearing labels are present
    expect(svg).toContain('\u00B0') // degree symbol
    expect(svg).toContain("m")       // distance labels
  })

  it('includes monument symbols', () => {
    const renderer = new SurveyPlanRenderer(mockData)
    const svg = renderer.render()
    expect(svg).toContain('#1A6B32') // green monument color
    expect(svg).toContain('#C0392B') // red nail color
  })

  it('includes scale bar', () => {
    const renderer = new SurveyPlanRenderer(mockData)
    const svg = renderer.render()
    expect(svg).toContain('SCALE')
    expect(svg).toContain('METRES')
  })

  it('includes north arrow', () => {
    const renderer = new SurveyPlanRenderer(mockData)
    const svg = renderer.render()
    expect(svg).toContain('>N<')
  })

  it('includes right panel', () => {
    const renderer = new SurveyPlanRenderer(mockData)
    const svg = renderer.render()
    expect(svg).toContain('SURVEYOR')
    expect(svg).toContain('BOUNDARY IDENTIFICATION PLAN')
  })

  it('includes footer', () => {
    const renderer = new SurveyPlanRenderer(mockData)
    const svg = renderer.render()
    expect(svg).toContain('F8F8F8') // footer background
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --testPathPattern="surveyPlan" --verbose
```

All tests must pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/surveyPlan/__tests__/renderer.test.ts
git commit -m "test(surveyPlan): add unit tests for renderer and geometry"
```

---

## Task 10: Build Verification

- [ ] **Step 1: Run build**

```bash
npm run build
```

Must pass with zero errors.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

322 existing tests + new tests must all pass.

- [ ] **Step 3: Push**

```bash
git push
```

---

## Task 11: Post-Implementation Review

After build passes, verify visually:
1. Navigate to a project → Documents → Survey Plan tab
2. Confirm the SVG renders with: lot polygon, boundary lines, bearings, monuments, north arrow, scale bar, right panel, footer
3. Test PDF export — open the downloaded PDF and verify it's A3 landscape
4. Zoom in/out works

If any layer is missing or wrong, fix before declaring complete.
