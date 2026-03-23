# Survey Plan Renderer — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Phase 1 built-but-unused components into the renderer, add PIN/Part labels, multi-sheet support, association stamp, print CSS, and CSV bearing schedule export.

**Architecture:** Phase 1 already has `FenceOffset` type, `svgFenceLine()`, `svgFenceCallout()`, `rotatePoints()` — Phase 2 wires these into the renderer. New SVG generation methods added as private methods on `SurveyPlanRenderer`. CSV export is a standalone utility. Print CSS is a global stylesheet addition.

**Tech Stack:** TypeScript, SVG, Jest, CSS `@media print`

---

## File Structure

```
src/lib/reports/surveyPlan/
  renderer.ts       # ADD: drawFenceOffsets, drawPinLabel, drawPartLabels, drawAssociationStamp, splitIntoSheets, drawSheetNavigator
  geometry.ts       # ADD: computeOffsetFencePoints, offsetPointPerpendicular
  __tests__/
    renderer.test.ts  # ADD: fence offset tests, PIN/Part label tests, multi-sheet tests
    geometry.test.ts # ADD: fence offset geometry tests

src/components/
  SurveyPlanViewer.tsx  # MODIFY: add CSV download button, sheet navigation controls, print button
  SurveyPlanExport.tsx  # MODIFY: add multi-sheet export, PDF export

src/app/globals.css     # ADD: @media print styles for A3

src/lib/reports/
  bearingScheduleCSV.ts  # CREATE: generateBearingScheduleCSV() utility

docs/superpowers/
  specs/2026-03-22-survey-plan-design.md  # Update with Phase 2 features
  plans/2026-03-22-survey-plan-phase2.md  # This plan
```

---

## Task 1: Geometry Helpers for Fence Offsets

**Files:**
- Modify: `src/lib/reports/surveyPlan/geometry.ts`
- Modify: `src/lib/reports/surveyPlan/__tests__/geometry.test.ts`

The `svgFenceLine` and `svgFenceCallout` in `symbols.ts` expect fence points as SVG pixel coordinates. We need a helper that converts fence offset data (segment index + type + offset metres) into actual fence boundary points.

- [ ] **Step 1: Add `offsetPointPerpendicular` to geometry.ts**

```typescript
export function offsetPointPerpendicular(
  from: { easting: number; northing: number },
  to: { easting: number; northing: number },
  offset: number
): { easting: number; northing: number } {
  const dx = to.easting - from.easting
  const dy = to.northing - from.northing
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return { easting: from.easting, northing: from.northing }
  const perpX = -dy / len
  const perpY = dx / len
  return {
    easting: from.easting + perpX * offset,
    northing: from.northing + perpY * offset,
  }
}
```

- [ ] **Step 2: Add `computeFenceBoundary` to geometry.ts**

```typescript
export function computeFenceBoundary(
  boundaryPoints: Array<{ easting: number; northing: number }>,
  fenceOffsets: Array<{
    segmentIndex: number
    type: string
    offsetMetres: number
  }>
): Array<{ easting: number; northing: number }> {
  if (!fenceOffsets || fenceOffsets.length === 0) return []
  const pts = boundaryPoints
  const fence: Array<{ easting: number; northing: number }> = []
  for (let i = 0; i < pts.length; i++) {
    const from = pts[i]
    const to = pts[(i + 1) % pts.length]
    const fo = fenceOffsets.find(o => o.segmentIndex === i)
    if (fo && fo.offsetMetres > 0) {
      const op = offsetPointPerpendicular(from, to, fo.offsetMetres)
      fence.push(op)
    } else {
      fence.push({ easting: from.easting, northing: from.northing })
    }
  }
  return fence
}
```

- [ ] **Step 3: Add tests for fence geometry**

Add to `geometry.test.ts`:

