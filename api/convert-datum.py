from http.server import BaseHTTPRequestHandler
import json
from pyproj import Transformer

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers['Content-Length'])
        body = json.loads(self.rfile.read(length))
        
        coords = body.get('coords', [])
        from_datum = body.get('fromDatum', 'WGS84')
        to_datum = body.get('toDatum', 'ARC1960')
        
        try:
            if from_datum == 'WGS84' and to_datum == 'ARC1960':
                transformer = Transformer.from_crs(
                    'EPSG:4326', 'EPSG:21037', always_xy=True
                )
            elif from_datum == 'ARC1960' and to_datum == 'WGS84':
                transformer = Transformer.from_crs(
                    'EPSG:21037', 'EPSG:4326', always_xy=True
                )
            else:
                transformer = None

            results = []
            for c in coords:
                if transformer:
                    x, y = transformer.transform(
                        c['easting'], c['northing']
                    )
                    results.append({
                        'id': c.get('id', ''),
                        'easting': round(x, 3),
                        'northing': round(y, 3),
                        'datum': to_datum
                    })
                else:
                    results.append({**c, 'datum': to_datum})

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'data': results,
                'error': None
            }).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'data': None,
                'error': 'An internal error occurred during datum conversion.',
                'meta': { 'fallback': True }
            }).encode())
