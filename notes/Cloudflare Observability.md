---
title: Cloudflare Observability
tags: [cloudflare, observability, logging, worker]
---

# Cloudflare Observability

Observability for the METARDU compute worker and Cloudflare tunnel.

## Compute Worker Logging
`python_worker/main.py` now uses **structured JSON logging**:

- `metardu.worker` logger with a `JsonFormatter` → every line is machine-parseable JSON
- Fields: `ts`, `level`, `logger`, `msg`, plus optional `request_id`, `task`, `path`, `method`, `status`, `latency_ms`, `points`
- `RotatingFileHandler` to `/tmp/metardu-worker.log` (5MB × 2 backups) for retention
- Console handler for `docker compose logs -f metardu-worker`

### New log events
- `request` — every HTTP request (request_id, path, method, status, latency_ms)
- `compute_ok` — successful task (task, latency_ms, points)
- `compute_error` — task failure with traceback
- `auth_rejected` — 403 auth failures
- `unknown_task` — invalid task names

### Correlation
- `X-Request-Id` header accepted from callers (falls back to generated `uuid4().hex[:12]`)

## Cloudflare
- No METARDU Worker deployed (the only Workers are `safaritech` and `kicksmtaani`)
- METARDU uses a **cloudflared tunnel** to the VM — logs live in the VM, not CF Workers Logs
- See [[Deployment VM]] for tunnel notes

## Related
- [[Deployment VM]]
- [[Docker Build]]
