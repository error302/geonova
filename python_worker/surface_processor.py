"""
METARDU Surface Engine — Delaunay TIN, Marching-Triangle Contours, Cut/Fill Volume

Python sidecar port of the browser surface pipeline so million-point clouds can
be processed without the browser's 100k cap. The ports are 1:1 with the
TypeScript sources of truth so results agree (within floating-point noise):

  - src/lib/engine/contours.ts          Delaunator TIN + marching triangles
  - src/lib/compute/tin.ts              TIN triangles with area + centroid
  - src/lib/compute/pointCloudVolume.ts grid + stockpile cut/fill volume

Orientation / units:
  - points are { x: easting, y: northing, z: elevation } in metres
  - volumes in m³, areas in m²

Dependencies: numpy, scipy (spatial.Delaunay, spatial.cKDTree) — both already
in python_worker/requirements.txt.

Usage (via the compute worker task registry in main.py):
  POST /compute
  { "task": "surface_contours",
    "params": { "points": [{"x":..., "y":..., "z":...}, ...],
                "interval": 1.0, "index_interval": 5.0 } }
"""

import math

import numpy as np

try:
    from scipy.spatial import Delaunay, cKDTree
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False


# ─── Delaunay TIN ────────────────────────────────────────────────────────────

def _triangulate(points):
    """Delaunay triangulation of (x, y). Returns (tri_indices, bounds).

    Mirrors src/lib/engine/contours.ts `triangulate`: degenerate (zero-area)
    triangles are dropped; collinear input yields an empty result.
    """
    if not HAS_SCIPY:
        raise RuntimeError("scipy is required for the surface engine")

    if len(points) < 3:
        return [], {}

    xy = np.array([[p.get("x", 0), p.get("y", 0)] for p in points], dtype=np.float64)

    try:
        delaunay = Delaunay(xy)
    except Exception:
        return [], {}

    triangles = []
    for i, j, k in delaunay.simplices:
        area2 = _twice_area(xy[i], xy[j], xy[k])
        if abs(area2) < 1e-10:
            continue
        triangles.append((int(i), int(j), int(k)))

    xs = xy[:, 0]
    ys = xy[:, 1]
    bounds = {
        "minE": float(xs.min()),
        "maxE": float(xs.max()),
        "minN": float(ys.min()),
        "maxN": float(ys.max()),
    }
    return triangles, bounds


def _twice_area(a, b, c):
    """Twice the signed area of triangle (a, b, c) — 2D cross product."""
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


# ─── Breakline Enforcement (port of engine/contours.ts) ─────────────────────

def _edges_cross(a1, a2, b1, b2):
    """Proper segment intersection (not touching)."""
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    d1 = cross(b1, b2, a1)
    d2 = cross(b1, b2, a2)
    d3 = cross(a1, a2, b1)
    d4 = cross(a1, a2, b2)
    return ((d1 > 0 and d2 < 0) or (d1 < 0 and d2 > 0)) and \
           ((d3 > 0 and d4 < 0) or (d3 < 0 and d4 > 0))


def _line_line_intersection(a1, a2, b1, b2):
    dx1 = a2[0] - a1[0]
    dy1 = a2[1] - a1[1]
    dx2 = b2[0] - b1[0]
    dy2 = b2[1] - b1[1]
    denom = dx1 * dy2 - dy1 * dx2
    if abs(denom) < 1e-12:
        return None
    t = ((b1[0] - a1[0]) * dy2 - (b1[1] - a1[1]) * dx2) / denom
    return (a1[0] + t * dx1, a1[1] + t * dy1)


def _split_triangle_by_breakline(tri, bl_start, bl_end, points):
    """Split a triangle crossed by a breakline into two sub-triangles.

    Mirrors splitTriangleByBreakline in engine/contours.ts. The intersection
    elevation is interpolated along the crossed edge.
    """
    a, b, c = tri
    for edge in ((a, b, c), (b, c, a), (c, a, b)):
        ea, eb, other = edge
        if _edges_cross(ea, eb, bl_start, bl_end):
            inter = _line_line_intersection(ea, eb, bl_start, bl_end)
            if inter is None:
                continue
            dist_ea = math.hypot(inter[0] - ea[0], inter[1] - ea[1])
            dist_eb = math.hypot(eb[0] - ea[0], eb[1] - ea[1])
            t = dist_ea / dist_eb if dist_eb > 0 else 0.0
            elev = ea[2] + t * (eb[2] - ea[2])
            inter_pt = (inter[0], inter[1], elev)
            return ((ea, inter_pt, other), (inter_pt, eb, other))
    return [tri]


