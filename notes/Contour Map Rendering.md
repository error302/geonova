---
title: Contour Map Rendering
tags: [contours, svg, cartography, visualization]
---

# Contour Map Rendering

Professional surveyor-style contour map rendering in the contour generator tool.

## Files
- `src/app/tools/contour-generator/MapTab.tsx` — on-screen SVG map
- `src/app/tools/contour-generator/generators.ts` — `generateSVGExport` (downloadable SVG)
- `src/app/tools/contour-generator/helpers.ts` — `elevationToColor`, `computeHypsometricBands`
- `src/app/tools/contour-generator/constants.ts` — SVG dimensions

## Professional Elements (this release)
- **Hypsometric tint bands** — discrete elevation relief background (USGS/National Map style), quantized per contour interval; index bands darker
- **Labeled index contours** — elevation labels rotated along the line with halo (paint-order stroke)
- **Grid lines** + coordinate tick labels (Easting/Northing)
- **Corner coordinate annotations** — full grid refs at each map corner
- **Title block** — "CONTOUR MAP" + `CI x.x m · n pts`
- **North arrow** + **scale bar**
- **Discrete elevation legend** — one swatch per band (was a continuous gradient strip)
- **Map statistics** — contour count, index count, points, interval

## Worker
Contours generated via `generateContoursAsync` from `src/lib/workers/tinWorkerClient.ts` (Web Worker TIN). The worker has a sync fallback if it crashes — see [[Compute Limits & METARDU Desktop]].

## Related
- [[Cut Fill Visualization]]
- [[Curve Diagrams]]
