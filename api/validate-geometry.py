from http.server import BaseHTTPRequestHandler
import json, math

# Source: RDM 1.3 Kenya August 2023
GRADIENTS = {
    'flat':        {'desirable': 3, 'absolute': 5, 'minimum': 0.5},
    'rolling':     {'desirable': 4, 'absolute': 6, 'minimum': 0.5},
    'mountainous': {'desirable': 6, 'absolute': 8, 'minimum': 0.5},
    'escarpment':  {'desirable': 6, 'absolute': 8, 'minimum': 0.5},
    'urban':       {'desirable': 5, 'absolute': 7, 'minimum': 0.5},
}

MIN_RADII = {
    120: 665, 110: 530, 100: 415, 90: 320, 85: 270,
    80: 240, 70: 170, 65: 140, 60: 120, 50: 80, 40: 45, 30: 24
}

SSD = {
    120: 285, 110: 245, 100: 205, 90: 170, 80: 140,
    70: 110, 60: 85, 50: 70, 40: 50, 30: 35
}

K_CREST = {
    120: 140, 110: 110, 100: 85, 90: 65, 80: 50,
    70: 35, 60: 25, 50: 15, 40: 9, 30: 5
}

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers['Content-Length'])
        body = json.loads(self.rfile.read(length))

        terrain = body.get('terrain', 'flat').lower()
        design_speed = int(body.get('designSpeed', 80))
        gradient = float(body.get('gradient', 0))
        radius = float(body.get('radius', 9999))
        ssd = body.get('ssd', None)

        flags = []
        status = 'GREEN'
        g = GRADIENTS.get(terrain, GRADIENTS['flat'])

        if gradient < g['minimum']:
            status = 'YELLOW'
            flags.append(
                f"Gradient {gradient}% below minimum {g['minimum']}% "
                f"— drainage risk (RDM 1.3)"
            )
        elif gradient > g['absolute']:
            status = 'RED'
            flags.append(
                f"DEPARTURE FROM STANDARD: Gradient {gradient}% exceeds "
                f"absolute maximum {g['absolute']}% for {terrain} terrain. "
                f"Written approval from Chief Engineer required — RDM 1.3 §1.6.2"
            )
        elif gradient > g['desirable']:
            status = 'YELLOW'
            flags.append(
                f"Gradient {gradient}% exceeds desirable {g['desirable']}% "
                f"(absolute max {g['absolute']}%) — RDM 1.3"
            )

        min_r = MIN_RADII.get(design_speed, 9999)
        if radius < min_r:
            status = 'RED'
            flags.append(
                f"DEPARTURE FROM STANDARD: Radius {radius}m below minimum "
                f"{min_r}m at {design_speed}km/h — RDM 1.3 §1.6.2"
            )

        req_ssd = SSD.get(design_speed, 0)
        if ssd is not None and float(ssd) < req_ssd:
            status = 'RED'
            flags.append(
                f"DEPARTURE FROM STANDARD: SSD {ssd}m insufficient — "
                f"minimum {req_ssd}m at {design_speed}km/h — RDM 1.3"
            )

        result = {
            'status': status,
            'flags': flags,
            'details': {
                'max_gradient_desirable': g['desirable'],
                'max_gradient_absolute': g['absolute'],
                'min_gradient': g['minimum'],
                'min_radius': min_r,
                'required_ssd': req_ssd,
                'k_crest': K_CREST.get(design_speed, 'N/A')
            }
        }

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())
