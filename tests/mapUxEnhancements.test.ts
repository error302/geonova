import { evaluateTraverseClosure } from '@/lib/engine/traverse'
import { distanceBearing } from '@/lib/engine/distance'

describe('Map UX Enhancements — Traverse Closure & Workflow Tests', () => {
  describe('Instant Closure Computations', () => {
    it('computes linear misclosure and precision ratio for a perfect square polygon', () => {
      const vertices = [
        { easting: 250000, northing: 9850000 },
        { easting: 250100, northing: 9850000 },
        { easting: 250100, northing: 9850100 },
        { easting: 250000, northing: 9850100 },
      ]

      let sumDeltaE = 0
      let sumDeltaN = 0
      let perimeter = 0

      for (let i = 0; i < vertices.length; i++) {
        const from = vertices[i]
        const to = vertices[(i + 1) % vertices.length]
        const leg = distanceBearing(from, to)
        sumDeltaE += leg.deltaE
        sumDeltaN += leg.deltaN
        perimeter += leg.distance
      }

      const linearMisclosure = Math.sqrt(sumDeltaE ** 2 + sumDeltaN ** 2)
      expect(perimeter).toBeCloseTo(400, 2)
      expect(linearMisclosure).toBeCloseTo(0, 4)

      const evalResult = evaluateTraverseClosure(linearMisclosure, perimeter, 'cadastral')
      expect(evalResult.passes).toBe(true)
    })

    it('evaluates passing and failing cadastral tolerances', () => {
      const perimeter = 1000 // 1 km perimeter
      // 0.1m error -> 1:10,000 (Passes cadastral minimum 1:5,000)
      const passResult = evaluateTraverseClosure(0.1, perimeter, 'cadastral')
      expect(passResult.passes).toBe(true)
      expect(passResult.ratio).toBe(10000)

      // 0.5m error -> 1:2,000 (Fails cadastral minimum 1:5,000)
      const failResult = evaluateTraverseClosure(0.5, perimeter, 'cadastral')
      expect(failResult.passes).toBe(false)
      expect(failResult.ratio).toBe(2000)
    })
  })
})
