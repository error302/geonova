---
title: METARDU Desktop
tags: [desktop, concept, offline, compute]
---

# METARDU Desktop

Heavy-compute desktop companion to the web app. The web tools are capped to keep every session fast; the desktop app runs the full survey engine locally.

## Why
- Web tools run in the browser or a lightweight cloud worker — point caps keep them responsive.
- Large scans (point clouds), dense TINs, batch earthworks, and mass-haul runs need the full engine.
- Offline-first: surveyors in remote Kenya locations need computation without connectivity.

## What it does
- Full survey engine on-device (same `@/lib/engine/*` code, packaged with Electron/Tauri)
- No point caps, no uploads, works offline
- Project data stays on the device
- Batch processing across whole projects

## Web-to-Desktop Signal
`src/components/tools/ComputeLimitNotice.tsx` — reusable banner shown on point-limited tools:
- `point-cloud-import` (100k point cap)
- `cut-fill`
- `contour-generator`

The banner is dismissible and points users to the desktop app.

## Status
- Concept + messaging only. No packaged binary yet.
- Banner component ships in this release; the download link placeholder is TODO.

## Related
- [[Compute Limits & METARDU Desktop]]
