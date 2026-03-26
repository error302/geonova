import { readFileSync } from 'fs'
import type { ParsedInput, ExtractedBuildingData, ExtractedWall, ExtractedRoom, ExtractedAnnotation, ExtractedFloor, BoundingBox2D, Point2D } from './types'
import { calculateConfidence } from './fileRouter'

interface DXFEntity {
  type: string
  layer?: string
  x?: number
  y?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  thickness?: number
  elevation?: number
  text?: string
  height?: number
}

interface DXFParseResult {
  entities: DXFEntity[]
  units: string
  layers: string[]
  boundingBox: BoundingBox2D
}

function parseDXFFile(content: string): DXFParseResult {
  const entities: DXFEntity[] = []
  const layers = new Set<string>()
  const lines = content.split('\n')
  
  let i = 0
  let currentEntity: Record<string, string> = {}
  
  while (i < lines.length) {
    const line = lines[i]?.trim()
    if (!line) {
      i++
      continue
    }
    
    const code = parseInt(line, 10)
    const nextLine = lines[i + 1]?.trim() || ''
    
    if (code >= 0 && code <= 999) {
      currentEntity[code] = nextLine
      
      if (code === 0 && nextLine) {
        if (Object.keys(currentEntity).length > 1) {
          const entity = convertToEntity(currentEntity)
          if (entity) {
            entities.push(entity)
            if (entity.layer) layers.add(entity.layer)
          }
        }
        currentEntity = { 0: nextLine }
      }
    }
    i += 2
  }
  
  if (Object.keys(currentEntity).length > 1) {
    const entity = convertToEntity(currentEntity)
    if (entity) {
      entities.push(entity)
      if (entity.layer) layers.add(entity.layer)
    }
  }
  
  let units = 'meters'
  const unitsEntity = entities.find(e => e.type === 'INSUNITS')
  if (unitsEntity && unitsEntity.text) {
    const unitCode = parseInt(unitsEntity.text)
    const unitMap: Record<number, string> = {
      1: 'units', 2: 'inches', 3: 'feet', 4: 'miles',
      5: 'millimeters', 6: 'centimeters', 7: 'meters', 8: 'kilometers',
    }
    units = unitMap[unitCode] || 'meters'
  }
  
  let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity
  entities.forEach(e => {
    const coords = getEntityCoordinates(e)
    coords.forEach(p => {
      if (p.easting < minE) minE = p.easting
      if (p.easting > maxE) maxE = p.easting
      if (p.northing < minN) minN = p.northing
      if (p.northing > maxN) maxN = p.northing
    })
  })
  
  const boundingBox: BoundingBox2D = minE === Infinity 
    ? { minEasting: 0, maxEasting: 0, minNorthing: 0, maxNorthing: 0 }
    : { minEasting: minE, maxEasting: maxE, minNorthing: minN, maxNorthing: maxN }
  
  return { entities, units, layers: Array.from(layers), boundingBox }
}

function convertToEntity(data: Record<string, string>): DXFEntity | null {
  const type = data[0]
  if (!type) return null
  
  const entity: DXFEntity = { type, layer: data[8] }
  
  switch (type) {
    case 'LINE':
      entity.x1 = parseFloat(data[10])
      entity.y1 = parseFloat(data[20])
      entity.x2 = parseFloat(data[11])
      entity.y2 = parseFloat(data[21])
      entity.thickness = parseFloat(data[39])
      entity.elevation = parseFloat(data[30])
      break
    case 'POLYLINE':
    case 'LWPOLYLINE':
      entity.x = parseFloat(data[10])
      entity.y = parseFloat(data[20])
      break
    case 'CIRCLE':
      entity.x = parseFloat(data[10])
      entity.y = parseFloat(data[20])
      entity.thickness = parseFloat(data[40])
      break
    case 'ARC':
      entity.x = parseFloat(data[10])
      entity.y = parseFloat(data[20])
      entity.thickness = parseFloat(data[40])
      break
    case 'TEXT':
    case 'MTEXT':
      entity.x = parseFloat(data[10])
      entity.y = parseFloat(data[20])
      entity.text = data[1] || data[3]
      entity.height = parseFloat(data[40])
      break
    case 'DIMENSION':
      entity.x = parseFloat(data[10])
      entity.y = parseFloat(data[20])
      entity.text = data[1]
      break
    case 'INSERT':
      entity.x = parseFloat(data[10])
      entity.y = parseFloat(data[20])
      break
    case 'POINT':
      entity.x = parseFloat(data[10])
      entity.y = parseFloat(data[20])
      break
  }
  
  return entity
}

function getEntityCoordinates(entity: DXFEntity): Point2D[] {
  const points: Point2D[] = []
  
  if (entity.x1 !== undefined && entity.y1 !== undefined) {
    points.push({ easting: entity.x1, northing: entity.y1 })
  }
  if (entity.x2 !== undefined && entity.y2 !== undefined) {
    points.push({ easting: entity.x2, northing: entity.y2 })
  }
  if (entity.x !== undefined && entity.y !== undefined) {
    points.push({ easting: entity.x, northing: entity.y })
  }
  
  return points
}

