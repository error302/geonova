// Debug: calibration outlier detection
const { calibrateTransformation } = require('../src/lib/geo/transformationCalibration')

const commonPoints = [
  { id: 'P1', source: { x: 5000000, y: 3000000, z: -1000000 }, target: { x: 5000100, y: 3000200, z: -999950 } },
  { id: 'P2', source: { x: 4500000, y: -2500000, z: -1200000 }, target: { x: 4500100, y: -2499800, z: -1199950 } },
  { id: 'P3', source: { x: -5200000, y: 3100000, z: -900000 }, target: { x: -5199900, y: 3100200, z: -899950 } },
  { id: 'P4', source: { x: 100000, y: 50000, z: 6100000 }, target: { x: 100100, y: 50200, z: 6100050 } },
  { id: 'P5', source: { x: -2000000, y: -1800000, z: 4500000 }, target: { x: -1999900, y: -1799800, z: 4500050 } },
]

// Add 10m blunder to point 3
const withBlunder = [...commonPoints]
withBlunder[2] = {
  ...withBlunder[2],
  target: { x: withBlunder[2].target.x + 10.0, y: withBlunder[2].target.y, z: withBlunder[2].target.z },
}

console.log('=== Without outlier removal ===')
const result1 = calibrateTransformation(withBlunder, { outlierThreshold: 2.0, removeOutliers: false })
console.log('RMS:', result1.rmsFit)
console.log('Outlier count:', result1.outlierCount)
console.log('Per-point residuals:')
for (const r of result1.pointResiduals) {
  console.log(`  ${r.id}: mag=${r.residualMagnitude.toFixed(4)}m, isOutlier=${r.isOutlier}`)
}
console.log('Parameters:', result1.parameters)
console.log('Summary:', result1.summary)

console.log('\n=== With outlier removal ===')
const result2 = calibrateTransformation(withBlunder, { outlierThreshold: 2.0, removeOutliers: true })
console.log('RMS:', result2.rmsFit)
console.log('Outlier count:', result2.outlierCount)
console.log('Warnings:', result2.warnings)
console.log('Point count (after removal):', result2.pointCount)
console.log('Per-point residuals:')
for (const r of result2.pointResiduals) {
  console.log(`  ${r.id}: mag=${r.residualMagnitude.toFixed(4)}m, isOutlier=${r.isOutlier}`)
}
