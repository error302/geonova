from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import numpy as np


class RasterPoint(BaseModel):
    x: float
    y: float
    value: float


class RasterAnalysisRequest(BaseModel):
    points: List[RasterPoint]
    operation: str
    resolution: float = 1.0


class RasterAnalysisResponse(BaseModel):
    result: float
    details: Dict[str, Any]
    operation: str


def compute_statistics(points: List[RasterPoint]) -> Dict[str, Any]:
    values = np.array([p.value for p in points])

    return {
        "min": float(np.min(values)),
        "max": float(np.max(values)),
        "mean": float(np.mean(values)),
        "median": float(np.median(values)),
        "std": float(np.std(values)),
        "sum": float(np.sum(values)),
        "count": len(values),
    }


def compute_histogram(points: List[RasterPoint], bins: int = 10) -> Dict[str, Any]:
    values = np.array([p.value for p in points])

    hist, bin_edges = np.histogram(values, bins=bins)

    return {"histogram": hist.tolist(), "bin_edges": bin_edges.tolist()}


def compute_slope_aspect(
    points: List[RasterPoint], resolution: float
) -> Dict[str, Any]:
    if len(points) < 3:
        return {"slope": 0.0, "aspect": 0.0}

    sorted_pts = sorted(points, key=lambda p: (p.y, p.x))

    grid_size = int(np.sqrt(len(points)))
    if grid_size < 3:
        grid_size = 3

    values = np.array([p.value for p in sorted_pts[: grid_size * grid_size]])
    z = values.reshape((grid_size, grid_size))

    if z.shape[0] < 2 or z.shape[1] < 2:
        return {"slope": 0.0, "aspect": 0.0}

    dz_dy, dz_dx = np.gradient(z, resolution)

    slope = np.arctan(np.sqrt(dz_dx**2 + dz_dy**2)) * (180 / np.pi)
    aspect = np.arctan2(-dz_dx, dz_dy) * (180 / np.pi)
    aspect = (aspect + 360) % 360

    return {
        "slope_mean": float(np.mean(slope)),
        "slope_max": float(np.max(slope)),
        "aspect_mean": float(np.mean(aspect)),
        "slope_array": slope.tolist(),
        "aspect_array": aspect.tolist(),
    }


def analyze_raster(request: RasterAnalysisRequest) -> RasterAnalysisResponse:
    operation = request.operation.lower()

    if operation == "statistics":
        stats = compute_statistics(request.points)
        return RasterAnalysisResponse(
            result=stats["mean"], details=stats, operation=operation
        )

    elif operation == "histogram":
        hist = compute_histogram(request.points)
        return RasterAnalysisResponse(result=0.0, details=hist, operation=operation)

    elif operation == "slope" or operation == "slope_aspect":
        slope_aspect = compute_slope_aspect(request.points, request.resolution)
        return RasterAnalysisResponse(
            result=slope_aspect["slope_mean"], details=slope_aspect, operation=operation
        )

    elif operation == "min":
        return RasterAnalysisResponse(
            result=min(p.value for p in request.points), details={}, operation=operation
        )

    elif operation == "max":
        return RasterAnalysisResponse(
            result=max(p.value for p in request.points), details={}, operation=operation
        )

    elif operation == "sum":
        return RasterAnalysisResponse(
            result=sum(p.value for p in request.points), details={}, operation=operation
        )

    else:
        return RasterAnalysisResponse(
            result=0.0,
            details={"error": f"Unknown operation: {operation}"},
            operation=operation,
        )
