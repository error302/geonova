'use client'
/**
 * useMapBasemaps — Hook for basemap layer management
 *
 * Creates and manages the 4 basemap tile layers (OSM, Satellite, Dark, Terrain).
 * Extracted from MapClient for maintainability.
 *
 * Performance notes:
 * - All tile layers created once during initialization
 * - Terrain uses OpenTopoMap with cacheSize for better tile caching
 * - Caching headers enabled for tile requests
 */

import { useRef, useCallback } from 'react'
import type { BasemapMode } from '@/app/map/mapTypes'

interface UseMapBasemapsReturn {
  basemapsRef: React.MutableRefObject<Record<string, import('ol/layer/Tile').default>>
  createBasemaps: (olModules: BasemapModules) => Record<string, import('ol/layer/Tile').default>
  toggleBasemap: (mapInstance: React.MutableRefObject<import('ol/Map').default | null>, mode: BasemapMode, setBasemap: (m: BasemapMode) => void) => void
}

export interface BasemapModules {
  TileLayer: typeof import('ol/layer/Tile').default
  OSM: typeof import('ol/source/OSM').default
  XYZ: typeof import('ol/source/XYZ').default
}

export function useMapBasemaps(): UseMapBasemapsReturn {
  const basemapsRef = useRef<Record<string, import('ol/layer/Tile').default>>({})

  const createBasemaps = useCallback((olModules: BasemapModules) => {
    const { TileLayer, OSM, XYZ } = olModules

    const basemaps: Record<string, import('ol/layer/Tile').default> = {
      osm: new TileLayer({
        source: new OSM({ crossOrigin: 'anonymous' }),
        visible: true,
        zIndex: 0,
      }),
      satellite: new TileLayer({
        source: new XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          crossOrigin: 'anonymous',
          maxZoom: 19,
          attributions: 'Tiles \u00A9 Esri',
          cacheSize: 2048,
        }),
        visible: false,
        zIndex: 0,
      }),
      dark: new TileLayer({
        source: new XYZ({
          url: 'https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          crossOrigin: 'anonymous',
          maxZoom: 19,
          attributions: '\u00A9 CartoDB',
          cacheSize: 2048,
        }),
        visible: false,
        zIndex: 0,
      }),
      terrain: new TileLayer({
        source: new XYZ({
          // Primary: OpenTopoMap (topographic contours + hill shading)
          // Fallback handled by OpenLayers tile error event
          url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
          crossOrigin: 'anonymous',
          maxZoom: 17,
          attributions: '\u00A9 OpenTopoMap (CC-BY-SA)',
          cacheSize: 2048,
          // Retry failed tiles
          tileLoadFunction: (imageTile: import('ol/Tile').default, src: string) => {
            const img = (imageTile as import('ol/ImageTile').default).getImage() as HTMLImageElement
            img.onerror = () => {
              // Fallback to Esri terrain if OpenTopoMap is rate-limited
              const z = imageTile.getTileCoord()[0]
              const x = imageTile.getTileCoord()[1]
              const y = imageTile.getTileCoord()[2]
              img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`
              img.onerror = () => {
                // Final fallback: OSM (at least show something)
                img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
              }
            }
            img.src = src
          },
        }),
        visible: false,
        zIndex: 0,
      }),
      // Land cover overlay (Sentinel-2 NDVI/NDBI)
      ndvi: new TileLayer({
        source: new XYZ({
          url: 'https://services.arcgisonline.com/arcgis/rest/services/Sentinel2/ImageServer/tile/{z}/{y}/{x}',
          crossOrigin: 'anonymous',
          maxZoom: 16,
          attributions: '\u00A9 Esri Sentinel-2',
          cacheSize: 1024,
        }),
        visible: false,
        zIndex: 1,  // Above basemaps
        opacity: 0.7,
      }),
      // Satellite imagery for NDBI/NDWI visual reference
      imagery: new TileLayer({
        source: new XYZ({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          crossOrigin: 'anonymous',
          maxZoom: 19,
          attributions: '\u00A9 Esri World Imagery',
          cacheSize: 2048,
        }),
        visible: false,
        zIndex: 1,
        opacity: 0.7,
      }),
    }

    // Tag each layer for basemap lookup
    Object.entries(basemaps).forEach(([id, layer]) => layer.set('basemapId', id))
    basemapsRef.current = basemaps
    return basemaps
  }, [])

  const toggleBasemap = useCallback((
    mapInstance: React.MutableRefObject<import('ol/Map').default | null>,
    mode: BasemapMode,
    setBasemap: (m: BasemapMode) => void
  ) => {
    if (!mapInstance.current) return
    const basemapIds = ['osm', 'satellite', 'dark', 'terrain']
    for (const layer of mapInstance.current.getLayers().getArray()) {
      const id = layer.get('basemapId') as string | undefined
      if (id && basemapIds.includes(id)) {
        layer.setVisible(id === mode)
      }
    }
    setBasemap(mode)
  }, [])

  return { basemapsRef, createBasemaps, toggleBasemap }
}
