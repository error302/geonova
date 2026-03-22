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
    datum?: string
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
    hundred?: string
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
