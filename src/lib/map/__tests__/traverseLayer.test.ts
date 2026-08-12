/**
 * Tests for traverseLayer module
 *
 * The only export is the async `createTraverseLayer()`.
 * We mock `@/lib/map/projection` (for `to3857`) and all OpenLayers
 * dynamic imports so the function executes in a Node/jsdom environment.
 */

import { createTraverseLayer } from '../traverseLayer'

function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('expected value to be defined')
  }
  return value
}

// ---------------------------------------------------------------------------
// Mock @/lib/map/projection — to3857 returns identity (pass-through)
// ---------------------------------------------------------------------------

jest.mock('@/lib/map/projection', () => ({
  to3857: jest.fn(async (e: number, n: number) => [e, n] as [number, number]),
}))

// ---------------------------------------------------------------------------
// Mock OpenLayers classes — inline in factories with __esModule
// ---------------------------------------------------------------------------

jest.mock('ol/layer/Vector', () => {
  const L = class VectorLayer {
    opts: Record<string, unknown> | undefined
    constructor(opts?: Record<string, unknown>) { this.opts = opts }
    getSource() { return this.opts?.source }
    set(_k: string, _v: unknown) { /* no-op */ }
  }
  return { __esModule: true, default: L }
})

jest.mock('ol/source/Vector', () => {
  const S = class VectorSource {
    features: unknown[]
    constructor(opts?: Record<string, unknown>) { this.features = (opts?.features ?? []) as unknown[] }
    getFeatures() { return this.features }
    addFeature(f: unknown) { this.features.push(f) }
    removeFeature(_f: unknown) { /* no-op */ }
  }
  return { __esModule: true, default: S }
})

jest.mock('ol/Feature', () => {
  const F = class Feature {
    opts: Record<string, unknown> | undefined
    _style: unknown
    constructor(opts?: Record<string, unknown>) { this.opts = opts }
    get(key: string) { return this.opts?.[key] }
    set(key: string, val: unknown) { if (this.opts) this.opts[key] = val }
    setStyle(s: unknown) { this._style = s }
    getStyle() { return this._style }
  }
  return { __esModule: true, default: F }
})

jest.mock('ol/geom/LineString', () => {
  const L = class LineString {
    coords: number[][]
    constructor(coords: number[][]) { this.coords = coords }
    getCoordinates() { return this.coords }
  }
  return { __esModule: true, default: L }
})

jest.mock('ol/geom/Point', () => {
  const P = class PointGeom {
    coords: number[]
    constructor(coords: number[]) { this.coords = coords }
    getCoordinates() { return this.coords }
  }
  return { __esModule: true, default: P }
})

jest.mock('ol/style/Style', () => {
  const S = class Style {
    opts: Record<string, unknown> | undefined
    constructor(opts?: Record<string, unknown>) { this.opts = opts }
    getStroke() { return this.opts?.stroke }
    getImage() { return this.opts?.image }
    getText() { return this.opts?.text }
  }
  return { __esModule: true, default: S }
})

jest.mock('ol/style/Stroke', () => {
  const S = class Stroke {
    opts: Record<string, unknown> | undefined
    constructor(opts?: Record<string, unknown>) { this.opts = opts }
    getColor() { return this.opts?.color }
    getWidth() { return this.opts?.width }
    getLineDash() { return this.opts?.lineDash }
  }
  return { __esModule: true, default: S }
})

jest.mock('ol/style/Fill', () => {
  const F = class Fill {
    opts: Record<string, unknown> | undefined
    constructor(opts?: Record<string, unknown>) { this.opts = opts }
  }
  return { __esModule: true, default: F }
})

jest.mock('ol/style/Text', () => {
  const T = class Text {
    opts: Record<string, unknown> | undefined
    constructor(opts?: Record<string, unknown>) { this.opts = opts }
  }
  return { __esModule: true, default: T }
})

