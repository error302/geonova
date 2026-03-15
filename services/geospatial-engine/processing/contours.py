from typing import List, Dict, Any
from pydantic import BaseModel
import numpy as np
from scipy.spatial import Delaunay


class ContourPoint(BaseModel):
    x: float
    y: float
    z: float


class ContourRequest(BaseModel):
    points: List[ContourPoint]
    interval: float = 1.0
    base_elevation: float = 0.0


class ContourLine(BaseModel):
    elevation: float
    segments: List[List[List[float]]]


class ContourResponse(BaseModel):
    contours: List[ContourLine]
    bounds: Dict[str, float]
    total_length: float


def generate_contours(request: ContourRequest) -> ContourResponse:
    if len(request.points) < 3:
        return ContourResponse(
            contours=[],
            bounds={"min_x": 0, "max_x": 0, "min_y": 0, "max_y": 0},
            total_length=0,
        )

    points_array = np.array([[p.x, p.y, p.z] for p in request.points])

    min_z = min(p.z for p in request.points)
    max_z = max(p.z for p in request.points)

    base = request.base_elevation if request.base_elevation else min_z
    interval = request.interval

    z_levels = []
    z = base
    while z <= max_z:
        if z >= min_z:
            z_levels.append(z)
        z += interval

    if min_z not in z_levels:
        z_levels.insert(0, min_z)

    tri = Delaunay(points_array[:, :2])

    contours: List[ContourLine] = []
    total_length = 0.0

    for elevation in z_levels:
        segments = extract_contour_segments(points_array, tri.simplices, elevation)

        if segments:
            line_length = sum(segment_length(s) for s in segments)
            total_length += line_length

            contours.append(ContourLine(elevation=elevation, segments=segments))

    min_x = min(p.x for p in request.points)
    max_x = max(p.x for p in request.points)
    min_y = min(p.y for p in request.points)
    max_y = max(p.y for p in request.points)

    return ContourResponse(
        contours=contours,
        bounds={"min_x": min_x, "max_x": max_x, "min_y": min_y, "max_y": max_y},
        total_length=total_length,
    )


def extract_contour_segments(
    points: np.ndarray, triangles: np.ndarray, elevation: float
) -> List[List[List[float]]]:
    segments: List[List[List[float]]] = []

    edges = {}

    for simplex in triangles:
        pts = points[simplex]
        z_values = pts[:, 2]

        edge_crossings = []

        for i in range(3):
            z1 = z_values[i]
            z2 = z_values[(i + 1) % 3]

            if (z1 <= elevation < z2) or (z2 <= elevation < z1):
                if z1 != z2:
                    t = (elevation - z1) / (z2 - z1)
                    x = pts[i][0] + t * (pts[(i + 1) % 3][0] - pts[i][0])
                    y = pts[i][1] + t * (pts[(i + 1) % 3][1] - pts[i][1])
                    edge_crossings.append([float(x), float(y)])

        if len(edge_crossings) == 2:
            segments.append(edge_crossings)
        elif len(edge_crossings) == 4:
            segments.append([edge_crossings[0], edge_crossings[1]])
            segments.append([edge_crossings[2], edge_crossings[3]])

    return segments


def segment_length(segment: List[List[float]]) -> float:
    if len(segment) < 2:
        return 0.0
    dx = segment[1][0] - segment[0][0]
    dy = segment[1][1] - segment[0][1]
    return float(np.sqrt(dx * dx + dy * dy))
