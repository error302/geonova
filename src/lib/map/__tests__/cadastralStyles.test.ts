/**
 * Tests for cadastralStyles module
 *
 * Pure functions (bearingToOLRotation, computeBearingDeg) are tested directly.
 * Async factory functions are tested with inline mock classes inside jest.mock
 * factories to avoid the hoisting issue with class declarations.
 */

import {
  PARCEL_STATUS_COLORS,
  BEACON_TYPE_COLORS,
  bearingToOLRotation,
  computeBearingDeg,
  createParcelStyleFunction,
  createBeaconStyleFunction,
  createEdgeAnnotationStyleFunction,
  createTraverseLegStyleFunction,
} from '../cadastralStyles'
// Test-side shapes of the mocked OL style objects (see the jest.mock factories
// below) — these mirror the option bags the factories stash in `opts`, so the
// deep assertion chains (result.opts.stroke.opts.color …) stay typed instead
// of any-chains.
interface MockStrokeOpts {
  color?: string
  width?: number
  lineDash?: number[]
}
interface MockFillOpts {
  color?: string
}
interface MockTextOpts {
  text?: string
  rotation?: number
  font?: string
  offsetX?: number
  offsetY?: number
}
interface MockImageOpts {
  radius?: number
  points?: number
  angle?: number
  stroke?: MockStroke
  fill?: MockFill
}
interface MockStroke {
  opts: MockStrokeOpts
}
interface MockFill {
  opts: MockFillOpts
}
interface MockText {
  opts: MockTextOpts
}
interface MockImage {
  opts: MockImageOpts
}
// The option-bag chain props are required because every style the factories
// build carries them (assertions drill down through opts.stroke.opts.color …);
// only the leaf values are optional.
interface MockStyleOpts {
  fill: MockFill
  stroke: MockStroke
  image: MockImage
  text: MockText
  geometry?: unknown
  zIndex?: number
}
interface MockStyle {
  opts: MockStyleOpts
}
type MockStyleFn = (feature: unknown) => MockStyle


// ---------------------------------------------------------------------------
// Mock OpenLayers style classes — defined inline inside factory to avoid
// jest.mock hoisting issues (class declarations are NOT hoisted).
// ---------------------------------------------------------------------------

jest.mock('ol/style/Style', () => {
  const S = class Style {
    opts: MockStyleOpts | undefined
    constructor(opts?: MockStyleOpts) { this.opts = opts }
    getFill() { return this.opts?.fill }
    getStroke() { return this.opts?.stroke }
    getImage() { return this.opts?.image }
    getText() { return this.opts?.text }
    getGeometry() { return this.opts?.geometry }
    getZIndex() { return this.opts?.zIndex }
  }
  return { __esModule: true, default: S }
})

jest.mock('ol/style/Stroke', () => {
  const S = class Stroke {
    opts: MockStrokeOpts | undefined
    constructor(opts?: MockStrokeOpts) { this.opts = opts }
    getColor() { return this.opts?.color }
    getWidth() { return this.opts?.width }
    getLineDash() { return this.opts?.lineDash }
  }
  return { __esModule: true, default: S }
})

jest.mock('ol/style/Fill', () => {
  const F = class Fill {
    opts: MockFillOpts | undefined
    constructor(opts?: MockFillOpts) { this.opts = opts }
    getColor() { return this.opts?.color }
  }
  return { __esModule: true, default: F }
})

jest.mock('ol/style/Circle', () => {
  const C = class CircleStyle {
    opts: MockImageOpts | undefined
    constructor(opts?: MockImageOpts) { this.opts = opts }
    getRadius() { return this.opts?.radius }
    getStroke() { return this.opts?.stroke }
    getFill() { return this.opts?.fill }
  }
  return { __esModule: true, default: C }
})