def _enforce_breaklines(triangles, breaklines):
    """Remove triangles whose edges cross breaklines; re-triangulate gaps.

    Mirrors enforceBreaklines in engine/contours.ts. Triangles are tuples of
    (x, y, z) vertices; breaklines are ((x1,y1,z1), (x2,y2,z2)).
    """
    result = list(triangles)
    for bl in breaklines:
        new_triangles = []
        for tri in result:
            edges = ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0]))
            crosses = any(
                _edges_cross(a, b, bl[0], bl[1]) for a, b in edges
            )
            if not crosses:
                new_triangles.append(tri)
            else:
                new_triangles.extend(_split_triangle_by_breakline(tri, bl[0], bl[1], None))
        result = new_triangles
    return result


# ─── Contour Generation (Marching Triangles) ────────────────────────────────

def _interpolate_edge(p1, p2, contour_elev):
    """Elevation-crossing point on edge (p1, p2), or None.

    Mirrors interpolateEdge: strictly-between only (a contour exactly at a
    vertex elevation does not cross that edge).
    """
    min_elev = min(p1[2], p2[2])
    max_elev = max(p1[2], p2[2])
    if contour_elev <= min_elev or contour_elev >= max_elev:
        return None
    t = (contour_elev - p1[2]) / (p2[2] - p1[2])
    return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))


def _thread_segments(segments):
    """Thread unordered segments into ordered polylines.

    Mirrors threadSegments in engine/contours.ts (endpoint spatial hash,
    1e-6 key tolerance, 1e-4 match tolerance).
    """
    if not segments:
        return []

    tolerance = 1e-6
    used = [False] * len(segments)
    polylines = []

    def pt_key(p):
        return (round(p[0] / tolerance), round(p[1] / tolerance))

    def pts_match(a, b):
        return abs(a[0] - b[0]) < tolerance * 100 and abs(a[1] - b[1]) < tolerance * 100

    endpoint_map = {}
    for i, (p0, p1) in enumerate(segments):
        endpoint_map.setdefault(pt_key(p0), []).append(i)
        endpoint_map.setdefault(pt_key(p1), []).append(i)

    for start_idx in range(len(segments)):
        if used[start_idx]:
            continue
        used[start_idx] = True
        polyline = [segments[start_idx][0], segments[start_idx][1]]

        # Extend forward from end
        extended = True
        while extended:
            extended = False
            end_pt = polyline[-1]
            for ci in endpoint_map.get(pt_key(end_pt), []):
                if used[ci]:
                    continue
                seg = segments[ci]
                if pts_match(seg[0], end_pt):
                    polyline.append(seg[1])
                    used[ci] = True
                    extended = True
                    break
                if pts_match(seg[1], end_pt):
                    polyline.append(seg[0])
                    used[ci] = True
                    extended = True
                    break

        # Extend backward from start
        extended = True
        while extended:
            extended = False
            start_pt = polyline[0]
            for ci in endpoint_map.get(pt_key(start_pt), []):
                if used[ci]:
                    continue
                seg = segments[ci]
                if pts_match(seg[0], start_pt):
                    polyline.insert(0, seg[1])
                    used[ci] = True
                    extended = True
                    break
                if pts_match(seg[1], start_pt):
                    polyline.insert(0, seg[0])
                    used[ci] = True
                    extended = True
                    break

        polylines.append(polyline)

    return polylines


def generate_contours(points, interval=1.0, index_interval=None, breaklines=None):
    """Generate contour lines from spot heights (marching triangles).

    Args:
        points: [{x, y, z}, ...]
        interval: contour interval in metres
        index_interval: index-contour interval (default 5 × interval)
        breaklines: [{start: {x,y,z}, end: {x,y,z}}, ...]

    Returns:
        { contours: [{elevation, points: [[x, y], ...], is_index}],
          triangle_count, bounds }
    """
    interval = float(interval)
    index_interval = float(index_interval) if index_interval is not None else interval * 5
    breaklines = breaklines or []

    if len(points) < 3:
        return {"contours": [], "triangle_count": 0, "bounds": {}}

    vertices = [(float(p["x"]), float(p["y"]), float(p["z"])) for p in points]

    triangles, bounds = _triangulate(points)
    if not triangles:
        return {"contours": [], "triangle_count": 0, "bounds": bounds}

    tri_vertices = [(vertices[i], vertices[j], vertices[k]) for i, j, k in triangles]

    if breaklines:
        bl_pairs = []
        for bl in breaklines:
            s = bl.get("start", {})
            e = bl.get("end", {})
            bl_pairs.append(((float(s["x"]), float(s["y"]), float(s.get("z", 0))),
                             (float(e["x"]), float(e["y"]), float(e.get("z", 0)))))
        tri_vertices = _enforce_breaklines(tri_vertices, bl_pairs)

    elevations = [p["z"] for p in points]
    min_elev = min(elevations)
    max_elev = max(elevations)

    first_contour = math.ceil(min_elev / interval) * interval
    contour_elevations = []
    e = first_contour
    while e <= max_elev + 1e-9:
        contour_elevations.append(round(e * 1e6) / 1e6)  # avoid fp drift
        e += interval

    contours = []
    for contour_elev in contour_elevations:
        segments = []
        for tri in tri_vertices:
            crossings = []
            for a, b in ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])):
                crossing = _interpolate_edge(a, b, contour_elev)
                if crossing is not None:
                    crossings.append(crossing)
            if len(crossings) == 2:
                segments.append((crossings[0], crossings[1]))

        if segments:
            for polyline in _thread_segments(segments):
                if len(polyline) >= 2:
                    is_index = abs(contour_elev % index_interval) < interval * 0.01
                    contours.append({
                        "elevation": contour_elev,
                        "points": [[float(px), float(py)] for px, py in polyline],
                        "is_index": bool(is_index),
                    })

    return {"contours": contours, "triangle_count": len(tri_vertices), "bounds": bounds}


