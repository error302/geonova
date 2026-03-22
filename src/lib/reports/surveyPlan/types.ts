export type MonumentType = 'found' | 'set' | 'masonry_nail' | 'iron_pin' | 'indicatory_beacon'

export interface BoundaryPoint {
  name: string
  easting: number
  northing: number
}

export interface ControlPoint extends BoundaryPoint {
  elevation?: number
  monumentType: MonumentType
  beaconDescription?: string
}

export interface AdjacentLot {
  id: string
  boundaryPoints: Array<{ easting: number; northing: number }>
  planReference?: string
  side?: 'left' | 'right' | 'top' | 'bottom'
}

export interface Building {
  easting: number
  northing: number
  width_m: number
  height_m: number
  rotation_deg: number
  label?: string
}

export interface SurveyPlanData {
  project: {
    name: string
    location: string
    municipality?: string
    utm_zone: number
    hemisphere: 'N' | 'S'
    datum?: 'ARC1960' | 'WGS84' | 'WGS84Geographic'
    client_name?: string
    surveyor_name?: string
    surveyor_licence?: string
    firm_name?: string
    firm_address?: string
    firm_phone?: string
    firm_email?: string
    drawing_no?: string
    reference?: string
    plan_title?: string
    area_sqm?: number
    area_ha?: number
    parcel_id?: string
    street?: string
    roadEdge?: string
    road_class?: string
    roadCenterLine?: Array<{ easting: number; northing: number }>
    hundred?: string
    terrain_type?: 'flat' | 'rolling' | 'mountainous' | 'escarpment'
    iskRegNo?: string
    version?: string
    sheetNo?: string
    totalSheets?: string
    northRotationDeg?: number
    bearingSchedule?: BearingEntry[]
    revisions?: RevisionEntry[]
    notes?: string
  }
  parcel: Parcel
  controlPoints: ControlPoint[]
  fenceOffsets?: FenceOffset[]
  adjacentLots?: AdjacentLot[]
  buildings?: Building[]
}

export interface FenceOffset {
  segmentIndex: number
  type: 'fence_on_boundary' | 'chain_link' | 'board_fence' | 'iron_fence' | 'galv_iron' | 'no_fence' | 'end_of_fence' | 'end_of_bf'
  offsetMetres: number
  calloutText?: string
}

export interface RevisionEntry {
  rev: string
  date: string
  description: string
  by: string
}

export interface BearingEntry {
  from: string
  to: string
  bearing: string
  distance: number
}

export interface Parcel {
  boundaryPoints: BoundaryPoint[]
  area_sqm: number
  perimeter_m: number
  pin?: string
  parts?: string[]
}

export interface PlanOptions {
  paperSize?: 'a3' | 'a4'
  scale?: number
  includeGrid?: boolean
  includePanel?: boolean
  language?: string
}

export interface RoadClassification {
  code: string
  name: string
  category: 'rural' | 'urban'
  reserveDesirable: string
  reserveReduced: string
  designStandard: string
}

export const ROAD_CLASSIFICATIONS: RoadClassification[] = [
  { code: 'S', name: 'Motorway', category: 'rural', reserveDesirable: '100m+', reserveReduced: '100m+', designStandard: 'DR1' },
  { code: 'A', name: 'Major Arterial / International', category: 'rural', reserveDesirable: '60–120m', reserveReduced: '40–60m', designStandard: 'DR1/DR2' },
  { code: 'B', name: 'Minor Arterial / National Trunk', category: 'rural', reserveDesirable: '60–80m', reserveReduced: '40–60m', designStandard: 'DR2/DR3' },
  { code: 'C', name: 'Major Collector / Inter-District', category: 'rural', reserveDesirable: '40–60m', reserveReduced: '≥40m', designStandard: 'DR3/DR4' },
  { code: 'D', name: 'Minor Collector / Divisional', category: 'rural', reserveDesirable: '30–40m', reserveReduced: '25–30m', designStandard: 'DR4/DR5' },
  { code: 'E', name: 'Major Local / Feeder', category: 'rural', reserveDesirable: '25–30m', reserveReduced: '20–25m', designStandard: 'DR5/DR6' },
  { code: 'F', name: 'Minor Local', category: 'rural', reserveDesirable: '20–25m', reserveReduced: '20–25m', designStandard: 'DR6/DR7' },
  { code: 'G', name: 'Local Access / Farm to Market', category: 'rural', reserveDesirable: '15–20m', reserveReduced: '15–20m', designStandard: 'DR6/DR7' },
  { code: 'H', name: 'Major Arterial / Urban Highway', category: 'urban', reserveDesirable: '60–80m', reserveReduced: '40–60m', designStandard: 'Urban_Arterial' },
  { code: 'J', name: 'Minor Arterial', category: 'urban', reserveDesirable: '40–60m', reserveReduced: '30–40m', designStandard: 'Urban_Arterial' },
  { code: 'K', name: 'Major Collector', category: 'urban', reserveDesirable: '30–40m', reserveReduced: '25–30m', designStandard: 'Urban_Collector' },
  { code: 'L', name: 'Minor Collector', category: 'urban', reserveDesirable: '20–30m', reserveReduced: '20–25m', designStandard: 'Urban_Collector' },
  { code: 'M', name: 'Major Local / Shopping Street', category: 'urban', reserveDesirable: '20–25m', reserveReduced: '15–20m', designStandard: 'Urban_Local' },
  { code: 'N', name: 'Minor Local / Non-Residential', category: 'urban', reserveDesirable: '15–20m', reserveReduced: '12–15m', designStandard: 'Urban_Local' },
  { code: 'P', name: 'Local Access / Residential', category: 'urban', reserveDesirable: '10–15m', reserveReduced: '10–12m', designStandard: 'Urban_Local' },
]

export function getRoadReserveWidth(code: string, desirable = true): number {
  const rc = ROAD_CLASSIFICATIONS.find(r => r.code === code)
  if (!rc) return 0
  const val = desirable ? rc.reserveDesirable : rc.reserveReduced
  const match = val.match(/(\d+(?:\.\d+)?)/)
  return match ? parseFloat(match[1]) : 0
}