```typescript
describe('offsetPointPerpendicular', () => {
  it('offsets a point 1m to the left of a horizontal segment', () => {
    const from = { easting: 0, northing: 0 }
    const to = { easting: 10, northing: 0 }
    const result = offsetPointPerpendicular(from, to, 1)
    expect(result.easting).toBeCloseTo(0, 4)
    expect(result.northing).toBeCloseTo(-1, 4)
  })
  it('handles vertical segment', () => {
    const from = { easting: 0, northing: 0 }
    const to = { easting: 0, northing: 10 }
    const result = offsetPointPerpendicular(from, to, 1)
    expect(result.easting).toBeCloseTo(1, 4)
    expect(result.northing).toBeCloseTo(0, 4)
  })
})

describe('computeFenceBoundary', () => {
  it('returns empty array when no fence offsets', () => {
    const pts = [{ easting: 0, northing: 0 }, { easting: 10, northing: 0 }, { easting: 10, northing: 10 }]
    const result = computeFenceBoundary(pts, [])
    expect(result).toEqual([])
  })
  it('offsets segment 0 by 2m', () => {
    const pts = [{ easting: 0, northing: 0 }, { easting: 10, northing: 0 }, { easting: 10, northing: 10 }]
    const offsets = [{ segmentIndex: 0, type: 'chain_link', offsetMetres: 2 }]
    const result = computeFenceBoundary(pts, offsets)
    expect(result).toHaveLength(3)
    expect(result[0].easting).toBeCloseTo(0, 4)
    expect(result[0].northing).toBeCloseTo(-2, 4)
  })
})
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern="surveyPlan/__tests__/geometry" --run 2>&1
```

Expected: all geometry tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reports/surveyPlan/geometry.ts src/lib/reports/surveyPlan/__tests__/geometry.test.ts
git commit -m "feat(plan): add fence offset geometry helpers — offsetPointPerpendicular, computeFenceBoundary"
```

---

## Task 2: Wire Fence Offsets into Renderer

**Files:**
- Modify: `src/lib/reports/surveyPlan/renderer.ts`
- Add tests: `src/lib/reports/surveyPlan/__tests__/renderer.test.ts`

The `FenceOffset` type and `svgFenceLine`/`svgFenceCallout` helpers already exist in `types.ts` and `symbols.ts`. We just need to wire them into `render()`.

- [ ] **Step 1: Read current render() method in renderer.ts**

Find the `render()` method. It should look something like:

```typescript
render(): string {
  const layers: string[] = []
  layers.push(this.drawBackground())
  layers.push(this.drawSheetBorder())
  // ... more layers
  return `<svg xmlns="http://www.w3.org/2000/svg" ...>${layers.join('\n')}</svg>`
}
```

- [ ] **Step 2: Add `drawFenceOffsets` method to renderer.ts**

Add after the existing `drawAdjacentLotPlanRefs()` method (or before `drawLotNumber()`):

```typescript
private drawFenceOffsets(): string {
  const fenceOffsets = this.data.fenceOffsets
  if (!fenceOffsets || fenceOffsets.length === 0) return ''
  const pts = this.data.parcel.boundaryPoints
  if (pts.length < 2) return ''
  const { minE, maxE, minN, maxN } = boundingBox(pts)
  const rawW = maxE - minE
  const rawH = maxN - minN
  const drawingAreaW = this.drawingAreaW
  const drawingAreaH = this.pageH - this.margin * 2 - this.footerH - this.panelW
  const scale = Math.min(drawingAreaW / rawW, drawingAreaH / rawH) * 0.85
  const originX = this.drawingX + drawingAreaW / 2
  const originY = this.margin + drawingAreaH / 2
  const toSvgX = (m: number) => originX + (m - (minE + maxE) / 2) * scale
  const toSvgY = (m: number) => originY - (m - (minN + maxN) / 2) * scale

  let svg = ''
  const renderedTypes = new Set<string>()

  for (const fo of fenceOffsets) {
    if (fo.segmentIndex < 0 || fo.segmentIndex >= pts.length) continue
    const from = pts[fo.segmentIndex]
    const to = pts[(fo.segmentIndex + 1) % pts.length]

    renderedTypes.add(fo.type)

    if (fo.type === 'end_of_fence' || fo.type === 'end_of_bf') {
      const cx = toSvgX((from.easting + to.easting) / 2)
      const cy = toSvgY((from.northing + to.northing) / 2)
      svg += `<line x1="${cx - 4}" y1="${cy - 4}" x2="${cx + 4}" y2="${cy + 4}" stroke="#666666" stroke-width="0.5"/>`
      svg += `<line x1="${cx + 4}" y1="${cy - 4}" x2="${cx - 4}" y2="${cy + 4}" stroke="#666666" stroke-width="0.5"/>`
      continue
    }

    const fencePts = [
      offsetPointPerpendicular(from, to, fo.offsetMetres),
      offsetPointPerpendicular(to, pts[(fo.segmentIndex + 2) % pts.length], fo.offsetMetres),
    ]
    const ptsSvg = fencePts.map(p => ({ x: toSvgX(p.easting), y: toSvgY(p.northing) }))
    svg += svgFenceLine(
      fencePts,
      toSvgX,
      toSvgY,
      fo.type as 'fence_on_boundary' | 'chain_link' | 'board_fence' | 'iron_fence' | 'galv_iron' | 'no_fence' | 'end_of_fence' | 'end_of_bf'
    )

    if (fo.offsetMetres > 0) {
      const midE = (from.easting + to.easting) / 2
      const midN = (from.northing + to.northing) / 2
      const sx = toSvgX(midE)
      const sy = toSvgY(midN)
      const ex = toSvgX(offsetPointPerpendicular(from, to, fo.offsetMetres).easting)
      const ey = toSvgY(offsetPointPerpendicular(from, to, fo.offsetMetres).northing)
      svg += svgFenceCallout(sx, sy, ex, ey, fo.offsetMetres)
    }
  }

  svg += this.drawFenceLegend(Array.from(renderedTypes))
  return svg
}
```

- [ ] **Step 3: Add `drawFenceLegend` method**

Add after `drawFenceOffsets`:

```typescript
private drawFenceLegend(types: string[]): string {
  if (types.length === 0) return ''
  const x = this.drawingX + this.drawingAreaW - mmToPx(30)
  const y = this.drawingY + mmToPx(5)
  let svg = `<rect x="${x - mmToPx(1)}" y="${y - mmToPx(3)}" width="${mmToPx(28)}" height="${mmToPx(4 + types.length * 4)}" fill="white" fill-opacity="0.9" stroke="${C_BLACK}" stroke-width="0.3"/>`
  svg += `<text x="${x}" y="${y}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">FENCE TYPES</text>`
  types.forEach((t, i) => {
    svg += `<text x="${x}" y="${y + (i + 1) * mmToPx(4)}" font-family="Share Tech Mono, Courier New" font-size="4.5" fill="#555">${t.replace(/_/g, ' ')}</text>`
  })
  return svg
}
```

Make sure `C_BLACK` and `mmToPx` are imported/accessible in renderer.ts.

- [ ] **Step 4: Update render() to include drawFenceOffsets**

Find the `render()` method and add `drawFenceOffsets()` after `drawAdjacentLotPlanRefs()`:

```typescript
layers.push(this.drawAdjacentLotPlanRefs())
layers.push(this.drawFenceOffsets())  // ADD
layers.push(this.drawLotNumber())
```

- [ ] **Step 5: Add renderer tests for fence offsets**

Add to `renderer.test.ts`:

```typescript
it('renders fence offsets when provided', () => {
  const dataWithFence = {
    ...BASE_DATA,
    fenceOffsets: [
      { segmentIndex: 0, type: 'chain_link', offsetMetres: 1.5 },
      { segmentIndex: 1, type: 'board_fence', offsetMetres: 2.0 },
    ],
  }
  const renderer = new SurveyPlanRenderer(dataWithFence)
  const svg = renderer.render()
  expect(svg).toContain('FENCE TYPES')
})

