'use client';

/*
 * PERFORMANCE NOTE — OpenLayers static imports (~700KB vendor-ol chunk)
 * These 14 OL modules are intentionally imported at the top level rather than
 * dynamically imported because the webpack splitChunks config already isolates
 * them into a separate `vendor-ol` chunk.  This page is only navigated to
 * explicitly (not on the initial load path), so the OL chunk is never part of
 * the critical-path bundle.  Dynamic imports would add complexity without
 * measurable benefit since the chunk is already code-split.
 */

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import XYZ from 'ol/source/XYZ'
import GeoJSON from 'ol/format/GeoJSON'
import { fromLonLat } from 'ol/proj'
import { Style, Fill, Stroke, Text } from 'ol/style'
import CircleStyle from 'ol/style/Circle'
import Overlay from 'ol/Overlay'
import { ArrowLeft, Download } from 'lucide-react'
import type Feature from 'ol/Feature'
import { registerProjections } from '@/lib/map/projection'

const STATUS_COLORS: Record<string, string> = {
  pending: '#6b7280',
  field_complete: '#3b82f6',
  computed: '#22c55e',
  plan_generated: '#f59e0b',
  submitted: '#8b5cf6',
  approved: '#10b981',
}

export default function SchemeMapPage() {
  const params = useParams()
  const projectId = params.id as string
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<Map | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [parcelCount, setParcelCount] = useState(0)

  useEffect(() => {
    if (!mapRef.current || !projectId) return

    setLoading(true)

    // Register EPSG:21037 (Arc 1960 / UTM Zone 37S) before using it for GeoJSON reprojection
    registerProjections()

    // Create map
    const vectorSource = new VectorSource()

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            maxZoom: 19,
            crossOrigin: 'anonymous',
          }),
        }),
        new VectorLayer({
          source: vectorSource,
          style: ((feature: Feature) => {
            const props = feature.getProperties()
            const status = props.status as string || 'pending'
            const color = STATUS_COLORS[status] || '#6b7280'
            const geomType = feature.getGeometry()?.getType()

            if (geomType === 'Polygon') {
              return new Style({
                fill: new Fill({ color: color + '40' }), // 25% opacity
                stroke: new Stroke({ color, width: 2.5 }),
                text: new Text({
                  text: String(props.parcel_number || ''),
                  font: 'bold 12px sans-serif',
                  fill: new Fill({ color: '#ffffff' }),
                  stroke: new Stroke({ color: '#000000', width: 3 }),
                }),
              })
            }

            if (geomType === 'Point' && props.type === 'block_label') {
              return new Style({
                text: new Text({
                  text: `Block ${props.block_number}\n(${props.parcel_count} parcels)`,
                  font: 'bold 14px sans-serif',
                  fill: new Fill({ color: '#1e40af' }),
                  stroke: new Stroke({ color: '#ffffff', width: 4 }),
                  textAlign: 'center',
                }),
              })
            }

            return new Style({
              image: new CircleStyle({
                radius: 5,
                fill: new Fill({ color }),
                stroke: new Stroke({ color: '#000', width: 1 }),
              }),
            })
          }) as any,
        }),
      ],
      view: new View({
        center: fromLonLat([37.0, -1.3]), // Default: central Kenya
        zoom: 15,
      }),
    })

    // Popup overlay
    const overlay = new Overlay({
      element: popupRef.current || undefined,
      autoPan: true,
    })
    map.addOverlay(overlay)

    map.on('click', (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, f => f)
      if (feature && popupRef.current) {
        const props = feature.getProperties()
        // VULN-002 FIX (security review 2026-08-03): block/parcel numbers and
        // LR numbers are user-entered — render with textContent, never innerHTML.
        const el = popupRef.current
        el.replaceChildren()

        const wrap = document.createElement('div')
        wrap.style.cssText = 'font-size:12px;'

        const title = document.createElement('strong')
        title.textContent = `Block ${String(props.block_number ?? '')} — Parcel ${String(props.parcel_number || '')}`
        wrap.append(title)
        wrap.append(document.createElement('br'))

        if (props.lr_number) {
          const lr = document.createElement('div')
          lr.textContent = `LR: ${String(props.lr_number)}`
          wrap.append(lr)
        }
        if (props.area_ha) {
          const area = document.createElement('div')
          area.textContent = `Area: ${Number(props.area_ha).toFixed(4)} ha`
          wrap.append(area)
        }

        const statusRow = document.createElement('div')
        const statusLabel = document.createTextNode('Status: ')
        const statusSpan = document.createElement('span')
        statusSpan.style.color = STATUS_COLORS[props.status as string] || '#999'
        statusSpan.textContent = String(props.status || 'pending')
        statusRow.append(statusLabel, statusSpan)
        wrap.append(statusRow)

        el.append(wrap)
        el.style.display = 'block'
        overlay.setPosition(evt.coordinate)
      } else if (popupRef.current) {
        popupRef.current.style.display = 'none'
      }
    })

    mapInstance.current = map

    // Fetch scheme GeoJSON
    fetch(`/api/scheme/map?project_id=${projectId}`)
      .then(res => res.json())
      .then((data: { features?: unknown[] }) => {
        if (data.features && data.features.length > 0) {
          const format = new GeoJSON()
          const features = format.readFeatures(data, {
            dataProjection: 'EPSG:21037', // Arc 1960 / UTM Zone 37S (Kenya cadastral datum)
            featureProjection: 'EPSG:3857', // Web Mercator
          })
          vectorSource.addFeatures(features)
          setParcelCount(features.filter(f => f.getGeometry()?.getType() === 'Polygon').length)

          // Zoom to extent
          const extent = vectorSource.getExtent()
          if (extent && extent[0] !== Infinity) {
            map.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 18 })
          }
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load scheme data')
        setLoading(false)
      })

    return () => {
      map.setTarget(undefined)
    }
  }, [projectId])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <Link
            href={`/project/${projectId}/scheme`}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Scheme Map</h1>
            <p className="text-sm text-gray-400">
              {loading ? 'Loading parcels...' : `${parcelCount} parcels shown`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/scheme/export/geojson?project_id=${projectId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            GeoJSON
          </a>
          <a
            href={`/api/scheme/export/dxf?project_id=${projectId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            DXF
          </a>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="relative" style={{ height: 'calc(100vh - 80px)' }}>
        <div ref={mapRef} className="w-full h-full" />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/60">
            <div className="flex items-center gap-3 text-gray-300">
              <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading scheme parcels...
            </div>
          </div>
        )}

        <div
          ref={popupRef}
          className="absolute bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl"
          style={{ display: 'none', minWidth: 200 }}
        />

        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-400 mb-2">STATUS LEGEND</h4>
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-300 capitalize">{status.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
