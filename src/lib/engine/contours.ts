export interface SpotHeight {
  name: string
  easting: number
  northing: number
  elevation: number
}

export interface ContourLine {
  elevation: number
  points: Array<{ easting: number; northing: number }>
}

export interface Triangle {
  p1: SpotHeight
  p2: SpotHeight
  p3: SpotHeight
}

export function triangulate(points: SpotHeight[]): Triangle[] {
  const triangles: Triangle[] = []

  if (points.length < 3) return triangles

  for (let i = 0; i < points.length - 2; i++) {
    for (let j = i + 1; j < points.length - 1; j++) {
      for (let k = j + 1; k < points.length; k++) {
        const p1 = points[i]
        const p2 = points[j]
        const p3 = points[k]

        const d12 = Math.sqrt((p2.easting-p1.easting)**2 + (p2.northing-p1.northing)**2)
        const d23 = Math.sqrt((p3.easting-p2.easting)**2 + (p3.northing-p2.northing)**2)
        const d31 = Math.sqrt((p1.easting-p3.easting)**2 + (p1.northing-p3.northing)**2)
        const perimeter = d12 + d23 + d31
        const maxSide = Math.max(d12, d23, d31)

        if (maxSide > perimeter * 0.7) continue

        triangles.push({ p1, p2, p3 })
      }
    }
  }

  return triangles
}

function interpolateEdge(
  p1: SpotHeight,
  p2: SpotHeight,
  contourElev: number
): { easting: number; northing: number } | null {
  const minElev = Math.min(p1.elevation, p2.elevation)
  const maxElev = Math.max(p1.elevation, p2.elevation)

  if (contourElev <= minElev || contourElev >= maxElev) return null

  const t = (contourElev - p1.elevation) / (p2.elevation - p1.elevation)

  return {
    easting: p1.easting + t * (p2.easting - p1.easting),
    northing: p1.northing + t * (p2.northing - p1.northing)
  }
}

export function generateContours(
  points: SpotHeight[],
  interval: number
): ContourLine[] {
  if (points.length < 3) return []

  const elevations = points.map(p => p.elevation)
  const minElev = Math.min(...elevations)
  const maxElev = Math.max(...elevations)

  const firstContour = Math.ceil(minElev / interval) * interval
  const contourElevations: number[] = []
  for (let e = firstContour; e <= maxElev; e += interval) {
    contourElevations.push(e)
  }

  const triangles = triangulate(points)
  const contourLines: ContourLine[] = []

  for (const contourElev of contourElevations) {
    const contourPoints: Array<{ easting: number; northing: number }> = []

    for (const tri of triangles) {
      const edges: Array<[SpotHeight, SpotHeight]> = [
        [tri.p1, tri.p2],
        [tri.p2, tri.p3],
        [tri.p3, tri.p1]
      ]

      const crossings: Array<{ easting: number; northing: number }> = []

      for (const [a, b] of edges) {
        const crossing = interpolateEdge(a, b, contourElev)
        if (crossing) crossings.push(crossing)
      }

      if (crossings.length === 2) {
        contourPoints.push(crossings[0], crossings[1])
      }
    }

    if (contourPoints.length > 0) {
      contourLines.push({
        elevation: contourElev,
        points: contourPoints
      })
    }
  }

  return contourLines
}
