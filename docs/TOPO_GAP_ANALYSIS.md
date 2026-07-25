# Topographic Plan Renderer — Gap Analysis vs LinkedIn Professional Standard

**Date:** 2026-07-07
**Reference:** LinkedIn topographic survey plan image (Kenya SoK-style)
**Current renderer:** `src/lib/reports/topoPlanRenderer.ts` (431 lines, `renderTopoPlanSVG`)

---

## Legend Gap: Current vs Reference

### Current Legend (`drawLegend`, lines 330–359)
Produces a simple 4-item legend:
1. Index contour (bold line, 0.8px, #333)
2. Intermediate contour (thin line, 0.3px, #999)
3. Spot height (filled circle, r=1)
4. Control point (triangle outline, red)

Missing entirely:
- Contour interval table
- Scale ratio breakdown
- Drainage section
- Structures section (Major / Minor / Wood)
- Boundary with color swatch
- Feature symbols with pictograms (tree, gardening, line trees, pipe, power)
- Professional graphics section

---

## Reference Legend Breakdown

### Section 1: CONTOUR INTERVAL TABLE
```
CONTOUR INTERVAL
┌─────────────────────────────────┐
│ CONTOUR INTERVAL                │
│ Major Interval (Index)      +5m │
│ Minor Interval (Intermediate)+0.5m│
│ Spot Heights   1:50 1:100 1:200│
└─────────────────────────────────┘
```

### Section 2: DRAINAGE
```
DRAINAGE
────────
Open Drain      ───────           [blue dashed]
Perimeter Wall  ━━━━━━━           [brown solid thick]
```

### Section 3: STRUCTURES
```
STRUCTURES
──────────
Major Structure     ■■■■           [filled brown]
Minor Structure     ■ ■            [cross-hatch]
Structure (Wood)    ▒▒▒▒           [stipple]
```

### Section 4: FEATURES
```
FEATURES
────────
Boundary           ────           [black dashes]
Tree                ◎             [circle with dot]
Gardening Meter    ⊙               [circled dot]
Line Trees          ◎─◎─◎          [circle with trunk line]
Pipe Line P        Ⓟ               [P in red circle]
Power Line TY1     ⊥─⊥─⊥           [T/Y1 marker per span]
Gardening Birds    ≋               [wave]
Gardening Marker   ◇               [diamond]
```

### Section 5: PROFESSIONAL GRAPHICS
```
PROFESSIONAL GRAPHICS
─────────────────────
Major Contour      ────           [brown solid]
Minor Contour      ─ ─ ─          [brown dashed]
```

---

## Title Block Gap

### Current Title Block (lines 362–417)
Three-column layout:
- Col 1: PROJECT, LOCATION, SURVEY NO., SCALE
- Col 2: SURVEYOR, ISK LICENSE, FIRM, DATE
- Col 3: DATUM, PROJECTION (with EPSG code), CONTOUR INTERVAL, COMPLIANCE

**Missing:**
- **Magnetic Declination** — not shown; survey plans must show MN-N difference
- **Surveyor's Signature block** — no placeholder for wet-ink signature
- **Survey date formatting** — plain string, not formatted per SoK standard
- **UTM zone notation** — EPSG codes are approximate; should show full projection name
- **Grid convergence** — not shown

---

## North Arrow Gap

### Current (lines 286–298)
- Half-black / half-white survey arrow
- No magnetic declination annotation
- No convergence angle annotation
- No label (true north vs magnetic north)

### Should show:
- True North arrow with "N" label
- Magnetic North arrow with "MN" label
- Declination angle (e.g., "δ 0°30'E") and year of epoch
- Grid Convergence angle (e.g., "γ 0°15'W")

---

## Scale Bar Gap

### Current (lines 299–329)
- Simple alternating black/white bar
- Ratio notation (1:1000)
- No indication of ground distance per subdivision

### Should show:
- Meters per subdivision (e.g., "0m  10m  20m  30m  40m  50m")
- Multiple scale ratios on one bar (for reduction/enlargement)
- RF notation with both ratio AND bar equivalent
- Equivalent scale for A3/A4 paper reduction

---

## Additional Gaps

### 1. Coordinate Grid Labels
- Current has easting/northing labels on grid lines
- Missing: coordinate precision notation (e.g., "Easting (m)" with 3 decimal places)
- Missing: grid tick labels at corners

### 2. Location Diagram (Kenya Map Inset)
- Comment mentions it (line 12 of header) but not implemented
- Should show site location within Kenya/County map
- Should show sheet number reference

### 3. RIM Overlay Details
- Noted in header but not rendered
- Needs: RIM point markers, RIM boundary overlay, RIM label annotations

### 4. Contour Labels
- Current `ContourLine` type has elevation, but no labels placed on contours
- Should place elevation labels at regular intervals along index contours

### 5. Spot Height Symbol Variety
- Current: single circle
- Should support: key spot heights (larger, bold), intermediate spots (smaller), bench marks (with BM label)

### 6. Surveyor Signature Block
- Not in current renderer
- Should have: Signature line, Name (print), ISK No., Date, Firm stamp area

---

## Priority Order for Fix

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Comprehensive legend (all 5 sections) | Medium | High — visual compliance |
| P0 | Magnetic declination on north arrow | Low | High — regulatory requirement |
| P0 | Scale bar with ground distance labels | Low | High — usability |
| P1 | Title block: signature block + declination | Low | High — legal compliance |
| P1 | Contour elevation labels on index contours | Medium | Medium — readability |
| P2 | Location diagram inset | High | Medium — completeness |
| P2 | RIM overlay rendering | Medium | Low — not always required |
| P3 | Spot height variety (key/BM) | Low | Low — nice to have |

---

## Files Affected

- `src/lib/reports/topoPlanRenderer.ts` — main renderer
- `src/lib/engine/contours.ts` — ContourLine/SpotHeight type definitions
- `src/types/topo.ts` — TopoPlanInput/TopoPlanOutput (if split out)