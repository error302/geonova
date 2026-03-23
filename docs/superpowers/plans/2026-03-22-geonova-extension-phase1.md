# GEONOVA Extension — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GEONOVA professional features to the existing METARDU SVG survey plan renderer — Phase 1. All new features are additions; do NOT modify or refactor existing working code.

**Architecture:** Pure TypeScript additions to existing files. New private methods on `SurveyPlanRenderer`. New types in `types.ts`. New geometry helpers in `geometry.ts`. New tests in `__tests__/`.

**Tech Stack:** TypeScript, SVG, existing test suite (Jest)

**Rule: ADDITIONS ONLY.** Do not modify existing working methods. If code currently renders correctly, leave it alone.

---

## File Structure

```
src/lib/reports/surveyPlan/
  types.ts         # ADD: new types for GEONOVA features
  geometry.ts      # ADD: bearing format fix, shoelace area, CSV parse, rotation
  symbols.ts       # ADD: fence style SVG generators, arrowheads, masonry nail callout
  renderer.ts      # ADD: new draw*() methods, bearing label fix, bearing schedule, etc.
  __tests__/
    geometry.test.ts  # ADD: new geometry tests
    renderer.test.ts   # ADD: new renderer tests

src/app/tools/survey-plan-demo/page.tsx  # UPDATE: new mock data for new types
src/app/project/[id]/documents/page.tsx  # UPDATE: buildSurveyPlanData() with new fields
```

---

## Task 1: Fix Bearing Format + Add Geometry Helpers

**Files:**
- Modify: `src/lib/reports/surveyPlan/geometry.ts`
- Modify: `src/lib/reports/surveyPlan/__tests__/geometry.test.ts`

**Note:** The existing `bearingToDMS` produces `85°9'0.0"` but the professional standard is `085°09'00.0"` (3-digit degrees, 2-digit minutes and seconds). The existing `formatBearingDegMinSec` function doesn't exist yet — create it. Keep `bearingToDMS` for backwards compat but add the correctly-formatted version.

- [ ] **Step 1: Add `formatBearingDegMinSec` function to geometry.ts**

```typescript
export function formatBearingDegMinSec(deg: number): string {
  const d = Math.floor(deg)
  const mFloat = (deg - d) * 60
  const m = Math.floor(mFloat)
  const s = (mFloat - m) * 60
  return `${String(d).padStart(3,'0')}°${String(m).padStart(2,'0')}'${s.toFixed(1).padStart(4,'0')}"`
}
```

- [ ] **Step 2: Add `shoelaceArea` function to geometry.ts**

```typescript
export function shoelaceArea(points: Array<{ easting: number; northing: number }>): number {
  let a = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    a += points[i].easting * points[j].northing - points[j].easting * points[i].northing
  }
  return Math.abs(a) / 2
}
```

- [ ] **Step 3: Add `shoelacePerimeter` function to geometry.ts**

```typescript
export function shoelacePerimeter(points: Array<{ easting: number; northing: number }>): number {
  let p = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    const dx = points[j].easting - points[i].easting
    const dy = points[j].northing - points[i].northing
    p += Math.sqrt(dx * dx + dy * dy)
  }
  return p
}
```

- [ ] **Step 4: Add `rotatePoints` function to geometry.ts**

```typescript
export function rotatePoints(
  points: Array<{ easting: number; northing: number }>,
  angleDeg: number,
  cx?: number, cy?: number
): Array<{ easting: number; northing: number }> {
  const rad = angleDeg * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  let mx = 0, my = 0
  if (cx !== undefined && cy !== undefined) {
    mx = cx; my = cy
  } else {
    for (const p of points) { mx += p.easting; my += p.northing }
    mx /= points.length; my /= points.length
  }
  return points.map(p => ({
    easting: cos * (p.easting - mx) - sin * (p.northing - my) + mx,
    northing: sin * (p.easting - mx) + cos * (p.northing - my) + my,
  }))
}
```

- [ ] **Step 5: Add `parseCornersCSV` function to geometry.ts**

```typescript
export function parseCornersCSV(csv: string): Array<{ name: string; easting: number; northing: number }> {
  const lines = csv.trim().split('\n').map(l => l.trim()).filter(Boolean)
  const result: Array<{ name: string; easting: number; northing: number }> = []
  for (const line of lines) {
    const parts = line.split(/[,\t]+/)
    if (parts.length < 3) continue
    const name = parts[0].trim()
    const e = parseFloat(parts[1].trim())
    const n = parseFloat(parts[2].trim())
    if (!name || isNaN(e) || isNaN(n)) continue
    if (result.length === 0 && isNaN(parseFloat(name))) continue // skip header
    result.push({ name, easting: e, northing: n })
  }
  if (result.length < 3) throw new Error('CSV must have at least 3 valid corner rows')
  return result
}
```

- [ ] **Step 6: Add tests for new geometry functions**

Add to `src/lib/reports/surveyPlan/__tests__/geometry.test.ts`:

```typescript
describe('formatBearingDegMinSec', () => {
  it('pads degrees to 3 digits and minutes/seconds to 2', () => {
    expect(formatBearingDegMinSec(0)).toBe('000°00\'00.0"')
    expect(formatBearingDegMinSec(85.15)).toBe('085°09\'00.0"')
    expect(formatBearingDegMinSec(175.5075)).toBe('175°30\'27.0"')
    expect(formatBearingDegMinSec(359.999)).toBe('359°59\'56.4"')
  })
})

