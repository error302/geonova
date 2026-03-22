export const DPI = 96
export const MM_PER_INCH = 25.4
export const PX_PER_MM = DPI / MM_PER_INCH
export const PX_PER_M = PX_PER_MM * 1000

export const STANDARD_SCALES = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000]
export const PAGE_WIDTH_MM = 420
export const PAGE_HEIGHT_MM = 297

export function mmToPx(mm: number): number {
  return mm * PX_PER_MM
}

export function mToPx(m: number): number {
  return m * PX_PER_M
}

export function pxToM(px: number): number {
  return px / PX_PER_M
}

export function selectScale(drawingWidthPx: number, drawingWidthM: number): number {
  const rawScale = drawingWidthPx / drawingWidthM
  return STANDARD_SCALES.find(s => s >= rawScale) || 50000
}

export function calcScaleLabel(scale: number): string {
  return `1:${scale.toLocaleString()}`
}

export function calcScaleBarMetres(scale: number): number {
  return scale >= 1000 ? 500 : 200
}

export function bearingFromDelta(dE: number, dN: number): number {
  const rad = Math.atan2(dE, dN)
  let deg = rad * 180 / Math.PI
  if (deg < 0) deg += 360
  return deg
}

export function bearingToDMS(deg: number): string {
  const d = Math.floor(deg)
  const mFloat = (deg - d) * 60
  const m = Math.floor(mFloat)
  const s = (mFloat - m) * 60
  return `${d}\u00B0${m}'${s.toFixed(1)}"`
}

export function distance(e1: number, n1: number, e2: number, n2: number): number {
  return Math.sqrt((e2 - e1) ** 2 + (n2 - n1) ** 2)
}

export function midpoint(e1: number, n1: number, e2: number, n2: number): [number, number] {
  return [(e1 + e2) / 2, (n1 + n2) / 2]
}

export function segmentAngle(e1: number, n1: number, e2: number, n2: number): number {
  const rad = Math.atan2(e2 - e1, n2 - n1)
  return rad * 180 / Math.PI
}

export function textAngleForSegment(e1: number, n1: number, e2: number, n2: number): number {
  let angle = segmentAngle(e1, n1, e2, n2)
  if (angle > 90 || angle < -90) angle += 180
  return angle
}

export function offsetFromMidpoint(
  e1: number, n1: number, e2: number, n2: number,
  offsetM: number
): [number, number] {
  const dE = e2 - e1
  const dN = n2 - n1
  const len = Math.sqrt(dE * dE + dN * dN)
  const perpE = -dN / len
  const perpN = dE / len
  const [mx, my] = midpoint(e1, n1, e2, n2)
  return [mx + perpE * offsetM, my + perpN * offsetM]
}

export function centroid(points: Array<{ easting: number; northing: number }>): [number, number] {
  if (points.length === 0) return [0, 0]
  const sumE = points.reduce((s, p) => s + p.easting, 0)
  const sumN = points.reduce((s, p) => s + p.northing, 0)
  return [sumE / points.length, sumN / points.length]
}

export function boundingBox(points: Array<{ easting: number; northing: number }>) {
  const eastings = points.map(p => p.easting)
  const northings = points.map(p => p.northing)
  const minE = Math.min(...eastings)
  const maxE = Math.max(...eastings)
  const minN = Math.min(...northings)
  const maxN = Math.max(...northings)
  return {
    minE, maxE, minN, maxN,
    rangeE: maxE - minE || 1,
    rangeN: maxN - minN || 1,
  }
}

export function formatBearingDegMinSec(deg: number): string {
  const d = Math.floor(deg)
  const mFloat = (deg - d) * 60
  const m = Math.floor(mFloat)
  const s = (mFloat - m) * 60
  return `${String(d).padStart(3,'0')}°${String(m).padStart(2,'0')}'${s.toFixed(1).padStart(4,'0')}"`
}

export function shoelaceArea(points: Array<{ easting: number; northing: number }>): number {
  let a = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    a += points[i].easting * points[j].northing - points[j].easting * points[i].northing
  }
  return Math.abs(a) / 2
}

export function shoelacePerimeter(points: Array<{ easting: number; northing: number }>): number {
  let p = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    const dx = points[j].easting - points[i].easting
    const dy = points[j].northing - points[i].northing
    p += Math.sqrt(dx * dx + dy * dy)
  }
  return p
}

export function rotatePoints(
  points: Array<{ easting: number; northing: number }>,
  angleDeg: number,
  cx?: number, cy?: number
): Array<{ easting: number; northing: number }> {
  const rad = angleDeg * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  let mx = 0, my = 0
  if (cx !== undefined && cy !== undefined) {
    mx = cx; my = cy
  } else {
    for (const p of points) { mx += p.easting; my += p.northing }
    mx /= points.length; my /= points.length
  }
  return points.map(p => ({
    easting: cos * (p.easting - mx) - sin * (p.northing - my) + mx,
    northing: sin * (p.easting - mx) + cos * (p.northing - my) + my,
  }))
}

export function parseCornersCSV(csv: string): Array<{ name: string; easting: number; northing: number }> {
  const lines = csv.trim().split('\n').map(l => l.trim()).filter(Boolean)
  const result: Array<{ name: string; easting: number; northing: number }> = []
  for (const line of lines) {
    const parts = line.split(/[,\t]+/)
    if (parts.length < 3) continue
    const name = parts[0].trim()
    const e = parseFloat(parts[1].trim())
    const n = parseFloat(parts[2].trim())
    if (isNaN(e) || isNaN(n)) continue
    if (result.length === 0) {
      const firstColNum = parseFloat(name)
      if (!isNaN(firstColNum) || /^(label|name|point|corner|station)/i.test(name)) continue
    }
    if (!name) continue
    result.push({ name, easting: e, northing: n })
  }
  if (result.length < 3) throw new Error('CSV must have at least 3 valid corner rows')
  return result
}
