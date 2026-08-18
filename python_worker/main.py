"""
METARDU Python Compute Worker
FastAPI service for heavy survey computations.
Invoked by Next.js via callPythonCompute() from @/lib/pythonService.
"""

import logging
import time
import uuid
from logging.handlers import RotatingFileHandler
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel
from typing import Optional, Any
from starlette.responses import JSONResponse
import hmac
import math
import json
import os

# ─── Structured Logging ──────────────────────────────────────────────────────
# Emits JSON lines to stdout so `docker compose logs -f metardu-worker` is
# machine-parseable (surveys observability: request IDs, latency, task names,
# status codes). Also writes a rotating file inside the container for
# long-term retention without unbounded disk growth.
class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for key in ("request_id", "task", "path", "method", "status", "latency_ms", "points"):
            val = getattr(record, key, None)
            if val is not None:
                entry[key] = val
        if record.exc_info:
            entry["exc"] = self.formatException(record.exc_info)
        return json.dumps(entry)


def setup_logging() -> logging.Logger:
    logger = logging.getLogger("metardu.worker")
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)

    console = logging.StreamHandler()
    console.setFormatter(JsonFormatter())
    logger.addHandler(console)

    try:
        handler = RotatingFileHandler(
            "/tmp/metardu-worker.log", maxBytes=5 * 1024 * 1024, backupCount=2, encoding="utf-8"
        )
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
    except OSError:
        pass  # read-only FS — console only

    return logger


logger = setup_logging()

# ─── OSM Feature Servers (Pyrosm, Pyosmium, OSMPythonTools) ────────────────
# These routers add OSM data capabilities:
#   - /osm/features      — Pyrosm local PBF parsing (buildings, roads, POIs)
#   - /osm/stream-extract — Pyosmium streaming extract (memory-efficient)
#   - /osm/nearby-features — OSMPythonTools Overpass queries for deed plans
#   - /osm/auto-abuttals  — Auto-populate deed plan abuttals from OSM
try:
    from osm_feature_server import router as osm_features_router
    app_osm_features = osm_features_router
except ImportError as e:
    logger.warning("OSM feature server not available", exc_info=e)
    app_osm_features = None

try:
    from osm_streaming import stream_router as osm_stream_router
    app_osm_stream = osm_stream_router
except ImportError as e:
    logger.warning("OSM streaming not available", exc_info=e)
    app_osm_stream = None

try:
    from osm_overpass import overpass_router as osm_overpass_router
    app_osm_overpass = overpass_router
except ImportError as e:
    logger.warning("OSM Overpass not available", exc_info=e)
    app_osm_overpass = None

app = FastAPI(title="METARDU Compute Worker", version="0.1.0")

# ─── Register OSM Routers ───────────────────────────────────────────────────
if app_osm_features:
    app.include_router(app_osm_features)
if app_osm_stream:
    app.include_router(app_osm_stream)
if app_osm_overpass:
    app.include_router(app_osm_overpass)

# --- Worker Secret: MUST be set via environment variable ---
WORKER_SECRET = os.environ.get("WORKER_SECRET", "")
if not WORKER_SECRET:
    # In development, allow a default. In production, this MUST be set.
    if os.environ.get("ENVIRONMENT", "production") == "development":
        WORKER_SECRET = "dev-worker-secret"
    else:
        logger.warning("WORKER_SECRET not set — all compute requests will be rejected")

# --- Constants (Kenya Survey Regulations 1994) ---
LEVELLING_TOLERANCE_MM_PER_SQRTKM = 10  # 10√K mm — RDM 1.1 (2025) Table 5.1
ANGULAR_MISCLOSURE_COEFFICIENT = 15     # 15″√N seconds
LINEAR_MISCLOSURE_URBAN = 10000          # 1:10000
LINEAR_MISCLOSURE_RURAL = 5000           # 1:5000

# --- Task Registry ---
TASK_REGISTRY: dict[str, callable] = {}