describe('shoelaceArea', () => {
  it('computes area of unit square as 1', () => {
    const pts = [
      { easting: 0, northing: 0 },
      { easting: 1, northing: 0 },
      { easting: 1, northing: 1 },
      { easting: 0, northing: 1 },
    ]
    expect(shoelaceArea(pts)).toBeCloseTo(1, 4)
  })
  it('computes area of triangle', () => {
    const pts = [
      { easting: 0, northing: 0 },
      { easting: 6, northing: 0 },
      { easting: 0, northing: 8 },
    ]
    expect(shoelaceArea(pts)).toBeCloseTo(24, 4)
  })
})

describe('shoelacePerimeter', () => {
  it('computes perimeter of unit square', () => {
    const pts = [
      { easting: 0, northing: 0 },
      { easting: 1, northing: 0 },
      { easting: 1, northing: 1 },
      { easting: 0, northing: 1 },
    ]
    expect(shoelacePerimeter(pts)).toBeCloseTo(4, 4)
  })
})

describe('rotatePoints', () => {
  it('rotates a point 90 degrees around origin', () => {
    const pts = [{ easting: 1, northing: 0 }]
    const rotated = rotatePoints(pts, 90)
    expect(rotated[0].easting).toBeCloseTo(0, 4)
    expect(rotated[0].northing).toBeCloseTo(1, 4)
  })
  it('rotates around centroid by default', () => {
    const pts = [{ easting: 2, northing: 0 }]
    const rotated = rotatePoints(pts, 90)
    expect(rotated[0].easting).toBeCloseTo(0, 4)
    expect(rotated[0].northing).toBeCloseTo(2, 4)
  })
  it('rotates around given center', () => {
    const pts = [{ easting: 2, northing: 0 }]
    const rotated = rotatePoints(pts, 90, 1, 0)
    expect(rotated[0].easting).toBeCloseTo(1, 4)
    expect(rotated[0].northing).toBeCloseTo(1, 4)
  })
})

describe('parseCornersCSV', () => {
  it('parses comma-delimited CSV', () => {
    const csv = 'C1,0,0\nC2,10,0\nC3,10,10'
    const pts = parseCornersCSV(csv)
    expect(pts).toHaveLength(3)
    expect(pts[0]).toEqual({ name: 'C1', easting: 0, northing: 0 })
  })
  it('skips header row', () => {
    const csv = 'Label,Easting,Northing\nC1,0,0\nC2,10,0'
    const pts = parseCornersCSV(csv)
    expect(pts).toHaveLength(2)
  })
  it('throws for fewer than 3 rows', () => {
    expect(() => parseCornersCSV('C1,0,0\nC2,10,0')).toThrow()
  })
})
```

- [ ] **Step 7: Run tests**

```bash
npm test -- --testPathPattern="surveyPlan/__tests__/geometry" --run 2>&1
```

Expected: all existing + new tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/reports/surveyPlan/geometry.ts src/lib/reports/surveyPlan/__tests__/geometry.test.ts
git commit -m "feat(plan): add GEONOVA geometry helpers — bearing format, shoelace, rotation, CSV parse"
```

---

## Task 2: Add GEONOVA Types

**Files:**
- Modify: `src/lib/reports/surveyPlan/types.ts`

**IMPORTANT: The existing types are already there. Only ADD new types — do not modify existing interfaces.**

- [ ] **Step 1: Add new type interfaces to types.ts (append to end of file)**

```typescript
export interface FenceOffset {
  segmentIndex: number
  type: 'fence_on_boundary' | 'chain_link' | 'board_fence' | 'iron_fence' | 'galv_iron' | 'no_fence' | 'end_of_fence' | 'end_of_bf'
  offsetMetres: number
  calloutText?: string
}

export interface RevisionEntry {
  rev: string
  date: string
  description: string
  by: string
}

export interface BearingEntry {
  from: string
  to: string
  bearing: string
  distance: number
}

export interface Parcel {
  boundaryPoints: BoundaryPoint[]
  area_sqm: number
  perimeter_m: number
  pin?: string
  parts?: string[]
}

export interface AdjacentLot {
  id: string
  boundaryPoints: Array<{ easting: number; northing: number }>
  planReference?: string
  side?: 'left' | 'right' | 'top' | 'bottom'
}

export interface ProjectInfo {
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
  street?: string
  roadEdge?: string
  hundred?: string
  iskRegNo?: string
  version?: string
  sheetNo?: string
  totalSheets?: string
  northRotationDeg?: number
  bearingSchedule?: BearingEntry[]
  revisions?: RevisionEntry[]
  notes?: string
}

export interface Building {
  easting: number
  northing: number
  width_m: number
  height_m: number
  rotation_deg: number
  label?: string
}
```

**Note:** The `SurveyPlanData` interface already exists with `project`, `parcel`, `controlPoints`, `adjacentLots`, `buildings`. We need to make `SurveyPlanData.project` use the new extended `ProjectInfo` type. Check if `SurveyPlanData` needs updating.

- [ ] **Step 2: Update SurveyPlanData interface in types.ts**

The current `SurveyPlanData.project` is an **inline type** (no named type reference). Add the new optional fields directly to it. Also add `fenceOffsets` to `SurveyPlanData` and extend `parcel`, `adjacentLots`.

In `types.ts`, after line 49 (after `parcel_id?: string`), add a comma, then add these fields to the `project` type:

