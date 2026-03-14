import { distanceBearing } from '../src/lib/engine/distance'
import { bearingIntersection, tienstraResection } from '../src/lib/engine/cogo'
import { bowditchAdjustment } from '../src/lib/engine/traverse'
import { coordinateArea } from '../src/lib/engine/area'
import { curveElements } from '../src/lib/engine/curves'
import { riseAndFall } from '../src/lib/engine/leveling'
import { leastSquaresAdjustment } from '../src/lib/engine/leastSquares'
import { geographicToUTM, utmToGeographic } from '../src/lib/engine/coordinates'

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++
    console.log(`✓ ${message}`)
  } else {
    failed++
    console.error(`✗ ${message}`)
  }
}

function near(a: number, b: number, tol = 1e-9) {
  return Math.abs(a - b) <= tol
}

function section(name: string) {
  console.log(`\n== ${name} ==`)
}

section('Distance & Bearing')
{
  const r = distanceBearing({ easting: 1000, northing: 1000 }, { easting: 1100, northing: 1100 })
  assert(near(r.distance, Math.sqrt(20000), 1e-9), 'distanceBearing distance')
  assert(near(r.bearing, 45, 1e-12), 'distanceBearing bearing 45°')
}

section('Forward Intersection (Bearings)')
{
  const A = { easting: 0, northing: 0 }
  const B = { easting: 10, northing: 10 }
  const P = bearingIntersection(A, 90, B, 180)
  assert(Boolean(P), 'bearingIntersection returns a point')
  if (P) {
    assert(near(P.point.easting, 10, 1e-12) && near(P.point.northing, 0, 1e-12), 'bearingIntersection geometry')
    assert(near(P.distanceFromA, 10, 1e-12) && near(P.distanceFromB, 10, 1e-12), 'bearingIntersection distances')
  }
}

section('Traverse Bowditch')
{
  const square = bowditchAdjustment({
    points: [{ name: 'A', easting: 0, northing: 0 }],
    distances: [100, 100, 100, 100],
    bearings: [0, 90, 180, 270],
  })
  assert(square.linearError < 1e-9, 'perfect square traverse closes')

  const link = bowditchAdjustment({
    points: [{ name: 'A', easting: 0, northing: 0 }],
    distances: [100, 100],
    bearings: [0, 90],
    closingPoint: { easting: 100.02, northing: 99.98 },
  })
  const last = link.legs[link.legs.length - 1]
  assert(near(last.adjEasting, 100.02, 1e-12) && near(last.adjNorthing, 99.98, 1e-12), 'closingPoint constraint matches adjusted end')
}

section('Area (Shoelace + Centroid)')
{
  const area = coordinateArea([
    { easting: 0, northing: 0 },
    { easting: 100, northing: 0 },
    { easting: 100, northing: 100 },
    { easting: 0, northing: 100 },
  ])
  assert(near(area.areaSqm, 10000, 1e-9), 'square area')
  assert(near(area.centroid.easting, 50, 1e-9) && near(area.centroid.northing, 50, 1e-9), 'square centroid')
}

section('Curves (Elements)')
{
  const e = curveElements(100, 60)
  assert(near(e.tangentLength, 100 * Math.tan(Math.PI / 6), 1e-12), 'tangent length')
  assert(near(e.arcLength, 100 * (Math.PI / 3), 1e-12), 'arc length')
}

section('Leveling (Arithmetic Check)')
{
  const r = riseAndFall({
    method: 'rise_and_fall',
    openingRL: 100,
    closingRL: 100.2,
    distanceKm: 1,
    readings: [
      { station: 'BM', bs: 1.5 },
      { station: 'TP1', fs: 1.2 },
      { station: 'TP1', bs: 0.8 },
      { station: 'BM2', fs: 1.1 },
    ],
  })
  assert(r.arithmeticCheck === true, 'arithmetic check passes for consistent readings')
  assert(typeof r.misclosure === 'number', 'misclosure computed when closing RL provided')
}

section('Resection (Tienstra)')
{
  // Simple sanity: returns a finite point for reasonable angles
  const P = tienstraResection(
    { easting: 0, northing: 0 },
    { easting: 100, northing: 0 },
    { easting: 0, northing: 100 },
    120,
    120
  )
  assert(Boolean(P), 'tienstraResection returns a point')
  if (P) {
    assert(Number.isFinite(P.point.easting) && Number.isFinite(P.point.northing), 'tienstraResection finite coordinates')
  }
}

section('Least Squares (2D)')
{
  // Fixed control
  const fixed = [
    { name: 'A', easting: 0, northing: 0 },
    { name: 'B', easting: 100, northing: 0 },
  ]

  // True unknown point
  const trueP = { easting: 50, northing: 30 }

  const dAP = Math.sqrt(trueP.easting ** 2 + trueP.northing ** 2)
  const dBP = Math.sqrt((trueP.easting - 100) ** 2 + (trueP.northing - 0) ** 2)
  const bAP = (Math.atan2(trueP.easting - 0, trueP.northing - 0) * 180) / Math.PI
  const bBP = (Math.atan2(trueP.easting - 100, trueP.northing - 0) * 180) / Math.PI

  const result = leastSquaresAdjustment(
    fixed,
    [{ name: 'P', eastingApprox: 48, northingApprox: 28 }],
    [
      { from: 'A', to: 'P', distance: dAP, weight: 1 / (0.002 ** 2) },
      { from: 'B', to: 'P', distance: dBP, weight: 1 / (0.002 ** 2) },
      { from: 'A', to: 'P', bearing: bAP, weight: 1 / (toRadians(5 / 3600) ** 2) }, // 5"
      { from: 'B', to: 'P', bearing: bBP, weight: 1 / (toRadians(5 / 3600) ** 2) }, // 5"
    ]
  )

  assert(result.ok === true, 'leastSquaresAdjustment ok')
  if (result.ok) {
    const p = result.adjustedPoints[0]
    assert(Math.abs(p.easting - trueP.easting) < 1e-3 && Math.abs(p.northing - trueP.northing) < 1e-3, 'least squares converges to true point')
    assert(result.passed === true, 'least squares residual test passes')
  }
}

section('UTM Round-Trip (internal consistency)')
{
  // Special zones
  const norway = geographicToUTM(60, 6)
  assert(norway.zone === 32, 'Norway special zone (32)')

  const svalbard = geographicToUTM(78, 20)
  assert([31, 33, 35, 37].includes(svalbard.zone), 'Svalbard special zone')

  // Randomized internal consistency (not an external truth fixture)
  let seed = 123456
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0xffffffff
  }

  for (let i = 0; i < 50; i++) {
    const lat = -79 + rand() * 163 // UTM supported band approx
    const lon = -179 + rand() * 358

    const utm = geographicToUTM(lat, lon)
    const ll = utmToGeographic(utm.easting, utm.northing, utm.zone, utm.hemisphere)
    const utm2 = geographicToUTM(ll.lat, ll.lon, utm.zone)

    const dE = Math.abs(utm2.easting - utm.easting)
    const dN = Math.abs(utm2.northing - utm.northing)
    if (!(dE < 0.001 && dN < 0.001)) {
      console.error('UTM round-trip failure details:', {
        case: i + 1,
        input: { lat, lon },
        utm,
        back: ll,
        dE,
        dN,
      })
    }
    assert(dE < 0.001 && dN < 0.001, `UTM round-trip <1mm (case ${i + 1})`)
  }
}

console.log(`\nPassed: ${passed}, Failed: ${failed}`)
if (failed > 0) process.exit(1)

function toRadians(deg: number) {
  return (deg * Math.PI) / 180
}
