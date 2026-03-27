import json
import sys
import numpy as np
from typing import List, Dict, Any

def generate_contours(soundings: List[Dict], interval: float = 1.0) -> List[Dict]:
    if not soundings:
        return []
    
    depths = [s.get('depth', 0) for s in soundings]
    min_depth = min(depths)
    max_depth = max(depths)
    
    contour_levels = np.arange(min_depth, max_depth + interval, interval)
    
    contours = []
    for level in contour_levels:
        contours.append({
            'elevation': round(float(level), 2),
            'coordinates': []
        })
    
    return contours

def compute_volume(soundings: List[Dict], previous: List[Dict] = None) -> Dict:
    if not soundings:
        return {'volume_change': 0, 'area_change': 0}
    
    depths = np.array([s.get('depth', 0) for s in soundings])
    avg_depth = float(np.mean(depths))
    
    coords = np.array([[s.get('easting', 0), s.get('northing', 0)] for s in soundings])
    if len(coords) > 0:
        x_range = coords[:, 0].max() - coords[:, 0].min()
        y_range = coords[:, 1].max() - coords[:, 1].min()
        area = x_range * y_range
    else:
        area = 0
    
    volume = avg_depth * area
    
    if previous:
        prev_depths = np.array([s.get('depth', 0) for s in previous])
        prev_avg = float(np.mean(prev_depths))
        prev_volume = prev_avg * area
        delta = volume - prev_volume
    else:
        delta = 0
    
    return {
        'volume_change': round(delta, 2),
        'area_change': round(area, 2)
    }

def detect_hazards(soundings: List[Dict]) -> List[Dict]:
    if not soundings:
        return []
    
    hazards = []
    depths = [s.get('depth', 0) for s in soundings]
    min_depth = min(depths)
    
    for i, s in enumerate(soundings):
        depth = s.get('depth', 0)
        
        if depth < 2:
            hazards.append({
                'id': f'hazard_{i}',
                'type': 'shallow',
                'location': {'easting': s.get('easting', 0), 'northing': s.get('northing', 0)},
                'depth': depth,
                'severity': 'high' if depth < 1 else 'medium',
                'description': f'Shallow area at depth {depth}m'
            })
        elif depth < min_depth + 0.5 and i > 0:
            hazards.append({
                'id': f'hazard_{i}',
                'type': 'rock',
                'location': {'easting': s.get('easting', 0), 'northing': s.get('northing', 0)},
                'depth': depth,
                'severity': 'medium',
                'description': f'Potential rock or obstruction at depth {depth}m'
            })
    
    return hazards[:10]

def process_bathymetry(soundings: List[Dict], options: Dict = None) -> Dict:
    options = options or {}
    
    contours = generate_contours(soundings, options.get('contour_interval', 1.0))
    
    volume_delta = compute_volume(soundings) if options.get('compare_previous', False) else None
    
    hazards = detect_hazards(soundings) if options.get('detect_hazards', True) else []
    
    depths = [s.get('depth', 0) for s in soundings]
    
    coords = np.array([[s.get('easting', 0), s.get('northing', 0)] for s in soundings])
    area = 0
    if len(coords) > 0:
        area = float((coords[:, 0].max() - coords[:, 0].min()) * (coords[:, 1].max() - coords[:, 1].min()))
    
    return {
        'contours': contours,
        'volume_delta': volume_delta,
        'hazards': hazards,
        'summary': {
            'min_depth': round(float(min(depths)), 2) if depths else 0,
            'max_depth': round(float(max(depths)), 2) if depths else 0,
            'avg_depth': round(float(np.mean(depths)), 2) if depths else 0,
            'area': round(area, 2)
        }
    }

if __name__ == '__main__':
    try:
        input_data = json.loads(sys.stdin.read())
        result = process_bathymetry(
            input_data.get('soundings', []),
            input_data.get('options', {})
        )
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
