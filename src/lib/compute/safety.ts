'use client'

const BASE = process.env.NEXT_PUBLIC_URL || ''

export interface SafetyScanResult {
  id: string
  project_id: string
  scan_type: 'camera' | 'lidar' | 'thermal' | 'multi'
  risk_score: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  hazards: SafetyHazard[]
  recommendations: string[]
  scanned_at: string
  location?: {
    easting: number
    northing: number
    zone: string
  }
}

export interface SafetyHazard {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  location?: {
    easting: number
    northing: number
  }
  confidence: number
  detected_at: string
}

export interface SafetyStats {
  total_scans: number
  critical_hazards: number
  high_hazards: number
  medium_hazards: number
  low_hazards: number
  avg_risk_score: number
  last_scan_at: string | null
}

export async function initiateSafetyScan(params: {
  project_id: string
  scan_type: 'camera' | 'lidar' | 'thermal' | 'multi'
  location?: { easting: number; northing: number; zone: string }
}) {
  const res = await fetch(`${BASE}/api/minescan/safety/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to initiate safety scan')
  }

  return res.json() as Promise<SafetyScanResult>
}

export async function getSafetyScans(projectId: string) {
  const res = await fetch(`${BASE}/api/minescan/safety/scans?project_id=${projectId}`)

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to fetch safety scans')
  }

  return res.json() as Promise<SafetyScanResult[]>
}

export async function getSafetyStats(projectId: string) {
  const res = await fetch(`${BASE}/api/minescan/safety/stats?project_id=${projectId}`)

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to fetch safety stats')
  }

  return res.json() as Promise<SafetyStats>
}

export async function getCameraFeedUrl(projectId: string, cameraId: string) {
  const res = await fetch(
    `${BASE}/api/minescan/safety/camera/stream?project_id=${projectId}&camera_id=${cameraId}`
  )

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Failed to get camera feed URL')
  }

  return res.json() as Promise<{ stream_url: string; snapshot_url: string }>
}
