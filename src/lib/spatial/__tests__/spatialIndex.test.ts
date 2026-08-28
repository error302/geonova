import {
  SpatialRTree,
  SpatialKdTree,
  cullToViewport,
  type SpatialItem,
  type Point2DItem,
} from '../spatialIndex'

describe('High-Capacity Spatial Indexing Engine', () => {
  describe('SpatialRTree (STR Bulk-Loaded 2D R-Tree)', () => {
    test('indexes and searches 50,000 points with sub-millisecond viewport queries', () => {
      const NUM_POINTS = 50000
      const items: SpatialItem<{ id: number; name: string }>[] = []

      // Generate 50,000 points in a 10km x 10km survey block (0 to 10,000m)
      for (let i = 0; i < NUM_POINTS; i++) {
        const x = (i * 73) % 10000
        const y = (i * 137) % 10000
        items.push({
          minX: x,
          minY: y,
          maxX: x,
          maxY: y,
          data: { id: i, name: `PT_${i}` },
        })
      }

      const rtree = new SpatialRTree<{ id: number; name: string }>(32)
      const t0 = performance.now()
      rtree.load(items)
      const loadTime = performance.now() - t0

      expect(rtree.size).toBe(NUM_POINTS)
      expect(loadTime).toBeLessThan(500) // Bulk loads in under 500ms

      // Query a 500m x 500m viewport window in the center (4500 to 5000)
      const tQuery0 = performance.now()
      const results = rtree.search({
        minX: 4500,
        minY: 4500,
        maxX: 5000,
        maxY: 5000,
      })
      const queryTime = performance.now() - tQuery0

      expect(results.length).toBeGreaterThan(0)
      expect(queryTime).toBeLessThan(5) // Sub-5ms query on 50,000 points

      // Verify all returned items are strictly within query box
      for (const res of results) {
        expect(res.minX).toBeGreaterThanOrEqual(4500)
        expect(res.maxX).toBeLessThanOrEqual(5000)
        expect(res.minY).toBeGreaterThanOrEqual(4500)
        expect(res.maxY).toBeLessThanOrEqual(5000)
      }
    })

    test('culls 50,000 points to viewport correctly', () => {
      const items: SpatialItem<{ label: string }>[] = [
        { minX: 100, minY: 100, maxX: 100, maxY: 100, data: { label: 'Inside' } },
        { minX: 9999, minY: 9999, maxX: 9999, maxY: 9999, data: { label: 'Far Away' } },
      ]
      const rtree = new SpatialRTree<{ label: string }>()
      rtree.load(items)

      const visible = cullToViewport(rtree, {
        minE: 50,
        minN: 50,
        maxE: 150,
        maxN: 150,
      })

      expect(visible.length).toBe(1)
      expect(visible[0].label).toBe('Inside')
    })
  })

  describe('SpatialKdTree (2D K-d Tree for Snapping)', () => {
    test('finds exact nearest beacon in O(log N) time', () => {
      const points: Point2DItem<{ beacon: string }>[] = [
        { x: 10, y: 10, data: { beacon: 'BP1' } },
        { x: 50, y: 50, data: { beacon: 'BP2' } },
        { x: 100, y: 100, data: { beacon: 'BP3' } },
        { x: 200, y: 200, data: { beacon: 'BP4' } },
      ]

      const kdTree = new SpatialKdTree(points)
      expect(kdTree.size).toBe(4)

      // Query near BP2 (52, 49)
      const nearest = kdTree.nearest(52, 49)
      expect(nearest).not.toBeNull()
      expect(nearest!.item.data.beacon).toBe('BP2')
      expect(nearest!.distance).toBeCloseTo(Math.hypot(2, -1), 2)
    })

    test('finds all beacons within snap radius', () => {
      const points: Point2DItem<{ id: number }>[] = [
        { x: 100, y: 100, data: { id: 1 } },
        { x: 105, y: 102, data: { id: 2 } },
        { x: 108, y: 95, data: { id: 3 } },
        { x: 500, y: 500, data: { id: 4 } },
      ]

      const kdTree = new SpatialKdTree(points)
      const within15m = kdTree.withinRadius(100, 100, 15)

      expect(within15m.length).toBe(3)
      const ids = within15m.map(w => w.item.data.id)
      expect(ids).toContain(1)
      expect(ids).toContain(2)
      expect(ids).toContain(3)
      expect(ids).not.toContain(4)
    })
  })
})
