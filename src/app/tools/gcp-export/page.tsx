'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportGCPs, GCP_FORMATS, GCPFormat, GCPPoint } from '@/lib/export/gcpExport'
import Link from 'next/link'

// ── helpers ──────────────────────────────────────────────────────────────────

function download(content: string, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }))
  a.download = filename
  a.click()
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GCPExportPage() {
  const [projects, setProjects] = useState<{ id: string; name: string; utm_zone: number; hemisphere: string }[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [points, setPoints] = useState<GCPPoint[]>([])
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set())
  const [format, setFormat] = useState<GCPFormat>('pix4d')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState('')

  // Load projects
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('projects').select('id, name, utm_zone, hemisphere')
        .eq('user_id', user.id).order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setProjects(data) })
    })
  }, [])

  // Load points when project changes
  useEffect(() => {
    if (!selectedProject) { setPoints([]); return }
    setLoading(true)
    const supabase = createClient()
    const project = projects.find((p: any) => p.id === selectedProject)
    supabase.from('survey_points').select('*')
      .eq('project_id', selectedProject)
      .eq('is_control', true)
      .then(({ data }) => {
        if (data && project) {
          const pts: GCPPoint[] = data.map((p: any) => ({
            name: p.name,
            easting: p.easting,
            northing: p.northing,
            elevation: p.elevation ?? 0,
            utmZone: project.utm_zone,
            hemisphere: project.hemisphere as 'N' | 'S',
          }))
          setPoints(pts)
          setSelectedPoints(new Set(pts.map((p: any) => p.name)))
        }
        setLoading(false)
      })
  }, [selectedProject, projects])

  // Update preview
  useEffect(() => {
    const selected = points.filter((p: any) => selectedPoints.has(p.name))
    if (selected.length === 0) { setPreview(''); return }
    try {
      const { content } = exportGCPs(selected, format)
      setPreview(content)
    } catch { setPreview('Error generating preview') }
  }, [points, selectedPoints, format])

  const project = projects.find((p: any) => p.id === selectedProject)
  const selectedPts = points.filter((p: any) => selectedPoints.has(p.name))

  const handleExport = () => {
    if (selectedPts.length === 0 || !project) return
    const { content, ext } = exportGCPs(selectedPts, format)
    const fmtLabel = GCP_FORMATS.find((f: any) => f.id === format)?.label ?? format
    download(content, `${project.name}_GCPs_${fmtLabel}.${ext}`)
  }

  const togglePoint = (name: string) => {
    setSelectedPoints(prev => {
      const s = new Set(Array.from(prev))
      s.has(name) ? s.delete(name) : s.add(name)
      return s
    })
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">GCP export for drone software</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Export ground control points in formats compatible with Pix4D, DroneDeploy, Agisoft Metashape, OpenDroneMap and QGIS/ArcGIS.
          </p>
        </div>

        {/* What is a GCP? — for context */}
        <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-xl p-4 mb-6 text-sm">
          <p className="text-[var(--text-secondary)] leading-relaxed">
            <strong className="text-[var(--text-primary)]">Ground Control Points</strong> are precisely surveyed reference points 
            placed on the ground before a drone flight. They allow the photogrammetry software to 
            georeference the orthophoto and 3D model to within centimetre accuracy.
            METARDU converts your UTM control points to WGS84 lat/lon as required by drone software.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">

          {/* Left: Configuration */}
          <div className="space-y-5">

            {/* 1. Select project */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-black text-xs font-bold flex items-center justify-center">1</span>
                Select project
              </h2>
              {projects.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No projects found. <Link href="/project/new" className="text-[var(--accent)] hover:underline">Create one</Link> with control points marked.</p>
              ) : (
                <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="input w-full">
                  <option value="">— Choose project —</option>
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>

            {/* 2. Select GCPs */}
            {points.length > 0 && (
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-black text-xs font-bold flex items-center justify-center">2</span>
                    Select GCPs ({selectedPts.length}/{points.length})
                  </h2>
                  <button onClick={() => setSelectedPoints(new Set(points.map((p: any) => p.name)))}
                    className="text-xs text-[var(--accent)] hover:underline">Select all</button>
                </div>
                <div className="space-y-2">
                  {points.map((pt: any) => (
                    <label key={pt.name} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedPoints.has(pt.name)
                        ? 'bg-[var(--accent)]/5 border-[var(--accent)]/20'
                        : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'
                    }`}>
                      <input type="checkbox" checked={selectedPoints.has(pt.name)}
                        onChange={() => togglePoint(pt.name)} className="rounded flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{pt.name}</span>
                        <p className="text-xs text-[var(--text-muted)] font-mono">
                          E {pt.easting.toFixed(3)}  N {pt.northing.toFixed(3)}  Z {pt.elevation.toFixed(3)}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                {points.length === 0 && selectedProject && !loading && (
                  <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded px-3 py-2">
                    No control points in this project. In the workspace, mark points as control points first.
                  </p>
                )}
              </div>
            )}

            {selectedProject && !loading && points.length === 0 && (
              <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4 text-sm text-amber-400">
                No control points found in this project. Open the project workspace and mark some points as control points (tap a point → toggle Control Point).
              </div>
            )}

            {/* 3. Select format */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-black text-xs font-bold flex items-center justify-center">3</span>
                Export format
              </h2>
              <div className="space-y-2">
                {GCP_FORMATS.map((f: any) => (
                  <label key={f.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    format === f.id
                      ? 'bg-[var(--accent)]/5 border-[var(--accent)]/30'
                      : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[var(--accent)]/20'
                  }`}>
                    <input type="radio" name="format" value={f.id} checked={format === f.id}
                      onChange={() => setFormat(f.id)} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{f.label}</p>
                      <p className="text-xs text-[var(--text-muted)]">{f.desc}</p>
                    </div>
                    <span className="ml-auto text-xs text-[var(--text-muted)] flex-shrink-0">.{f.ext}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Export button */}
            <button
              onClick={handleExport}
              disabled={selectedPts.length === 0}
              className="btn btn-primary w-full text-base py-3 disabled:opacity-50"
            >
              Download {selectedPts.length > 0 ? `${selectedPts.length} GCPs` : 'GCPs'} — {GCP_FORMATS.find((f: any) => f.id === format)?.label}
            </button>

          </div>

          {/* Right: Preview + instructions */}
          <div className="space-y-5">

            {/* Preview */}
            {preview && (
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">File preview</h2>
                <pre className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-primary)] rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
                  {preview.slice(0, 800)}{preview.length > 800 ? '\n…' : ''}
                </pre>
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  Coordinates converted from UTM Zone {project?.utm_zone}{project?.hemisphere} to WGS84 lat/lon
                </p>
              </div>
            )}

            {/* Usage instructions per format */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">How to use in your software</h2>
              <div className="space-y-4 text-sm">
                {format === 'pix4d' && (
                  <div>
                    <p className="font-medium text-[var(--text-primary)] mb-1">Pix4Dmapper</p>
                    <p className="text-[var(--text-muted)] leading-relaxed">In your project, go to <em>Project → GCP / MTP Manager</em>. Click <em>Import GCPs</em>, choose the CSV file. Set coordinate system to WGS84 (EPSG:4326). Then mark each GCP on your images.</p>
                  </div>
                )}
                {format === 'dronedeploy' && (
                  <div>
                    <p className="font-medium text-[var(--text-primary)] mb-1">DroneDeploy</p>
                    <p className="text-[var(--text-muted)] leading-relaxed">Upload the CSV in the map settings under <em>Ground Control Points</em>. DroneDeploy will match the GCP names to the targets visible in your images automatically.</p>
                  </div>
                )}
                {format === 'metashape' && (
                  <div>
                    <p className="font-medium text-[var(--text-primary)] mb-1">Agisoft Metashape</p>
                    <p className="text-[var(--text-muted)] leading-relaxed">In Metashape, go to <em>Tools → Import → Import Reference</em>. Select the .txt file. Set coordinate system to WGS84. Then mark GCPs in the photo viewer using <em>Reference</em> panel.</p>
                  </div>
                )}
                {format === 'odm' && (
                  <div>
                    <p className="font-medium text-[var(--text-primary)] mb-1">OpenDroneMap / WebODM</p>
                    <p className="text-[var(--text-muted)] leading-relaxed">Save the file as <code>gcp_list.txt</code> in the same folder as your images. ODM reads it automatically when you add it to the task.</p>
                  </div>
                )}
                {format === 'csv' && (
                  <div>
                    <p className="font-medium text-[var(--text-primary)] mb-1">QGIS</p>
                    <p className="text-[var(--text-muted)] leading-relaxed">Layer → Add Layer → Add Delimited Text Layer. Select the CSV, set Geometry as Point (X = Longitude_WGS84, Y = Latitude_WGS84), CRS = EPSG:4326 (WGS84).</p>
                  </div>
                )}
                {format === 'geojson' && (
                  <div>
                    <p className="font-medium text-[var(--text-primary)] mb-1">QGIS / ArcGIS</p>
                    <p className="text-[var(--text-muted)] leading-relaxed">Drag and drop the .geojson file directly onto the QGIS canvas. In ArcGIS Pro, use Add Data → GeoJSON. All attributes including UTM coordinates are preserved.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Accuracy note */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4 text-xs text-[var(--text-muted)] leading-relaxed">
              <strong className="text-[var(--text-secondary)]">Accuracy note:</strong> METARDU converts from UTM to WGS84 using an iterative Newton-Raphson method accurate to ±0.0001m. 
              For highest accuracy, always verify at least one GCP against an independent check measurement after import.
              For RTK/PPK surveys, use the direct WGS84 coordinates from your GNSS receiver instead.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
