'use client';
import React from 'react'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/api-client/client'
import { utmToGeographic } from '@/lib/geodesy/coordinates'
import Link from 'next/link'
import { BeaconRegistryPanel } from '@/components/beacons/BeaconRegistryPanel'
import { ControlPointRegistry } from '@/components/survey/ControlPointRegistry'
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
import Text from 'ol/style/Text'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import { fromLonLat } from 'ol/proj'
import Overlay from 'ol/Overlay'
import type { Map as MapType, Overlay as OverlayType } from 'ol'

interface Beacon {
  id: string
  name: string
  easting: number
  northing: number
  elevation?: number
  utm_zone: number
  hemisphere: string
  authority?: string
  beacon_type: string
  description?: string
  datum?: string  // T1.5d: added for beacon import
}

interface Project {
  id: string
  name: string
  location?: string
  survey_type?: string
  created_at: string
}

function getMarkerIcon(type: string) {
  const icons: Record<string, string> = {
    trig: '▲',
    control: '●',
    boundary: '■',
    benchmark: '◆',
    gnss: '',
    other: '●'
  }
  return icons[type] || '●'
}

function getMarkerColor(type: string) {
  const colors: Record<string, string> = {
    trig: '#ef4444',
    control: '#f97316',
    boundary: '#eab308',
    benchmark: '#22c55e',
    gnss: '#3b82f6',
    other: '#6b7280'
  }
  return colors[type] || '#6b7280'
}

