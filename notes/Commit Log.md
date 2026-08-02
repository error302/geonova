---
title: Commit Log
tags: [git, changelog, history]
---

# Commit Log

## Working Session — 2026-08-02 (current)
Work in progress, not yet committed. Changes:

### AI Assistant & Navigation
- Assistant removed from top nav (`navigation-shell.ts`, `NavBar.tsx`)
- Assistant added to Community page (quick action + sidebar card)
- Assistant added to dashboard sidebar (`AppSidebar.tsx`)

### Professional Visualizations
- **Contour map**: hypsometric tint bands, discrete legend swatches, corner coords, title block (`MapTab.tsx`, `generators.ts`, `helpers.ts`)
- **Cut & fill**: new `CutFillHeatMap` grid heat map + JSON export (`CutFillHeatMap.tsx`, `cut-fill/page.tsx`)
- **Curves**: new `SimpleCurveDiagram` plan view (PI/PC/PT, T/L/C/E/M, Δ) + `VerticalCurveProfile` (parabola, BVC/VPI/EVC, grades) wired into curves tool + road-design horizontal & vertical tabs

### Compute Limits / METARDU Desktop
- New `ComputeLimitNotice` banner (point-cloud-import 100k cap, cut-fill, contour-generator)

### Observability
- Python worker structured JSON logging (request_id, task, latency, status) + rotating file handler (`python_worker/main.py`)

### Docs
- Obsidian-style vault in `notes/`

## Earlier
- `010bef2` — `feat(ai): Survey Assistant UI + dashboard onboarding workflow` (8 files, +638/-61)
- `64ed773` — previous audit fixes (27 files, +544/-173)

## Related
- [[METARDU Home]]
