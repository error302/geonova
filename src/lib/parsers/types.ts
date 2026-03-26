export type ParsedInputType = 'DXF' | 'DWG' | 'IFC' | 'PDF' | 'IMAGE' | 'GLTF' | 'OBJ' | 'BOQ' | 'UNKNOWN'

export interface ParsedInput {
  type: ParsedInputType
  sourceFileName: string
  sourceFileSize: number
  sourceFileLastModified: number
  parsedAt: string
  version: string
  building?: ExtractedBuildingData
  boq?: BOQData
  errors: string[]
  warnings: string[]
  confidence: number
}

export interface ExtractedBuildingData {
  floors: ExtractedFloor[]
  walls: ExtractedWall[]
  rooms: ExtractedRoom[]
  doors: ExtractedDoor[]
  windows: ExtractedWindow[]
  columns: ExtractedColumn[]
  beams: ExtractedBeam[]
  annotations: ExtractedAnnotation[]
  boundingBox: BoundingBox2D
  metadata: BuildingMetadata
}

export interface ExtractedFloor {
  id: string
  level: number
  name: string
  elevation: number
  boundingBox: BoundingBox2D
}

export interface ExtractedWall {
  id: string
  type: 'load-bearing' | 'partition' | 'external' | 'unknown'
  startPoint: Point2D
  endPoint: Point2D
  thickness: number
  height: number
  material?: string
  level: number
}

export interface ExtractedRoom {
  id: string
  name: string
  floor: number
  boundary: Point2D[]
  area: number
  perimeter: number
  height: number
  function?: string
}

export interface ExtractedDoor {
  id: string
  wallId: string
  position: Point2D
  width: number
  height: number
  swing?: 'left' | 'right' | 'double'
}

export interface ExtractedWindow {
  id: string
  wallId: string
  position: Point2D
  width: number
  height: number
  sillHeight?: number
}

export interface ExtractedColumn {
  id: string
  position: Point2D
  width: number
  depth: number
  height: number
  material?: string
}

export interface ExtractedBeam {
  id: string
  startPoint: Point2D
  endPoint: Point2D
  width: number
  depth: number
  height: number
  material?: string
}

export interface ExtractedAnnotation {
  id: string
  type: 'text' | 'dimension' | 'label' | 'symbol'
  position: Point2D
  content: string
  level: number
}

export interface BoundingBox2D {
  minEasting: number
  maxEasting: number
  minNorthing: number
  maxNorthing: number
}

export interface Point2D {
  easting: number
  northing: number
}

export interface Point3D {
  easting: number
  northing: number
  elevation: number
}

export interface BuildingMetadata {
  projectName?: string
  drawingTitle?: string
  architect?: string
  date?: string
  scale?: string
  units: 'meters' | 'centimeters' | 'millimeters' | 'feet' | 'inches'
  northOrientation?: number
}

export interface BOQData {
  items: BOQItem[]
  currency: string
  subtotal: number
  tax?: number
  total: number
  sourceFileName: string
}

export interface BOQItem {
  id: string
  description: string
  unit: string
  quantity: number
  unitRate: number
  totalRate: number
  category: string
}

export interface ParseResult<T> {
  ok: boolean
  data?: T
  error?: string
  warnings: string[]
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export const SUPPORTED_EXTENSIONS: Record<ParsedInputType, string[]> = {
  DXF: ['dxf'],
  DWG: ['dwg'],
  IFC: ['ifc', 'ifcxml'],
  PDF: ['pdf'],
  IMAGE: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'bmp', 'gif', 'tiff'],
  GLTF: ['glb', 'gltf'],
  OBJ: ['obj'],
  BOQ: ['xlsx', 'xls', 'csv'],
  UNKNOWN: [],
}

export const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export const PARSER_VERSION = '1.0.0'