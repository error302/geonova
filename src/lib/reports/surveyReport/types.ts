export interface ReportPoint {
  name: string
  easting: number
  northing: number
  elevation?: number | null
  is_control: boolean
  control_order?: string
  monumentType?: string
}

export interface TraverseLeg {
  fromName: string
  toName: string
  distance: number
  rawBearing: number
  adjustedBearing?: number
  rawDeltaE: number
  rawDeltaN: number
  adjustedDeltaE: number
  adjustedDeltaN: number
  correctionE?: number
  correctionN?: number
}

export interface TraverseResult {
  legs: TraverseLeg[]
  closingErrorE: number
  closingErrorN: number
  linearError: number
  precisionRatio: number
  precisionGrade: string
  totalDistance: number
}

export interface ParcelData {
  name?: string
  boundaryPoints: ReportPoint[]
  area_sqm: number
  area_ha: number
  area_acres: number
  perimeter_m: number
  parcel_ref?: string
}

export interface BeaconDescription {
  name: string
  easting: number
  northing: number
  elevation?: number | null
  description: string
  condition?: string
  monumentType?: string
}

export interface SpotLevel {
  name: string
  easting: number
  northing: number
  elevation: number
}

export interface Photo {
  filename: string
  url: string
  caption?: string
  orientation?: string
  dateTaken?: string
}

export interface MobilisationData {
  instrument: string
  serialNumber: string
  calibrationDate: string
  fieldTeam: string
  weather: string
  surveyDate: string
  siteAccess?: string
}

export interface SurveyReportData {
  project: {
    name: string
    location: string
    municipality?: string
    client_name?: string
    surveyor_name?: string
    surveyor_licence?: string
    firm_name?: string
    firm_address?: string
    firm_phone?: string
    firm_email?: string
    datum?: string
    utm_zone: number
    hemisphere?: string
    survey_date?: string
    parcel_ref?: string
    survey_type?: string
    scale?: number
  }
  controlPoints: ReportPoint[]
  traverse?: TraverseResult
  parcel?: ParcelData
  beaconDescriptions?: BeaconDescription[]
  spotLevels?: SpotLevel[]
  photos?: Photo[]
  mobilisation?: MobilisationData
  bearingSchedule?: Array<{ from: string; to: string; bearing: string; distance: number }>
}

export interface SurveyReportOptions {
  includeMobilisation?: boolean
  includePhotos?: boolean
  customIntroduction?: string
  scale?: number
  reportTitle?: string
  parcelRef?: string
  submission_number?: string  // Phase 13: Submission package numbering
}

export type SubscriptionTier = 'free' | 'professional' | 'firm' | 'enterprise'

export interface SubscriptionStatus {
  canGenerate: boolean
  tier: SubscriptionTier
  upgradeRequired: boolean
  expiresAt?: string | null
}