def register_task(name: str):
    """Decorator to register a computation task."""
    def decorator(func):
        TASK_REGISTRY[name] = func
        return func
    return decorator

# --- Auth Middleware ---
@app.middleware("http")
async def verify_worker_secret(request: Request, call_next):
    request_id = request.headers.get("X-Request-Id") or uuid.uuid4().hex[:12]
    start = time.perf_counter()
    status_code = None
    try:
        if request.url.path == "/health":
            return await call_next(request)
        if not WORKER_SECRET:
            status_code = 503
            return JSONResponse(status_code=503, content={"detail": "Worker secret not configured"})
        secret = request.headers.get("X-Worker-Secret", "")
        # Use constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(secret, WORKER_SECRET):
            logger.warning(
                "auth_rejected",
                extra={"request_id": request_id, "path": request.url.path, "method": request.method},
            )
            status_code = 403
            return JSONResponse(status_code=403, content={"detail": "Invalid worker secret"})
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.info(
            "request",
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
                "status": status_code,
                "latency_ms": latency_ms,
            },
        )

# --- Models ---
class ComputeRequest(BaseModel):
    task: str
    params: dict[str, Any]

class ComputeResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None

# --- Health Check ---
@app.get("/health")
async def health():
    return {"status": "ok", "service": "metardu-compute-worker", "version": "0.1.0"}

# --- Task Dispatcher ---
@app.post("/compute")
async def compute(request: ComputeRequest):
    start = time.perf_counter()
    task_name = request.task
    if task_name not in TASK_REGISTRY:
        available = list(TASK_REGISTRY.keys())
        logger.warning("unknown_task", extra={"task": task_name})
        return ComputeResponse(
            success=False,
            error=f"Unknown task: {request.task}. Available: {available}"
        )
    try:
        result = await TASK_REGISTRY[task_name](request.params)
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        points = None
        if isinstance(result, dict):
            points = result.get("pointCount") or result.get("points")
            if isinstance(points, (list, dict)):
                points = len(points) if isinstance(points, list) else None
        logger.info(
            "compute_ok",
            extra={"task": task_name, "latency_ms": latency_ms, "points": points},
        )
        return ComputeResponse(success=True, data=result)
    except Exception as e:
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.error(
            "compute_error",
            exc_info=e,
            extra={"task": task_name, "latency_ms": latency_ms},
        )
        return ComputeResponse(success=False, error=str(e))

# --- List Tasks ---
@app.get("/tasks")
async def list_tasks():
    return {"tasks": list(TASK_REGISTRY.keys())}

# ============================================================
# REGISTERED COMPUTATION TASKS
# ============================================================

