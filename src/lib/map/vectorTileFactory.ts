/**
 * METARDU Vector Tile Factory
 *
 * Provides async factory functions for creating VectorTileLayers
 * for rendering large cadastral datasets efficiently using MVT or
 * GeoJSON vector tiles.
 *
 * All OL imports use dynamic import() for SSR safety in Next.js 16.
 *
 * Layers:
 * - createVectorTileLayer:  Generic VectorTileLayer from MVT or GeoJSON tiles
 * - createParcelTileLayer:  SoK-compliant parcel polygon styling
 * - createBeaconTileLayer:  Gold circle beacon point markers
 * - estimateTileCount:      Tile count estimator for loading progress
 */

import type { FeatureLike } from 'ol/Feature'
import type { default as Style } from 'ol/style/Style'

/**
 * Options for creating a generic vector tile layer.
 */
export interface VectorTileOptions {
  /** Tile URL template: /tiles/{z}/{x}/{y}.pbf or .pmtiles */
  url: string;
  /** Tile data format. Default: 'mvt' */
  format?: 'mvt' | 'geojson';
  /** Layer name to filter within the tile source */
  layerName?: string;
  /** Style function applied to each feature */
  style?: (feature: FeatureLike) => Style | Style[];
  /** Minimum zoom level for rendering */
  minZoom?: number;
  /** Maximum zoom level for rendering */
  maxZoom?: number;
  /** Initial visibility */
  visible?: boolean;
  /** Layer opacity (0-1) */
  opacity?: number;
  /** Z-index for layer ordering */
  zIndex?: number;
}

/**
 * Options for creating a specialized parcel polygon tile layer.
 */
export interface ParcelTileOptions {
  /** Tile URL template for parcel polygons */
  url: string;
  /** Minimum zoom level. Default: 14 (parcels only shown at close zoom) */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
  /** Layer opacity (0-1) */
  opacity?: number;
}

/**
 * Options for creating a specialized beacon point tile layer.
 */