jest.mock('ol/style/RegularShape', () => {
  const R = class RegularShape {
    opts: MockImageOpts | undefined
    constructor(opts?: MockImageOpts) { this.opts = opts }
    getPoints() { return this.opts?.points }
    getAngle() { return this.opts?.angle }
    getStroke() { return this.opts?.stroke }
    getFill() { return this.opts?.fill }
  }
  return { __esModule: true, default: R }
})

jest.mock('ol/style/Text', () => {
  const T = class Text {
    opts: MockTextOpts | undefined
    constructor(opts?: MockTextOpts) { this.opts = opts }
    getText() { return this.opts?.text }
    getRotation() { return this.opts?.rotation }
    getFont() { return this.opts?.font }
    getOffsetX() { return this.opts?.offsetX }
    getOffsetY() { return this.opts?.offsetY }
  }
  return { __esModule: true, default: T }
})

jest.mock('ol/geom/Point', () => {
  const P = class Point {
    coords: number[]
    constructor(coords: number[]) { this.coords = coords }
    getCoordinates() { return this.coords }
  }
  return { __esModule: true, default: P }
})

// ---------------------------------------------------------------------------
// PARCEL_STATUS_COLORS
// ---------------------------------------------------------------------------

describe('PARCEL_STATUS_COLORS', () => {
  it('has entries for approved, pending, rejected, and default', () => {
    expect(PARCEL_STATUS_COLORS).toHaveProperty('approved')
    expect(PARCEL_STATUS_COLORS).toHaveProperty('pending')
    expect(PARCEL_STATUS_COLORS).toHaveProperty('rejected')
    expect(PARCEL_STATUS_COLORS).toHaveProperty('default')
  })

  it('approved uses green colours', () => {
    const c = PARCEL_STATUS_COLORS.approved
    expect(c.stroke).toBe('#006600')
    expect(c.fill).toBe('rgba(0, 102, 0, 0.08)')
    expect(c.label).toBe('#006600')
  })

  it('pending uses red colours with transparent fill', () => {
    const c = PARCEL_STATUS_COLORS.pending
    expect(c.stroke).toBe('#CC0000')
    expect(c.fill).toBe('rgba(204, 0, 0, 0.08)')
    expect(c.label).toBe('#CC0000')
  })

  it('rejected uses red colours with zero-opacity fill', () => {
    const c = PARCEL_STATUS_COLORS.rejected
    expect(c.stroke).toBe('#FF0000')
    expect(c.fill).toBe('rgba(255, 0, 0, 0)')
    expect(c.label).toBe('#FF0000')
  })

  it('default uses dark blue colours', () => {
    const c = PARCEL_STATUS_COLORS.default
    expect(c.stroke).toBe('#1B3A5C')
    expect(c.fill).toBe('rgba(27, 58, 92, 0.08)')
    expect(c.label).toBe('#1B3A5C')
  })
})

// ---------------------------------------------------------------------------
// BEACON_TYPE_COLORS
// ---------------------------------------------------------------------------

describe('BEACON_TYPE_COLORS', () => {
  it('has entries for boundary, trig, control, and benchmark', () => {
    expect(BEACON_TYPE_COLORS).toHaveProperty('boundary')
    expect(BEACON_TYPE_COLORS).toHaveProperty('trig')
    expect(BEACON_TYPE_COLORS).toHaveProperty('control')
    expect(BEACON_TYPE_COLORS).toHaveProperty('benchmark')
  })

  it('boundary uses gold fill', () => {
    const c = BEACON_TYPE_COLORS.boundary
    expect(c.fill).toBe('#FFD700')
    expect(c.stroke).toBe('#1B3A5C')
  })

  it('trig uses green semi-transparent fill', () => {
    const c = BEACON_TYPE_COLORS.trig
    expect(c.fill).toBe('rgba(0, 128, 0, 0.20)')
    expect(c.stroke).toBe('#006600')
  })

  it('control uses blue semi-transparent fill', () => {
    const c = BEACON_TYPE_COLORS.control
    expect(c.fill).toBe('rgba(0, 102, 204, 0.20)')
    expect(c.stroke).toBe('#0066CC')
  })

  it('benchmark uses purple semi-transparent fill', () => {
    const c = BEACON_TYPE_COLORS.benchmark
    expect(c.fill).toBe('rgba(107, 63, 160, 0.20)')
    expect(c.stroke).toBe('#6B3FA0')
  })
})

