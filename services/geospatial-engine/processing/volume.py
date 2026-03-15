from typing import List, Optional
from pydantic import BaseModel
import numpy as np
from scipy.integrate import dblquad


class VolumePoint(BaseModel):
    x: float
    y: float
    z: float


class VolumeRequest(BaseModel):
    surface_points: List[VolumePoint]
    boundary_points: List[VolumePoint]
    reference_elevation: float
    method: str = "grid"


class VolumeResponse(BaseModel):
    cut_volume: float
    fill_volume: float
    net_volume: float
    method_used: str
    grid_resolution: int = 0


def compute_volume_grid(request: VolumeRequest) -> VolumeResponse:
    if len(request.surface_points) < 3:
        return VolumeResponse(
            cut_volume=0, fill_volume=0, net_volume=0, method_used="grid"
        )

    min_x = min(p.x for p in request.surface_points)
    max_x = max(p.x for p in request.surface_points)
    min_y = min(p.y for p in request.surface_points)
    max_y = max(p.y for p in request.surface_points)

    resolution = 50
    grid_x = np.linspace(min_x, max_x, resolution)
    grid_y = np.linspace(min_y, max_y, resolution)

    surface_z = np.zeros((resolution, resolution))

    from scipy.interpolate import griddata

    points = np.array([[p.x, p.y] for p in request.surface_points])
    z_values = np.array([p.z for p in request.surface_points])

    grid_pts = np.array([[gx, gy] for gx in grid_x for gy in grid_y])
    surface_z_flat = griddata(
        points,
        z_values,
        grid_pts,
        method="linear",
        fill_value=request.reference_elevation,
    )
    surface_z = surface_z_flat.reshape((resolution, resolution))

    ref_z = request.reference_elevation
    cell_area = ((max_x - min_x) / (resolution - 1)) * (
        (max_y - min_y) / (resolution - 1)
    )

    diff = surface_z - ref_z

    cut_cells = diff > 0
    fill_cells = diff < 0

    cut_volume = np.sum(diff * cut_cells) * cell_area
    fill_volume = np.abs(np.sum(diff * fill_cells)) * cell_area
    net_volume = cut_volume - fill_volume

    return VolumeResponse(
        cut_volume=cut_volume,
        fill_volume=fill_volume,
        net_volume=net_volume,
        method_used="grid",
        grid_resolution=resolution,
    )


def compute_volume_prism(request: VolumeRequest) -> VolumeResponse:
    from scipy.spatial import Delaunay

    if len(request.surface_points) < 3:
        return VolumeResponse(
            cut_volume=0, fill_volume=0, net_volume=0, method_used="prism"
        )

    points = np.array([[p.x, p.y, p.z] for p in request.surface_points])
    tri = Delaunay(points[:, :2])

    ref_z = request.reference_elevation

    cut_volume = 0.0
    fill_volume = 0.0

    for simplex in tri.simplices:
        tri_pts = points[simplex]
        z_avg = np.mean(tri_pts[:, 2])

        area = 0.5 * abs(
            (tri_pts[1, 0] - tri_pts[0, 0]) * (tri_pts[2, 1] - tri_pts[0, 1])
            - (tri_pts[2, 0] - tri_pts[0, 0]) * (tri_pts[1, 1] - tri_pts[0, 1])
        )

        height = z_avg - ref_z

        if height > 0:
            cut_volume += area * height
        else:
            fill_volume += area * abs(height)

    net_volume = cut_volume - fill_volume

    return VolumeResponse(
        cut_volume=cut_volume,
        fill_volume=fill_volume,
        net_volume=net_volume,
        method_used="prism",
    )


def calculate_volume(request: VolumeRequest) -> VolumeResponse:
    if request.method == "prism":
        return compute_volume_prism(request)
    return compute_volume_grid(request)
