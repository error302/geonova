import type { RawSurveyPoint, CleanDataResponse, CleanDataRequest } from '@/types/fieldguard'

const BASE = process.env.NEXT_PUBLIC_URL || ''

export async function cleanSurveyData(
  points: RawSurveyPoint[],
  data_type: 'gnss' | 'totalstation' | 'lidar',
  options?: { outlier_threshold?: number; classification_enabled?: boolean }
): Promise<CleanDataResponse> {
  const res = await fetch(`${BASE}/api/ai/clean-data`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points, data_type, options } as CleanDataRequest)
  })
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to clean data')
  }
  
  return res.json()
}