it('returns empty string for fence offsets when none provided', () => {
  const renderer = new SurveyPlanRenderer(BASE_DATA)
  const result = (renderer as any).drawFenceOffsets()
  expect(result).toBe('')
})
```

- [ ] **Step 6: Run tests**

```bash
npm test -- --testPathPattern="surveyPlan/__tests__/renderer" --run 2>&1
```

All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/reports/surveyPlan/renderer.ts src/lib/reports/surveyPlan/__tests__/renderer.test.ts
git commit -m "feat(plan): wire fence offsets into renderer — chain link, board fence, callouts, legend"
```

---

## Task 3: Canvas Rotation via northRotationDeg

**Files:**
- Modify: `src/lib/reports/surveyPlan/renderer.ts`
- Add tests: `src/lib/reports/surveyPlan/__tests__/renderer.test.ts`

`rotatePoints()` already exists in geometry.ts. We need to apply it to the parcel boundary before computing scale and rendering. The north arrow should also visually indicate the rotation.

- [ ] **Step 1: Identify the coordinate transform section in renderer.ts**

Find `computeScale` or the section where `minE`, `maxE`, `minN`, `maxN` are computed. This is where we need to insert the rotation.

- [ ] **Step 2: Create `getTransformedPoints` method**

Add a private method that returns boundary points with rotation applied:

