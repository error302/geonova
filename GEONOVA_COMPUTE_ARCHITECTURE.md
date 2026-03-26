# GeoNova — Two-Tier Compute Architecture

GeoNova uses **two computation layers**:

## 1) TypeScript Survey Engine (Primary)

Location: `C:\Users\ADMIN\Desktop\Survey -ENG\src\lib\engine`

Rules:
- Deterministic textbook math only (Basak/Ghilani/Wolf).
- Must work offline.
- No intermediate rounding; round only at display.

Examples:
- distance/bearing, traverse (Bowditch/Transit), leveling (RF/HOC)
- area computations
- coordinate conversions
- cross-section volumes (`src/lib/engine/volume.ts`)
- field book live calculations

## 2) Python Compute Service (Secondary, Optional)

Used only for **heavy** geospatial/scientific workloads:
- TIN / terrain modeling
- raster/DEM analysis
- bathymetric surface modeling
- large network least squares / matrix-heavy adjustments
- point cloud operations / orthophoto processing

Python is **never** in the critical path for core survey formulas.

### Configuration

Set either environment variable:
- `PYTHON_COMPUTE_URL` (preferred)
- `PYTHON_SERVICE_URL` (legacy; still supported)

If not set, **Python-only** compute endpoints return `503` with `python_required: true`.

## Compute Gateway API (Next.js)

### Generic gateway
- `POST /api/compute`

Body:
```json
{ "task": "tin", "payload": { } }
```

### Task endpoints
- `POST /api/compute/volume` (TypeScript-only: cross-sections + surface cut/fill by grid method)
- `POST /api/compute/tin`
- `POST /api/compute/contours`
- `POST /api/compute/raster-analysis`
- `POST /api/compute/seabed`
- `POST /api/compute/export/dxf` (TypeScript-only: uses `dxf-writer`)
- `POST /api/compute/export/geojson` (TypeScript-only)

### Backward compatibility

Existing `/api/python/*` endpoints re-export the corresponding `/api/compute/*` handlers.
