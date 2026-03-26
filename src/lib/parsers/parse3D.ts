import type { ParsedInput, ExtractedBuildingData, ExtractedWall, ExtractedFloor, BoundingBox2D, ExtractedAnnotation } from './types'
import { calculateConfidence } from './fileRouter'

export async function parseGLTFFile(file: File): Promise<ParsedInput> {
  try {
    const THREE = await import('three')
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')

    const arrayBuffer = await file.arrayBuffer()
    const loader = new GLTFLoader()

    return new Promise((resolve) => {
      loader.parse(arrayBuffer, '', (gltf) => {
        const scene = gltf.scene
        const box = new THREE.Box3().setFromObject(scene)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())

        const boundingBox: BoundingBox2D = {
          minEasting: center.x - size.x / 2,
          maxEasting: center.x + size.x / 2,
          minNorthing: center.y - size.y / 2,
          maxNorthing: center.y + size.y / 2,
        }

        const floors = Math.ceil(size.z / 3)
        const extractedFloors: ExtractedFloor[] = []
        
        for (let i = 0; i < Math.max(1, floors); i++) {
          extractedFloors.push({
            id: `floor_${i}`,
            level: i,
            name: i === 0 ? 'Ground Floor' : `Floor ${i}`,
            elevation: i * 3,
            boundingBox,
          })
        }

        const walls: ExtractedWall[] = []
        scene.traverse((child: any) => {
          if (child.isMesh) {
            const geom = child.geometry
            if (geom?.boundingBox) {
              const meshBox = new THREE.Box3().copy(geom.boundingBox)
              const position = child.position
              
              const width = meshBox.max.x - meshBox.min.x
              const height = meshBox.max.z - meshBox.min.z
              
              if (width > 0.1 && height > 2) {
                walls.push({
                  id: `wall_${walls.length}`,
                  type: 'unknown',
                  startPoint: { easting: position.x + meshBox.min.x, northing: position.z + meshBox.min.z },
                  endPoint: { easting: position.x + meshBox.max.x, northing: position.z + meshBox.max.z },
                  thickness: 0.2,
                  height: height,
                  level: Math.floor(position.y / 3),
                })
              }
            }
          }
        })

        const building: ExtractedBuildingData = {
          floors: extractedFloors,
          walls,
          rooms: [],
          doors: [],
          windows: [],
          columns: [],
          beams: [],
          annotations: [],
          boundingBox,
          metadata: {
            units: 'meters',
            projectName: file.name.replace(/\.[^/.]+$/, ''),
          },
        }

        const confidence = calculateConfidence(building) * 0.75

        resolve({
          type: 'GLTF',
          sourceFileName: file.name,
          sourceFileSize: file.size,
          sourceFileLastModified: file.lastModified,
          parsedAt: new Date().toISOString(),
          version: '1.0.0',
          building,
          errors: [],
          warnings: ['3D model geometry extracted. For full semantic analysis, use AI enhancement.'],
          confidence,
        })
      }, (error) => {
        resolve({
          type: 'GLTF',
          sourceFileName: file.name,
          sourceFileSize: file.size,
          sourceFileLastModified: file.lastModified,
          parsedAt: new Date().toISOString(),
          version: '1.0.0',
          errors: [`GLTF parse error: ${error}`],
          warnings: [],
          confidence: 0,
        })
      })
    })
  } catch (error) {
    return {
      type: 'GLTF',
      sourceFileName: file.name,
      sourceFileSize: file.size,
      sourceFileLastModified: file.lastModified,
      parsedAt: new Date().toISOString(),
      version: '1.0.0',
      errors: [error instanceof Error ? error.message : 'GLTF parsing failed'],
      warnings: ['Ensure three.js is installed and GLTFLoader is available'],
      confidence: 0,
    }
  }
}

export async function parseOBJFile(file: File): Promise<ParsedInput> {
  try {
    const content = await file.text()
    const lines = content.split('\n')
    
    const vertices: number[] = []
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity

    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts[0] === 'v' && parts.length >= 4) {
        const x = parseFloat(parts[1])
        const y = parseFloat(parts[2])
        const z = parseFloat(parts[3])
        vertices.push(x, y, z)
        
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        if (z < minZ) minZ = z
        if (z > maxZ) maxZ = z
      }
    }

    const boundingBox: BoundingBox2D = minX === Infinity
      ? { minEasting: 0, maxEasting: 10, minNorthing: 0, maxNorthing: 10 }
      : { minEasting: minX, maxEasting: maxX, minNorthing: minZ, maxNorthing: maxZ }

    const floors = Math.ceil((maxY - minY) / 3)
    const extractedFloors: ExtractedFloor[] = []
    
    for (let i = 0; i < Math.max(1, floors); i++) {
      extractedFloors.push({
        id: `floor_${i}`,
        level: i,
        name: i === 0 ? 'Ground Floor' : `Floor ${i}`,
        elevation: minY + i * 3,
        boundingBox,
      })
    }

    const building: ExtractedBuildingData = {
      floors: extractedFloors,
      walls: [],
      rooms: [],
      doors: [],
      windows: [],
      columns: [],
      beams: [],
      annotations: [],
      boundingBox,
      metadata: {
        units: 'meters',
        projectName: file.name.replace(/\.[^/.]+$/, ''),
      },
    }

    const confidence = 0.5

    return {
      type: 'OBJ',
      sourceFileName: file.name,
      sourceFileSize: file.size,
      sourceFileLastModified: file.lastModified,
      parsedAt: new Date().toISOString(),
      version: '1.0.0',
      building,
      errors: [],
      warnings: ['OBJ is mesh-only format. No semantic wall/room data available.'],
      confidence,
    }
  } catch (error) {
    return {
      type: 'OBJ',
      sourceFileName: file.name,
      sourceFileSize: file.size,
      sourceFileLastModified: file.lastModified,
      parsedAt: new Date().toISOString(),
      version: '1.0.0',
      errors: [error instanceof Error ? error.message : 'OBJ parsing failed'],
      warnings: [],
      confidence: 0,
    }
  }
}