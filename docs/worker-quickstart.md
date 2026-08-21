# Python Compute Worker — Quick Start

The Python worker handles heavy surface computation (TIN, contours, cut-fill volume)
and GNSS baseline processing. It runs as a Docker service alongside the Next.js app.

## One Command

```bash
# 1. Generate secrets (first time only)
cp .env.example .env
sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -base64 24)/" .env
sed -i "s/AUTH_SECRET=.*/AUTH_SECRET=$(openssl rand -base64 32)/" .env
sed -i "s/WORKER_SECRET=.*/WORKER_SECRET=$(openssl rand -base64 32)/" .env

# 2. Start everything
docker compose up -d

# 3. Verify the worker is wired correctly
./scripts/verify-worker.sh
```

That's it. The worker starts on the internal Docker network at `http://metardu-worker:8000`,
and the Next.js app connects to it via `PYTHON_COMPUTE_URL=http://metardu-worker:8000`.

## What Gets Verified

The `verify-worker.sh` script tests 6 things end-to-end:

| # | Check | What it proves |
|---|-------|----------------|
| 1 | Container health | Docker Compose started the worker container |
| 2 | `GET /health` | Worker is responding on the network |
| 3 | Reject without secret | Auth middleware blocks unauthenticated requests |
| 4 | Accept with secret | `WORKER_SECRET` matches between app and worker |
| 5 | `surface_tin` | Delaunay TIN generation works (scipy) |
| 6 | `surface_contours` | Marching-triangle contour generation works |

## Wiring Diagram

```
┌─────────────────────┐     PYTHON_COMPUTE_URL      ┌──────────────────────┐
│                     │  ─────────────────────────→  │                      │
│   Next.js App       │     http://metardu-worker    │   Python Worker      │
│   (metardu-app)     │                              │   (metardu-worker)   │
│                     │  ←─────────────────────────  │                      │
│   env:              │     X-Worker-Secret header   │   env:               │
│     PYTHON_COMPUTE  │                              │     WORKER_SECRET    │
│     _URL=http://... │                              │                      │
│     WORKER_SECRET   │                              │   Tasks:             │
│                     │                              │     surface_tin      │
│   surfaceService.ts │                              │     surface_contours │
│     → generateTIN   │                              │     surface_volume   │
│     → generateCont  │                              │     gnss_baseline    │
│     → computeVolume │                              │     gnss_process     │
└─────────────────────┘                              └──────────────────────┘
```

## Manual Verification (without Docker)

If you're running the worker outside Docker:

```bash
# Terminal 1: start the worker
cd python_worker
pip install -r requirements.txt
WORKER_SECRET=my-secret uvicorn main:app --port 8000

# Terminal 2: verify
./scripts/verify-worker.sh http://localhost:8000 my-secret
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WORKER_SECRET` | Yes | Shared secret — app sends it as `X-Worker-Secret` header |
| `PYTHON_COMPUTE_URL` | Yes | URL the Next.js app uses to reach the worker |
| `ENVIRONMENT` | No | `development` or `production` (default: production) |

**Critical:** `WORKER_SECRET` must be the **exact same string** in both the Next.js app
(`.env` → `WORKER_SECRET=...`) and the worker container (`docker-compose.yml` reads it
from `.env` and passes it as `WORKER_SECRET` env var).

## Troubleshooting

### Worker won't start
```bash
docker compose logs metardu-worker | tail -20
```
Common issues:
- Missing `surface_processor.py` in container (fixed in Dockerfile — rebuild)
- `WORKER_SECRET` not set → worker runs in degraded mode, rejects all requests

### App can't reach worker
```bash
# Check the worker is on the network
docker compose exec metardu-app curl -s http://metardu-worker:8000/health

# Check the env var is set inside the app container
docker compose exec metardu-app printenv PYTHON_COMPUTE_URL
```

### "Invalid worker secret" errors
```bash
# Check the secret matches
docker compose exec metardu-app printenv WORKER_SECRET
docker compose exec metardu-worker printenv WORKER_SECRET
# These MUST be identical
```

### TIN/contours return local fallback
The worker is optional — when unavailable, `surfaceService.ts` falls back to the local
TypeScript engines (Delaunator for TIN, marching squares for contours). This is by design:
- Small clouds (< 100k points) always use the local engine
- Large clouds (≥ 100k) try the worker first, fall back to local

To confirm the worker is being used, check the `source` field in the response:
- `"worker"` → Python sidecar handled it
- `"local"` → fell back to TypeScript engine

## Task Reference

| Task | Description | Input | Output |
|------|-------------|-------|--------|
| `surface_tin` | Delaunay TIN | `{ points: [{x,y,z}] }` | `{ triangles: [...], triangle_count, bounds }` |
| `surface_contours` | Marching-triangle contours | `{ points, interval, breaklines? }` | `{ contours: [{ elevation, points, is_index }] }` |
| `surface_volume` | Grid-method cut/fill | `{ mode, surface1, surface2?, cell_size }` | `{ cut, fill, net, area, cross_check? }` |
| `gnss_baseline_process` | RTKLIB baseline | `{ base_rinex, rover_rinex, nav_rinex }` | `{ rover_position, sigmas, qc }` |
| `gnss_process_rinex` | RINEX SPP/PPP | `{ rinex_obs, rinex_nav? }` | `{ lat, lon, height, covariance }` |
| `bowditch_traverse` | Bowditch adjustment | `{ observations, start, closing }` | `{ legs, precision, area }` |
| `levelling_closure` | Rise & Fall levelling | `{ observations, start_rl, closing_rl }` | `{ results, closure_mm, passes }` |
