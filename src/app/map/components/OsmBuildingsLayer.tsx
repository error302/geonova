'use client';

/**
 * OSM Buildings Overlay — fetches building footprints from the local PBF
 * via the Python worker and renders them as an OpenLayers vector layer.
 *
 * Usage:
 *   <OsmBuildingsLayer map={map} visible={true} />
 *
 * Requires:
 *   - Python worker running with Pyrosm installed
 *   - Kenya PBF file at data/kenya-latest.osm.pbf
 *
 * The layer fetches buildings on map move/end (debounced) and displays
 * them as semi-transparent orange polygons — matching METARDU's brand.
 */

import { useEffect, useRef, useState } from 'react'
import { Loader2, Building2 } from 'lucide-react'

interface OsmBuildingsLayerProps {
  map: any  // OpenLayers Map
  visible: boolean
}

export function OsmBuildingsLayer({ map, visible }: OsmBuildingsLayerProps) {
  const layerRef = useRef<any>(null)
  const sourceRef = useRef<any>(null)
  const [loading, setLoading] = useState(false)
  const [featureCount, setFeatureCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Initialize the OpenLayers vector layer once
  useEffect(() => {
    if (!map || layerRef.current) return

    let cancelled = false

    // AUDIT FIX (H-006, 2026-07-27): switched from `window.ol.*` (a legacy
    // global that isn't loaded — caused "Cannot read properties of undefined
    // (reading 'source')") to dynamic `ol/*` imports, matching every other
    // map component in this codebase.
    ;(async () => {
      try {
        const { default: VectorSource } = await import('ol/source/Vector')
        const { default: VectorLayer } = await import('ol/layer/Vector')
        const { default: GeoJSON } = await import('ol/format/GeoJSON')
        const { default: Style } = await import('ol/style/Style')
        const { default: Fill } = await import('ol/style/Fill')
        const { default: Stroke } = await import('ol/style/Stroke')

        if (cancelled) return

        const source = new VectorSource({})
        const layer = new VectorLayer({
          source,
          style: new Style({
            fill: new Fill({ color: 'rgba(209, 123, 71, 0.15)' }),  // accent at 15% opacity
            stroke: new Stroke({ color: 'rgba(209, 123, 71, 0.6)', width: 1 }),
          }),
          zIndex: 15,  // above basemap, below survey data
        })

        map.addLayer(layer)
        sourceRef.current = source
        layerRef.current = layer
        // Store GeoJSON format for later use
        ;(layerRef.current as any).geoJSONFormat = new GeoJSON()
      } catch (err) {
        if (!cancelled) {
          console.error('[osm-buildings] Failed to init layer:', err)
        }
      }
    })()

    return () => {
      cancelled = true
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
        sourceRef.current = null
      }
    }
  }, [map])

  // Toggle visibility
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.setVisible(visible)
    }
  }, [visible])

  // Fetch buildings on map move (debounced)
  useEffect(() => {
    if (!map || !visible || !sourceRef.current) return

    let timeoutId: any
    let cancelled = false

    const fetchBuildings = async () => {
      if (cancelled) return
      setLoading(true)
      setError(null)

      try {
        const view = map.getView()
        const extent = view.calculateExtent(map.getSize())

        // Transform extent from map projection to WGS84
        const proj4 = (window as any).proj4
        const fromProj = view.getProjection().getCode()
        let minLon: number, minLat: number, maxLon: number, maxLat: number

        if (fromProj === 'EPSG:4326') {
          ;[minLon, minLat, maxLon, maxLat] = extent
        } else if (fromProj === 'EPSG:3857' && proj4) {
          // Web Mercator → WGS84
          const [minX, minY, maxX, maxY] = extent
          const min = proj4('EPSG:3857', 'EPSG:4326', [minX, minY])
          const max = proj4('EPSG:3857', 'EPSG:4326', [maxX, maxY])
          minLon = min[0]; minLat = min[1]
          maxLon = max[0]; maxLat = max[1]
        } else {
          // UTM → WGS84 via proj4 (registered globally)
          if (proj4) {
            const [minX, minY, maxX, maxY] = extent
            const min = proj4(fromProj, 'EPSG:4326', [minX, minY])
            const max = proj4(fromProj, 'EPSG:4326', [maxX, maxY])
            minLon = min[0]; minLat = min[1]
            maxLon = max[0]; maxLat = max[1]
          } else {
            return  // no proj4 available
          }
        }

        const params = new URLSearchParams({
          minlon: String(minLon),
          minlat: String(minLat),
          maxlon: String(maxLon),
          maxlat: String(maxLat),
          types: 'buildings',
        })

        const res = await fetch(`/api/osm/features?${params}`)
        if (!res.ok) {
          if (res.status === 503) {
            setError('Python worker offline')
          }
          return
        }

        const data = await res.json()
        if (cancelled) return

        const buildings = data.features?.buildings
        if (buildings && buildings.features) {
          // Clear and reload
          sourceRef.current.clear()
          const format = (layerRef.current as any).geoJSONFormat
          const features = format.readFeatures(buildings, {
            featureProjection: view.getProjection(),
            dataProjection: 'EPSG:4326',
          })
          sourceRef.current.addFeatures(features)
          setFeatureCount(features.length)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Fetch failed')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const onMoveEnd = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(fetchBuildings, 500)  // debounce 500ms
    }

    map.on('moveend', onMoveEnd)
    fetchBuildings()  // initial fetch

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      map.un('moveend', onMoveEnd)
    }
  }, [map, visible])

  if (!visible) return null

  return (
    <div className="absolute top-3 right-3 z-30 bg-[var(--bg-secondary)]/90 backdrop-blur-xl border border-[var(--border-color)]/[0.08] rounded-lg px-3 py-2 text-xs flex items-center gap-2 shadow-lg">
      <Building2 className="w-3.5 h-3.5 text-[var(--accent)]" />
      {loading ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-[var(--text-muted)]" />
          <span className="text-[var(--text-muted)]">Loading buildings…</span>
        </>
      ) : error ? (
        <span className="text-[var(--error)]">{error}</span>
      ) : (
        <span className="text-[var(--text-secondary)]">
          {featureCount} buildings
        </span>
      )}
    </div>
  )
}
