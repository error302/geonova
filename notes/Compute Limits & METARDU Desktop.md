---
title: Compute Limits & METARDU Desktop
tags: [compute, limits, desktop, worker]
---

# Compute Limits & METARDU Desktop

How web tools signal their resource limits and point to the desktop app.

## ComputeLimitNotice
`src/components/tools/ComputeLimitNotice.tsx` — reusable, dismissible banner.
- Headline: "Heavy compute requires METARDU Desktop"
- Badge shows point limit (e.g. `Limit 100,000 pts`)
- Blue gradient card, MonitorDown icon

Wired into:
- `point-cloud-import` (hard cap `MAX_POINTS = 100_000`)
- `cut-fill`
- `contour-generator`

## TIN Worker Crash Fallback
`src/lib/workers/tinWorkerClient.ts`:
- `PendingHandler` stores `op` + `payload`
- On `workerInstance.onerror`, in-flight requests resolve via `syncFallback()` (sync engine) instead of rejecting with "Worker crashed"
- `_forceSyncModeForTests` for testability

## Related
- [[METARDU Desktop]]
- [[Contour Map Rendering]]