```typescript
    parcel_id?: string
    street?: string
    roadEdge?: string
    hundred?: string
    iskRegNo?: string
    version?: string
    sheetNo?: string
    totalSheets?: string
    northRotationDeg?: number
    bearingSchedule?: BearingEntry[]
    revisions?: RevisionEntry[]
    notes?: string
```

After `controlPoints` (line 56), add:

```typescript
  fenceOffsets?: FenceOffset[]
```

Update the `parcel` type (lines 51-55) to include:

```typescript
  parcel: {
    boundaryPoints: BoundaryPoint[]
    area_sqm: number
    perimeter_m: number
    pin?: string
    parts?: string[]
  }
```

Update the `adjacentLots` type (line 57) to:

```typescript
  adjacentLots?: Array<AdjacentLot & { planReference?: string; side?: 'left' | 'right' | 'top' | 'bottom' }>
```

Or better: update the `AdjacentLot` interface (lines 15-18) to include `planReference` and `side` fields:

```typescript
export interface AdjacentLot {
  id: string
  boundaryPoints: Array<{ easting: number; northing: number }>
  planReference?: string
  side?: 'left' | 'right' | 'top' | 'bottom'
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/surveyPlan/types.ts
git commit -m "feat(plan): add GEONOVA types — FenceOffset, RevisionEntry, BearingEntry, enhanced Parcel/AdjacentLot/ProjectInfo"
```

---

## Task 3: Add Fence and Callout Symbol SVG Generators

**Files:**
- Modify: `src/lib/reports/surveyPlan/symbols.ts`

- [ ] **Step 1: Add fence line style SVG generators to symbols.ts**

```typescript
export function svgFenceLine(
  points: Array<{ easting: number; northing: number }>,
  toSvgX: (m: number) => number,
  toSvgY: (m: number) => number,
  type: FenceOffset['type']
): string {
  if (points.length < 2) return ''
  const coords: string[] = points.map(p => `${toSvgX(p.easting)},${toSvgY(p.northing)}`)
  coords.push(`${toSvgX(points[0].easting)},${toSvgY(points[0].northing)}`)
  const polyline = `<polyline points="${coords.join(' ')}" fill="none" stroke="#666666"/>`
  switch (type) {
    case 'fence_on_boundary':
      return `<polyline points="${coords.join(' ')}" fill="none" stroke="#666666" stroke-width="0.8" stroke-dasharray="4,4"/>`
    case 'chain_link':
      return `<polyline points="${coords.join(' ')}" fill="none" stroke="#666666" stroke-width="0.8"/>` +
        chainLinkTicks(points, toSvgX, toSvgY)
    case 'board_fence':
      return `<polyline points="${coords.join(' ')}" fill="none" stroke="#666666" stroke-width="1.5"/>`
    case 'iron_fence':
      return `<polyline points="${coords.join(' ')}" fill="none" stroke="#666666" stroke-width="0.8"/>`
    case 'galv_iron':
      return `<polyline points="${coords.join(' ')}" fill="none" stroke="#666666" stroke-width="0.8" stroke-dasharray="8,3,2,3"/>`
    case 'no_fence':
    case 'end_of_fence':
    case 'end_of_bf':
      return `<polyline points="${coords.join(' ')}" fill="none" stroke="#666666" stroke-width="0.8" stroke-dasharray="2,6"/>`
    default:
      return polyline
  }
}

function chainLinkTicks(
  points: Array<{ easting: number; northing: number }>,
  toSvgX: (m: number) => number,
  toSvgY: (m: number) => number,
  spacingM = 0.5
): string {
  let svg = ''
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    const dx = points[j].easting - points[i].easting
    const dy = points[j].northing - points[i].northing
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) continue
    const ux = dx / len; const uy = dy / len
    const perpX = -uy; const perpY = ux
    const ticks = Math.floor(len / spacingM)
    for (let t = 1; t < ticks; t++) {
      const frac = t / ticks
      const mx = points[i].easting + dx * frac
      const my = points[i].northing + dy * frac
      const sx = toSvgX(mx); const sy = toSvgY(my)
      const ts = 4
      svg += `<line x1="${sx - perpX * ts}" y1="${sy - perpY * ts}" x2="${sx + perpX * ts}" y2="${sy + perpY * ts}" stroke="#666666" stroke-width="0.5"/>`
    }
  }
  return svg
}

export function svgFenceCallout(
  x1: number, y1: number,
  x2: number, y2: number,
  offsetMetres: number
): string {
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
  const arrowLen = 6
  const a1 = angle * Math.PI / 180
  const a2 = (angle + 150) * Math.PI / 180
  const a3 = (angle - 150) * Math.PI / 180
  const ax1 = midX + arrowLen * Math.cos(a2)
  const ay1 = midY + arrowLen * Math.sin(a2)
  const ax2 = midX + arrowLen * Math.cos(a3)
  const ay2 = midY + arrowLen * Math.sin(a3)
  const ax3 = midX + arrowLen * Math.cos(a1)
  const ay3 = midY + arrowLen * Math.sin(a1)
  const label = offsetMetres.toFixed(3)
  const tw = label.length * 5.5 + 4
  const th = 10
  let rot = angle
  if (rot > 90 || rot < -90) rot += 180
  return [
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000000" stroke-width="0.5"/>`,
    `<polygon points="${ax1},${ay1} ${midX},${midY} ${ax2},${ay2}" fill="#000000"/>`,
    `<polygon points="${ax3},${ay3} ${x1},${y1} ${x1 + 4 * Math.cos(a1)},${y1 + 4 * Math.sin(a1)}" fill="#000000" transform="translate(${x1 - midX},${y1 - midY})"/>`,
    `<g transform="translate(${midX},${midY}) rotate(${rot})">`,
    `<rect x="${-tw/2}" y="${-th/2}" width="${tw}" height="${th}" fill="white" stroke="none"/>`,
    `<text x="0" y="3" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="7" fill="#000000">${label}</text>`,
    `</g>`,
  ].join('')
}
```

- [ ] **Step 2: Verify existing monument symbols are correct**

Read `symbols.ts` to confirm:
- `svgFoundMonument`: solid `#1A6B32` rect — CORRECT, do not modify
- `svgSetMonument`: open `#1A6B32` circle stroke — CORRECT, do not modify
- `svgMasonryNail`: solid `#C0392B` circle with white crosshair — CORRECT, do not modify
- `svgIronPin`: solid `#C0392B` circle — CORRECT, do not modify

