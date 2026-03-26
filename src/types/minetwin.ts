// src/types/minetwin.ts

export interface SurveyPoint3D {
  id: string
  easting: number
  northing: number
  elevation: number
  code?: string
}

export interface MeshData {
  vertices: number[]
  faces: number[]
  normals?: number[]
  bounds?: { min: number[]; max: number[] }
}

export interface VolumeCalculation {
  ore_volume: number
  waste_volume: number
  total_volume: number
  area: number
  method: 'prismoidal' | 'end_area'
}

export interface ConvergencePoint {
  point_id: string
  x_shift: number
  y_shift: number
  z_shift: number
  total_shift: number
  timestamp: string
}

export interface RiskZone {
  id: string
  area: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  coordinates: number[][]
  description: string
}

export interface MineTwin {
  id: string
  project_id: string
  user_id: string
  mesh_data: MeshData | null
  volumes: VolumeCalculation | null
  convergence: ConvergencePoint[]
  daily_scans: SurveyPoint3D[][]
  safety_reports: any[]
  created_at: string
  updated_at: string
}

export interface ProcessTwinRequest {
  project_id: string
  points: SurveyPoint3D[]
  options?: {
    compute_volumes?: boolean
    compute_convergence?: boolean
    detect_risks?: boolean
  }
}

export interface ProcessTwinResponse {
  mesh: MeshData
  volumes?: VolumeCalculation
  convergence?: ConvergencePoint[]
  risk_zones?: RiskZone[]
}
