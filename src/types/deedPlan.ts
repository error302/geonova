export interface DeedPlanInput {
  // Identification
  surveyNumber: string
  drawingNumber: string
  parcelNumber: string
  locality: string
  area: number
  registrationSection: string
  county: string
  // Coordinates
  utmZone: number
  hemisphere: 'N' | 'S'
  scale: 250 | 500 | 1000 | 1250 | 2500 | 5000 | 10000
  datum: 'ARC1960' | 'WGS84'
  projectionType: 'UTM' | 'Cassini'
  // Grid-to-ground correction (required for accurate area per RDM 1.1)
  scaleFactor?: number        // Grid-to-ground scale factor (e.g. 0.99979 for Nairobi)
  meanElevation?: number       // Mean ground elevation in metres above sea level
  gridArea?: number           // Area computed from UTM coordinates (m²), before correction
  // Submission (SRVY2025-1)
  submissionNumber?: string    // RS###_YYYY_###_R## format
  sheetNumber?: number         // Current sheet number
  totalSheets?: number        // Total sheets in the submission
  // Boundary data
  boundaryPoints: BoundaryPoint[]
  abuttalNorth: string
  abuttalSouth: string
  abuttalEast: string
  abuttalWest: string
  // Surveyor
  surveyorName: string
  iskNumber: string
  firmName: string
  firmAddress: string
  surveyDate: string
  signatureDate: string
  clientName?: string
  titleDeedNumber?: string
  firNumber?: string
  registryMapSheet?: string
  drawnBy?: string
  checkedBy?: string
  // Control survey class (RDM 1.1 accuracy classification)
  controlClass?: 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH'
  // Optional declaration text override (uses statutory default if omitted)
  declarationText?: string
}

export interface BoundaryPoint {
  id: string
  easting: number
  northing: number
  elevation?: number
  markType: BeaconType
  markStatus: BeaconStatus
  description?: string
}

export interface BoundaryLeg {
  fromPoint: string
  toPoint: string
  bearing: string
  distance: number
}

export type BeaconType =
  // Primary marks
  | 'PSC'              // Primary Survey Control — concrete pillar
  | 'PSC_FLUSH'        // PSC flush with ground
  | 'SSC'              // Secondary Survey Control
  | 'TSC'              // Tertiary Survey Control

  // Boundary marks
  | 'MASONRY_NAIL'     // Nail in masonry/concrete
  | 'IRON_PIN'         // Iron pin driven in ground
  | 'WOODEN_PEG'       // Temporary wooden peg
  | 'CONCRETE_BEACON'  // Concrete boundary beacon
  | 'INDICATORY'       // Indicatory beacon (not physical corner)
  | 'RIVET'            // Brass/steel rivet in rock or concrete

  // Level marks  
  | 'BM'               // Benchmark (permanent)
  | 'TBM'              // Temporary Benchmark
  | 'FLUSH_BRACKET'    // Flush bracket on wall

  // Road / infrastructure
  | 'ROAD_NAIL'        // Nail in tarmac
  | 'SPIKE'            // Railway spike

  // Special
  | 'NATURAL_FEATURE'  // Tree, rock face used as reference
  | 'FENCE_POST'       // Fence post at boundary
  | 'WALL_CORNER'      // Corner of permanent wall

export type BeaconStatus = 'FOUND' | 'SET' | 'REFERENCED' | 'DESTROYED' | 'NOT_FOUND'

export interface BeaconDefinition {
  type: BeaconType
  shortCode: string
  fullName: string
  regulation: string
  isPermanent: boolean
  isControlMark: boolean
  defaultOrder: 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'DETAIL'
  description: string
}

export interface DeedPlanOutput {
  svg: string
  bearingSchedule: BoundaryLeg[]
  coordinateSchedule: BoundaryPoint[]
  closureCheck: ClosureCheck
}

export interface ClosureCheck {
  closingErrorE: number
  closingErrorN: number
  perimeter: number
  precisionRatio: string
  passes: boolean
}

export interface DeedPlanDocument extends DeedPlanInput {
  id: string
  projectId: string
  userId: string
  svgContent: string
  closureCheck: ClosureCheck
  status: 'draft' | 'finalised'
  createdAt: string
  updatedAt: string
}
