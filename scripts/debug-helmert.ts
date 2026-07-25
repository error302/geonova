// Debug script: trace through the rigorous Helmert computation
const { computeHelmertTransformationRigorous, transformPointFull, fullRotationMatrix } = require('../src/lib/geo/helmertRigorous')

const testPoints = [
  { id: 'P1', sourceX: 5000000, sourceY: 3000000, sourceZ: -1000000, targetX: 5000100, targetY: 3000200, targetZ: -1000050 },
  { id: 'P2', sourceX: 4500000, sourceY: -2500000, sourceZ: -1200000, targetX: 4500100, targetY: -2499800, targetZ: -1200050 },
  { id: 'P3', sourceX: -5200000, sourceY: 3100000, sourceZ: -900000, targetX: -5199900, targetY: 3100200, targetZ: -900050 },
  { id: 'P4', sourceX: 100000, sourceY: 50000, sourceZ: 6100000, targetX: 100100, targetY: 50200, targetZ: 6100050 },
  { id: 'P5', sourceX: -2000000, sourceY: -1800000, sourceZ: 4500000, targetX: -1999900, targetY: -1799800, targetZ: 4500050 },
]

// Initial guess check
let srcCx = 0, srcCy = 0, srcCz = 0
let tgtCx = 0, tgtCy = 0, tgtCz = 0
for (const p of testPoints) {
  srcCx += p.sourceX; srcCy += p.sourceY; srcCz += p.sourceZ
  tgtCx += p.targetX; tgtCy += p.targetY; tgtCz += p.targetZ
}
const n = testPoints.length
console.log('Initial guess:')
console.log('  srcCx=', srcCx/n, 'tgtCx=', tgtCx/n)
console.log('  tx=', (tgtCx - srcCx)/n, 'ty=', (tgtCy - srcCy)/n, 'tz=', (tgtCz - srcCz)/n)

// Verify the initial guess produces zero residuals
const params0 = { tx: (tgtCx-srcCx)/n, ty: (tgtCy-srcCy)/n, tz: (tgtCz-srcCz)/n, rx: 0, ry: 0, rz: 0, scale: 1 }
console.log('\nResiduals at initial guess:')
for (const p of testPoints) {
  const f = transformPointFull(p.sourceX, p.sourceY, p.sourceZ, params0)
  console.log(`  ${p.id}: target=(${p.targetX}, ${p.targetY}, ${p.targetZ}), f=(${f.x}, ${f.y}, ${f.z}), res=(${p.targetX-f.x}, ${p.targetY-f.y}, ${p.targetZ-f.z})`)
}

console.log('\n=== Rigorous (full rotation) ===')
const rigorous = computeHelmertTransformationRigorous(testPoints)
if (rigorous) {
  console.log('Rigorous result:', {
    tx: rigorous.parameters.tx,
    ty: rigorous.parameters.ty,
    tz: rigorous.parameters.tz,
    rx: rigorous.parameters.rx,
    ry: rigorous.parameters.ry,
    rz: rigorous.parameters.rz,
    scale: rigorous.parameters.scale,
    rmsTotal: rigorous.rmsTotal,
    iterations: rigorous.iterations,
    converged: rigorous.converged,
    finalCorrection: rigorous.finalCorrection,
  })
}