export interface BeaconTileOptions {
  /** Tile URL template for beacon points */
  url: string;
  /** Minimum zoom level. Default: 14 */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
  /** Layer opacity (0-1) */
  opacity?: number;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Estimate the number of tiles required to cover a given extent at a specific
 * Web Mercator zoom level.
 *
 * Useful for showing loading progress indicators or pre-fetching tile budgets.
 *
 * @param extent - `[minX, minY, maxX, maxY]` in EPSG:3857 meters
 * @param zoom   - Web Mercator zoom level (0-22)
 * @returns Estimated total number of tiles visible within the extent
 */
export function estimateTileCount(extent: number[], zoom: number): number {
  const halfEarth = 20037508.342789244;
  const tileSize = (2 * halfEarth) / Math.pow(2, zoom);

  const [minX, minY, maxX, maxY] = extent;
  const origin = -halfEarth;

  const tileMinX = Math.floor((minX - origin) / tileSize);
  const tileMaxX = Math.ceil((maxX - origin) / tileSize);
  const tileMinY = Math.floor((minY - origin) / tileSize);
  const tileMaxY = Math.ceil((maxY - origin) / tileSize);

  const countX = Math.max(0, tileMaxX - tileMinX);
  const countY = Math.max(0, tileMaxY - tileMinY);

  return countX * countY;
}

// ---------------------------------------------------------------------------
// Generic VectorTileLayer
// ---------------------------------------------------------------------------

/**
 * Create a generic VectorTileLayer from MVT or GeoJSON tile sources.
 *
 * Supports standard XYZ tile URLs (`/tiles/{z}/{x}/{y}.pbf`) and PMTiles
 * archives. For PMTiles the factory attempts to load the `ol-pmtiles`
 * adapter; if unavailable it falls back to a standard VectorTile source
 * (which requires a server-side PMTiles-to-MVT proxy in that case).
 *
 * @param options - Configuration for the vector tile layer
 * @returns Promise resolving to an OpenLayers VectorTileLayer
 */
export async function createVectorTileLayer(options: VectorTileOptions) {
  const {
    url,
    format = 'mvt',
    layerName,
    style,
    minZoom,
    maxZoom = 22,
    visible = true,
    opacity = 1,
    zIndex = 10,
  } = options;

  const [
    { default: VectorTileLayer },
    { default: VectorTileSource },
    MVTModule,
    GeoJSONModule,
  ] = await Promise.all([
    import('ol/layer/VectorTile'),
    import('ol/source/VectorTile'),
    import('ol/format/MVT'),
    import('ol/format/GeoJSON'),
  ]);

  // Build the tile format appropriate for the requested encoding.
  // VectorTileSource's FeatureType is RenderFeature while GeoJSON yields
  // ol/Feature instances — the union needs an explicit typed cast.
  type TileSourceFormat = import('ol/format/Feature').default<import('ol/render/Feature').default>
  const tileFormat =
    format === 'geojson'
      ? new GeoJSONModule.default()
      : new MVTModule.default({
          layers: layerName ? [layerName] : undefined,
        });

  const isPMTiles = url.toLowerCase().endsWith('.pmtiles');

  let source: import('ol/source/VectorTile').default;

  if (isPMTiles) {
    // Attempt to use the ol-pmtiles adapter for native PMTiles support.
    try {
      // ol-pmtiles is an optional dependency — ignore if not installed.
      const pmTilesModule = await import(/* webpackIgnore: true */ 'ol-pmtiles');
      source = new pmTilesModule.default({
        url,
        format: tileFormat as TileSourceFormat,
      });
    } catch {
      // Adapter not installed — fall back to standard VectorTile source.
      // Caller must ensure a server-side PMTiles proxy is in front of the URL.
      source = new VectorTileSource({
        url,
        format: tileFormat as TileSourceFormat,
        maxZoom,
      });
    }
  } else {
    source = new VectorTileSource({
      url,
      format: tileFormat as TileSourceFormat,
      maxZoom,
    });
  }

  const layer = new VectorTileLayer({
    source,
    minZoom,
    visible,
    opacity,
    zIndex,
  });

  if (style) {
    layer.setStyle(style);
  }

  layer.set('layerType', 'vectorTile');
  layer.set('tileUrl', url);
  layer.set('tileFormat', format);

  return layer;
}

// ---------------------------------------------------------------------------
// Parcel Tile Layer (SoK-compliant)
// ---------------------------------------------------------------------------

/**
 * Create a specialized VectorTileLayer for parcel polygons with
 * Survey of Kenya (SoK) compliant default styling.
 *
 * **Default style:**
 * - Fill:  dark blue at 8 % opacity — `rgba(27, 58, 92, 0.08)`
 * - Stroke: solid blue `#1B3A5C`, 2 px width
 * - Labels: white halo text showing the `parcel_number` feature property
 *
 * Parcels are only visible at close zoom by default (`minZoom: 14`) to
 * maintain rendering performance with large cadastral datasets.
 *
 * @param options - Configuration for the parcel tile layer
 * @returns Promise resolving to an OpenLayers VectorTileLayer
 */
export async function createParcelTileLayer(options: ParcelTileOptions) {
  const {
    url,
    minZoom = 14,
    maxZoom = 22,
    opacity = 1,
  } = options;

  const [
    { default: VectorTileLayer },
    { default: VectorTileSource },
    { default: MVT },
    { default: Style },
    { default: Fill },
    { default: Stroke },
    { default: Text },
  ] = await Promise.all([
    import('ol/layer/VectorTile'),
    import('ol/source/VectorTile'),
    import('ol/format/MVT'),
    import('ol/style/Style'),
    import('ol/style/Fill'),
    import('ol/style/Stroke'),
    import('ol/style/Text'),
  ]);

  const source = new VectorTileSource({
    url,
    format: new MVT(),
    maxZoom,
  });

  const layer = new VectorTileLayer({
    source,
    minZoom,
    visible: true,
    opacity,
    zIndex: 10,
    style: (feature: FeatureLike) => {
      const parcelNumber = (feature.get('parcel_number') as string | undefined) ?? '';
      return new Style({
        fill: new Fill({ color: 'rgba(27, 58, 92, 0.08)' }),
        stroke: new Stroke({ color: '#1B3A5C', width: 2 }),
        text: parcelNumber
          ? new Text({
              text: String(parcelNumber),
              font: '11px Calibri, sans-serif',
              fill: new Fill({ color: '#1B3A5C' }),
              stroke: new Stroke({ color: '#FFFFFF', width: 3 }),
            })
          : undefined,
      });
    },
  });

  layer.set('layerType', 'parcelTile');
  layer.set('tileUrl', url);

  return layer;
}

// ---------------------------------------------------------------------------
// Beacon Tile Layer
// ---------------------------------------------------------------------------

/**
 * Create a specialized VectorTileLayer for beacon points with gold circle
 * markers and labelled beacon IDs.
 *
 * **Default style:**
 * - Marker: gold (`#FFD700`) circles, radius 5 px, dark blue border
 * - Labels: white halo text showing the `beacon_id` feature property
 *
 * @param options - Configuration for the beacon tile layer
 * @returns Promise resolving to an OpenLayers VectorTileLayer
 */
export async function createBeaconTileLayer(options: BeaconTileOptions) {
  const {
    url,
    minZoom = 14,
    maxZoom = 22,
    opacity = 1,
  } = options;

  const [
    { default: VectorTileLayer },
    { default: VectorTileSource },
    { default: MVT },
    { default: Style },
    { default: CircleStyle },
    { default: Fill },
    { default: Stroke },
    { default: Text },
  ] = await Promise.all([
    import('ol/layer/VectorTile'),
    import('ol/source/VectorTile'),
    import('ol/format/MVT'),
    import('ol/style/Style'),
    import('ol/style/Circle'),
    import('ol/style/Fill'),
    import('ol/style/Stroke'),
    import('ol/style/Text'),
  ]);

  const source = new VectorTileSource({
    url,
    format: new MVT(),
    maxZoom,
  });

  const layer = new VectorTileLayer({
    source,
    minZoom,
    visible: true,
    opacity,
    zIndex: 11,
    style: (feature: FeatureLike) => {
      const beaconId = (feature.get('beacon_id') as string | undefined) ?? '';
      return new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#FFD700' }),
          stroke: new Stroke({ color: '#1B3A5C', width: 1.5 }),
        }),
        text: beaconId
          ? new Text({
              text: String(beaconId),
              font: 'bold 11px Calibri, sans-serif',
              fill: new Fill({ color: '#1B3A5C' }),
              stroke: new Stroke({ color: '#FFFFFF', width: 3 }),
              offsetY: -12,
            })
          : undefined,
      });
    },
  });

  layer.set('layerType', 'beaconTile');
  layer.set('tileUrl', url);

  return layer;
}
