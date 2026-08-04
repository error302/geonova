'use client';

import { useEffect, useRef } from 'react'
import type { CleanedPoint, Anomaly } from '@/types/fieldguard'
// ponytail: Phase 6 — use typed imports from ol (which ships its own .d.ts files)
// instead of dynamic imports + `as any` casts. Same bundle (Next.js code-splits
// these automatically), but now TypeScript can catch API misuse.
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import OSM from 'ol/source/OSM'
import Style from 'ol/style/Style'
import CircleStyle from 'ol/style/Circle'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import { fromLonLat } from 'ol/proj'
import Overlay from 'ol/Overlay'
import type { Map as MapType, Overlay as OverlayType } from 'ol'

interface AnomalyHeatmapProps {
  points: CleanedPoint[]
  anomalies: Anomaly[]
}

export default function AnomalyHeatmap({ points, anomalies }: AnomalyHeatmapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<MapType | null>(null)
  const overlayRef = useRef<OverlayType | null>(null)

  useEffect(() => {
    if (!mapRef.current) return

    // Destroy previous map
    if (mapInstance.current) {
      mapInstance.current.setTarget(undefined)
      overlayRef.current = null
    }

    let cancelled = false

    async function initMap() {
      try {
        // ponytail: imports are now at module top-level (typed). The async
        // wrapper is kept for the cancelled-flag pattern.
        await Promise.resolve()  // keep async signature for callers
        if (cancelled || !mapRef.current) return

        const map = new Map({
          target: mapRef.current,
          layers: [new TileLayer({ source: new OSM() })],
          view: new View({ center: fromLonLat([0, 0]), zoom: 10 }),
        })

        // Setup popup overlay
        if (popupRef.current) {
          const overlay = new Overlay({
            element: popupRef.current,
            autoPan: { animation: { duration: 250 } },
          })
          map.addOverlay(overlay)
          overlayRef.current = overlay
        }

        mapInstance.current = map
      } catch (err) {
        console.error('AnomalyHeatmap init failed:', err)
      }
    }

    initMap()

    return () => {
      cancelled = true
      if (mapInstance.current) mapInstance.current.setTarget(undefined)
      overlayRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapInstance.current
    if (!map || points.length === 0) return

    let cancelled = false

    async function updateFeatures() {
      try {
        // ponytail: re-assert map is non-null inside async closure (TS can't
        // track the outer null check across the async boundary)
        if (!map || cancelled) return

        const anomalyIds = new Set(anomalies.map((a) => a.point_id))

        const features = points.map((pt, i) => {
          const isAnomaly = anomalyIds.has(String(i))
          const color = !pt.cleaned ? '#ef4444' : pt.classification === 'ground' ? '#22c55e' : '#3b82f6'
          const strokeColor = isAnomaly ? '#dc2626' : '#1e40af'
          const strokeWidth = isAnomaly ? 3 : 1

          const feature = new Feature({
            geometry: new Point(fromLonLat([pt.easting, pt.northing])),
          })
          feature.setStyle(new Style({
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color }),
              stroke: new Stroke({ color: strokeColor, width: strokeWidth }),
            }),
          }))
          // VULN-002 FIX (security review 2026-08-03): store structured data
          // instead of an HTML string; rendered with textContent below.
          feature.set('popupData', {
            index: i,
            easting: pt.easting,
            northing: pt.northing,
            elevation: pt.elevation,
            cleaned: pt.cleaned,
            classification: pt.classification,
          })
          feature.set('index', i)
          return feature
        })

        const vectorSource = new VectorSource({ features })

        // Remove old vector layers, add new one
        const existing = map.getLayers().getArray().find((l) => l instanceof VectorLayer)
        if (existing) map.removeLayer(existing)

        map.addLayer(new VectorLayer({ source: vectorSource }))

        // Fit to features
        const extent = vectorSource.getExtent()
        // ponytail: getExtent() can return an empty extent if no features; guard against null
        if (extent && (extent[2] - extent[0] > 0 || extent[3] - extent[1] > 0)) {
          map.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 18 })
        }

        // Click handler for popup
        // ponytail: use the typed MapBrowserEvent from ol
        const handleClick = (evt: { pixel: [number, number]; coordinate: [number, number] }) => {
          const overlay = overlayRef.current
          if (!overlay || !popupRef.current) return

          const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f as Feature)
          const popupData = feature?.get('popupData') as
            | { index: number; easting: number; northing: number; elevation?: number; cleaned: boolean; classification?: string }
            | undefined
          if (feature && popupData && popupRef.current) {
            // VULN-002 FIX: render with textContent, never innerHTML.
            const el = popupRef.current
            el.replaceChildren()

            const line = (text: string, bold = false) => {
              const div = document.createElement('div')
              if (bold) {
                const b = document.createElement('b')
                b.textContent = text
                div.append(b)
              } else {
                div.textContent = text
              }
              el.append(div)
            }

            line(`Point ${popupData.index}`, true)
            line(`E: ${popupData.easting.toFixed(3)}`)
            line(`N: ${popupData.northing.toFixed(3)}`)
            line(`RL: ${popupData.elevation != null ? popupData.elevation.toFixed(3) : 'N/A'}`)
            line(`Status: ${popupData.cleaned ? 'Clean' : 'Flagged'}`)
            line(`Classification: ${popupData.classification || 'N/A'}`)

            overlay.setPosition(evt.coordinate)
          } else {
            overlay.setPosition(undefined)
          }
        }

        map.on('click', handleClick as (e: unknown) => void)

        return () => {
          map.un('click', handleClick as (e: unknown) => void)
        }
      } catch (err) {
        console.error('AnomalyHeatmap feature update failed:', err)
      }
    }

    const cleanupPromise = updateFeatures()

    return () => {
      cancelled = true
      cleanupPromise.then((cleanup) => { if (cleanup) cleanup() }).catch(() => {})
    }
  }, [points, anomalies])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Anomaly Visualization</h3>

      <div className="flex gap-4 mb-4 text-sm">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500"></span> Ground
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-500"></span> Other
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-500"></span> Flagged
        </span>
      </div>

      <div ref={mapRef} className="h-96 rounded-lg overflow-hidden" />
      <div ref={popupRef} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm shadow-lg" style={{ display: 'none' }}></div>
    </div>
  )
}