def generate_tin(points):
    """Build a Delaunay TIN with per-triangle area + centroid.

    Mirrors src/lib/compute/tin.ts `generateTIN`: each triangle carries
    {a, b, c} vertices (x/y/z), area_m2, and centroid {x, y, z}.
    """
    triangles, bounds = _triangulate(points)
    if not triangles:
        return {"triangles": [], "triangle_count": 0, "bounds": bounds}

    out = []
    for i, j, k in triangles:
        a = points[i]
        b = points[j]
        c = points[k]
        ax, ay, az = float(a["x"]), float(a["y"]), float(a["z"])
        bx, by, bz = float(b["x"]), float(b["y"]), float(b["z"])
        cx, cy, cz = float(c["x"]), float(c["y"]), float(c["z"])
        area_m2 = abs(_twice_area(
            (ax, ay), (bx, by), (cx, cy)
        )) / 2.0
        out.append({
            "a": {"id": str(a.get("id", i)), "x": ax, "y": ay, "z": az},
            "b": {"id": str(b.get("id", j)), "x": bx, "y": by, "z": bz},
            "c": {"id": str(c.get("id", k)), "x": cx, "y": cy, "z": cz},
            "area_m2": round(area_m2, 6),
            "centroid": {
                "x": round((ax + bx + cx) / 3.0, 6),
                "y": round((ay + by + cy) / 3.0, 6),
                "z": round((az + bz + cz) / 3.0, 6),
            },
        })

    return {"triangles": out, "triangle_count": len(out), "bounds": bounds}


# ─── Grid Method Volume (port of pointCloudVolume.ts) ───────────────────────

def _interpolate_to_grid(points, origin_e, origin_n, cols, rows, cell_size):
    """IDW (power 2) interpolation of a point cloud onto a regular grid.

    Uses a cKDTree for the 4 nearest neighbours (the TS implementation uses an
    expanding-ring spatial hash with the same 4-neighbour IDW semantics).
    """
    xy = np.array([[p["x"], p["y"]] for p in points], dtype=np.float64)
    z = np.array([p["z"] for p in points], dtype=np.float64)
    tree = cKDTree(xy)

    grid = np.full((rows, cols), np.nan, dtype=np.float64)
    cell_cx = origin_e + cell_size / 2.0
    cell_cy = origin_n + cell_size / 2.0

    for i in range(rows):
        n = cell_cy + i * cell_size
        for j in range(cols):
            e = cell_cx + j * cell_size
            dist, idx = tree.query([e, n], k=min(4, len(points)))
            if idx.size == 0:
                continue
            if np.isscalar(dist):
                dist = np.array([dist])
                idx = np.array([idx])
            weight_sum = 0.0
            value_sum = 0.0
            for d, pi in zip(dist, idx):
                if d < 0.001:
                    weight_sum = 1.0
                    value_sum = z[int(pi)]
                    break
                w = 1.0 / (d * d)
                weight_sum += w
                value_sum += w * z[int(pi)]
            if weight_sum > 0:
                grid[i][j] = value_sum / weight_sum
    return grid


