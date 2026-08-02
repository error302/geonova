---
title: Cut Fill Visualization
tags: [cutfill, earthworks, heatmap, visualization]
---

# Cut Fill Visualization

TIN-based earthworks cut/fill computation with a professional grid heat map.

## Files
- `src/app/tools/cut-fill/page.tsx` — tool page
- `src/components/tools/CutFillHeatMap.tsx` — NEW heat map component
- `src/lib/survey/surfaceTIN.ts` — engine: `buildTIN`, `computeCutFill`, `computeStockpileVolume`

## Heat Map
`CutFillResult.cells` (per-cell x/y/diff) rendered as a color-graded grid:
- **Red** = CUT (ground above design — material to remove)
- **Blue** = FILL (ground below design — material to add)
- Neutral = no difference

Plus:
- Grid frame with coordinate ticks + corner refs
- Scale bar, north arrow, title block
- Discrete legend (9 steps cut→fill)
- Sampled-area boundary (dashed)
- Export JSON button on results card

## Related
- [[Contour Map Rendering]]
- [[Compute Limits & METARDU Desktop]]