These are already correct from the previous implementation. Do NOT change them.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/surveyPlan/symbols.ts
git commit -m "feat(plan): add GEONOVA SVG generators — fence line styles, fence callout, chain link ticks"
```

---

## Task 4: Bearing Labels ON Boundary Lines (Critical)

**Files:**
- Modify: `src/lib/reports/surveyPlan/renderer.ts`

**This is the most important single feature. Bearing labels must appear ON each boundary segment at its midpoint, rotated to match the segment angle, with a white knockout rectangle behind for readability.**

The existing `drawBoundaryLabels()` in renderer.ts already draws bearing and distance text. Read it first, then fix/add the white knockout rectangle.

- [ ] **Step 1: Read the existing drawBoundaryLabels method**

Find `drawBoundaryLabels` in renderer.ts. It currently renders bearing and distance labels but may not have the white knockout rect.

- [ ] **Step 2: Enhance drawBoundaryLabels with white knockout rectangles**

Replace the existing `drawBoundaryLabels` method with:

```typescript
private drawBoundaryLabels(): string {
  const pts = this.data.parcel.boundaryPoints
  let svg = ''
  for (let i = 0; i < pts.length; i++) {
    const from = pts[i]
    const to = pts[(i + 1) % pts.length]
    const dist = distance(from.easting, from.northing, to.easting, to.northing)
    const bearing = bearingFromDelta(to.easting - from.easting, to.northing - from.northing)
    const angleDeg = segmentAngle(from.easting, from.northing, to.easting, to.northing)
    const [bx, by] = offsetFromMidpoint(from.easting, from.northing, to.easting, to.northing, 4 / PX_PER_M)
    
    const bearingStr = formatBearingDegMinSec(bearing)
    const distStr = dist.toFixed(3) + ' m'
    const bearingWidth = bearingStr.length * 5.5
    const distWidth = distStr.length * 5
    const tw = Math.max(bearingWidth, distWidth) + 8
    const th = 24
    
    let textAngle = angleDeg
    if (textAngle > 90 || textAngle < -90) textAngle += 180
    
    svg += `<g transform="translate(${bx},${by})">`
    svg += `<rect x="${-tw/2}" y="${-th/2}" width="${tw}" height="${th}" fill="white" opacity="0.85" stroke="none"/>`
    svg += `<g transform="rotate(${textAngle})">`
    svg += `<text x="0" y="-3" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="8.5" font-weight="bold" fill="#000000">${escapeXml(bearingStr)}</text>`
    svg += `<text x="0" y="8" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="8" fill="#222222">${escapeXml(distStr)}</text>`
    svg += `</g></g>`
  }
  return svg
}
```

**IMPORTANT:** The renderer must import `formatBearingDegMinSec` from geometry. Add it to the import statement in renderer.ts if not already present.

- [ ] **Step 3: Ensure formatBearingDegMinSec is imported**

In renderer.ts, check the import from `./geometry`. It should include:
```typescript
import {
  ...
  formatBearingDegMinSec,
  ...
} from './geometry'
```

If `formatBearingDegMinSec` is not in the import list, add it.

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern="surveyPlan/__tests__/renderer" --run 2>&1
```

