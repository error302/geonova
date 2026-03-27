import json
import sys
import math
from typing import List, Dict, Any, Tuple

def validate_waypoints(waypoints: List[Dict]) -> Tuple[bool, str]:
    if not waypoints:
        return False, "No waypoints provided"
    
    for i, wp in enumerate(waypoints):
        if not isinstance(wp, dict):
            return False, f"Waypoint {i} is not a valid object"
        
        if 'latitude' not in wp or 'longitude' not in wp:
            return False, f"Waypoint {i} missing latitude or longitude"
        
        lat = wp['latitude']
        lon = wp['longitude']
        
        if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
            return False, f"Waypoint {i} has invalid coordinate types"
        
        if lat < -90 or lat > 90:
            return False, f"Waypoint {i} latitude {lat} out of range [-90, 90]"
        
        if lon < -180 or lon > 180:
            return False, f"Waypoint {i} longitude {lon} out of range [-180, 180]"
    
    return True, ""


def calculate_pattern_waypoints(pattern: str, center: Dict, params: Dict) -> List[Dict]:
    waypoints = []
    
    if pattern == 'parallel':
        line_count = params.get('line_count', 5)
        line_spacing = params.get('line_spacing', 20)
        line_length = params.get('line_length', 100)
        direction = params.get('direction', 'NS')
        
        for i in range(line_count):
            if direction == 'NS':
                offset = (i - line_count // 2) * line_spacing
                waypoints.append({
                    'latitude': center['latitude'],
                    'longitude': center['longitude'] + offset * 0.0001
                })
                waypoints.append({
                    'latitude': center['latitude'] + line_length * 0.00001,
                    'longitude': center['longitude'] + offset * 0.0001
                })
            else:
                offset = (i - line_count // 2) * line_spacing
                waypoints.append({
                    'latitude': center['latitude'] + offset * 0.0001,
                    'longitude': center['longitude']
                })
                waypoints.append({
                    'latitude': center['latitude'] + offset * 0.0001,
                    'longitude': center['longitude'] + line_length * 0.00001
                })
    
    elif pattern == 'radial':
        radius = params.get('radius', 100)
        spokes = params.get('spokes', 8)
        points_per_spoke = params.get('points_per_spoke', 3)
        
        waypoints.append({'latitude': center['latitude'], 'longitude': center['longitude']})
        
        for i in range(spokes):
            angle = (2 * math.pi * i) / spokes
            for j in range(1, points_per_spoke + 1):
                dist = (radius * j) / points_per_spoke
                lat = center['latitude'] + (dist * math.cos(angle) * 0.00001)
                lon = center['longitude'] + (dist * math.sin(angle) * 0.00001)
                waypoints.append({'latitude': lat, 'longitude': lon})
    
    elif pattern == 'circular':
        radius = params.get('radius', 100)
        points = params.get('points', 12)
        
        for i in range(points):
            angle = (2 * math.pi * i) / points
            lat = center['latitude'] + radius * math.cos(angle) * 0.00001
            lon = center['longitude'] + radius * math.sin(angle) * 0.00001
            waypoints.append({'latitude': lat, 'longitude': lon})
    
    return waypoints


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def estimate_mission_duration(waypoints: List[Dict], speed: float) -> Dict:
    if not waypoints or speed <= 0:
        return {'distance_meters': 0, 'duration_minutes': 0}
    
    total_distance = 0
    for i in range(len(waypoints) - 1):
        wp1 = waypoints[i]
        wp2 = waypoints[i + 1]
        dist = haversine_distance(
            wp1['latitude'], wp1['longitude'],
            wp2['latitude'], wp2['longitude']
        )
        total_distance += dist
    
    duration_seconds = (total_distance / speed) if speed > 0 else 0
    duration_minutes = duration_seconds / 60
    
    return {
        'distance_meters': round(total_distance, 2),
        'duration_minutes': round(duration_minutes, 2)
    }


def process_mission(mission_data: Dict) -> Dict:
    pattern = mission_data.get('pattern', 'parallel')
    center = mission_data.get('center', {'latitude': 0, 'longitude': 0})
    params = mission_data.get('params', {})
    speed = mission_data.get('speed', 2.5)
    waypoints = mission_data.get('waypoints', [])
    
    if waypoints:
        valid, error = validate_waypoints(waypoints)
        if not valid:
            return {
                'waypoints': [],
                'estimated_distance': 0,
                'estimated_duration': 0,
                'valid': False,
                'error': error
            }
        
        estimation = estimate_mission_duration(waypoints, speed)
        return {
            'waypoints': waypoints,
            'estimated_distance': estimation['distance_meters'],
            'estimated_duration': estimation['duration_minutes'],
            'valid': True,
            'error': ''
        }
    else:
        generated_waypoints = calculate_pattern_waypoints(pattern, center, params)
        estimation = estimate_mission_duration(generated_waypoints, speed)
        
        return {
            'waypoints': generated_waypoints,
            'estimated_distance': estimation['distance_meters'],
            'estimated_duration': estimation['duration_minutes'],
            'valid': True,
            'error': ''
        }


if __name__ == '__main__':
    try:
        input_data = json.loads(sys.stdin.read())
        result = process_mission(input_data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e), 'valid': False}))
