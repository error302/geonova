/**
 * Offline Tile Cache Tests
 * Run: npx jest src/lib/offline/__tests__/tileCache.test.ts
 */

import { describe, it, expect } from '@jest/globals'

import {
  calculateTileCount,
  estimateStorageSize,
  downloadTilesForBounds,
} from '../tileCache'
import type { MapExtent } from '@/app/map/MapReactContext'

describe('tileCache — MapExtent bounds', () => {
  // Nairobi region — the shape shared with the offline downloader and getMapExtent().
  const nairobi: MapExtent = { minLat: -1.35, minLon: 36.7, maxLat: -1.15, maxLon: 36.95 }

  it('calculateTileCount counts the exact tile grid for one zoom level', () => {
    // z=10, n=1024:
    //   minX = floor((36.7+180)/360*1024) = 616, maxX = 617
    //   minY = floor((90-(-1.15))/180*1024) = 518, maxY = 519
    //   (617-616+1) * (519-518+1) = 4
    const { total } = calculateTileCount(nairobi, 10, 10)
    expect(total).toBe(4)
  })

  it('calculateTileCount sums across a zoom range', () => {
    // z=9 -> 1 tile (308, 259); z=10 -> 4 tiles
    const { total } = calculateTileCount(nairobi, 9, 10)
    expect(total).toBe(5)
  })

  it('accepts the shared MapExtent shape used by the offline flows', () => {
    const { total } = calculateTileCount(
      { minLat: -1, minLon: 36, maxLat: 0, maxLon: 37 },
      5,
      5,
    )
    expect(total).toBeGreaterThan(0)
  })

  it('estimateStorageSize varies by source type', () => {
    expect(estimateStorageSize(100, 'satellite')).toBe(4000000)
    expect(estimateStorageSize(100)).toBe(1500000)
  })

  it('downloadTilesForBounds fails closed when IndexedDB is unavailable', async () => {
    // Non-browser (jest) environment has no indexedDB, so the downloader must
    // report every tile as failed instead of throwing.
    const result = await downloadTilesForBounds(
      'osm',
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      nairobi,
      10,
      10,
      'osm',
      () => {},
    )
    expect(result.total).toBe(4)
    expect(result.failed).toBe(result.total)
    expect(result.downloaded).toBe(0)
  })
})