def compute_grid_volume(surface1, surface2, cell_size=1.0):
    """Cut/fill volume between two surfaces via the grid method.

    Mirrors gridMethodVolume in pointCloudVolume.ts: positive height
    difference = cut (material above the datum), negative = fill. Cell volume
    is |Δh| × cell area; total area counts only cells where both surfaces
    interpolated a value.
    """
    if len(surface1) < 3 or len(surface2) < 3:
        return {"cut": 0.0, "fill": 0.0, "net": 0.0, "area": 0.0,
                "method": "grid", "cellSize": cell_size,
                "cutArea": 0.0, "fillArea": 0.0, "balanceElevation": None}

    all_pts = surface1 + surface2
    min_e = min(p["x"] for p in all_pts)
    max_e = max(p["x"] for p in all_pts)
    min_n = min(p["y"] for p in all_pts)
    max_n = max(p["y"] for p in all_pts)

    width = max_e - min_e
    height = max_n - min_n
    cols = max(1, math.ceil(width / cell_size))
    rows = max(1, math.ceil(height / cell_size))

    grid1 = _interpolate_to_grid(surface1, min_e, min_n, cols, rows, cell_size)
    grid2 = _interpolate_to_grid(surface2, min_e, min_n, cols, rows, cell_size)

    cell_area = cell_size * cell_size
    diff = grid1 - grid2
    valid = ~np.isnan(diff)
    d = diff[valid]
    # Positive height difference = cut (material above the datum); negative = fill.
    cut = float(np.sum(d[d > 0]) * cell_area) if np.any(d > 0) else 0.0
    fill = float(-np.sum(d[d < 0]) * cell_area) if np.any(d < 0) else 0.0

    valid_count = int(np.sum(valid))
    cut_area = float(np.sum(d > 0) * cell_area)
    fill_area = float(np.sum(d < 0) * cell_area)
    balance_elevation = _balance_elevation(grid1[valid], cell_area)

    return {
        "cut": round(cut, 6),
        "fill": round(fill, 6),
        "net": round(cut - fill, 6),
        "area": round(valid_count * cell_area, 6),
        "method": "grid",
        "cellSize": cell_size,
        "cutArea": round(cut_area, 6),
        "fillArea": round(fill_area, 6),
        "balanceElevation": balance_elevation,
    }


def _balance_elevation(grid1_heights, cell_area, iters=24):
    """Datum elevation at which cut ≈ fill (net volume ≈ 0) for one surface.

    net(z) = Σ (h − z)·A over cells; monotonic decreasing in z → bisection.
    """
    if grid1_heights.size == 0:
        return None
    lo = float(np.nanmin(grid1_heights))
    hi = float(np.nanmax(grid1_heights))
    if not np.isfinite(lo) or not np.isfinite(hi):
        return None
    hs = grid1_heights[~np.isnan(grid1_heights)]
    if hs.size == 0:
        return None

    def net_at(z):
        d = hs - z
        return float(np.sum(d[d > 0])) * cell_area - float(-np.sum(d[d < 0])) * cell_area

    if net_at(lo) <= 0:
        return round(lo, 3)
    if net_at(hi) >= 0:
        return round(hi, 3)
    for _ in range(iters):
        mid = (lo + hi) / 2.0
        if net_at(mid) > 0:
            lo = mid
        else:
            hi = mid
    return round((lo + hi) / 2.0, 3)


def compute_stockpile_volume(surface, base_elevation):
    """Volume of a stockpile above a flat base plane (cell size 0.5 m)."""
    if len(surface) < 3:
        return {"cut": 0.0, "fill": 0.0, "net": 0.0, "area": 0.0,
                "method": "grid", "cellSize": 0.5,
                "cutArea": 0.0, "fillArea": 0.0, "balanceElevation": None}
    base_surface = [{"x": p["x"], "y": p["y"], "z": base_elevation} for p in surface]
    return compute_grid_volume(surface, base_surface, 0.5)


def compute_cross_check(surface1, surface2):
    """Grid vs adaptive-cell TIN cross-check (port of crossCheckVolume)."""
    grid_result = compute_grid_volume(surface1, surface2, 1.0)

    if len(surface1) < 3 or len(surface2) < 3:
        tin_result = {"cut": 0.0, "fill": 0.0, "net": 0.0, "area": 0.0, "method": "tin-to-tin"}
    else:
        all_pts = surface1 + surface2
        area = (max(p["x"] for p in all_pts) - min(p["x"] for p in all_pts)) * \
               (max(p["y"] for p in all_pts) - min(p["y"] for p in all_pts))
        density = (len(surface1) + len(surface2)) / area if area > 0 else 0
        cell_size = max(0.5, math.sqrt(4.0 / density) if density > 0 else 0.5)
        tin_result = compute_grid_volume(surface1, surface2, cell_size)
        tin_result = {**tin_result, "method": "tin-to-tin", "cellSize": cell_size}

    diff = abs(grid_result["net"] - tin_result["net"])
    avg_vol = (abs(grid_result["net"]) + abs(tin_result["net"])) / 2.0
    diff_percent = (diff / avg_vol) * 100.0 if avg_vol > 0 else 0.0

    return {
        "gridResult": grid_result,
        "tinResult": tin_result,
        "agree": diff_percent < 2.0,
        "difference": round(diff, 6),
        "differencePercent": round(diff_percent, 4),
    }