function inferWalls(entities: DXFEntity[], boundingBox: BoundingBox2D): ExtractedWall[] {
  const walls: ExtractedWall[] = []
  const wallLayers = ['WALLS', 'WALL', 'A-WALL', 'STRUCTURAL', 'MAIN', 'PARTITION']
  const lineEntities = entities.filter(e => 
    e.type === 'LINE' && 
    e.x1 !== undefined && e.y1 !== undefined &&
    e.x2 !== undefined && e.y2 !== undefined
  )
  
  lineEntities.forEach((line, idx) => {
    const length = Math.sqrt(
      Math.pow((line.x2 || 0) - (line.x1 || 0), 2) + 
      Math.pow((line.y2 || 0) - (line.y1 || 0), 2)
    )
    
    if (length > 0.5) {
      const layer = line.layer?.toUpperCase() || ''
      const isLoadBearing = wallLayers.some(l => 
        layer.includes('MAIN') || layer.includes('STRUCTURAL') || layer.includes('BEARING')
      )
      
      walls.push({
        id: `wall_${idx}`,
        type: isLoadBearing ? 'load-bearing' : 'partition',
        startPoint: { easting: line.x1 || 0, northing: line.y1 || 0 },
        endPoint: { easting: line.x2 || 0, northing: line.y2 || 0 },
        thickness: 0.2,
        height: 3.0,
        material: 'concrete',
        level: 0,
      })
    }
  })
  
  return walls
}

function extractAnnotations(entities: DXFEntity[]): ExtractedAnnotation[] {
  const annotations: ExtractedAnnotation[] = []
  const textEntities = entities.filter(e => 
    (e.type === 'TEXT' || e.type === 'MTEXT') && 
    e.text && e.x !== undefined && e.y !== undefined
  )
  
  textEntities.forEach((text, idx) => {
    annotations.push({
      id: `annotation_${idx}`,
      type: 'text',
      position: { easting: text.x || 0, northing: text.y || 0 },
      content: text.text || '',
      level: 0,
    })
  })
  
  return annotations
}

function inferRoomsFromWalls(walls: ExtractedWall[], boundingBox: BoundingBox2D): ExtractedRoom[] {
  const rooms: ExtractedRoom[] = []
  
  const centerE = (boundingBox.minEasting + boundingBox.maxEasting) / 2
  const centerN = (boundingBox.minNorthing + boundingBox.maxNorthing) / 2
  
  rooms.push({
    id: 'room_1',
    name: 'Living Room',
    floor: 0,
    boundary: [
      { easting: boundingBox.minEasting, northing: boundingBox.minNorthing },
      { easting: boundingBox.maxEasting, northing: boundingBox.minNorthing },
      { easting: boundingBox.maxEasting, northing: boundingBox.maxNorthing },
      { easting: boundingBox.minEasting, northing: boundingBox.maxNorthing },
    ],
    area: (boundingBox.maxEasting - boundingBox.minEasting) * (boundingBox.maxNorthing - boundingBox.minNorthing),
    perimeter: 2 * ((boundingBox.maxEasting - boundingBox.minEasting) + (boundingBox.maxNorthing - boundingBox.minNorthing)),
    height: 3.0,
    function: 'living',
  })
  
  return rooms
}

export async function parseDXFFileContent(content: string, filename: string): Promise<ParsedInput> {
  const parseResult = parseDXFFile(content)
  
  const walls = inferWalls(parseResult.entities, parseResult.boundingBox)
  const annotations = extractAnnotations(parseResult.entities)
  const rooms = inferRoomsFromWalls(walls, parseResult.boundingBox)
  
  const building: ExtractedBuildingData = {
    floors: [{
      id: 'floor_0',
      level: 0,
      name: 'Ground Floor',
      elevation: 0,
      boundingBox: parseResult.boundingBox,
    }],
    walls,
    rooms,
    doors: [],
    windows: [],
    columns: [],
    beams: [],
    annotations,
    boundingBox: parseResult.boundingBox,
    metadata: {
      units: parseResult.units as 'meters' | 'centimeters' | 'millimeters',
      projectName: filename.replace(/\.[^/.]+$/, ''),
    },
  }
  
  const confidence = calculateConfidence(building)
  
  return {
    type: 'DXF',
    sourceFileName: filename,
    sourceFileSize: Buffer.byteLength(content, 'utf8'),
    sourceFileLastModified: Date.now(),
    parsedAt: new Date().toISOString(),
    version: '1.0.0',
    building,
    errors: [],
    warnings: [
      parseResult.units !== 'meters' ? `Detected units: ${parseResult.units}` : '',
    ].filter(Boolean),
    confidence,
  }
}

export function parseDXFBuffer(buffer: Buffer, filename: string): Promise<ParsedInput> {
  const content = buffer.toString('utf8')
  return parseDXFFileContent(content, filename)
}