'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { utmToGeographic } from '@/lib/engine/coordinates'
import Link from 'next/link'

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false })

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
}

interface Project {
  id: string
  name: string
  location?: string
  survey_type?: string
  created_at: string
}

export default function BeaconsPage() {
  const [view, setView] = useState<'beacons' | 'activity'>('beacons')
  const [beacons, setBeacons] = useState<Beacon[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [importProject, setImportProject] = useState('')
  const [importBeacon, setImportBeacon] = useState<Beacon | null>(null)
  const [importLoading, setImportLoading] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    
    const [beaconsRes, projectsRes] = await Promise.all([
      supabase.from('public_beacons').select('*').eq('status', 'verified'),
      supabase.from('projects').select('id, name, location, survey_type, created_at')
    ])

    if (beaconsRes.data) setBeacons(beaconsRes.data)
    if (projectsRes.data) setProjects(projectsRes.data)
    
    setLoading(false)
  }

  const getMarkerIcon = (type: string) => {
    const icons: Record<string, string> = {
      trig: '▲',
      control: '●',
      boundary: '■',
      benchmark: '◆',
      gnss: '★',
      other: '●'
    }
    return icons[type] || '●'
  }

  const getMarkerColor = (type: string) => {
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

  const filteredBeacons = beacons.filter(b => {
    if (filter !== 'all' && b.beacon_type !== filter) return false
    if (search && !b.name.toLowerCase().includes(search.toLowerCase()) && 
        !b.authority?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const getProjectCenter = (project: Project) => {
    return { lat: -1.5 + Math.random() * 10, lon: 30 + Math.random() * 15 }
  }

  const handleImport = async () => {
    if (!importBeacon || !importProject) return
    
    setImportLoading(true)
    
    try {
      const { error } = await supabase.from('survey_points').insert({
        project_id: importProject,
        name: importBeacon.name,
        easting: importBeacon.easting,
        northing: importBeacon.northing,
        elevation: importBeacon.elevation,
        is_control: true,
        control_order: 'primary',
        locked: true
      })

      if (error) throw error
      
      alert('Beacon imported successfully!')
      setImportBeacon(null)
      setImportProject('')
    } catch (err: any) {
      alert('Error: ' + err.message)
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
              <button
                onClick={() => setView('beacons')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  view === 'beacons' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                }`}
              >
                Beacons
              </button>
              <button
                onClick={() => setView('activity')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  view === 'activity' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                }`}
              >
                Survey Activity
              </button>
            </div>
          </div>

          {view === 'beacons' && (
            <div className="flex gap-4 items-center">
              <input
                type="text"
                placeholder="Search by name or authority..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
              />
              <div className="flex gap-2">
                {['all', 'trig', 'control', 'boundary', 'benchmark'].map(f => (
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
              <Link
                href="/beacons/submit"
                className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg"
              >
                + Submit Beacon
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="h-full" style={{ height: 'calc(100vh - 140px)' }}>
            <MapContainer
              center={[-1.2921, 36.8219]}
              zoom={6}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {view === 'beacons' && filteredBeacons.map(beacon => {
                const coords = utmToGeographic(beacon.easting, beacon.northing, beacon.utm_zone, beacon.hemisphere as 'N' | 'S')
                const color = getMarkerColor(beacon.beacon_type)
                const icon = getMarkerIcon(beacon.beacon_type)
                
                return (
                  <Marker key={beacon.id} position={[coords.lat, coords.lon]}>
                    <Popup>
                      <div className="text-sm min-w-[200px]">
                        <div className="font-bold text-lg" style={{ color }}>
                          {icon} {beacon.name}
                        </div>
                        {beacon.authority && (
                          <div className="text-[var(--text-muted)] mt-1">Authority: {beacon.authority}</div>
                        )}
                        <div className="text-[var(--text-muted)] capitalize">Type: {beacon.beacon_type}</div>
                        <div className="font-mono mt-2">
                          E: {beacon.easting.toFixed(4)}<br/>
                          N: {beacon.northing.toFixed(4)}
                        </div>
                        {beacon.elevation && (
                          <div className="text-[var(--text-muted)]">Elev: {beacon.elevation.toFixed(3)} m</div>
                        )}
                        <div className="text-[var(--text-muted)] text-xs mt-1">
                          UTM Zone {beacon.utm_zone}{beacon.hemisphere}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}

              {view === 'activity' && projects.filter(p => p.survey_type).map(project => {
                const center = getProjectCenter(project)
                const icons: Record<string, string> = {
                  boundary: '📐',
                  topographic: '🗺',
                  road: '🛣',
                  construction: '🏗',
                  control: '📍',
                  leveling: '📏',
                  other: '📌'
                }
                
                return (
                  <Marker key={project.id} position={[center.lat, center.lon]}>
                    <Popup>
                      <div className="text-sm">
                        <div className="font-bold text-lg">
                          {icons[project.survey_type || 'other']} {project.survey_type}
                        </div>
                        <div className="text-[var(--text-muted)]">Active Survey</div>
                        {project.location && (
                          <div className="text-[var(--text-muted)] mt-1">Area: {project.location}</div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )
              })}
            </MapContainer>
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
              <label className="block text-sm text-[var(--text-secondary)] mb-2">Select Project</label>
              <select
                value={importProject}
                onChange={e => setImportProject(e.target.value)}
                className="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
              >
                <option value="">Choose project...</option>
                {projects.map(p => (
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
    </div>
  )
}