@register_task("bowditch_traverse")
async def bowditch_traverse(params: dict):
    """Bowditch Compass Rule traverse adjustment per Survey Regulations 1994."""
    observations = params.get("observations", [])
    start_e = params.get("start_easting", 0)
    start_n = params.get("start_northing", 0)
    close_e = params.get("closing_easting", None)
    close_n = params.get("closing_northing", None)
    n = len(observations)
    if n == 0:
        raise ValueError("No observations provided")

    total_dist = 0
    sum_dn = 0
    sum_de = 0
    legs = []

    curr_e, curr_n = start_e, start_n

    for i, obs in enumerate(observations):
        bearing_rad = math.radians(obs["bearing"])
        dist = obs["distance"]
        dn = dist * math.cos(bearing_rad)
        de = dist * math.sin(bearing_rad)

        total_dist += dist
        sum_dn += dn
        sum_de += de

        curr_n += dn
        curr_e += de

        legs.append({
            "from": obs.get("from", f"P{i}"),
            "to": obs.get("to", f"P{i+1}"),
            "distance": dist,
            "bearing": obs["bearing"],
            "raw_delta_n": dn,
            "raw_delta_e": de,
            "easting": curr_e,
            "northing": curr_n,
            "correction_n": 0,
            "correction_e": 0,
            "adj_easting": curr_e,
            "adj_northing": curr_n,
        })

    # Closing error
    error_n = (close_n - curr_n) if close_n is not None else -sum_dn
    error_e = (close_e - curr_e) if close_e is not None else -sum_de
    linear_error = math.sqrt(error_n**2 + error_e**2)
    precision = total_dist / linear_error if linear_error > 0 else float('inf')

    # Angular misclosure (if angles provided)
    angles = [obs.get("angle") for obs in observations if obs.get("angle") is not None]
    ea = 0
    if len(angles) == n:
        ea_deg = sum(angles) - (2 * n - 4) * 90
        ea = ea_deg * 3600  # convert to seconds
        tolerance_ea = ANGULAR_MISCLOSURE_COEFFICIENT * math.sqrt(n)

    # Bowditch corrections
    curr_e, curr_n = start_e, start_n
    for leg in legs:
        corr_n = -(error_n * leg["distance"] / total_dist) if total_dist > 0 else 0
        corr_e = -(error_e * leg["distance"] / total_dist) if total_dist > 0 else 0
        leg["correction_n"] = corr_n
        leg["correction_e"] = corr_e
        curr_n += leg["raw_delta_n"] + corr_n
        curr_e += leg["raw_delta_e"] + corr_e
        leg["adj_northing"] = curr_n
        leg["adj_easting"] = curr_e

    # Area via Shoelace
    area = 0
    adj_coords = [(leg["adj_easting"], leg["adj_northing"]) for leg in legs]
    for i in range(len(adj_coords)):
        j = (i + 1) % len(adj_coords)
        area += adj_coords[i][0] * adj_coords[j][1]
        area -= adj_coords[i][1] * adj_coords[j][0]
    area = abs(area) / 2

    return {
        "legs": legs,
        "closing_error_e": error_e,
        "closing_error_n": error_n,
        "linear_misclosure_m": linear_error,
        "precision_ratio": precision,
        "total_distance": total_dist,
        "area_sqm": area,
        "area_ha": area / 10000,
        "angular_misclosure_sec": ea if angles else None,
        "angular_tolerance_sec": ANGULAR_MISCLOSURE_COEFFICIENT * math.sqrt(n) if angles else None,
        "passes_urban": precision >= LINEAR_MISCLOSURE_URBAN,
        "passes_rural": precision >= LINEAR_MISCLOSURE_RURAL,
    }

@register_task("levelling_closure")
async def levelling_closure(params: dict):
    """Rise & Fall + Height of Collimation with 10√K mm closure check."""
    observations = params.get("observations", [])
    start_rl = params.get("start_rl", 0)
    close_rl = params.get("closing_rl", None)
    total_distance_m = params.get("total_distance_m", 0)

    K = total_distance_m / 1000  # km
    tolerance_mm = LEVELLING_TOLERANCE_MM_PER_SQRTKM * math.sqrt(K) if K > 0 else 0

    # Rise & Fall method
    current_rl = start_rl
    rf_results = []
    sum_bs = 0
    sum_fs = 0
    sum_rise = 0
    sum_fall = 0

    for obs in observations:
        bs = obs.get("backsight", 0)
        fs = obs.get("foresight", 0)
        rise = bs - fs
        fall = fs - bs

        if bs > 0: sum_bs += bs
        if fs > 0: sum_fs += fs

        if rise >= 0:
            sum_rise += rise
        else:
            sum_fall += abs(fall) if fall < 0 else 0

        current_rl += rise
        rf_results.append({
            "station": obs.get("station", ""),
            "bs": bs, "is": obs.get("intermediate", 0), "fs": fs,
            "rise": rise, "fall": fall,
            "rl": current_rl,
            "distance": obs.get("distance", 0),
        })

    last_rl = rf_results[-1]["rl"] if rf_results else start_rl
    check1 = sum_bs - sum_fs
    check2 = sum_rise - sum_fall
    check3 = last_rl - start_rl

    closure_mm = abs(last_rl - close_rl) * 1000 if close_rl is not None else 0
    passes = closure_mm <= tolerance_mm if close_rl is not None else True

    return {
        "method": "rise_fall",
        "results": rf_results,
        "sums": {
            "sum_bs": sum_bs, "sum_fs": sum_fs,
            "sum_rise": sum_rise, "sum_fall": sum_fall,
            "check_bs_minus_fs": check1,
            "check_rise_minus_fall": check2,
            "check_last_minus_first": check3,
            "arithmetic_agree": abs(check1 - check2) < 0.001 and abs(check2 - check3) < 0.001,
        },
        "closure_mm": closure_mm,
        "tolerance_mm": tolerance_mm,
        "passes": passes,
        "k_km": K,
    }