export default function BeaconsPage() {
  const [importMsg, setImportMsg] = React.useState<{text:string;ok:boolean}|null>(null)
  // AUDIT FIX (2026-07-03): Removed 'activity' view — it placed projects
  // at Math.random() positions (pins jumped on every refresh). Only
  // the 'beacons' view is real.
  const [beacons, setBeacons] = useState<Beacon[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [importProject, setImportProject] = useState('')
  const [importBeacon, setImportBeacon] = useState<Beacon | null>(null)
  const [importLoading, setImportLoading] = useState(false)

  const mapRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<MapType | null>(null)
  const overlayRef = useRef<OverlayType | null>(null)

  // AUDIT FIX (H-007, 2026-07-27): useMemo to prevent infinite loop on /beacons.
  // Same pattern as H-003 in /fieldbook.
  const dbClient = useMemo(() => createClient(), [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    
    const [beaconsRes, projectsRes] = await Promise.all([
      dbClient.from('public_beacons').select('*').eq('status', 'verified'),
      dbClient.from('projects').select('id, name, location, survey_type, created_at')
    ])

    if (beaconsRes.data) setBeacons(beaconsRes.data as unknown as Beacon[])
    if (projectsRes.data) setProjects(projectsRes.data as unknown as Project[])
    setLoading(false)
  }, [dbClient])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Initialize map once (typed ol imports — Next.js still code-splits)
  useEffect(() => {
    if (!mapRef.current) return

    let cancelled = false

    async function initMap() {
      try {
        // ponytail: imports are now at module top-level (typed). The async
        // wrapper is kept for the cancelled-flag pattern.
        await Promise.resolve() // keep async signature for callers
        if (cancelled || !mapRef.current) return

        const map = new Map({
          target: mapRef.current,
          layers: [new TileLayer({ source: new OSM() })],
          view: new View({
            center: fromLonLat([36.8219, -1.2921]),
            zoom: 6,
          }),
        })

        if (popupRef.current) {
          const overlay = new Overlay({
            element: popupRef.current,
            autoPan: { animation: { duration: 250 } },
          })
          map.addOverlay(overlay)
          overlayRef.current = overlay
        }

        mapInstance.current = map

        // Click handler for popup
        // ponytail: use a structural type for evt; cast handler when
        // registering with map.on() so TS doesn't complain about the
        // ol MapBrowserEvent<UIEvent> signature mismatch.
        const handleClick = (evt: { pixel: [number, number]; coordinate: [number, number] }) => {
          const overlay = overlayRef.current
          if (!overlay || !popupRef.current) return

          const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f as Feature)
          const popupData = feature?.get('popupData') as
            | { color: string; icon: string; name: string; authority?: string; beacon_type: string; easting: number; northing: number; elevation?: number; utm_zone: number; hemisphere: string }
            | undefined
          if (feature && popupData && popupRef.current) {
            // VULN-002 FIX: render with textContent, never innerHTML.
            const el = popupRef.current
            el.replaceChildren()

            const wrap = document.createElement('div')
            wrap.className = 'text-sm min-w-[200px]'
            wrap.style.color = 'var(--text-primary)'

            const title = document.createElement('div')
            title.style.cssText = 'font-weight:bold;font-size:1.1rem;color:' + popupData.color
            title.textContent = `${popupData.icon} ${popupData.name}`
            wrap.append(title)

            if (popupData.authority) {
              const authority = document.createElement('div')
              authority.style.cssText = 'color:var(--text-muted);margin-top:4px'
              authority.textContent = `Authority: ${popupData.authority}`
              wrap.append(authority)
            }

            const typeRow = document.createElement('div')
            typeRow.style.cssText = 'color:var(--text-muted);text-transform:capitalize'
            typeRow.textContent = `Type: ${popupData.beacon_type}`
            wrap.append(typeRow)

            const coords = document.createElement('div')
            // white-space:pre-line preserves the \n line break (textContent
            // would otherwise collapse it to a space, unlike the old <br/>).
            coords.style.cssText = 'font-family:monospace;margin-top:8px;white-space:pre-line'
            coords.textContent = `E: ${popupData.easting.toFixed(4)}\nN: ${popupData.northing.toFixed(4)}`
            wrap.append(coords)

            if (popupData.elevation) {
              const elev = document.createElement('div')
              elev.style.cssText = 'color:var(--text-muted)'
              elev.textContent = `Elev: ${popupData.elevation.toFixed(3)} m`
              wrap.append(elev)
            }

            const utm = document.createElement('div')
            utm.style.cssText = 'color:var(--text-muted);font-size:0.75rem;margin-top:4px'
            utm.textContent = `UTM Zone ${popupData.utm_zone}${popupData.hemisphere}`
            wrap.append(utm)

            el.append(wrap)
            overlay.setPosition(evt.coordinate)
          } else {
            overlay.setPosition(undefined)
          }
        }
        map.on('click', handleClick as (e: unknown) => void)
      } catch (err) {
        console.error('Beacons map init failed:', err)
      }
    }

    initMap()

    return () => {
      cancelled = true
      if (mapInstance.current) mapInstance.current.setTarget(undefined)
      overlayRef.current = null
    }
  }, [])

  // Update map features when data changes
  useEffect(() => {
    const map = mapInstance.current
    if (!map || loading) return

    let cancelled = false

    async function updateFeatures() {
      try {
        // ponytail: re-assert map is non-null inside async closure (TS can't
        // track the outer null check across the async boundary)
        if (!map || cancelled) return

        const vectorSource = new VectorSource()

      const filteredBeacons = beacons.filter((b) => {
        if (filter !== 'all' && b.beacon_type !== filter) return false
        if (search && !b.name.toLowerCase().includes(search.toLowerCase()) &&
            !b.authority?.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })

      filteredBeacons.forEach((beacon) => {
        const coords = utmToGeographic(beacon.easting, beacon.northing, beacon.utm_zone, beacon.hemisphere as 'N' | 'S')
        const color = getMarkerColor(beacon.beacon_type)
        const icon = getMarkerIcon(beacon.beacon_type)

        const feature = new Feature({
          geometry: new Point(fromLonLat([coords.lon, coords.lat])),
        })
        feature.setStyle(new Style({
          image: new CircleStyle({
            radius: 8,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          }),
          text: new Text({ text: icon, font: '12px sans-serif', fill: new Fill({ color: '#fff' }) }),
        }))
        // VULN-002 FIX (security review 2026-08-03): store structured data
        // instead of an HTML string — beacon names/authorities are
        // user-entered and would otherwise execute as stored XSS. The popup
        // is rendered with textContent in the click handler below.
        feature.set('popupData', {
          color,
          icon,
          name: beacon.name,
          authority: beacon.authority,
          beacon_type: beacon.beacon_type,
          easting: beacon.easting,
          northing: beacon.northing,
          elevation: beacon.elevation,
          utm_zone: beacon.utm_zone,
          hemisphere: beacon.hemisphere,
        })
        feature.set('beaconId', beacon.id)
        vectorSource.addFeature(feature)
      })

      // Pan to Kenya/East Africa if beacons exist
      if (filteredBeacons.length > 0) {
        const extent = vectorSource.getExtent()
        if (extent && (extent[2] - extent[0] > 0 || extent[3] - extent[1] > 0)) {
          map.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 10 })
        }
      } else {
        map.getView().setCenter(fromLonLat([36.8219, -1.2921]))
        map.getView().setZoom(6)
      }

        // Remove old vector layers, add new one
        const existing = map.getLayers().getArray().find((l) => l instanceof VectorLayer)
        if (existing) map.removeLayer(existing)
        map.addLayer(new VectorLayer({ source: vectorSource }))
      } catch (err) {
        console.error('Beacons map feature update failed:', err)
      }
    }

    updateFeatures()

    return () => {
      cancelled = true
    }
  }, [beacons, projects, filter, search, loading])

  const handleImport = async () => {
    if (!importBeacon || !importProject) return
    
    setImportLoading(true)
    
    try {
      const { error } = await dbClient.from('survey_points').insert({
        project_id: importProject,
        point_name: importBeacon.name,  // T1.5d FIX: was 'name' (column doesn't exist)
        easting: importBeacon.easting,
        northing: importBeacon.northing,
        elevation: importBeacon.elevation,
        is_control: true,
        // T1.5d: control_order and locked columns don't exist — removed.
        // The beacon's datum/utm_zone could be carried over here too.
        datum: importBeacon.datum || 'Arc 1960',
        utm_zone: importBeacon.utm_zone || 37,
        source: 'beacon_registry',
      })

      if (error) throw error
      
      setImportMsg({text:'Beacon imported successfully!', ok:true}); setTimeout(()=>setImportMsg(null),3000)
      setImportBeacon(null)
      setImportProject('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? (err as Error).message : String(err)
      setImportMsg({text:'Error: '+msg, ok:false}); setTimeout(()=>setImportMsg(null),4000)
    }
    
    setImportLoading(false)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Community Beacons</h1>
              <p className="text-sm text-[var(--text-secondary)]">East Africa Control Network</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/beacons/submit"
                className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg"
              >
                + Submit Beacon
              </Link>
            </div>
          </div>

          <div className="flex gap-4 items-center">
              <input
                type="text"
                placeholder="Search by name or authority..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
              />
              <div className="flex gap-2">
                {['all', 'trig', 'control', 'boundary', 'benchmark'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-2 rounded text-sm capitalize ${
                      filter === f ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
        </div>
      </header>

      <main className="flex-1 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="h-full" style={{ height: 'calc(100vh - 140px)' }}>
            <div ref={mapRef} className="w-full h-full" />
            <div ref={popupRef} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-2 text-sm shadow-lg" style={{ display: 'none' }}></div>
          </div>
        )}
      </main>

      {/* Import Modal */}
      {importBeacon && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">Import Beacon</h3>
            <p className="text-[var(--text-primary)] mb-4">
              Import {importBeacon.name} as a locked Primary control point?
            </p>
            
            <div className="mb-4">
              <label htmlFor="beacon-project" className="block text-sm text-[var(--text-secondary)] mb-2">Select Project</label>
              <select
                id="beacon-project"
                value={importProject}
                onChange={e => setImportProject(e.target.value)}
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
              >
                <option value="">Choose project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setImportBeacon(null)}
                className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!importProject || importLoading}
                className="flex-1 px-4 py-2 bg-[var(--accent)] text-black font-semibold rounded disabled:opacity-50"
              >
                {importLoading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Beacon Registry — searchable global database */}
      <div className="max-w-7xl mx-auto w-full px-4 py-6">
        <BeaconRegistryPanel />
      </div>

      {/* Control Point Registry — SoK Trig stations, KENCORS, benchmarks */}
      <div className="max-w-7xl mx-auto w-full px-4 pb-6">
        <ControlPointRegistry />
      </div>
    </div>
  )
}
