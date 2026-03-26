import type { ProcessTwinRequest, ProcessTwinResponse, SurveyPoint3D } from '@/types/minetwin'

const BASE = process.env.NEXT_PUBLIC_URL || ''

export async function processMineTwin(
  projectId: string,
  points: SurveyPoint3D[],
  options?: { compute_volumes?: boolean; compute_convergence?: boolean; detect_risks?: boolean }
): Promise<ProcessTwinResponse> {
  const res = await fetch(`${BASE}/api/mine/process-twin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, points, options } as ProcessTwinRequest)
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to process twin')
  }
  
  return res.json()
}
