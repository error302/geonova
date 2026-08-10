/**
 * Tests for vectorTileFactory module
 *
 * estimateTileCount() is a pure function — tested directly.
 * Async factory functions (createVectorTileLayer, createParcelTileLayer,
 * createBeaconTileLayer) are tested with mocked OpenLayers imports.
 *
 * Mock classes are defined INSIDE jest.mock factories to avoid hoisting
 * issues — jest.mock factories are hoisted above variable declarations.
 */

import {
  estimateTileCount,
  createVectorTileLayer,
  createParcelTileLayer,
  createBeaconTileLayer,
} from '../vectorTileFactory'

type MockVectorTileLayer = {
  opts: Record<string, unknown>
  _props: Record<string, unknown>
}

function asMockLayer(layer: unknown): MockVectorTileLayer {
  return layer as MockVectorTileLayer
}

// ---------------------------------------------------------------------------
// Mock OpenLayers classes — defined inside factories for hoisting safety
// ---------------------------------------------------------------------------

jest.mock('ol/layer/VectorTile', () => {
  const MockVectorTileLayer = class MockVectorTileLayer {
    opts: Record<string, unknown>
    _props: Record<string, unknown>
    constructor(opts: Record<string, unknown> = {}) {
      this.opts = opts
      this._props = {}
    }
    setStyle(s: unknown) { this._props.style = s }
    set(key: string, val: unknown) { this._props[key] = val }
    get(key: string) { return this._props[key] }
  }
  return { __esModule: true, default: MockVectorTileLayer }
})

jest.mock('ol/source/VectorTile', () => {
  const MockVectorTileSource = class MockVectorTileSource {
    opts: Record<string, unknown>
    constructor(opts: Record<string, unknown> = {}) { this.opts = opts }
  }
  return { __esModule: true, default: MockVectorTileSource }
})

jest.mock('ol/format/MVT', () => {
  const MockMVTFormat = class MockMVTFormat {
    opts: Record<string, unknown>
    constructor(opts: Record<string, unknown> = {}) { this.opts = opts }
  }
  return { __esModule: true, default: MockMVTFormat }
})

jest.mock('ol/format/GeoJSON', () => {
  const MockGeoJSONFormat = class MockGeoJSONFormat {
    constructor() {}
  }
  return { __esModule: true, default: MockGeoJSONFormat }
})

jest.mock('ol/style/Style', () => {
  const MockStyle = class MockStyle {
    opts: Record<string, unknown>
    constructor(opts: Record<string, unknown> = {}) { this.opts = opts }
  }
  return { __esModule: true, default: MockStyle }
})

jest.mock('ol/style/Fill', () => {
  const MockFill = class MockFill {
    opts: Record<string, unknown>
    constructor(opts: Record<string, unknown> = {}) { this.opts = opts }
  }
  return { __esModule: true, default: MockFill }
})

jest.mock('ol/style/Stroke', () => {
  const MockStroke = class MockStroke {
    opts: Record<string, unknown>
    constructor(opts: Record<string, unknown> = {}) { this.opts = opts }
  }
  return { __esModule: true, default: MockStroke }
})

jest.mock('ol/style/Text', () => {
  const MockText = class MockText {
    opts: Record<string, unknown>
    constructor(opts: Record<string, unknown> = {}) { this.opts = opts }
  }
  return { __esModule: true, default: MockText }
})

jest.mock('ol/style/Circle', () => {
  const MockCircleStyle = class MockCircleStyle {
    opts: Record<string, unknown>
    constructor(opts: Record<string, unknown> = {}) { this.opts = opts }
  }
  return { __esModule: true, default: MockCircleStyle }
})

// ---------------------------------------------------------------------------
// estimateTileCount
// ---------------------------------------------------------------------------