```typescript
private getTransformedPoints(): Array<{ easting: number; northing: number }> {
  const pts = this.data.parcel.boundaryPoints
  const rotDeg = this.data.project.northRotationDeg || 0
  if (rotDeg === 0) return pts
  const { minE, maxE, minN, maxN } = boundingBox(pts)
  const cx = (minE + maxE) / 2
  const cy = (minN + maxN) / 2
  return rotatePoints(pts, rotDeg, cx, cy)
}
```

- [ ] **Step 3: Update all rendering methods to use rotated points**

Replace all `this.data.parcel.boundaryPoints` references in the render loop with `this.getTransformedPoints()` — but ONLY in the drawing methods, NOT in fence offset computation (fence offsets should use real-world coordinates).

Key methods to update:
- `drawLotFill()` — use rotated pts for polyline
- `drawBoundary()` — use rotated pts for polyline
- `drawBoundaryLabels()` — use rotated pts for bearing/distance calc
- `drawMonuments()` — use rotated pts for monument positions
- `drawAreaLabel()` — use rotated pts for centroid
- `drawLotNumber()` — use rotated pts for centroid
- `drawAdjacentLabels()` — use rotated pts for parcel centroid comparison

DO NOT update `drawFenceOffsets()` or any method that needs real-world coordinates.

- [ ] **Step 4: Update north arrow to show rotation**

In `drawNorthArrow()`, add a rotation transform to visually show the rotation:

