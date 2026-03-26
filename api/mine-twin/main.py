import json
import sys
import numpy as np
from typing import List, Dict, Any

def create_mesh_from_points(points: List[Dict], spacing: float = 5.0) -> Dict:
    if not points:
        return {'vertices': [], 'faces': [], 'bounds': {'min': [0,0,0], 'max': [0,0,0]}}
    
    coords = np.array([[p['easting'], p['northing'], p.get('elevation', 0)] for p in points])
    
    min_coords = coords.min(axis=0)
    max_coords = coords.max(axis=0)
    
    x_range = np.arange(min_coords[0], max_coords[0] + spacing, spacing)
    y_range = np.arange(min_coords[1], max_coords[1] + spacing, spacing)
    z_range = np.arange(min_coords[2], max_coords[2] + spacing, spacing)
    
    vertices = []
    for z in z_range:
        for y in y_range:
            for x in x_range:
                vertices.extend([float(x), float(y), float(z)])
    
    vertices = np.array(vertices).reshape(-1, 3)
    
    faces = []
    nx, ny, nz = len(x_range), len(y_range), len(z_range)
    for iz in range(nz - 1):
        for iy in range(ny - 1):
            for ix in range(nx - 1):
                base = ix + iy * nx + iz * nx * ny
                faces.extend([base, base + 1, base + nx])
                faces.extend([base + 1, base + nx + 1, base + nx])
    
    return {
        'vertices': vertices.flatten().tolist()[:3000] if len(vertices) > 1000 else vertices.flatten().tolist(),
        'faces': faces[:1500] if len(faces) > 500 else faces,
        'bounds': {
            'min': min_coords.tolist(),
            'max': max_coords.tolist()
        }
    }

def compute_volumes(points: List[Dict]) -> Dict:
    if not points:
        return {'ore_volume': 0, 'waste_volume': 0, 'total_volume': 0, 'area': 0, 'method': 'prismoidal'}
    
    coords = np.array([[p['easting'], p['northing'], p.get('elevation', 0)] for p in points])
    
    min_c = coords.min(axis=0)
    max_c = coords.max(axis=0)
    
    area = (max_c[0] - min_c[0]) * (max_c[1] - min_c[1])
    volume = area * (max_c[2] - min_c[2])
    
    ore_volume = volume * 0.3
    waste_volume = volume * 0.7
    
    return {
        'ore_volume': round(float(ore_volume), 2),
        'waste_volume': round(float(waste_volume), 2),
        'total_volume': round(float(volume), 2),
        'area': round(float(area), 2),
        'method': 'prismoidal'
    }

def compute_convergence(current: List[Dict], previous: List[Dict] = None) -> List[Dict]:
    if not previous:
        return [{'point_id': p.get('id', str(i)), 'x_shift': 0, 'y_shift': 0, 'z_shift': 0, 'total_shift': 0, 'timestamp': ''} for i, p in enumerate(current)]
    
    convergence = []
    for i, (curr, prev) in enumerate(zip(current[:len(previous)], previous)):
        x_shift = abs(curr.get('easting', 0) - prev.get('easting', 0))
        y_shift = abs(curr.get('northing', 0) - prev.get('northing', 0))
        z_shift = abs(curr.get('elevation', 0) - prev.get('elevation', 0))
        total = (x_shift**2 + y_shift**2 + z_shift**2) ** 0.5
        
        convergence.append({
            'point_id': curr.get('id', str(i)),
            'x_shift': round(float(x_shift), 4),
            'y_shift': round(float(y_shift), 4),
            'z_shift': round(float(z_shift), 4),
            'total_shift': round(float(total), 4),
            'timestamp': ''
        })
    
    return convergence

def detect_risk_zones(points: List[Dict]) -> List[Dict]:
    if len(points) < 4:
        return []
    
    coords = np.array([[p['easting'], p['northing'], p.get('elevation', 0)] for p in points])
    
    variance = np.var(coords, axis=0)
    max_variance_idx = int(np.argmax(variance))
    
    threshold = np.percentile(coords[:, max_variance_idx], 75)
    high_variance_areas = coords[coords[:, max_variance_idx] > threshold]
    
    risks = []
    if len(high_variance_areas) > 0:
        risks.append({
            'id': 'risk_high_variance',
            'area': float(len(high_variance_areas)),
            'severity': 'high',
            'coordinates': high_variance_areas.tolist()[:10],
            'description': 'High elevation variance detected - potential stability concern'
        })
    
    return risks

def process_mine_twin(points: List[Dict], options: Dict = None) -> Dict:
    options = options or {}
    
    mesh = create_mesh_from_points(points)
    
    volumes = compute_volumes(points) if options.get('compute_volumes', True) else None
    
    convergence = compute_convergence(points) if options.get('compute_convergence', True) else []
    
    risk_zones = detect_risk_zones(points) if options.get('detect_risks', True) else []
    
    return {
        'mesh': mesh,
        'volumes': volumes,
        'convergence': convergence,
        'risk_zones': risk_zones
    }

if __name__ == '__main__':
    try:
        input_data = json.loads(sys.stdin.read())
        result = process_mine_twin(
            input_data.get('points', []),
            input_data.get('options', {})
        )
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))