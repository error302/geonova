from http.server import BaseHTTPRequestHandler
import json
import math

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers['Content-Length'])
        body = json.loads(self.rfile.read(length))

        points = body.get('points', [])
        interval = float(body.get('interval', 1.0))

        if len(points) < 3:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'data': None,
                'error': 'Minimum 3 points required for contour generation'
            }).encode())
            return

        try:
            pts = [(p['easting'], p['northing'], float(p.get('rl', 0))) for p in points]
            elevations = [p[2] for p in pts]

            tri = delaunay_triangulation(pts)

            z_min = min(elevations)
            z_max = max(elevations)
            levels = []
            start = math.ceil(z_min / interval) * interval
            while start < z_max:
                levels.append(start)
                start += interval

            contours = []
            for level in levels:
                segments = []
                for simplex in tri:
                    v0, v1, v2 = simplex
                    crossings = []

                    edges = [(v0, v1), (v1, v2), (v2, v0)]
                    for va, vb in edges:
                        za, zb = va[2], vb[2]
                        if (za <= level < zb) or (zb <= level < za):
                            t = (level - za) / (zb - za)
                            x = va[0] + t * (vb[0] - va[0])
                            y = va[1] + t * (vb[1] - va[1])
                            crossings.append([round(x, 3), round(y, 3)])

                    if len(crossings) == 2:
                        segments.append(crossings)

                if segments:
                    major = abs(level % (interval * 5)) < 0.001
                    contours.append({
                        'level': round(level, 3),
                        'segments': segments,
                        'major': major
                    })

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'data': {
                    'contours': contours,
                    'bounds': {
                        'z_min': z_min,
                        'z_max': z_max,
                        'interval': interval
                    }
                },
                'error': None
            }).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'data': None,
                'error': f'An error occurred during contour generation: {str(e)}',
                'meta': { 'fallback': True }
            }).encode())


def delaunay_triangulation(points):
    # Bowyer-Watson algorithm — O(n^2), pure Python implementation
    # Source: Bowyer, A. (1981). "Computing Dirichlet tessellations."
    #         Watson, D.F. (1981). "Computing the n-dimensional Delaunay tessellation."
    n = len(points)
    if n < 3:
        return []

    # Build super-triangle that contains all points
    min_x = min(p[0] for p in points)
    max_x = max(p[0] for p in points)
    min_y = min(p[1] for p in points)
    max_y = max(p[1] for p in points)
    dx = max_x - min_x or 1.0
    dy = max_y - min_y or 1.0
    delta_max = max(dx, dy) * 2

    mid_x = (min_x + max_x) / 2
    mid_y = (min_y + max_y) / 2

    p0 = (mid_x - delta_max, mid_y - delta_max, 0)
    p1 = (mid_x, mid_y + delta_max, 0)
    p2 = (mid_x + delta_max, mid_y - delta_max, 0)

    triangles = [(p0, p1, p2)]

    for point in points:
        bad_triangles = []
        for tri in triangles:
            if is_point_in_circumcircle(point, tri):
                bad_triangles.append(tri)

        boundary = []
        for tri in bad_triangles:
            for edge in [(tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])]:
                if not any(is_same_edge(edge, e) for e in boundary):
                    boundary.append(edge)

        triangles = [t for t in triangles if t not in bad_triangles]

        for edge in boundary:
            triangles.append((edge[0], edge[1], point))

    # Remove triangles containing super-triangle vertices
    result = []
    for tri in triangles:
        if not any(
            v[0] == p0[0] or v[0] == p1[0] or v[0] == p2[0]
            for v in tri
        ):
            result.append(tri)

    return result


def is_point_in_circumcircle(point, triangle):
    ax, ay, _ = triangle[0]
    bx, by, _ = triangle[1]
    cx, cy, _ = triangle[2]
    px, py, _ = point

    det = (
        (ax**2 + ay**2) * (by - cy) +
        (bx**2 + by**2) * (cy - ay) +
        (cx**2 + cy**2) * (ay - by)
    )
    if abs(det) < 1e-12:
        return False

    sign = (
        (ax**2 + ay**2) * (by - cy) +
        (bx**2 + by**2) * (cy - ay) +
        (cx**2 + cy**2) * (ay - by)
    )

    return sign * det > 0


def is_same_edge(e1, e2):
    return (e1[0] == e2[0] and e1[1] == e2[1]) or \
           (e1[0] == e2[1] and e1[1] == e2[0])
