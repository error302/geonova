export interface RawSurveyPoint {
  id?: string
  easting: number
  northing: number
  elevation?: number
  code?: string
  metadata?: Record<string, unknown>
}

export interface CleanedPoint extends RawSurveyPoint {
  cleaned: boolean
  confidence: number
  classification?: 'ground' | 'vegetation' | 'building' | 'structure' | 'uncertain'
}

export interface Anomaly {
  point_id: string
  type: 'outlier' | 'gap' | 'duplicate' | 'elevation_jump' | 'coordinate_jump'
  severity: 'low' | 'medium' | 'high'
  description: string
  suggested_fix?: { easting?: number; northing?: number; elevation?: number }
}

export interface CleanedDataset {
  id: string
  project_id: string
  user_id: string
  raw_data: RawSurveyPoint[]
  cleaned_data: CleanedPoint[]
  anomalies: Anomaly[]
  confidence_scores: Record<string, number>
  data_type: 'gnss' | 'totalstation' | 'lidar'
  created_at: string
  updated_at: string
}

export interface CleanDataRequest {
  points: RawSurveyPoint[]
  data_type: 'gnss' | 'totalstation' | 'lidar'
  options?: {
    outlier_threshold?: number
    classification_enabled?: boolean
  }
}

export interface CleanDataResponse {
  cleaned_points: CleanedPoint[]
  anomalies: Anomaly[]
  confidence_scores: Record<string, number>
  summary: {
    total_points: number
    outliers_removed: number
    classified_count: number
    confidence_avg: number
    duplicates_removed?: number
  }
}