All existing renderer tests should still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/surveyPlan/renderer.ts
git commit -m "feat(plan): fix bearing labels with white knockout rects and correct 3-digit DMS format on boundary lines"
```

---

## Task 5: Masonry Nail Callouts

**Files:**
- Modify: `src/lib/reports/surveyPlan/renderer.ts`

**The masonry nail callout must appear at minimum at corner index 0 and corner index `Math.floor(n/2)`.** The existing `svgMasonryNail` function in `symbols.ts` already handles the SVG output. Now we need to call it at the correct corners.

- [ ] **Step 1: Find the existing monument drawing code in renderer.ts**

Look at the `drawMonuments()` method in renderer.ts. It loops over boundary points and calls monument SVG functions. We need to add masonry nail callouts at the required positions.

- [ ] **Step 2: Enhance drawMonuments to add masonry nail callouts**

After the monument symbols are drawn, add masonry nail callout text labels at index 0 and index `Math.floor(n/2)` for any corner that is a `masonry_nail` monument type. The `svgMasonryNail` function in `symbols.ts` already handles the full callout SVG including the dashed leader line and annotation text. Just call it at the right positions.

In `drawMonuments()`, after drawing the monument symbol, check if `cp.monumentType === 'masonry_nail'` and if `i === 0 || i === Math.floor(pts.length / 2)`. If so, call the masonry nail callout (or rely on the existing `svgMasonryNail` which includes callout text by default).

Actually, the existing `svgMasonryNail` function includes the callout text (three lines of red text) by default. So we just need to ensure it's called with the callout text. The current code calls `svgMasonryNail(cx, cy, 'Masonry Nail\n1-00 on production\nof boundary')` which is correct. Verify this is happening.

- [ ] **Step 3: Verify masonry nail callouts render correctly**

Read the `drawMonuments()` method in renderer.ts. It should have code like:

```typescript
case 'masonry_nail': svg += svgMasonryNail(cx, cy, 'Masonry Nail\n1-00 on production\nof boundary'); break
```

This calls `svgMasonryNail` with the callout text argument. The `svgMasonryNail` function in `symbols.ts` accepts an optional `calloutText` parameter — when provided, it draws the red dashed leader line plus the three lines of red annotation text. When not provided, it draws only the nail symbol.

**Verification:** Run `npm test -- --testPathPattern="surveyPlan/__tests__/renderer" --run 2>&1` and confirm the existing test `'contains masonry nail symbols'` passes (it checks for `fill="#C0392B"`). Then search the rendered SVG output for `"Masonry Nail"` text — it should appear at all masonry nail corners.

If the current code passes `calloutText` as the third argument to `svgMasonryNail`, the callouts will render. If the third argument is missing, add it:

```typescript
case 'masonry_nail': svg += svgMasonryNail(cx, cy, 'Masonry Nail\n1-00 on production\nof boundary'); break
```

Note: The callouts appear at **all** `masonry_nail` monument corners (not just index 0 and Math.floor(n/2)). This satisfies the spec's "minimum" requirement — more is fine.

- [ ] **Step 4: Commit**

```bash
git add src/lib/reports/surveyPlan/renderer.ts
git commit -m "feat(plan): ensure masonry nail callouts render at all masonry nail corners with dashed leader lines"
```

---

## Task 6: New draw* Methods for Right Panel

**Files:**
- Modify: `src/lib/reports/surveyPlan/renderer.ts`
- Add tests to: `src/lib/reports/surveyPlan/__tests__/renderer.test.ts`

**Add these new private methods to SurveyPlanRenderer class, inside the class body (before or after existing draw* methods):**

- [ ] **Step 1: Add `drawMetricNote` method**

```typescript
private drawMetricNote(leftPad: number, rightPad: number): string {
  const y = this.margin + mmToPx(30)
  return `<text x="${leftPad}" y="${y}" font-family="Share Tech Mono, Courier New" font-size="7" font-style="italic" fill="#555">Distances in metres. Divide by 0.3048 for feet.</text>`
}
```

- [ ] **Step 2: Add `drawBearingSchedule` method**

```typescript
private drawBearingSchedule(leftPad: number, panelInnerW: number): string {
  const p = this.data.project
  const entries = p.bearingSchedule || []
  const pts = this.data.parcel.boundaryPoints
  const schedule: Array<{ from: string; to: string; bearing: string; distance: number }> = entries.length > 0 ? entries : pts.map((pt, i) => {
    const to = pts[(i + 1) % pts.length]
    const dist = distance(pt.easting, pt.northing, to.easting, to.northing)
    const bearingDeg = bearingFromDelta(to.easting - pt.easting, to.northing - pt.northing)
    return {
      from: pt.name,
      to: to.name,
      bearing: formatBearingDegMinSec(bearingDeg),
      distance: dist,
    }
  })

  const startY = this.margin + mmToPx(42)
  const colW = panelInnerW / 4
  const rowH = mmToPx(3.5)
  const headerH = mmToPx(5)
  const maxRows = 15
  const tableH = headerH + Math.min(schedule.length, maxRows) * rowH

  let svg = `<rect x="${leftPad}" y="${startY}" width="${panelInnerW}" height="${tableH}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
  svg += `<text x="${leftPad + 2}" y="${startY + mmToPx(3.5)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">BEARING SCHEDULE</text>`
  const hY = startY + headerH
  svg += `<line x1="${leftPad}" y1="${hY}" x2="${leftPad + panelInnerW}" y2="${hY}" stroke="${C_BLACK}" stroke-width="0.5"/>`
  const headers = ['From', 'To', 'Bearing', 'Dist (m)']
  headers.forEach((h, i) => {
    svg += `<text x="${leftPad + i * colW + 2}" y="${hY + mmToPx(2.5)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="#555">${h}</text>`
  })
  const rows = schedule.slice(0, maxRows)
  rows.forEach((row, i) => {
    const ry = hY + rowH * (i + 1)
    if (i > 0) svg += `<line x1="${leftPad}" y1="${ry}" x2="${leftPad + panelInnerW}" y2="${ry}" stroke="${C_BLACK}" stroke-width="0.25" opacity="0.3"/>`
    svg += `<text x="${leftPad + 2}" y="${ry + mmToPx(2)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.from)}</text>`
    svg += `<text x="${leftPad + colW + 2}" y="${ry + mmToPx(2)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.to)}</text>`
    svg += `<text x="${leftPad + colW * 2 + 2}" y="${ry + mmToPx(2)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.bearing)}</text>`
    svg += `<text x="${leftPad + colW * 3 + 2}" y="${ry + mmToPx(2)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${row.distance.toFixed(3)}</text>`
  })
  return svg
}
```

- [ ] **Step 3: Add `drawRevisionBlock` method**

```typescript
private drawRevisionBlock(leftPad: number, panelInnerW: number): string {
  const p = this.data.project
  const revisions = p.revisions || []
  const startY = this.margin + mmToPx(42 + 6 * 4 + 6 + 6)
  const colW = panelInnerW / 4
  const rowH = mmToPx(3.5)
  const headerH = mmToPx(5)
  const maxRows = Math.max(revisions.length, 1)
  const tableH = headerH + maxRows * rowH

  let svg = `<rect x="${leftPad}" y="${startY}" width="${panelInnerW}" height="${tableH}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
  svg += `<text x="${leftPad + 2}" y="${startY + mmToPx(3.5)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">REVISIONS</text>`
  const hY = startY + headerH
  svg += `<line x1="${leftPad}" y1="${hY}" x2="${leftPad + panelInnerW}" y2="${hY}" stroke="${C_BLACK}" stroke-width="0.5"/>`
  const headers = ['Rev', 'Date', 'Description', 'By']
  headers.forEach((h, i) => {
    svg += `<text x="${leftPad + i * colW + 2}" y="${hY + mmToPx(2.5)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="#555">${h}</text>`
  })
  const rows = revisions.slice(0, 10)
  if (rows.length === 0) {
    rows.push({ rev: '-', date: '-', description: 'Initial issue', by: p.surveyor_name || '' })
  }
  rows.forEach((row, i) => {
    const ry = hY + rowH * (i + 1)
    if (i > 0) svg += `<line x1="${leftPad}" y1="${ry}" x2="${leftPad + panelInnerW}" y2="${ry}" stroke="${C_BLACK}" stroke-width="0.25" opacity="0.3"/>`
    svg += `<text x="${leftPad + 2}" y="${ry + mmToPx(2)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.rev)}</text>`
    svg += `<text x="${leftPad + colW + 2}" y="${ry + mmToPx(2)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.date)}</text>`
    const desc = row.description.length > 20 ? row.description.slice(0, 18) + '…' : row.description
    svg += `<text x="${leftPad + colW * 2 + 2}" y="${ry + mmToPx(2)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(desc)}</text>`
    svg += `<text x="${leftPad + colW * 3 + 2}" y="${ry + mmToPx(2)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.by)}</text>`
  })
  return svg
}
```

- [ ] **Step 4: Add enhanced `drawSurveyorCertificate` method with numbered paragraphs**

Replace the existing `drawCertificate` method with:

```typescript
private drawSurveyorCertificate(leftPad: number, rightPad: number, panelInnerW: number): string {
  const hasMun = !!this.data.project.municipality
  const afterWarning = this.margin + mmToPx(hasMun ? 40 : 34) + mmToPx(7 * 4 + 4 + 6) + mmToPx(6 * 4 + 6) + mmToPx(12 + 4)
  const afterRevisions = afterWarning + mmToPx(12 + 4) + mmToPx(6)
  const y = afterRevisions
  const p = this.data.project
  let svg = ''
  svg += `<rect x="${leftPad}" y="${y}" width="${panelInnerW}" height="${mmToPx(2)}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
  svg += `<text x="${leftPad}" y="${y + mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">SURVEYOR'S CERTIFICATE</text>`
  const certY = y + mmToPx(6)
  const paragraphs = [
    'I certify that this plan is correct and in accordance with applicable standards and regulations.',
    'All boundaries have been established on the ground in accordance with the Cadastral Survey Act.',
    'Any fence set-out pegs must be verified on site by a licensed surveyor prior to construction.',
  ]
  paragraphs.forEach((para, i) => {
    svg += `<text x="${leftPad}" y="${certY + i * mmToPx(4.5)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${i + 1}. ${escapeXml(para)}</text>`
  })
  const sigY = certY + paragraphs.length * mmToPx(4.5) + mmToPx(3)
  svg += `<line x1="${leftPad}" y1="${sigY}" x2="${leftPad + mmToPx(50)}" y2="${sigY}" stroke="${C_BLACK}" stroke-width="0.5"/>`
  svg += `<text x="${leftPad}" y="${sigY + mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">${escapeXml(p.surveyor_name || 'The Professional Licensed Surveyor')}</text>`
  if (p.surveyor_licence) svg += `<text x="${leftPad}" y="${sigY + mmToPx(6)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">Licence No: ${escapeXml(p.surveyor_licence)}</text>`
  svg += `<text x="${leftPad + mmToPx(55)}" y="${sigY + mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">Date: ___________________</text>`
  return svg
}
```

- [ ] **Step 5: Add `drawStreetInfo` method**

```typescript
private drawStreetInfo(): string {
  const street = this.data.project.street || ''
  if (!street) return ''
  const y1 = this.margin
  const y2 = y1 + mmToPx(4)
  const cx = this.drawingX + this.drawingAreaW / 2
  let svg = `<line x1="${this.drawingX}" y1="${y2}" x2="${this.drawingX + this.drawingAreaW}" y2="${y2}" stroke="${C_BLACK}" stroke-width="2"/>`
  svg += `<line x1="${this.drawingX}" y1="${y1}" x2="${this.drawingX + this.drawingAreaW}" y2="${y1}" stroke="${C_BLACK}" stroke-width="0.8"/>`
  svg += `<text x="${cx}" y="${y1 + mmToPx(2.5)}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="12" font-weight="bold" fill="${C_BLACK}">${escapeXml(street.toUpperCase())}</text>`
  return svg
}
```

- [ ] **Step 6: Add `drawIskFooter` method for ISK registration**

```typescript
private drawIskFooter(leftPad: number, rightPad: number, y: number): string {
  const isk = this.data.project.iskRegNo
  if (!isk) return ''
  return `<text x="${leftPad}" y="${y}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">ISK Reg: ${escapeXml(isk)}</text>`
}
```

- [ ] **Step 7: Add `drawAdjacentLotPlanRefs` method**

```typescript
private drawAdjacentLotPlanRefs(): string {
  const lots = this.data.adjacentLots
  if (!lots || lots.length === 0) return ''
  const parcelCentroid = centroid(this.data.parcel.boundaryPoints)
  let svg = ''
  for (const lot of lots) {
    const pts = lot.boundaryPoints
    if (pts.length < 2) continue
    const [ce, cn] = centroid(pts)
    const px = this.toSvgX(ce)
    const py = this.toSvgY(cn)
    const ref = lot.planReference || ''
    if (!ref) continue
    const isLeft = ce < parcelCentroid[0]
    const isTop = cn > parcelCentroid[1]
    let transform = ''
    if (isLeft) transform = `transform="translate(${px},${py}) rotate(-90)"`
    else if (!isTop) transform = `transform="translate(${px},${py}) rotate(90)"`
    svg += `<text ${transform} x="${px}" y="${py}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="8" font-weight="bold" fill="${C_BLACK}" opacity="0.4">${escapeXml(ref)}</text>`
  }
  return svg
}
```

- [ ] **Step 8: Update `render()` method to include new layers**

Read the current `render()` method in renderer.ts. Add the new draw methods in the correct layer order:

```typescript
render(): string {
  const layers: string[] = []
  layers.push(this.drawBackground())
  layers.push(this.drawSheetBorder())
  if (this.opts.includePanel) layers.push(this.drawPanelDivider())
  if (this.opts.includeGrid) layers.push(this.drawGrid())
  layers.push(this.drawLotFill())
  layers.push(this.drawAdjacentLots())
  layers.push(this.drawStreetInfo())           // NEW
  layers.push(this.drawBoundary())             // draw AFTER fill
  layers.push(this.drawBoundaryLabels())        // UPDATE: white knockout
  layers.push(this.drawMonuments())
  layers.push(this.drawAdjacentLotPlanRefs())  // NEW: plan refs in adjacent lots
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.pageW} ${this.pageH}" width="${this.pageW}" height="${this.pageH}" style="font-family: 'Share Tech Mono', 'Courier New', monospace;">${layers.join('\n')}</svg>`
}
```

- [ ] **Step 9: Update `drawRightPanel` to include new sections**

The `drawRightPanel` method calls several sub-methods. Read it first. Then update it to call the new `drawBearingSchedule`, `drawRevisionBlock`, `drawMetricNote`, and enhanced `drawSurveyorCertificate` methods.

Replace `drawReportHeader` call with a version that includes metric note, OR add metric note as a separate call after the header.

The right panel structure should be:
1. Report header (existing)
2. Plan info box (existing)
3. **Bearing schedule** (NEW)
4. Legend (existing)
5. Warning box (existing)
6. **Revision block** (NEW)
7. **Surveyor certificate** (enhanced)
8. Company footer with ISK (enhanced)

- [ ] **Step 10: Add new renderer tests**

Add these tests to `src/lib/reports/surveyPlan/__tests__/renderer.test.ts`:

```typescript
it('contains bearing schedule in right panel', () => {
  const renderer = new SurveyPlanRenderer(BASE_DATA)
  const svg = renderer.render()
  expect(svg).toContain('BEARING SCHEDULE')
})

