import type { CreateMissionRequest } from '@/types/usv'

const BASE = process.env.NEXT_PUBLIC_URL || ''

export async function createMission(
  projectId: string,
  mission: Omit<CreateMissionRequest, 'project_id'>
) {
  const res = await fetch(`${BASE}/api/usv/mission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, ...mission })
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to create mission')
  }
  
  return res.json()
}