jest.mock('ol/style/RegularShape', () => {
  const R = class RegularShape {
    opts: Record<string, unknown> | undefined
    constructor(opts?: Record<string, unknown>) { this.opts = opts }
  }
  return { __esModule: true, default: R }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Typed shapes for the mock style chain read in the style assertions below —
// the values originate from mocked OL classes, so we re-type at the boundary.
interface MockStyleLike {
  opts: {
    stroke: { opts: { color?: string; width?: number } }
  }
}

interface MockFeatureLike {
  getStyle(): MockStyleLike[]
}

describe('createTraverseLayer', () => {
  it('returns a VectorLayer instance', async () => {
    const layer = await createTraverseLayer([])
    const mockLayer = layer as unknown as { opts: { source: unknown } }
    expect(layer).toBeDefined()
    expect(mockLayer.opts).toBeDefined()
    expect(mockLayer.opts.source).toBeDefined()
  })

  it('with empty legs returns a layer with no features', async () => {
    const layer = await createTraverseLayer([])
    const source = defined(layer.getSource())
    expect(source.getFeatures().length).toBe(0)
  })

  it('with one leg creates leg line, arrow, distance label, and two station labels', async () => {
    const legs = [
      {
        fromStation: 'A',
        toStation: 'B',
        fromE: 100,
        fromN: 200,
        toE: 200,
        toN: 200,
        meanDistance: 100,
      },
    ]

    const layer = await createTraverseLayer(legs)
    const source = defined(layer.getSource())
    const features = source.getFeatures()
    // 1 leg line + 1 arrow + 1 distance label + 2 station labels = 5
    expect(features.length).toBe(5)
  })

  it('with two legs creates features for both legs plus unique stations', async () => {
    const legs = [
      {
        fromStation: 'A',
        toStation: 'B',
        fromE: 100,
        fromN: 200,
        toE: 200,
        toN: 200,
      },
      {
        fromStation: 'B',
        toStation: 'C',
        fromE: 200,
        fromN: 200,
        toE: 200,
        toN: 300,
      },
    ]

    const layer = await createTraverseLayer(legs)
    const features = defined(layer.getSource()).getFeatures()
    // 2 legs × 3 features each (line, arrow, distance) + 3 unique stations = 9
    expect(features.length).toBe(9)
  })

  it('with a closing leg (A→B→A) does not duplicate station A label', async () => {
    const legs = [
      {
        fromStation: 'A',
        toStation: 'B',
        fromE: 100,
        fromN: 200,
        toE: 200,
        toN: 200,
      },
      {
        fromStation: 'B',
        toStation: 'A',
        fromE: 200,
        fromN: 200,
        toE: 100,
        toN: 200,
      },
    ]

    const layer = await createTraverseLayer(legs)
    const features = defined(layer.getSource()).getFeatures()
    // 2 legs × 3 + 2 unique stations = 8
    expect(features.length).toBe(8)
  })

  it('normal leg gets blue dashed line style', async () => {
    const legs = [
      {
        fromStation: 'A',
        toStation: 'B',
        fromE: 100,
        fromN: 200,
        toE: 200,
        toN: 200,
      },
    ]

    const layer = await createTraverseLayer(legs)
    const features = defined(layer.getSource()).getFeatures()

    // First feature is the leg line
    const lineFeature = features[0] as unknown as MockFeatureLike
    const styles = lineFeature.getStyle()
    // The last style in the array is the dashed line
    const lineStyle = Array.isArray(styles) ? styles[styles.length - 1] : styles
    expect(lineStyle.opts.stroke.opts.color).toBe('#0066CC')
  })

  it('warning misclosure leg gets orange line style', async () => {
    const legs = [
      {
        fromStation: 'A',
        toStation: 'B',
        fromE: 100,
        fromN: 200,
        toE: 200,
        toN: 200,
        misclosure: 20, // between warning (15) and error (30)
      },
    ]

    const layer = await createTraverseLayer(
      legs,
      { misclosureWarningThreshold: 15, misclosureErrorThreshold: 30 },
    )
    const features = defined(layer.getSource()).getFeatures()
    const lineFeature = features[0] as unknown as MockFeatureLike
    const styles = lineFeature.getStyle()
    const lineStyle = Array.isArray(styles) ? styles[styles.length - 1] : styles
    expect(lineStyle.opts.stroke.opts.color).toBe('#FF8C00')
  })

  it('error misclosure leg gets red line style with glow', async () => {
    const legs = [
      {
        fromStation: 'A',
        toStation: 'B',
        fromE: 100,
        fromN: 200,
        toE: 200,
        toN: 200,
        misclosure: 45, // above error threshold (30)
      },
    ]

    const layer = await createTraverseLayer(
      legs,
      { misclosureWarningThreshold: 15, misclosureErrorThreshold: 30 },
    )
    const features = defined(layer.getSource()).getFeatures()
    const lineFeature = features[0] as unknown as MockFeatureLike
    const styles = lineFeature.getStyle()
    expect(Array.isArray(styles)).toBe(true)
    // First style should be the glow (wide, semi-transparent)
    const glowStyle = styles[0]
    expect(glowStyle.opts.stroke.opts.width).toBe(12)
    // Line style is last
    const lineStyle = styles[styles.length - 1]
    expect(lineStyle.opts.stroke.opts.color).toBe('#CC0000')
  })

  it('showDistances=false skips distance labels', async () => {
    const legs = [
      {
        fromStation: 'A',
        toStation: 'B',
        fromE: 100,
        fromN: 200,
        toE: 200,
        toN: 200,
      },
    ]

    const layer = await createTraverseLayer(legs, { showDistances: false })
    const features = defined(layer.getSource()).getFeatures()
    // 1 leg line + 1 arrow + 2 station labels = 4 (no distance label)
    expect(features.length).toBe(4)
  })

  it('uses custom arrow size option', async () => {
    const legs = [
      {
        fromStation: 'A',
        toStation: 'B',
        fromE: 100,
        fromN: 200,
        toE: 200,
        toN: 200,
      },
    ]

    // Should not throw with custom arrow size
    const layer = await createTraverseLayer(legs, { arrowSize: 12 })
    expect(layer).toBeDefined()
  })
})
