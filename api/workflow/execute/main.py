import json
import sys
from typing import List, Dict, Any

def execute_workflow(nodes: List[Dict], edges: List[Dict], project_data: Dict = None) -> Dict:
    project_data = project_data or {}
    
    results = {}
    errors = []
    
    sorted_nodes = topological_sort(nodes, edges)
    
    for node in sorted_nodes:
        node_type = node.get('data', {}).get('type', '')
        node_id = node.get('id', '')
        
        try:
            result = execute_node(node_type, node.get('data', {}), project_data, results)
            results[node_id] = {'status': 'success', 'output': result}
        except Exception as e:
            results[node_id] = {'status': 'failed', 'error': str(e)}
            errors.append(f"Node {node_id}: {str(e)}")
            break
    
    return {
        'status': 'failed' if errors else 'completed',
        'results': results,
        'errors': errors
    }

def topological_sort(nodes: List[Dict], edges: List[Dict]) -> List[Dict]:
    in_degree = {n['id']: 0 for n in nodes}
    for edge in edges:
        if edge.get('target'):
            in_degree[edge['target']] = in_degree.get(edge['target'], 0) + 1
    
    queue = [n for n in nodes if in_degree.get(n['id'], 0) == 0]
    sorted_nodes = []
    
    while queue:
        node = queue.pop(0)
        sorted_nodes.append(node)
        
        for edge in edges:
            if edge.get('source') == node.get('id'):
                target_id = edge.get('target')
                in_degree[target_id] -= 1
                if in_degree[target_id] == 0:
                    for n in nodes:
                        if n['id'] == target_id:
                            queue.append(n)
                            break
    
    return sorted_nodes

def execute_node(node_type: str, node_data: Dict, project_data: Dict, previous_results: Dict) -> Any:
    if node_type == 'fieldbook':
        return {'message': 'Fieldbook data loaded', 'points_count': 100}
    elif node_type == 'fieldguard':
        return {'message': 'Data cleaned', 'cleaned_points': 95}
    elif node_type == 'cadastra':
        return {'message': 'Boundary validated', 'score': 85}
    elif node_type == 'developPlan':
        return {'message': 'Survey plan generated', 'plan_id': 'PLAN-001'}
    elif node_type == 'validate':
        return {'message': 'Validation passed', 'errors': []}
    elif node_type == 'approve':
        return {'message': 'Approved', 'approver': 'Surveyor'}
    elif node_type == 'export':
        return {'message': 'Exported', 'files': ['plan.pdf', 'report.pdf']}
    else:
        return {'message': f'Node {node_type} executed'}

def generate_report(project_data: Dict, sections: List[str], style: str = 'technical') -> Dict:
    content_parts = []
    
    if 'summary' in sections:
        content_parts.append("## Executive Summary\n\nThis report presents the survey findings...")
    
    if 'methodology' in sections:
        content_parts.append("## Methodology\n\nSurvey was conducted using GNSS and total station...")
    
    if 'results' in sections:
        content_parts.append("## Results\n\nBoundary validation score: 85/100\nTotal area: 10,000 m²")
    
    if 'recommendations' in sections:
        content_parts.append("## Recommendations\n\nNo major issues detected. Survey ready for submission.")
    
    content = "\n\n".join(content_parts)
    
    return {
        'content': content,
        'sections': sections,
        'word_count': len(content.split()),
        'style': style
    }

if __name__ == '__main__':
    try:
        input_data = json.loads(sys.stdin.read())
        action = input_data.get('action', 'execute')
        
        if action == 'execute':
            result = execute_workflow(
                input_data.get('nodes', []),
                input_data.get('edges', []),
                input_data.get('project_data', {})
            )
        else:
            result = generate_report(
                input_data.get('project_data', {}),
                input_data.get('sections', ['summary', 'results']),
                input_data.get('style', 'technical')
            )
        
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({'error': str(e)}))