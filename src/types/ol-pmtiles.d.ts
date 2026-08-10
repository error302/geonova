/**
 * Minimal type declaration for the optional `ol-pmtiles` adapter.
 *
 * The package is an optional dependency (imported with webpackIgnore in
 * vectorTileFactory) and ships no types. The adapter's default export
 * constructs a VectorTileSource-compatible object from a PMTiles URL.
 */
declare module 'ol-pmtiles' {
  import type { default as VectorTileSource } from 'ol/source/VectorTile'

  const PMTiles: new (options: { url: string; format?: unknown }) => VectorTileSource
  export default PMTiles
}
