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
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useDebouncedCallback } from '@/lib/performance'
import type { MapExtent } from '@/app/map/MapReactContext'
import type Map from 'ol/Map'

export interface ViewportFeature {
  id: string
  type: 'parcel' | 'beacon' | 'field_record' | 'control_point'
  geometry: {
    type: 'Point' | 'Polygon' | 'LineString'
    coordinates: number[] | number[][] | number[][][]
  }
  properties: Record<string, unknown>
}

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

      const data = await res.json()
      const features = (data.data?.features || []) as ViewportFeature[]
      setFeatureCount(features.length)
      onFeaturesLoaded?.(features)
    } catch (err) {
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
  }, [mapReady, enabled, mapInstance, fetchViewport, debounceMs])

  return {
    isLoading,
    featureCount,
    lastExtent,
    refresh: fetchViewport,
  }
}