```typescript
private drawNorthArrow(): string {
  const rotDeg = this.data.project.northRotationDeg || 0
  const nx = this.drawingX + mmToPx(10)
  const ny = this.drawingY + this.drawingAreaH - mmToPx(10)
  const arrowLen = 15
  const svg = [
    `<g transform="translate(${nx},${ny})">`,
    rotDeg !== 0 ? `<g transform="rotate(${rotDeg})">` : '',
    `<line x1="0" y1="0" x2="0" y2="${-arrowLen}" stroke="${C_BLACK}" stroke-width="0.8"/>`,
    `<polygon points="0,${-arrowLen} -3,${-arrowLen + 5} 3,${-arrowLen + 5}" fill="${C_BLACK}"/>`,
    rotDeg !== 0 ? '</g>' : '',
    rotDeg !== 0 ? `<text x="0" y="${arrowLen + 4}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="4" fill="#555">${rotDeg.toFixed(1)}°</text>` : '',
    `<text x="0" y="${arrowLen + 4}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">N</text>`,
    '</g>',
  ].join('')
  return svg
}
```

- [ ] **Step 5: Add tests**

Add to `renderer.test.ts`:

```typescript
it('applies north rotation when northRotationDeg is set', () => {
  const dataWithRotation = {
    ...BASE_DATA,
    project: { ...BASE_DATA.project, northRotationDeg: 15 },
  }
  const renderer = new SurveyPlanRenderer(dataWithRotation)
  const svg = renderer.render()
  expect(svg).toContain('15')
  expect(svg).toContain('N')
})
```

- [ ] **Step 6: Run tests**

```bash
npm test -- --testPathPattern="surveyPlan/__tests__/renderer" --run 2>&1
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/reports/surveyPlan/renderer.ts src/lib/reports/surveyPlan/__tests__/renderer.test.ts
git commit -m "feat(plan): apply northRotationDeg coordinate rotation — parcel rotates, north arrow shows angle"
```

---

## Task 4: PIN Labels on Lot Face

**Files:**
- Modify: `src/lib/reports/surveyPlan/renderer.ts`
- Add tests: `src/lib/reports/surveyPlan/__tests__/renderer.test.ts`

`Parcel.pin` field already exists in types.ts (line 96). Not yet rendered.

- [ ] **Step 1: Add `drawPinLabel` method**

Add after `drawLotNumber()`:

```typescript
private drawPinLabel(): string {
  const pin = this.data.parcel.pin
  if (!pin) return ''
  const pts = this.getTransformedPoints()
  const { minE, maxE, minN, maxN } = boundingBox(pts)
  const cx = this.toSvgX((minE + maxE) / 2)
  const cy = this.toSvgY((minN + maxN) / 2)
  const tw = pin.length * 7 + 8
  const th = 12
  let svg = `<rect x="${cx - tw/2}" y="${cy - th/2}" width="${tw}" height="${th}" fill="#FFF8DC" stroke="${C_BLACK}" stroke-width="0.5" opacity="0.7"/>`
  svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="8" font-weight="bold" fill="${C_BLACK}">PIN: ${escapeXml(pin)}</text>`
  return svg
}
```

Make sure `escapeXml` is imported from `./geometry`.

- [ ] **Step 2: Update render() to include drawPinLabel**

Add after `drawLotNumber()` in the layers array:

```typescript
layers.push(this.drawLotNumber())
layers.push(this.drawPinLabel())  // ADD
layers.push(this.drawAreaLabel())
```

- [ ] **Step 3: Add tests**

```typescript
it('renders PIN label when parcel has pin', () => {
  const dataWithPin = {
    ...BASE_DATA,
    parcel: { ...BASE_DATA.parcel, pin: 'KRN-12345' },
  }
  const renderer = new SurveyPlanRenderer(dataWithPin)
  const svg = renderer.render()
  expect(svg).toContain('PIN: KRN-12345')
})

it('does not render PIN label when not provided', () => {
  const renderer = new SurveyPlanRenderer(BASE_DATA)
  const svg = renderer.render()
  expect(svg).not.toContain('PIN:')
})
```

- [ ] **Step 4: Run tests, commit**

```bash
npm test -- --testPathPattern="surveyPlan/__tests__/renderer" --run 2>&1
git add src/lib/reports/surveyPlan/renderer.ts src/lib/reports/surveyPlan/__tests__/renderer.test.ts
git commit -m "feat(plan): add PIN label rendering on lot face"
```

---

## Task 5: Part Labels (PART 1, PART 2) for Multi-Part Parcels

**Files:**
- Modify: `src/lib/reports/surveyPlan/renderer.ts`
- Add tests: `src/lib/reports/surveyPlan/__tests__/renderer.test.ts`

`Parcel.parts[]` field already exists in types.ts (line 97). Not yet rendered.

- [ ] **Step 1: Add `drawPartLabels` method**

Add after `drawPinLabel()`:

```typescript
private drawPartLabels(): string {
  const parts = this.data.parcel.parts
  if (!parts || parts.length === 0) return ''
  const pts = this.getTransformedPoints()
  const { minE, maxE, minN, maxN } = boundingBox(pts)
  const cx = this.toSvgX((minE + maxE) / 2)
  const cy = this.toSvgY((minN + maxN) / 2)
  let svg = ''
  parts.forEach((part, i) => {
    const offset = (i - (parts.length - 1) / 2) * 15
    svg += `<text x="${cx}" y="${cy + offset}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="10" font-weight="bold" fill="${C_BLACK}" opacity="0.5">${escapeXml(part)}</text>`
  })
  return svg
}
```

- [ ] **Step 2: Update render() to include drawPartLabels**

Add after `drawPinLabel()` in the layers array:

```typescript
layers.push(this.drawPinLabel())
layers.push(this.drawPartLabels())  // ADD
layers.push(this.drawAreaLabel())
```

- [ ] **Step 3: Add tests**

```typescript
it('renders part labels when parcel has parts', () => {
  const dataWithParts = {
    ...BASE_DATA,
    parcel: { ...BASE_DATA.parcel, parts: ['PART 1', 'PART 2'] },
  }
  const renderer = new SurveyPlanRenderer(dataWithParts)
  const svg = renderer.render()
  expect(svg).toContain('PART 1')
  expect(svg).toContain('PART 2')
})
```

- [ ] **Step 4: Run tests, commit**

```bash
npm test -- --testPathPattern="surveyPlan/__tests__/renderer" --run 2>&1
git add src/lib/reports/surveyPlan/renderer.ts src/lib/reports/surveyPlan/__tests__/renderer.test.ts
git commit -m "feat(plan): add PART labels for multi-part parcels"
```

---

## Task 6: Association Stamp Block (Bottom-Left)

**Files:**
- Modify: `src/lib/reports/surveyPlan/renderer.ts`
- Add tests: `src/lib/reports/surveyPlan/__tests__/renderer.test.ts`

The Kenyan Surveyors body (Institution of Surveyors of Kenya - ISK) often requires an association stamp block. This goes in the bottom-left of the drawing area, above the sheet footer.

- [ ] **Step 1: Add `drawAssociationStamp` method**

Add after `drawPartLabels()`:

```typescript
private drawAssociationStamp(): string {
  const firmName = this.data.project.firm_name || ''
  if (!firmName) return ''
  const x = this.drawingX + mmToPx(3)
  const y = this.drawingY + this.drawingAreaH - mmToPx(3)
  const w = mmToPx(40)
  const h = mmToPx(18)
  const svg = [
    `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`,
    `<line x1="${x}" y1="${y - h * 0.6}" x2="${x + w}" y2="${y - h * 0.6}" stroke="${C_BLACK}" stroke-width="0.3"/>`,
    `<text x="${x + w/2}" y="${y - h * 0.8}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="4.5" font-weight="bold" fill="${C_BLACK}">SURVEYORS ASSOCIATION STAMP</text>`,
    `<text x="${x + w/2}" y="${y - h * 0.35}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(firmName)}</text>`,
    `<text x="${x + w/2}" y="${y - h * 0.15}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="4" fill="#555">Approved: ____________</text>`,
  ].join('')
  return svg
}
```

- [ ] **Step 2: Update render() to include drawAssociationStamp**

Add after `drawPartLabels()`:

```typescript
layers.push(this.drawPartLabels())
layers.push(this.drawAssociationStamp())  // ADD
layers.push(this.drawAreaLabel())
```

- [ ] **Step 3: Add tests**

```typescript
it('renders association stamp when firm_name is provided', () => {
  const dataWithFirm = {
    ...BASE_DATA,
    project: { ...BASE_DATA.project, firm_name: 'GeoTech Surveys Ltd' },
  }
  const renderer = new SurveyPlanRenderer(dataWithFirm)
  const svg = renderer.render()
  expect(svg).toContain('SURVEYORS ASSOCIATION STAMP')
  expect(svg).toContain('GeoTech Surveys Ltd')
})

