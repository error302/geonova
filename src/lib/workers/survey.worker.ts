/// <reference lib="webworker" />

interface CalculationMessage {
  type: 'traverse' | 'leveling' | 'volume' | 'tin' | 'contours'
  id: string
  data: unknown
}

interface TraverseData {
  points: Array<{ x: number; y: number; z?: number; bearing?: number; distance?: number }>
  method: 'bowditch' | 'transit'
}

interface LevelingData {
  readings: Array<{ backsight?: number; foresight?: number; intermediate?: number; distance: number }>
  benchmark: number
}

self.onmessage = async (event: MessageEvent<CalculationMessage>) => {
  const { type, id, data } = event.data

  try {
    let result: unknown

    switch (type) {
      case 'traverse':
        result = calculateTraverse(data as TraverseData)
        break
      case 'leveling':
        result = calculateLeveling(data as LevelingData)
        break
      case 'volume':
        result = calculateVolume(data)
        break
      case 'tin':
        result = calculateTIN(data)
        break
      case 'contours':
        result = generateContours(data)
        break
      default:
        throw new Error(`Unknown calculation type: ${type}`)
    }

    self.postMessage({ id, success: true, result })
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : 'Calculation failed'
    })
  }
}

function calculateTraverse(data: TraverseData) {
  const { points, method } = data
  if (points.length < 2) return { adjustedPoints: [], error: 'Need at least 2 points' }

  let sumDx = 0
  let sumDy = 0

  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1]
    const p1 = points[i]
    if (p1.bearing !== undefined && p1.distance !== undefined) {
      const rad = (p1.bearing * Math.PI) / 180
      sumDx += p1.distance * Math.sin(rad)
      sumDy += p1.distance * Math.cos(rad)
    } else if (p1.x !== undefined && p1.y !== undefined) {
      sumDx += p1.x - p0.x
      sumDy += p1.y - p0.y
    }
  }

  const totalDistance = points.reduce((sum, p, i) => {
    if (i === 0) return sum
    const prev = points[i - 1]
    if (prev.bearing !== undefined && p.distance !== undefined) {
      return sum + p.distance
    }
    return sum + Math.sqrt(Math.pow((p.x || 0) - (prev.x || 0), 2) + Math.pow((p.y || 0) - (prev.y || 0), 2))
  }, 0)

  const error = Math.sqrt(sumDx * sumDx + sumDy * sumDy)
  const precision = totalDistance > 0 ? totalDistance / error : 0

  const adjustedPoints = points.map((p, i) => {
    if (i === 0) return p
    const correction = method === 'bowditch' 
      ? (error * totalDistance) / (2 * totalDistance * totalDistance)
      : error / points.length
    
    return {
      ...p,
      correctionFactor: correction
    }
  })

  return { adjustedPoints, error, precision, method }
}

function calculateLeveling(data: LevelingData) {
  const { readings, benchmark } = data
  
  let currentHeight = benchmark
  const results: Array<{ point: string; height: number; rise?: number; fall?: number }> = []

  for (let i = 0; i < readings.length; i++) {
    const reading = readings[i]
    
    if (reading.backsight !== undefined) {
      currentHeight += reading.backsight
      results.push({ point: `BS${i + 1}`, height: currentHeight })
    }
    
    if (reading.intermediate !== undefined) {
      const height = currentHeight - reading.intermediate
      results.push({ point: `IS${i + 1}`, height, rise: undefined, fall: undefined })
    }
    
    if (reading.foresight !== undefined) {
      const rise = currentHeight - reading.foresight
      currentHeight = reading.foresight
      results.push({ point: `FS${i + 1}`, height: currentHeight, rise: rise > 0 ? rise : undefined, fall: rise < 0 ? Math.abs(rise) : undefined })
    }
  }

  const totalRise = results.reduce((sum, r) => sum + (r.rise || 0), 0)
  const totalFall = results.reduce((sum, r) => sum + (r.fall || 0), 0)
  const check = totalRise - totalFall

  return { results, check, totalRise, totalFall, benchmark }
}

function calculateVolume(data: { surfacePoints: Array<{ x: number; y: number; z: number }>; referenceZ: number; method: string }) {
  const { surfacePoints, referenceZ, method } = data
  
  if (surfacePoints.length < 3) return { volume: 0, error: 'Need at least 3 points' }

  const xs = surfacePoints.map(p => p.x)
  const ys = surfacePoints.map(p => p.y)
  const zs = surfacePoints.map(p => p.z)

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const resolution = 50
  const stepX = (maxX - minX) / resolution
  const stepY = (maxY - minY) / resolution

  let cutVolume = 0
  let fillVolume = 0

  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const x = minX + i * stepX
      const y = minY + j * stepY
      
      const nearest = surfacePoints.reduce((prev, curr) => {
        const dist = Math.sqrt(Math.pow(curr.x - x, 2) + Math.pow(curr.y - y, 2))
        const prevDist = Math.sqrt(Math.pow(prev.x - x, 2) + Math.pow(prev.y - y, 2))
        return dist < prevDist ? curr : prev
      })

      const height = nearest.z
      const diff = height - referenceZ
      const cellArea = stepX * stepY

      if (diff > 0) {
        cutVolume += diff * cellArea
      } else {
        fillVolume += Math.abs(diff) * cellArea
      }
    }
  }

  return { cutVolume, fillVolume, netVolume: cutVolume - fillVolume, method }
}

function calculateTIN(data: { points: Array<{ x: number; y: number; z: number }> }) {
  const { points } = data
  
  if (points.length < 3) return { triangles: [], vertices: points }

  const triangulate = (pts: Array<{ x: number; y: number; z: number }>): number[][] => {
    const triangles: number[][] = []
    
    for (let i = 0; i < pts.length - 2; i++) {
      for (let j = i + 1; j < pts.length - 1; j++) {
        for (let k = j + 1; k < pts.length; k++) {
          triangles.push([i, j, k])
        }
      }
    }
    
    return triangles
  }

  return {
    vertices: points,
    triangles: triangulate(points),
    surfaceArea: calculateSurfaceArea(points, triangulate(points))
  }
}

function generateContours(data: { points: Array<{ x: number; y: number; z: number }>; interval: number }) {
  const { points, interval } = data
  
  if (points.length < 3) return { contours: [] }

  const minZ = Math.min(...points.map(p => p.z))
  const maxZ = Math.max(...points.map(p => p.z))

  const levels: number[] = []
  for (let z = Math.floor(minZ / interval) * interval; z <= maxZ; z += interval) {
    levels.push(z)
  }

  return { contours: levels, bounds: { minZ, maxZ }, interval }
}

function calculateSurfaceArea(points: Array<{ x: number; y: number; z: number }>, triangles: number[][]): number {
  let area = 0
  
  for (const tri of triangles) {
    const p0 = points[tri[0]]
    const p1 = points[tri[1]]
    const p2 = points[tri[2]]

    const v1 = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z }
    const v2 = { x: p2.x - p0.x, y: p2.y - p0.y, z: p2.z - p0.z }

    const cross = {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x
    }

    area += Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z) / 2
  }

  return area
}

export {}