# ============================================================
# GNSS BASELINE PROCESSING (RTKLIB integration — audit C9)
# ============================================================

import tempfile
import subprocess
import shutil

def _check_rtklib():
    """Check if rnx2rtkp is available. Returns the path or None."""
    return shutil.which("rnx2rtkp")

@register_task("gnss_baseline_process")
async def gnss_baseline_process(params: dict):
    """
    Process a GNSS baseline using RTKLIB's rnx2rtkp.

    Parameters:
      base_rinex:  str — Base station RINEX observation file content
      rover_rinex: str — Rover station RINEX observation file content
      nav_rinex:   str — RINEX navigation file content
      options:     dict — mode, frequency, elevation_mask, ambiguity_resolution

    Returns: dict with rover position, sigmas, quality, sat_count, ratio
    """
    rtklib = _check_rtklib()
    if not rtklib:
        raise RuntimeError(
            "RTKLIB is not installed in the worker container. "
            "Install via: apt-get install rtklib (or compile from source)."
        )

    base_content = params.get("base_rinex", "")
    rover_content = params.get("rover_rinex", "")
    nav_content = params.get("nav_rinex", "")
    options = params.get("options", {})

    if not base_content or not rover_content or not nav_content:
        raise ValueError("base_rinex, rover_rinex, and nav_rinex are all required")

    mode = options.get("mode", "static")
    freq = options.get("frequency", "l1+l2")
    el_mask = options.get("elevation_mask", 15)
    ar_mode = options.get("ambiguity_resolution", "fix")
    qc_mode = options.get("qc_mode", "auto")

    with tempfile.TemporaryDirectory() as tmpdir:
        base_path = f"{tmpdir}/base.obs"
        rover_path = f"{tmpdir}/rover.obs"
        nav_path = f"{tmpdir}/nav.nav"
        out_path = f"{tmpdir}/result.pos"

        with open(base_path, "w") as f:
            f.write(base_content)
        with open(rover_path, "w") as f:
            f.write(rover_content)
        with open(nav_path, "w") as f:
            f.write(nav_content)

        cmd = [
            rtklib, "-k", f"pos1-posmode={mode}",
            "-k", f"pos1-frequency={freq}",
            "-k", f"pos1-elmask={el_mask}",
            "-k", f"pos1-armode={ar_mode}",
            "-o", out_path, base_path, rover_path, nav_path,
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        except subprocess.TimeoutExpired:
            raise RuntimeError("RTKLIB timed out (300s). Try a shorter observation file.")
        except Exception as e:
            raise RuntimeError(f"RTKLIB execution failed: {e}")

        if result.returncode != 0:
            raise RuntimeError(f"RTKLIB error {result.returncode}: {result.stderr[:500]}")

        try:
            with open(out_path, "r") as f:
                output = f.read()
        except Exception:
            output = result.stdout

        parsed = _parse_rtklib_output(output)

        # ── Session QC (multipath / cycle slips / SNR / tracking) ──────────
        # Computed from the raw RINEX observations in the worker so the
        # baseline result carries the evidence a surveyor needs to prove
        # session quality (and defend it in front of a boundary commission).
        # QC is additive: a QC failure must never discard a valid baseline.
        from gnss_processor import compute_session_qc

        try:
            parsed["qc"] = {
                "base": compute_session_qc(
                    base_content.encode("utf-8", errors="replace"), "BASE",
                    qc_mode=qc_mode,
                ),
                "rover": compute_session_qc(
                    rover_content.encode("utf-8", errors="replace"), "ROVER",
                    qc_mode=qc_mode,
                ),
            }
        except Exception as e:
            parsed["qc"] = {
                "error": f"Session QC failed: {e}",
                "base": {"available": False, "error": str(e)},
                "rover": {"available": False, "error": str(e)},
            }

        return parsed


def _parse_rtklib_output(output: str) -> dict:
    """Parse RTKLIB .pos output file.

    Returns the final solution plus a fixed-vs-float epoch breakdown so the
    observation report can show how much of the session was truly fixed
    (for kinematic processing) or confirm the single static solution.
    """
    lines = output.strip().split("\n")
    data_lines = [l for l in lines if not l.startswith("%") and l.strip()]

    if not data_lines:
        raise RuntimeError("RTKLIB produced no output. Check RINEX format.")

    quality_map = {1: "FIX", 2: "FLOAT", 3: "SBAS", 4: "DGPS", 5: "SINGLE", 6: "PPP"}

    epoch_solutions = {name: 0 for name in quality_map.values()}
    epoch_solutions["UNKNOWN"] = 0

    last_line = data_lines[-1]
    parts = last_line.split()

    if len(parts) < 8:
        raise RuntimeError(f"Unexpected RTKLIB output format: {last_line[:200]}")

    try:
        # Count solution-quality flags across every epoch line
        for line in data_lines:
            cols = line.split()
            if len(cols) > 5:
                try:
                    flag = int(cols[5])
                    name = quality_map.get(flag, "UNKNOWN")
                    epoch_solutions[name] = epoch_solutions.get(name, 0) + 1
                except (ValueError, IndexError):
                    pass

        lat = float(parts[2])
        lon = float(parts[3])
        height = float(parts[4])
        quality_flag = int(parts[5])
        nsat = int(parts[6])
        sdn = float(parts[7]) if len(parts) > 7 else 0
        sde = float(parts[8]) if len(parts) > 8 else 0
        sdu = float(parts[9]) if len(parts) > 9 else 0
        ratio = float(parts[15]) if len(parts) > 15 else 0

        quality = quality_map.get(quality_flag, "UNKNOWN")

        return {
            "rover_latitude": lat,
            "rover_longitude": lon,
            "rover_height": height,
            "sigma_north": sdn,
            "sigma_east": sde,
            "sigma_up": sdu,
            "quality": quality,
            "sat_count": nsat,
            "ratio": ratio,
            "epoch_solutions": epoch_solutions,
            "solution_summary": {
                "final_solution": quality,
                "epochs": len(data_lines),
                "fixed_epochs": epoch_solutions.get("FIX", 0),
                "float_epochs": epoch_solutions.get("FLOAT", 0),
                "fix_pct": round(
                    epoch_solutions.get("FIX", 0) / len(data_lines) * 100.0, 1
                ) if data_lines else 0.0,
                "ratio": ratio,
            },
            "raw_output": output[-2000:] if len(output) > 2000 else output,
        }
    except (ValueError, IndexError) as e:
        raise RuntimeError(f"Failed to parse RTKLIB output: {e}. Line: {last_line[:200]}")


# ─── GNSS RINEX Processing (Task 2: country-boundary-grade trust) ───────────
# Registered as: gnss_process_rinex
# Provides: RINEX parsing → SPP/PPP position with full covariance matrix
# See gnss_processor.py for the full implementation.

from gnss_processor import process_rinex as _process_rinex

@register_task("gnss_process_rinex")
async def gnss_process_rinex(params: dict[str, Any]) -> Any:
    """
    Process a RINEX observation file and compute a position via SPP or PPP.

    Params:
      - rinex_obs: base64-encoded RINEX observation file
      - rinex_nav: (optional) base64-encoded RINEX navigation file
      - use_precise_ephemeris: bool (default: false) — download IGS SP3
      - station_name: optional station identifier

    Returns:
      { latitude, longitude, height, ecef, covariance, rms, n_satellites,
        method, n_epochs, station_name }
    """
    return await _process_rinex(params)


# ============================================================
# SURFACE ENGINE (Delaunay TIN / contours / cut-fill volume)
# ============================================================
# Million-point clouds: numpy/scipy Delaunay + marching triangles, ported 1:1
# from src/lib/engine/contours.ts, src/lib/compute/tin.ts and
# src/lib/compute/pointCloudVolume.ts. See surface_processor.py.

from surface_processor import (
    generate_tin as _surface_generate_tin,
    generate_contours as _surface_generate_contours,
    compute_grid_volume as _surface_grid_volume,
    compute_stockpile_volume as _surface_stockpile_volume,
    compute_cross_check as _surface_cross_check,
)

@register_task("surface_tin")
async def surface_tin(params: dict[str, Any]) -> Any:
    """
    Build a Delaunay TIN from 3D points.

    Params:
      - points: [{ id?, x, y, z }, ...]

    Returns:
      { triangles: [{ a, b, c: { id, x, y, z }, area_m2, centroid }],
        triangle_count, bounds }
    """
    points = params.get("points", [])
    if not isinstance(points, list) or len(points) < 3:
        raise ValueError("points (list of {x, y, z}) with >= 3 entries is required")
    return _surface_generate_tin(points)


@register_task("surface_contours")
async def surface_contours(params: dict[str, Any]) -> Any:
    """
    Generate contour lines from spot heights (marching triangles).

    Params:
      - points: [{ x, y, z }, ...]
      - interval: contour interval (m, default 1.0)
      - index_interval: index-contour interval (default 5 × interval)
      - breaklines: [{ start: {x,y,z}, end: {x,y,z} }, ...] (optional)

    Returns:
      { contours: [{ elevation, points: [[x, y], ...], is_index }],
        triangle_count, bounds }
    """
    points = params.get("points", [])
    if not isinstance(points, list) or len(points) < 3:
        raise ValueError("points (list of {x, y, z}) with >= 3 entries is required")
    return _surface_generate_contours(
        points,
        interval=params.get("interval", 1.0),
        index_interval=params.get("index_interval"),
        breaklines=params.get("breaklines", []),
    )


@register_task("surface_volume")
async def surface_volume(params: dict[str, Any]) -> Any:
    """
    Compute cut/fill volume between two surfaces (or a stockpile vs a base plane).

    Params:
      - mode: 'cutfill' (default) | 'stockpile'
      - surface1: [{ x, y, z }, ...] — existing/before surface
      - surface2: [{ x, y, z }, ...] — design/after surface (cutfill only)
      - cell_size: grid cell size in m (default 1.0)
      - base_elevation: base plane RL for stockpile mode
      - cross_check: bool — also compute the grid-vs-adaptive-cell cross check

    Returns:
      { cut, fill, net, area, method, cellSize, cutArea, fillArea,
        balanceElevation, cross_check? }
    """
    mode = params.get("mode", "cutfill")
    surface1 = params.get("surface1", [])
    if not isinstance(surface1, list) or len(surface1) < 3:
        raise ValueError("surface1 (list of {x, y, z}) with >= 3 entries is required")

    if mode == "stockpile":
        result = _surface_stockpile_volume(surface1, float(params.get("base_elevation", 0)))
    else:
        surface2 = params.get("surface2", [])
        if not isinstance(surface2, list) or len(surface2) < 3:
            raise ValueError("surface2 (list of {x, y, z}) is required for cutfill mode")
        result = _surface_grid_volume(surface1, surface2, float(params.get("cell_size", 1.0)))
        if params.get("cross_check"):
            result["cross_check"] = _surface_cross_check(surface1, surface2)
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