describe('estimateTileCount', () => {
  it('returns 1 tile for the entire world at zoom 0', () => {
    const halfEarth = 20037508.342789244
    const worldExtent = [-halfEarth, -halfEarth, halfEarth, halfEarth]
    expect(estimateTileCount(worldExtent, 0)).toBe(1)
  })

  it('returns 4 tiles for the world at zoom 1', () => {
    const halfEarth = 20037508.342789244
    const worldExtent = [-halfEarth, -halfEarth, halfEarth, halfEarth]
    expect(estimateTileCount(worldExtent, 1)).toBe(4)
  })

  it('returns 0 for a zero-area extent', () => {
    expect(estimateTileCount([0, 0, 0, 0], 10)).toBe(0)
  })

  it('returns 0 for a degenerate extent (negative area)', () => {
    expect(estimateTileCount([100, 100, 0, 0], 10)).toBe(0)
  })

  it('increases with zoom level', () => {
    const halfEarth = 20037508.342789244
    const extent = [-halfEarth, -halfEarth, halfEarth, halfEarth]
    const z5 = estimateTileCount(extent, 5)
    const z10 = estimateTileCount(extent, 10)
    expect(z10).toBeGreaterThan(z5)
  })

  it('returns correct tile count for known zoom levels', () => {
    const halfEarth = 20037508.342789244
    const worldExtent = [-halfEarth, -halfEarth, halfEarth, halfEarth]
    // At zoom z, total tiles = 2^z × 2^z = 4^z
    expect(estimateTileCount(worldExtent, 2)).toBe(16)
    expect(estimateTileCount(worldExtent, 3)).toBe(64)
  })

  it('handles a small local extent', () => {
    // A small extent around Nairobi in EPSG:3857
    const nairobiExtent = [8230000, -200000, 8250000, -180000]
    const count = estimateTileCount(nairobiExtent, 14)
    expect(count).toBeGreaterThan(0)
    expect(Number.isInteger(count)).toBe(true)
  })

  it('handles extent exactly at tile boundaries', () => {
    // At zoom 1, each tile is halfEarth wide/tall
    const halfEarth = 20037508.342789244
    const tileSize1 = 2 * halfEarth
    // One tile at the top-left quadrant
    const oneTileExtent = [-halfEarth, 0, 0, halfEarth]
    expect(estimateTileCount(oneTileExtent, 1)).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// createVectorTileLayer
// ---------------------------------------------------------------------------

describe('createVectorTileLayer', () => {
  it('returns a layer with the correct constructor shape', async () => {
    const layer = await createVectorTileLayer({
      url: '/tiles/{z}/{x}/{y}.pbf',
    })
    expect(layer).toBeDefined()
    expect(asMockLayer(layer).opts).toBeDefined()
  })

  it('sets layerType to vectorTile', async () => {
    const layer = await createVectorTileLayer({
      url: '/tiles/{z}/{x}/{y}.pbf',
    })
    expect(layer.get('layerType')).toBe('vectorTile')
  })

  it('stores tileUrl property', async () => {
    const layer = await createVectorTileLayer({
      url: '/data/parcels/{z}/{x}/{y}.pbf',
    })
    expect(layer.get('tileUrl')).toBe('/data/parcels/{z}/{x}/{y}.pbf')
  })

  it('stores tileFormat property', async () => {
    const layer = await createVectorTileLayer({
      url: '/tiles/{z}/{x}/{y}.pbf',
      format: 'mvt',
    })
    expect(layer.get('tileFormat')).toBe('mvt')
  })

  it('applies custom style when provided', async () => {
    const customStyle = jest.fn()
    const layer = await createVectorTileLayer({
      url: '/tiles/{z}/{x}/{y}.pbf',
      style: customStyle,
    })
    expect(asMockLayer(layer)._props.style).toBe(customStyle)
  })

  it('passes minZoom to the layer and maxZoom to the source', async () => {
    const layer = await createVectorTileLayer({
      url: '/tiles/{z}/{x}/{y}.pbf',
      minZoom: 10,
      maxZoom: 18,
    })
    expect(asMockLayer(layer).opts.minZoom).toBe(10)
    // maxZoom is passed to the VectorTileSource, not the layer
    expect((asMockLayer(layer).opts.source as { opts: Record<string, unknown> }).opts.maxZoom).toBe(18)
  })

  it('passes opacity to the layer', async () => {
    const layer = await createVectorTileLayer({
      url: '/tiles/{z}/{x}/{y}.pbf',
      opacity: 0.7,
    })
    expect(asMockLayer(layer).opts.opacity).toBe(0.7)
  })

  it('supports GeoJSON format', async () => {
    const layer = await createVectorTileLayer({
      url: '/tiles/{z}/{x}/{y}.geojson',
      format: 'geojson',
    })
    expect(layer).toBeDefined()
    expect(layer.get('tileFormat')).toBe('geojson')
  })

  it('handles PMTiles URL gracefully', async () => {
    // ol-pmtiles is optional; the factory should fall back gracefully
    const layer = await createVectorTileLayer({
      url: '/data/parcels.pmtiles',
    })
    expect(layer).toBeDefined()
  })

  it('defaults to visible=true', async () => {
    const layer = await createVectorTileLayer({
      url: '/tiles/{z}/{x}/{y}.pbf',
    })
    expect(asMockLayer(layer).opts.visible).toBe(true)
  })

  it('defaults to zIndex=10', async () => {
    const layer = await createVectorTileLayer({
      url: '/tiles/{z}/{x}/{y}.pbf',
    })
    expect(asMockLayer(layer).opts.zIndex).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// createParcelTileLayer
// ---------------------------------------------------------------------------

describe('createParcelTileLayer', () => {
  it('returns a layer with correct constructor shape', async () => {
    const layer = await createParcelTileLayer({
      url: '/parcels/{z}/{x}/{y}.pbf',
    })
    expect(layer).toBeDefined()
    expect(asMockLayer(layer).opts).toBeDefined()
  })

  it('sets layerType to parcelTile', async () => {
    const layer = await createParcelTileLayer({
      url: '/parcels/{z}/{x}/{y}.pbf',
    })
    expect(layer.get('layerType')).toBe('parcelTile')
  })

  it('stores the tile URL', async () => {
    const layer = await createParcelTileLayer({
      url: '/parcels/{z}/{x}/{y}.pbf',
    })
    expect(layer.get('tileUrl')).toBe('/parcels/{z}/{x}/{y}.pbf')
  })

  it('has a style function', async () => {
    const layer = await createParcelTileLayer({
      url: '/parcels/{z}/{x}/{y}.pbf',
    })
    expect(typeof asMockLayer(layer).opts.style).toBe('function')
  })

  it('defaults to minZoom=14', async () => {
    const layer = await createParcelTileLayer({
      url: '/parcels/{z}/{x}/{y}.pbf',
    })
    expect(asMockLayer(layer).opts.minZoom).toBe(14)
  })

  it('allows overriding minZoom', async () => {
    const layer = await createParcelTileLayer({
      url: '/parcels/{z}/{x}/{y}.pbf',
      minZoom: 12,
    })
    expect(asMockLayer(layer).opts.minZoom).toBe(12)
  })

  it('defaults to zIndex=10 for parcels', async () => {
    const layer = await createParcelTileLayer({
      url: '/parcels/{z}/{x}/{y}.pbf',
    })
    expect(asMockLayer(layer).opts.zIndex).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// createBeaconTileLayer
// ---------------------------------------------------------------------------

describe('createBeaconTileLayer', () => {
  it('returns a layer with correct constructor shape', async () => {
    const layer = await createBeaconTileLayer({
      url: '/beacons/{z}/{x}/{y}.pbf',
    })
    expect(layer).toBeDefined()
    expect(asMockLayer(layer).opts).toBeDefined()
  })

  it('sets layerType to beaconTile', async () => {
    const layer = await createBeaconTileLayer({
      url: '/beacons/{z}/{x}/{y}.pbf',
    })
    expect(layer.get('layerType')).toBe('beaconTile')
  })

  it('stores the tile URL', async () => {
    const layer = await createBeaconTileLayer({
      url: '/beacons/{z}/{x}/{y}.pbf',
    })
    expect(layer.get('tileUrl')).toBe('/beacons/{z}/{x}/{y}.pbf')
  })

  it('has a style function', async () => {
    const layer = await createBeaconTileLayer({
      url: '/beacons/{z}/{x}/{y}.pbf',
    })
    expect(typeof asMockLayer(layer).opts.style).toBe('function')
  })

  it('defaults to minZoom=14', async () => {
    const layer = await createBeaconTileLayer({
      url: '/beacons/{z}/{x}/{y}.pbf',
    })
    expect(asMockLayer(layer).opts.minZoom).toBe(14)
  })

  it('uses zIndex=11 (above parcels)', async () => {
    const layer = await createBeaconTileLayer({
      url: '/beacons/{z}/{x}/{y}.pbf',
    })
    expect(asMockLayer(layer).opts.zIndex).toBe(11)
  })
})
