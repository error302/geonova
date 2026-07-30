# SoK DXF Layer Standard — METARDU Reference

**Version:** 1.0.0
**Date:** 2026-07-07
**Authority:** Survey of Kenya / Kenya Survey Standards (based on AutoCAD/LISCAD conventions used by GoK cadastral offices)
**DXF Version:** R14 / AC1014 minimum
**Status:** MANDATORY — all METARDU DXF exports must use these layers

---

## 0. Purpose

This document defines the canonical layer name, color, and linetype standard for all DXF files exported by METARDU. It aligns METARDU output with LISCAD DXF conventions so that files open correctly in AutoCAD with the correct visual appearance and layer assignment.

**Why it matters:** A surveyor who receives a METARDU DXF and opens it in AutoCAD expects to see:
- Boundary lines on a layer named `BOUNDARY` or `PARCEL_BDY` (not `WORKING` or `TOPO`)
- Beacon symbols on a layer named `BEACONS`
- Dashed lines for water courses on a layer named `WATER`
- Red boundary lines for new parcels, grey dashed for existing

Using LISCAD-standard layer names means AutoCAD users can apply their existing `.ctb` plot styles without redoing layer mappings.

---

## 1. Canonical Layer Table

### 1.1 Cadastral / Deed Plan Layers

| Layer Name | Color (ACI) | Color Name | Linetype | Description |
|---|---|---|---|---|
| `PARCEL_BDY` | 1 | Red | `CONTINUOUS` | New parcel boundary (primary) |
| `EXIST_BDY` | 8 | Gray | `DASHED` | Existing/registered boundary |
| `BEACONS` | 2 | Yellow | `CONTINUOUS` | All boundary beacons (concrete, iron pin, masonry nail) |
| `BMARK` | 3 | Green | `CONTINUOUS` | Benchmarks and vertical control marks |
| `CONTROL` | 4 | Cyan/Blue | `CONTINUOUS` | Survey control points (PSC, SSC, TSC) |
| `DIMENS` | 3 | Green | `CONTINUOUS` | Dimension lines, projection lines |
| `BEARINGS` | 3 | Green | `CONTINUOUS` | Bearing annotations (N 00°00'00"E format) |
| `DISTANCES` | 3 | Green | `CONTINUOUS` | Distance annotations (metres, 3dp) |
| `AREA_TXT` | 1 | Red | `CONTINUOUS` | Area text annotations |
| `PARCEL_TXT` | 7 | White | `CONTINUOUS` | Parcel/LR number, abuttal labels |
| `BEACON_TXT` | 7 | White | `CONTINUOUS` | Beacon labels (point names) |
| `NOTES_TXT` | 7 | White | `CONTINUOUS` | General annotations, notes |
| `TITLE_BLK` | 7 | White | `CONTINUOUS` | Title block frame and content |
| `SCL_BAR` | 7 | White | `CONTINUOUS` | Scale bar |
| `NORTH_ARR` | 7 | White | `CONTINUOUS` | North arrow |
| `GRID` | 8 | Gray | `DASHED` | UTM coordinate grid lines |

**Note on ACI colors:** DXF uses AutoCAD Color Index (ACI) values 0-255.
Standard survey colors: 1=Red, 2=Yellow, 3=Green, 4=Cyan, 5=Blue, 6=Magenta, 7=White/Black, 8=Dark Gray, 9=Light Gray.

### 1.2 Topographic / Engineering Survey Layers

| Layer Name | Color (ACI) | Color Name | Linetype | Description |
|---|---|---|---|---|
| `CONTOURS` | 4 | Cyan | `CONTINUOUS` | Minor/intermediate contour lines |
| `CONTOUR_I` | 4 | Cyan | `CONTINUOUS` | Index contours (every 5th, thicker) |
| `SPOT` | 2 | Yellow | `CONTINUOUS` | Spot heights with elevation labels |
| `TOPO_GRID` | 8 | Gray | `DASHED` | Topographic detail grid |
| `BUILDING` | 7 | White | `CONTINUOUS` | Main/permanent building outlines (0.5mm solid) |
| `BLDG_SS` | 7 | White | `DASHED` | Subsidiary building outlines (0.3mm) |
| `FENCE` | 7 | White | `DASHED` | Fence lines (chain-link, barbed wire, wall) |
| `WALL` | 7 | White | `CONTINUOUS` | Permanent wall boundaries |
| `ROAD_EDGE` | 7 | White | `CONTINUOUS` | Road kerb/edge lines |
| `ROAD_CENT` | 1 | Red | `CENTER` | Road centreline |
| `ACCESS_PTH` | 8 | Gray | `DASHED` | Access paths, tracks |
| `WATER` | 5 | Blue | `DASHED` | Water courses (perennial = solid, intermittent = dashed) |
| `DRAINAGE` | 5 | Blue | `DASHED` | Open drains, canals |
| `TREES` | 3 | Green | `CONTINUOUS` | Significant trees (with species label) |
| `UTILITY` | 1 | Red | `DASHED` | Utility lines (power, water, telecoms) |
| `PIPE` | 1 | Red | `DASHED` | Pipeline (oil, gas, water) |
| `RAIL` | 4 | Cyan | `CONTINUOUS` | Railway lines |
| `PROW` | 2 | Yellow | `DASHED` | Public right-of-way boundaries |

### 1.3 Engineering / Road Survey Layers

| Layer Name | Color (ACI) | Color Name | Linetype | Description |
|---|---|---|---|---|
| `CENTERLINE` | 1 | Red | `CONTINUOUS` | Road/street centerline |
| `CHAIN` | 3 | Green | `CONTINUOUS` | Chainage markers |
| `ROAD_CENT` | 1 | Red | `CONTINUOUS` | Road centerline |
| `KERB` | 7 | White | `CONTINUOUS` | Kerb lines |
| `XSECTION` | 6 | Magenta | `CONTINUOUS` | Cross-section lines |
| `PROFILE` | 6 | Magenta | `CONTINUOUS` | Longitudinal profile |
| `CULVERT` | 4 | Cyan | `CONTINUOUS` | Culvert symbols |
| `ROW_BDY` | 2 | Yellow | `DASHED` | Right-of-way boundaries |
| `SETOUT` | 5 | Blue | `CONTINUOUS` | Setting-out pegs |
| `CUT_EDGE` | 1 | Red | `DASHED` | Cut slope edge |
| `FILL_EDGE` | 3 | Green | `DASHED` | Fill slope edge |

### 1.4 Linetypes Required

The following linetypes must be defined in the DXF header. If a linetype is used but not defined, AutoCAD renders it as solid:

| Linetype Name | Description | Pattern |
|---|---|---|
| `DASHED` | Dashed line | `[-1.0, -0.5]` (1.0 unit dash, 0.5 unit gap) |
| `DOTTED` | Dotted line | `[-0.25, -0.25]` |
| `CENTER` | Centerline (long dash, short dash) | `[-2.0, -0.5, 0, -0.5]` |
| `PHANTOM` | Phantom/alternative | `[-2.0, -0.5, -0.5, -0.5]` |
| `CONTINUOUS` | Solid line | `[]` (no pattern) |

---

## 2. Color Standard

All METARDU DXF exports use **ACI (AutoCAD Color Index)** numbers. DXF color value 7 = White/Black (depends on background). For consistent output:

- **Parcel boundary**: Color 1 (Red) — stands out on white paper
- **Beacons**: Color 2 (Yellow) — visible against any background
- **Annotations/text**: Color 7 (White/Black) — inherits from plot style
- **Grid/coordinate lines**: Color 8 (Gray) — subtle, doesn't compete with features
- **Topographic detail**: Color 4 (Cyan) — standard topographic convention

---

## 3. Text Height Standard (metres in drawing units)

DXF text heights are in the same units as coordinates (metres). Typical heights:

| Element | Height (metres) | Notes |
|---|---|---|
| Beacon label | 1.5–2.0m | Small, near the beacon symbol |
| Bearing annotation | 1.8–2.0m | Mid-line annotation |
| Distance annotation | 1.5m | Below bearing annotation |
| Area label | 3.0–4.0m | Large, centered in parcel |
| LR Number | 2.5m | Title block |
| Title block header | 2.5–3.0m | Survey of Kenya header |
| Scale bar labels | 1.2m | Small |
| Contour elevation | 1.5m | Along contour lines |
| Abuttal label | 1.8m | Along boundary |

---

## 4. Beacon Symbol Convention

METARDU draws beacon symbols as simple geometric shapes in the `BEACONS` layer:

| Beacon Type | Symbol | Size |
|---|---|---|
| `PSC` (Primary Survey Control) | Circle with cross | 3.0m diameter |
| `SSC` / `TSC` (Secondary/Tertiary) | Circle with cross | 2.5m diameter |
| `CONCRETE_BEACON` | Square with diagonal | 2.5m |
| `IRON_PIN` | Small circle | 1.5m |
| `MASONRY_NAIL` | Small X | 1.0m |
| `WOODEN_PEG` | Triangle | 1.5m |
| `BM` (Benchmark) | Triangle pointing down | 2.0m |
| `IRP` / `RMB` | Filled circle | 1.5m |

---

## 5. Lineweight Standard (for PDF export, not DXF)

DXF does not natively support lineweights per layer in the basic DXF format. For PDF export:
- Parcel boundary: **0.50mm** (solid)
- Beacon symbol: **0.30mm**
- Minor contours: **0.20mm**
- Index contours: **0.50mm**
- Fence/road edges: **0.30mm**
- Dimensions/bearings: **0.20mm**

For DXF, lineweights are applied at print time via `.ctb` (color-dependent) or `.stb` (named) plot style tables.

---

## 6. Migration Guide (from old layer names)

The following old layer names are deprecated and replaced:

| Old Name (Removed) | New Name (Use) | Reason |
|---|---|---|
| `BOUNDARY` | `PARCEL_BDY` | More specific — separates from engineering boundary |
| `BEACON_LABELS` | `BEACON_TXT` | Consistent with LISCAD: _TXT suffix for text layers |
| `AREA_LABEL` | `AREA_TXT` | Consistent with LISCAD naming |
| `ANNOTATIONS` | `NOTES_TXT` | More specific |
| `TITLE_BLOCK` / `TITLEBLOCK` | `TITLE_BLK` | Standard abbreviation |
| `SCALE_BAR` / `SCALEBAR` | `SCL_BAR` | Standard abbreviation |
| `NORTH_ARROW` / `NORTHARROW` | `NORTH_ARR` | Standard abbreviation |
| `OLD_BOUNDARY` | `EXIST_BDY` | SoK convention: EXIST prefix |
| `NEW_BOUNDARY` | `PARCEL_BDY` | Already covered by PARCEL_BDY |
| `TRAVERSE` | `CONTROL` | Traverse lines are control traverses |
| `CONTROL_POINTS` | `CONTROL` | Consolidated |
| `CENTRELINE` | `ROAD_CENT` | More specific |
| `GRID` | `TOPO_GRID` | Distinguishes from UTM grid |
| `CONTOURS_IDX` | `CONTOUR_I` | Standard index contour abbreviation |
| `PROFILE` | `PROFILE` | Keep (engineering convention) |
| `SETOUT_POINTS` | `SETOUT` | More concise |

---

## 7. Implementation

All METARDU DXF exports must call `initialiseSokDXFLayers()` from `src/lib/drawing/dxfLayers.ts`
which registers the canonical layers with correct colors and linetypes.

```typescript
import { initialiseSokDXFLayers } from '@/lib/drawing/dxfLayers'
const drawing = new Drawing()
initialiseSokDXFLayers(drawing) // replaces initialiseDXFLayers
```