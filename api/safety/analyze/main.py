from http.server import BaseHTTPRequestHandler
import json

HAZARD_TYPES = {
    'fall_hazard': {'weight': 0.9, 'label': 'Fall Hazard'},
    'electrical': {'weight': 0.95, 'label': 'Electrical Hazard'},
    'fire_risk': {'weight': 0.85, 'label': 'Fire Risk'},
    'chemical_exposure': {'weight': 0.88, 'label': 'Chemical Exposure'},
    'machinery': {'weight': 0.82, 'label': 'Moving Machinery'},
    'confined_space': {'weight': 0.9, 'label': 'Confined Space'},
    'falling_objects': {'weight': 0.75, 'label': 'Falling Objects'},
    'noise_hazard': {'weight': 0.6, 'label': 'Noise Hazard'},
    'poor_lighting': {'weight': 0.5, 'label': 'Poor Lighting'},
    'obstacles': {'weight': 0.55, 'label': 'Obstacles/Trip Hazards'},
    'ventilation': {'weight': 0.7, 'label': 'Poor Ventilation'},
    'temperature': {'weight': 0.65, 'label': 'Extreme Temperature'}
}

PPE_TYPES = {
    'hard_hat': {'required': True, 'label': 'Hard Hat'},
    'safety_glasses': {'required': True, 'label': 'Safety Glasses'},
    'high_vest': {'required': True, 'label': 'High-Vis Vest'},
    'steel_toe_boots': {'required': True, 'label': 'Steel Toe Boots'},
    'gloves': {'required': False, 'label': 'Gloves'},
    'hearing_protection': {'required': False, 'label': 'Hearing Protection'},
    'respirator': {'required': False, 'label': 'Respirator'},
    'harness': {'required': False, 'label': 'Safety Harness'},
    'face_shield': {'required': False, 'label': 'Face Shield'},
    'safety_shoes': {'required': True, 'label': 'Safety Shoes'}
}

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers['Content-Length'])
        body = json.loads(self.rfile.read(length))

        image_data = body.get('image_data')
        
        hazards = detect_hazards(image_data)
        risk_score = calculate_risk_score(hazards)
        recommendations = generate_recommendations(hazards)

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({
            'data': {
                'hazards': hazards,
                'risk_score': risk_score,
                'recommendations': recommendations
            },
            'error': None
        }).encode())


def detect_hazards(image_data):
    detected = []
    
    if not image_data:
        return detected
    
    for hazard_type, info in HAZARD_TYPES.items():
        confidence = 0.0
        if isinstance(image_data, dict):
            confidence = image_data.get(hazard_type, 0.0)
        elif isinstance(image_data, list):
            confidence = sum(1 for h in image_data if h.get('type') == hazard_type) / max(len(image_data), 1)
        
        if confidence > 0.3:
            detected.append({
                'type': hazard_type,
                'label': info['label'],
                'confidence': round(confidence, 2),
                'severity': get_severity(info['weight'], confidence)
            })
    
    return detected


def calculate_risk_score(hazards):
    if not hazards:
        return 0.0
    
    weighted_sum = 0.0
    for hazard in hazards:
        severity_factor = hazard.get('severity', 1) / 10
        weight = HAZARD_TYPES.get(hazard['type'], {}).get('weight', 0.5)
        weighted_sum += severity_factor * weight
    
    base_risk = weighted_sum / len(hazards)
    risk_score = min(100, round(base_risk * 100, 1))
    
    return risk_score


def get_severity(weight, confidence):
    base = weight * confidence
    if base >= 0.8:
        return 10
    elif base >= 0.6:
        return 8
    elif base >= 0.4:
        return 6
    elif base >= 0.2:
        return 4
    else:
        return 2


def generate_recommendations(hazards):
    recommendations = []
    ppe_issues = []
    
    for hazard in hazards:
        if hazard['type'] == 'fall_hazard':
            recommendations.append('Install guardrails and safety nets at elevated work areas')
            recommendations.append('Ensure all workers wear safety harnesses when working at heights')
        elif hazard['type'] == 'electrical':
            recommendations.append('Inspect all electrical wiring and equipment for damage')
            recommendations.append('Use lockout/tagout procedures for electrical work')
        elif hazard['type'] == 'fire_risk':
            recommendations.append('Clear flammable materials from work area')
            recommendations.append('Ensure fire extinguishers are accessible and inspected')
        elif hazard['type'] == 'chemical_exposure':
            recommendations.append('Provide adequate ventilation in work area')
            recommendations.append('Ensure proper PPE for chemical handling is available')
        elif hazard['type'] == 'machinery':
            recommendations.append('Install machine guards on all moving parts')
            recommendations.append('Provide safety training for machinery operation')
        elif hazard['type'] == 'confined_space':
            recommendations.append('Conduct atmospheric testing before entry')
            recommendations.append('Ensure proper ventilation and rescue equipment available')
        elif hazard['type'] == 'falling_objects':
            recommendations.append('Install toe boards and debris nets at elevated areas')
            recommendations.append('Enforce hard hat policy in work zone')
        elif hazard['type'] == 'noise_hazard':
            recommendations.append('Provide hearing protection in high noise areas')
            recommendations.append('Install sound barriers where possible')
        elif hazard['type'] == 'poor_lighting':
            recommendations.append('Install additional lighting in dark areas')
            recommendations.append('Ensure emergency lighting is operational')
        elif hazard['type'] == 'obstacles':
            recommendations.append('Clear walkways and work areas of debris')
            recommendations.append('Mark temporary obstructions clearly')
        elif hazard['type'] == 'ventilation':
            recommendations.append('Improve airflow with mechanical ventilation')
            recommendations.append('Take regular breaks in fresh air areas')
        elif hazard['type'] == 'temperature':
            recommendations.append('Provide cooling/heating stations as appropriate')
            recommendations.append('Schedule heavy work during cooler hours')
    
    for ppe, info in PPE_TYPES.items():
        if info['required']:
            ppe_issues.append({
                'type': ppe,
                'label': info['label'],
                'required': True,
                'recommendation': f'Ensure {info["label"]} is worn at all times in work area'
            })
    
    if ppe_issues:
        recommendations.insert(0, 'Review PPE compliance and enforce usage')
    
    unique_recommendations = list(dict.fromkeys(recommendations))
    
    return {
        'actions': unique_recommendations,
        'ppe_requirements': ppe_issues,
        'priority': get_recommendation_priority(hazards)
    }


def get_recommendation_priority(hazards):
    if not hazards:
        return 'low'
    
    max_severity = max((h.get('severity', 0) for h in hazards), default=0)
    
    if max_severity >= 8:
        return 'critical'
    elif max_severity >= 6:
        return 'high'
    elif max_severity >= 4:
        return 'medium'
    else:
        return 'low'
