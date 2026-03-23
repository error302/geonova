from http.server import BaseHTTPRequestHandler
import json
import numpy as np
from scipy.spatial import Delaunay

# Source: Ghilani & Wolf, Elementary Surveying 16th Ed., Chapter 17

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
            pts = np.array([[p['easting'], p['northing']] for p in points])
            elevations = np.array([p['rl'] for p in points])

            tri = Delaunay(pts)
            contours = []

            z_min = float(np.min(elevations))
            z_max = float(np.max(elevations))
            levels = np.arange(
                np.ceil(z_min / interval) * interval,
                z_max,
                interval
            )

            for level in levels:
                segments = []
                for simplex in tri.simplices:
                    verts = pts[simplex]
                    zs = elevations[simplex]
                    crossings = []
                    edges = [(0,1),(1,2),(2,0)]
                    for i, j in edges:
                        zi, zj = zs[i], zs[j]
                        if (zi <= level < zj) or (zj <= level < zi):
                            t = (level - zi) / (zj - zi)
                            x = verts[i][0] + t*(verts[j][0]-verts[i][0])
                            y = verts[i][1] + t*(verts[j][1]-verts[i][1])
                            crossings.append([float(x), float(y)])
                    if len(crossings) == 2:
                        segments.append(crossings)

                if segments:
                    contours.append({
                        'level': float(level),
                        'segments': segments,
                        'major': abs(level % (interval * 5)) < 0.001
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
                'error': 'An internal error occurred during contour generation.',
                'meta': { 'fallback': True }
            }).encode())