it('does not render association stamp when firm_name is absent', () => {
  const renderer = new SurveyPlanRenderer(BASE_DATA)
  const svg = renderer.render()
  expect(svg).not.toContain('SURVEYORS ASSOCIATION STAMP')
})
```

- [ ] **Step 4: Run tests, commit**

```bash
npm test -- --testPathPattern="surveyPlan/__tests__/renderer" --run 2>&1
git add src/lib/reports/surveyPlan/renderer.ts src/lib/reports/surveyPlan/__tests__/renderer.test.ts
git commit -m "feat(plan): add association stamp block in bottom-left of drawing area"
```

---

## Task 7: Multi-Sheet Support

**Files:**
- Modify: `src/lib/reports/surveyPlan/renderer.ts`
- Add tests: `src/lib/reports/surveyPlan/__tests__/renderer.test.ts`

When `totalSheets > 1`, the plan must be split across multiple A3 pages. Each sheet shows a portion of the drawing with appropriate overlap and sheet numbering.

- [ ] **Step 1: Add `renderSheet` method**

Add a method that renders a single sheet (a portion of the drawing):

```typescript
private renderSheet(sheetIndex: number, totalSheets: number): string {
  const pts = this.getTransformedPoints()
  const { minE, maxE, minN, maxN } = boundingBox(pts)
  const rawW = maxE - minE
  const rawH = maxN - minN
  const drawingAreaW = this.drawingAreaW
  const drawingAreaH = this.pageH - this.margin * 2 - this.footerH - this.panelW
  const scale = Math.min(drawingAreaW / rawW, drawingAreaH / rawH) * 0.85

  const cols = Math.ceil(Math.sqrt(totalSheets))
  const rows = Math.ceil(totalSheets / cols)
  const sheetCol = sheetIndex % cols
  const sheetRow = Math.floor(sheetIndex / cols)

  const sheetDrawW = rawW * scale / cols
  const sheetDrawH = rawH * scale / rows
  const sheetOriginX = minE - rawW / 2 + sheetCol * rawW / cols
  const sheetOriginY = minN - rawH / 2 + sheetRow * rawH / rows

  const toSvgX = (m: number) => this.drawingX + (m - sheetOriginX) * (drawingAreaW / sheetDrawW)
  const toSvgY = (m: number) => this.drawingY + (m - sheetOriginY) * (drawingAreaH / sheetDrawH)

  let svg = this.drawBackground()
  svg += this.drawSheetBorder()

  svg += this.drawLotFill(toSvgX, toSvgY, pts)
  svg += this.drawBoundary(toSvgX, toSvgY, pts)
  svg += this.drawBoundaryLabels(toSvgX, toSvgY, pts)
  svg += this.drawMonuments(toSvgX, toSvgY, pts)
  svg += this.drawSheetFooter()

  const sheetLabel = `Sheet ${sheetIndex + 1} of ${totalSheets}`
  svg += `<text x="${this.drawingX + this.drawingAreaW - 5}" y="${this.drawingY + 12}" text-anchor="end" font-family="Share Tech Mono, Courier New" font-size="8" font-weight="bold" fill="${C_BLACK}">${sheetLabel}</text>`

  return svg
}