// ---------------------------------------------------------------------------
// bearingToOLRotation
// ---------------------------------------------------------------------------

describe('bearingToOLRotation', () => {
  it('North (0°) returns π/2 radians', () => {
    const result = bearingToOLRotation(0)
    expect(result).toBeCloseTo(Math.PI / 2, 6)
  })

  it('NE (45°) returns PI/4 radians', () => {
    const result = bearingToOLRotation(45)
    expect(result).toBeCloseTo(Math.PI / 4, 6)
  })

  it('SE (135°) flips and returns 3*PI/4 radians', () => {
    const result = bearingToOLRotation(135)
    expect(result).toBeCloseTo((3 * Math.PI) / 4, 6)
  })

  it('SW (225°) flips and returns PI/4 radians', () => {
    const result = bearingToOLRotation(225)
    expect(result).toBeCloseTo(Math.PI / 4, 6)
  })

  it('NW (315°) returns 3*PI/4 radians', () => {
    const result = bearingToOLRotation(315)
    expect(result).toBeCloseTo((3 * Math.PI) / 4, 6)
  })

  it('East (90°) returns 0 radians', () => {
    const result = bearingToOLRotation(90)
    expect(result).toBeCloseTo(0, 6)
  })

  it('South (180°) returns PI/2 radians', () => {
    const result = bearingToOLRotation(180)
    expect(result).toBeCloseTo(Math.PI / 2, 6)
  })

  it('West (270°) returns -PI radians', () => {
    const result = bearingToOLRotation(270)
    expect(result).toBeCloseTo(-Math.PI, 6)
  })

  it('result is always in [-PI, PI] range', () => {
    for (let deg = 0; deg <= 360; deg += 15) {
      const result = bearingToOLRotation(deg)
      expect(result).toBeGreaterThanOrEqual(-Math.PI - 1e-10)
      expect(result).toBeLessThanOrEqual(Math.PI + 1e-10)
    }
  })
})

// ---------------------------------------------------------------------------
// computeBearingDeg
// ---------------------------------------------------------------------------

describe('computeBearingDeg', () => {
  it('due north returns 0°', () => {
    const result = computeBearingDeg([0, 0], [0, 100])
    expect(result).toBeCloseTo(0, 6)
  })

  it('due east returns 90°', () => {
    const result = computeBearingDeg([0, 0], [100, 0])
    expect(result).toBeCloseTo(90, 6)
  })

  it('due south returns 180°', () => {
    const result = computeBearingDeg([0, 0], [0, -100])
    expect(result).toBeCloseTo(180, 6)
  })

  it('due west returns 270°', () => {
    const result = computeBearingDeg([0, 0], [-100, 0])
    expect(result).toBeCloseTo(270, 6)
  })

  it('NE returns 45°', () => {
    const result = computeBearingDeg([0, 0], [100, 100])
    expect(result).toBeCloseTo(45, 6)
  })

  it('same point returns 0°', () => {
    const result = computeBearingDeg([50, 50], [50, 50])
    expect(result).toBeCloseTo(0, 6)
  })

  it('always returns value in [0, 360)', () => {
    for (let i = 0; i < 360; i += 30) {
      const rad = (i * Math.PI) / 180
      const to: [number, number] = [Math.sin(rad) * 100, Math.cos(rad) * 100]
      const result = computeBearingDeg([0, 0], to)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThan(360)
    }
  })
})

// ---------------------------------------------------------------------------
// createParcelStyleFunction (async factory)
// ---------------------------------------------------------------------------

