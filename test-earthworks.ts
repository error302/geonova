import { computeCrossSection, computeEarthwork, parseEarthworkCSV, type RoadTemplate } from './src/lib/computations/earthworksEngine.js'

const template: RoadTemplate = {
  carriagewayWidth: 7.0,
  shoulderWidth: 1.0,
  camber: 2.5,
  cutSlopeH: 1,
  fillSlopeH: 1.5,
}

// TEST 1: Cross section at 0+000
// Formation RL=100.000, CL RL=102.500 (2.5m cut)
// Left: 5m/102.800, 10m/103.200, 15m/103.000
// Right: 5m/102.600, 10m/102.900, 15m/102.700
console.log('=== TEST 1: Cross Section Area ===')
const t1 = computeCrossSection({
  chainage: 0,
  centrelineRL: 102.500,
  formationRL: 100.000,
  leftShots: [
    { offset: -5, rl: 102.800 },
    { offset: -10, rl: 103.200 },
    { offset: -15, rl: 103.000 },
  ],
  rightShots: [
    { offset: 5, rl: 102.600 },
    { offset: 10, rl: 102.900 },
    { offset: 15, rl: 102.700 },
  ],
}, template)
console.log('Cut area:', t1.cutArea.toFixed(3), 'm² (expected: > 0, all cut)')
console.log('Fill area:', t1.fillArea.toFixed(3), 'm² (expected: 0)')
console.log('Mode:', t1.mode, '(expected: cut)')
console.log('Centre height:', t1.centreHeight.toFixed(3), 'm (expected: +2.500)')
console.log('Arithmetic check:', t1.arithmeticCheck.passed ? 'PASS ✓' : 'FAIL ' + t1.arithmeticCheck.diff.toFixed(4))
console.log('Left catch point:', t1.leftCatchPoint ? `offset=${t1.leftCatchPoint.offset.toFixed(2)}, type=${t1.leftCatchPoint.type}` : 'null')
console.log('Right catch point:', t1.rightCatchPoint ? `offset=${t1.rightCatchPoint.offset.toFixed(2)}, type=${t1.rightCatchPoint.type}` : 'null')

// TEST 2: Volume between two sections
console.log('\n=== TEST 2: Volume (Two Sections) ===')
const t2a = t1
const t2b = computeCrossSection({
  chainage: 20,
  centrelineRL: 101.500,
  formationRL: 100.000,
  leftShots: [
    { offset: -5, rl: 102.800 },
    { offset: -10, rl: 103.200 },
    { offset: -15, rl: 103.000 },
  ],
  rightShots: [
    { offset: 5, rl: 102.600 },
    { offset: 10, rl: 102.900 },
    { offset: 15, rl: 102.700 },
  ],
}, template)
console.log('Section 2: Cut area:', t2b.cutArea.toFixed(3), 'Fill area:', t2b.fillArea.toFixed(3))

const ew = computeEarthwork([t2a, t2b], 0.85)
console.log('End Area Cut vol:', ew.legs[0]?.cutVolEndArea.toFixed(3), 'm³')
console.log('Prismoidal Cut vol:', ew.legs[0]?.cutVolPrismoidal.toFixed(3), 'm³')
console.log('Prismoidal < End Area?', ew.legs[0]?.cutVolPrismoidal < ew.legs[0]?.cutVolEndArea ? 'YES ✓' : 'NO ✗')

// TEST 3: Mass haul with 5 alternating sections
console.log('\n=== TEST 3: Mass Haul (5 sections) ===')
const sections5 = [
  { ch: 0, cl: 103.000, form: 100.000 },    // cut
  { ch: 20, cl: 100.500, form: 100.000 },   // transition
  { ch: 40, cl: 99.500, form: 100.000 },    // fill
  { ch: 60, cl: 100.200, form: 100.000 },   // cut
  { ch: 80, cl: 99.000, form: 100.000 },    // fill
]
const template5: RoadTemplate = { carriagewayWidth: 7, shoulderWidth: 1.5, camber: 2.5, cutSlopeH: 1, fillSlopeH: 1.5 }
const computed5 = sections5.map(s =>
  computeCrossSection({ chainage: s.ch, centrelineRL: s.cl, formationRL: s.form, leftShots: [{ offset: -5, rl: s.cl }, { offset: -10, rl: s.cl }], rightShots: [{ offset: 5, rl: s.cl }, { offset: 10, rl: s.cl }] }, template5)
)
const ew5 = computeEarthwork(computed5, 0.85)
console.log('Mass ordinates:')
ew5.massOrdinates.forEach(o => console.log(' ch=' + o.chainage + ' ordinate=' + o.ordinate.toFixed(2) + ' (' + (o.ordinate >= 0 ? 'SURPLUS' : 'DEFICIT') + ')'))
const hasPositive = ew5.massOrdinates.some(o => o.ordinate > 0)
const hasNegative = ew5.massOrdinates.some(o => o.ordinate < 0)
console.log('Has surplus humps:', hasPositive ? 'YES ✓' : 'NO ✗')
console.log('Has deficit valleys:', hasNegative ? 'YES ✓' : 'NO ✗')

// TEST 4: CSV import
console.log('\n=== TEST 4: CSV Import ===')
const csv = `chainage_km,chainage_m,cl_rl,formation_rl,L1_offset,L1_rl,L2_offset,L2_rl,R1_offset,R1_rl,R2_offset,R2_rl
0,0,102.500,100.000,5,102.800,10,103.200,5,102.600,10,102.900
0,20,101.500,100.000,5,102.100,10,102.600,5,102.200,10,102.500
0,40,100.000,100.000,5,100.800,10,101.200,5,100.900,10,101.100`
const parsed = parseEarthworkCSV(csv)
console.log('Parsed sections:', parsed.length, '(expected: 3)')
if (parsed.length >= 3) {
  console.log('Section 1: ch=' + parsed[0].chainage + ' CL=' + parsed[0].centrelineRL + ' Form=' + parsed[0].formationRL + ' L shots=' + parsed[0].leftShots.length + ' R shots=' + parsed[0].rightShots.length)
  console.log('Section 2: ch=' + parsed[1].chainage + ' CL=' + parsed[1].centrelineRL + ' Form=' + parsed[1].formationRL)
  console.log('Section 3: ch=' + parsed[2].chainage + ' CL=' + parsed[2].centrelineRL + ' Form=' + parsed[2].formationRL)
  console.log('CSV import:', parsed.length === 3 ? 'PASS ✓' : 'FAIL ✗')
}
