from typing import List, Dict, Any
from pydantic import BaseModel
import numpy as np
from scipy.spatial import Delaunay


class PointInput(BaseModel):
    x: float
    y: float
    z: float


class TINRequest(BaseModel):
    points: List[PointInput]
    breaklines: List[List[int]] = []


class TINResponse(BaseModel):
    vertices: List[List[float]]
    triangles: List[List[int]]
    edges: List[List[int]]
    surface_area: float


def compute_tin(request: TINRequest) -> TINResponse:
    points_array = np.array([[p.x, p.y, p.z] for p in request.points])

    tri = Delaunay(points_array[:, :2])

    vertices = points_array.tolist()
    triangles = tri.simplices.tolist()

    edges_set = set()
    for simplex in tri.simplices:
        for i in range(3):
            edge = tuple(sorted([simplex[i], simplex[(i + 1) % 3]]))
            edges_set.add(edge)
    edges = list(edges_set)

    surface_area = 0.0
    for simplex in tri.simplices:
        pts = points_array[simplex]
        v1 = pts[1] - pts[0]
        v2 = pts[2] - pts[0]
        cross = np.cross(v1[:2], v2[:2])
        area = 0.5 * np.linalg.norm(cross)
        surface_area += area

    return TINResponse(
        vertices=vertices, triangles=triangles, edges=edges, surface_area=surface_area
    )


def interpolate_z(x: float, y: float, tin: TINResponse) -> float:
    points = np.array(tin.vertices)
    tri_points = points[tin.triangles][:, :, :2]

    for i, tri in enumerate(tri_points):
        if point_in_triangle(x, y, tri):
            pts3d = np.array([tin.vertices[idx] for idx in tin.triangles[i]])
            return barycentric_interpolate(x, y, pts3d)
    return 0.0


def point_in_triangle(x: float, y: float, tri: np.ndarray) -> bool:
    def sign(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])

    d1 = sign(np.array([x, y]), tri[0], tri[1])
    d2 = sign(np.array([x, y]), tri[1], tri[2])
    d3 = sign(np.array([x, y]), tri[2], tri[0])

    has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
    has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)

    return not (has_neg and has_pos)


def barycentric_interpolate(x: float, y: float, pts: np.ndarray) -> float:
    area = 0.5 * (
        -pts[1, 1] * pts[2, 0]
        + pts[0, 1] * (-pts[1, 0] + pts[2, 0])
        + pts[0, 0] * (pts[1, 1] - pts[2, 1])
        + pts[1, 0] * pts[2, 1]
    )
    s = (
        1
        / (2 * area)
        * (
            pts[0, 1] * pts[2, 0]
            - pts[0, 0] * pts[2, 1]
            + (pts[2, 1] - pts[0, 1]) * x
            + (pts[0, 0] - pts[2, 0]) * y
        )
    )
    t = (
        1
        / (2 * area)
        * (
            pts[0, 0] * pts[1, 1]
            - pts[0, 1] * pts[1, 0]
            + (pts[0, 1] - pts[1, 1]) * x
            + (pts[1, 0] - pts[0, 0]) * y
        )
    )

    return pts[2, 2] + s * (pts[0, 2] - pts[2, 2]) + t * (pts[1, 2] - pts[2, 2])
