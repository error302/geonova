import type { ProcessBathymetryRequest, ProcessBathymetryResponse, SoundingPoint } from '@/types/bathymetry'

const BASE = process.env.NEXT_PUBLIC_URL || ''

export async function processBathymetry(
  projectId: string,
  soundings: SoundingPoint[],
  options?: { contour_interval?: number; detect_hazards?: boolean; compare_previous?: boolean }
): Promise<ProcessBathymetryResponse> {
  const res = await fetch(`${BASE}/api/hydro/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, soundings, options } as ProcessBathymetryRequest)
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to process bathymetry')
  }
  
  return res.json()
}