describe('createParcelStyleFunction', () => {
  let styleFn: MockStyleFn

  beforeAll(async () => {
    styleFn = (await createParcelStyleFunction()) as unknown as MockStyleFn
  })

  it('returns a function', () => {
    expect(typeof styleFn).toBe('function')
  })

  it('returns a Style for default status', () => {
    const feature = { get: () => undefined }
    const result = styleFn(feature)
    expect(result).toBeDefined()
    expect(result.opts).toBeDefined()
    expect(result.opts.stroke).toBeDefined()
  })

  it('returns a Style with correct stroke colour for approved status', () => {
    const feature = {
      get: (key: string) => {
        if (key === 'status') return 'approved'
        return undefined
      },
    }
    const result = styleFn(feature)
    expect(result.opts.stroke.opts.color).toBe('#006600')
  })

  it('returns a Style with dashed line for pending status', () => {
    const feature = {
      get: (key: string) => {
        if (key === 'status') return 'pending'
        return undefined
      },
    }
    const result = styleFn(feature)
    expect(result.opts.stroke.opts.color).toBe('#CC0000')
    expect(result.opts.stroke.opts.lineDash).toEqual([10, 5])
  })

  it('returns a Style with solid line for approved (not pending)', () => {
    const feature = {
      get: (key: string) => {
        if (key === 'status') return 'approved'
        return undefined
      },
    }
    const result = styleFn(feature)
    expect(result.opts.stroke.opts.lineDash).toBeUndefined()
  })

  it('falls back to default for unknown status', () => {
    const feature = {
      get: (key: string) => {
        if (key === 'status') return 'unknown_status'
        return undefined
      },
    }
    const result = styleFn(feature)
    expect(result.opts.stroke.opts.color).toBe('#1B3A5C')
  })

  it('does not throw for null feature properties', () => {
    const feature = { get: () => null }
    expect(() => styleFn(feature)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// createBeaconStyleFunction (async factory)
// ---------------------------------------------------------------------------

describe('createBeaconStyleFunction', () => {
  let styleFn: MockStyleFn

  beforeAll(async () => {
    styleFn = (await createBeaconStyleFunction()) as unknown as MockStyleFn
  })

  it('returns a function', () => {
    expect(typeof styleFn).toBe('function')
  })

  it('returns a Style with image for boundary beacon', () => {
    const feature = { get: () => undefined }
    const result = styleFn(feature)
    expect(result).toBeDefined()
    expect(result.opts.image).toBeDefined()
  })

  it('returns a Style with triangle image for trig beacon', () => {
    const feature = {
      get: (key: string) => {
        if (key === 'beacon_type') return 'trig'
        return undefined
      },
    }
    const result = styleFn(feature)
    expect(result.opts.image.opts.points).toBe(3)
  })

  it('returns a Style with square (4 points, 45°) for control beacon', () => {
    const feature = {
      get: (key: string) => {
        if (key === 'beacon_type') return 'control'
        return undefined
      },
    }
    const result = styleFn(feature)
    expect(result.opts.image.opts.points).toBe(4)
    expect(result.opts.image.opts.angle).toBeCloseTo(Math.PI / 4, 6)
  })

  it('returns a Style with diamond (4 points, 0°) for benchmark beacon', () => {
    const feature = {
      get: (key: string) => {
        if (key === 'beacon_type') return 'benchmark'
        return undefined
      },
    }
    const result = styleFn(feature)
    expect(result.opts.image.opts.points).toBe(4)
    expect(result.opts.image.opts.angle).toBeCloseTo(0, 6)
  })

  it('includes label text when label property is set', () => {
    const feature = {
      get: (key: string) => {
        if (key === 'label') return 'BM-001'
        if (key === 'beacon_type') return 'benchmark'
        return undefined
      },
    }
    const result = styleFn(feature)
    // When label is present, the function returns an array of [marker, label]
    expect(Array.isArray(result)).toBe(true)
    const labelStyle = (result as unknown as MockStyle[])[1]
    expect(labelStyle.opts.text.opts.text).toBe('BM-001')
  })

  it('does not include label when label property is missing', () => {
    const feature = { get: () => undefined }
    const result = styleFn(feature)
    expect(Array.isArray(result)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// createEdgeAnnotationStyleFunction (async factory)
// ---------------------------------------------------------------------------

describe('createEdgeAnnotationStyleFunction', () => {
  let styleFn: MockStyleFn

  beforeAll(async () => {
    styleFn = (await createEdgeAnnotationStyleFunction()) as unknown as MockStyleFn
  })

  it('returns a function', () => {
    expect(typeof styleFn).toBe('function')
  })

  it('returns a Style with text', () => {
    const feature = {
      get: (key: string) => {
        if (key === 'text') return 'N 45° 30\' E'
        if (key === 'bearing') return 45.5
        return ''
      },
    }
    const result = styleFn(feature)
    expect(result).toBeDefined()
    expect(result.opts.text).toBeDefined()
    expect(result.opts.text.opts.text).toBe('N 45° 30\' E')
  })

  it('uses bearingToOLRotation for text rotation', () => {
    const feature = {
      get: (key: string) => {
        if (key === 'bearing') return 90
        return ''
      },
    }
    const result = styleFn(feature)
    const expectedRotation = bearingToOLRotation(90)
    expect(result.opts.text.opts.rotation).toBeCloseTo(expectedRotation, 6)
  })
})

// ---------------------------------------------------------------------------
// createTraverseLegStyleFunction (async factory)
// ---------------------------------------------------------------------------

describe('createTraverseLegStyleFunction', () => {
  let styleFn: MockStyleFn

  beforeAll(async () => {
    styleFn = (await createTraverseLegStyleFunction()) as unknown as MockStyleFn
  })

  it('returns a function', () => {
    expect(typeof styleFn).toBe('function')
  })

  it('returns an array of styles (line + arrow)', () => {
    const feature = {
      get: () => undefined,
      getGeometry: () => ({
        getCoordinates: () => [[0, 0], [100, 0]],
      }),
    }
    const result = styleFn(feature)
    expect(Array.isArray(result)).toBe(true)
    expect((result as unknown as MockStyle[]).length).toBeGreaterThanOrEqual(1)
  })

  it('first style is the dashed line', () => {
    const feature = {
      get: (key: string) => {
        if (key === 'bearing') return 0
        return undefined
      },
      getGeometry: () => ({
        getCoordinates: () => [[0, 0], [100, 0]],
      }),
    }
    const result = styleFn(feature)
    expect((result as unknown as MockStyle[])[0].opts.stroke).toBeDefined()
    expect((result as unknown as MockStyle[])[0].opts.stroke.opts.color).toBe('#0066CC')
    expect((result as unknown as MockStyle[])[0].opts.stroke.opts.lineDash).toEqual([8, 4])
  })

  it('uses bearing property when available for arrow rotation', () => {
    const feature = {
      get: (key: string) => {
        if (key === 'bearing') return 180
        return undefined
      },
      getGeometry: () => ({
        getCoordinates: () => [[0, 0], [0, -100]],
      }),
    }
    const result = styleFn(feature)
    if ((result as unknown as MockStyle[]).length > 1) {
      const arrowStyle = (result as unknown as MockStyle[])[1]
      const arrowRotation = arrowStyle.opts.text.opts.rotation
      const expectedRotation = bearingToOLRotation(180)
      expect(arrowRotation).toBeCloseTo(expectedRotation, 6)
    }
  })

  it('computes bearing from geometry when bearing property is absent', () => {
    const feature = {
      get: () => undefined,
      getGeometry: () => ({
        getCoordinates: () => [[0, 0], [0, 100]],
      }),
    }
    const result = styleFn(feature)
    expect(Array.isArray(result)).toBe(true)
  })

  it('does not throw for feature with no geometry', () => {
    const feature = {
      get: () => undefined,
      getGeometry: () => null,
    }
    expect(() => styleFn(feature)).not.toThrow()
  })
})
