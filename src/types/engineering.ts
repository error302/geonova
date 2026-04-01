export type EngineeringMode = 'road' | 'drainage'
export type EngineeringStandard = 'KRDM2017' | 'KeRRA'
export type RoadClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'J' | 'K' | 'L' | 'M' | 'N' | 'P'
export type TerrainType = 'flat' | 'rolling' | 'mountainous' | 'escarpment'
export type PipeMaterial = 'HDPE' | 'Concrete' | 'uPVC' | 'VCP'
export type GradientStatus = 'OK' | 'TOO_FLAT' | 'TOO_STEEP'

export interface EngineeringData {
  mode: EngineeringMode
  standard: EngineeringStandard
  road?: RoadDesignData
  drainage?: DrainageData
}

export interface RoadDesignData {
  roadName: string
  startChainage: number
  datum: string
  coordinateSystem: string
  designSpeed: number
  roadClass: RoadClass
  terrainType?: TerrainType

  ips: IntersectionPoint[]
  vips: VerticalIP[]
  crossSectionTemplate: CrossSectionTemplate
  stations: StationData[]

  horizontalAlignment?: HorizontalAlignmentResult[]
  verticalAlignment?: VerticalAlignmentResult[]
  earthworksTable?: EarthworksRow[]
}

export interface IntersectionPoint {
  id: string
  name: string
  easting: number
  northing: number
  radius: number
  deflectionAngle?: number
  tangentLength?: number
  arcLength?: number
  chainageTC?: number
  chainageMC?: number
  chainageCT?: number
}

export interface VerticalIP {
  id: string
  chainage: number
  reducedLevel: number
  kValue?: number
  gradientIn?: number
  gradientOut?: number
  curveLengthMin?: number
}

export interface CrossSectionTemplate {
  carriagewayWidth: number
  shoulderWidth: number
  cutSlope: string
  fillSlope: string
  camber: number
  subgradeDepth: number
}

export interface StationData {
  chainage: number
  groundLevel: number
  designLevel?: number
  cutArea?: number
  fillArea?: number
}

export interface HorizontalAlignmentResult {
  ipId: string
  deflectionAngle: number
  tangentLength: number
  arcLength: number
  chainageTC: number
  chainageMC: number
  chainageCT: number
}

export interface VerticalAlignmentResult {
  vipId: string
  gradientIn: number
  gradientOut: number
  algebraicDifference: number
  kValue: number
  curveLength: number
  highLowPoint?: {
    chainage: number
    level: number
  }
}

export interface EarthworksRow {
  chainage: number
  cutArea: number
  fillArea: number
  cutVolume: number
  fillVolume: number
  cumulativeCut: number
  cumulativeFill: number
}

export interface DrainageData {
  manholes: Manhole[]
  pipeRuns?: PipeRun[]
}

export interface Manhole {
  id: string
  name: string
  chainage: number
  coverLevel: number
  invertLevelIn: number
  invertLevelOut: number
  pipeDiameterOut: number
  pipeMaterial: PipeMaterial
  depth?: number
}

export interface PipeRun {
  fromMH: string
  toMH: string
  length: number
  gradient: number
  velocity: number
  fullBoreCapacity: number
  gradientStatus: GradientStatus
}

export interface HorizontalCurveInput {
  bearing1: number
  bearing2: number
  radius: number
  chainageIP: number
}

export interface VerticalCurveInput {
  chainageA: number
  levelA: number
  chainageVIP: number
  levelVIP: number
  chainageB: number
  levelB: number
}

export interface SuperelevationInput {
  designSpeed: number
  radius: number
}

export interface SightDistanceInput {
  designSpeed: number
  standard: EngineeringStandard
}