---
title: Docker Build
tags: [docker, build, image, dockerignore]
---

# Docker Build

Local Docker build process for METARDU.

## Container Set
- `metardu-postgres` — postgis:15-3.3-alpine
- `metardu-worker` — Python/FastAPI
- `metardu-app` — Next.js 14.2.35
- `metardu-redis`

## Local Access
`localhost:3000` (app) / `8000` (worker) / `5432` (postgres) / `6379` (redis)

## Build Context Fix
Context was **1.9GB** because `.freebuff` (2.7GB) wasn't in `.dockerignore`. Added:
- `.freebuff`, `.graphify`, `.metardu-cache`, `.playwright-mcp`, `.claude`, `.opencode`, `agent-ctx`, `e2e`
- `competitor-analysis.json`, `kenya-*-search.json`

Context now ~120MB.

## Worker Dockerfile
`python_worker/Dockerfile` — added `COPY gnss_processor.py .` alongside `COPY main.py .` (was crashing with ModuleNotFoundError).

## Build
```bash
docker compose build metardu-app
```
Image: `metardu-metardu-app:latest` ~444MB.

## Related
- [[Deployment VM]]
- [[Cloudflare Observability]]