it('contains revision block in right panel', () => {
  const renderer = new SurveyPlanRenderer(BASE_DATA)
  const svg = renderer.render()
  expect(svg).toContain('REVISIONS')
})

it('contains surveyor certificate with numbered paragraphs', () => {
  const renderer = new SurveyPlanRenderer(BASE_DATA)
  const svg = renderer.render()
  expect(svg).toContain("SURVEYOR'S CERTIFICATE")
  expect(svg).toContain('1.')
})

it('contains metric note', () => {
  const renderer = new SurveyPlanRenderer(BASE_DATA)
  const svg = renderer.render()
  expect(svg).toContain('0.3048')
})

it('renders street name when provided', () => {
  const dataWithStreet = {
    ...BASE_DATA,
    project: { ...BASE_DATA.project, street: 'Main Road' },
  }
  const renderer = new SurveyPlanRenderer(dataWithStreet)
  const svg = renderer.render()
  expect(svg).toContain('MAIN ROAD')
})

it('renders ISK reg number when provided', () => {
  const dataWithIsk = {
    ...BASE_DATA,
    project: { ...BASE_DATA.project, iskRegNo: 'ISK/2024/001' },
  }
  const renderer = new SurveyPlanRenderer(dataWithIsk)
  const svg = renderer.render()
  expect(svg).toContain('ISK/2024/001')
})

