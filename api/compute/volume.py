from http.server import BaseHTTPRequestHandler
import json

# Source: Ghilani & Wolf, Elementary Surveying 16th Ed., Chapter 26

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers['Content-Length'])
        body = json.loads(self.rfile.read(length))

        sections = body.get('sections', [])
        shrinkage = float(body.get('shrinkageFactor', 0.85))

        if len(sections) < 2:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'data': None,
                'error': 'Minimum 2 sections required'
            }).encode())
            return

        results = []
        total_cut = 0.0
        total_fill = 0.0
        cumulative_mass = 0.0
        mass_ordinates = []

        for i in range(1, len(sections)):
            s1 = sections[i-1]
            s2 = sections[i]
            d = float(s2['chainage']) - float(s1['chainage'])
            a1_cut = float(s1.get('cut_area', 0))
            a2_cut = float(s2.get('cut_area', 0))
            a1_fill = float(s1.get('fill_area', 0))
            a2_fill = float(s2.get('fill_area', 0))

            # End Area Method
            # Source: Ghilani & Wolf Ch.26 Eq.26.1
            v_cut_end = (a1_cut + a2_cut) / 2 * d
            v_fill_end = (a1_fill + a2_fill) / 2 * d

            # Prismoidal Formula
            # Source: Ghilani & Wolf Ch.26 Eq.26.2
            am_cut = (a1_cut + a2_cut) / 2
            am_fill = (a1_fill + a2_fill) / 2
            v_cut_pris = (a1_cut + 4*am_cut + a2_cut) / 6 * d
            v_fill_pris = (a1_fill + 4*am_fill + a2_fill) / 6 * d

            # Adjusted cut for mass haul
            v_cut_adjusted = v_cut_pris * shrinkage

            total_cut += v_cut_pris
            total_fill += v_fill_pris
            cumulative_mass += v_cut_adjusted - v_fill_pris
            mass_ordinates.append({
                'chainage': float(s2['chainage']),
                'mass_ordinate': round(cumulative_mass, 3)
            })

            results.append({
                'from_chainage': float(s1['chainage']),
                'to_chainage': float(s2['chainage']),
                'distance': round(d, 3),
                'cut_area_1': round(a1_cut, 3),
                'cut_area_2': round(a2_cut, 3),
                'fill_area_1': round(a1_fill, 3),
                'fill_area_2': round(a2_fill, 3),
                'cut_volume_end_area': round(v_cut_end, 3),
                'fill_volume_end_area': round(v_fill_end, 3),
                'cut_volume_prismoidal': round(v_cut_pris, 3),
                'fill_volume_prismoidal': round(v_fill_pris, 3),
                'warning': 'End Area overestimates by up to 3% vs Prismoidal — Source: Ghilani & Wolf Ch.26'
            })

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({
            'data': {
                'sections': results,
                'totals': {
                    'total_cut_prismoidal': round(total_cut, 3),
                    'total_fill_prismoidal': round(total_fill, 3),
                    'net_cut': round(total_cut - total_fill, 3),
                    'shrinkage_factor': shrinkage
                },
                'mass_haul': mass_ordinates
            },
            'error': None
        }).encode())