private drawLotFill(toSvgX: (m: number) => number, toSvgY: (m: number) => number, pts: Array<{ easting: number; northing: number }>): string {
  if (pts.length < 3) return ''
  const coords = pts.map(p => `${toSvgX(p.easting)},${toSvgY(p.northing)}`).join(' ')
  return `<polygon points="${coords}" fill="#F4EDD5" stroke="none"/>`
}

private drawBoundary(toSvgX: (m: number) => number, toSvgY: (m: number) => number, pts: Array<{ easting: number; northing: number }>): string {
  if (pts.length < 2) return ''
  const coords = pts.map(p => `${toSvgX(p.easting)},${toSvgY(p.northing)}`).join(' ')
  return `<polyline points="${coords} ${toSvgX(pts[0].easting)},${toSvgY(pts[0].northing)}" fill="none" stroke="${C_BLACK}" stroke-width="2.5"/>`
}
```

- [ ] **Step 2: Add `renderMultiSheet` method**

```typescript
renderMultiSheet(): string {
  const totalSheets = parseInt(this.data.project.totalSheets || '1', 10)
  if (totalSheets <= 1) return this.render()
  const sheets: string[] = []
  for (let i = 0; i < totalSheets; i++) {
    sheets.push(this.renderSheet(i, totalSheets))
  }
  return sheets.join('\n')
}
```

- [ ] **Step 3: Update render() to call renderMultiSheet**

Replace the `render()` method body with:

```typescript
render(): string {
  const totalSheets = parseInt(this.data.project.totalSheets || '1', 10)
  if (totalSheets > 1) return this.renderMultiSheet()
  // ... existing single-sheet code ...
}
```

- [ ] **Step 4: Add tests**

```typescript
it('renders multiple sheets when totalSheets > 1', () => {
  const dataMultiSheet = {
    ...BASE_DATA,
    project: { ...BASE_DATA.project, sheetNo: '1', totalSheets: '4' },
  }
  const renderer = new SurveyPlanRenderer(dataMultiSheet)
  const svg = renderer.render()
  expect(svg).toContain('Sheet 1 of 4')
  expect(svg).toContain('Sheet 4 of 4')
})
```

- [ ] **Step 5: Run tests, commit**

```bash
npm test -- --testPathPattern="surveyPlan/__tests__/renderer" --run 2>&1
git add src/lib/reports/surveyPlan/renderer.ts src/lib/reports/surveyPlan/__tests__/renderer.test.ts
git commit -m "feat(plan): add multi-sheet support for large parcels — renders N A3 sheets"
```

---

## Task 8: Bearing Schedule CSV Export Utility

**Files:**
- Create: `src/lib/reports/bearingScheduleCSV.ts`
- Modify: `src/lib/reports/surveyPlan/renderer.ts` (add method that returns CSV string)

- [ ] **Step 1: Create generateBearingScheduleCSV utility**

Create `src/lib/reports/bearingScheduleCSV.ts`:

```typescript
import type { SurveyPlanData } from './surveyPlan/types'
import { bearingFromDelta, distance, formatBearingDegMinSec } from './surveyPlan/geometry'

export function generateBearingScheduleCSV(data: SurveyPlanData): string {
  const pts = data.parcel.boundaryPoints
  const entries = data.project.bearingSchedule || []
  const rows = entries.length > 0 ? entries : pts.map((pt, i) => {
    const to = pts[(i + 1) % pts.length]
    const dist = distance(pt.easting, pt.northing, to.easting, to.northing)
    const bearingDeg = bearingFromDelta(to.easting - pt.easting, to.northing - pt.northing)
    return {
      from: pt.name,
      to: to.name,
      bearing: formatBearingDegMinSec(bearingDeg),
      distance: dist.toFixed(3),
    }
  })

  const lines = ['From,To,Bearing,Distance (m)']
  for (const row of rows) {
    lines.push(`${row.from},${row.to},${row.bearing},${row.distance}`)
  }
  return lines.join('\n')
}
```

- [ ] **Step 2: Add `exportToCSV` method on SurveyPlanRenderer**

Add to `renderer.ts`:

```typescript
exportToCSV(): string {
  return generateBearingScheduleCSV(this.data)
}
```

Also add to the export at the bottom of `renderer.ts`:
```typescript
export { SurveyPlanRenderer, generateBearingScheduleCSV }
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/reports/bearingScheduleCSV.ts src/lib/reports/surveyPlan/renderer.ts
git commit -m "feat(plan): add bearing schedule CSV export utility"
```

---

## Task 9: CSV Download + Print Buttons in SurveyPlanViewer

**Files:**
- Modify: `src/components/SurveyPlanViewer.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Read SurveyPlanViewer.tsx**