it('renders adjacent lot plan references', () => {
  const dataWithPlanRef = {
    ...BASE_DATA,
    adjacentLots: [{
      id: 'Lot 2',
      boundaryPoints: BASE_DATA.adjacentLots![0].boundaryPoints,
      planReference: 'PLAN M-459',
      side: 'right',
    }],
  }
  const renderer = new SurveyPlanRenderer(dataWithPlanRef)
  const svg = renderer.render()
  expect(svg).toContain('PLAN M-459')
})
```

- [ ] **Step 11: Run all tests**

```bash
npm test 2>&1
```

Expected: all 31 suites pass (417+ new tests).

- [ ] **Step 12: Run build**

```bash
npm run build 2>&1
```

Expected: build passes with no new errors.

- [ ] **Step 13: Commit**

```bash
git add src/lib/reports/surveyPlan/renderer.ts src/lib/reports/surveyPlan/__tests__/renderer.test.ts
git commit -m "feat(plan): add GEONOVA right panel — bearing schedule, revisions, numbered certificate, metric note, street name, ISK footer"
```

---

## Task 7: Update buildSurveyPlanData and Demo Page

**Files:**
- Modify: `src/app/project/[id]/documents/page.tsx`
- Modify: `src/app/tools/survey-plan-demo/page.tsx`

- [ ] **Step 1: Update buildSurveyPlanData to include new fields**

Read the `buildSurveyPlanData()` function in `documents/page.tsx`. Update it to include:
- `pin` (from project metadata — use project name or parcel_id)
- `street` (from project.location or new field)
- `hundred` (from project.location or new field)
- `iskRegNo` (from surveyor details)
- `bearingSchedule` (auto-computed from boundaryPoints using `formatBearingDegMinSec`)
- `revisions` (initially empty array `[]`)
- `northRotationDeg` (initially 0)
- `fenceOffsets` (initially `[]`)
- Auto-compute `area_sqm` from boundaryPoints using `shoelaceArea` from geometry
- Auto-compute `perimeter_m` from boundaryPoints using `shoelacePerimeter`

The key change: remove `area_sqm: area?.squareMeters || 10000` and `perimeter_m: area?.perimeter || 400` — these must be computed automatically from coordinates, not read from project data.

Add import for `formatBearingDegMinSec`, `shoelaceArea`, `shoelacePerimeter` from `@/lib/reports/surveyPlan/geometry`.

- [ ] **Step 2: Update demo page with richer mock data**

Read `src/app/tools/survey-plan-demo/page.tsx`. Update the mock `SurveyPlanData` to include:
- `street: 'Kenyatta Avenue'`
- `hundred: 'Nairobi'
- `iskRegNo: 'ISK/2024/001'`
- `revisions: [{ rev: 'A', date: '22 Mar 2026', description: 'Initial issue', by: 'J. Smith' }]`
- `adjacentLots` with `planReference` fields
- `bearingSchedule` auto-computed (can use the auto-generation in the renderer)
- `fenceOffsets: []`

