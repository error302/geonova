'use client'

/**
 * useViewportQuery — Dynamic spatial data loading based on map viewport
 *
 * When the surveyor pans or zooms the map, this hook:
 * 1. Captures the current bounding box (view extent)
 * 2. Transforms from map projection (EPSG:3857) to WGS84 (EPSG:4326)
 * 3. Sends a debounced request to the spatial API
 * 4. Loads nearby parcels, beacons, and field records into the map
 *
 * Uses performance utilities:
 * - useDebouncedCallback for 500ms debounce
 * - Deduplication to skip identical extents
 *
 * The response shape is validated with `viewportQueryResponseSchema` from
 * @/lib/validation/viewportQuery — the same schema the route validates its
 * own response against — so the client viewport shape and the server response
 * can't drift apart.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useDebouncedCallback } from '@/lib/performance'
import { viewportQueryResponseSchema, type ViewportFeature } from '@/lib/validation/viewportQuery'
import type { MapExtent } from '@/app/map/MapReactContext'
import type Map from 'ol/Map'

// Re-export the schema-derived feature type so existing consumers (and the
// onFeaturesLoaded callback signature) keep working unchanged.
// Re-export the schema-derived feature type so existing consumers (and the
// onFeaturesLoaded callback signature) keep working unchanged.
export type { ViewportFeature }

interface UseViewportQueryOptions {
  mapInstance: React.MutableRefObject<Map | null>
  mapReady: boolean
  enabled?: boolean
  debounceMs?: number
  onFeaturesLoaded?: (features: ViewportFeature[]) => void
}

export function useViewportQuery({
  mapInstance,
  mapReady,
  enabled = true,
  debounceMs = 500,
  onFeaturesLoaded,
}: UseViewportQueryOptions) {
  const [isLoading, setIsLoading] = useState(false)
  const [featureCount, setFeatureCount] = useState(0)
  const [lastExtent, setLastExtent] = useState<string>('')
  const lastRequestRef = useRef<string>('')

  const fetchViewport = useCallback(async () => {
    if (!mapInstance.current || !enabled) return

    try {
      const map = mapInstance.current
      const view = map.getView()
      const extent = view.calculateExtent(map.getSize())

      if (!extent || extent.length !== 4) return

      // Deduplicate: skip if extent hasn't changed meaningfully
      const extentKey = `${extent[0].toFixed(0)},${extent[1].toFixed(0)},${extent[2].toFixed(0)},${extent[3].toFixed(0)}`
      if (extentKey === lastRequestRef.current) return
      lastRequestRef.current = extentKey
      setLastExtent(extentKey)

      // Transform to WGS84 for the API
      const { transformExtent } = await import('ol/proj')
      const wgs84Extent = transformExtent(extent, 'EPSG:3857', 'EPSG:4326')
      const [minLng, minLat, maxLng, maxLat] = wgs84Extent
      // Enforce the shared MapExtent shape at the viewport-query boundary.
      const viewportExtent: MapExtent = { minLat, minLon: minLng, maxLat, maxLon: maxLng }

      setIsLoading(true)

      // Fetch spatial features in viewport
      const params = new URLSearchParams({
        west: viewportExtent.minLon.toFixed(6),
        south: viewportExtent.minLat.toFixed(6),
        east: viewportExtent.maxLon.toFixed(6),
        north: viewportExtent.maxLat.toFixed(6),
        limit: '200',
      })

      const res = await fetch(`/api/spatial-index?${params}`)
      if (!res.ok) {
        setIsLoading(false)
        return
      }

      // Validate the response against the shared schema — the same one the
      // route uses to check its own output. If the server shape ever drifts,
      // this fails closed (no features) instead of flowing garbage downstream.
      const parsed = viewportQueryResponseSchema.safeParse(await res.json())
      if (!parsed.success) {
        setIsLoading(false)
        return
      }

      const features = parsed.data.features
      setFeatureCount(features.length)
      onFeaturesLoaded?.(features)
    } catch {
      // Silent fail — viewport queries are non-critical
    } finally {
      setIsLoading(false)
    }
  }, [mapInstance, enabled, onFeaturesLoaded])

  // Use performance utility for debounced fetch
  const debouncedFetch = useDebouncedCallback(fetchViewport, debounceMs)

  // Listen for moveend events
  useEffect(() => {
    if (!mapReady || !enabled || !mapInstance.current) return

    const map = mapInstance.current

    map.on('moveend', debouncedFetch)

    // Initial fetch
    fetchViewport()

    return () => {
      map.un('moveend', debouncedFetch)
    }
  }, [mapReady, enabled, mapInstance, fetchViewport, debounceMs, debouncedFetch])

  return {
    isLoading,
    featureCount,
    lastExtent,
    refresh: fetchViewport,
  }
}
