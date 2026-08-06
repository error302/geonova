'use client'
/**
 * useMapState — Map view/feature persistence hook
 *
 * Saves map center/zoom and drawn features to localStorage:
 * - Every 10 seconds (interval)
 * - On unmount
 *
 * Uses JSON+GeoJSON format for feature serialization.
 * Only runs when map is ready.
 *
 * Note: Uses dynamic import() instead of require() for ESM compatibility.
 */

import { useEffect } from 'react'
import type Map from 'ol/Map'

export function useMapState(
  mapInstance: React.MutableRefObject<Map | null>,
  drawSourceRef: React.MutableRefObject<import('ol/source/Vector').default | null>,
  mapReady: boolean
) {
  useEffect(() => {
    if (!mapInstance.current) return

    const saveViewState = () => {
      try {
        const view = mapInstance.current?.getView()
        if (view) {
          const center = view.getCenter()
          const zoom = view.getZoom()
          if (center && zoom != null) {
            localStorage.setItem('metardu-map-view', JSON.stringify({ center, zoom }))
          }
        }
      } catch { /* ignore */ }
    }

    const saveFeatures = async () => {
      try {
        if (drawSourceRef.current) {
          const features = drawSourceRef.current.getFeatures()
          if (features.length > 0) {
            const { default: GeoJSONFormat } = await import('ol/format/GeoJSON')
            const fmt = new GeoJSONFormat()
            const geojson = fmt.writeFeatures(features, {
              featureProjection: 'EPSG:3857',
              dataProjection: 'EPSG:4326',
            })
            localStorage.setItem('metardu-map-features', JSON.stringify(geojson))
          } else {
            localStorage.removeItem('metardu-map-features')
          }
        }
      } catch { /* ignore */ }
    }

    const interval = setInterval(() => {
      saveViewState()
      saveFeatures()
    }, 10000)

    return () => {
      clearInterval(interval)
      saveViewState()
    }
  }, [mapReady])
}