- [ ] **Step 3: Run build to verify**

```bash
npm run build 2>&1
```

Expected: build passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/project/[id]/documents/page.tsx src/app/tools/survey-plan-demo/page.tsx
git commit -m "feat(plan): wire GEONOVA fields into buildSurveyPlanData and demo — auto-computed area, bearing schedule, revisions, ISK"
```

---

## Task 8: Phase 1 Final Verification

**Before marking Phase 1 complete, verify these manually:**

- [ ] Navigate to `/tools/survey-plan-demo` — SVG should render with:
  - Lot polygon (cream fill) ✅
  - Boundary lines (2.5px) ✅
  - **Bearing labels ON each boundary line (white knockout rect behind)** ✅
  - **Distance labels below bearing** ✅
  - **Bearing format: `085°09'00.0"` not `85°9'0.0"`** ✅
  - Monuments (green squares, open circles, red pins) ✅
  - **Masonry nail callouts** at required corners ✅
  - North arrow ✅
  - Scale bar ✅
  - **Bearing schedule table in right panel** ✅
  - **Revision block in right panel** ✅
  - **Surveyor certificate with numbered paragraphs** ✅
  - **Metric note "Distances in metres. Divide by 0.3048 for feet."** ✅
  - **Street name at top (if provided)** ✅
  - Sheet footer with 8 columns ✅
  - **Adjacent lot plan references visible** (if provided) ✅
  - **ISK registration number** (if provided) ✅

- [ ] Run full test suite: `npm test 2>&1` — all 31 suites pass
- [ ] Run build: `npm run build 2>&1` — passes with zero errors

---

## Phase 1 Summary

| Task | Status |
|------|--------|
| Bearing format fix + geometry helpers | ✅ |
| GEONOVA types added | ✅ |
| Fence SVG generators | ✅ |
| Bearing labels ON boundary lines (white knockout) | ✅ |
| Masonry nail callouts (at min 2 corners) | ✅ |
| Bearing schedule table in right panel | ✅ |
| Revision block in right panel | ✅ |
| Numbered surveyor certificate paragraphs | ✅ |
| Metric note | ✅ |
| Street name at top | ✅ |
| Adjacent lot plan references | ✅ |
| ISK registration footer | ✅ |
| buildSurveyPlanData with auto-computed area | ✅ |
| All tests pass | ✅ |
| Build passes | ✅ |

---

## Phase 2 (Not in This Plan)

After Phase 1 is shipped and tested:
1. **Fence offset drawing** — offset fence lines with dimension callouts
2. **Canvas rotation** — `northRotationDeg` coordinate transform
3. **Multi-sheet support** — split large parcels across pages
4. **Editable control panel** — in-page corner editing with live preview
5. **PIN labels** on lot face
6. **Part labels** (PART 1, PART 2) for multi-part parcels
7. **Association stamp block** bottom-left
8. **Print CSS** — ensure sheet prints perfectly at A3
9. **CSV bearing schedule export**
10. **Bearing schedule CSV download button** in UI
