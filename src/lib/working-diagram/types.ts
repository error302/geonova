export type BoundaryType =
  | 'standard'
  | 'surveyed_road'
  | 'unsurveyed_road'
  | 'water'
  | 'fence'

export type LegacyUnit = 'perches' | 'links' | 'chains' | 'feet'

export type BeaconSymbol =
  | 'concrete_beacon'
  | 'iron_peg'
  | 'old_beacon'
  | 'reference_mark'
  | 'intersection_beacon'
  | 'nail'
  | 'none'

export interface BeaconPoint {
  id: string
  label: string
  symbol: BeaconSymbol
  easting?: number
  northing?: number
}

export interface BoundaryLine {
  id: string
  fromBeaconId: string
  toBeaconId: string
  bearingDeg: number
  bearingDMS: string
  distanceMeters: number
  showLegacy: boolean
  legacyUnit?: LegacyUnit
  legacyDistance?: number
  boundaryType: BoundaryType
  roadLabel?: string
}

export interface SubArea {
  id: string
  label: string
  areaHa: number
  areaAcres?: number
  beaconIds: string[]
  fillPattern: 'none' | 'hatch' | 'cross_hatch' | 'dots'
  fillColor: string
}

export interface NorthReference {
  bearing: string
  type: 'grid' | 'true' | 'magnetic'
}

export interface DiagramTitleBlock {
  drawingTitle: string
  surveyorName: string
  surveyorRegNo: string
  clientName?: string
  parcelRef?: string
  county: string
  subcounty?: string
  scaleNote: string
  utmZone: string
  date: string
  drawnBy?: string
  checkedBy?: string
}

export interface WorkingDiagram {
  id: string
  createdAt: string
  updatedAt: string
  titleBlock: DiagramTitleBlock
  north: NorthReference
  beacons: BeaconPoint[]
  boundaries: BoundaryLine[]
  subAreas: SubArea[]
  notes?: string
  canvasWidthMm?: number
  canvasHeightMm?: number
}
