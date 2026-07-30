// Debug script: rotation test case
const { computeHelmertTransformationRigorous } = require('../src/lib/geo/helmertRigorous')

const rotAngle = 0.001  // 1 milliradian
const cosR = Math.cos(rotAngle)
const sinR = Math.sin(rotAngle)

const sources = [
  [5000000, 3000000, -1000000],
  [4500000, -2500000, -1200000],
  [-5200000, 3100000, -900000],
  [100000, 50000, 6100000],
  [-2000000, -1800000, 4500000],
]

const rotPoints = sources.map(([x, y, z], i) => ({
  id: `P${i}`,
  sourceX: x, sourceY: y, sourceZ: z,
  targetX: cosR * x - sinR * y,
  targetY: sinR * x + cosR * y,
  targetZ: z,
}))

console.log('Test points:')
for (const p of rotPoints) {
  console.log(`  ${p.id}: src=(${p.sourceX}, ${p.sourceY}, ${p.sourceZ}) → tgt=(${p.targetX.toFixed(2)}, ${p.targetY.toFixed(2)}, ${p.targetZ})`)
}

const result = computeHelmertTransformationRigorous(rotPoints, { maxIterations: 100 })
console.log('\nResult:', {
  tx: result?.parameters.tx,
  ty: result?.parameters.ty,
  tz: result?.parameters.tz,
  rx: result?.parameters.rx,
  ry: result?.parameters.ry,
  rz: result?.parameters.rz,
  scale: result?.parameters.scale,
  rmsTotal: result?.rmsTotal,
  iterations: result?.iterations,
  converged: result?.converged,
  finalCorrection: result?.finalCorrection,
})
