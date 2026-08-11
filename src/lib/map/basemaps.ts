/**
 * METARDU Basemap Layer Factory
 *
 * Provides async factory functions for creating basemap tile layers.
 * All OL imports are dynamic to match existing project patterns.
 *
 * Basemaps:
 * - OSM: OpenStreetMap standard tiles
 * - Satellite: ESRI World Imagery
 * - Blank: Solid white background (no tiles)
 * - Custom XYZ: User-provided tile URL
 */

/**
 * Create an OpenStreetMap basemap layer.
 */
export async function createOSMLayer() {
  const { default: TileLayer } = await import('ol/layer/Tile');
  const { default: OSM } = await import('ol/source/OSM');
  const layer = new TileLayer({
    source: new OSM(),
    zIndex: 0,
  });
  layer.set('basemapId', 'osm');
  return layer;
}

/**
 * Create a satellite basemap layer using ESRI World Imagery XYZ tiles.
 */
export async function createSatelliteLayer() {
  const { default: TileLayer } = await import('ol/layer/Tile');
  const { default: XYZ } = await import('ol/source/XYZ');
  const layer = new TileLayer({
    source: new XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attributions: 'Tiles (c) Esri',
      crossOrigin: 'anonymous',
      maxZoom: 19,
    }),
    zIndex: 0,
    visible: false,
  });
  layer.set('basemapId', 'satellite');
  return layer;
}

/**
 * Create a blank (white) basemap layer.
 * Uses a TileLayer with no visible source to keep the map functional.
 */
export async function createBlankLayer() {
  const { default: TileLayer } = await import('ol/layer/Tile');
  const layer = new TileLayer({
    source: null as unknown as import('ol/source/Tile').default,
    zIndex: 0,
    visible: false,
  });
  layer.set('basemapId', 'blank');
  return layer;
}

/**
 * Create a custom XYZ tile layer from a user-provided URL template.
 * The URL should use {z}, {x}, {y} placeholders.
 *
 * @param url - XYZ tile URL template
 * @param label - Optional display name for the layer
 */
export async function createCustomXYZLayer(url: string, label?: string) {
  const { default: TileLayer } = await import('ol/layer/Tile');
  const { default: XYZ } = await import('ol/source/XYZ');

  // Sanitize URL — require {z}, {x}, {y} placeholders
  const hasPlaceholders = /\{z\}/.test(url) && /\{x\}/.test(url) && /\{y\}/.test(url);
  if (!hasPlaceholders) {
    throw new Error('XYZ URL must contain {z}, {x}, and {y} placeholders');
  }

  const layer = new TileLayer({
    source: new XYZ({
      url,
      crossOrigin: 'anonymous',
      maxZoom: 22,
    }),
    zIndex: 1,
    visible: true,
  });
  layer.set('basemapId', `custom-${label ?? Date.now()}`);
  layer.set('layerLabel', label ?? 'Custom Layer');
  layer.set('layerUrl', url);
  return layer;
}

/**
 * Create a WMS (Web Map Service) layer for GeoServer, MapServer, etc.
 * Users can paste a WMS URL and the layer will be overlaid on the map.
 *
 * @param url - WMS service URL (e.g. "https://geoserver.example.com/geoserver/wms")
 * @param layerName - WMS layer name (e.g. "workspace:parcels")
 * @param label - Display name for the layer
 * @param params - Additional WMS parameters (optional)
 */
export async function createWMSLayer(
  url: string,
  layerName: string,
  label?: string,
  params?: Record<string, string>
) {
  const { default: TileLayer } = await import('ol/layer/Tile');
  const { default: TileWMS } = await import('ol/source/TileWMS');

  const wmsParams: Record<string, string> = {
    LAYERS: layerName,
    TILED: 'true',
    ...params,
  };

  const layer = new TileLayer({
    source: new TileWMS({
      url,
      params: wmsParams,
      crossOrigin: 'anonymous',
      serverType: 'geoserver',
    }),
    zIndex: 2,
    visible: true,
  });
  layer.set('basemapId', `wms-${label ?? Date.now()}`);
  layer.set('layerLabel', label ?? layerName);
  layer.set('layerUrl', url);
  layer.set('layerType', 'wms');
  layer.set('wmsLayerName', layerName);
  return layer;
}

/**
 * Type for a basemap layer returned by the factory functions.
 */
export type BasemapLayer = Awaited<ReturnType<typeof createOSMLayer>> | Awaited<ReturnType<typeof createSatelliteLayer>> | Awaited<ReturnType<typeof createBlankLayer>>;