Find where the download button is implemented. It currently downloads the SVG.

- [ ] **Step 2: Add CSV download button**

Add a second button in the toolbar (after the SVG download button):

```typescript
const handleDownloadCSV = () => {
  if (!rendererRef.current) return
  const csv = rendererRef.current.exportToCSV()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${data.project.name || 'survey-plan'}-bearing-schedule.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 3: Add CSV download button to JSX**

Find the existing download button in the toolbar and add a CSV button next to it:

```tsx
<button onClick={handleDownloadCSV} className="px-3 py-1.5 bg-green-600 text-white rounded text-sm">
  Download CSV
</button>
```

- [ ] **Step 4: Add print button**

```typescript
const handlePrint = () => window.print()
```

```tsx
<button onClick={handlePrint} className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm">
  Print
</button>
```

- [ ] **Step 5: Add print CSS to globals.css**

Add to `src/app/globals.css`:

```css
@media print {
  @page {
    size: A3 landscape;
    margin: 10mm;
  }

  body {
    background: white;
  }

  .no-print {
    display: none !important;
  }

  svg[name="survey-plan"] {
    width: 100% !important;
    height: auto !important;
    max-width: 100%;
    page-break-after: always;
  }

  @media print and (max-width: 420mm) {
    svg[name="survey-plan"] {
      transform: scale(0.9);
      transform-origin: top left;
    }
  }
}
```

- [ ] **Step 6: Run build to verify**

```bash
npm run build 2>&1
```

- [ ] **Step 7: Commit**

```bash
git add src/components/SurveyPlanViewer.tsx src/app/globals.css
git commit -m "feat(plan): add CSV download and print buttons to SurveyPlanViewer with print CSS"
```

---

## Task 10: Update Demo Page with Phase 2 Mock Data

**Files:**
- Modify: `src/app/tools/survey-plan-demo/page.tsx`

- [ ] **Step 1: Update demo data with Phase 2 fields**

Add to the demo `SurveyPlanData`:
- `fenceOffsets` with 2-3 entries
- `northRotationDeg: 0` (or try `10` to test rotation)
- `pin: 'KRN-2024-001'`
- `parts: ['PART 1']`
- `sheetNo: '1'`, `totalSheets: '1'`
- `firm_name: 'GeoTech Surveyors Ltd'`

- [ ] **Step 2: Commit**

```bash
git add src/app/tools/survey-plan-demo/page.tsx
git commit -m "feat(plan): update demo page with Phase 2 mock data — fence offsets, PIN, rotation, firm name"
```

---

## Task 11: Phase 2 Final Verification

- [ ] **Run full test suite:**

```bash
npm test 2>&1
```

Expected: all suites pass, test count increases by ~15 new tests.

- [ ] **Run build:**

```bash
npm run build 2>&1
```

Expected: zero errors.

- [ ] **Visual verification** at `/tools/survey-plan-demo` — check:
  - Fence offset lines + dimension callouts (when `fenceOffsets` provided)
  - Fence type legend box
  - Canvas rotation when `northRotationDeg > 0`
  - PIN label on lot face
  - PART labels (when `parts` provided)
  - Association stamp block (when `firm_name` provided)
  - Multi-sheet when `totalSheets > 1`
  - CSV download button works
  - Print button works

---

## Phase 2 Summary

| Task | Status |
|------|--------|
| Fence offset geometry helpers | ⏳ |
| Wire fence offsets into renderer | ⏳ |
| Canvas rotation via northRotationDeg | ⏳ |
| PIN labels on lot face | ⏳ |
| Part labels (PART 1, PART 2) | ⏳ |
| Association stamp block bottom-left | ⏳ |
| Multi-sheet support | ⏳ |
| Bearing schedule CSV export utility | ⏳ |
| CSV download + print buttons | ⏳ |
| Update demo page | ⏳ |
| Full verification | ⏳ |

(End of file)
