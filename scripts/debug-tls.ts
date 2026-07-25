// Debug: TLS convergence with the larger 6×3 system
const { computeStandardTLS } = require('../src/lib/survey/totalLeastSquares')

// Try a much simpler system: 4 equations, 2 unknowns
const A = [
  [1, 1],
  [1, 2],
  [1, 3],
  [1, 4],
]
const x_true = [1, 2]  // y = 1 + 2x
const l_clean = A.map(row => row.reduce((s, a, j) => s + a * x_true[j], 0))
// l_clean = [3, 5, 7, 9]

console.log('l_clean:', l_clean)

// No noise — should recover exactly
const result0 = computeStandardTLS({ A, l: l_clean })
console.log('No noise — TLS x:', result0.x, 'residuals:', result0.residuals)

// With small noise on l (not A)
const l = [3.01, 4.99, 7.02, 8.98]
const result = computeStandardTLS({ A, l })
console.log('With noise on l — TLS x:', result.x, 'residuals:', result.residuals)
console.log('Expected x ≈ [1, 2]')

// With noise on BOTH A and l (true TLS scenario)
const A_noisy = [
  [1.01, 1.00],
  [0.99, 2.01],
  [1.00, 2.99],
  [1.01, 3.99],
]
const l_noisy = [3.01, 4.99, 7.02, 8.98]
const result_tls = computeStandardTLS({ A: A_noisy, l: l_noisy })
console.log('\nWith noise on A AND l — TLS x:', result_tls.x)
console.log('This is the TLS sweet spot — both A and l have errors')
