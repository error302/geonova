'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { exportCivil, CIVIL_FORMATS, CivilFormat, CivilPoint } from '@/lib/export/civilHandoff'
import Link from 'next/link'

function download(content: string, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }))
  a.download = filename; a.click()
}

export default function CivilExportPage() {
  const [projects, setProjects]   = useState<any[]>([])
  const [projectId, setProjectId] = useState('')
  const [allPoints, setAllPoints] = useState<CivilPoint[]>([])
  const [format, setFormat]       = useState<CivilFormat>('civil3d')
  const [filter, setFilter]       = useState<'all' | 'control' | 'survey'>('all')
  const [loading, setLoading]     = useState(false)
  const [preview, setPreview]     = useState('')

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      sb.from('projects').select('id,name,utm_zone,hemisphere').eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setProjects(data) })
    })
  }, [])

  useEffect(() => {
    if (!projectId) { setAllPoints([]); return }
    setLoading(true)
    const sb = createClient()
    sb.from('survey_points').select('*').eq('project_id', projectId)
      .then(({ data }) => {
        if (data) setAllPoints(data.map((p: any) => ({
          name: p.name, easting: p.easting, northing: p.northing,
          elevation: p.elevation ?? 0, is_control: p.is_control, code: p.code,
        })))
        setLoading(false)
      })
  }, [projectId])

  const project = projects.find((p: any) => p.id === projectId)

  const filteredPoints = allPoints.filter((p: any) =>
    filter === 'all' ? true : filter === 'control' ? p.is_control : !p.is_control
  )

  useEffect(() => {
    if (!filteredPoints.length || !project) { setPreview(''); return }
    try {
      const { content } = exportCivil(filteredPoints, format, project.name, project.utm_zone, project.hemisphere)
      setPreview(content.slice(0, 1000) + (content.length > 1000 ? '\n…' : ''))
    } catch { setPreview('Error') }
  }, [filteredPoints, format, project])

  const handleExport = () => {
    if (!filteredPoints.length || !project) return
    const fmt = CIVIL_FORMATS.find((f: any) => f.id === format)!
    const { content, ext } = exportCivil(filteredPoints, format, project.name, project.utm_zone, project.hemisphere)
    download(content, `${project.name}_${fmt.label.replace(/[\s/]/g, '_')}.${ext}`)
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Civil engineering data export</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Export survey points in formats compatible with AutoCAD Civil 3D, 12d Model, QGIS, ArcGIS, and CloudCompare.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-5">

            {/* Project */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-black text-xs font-bold flex items-center justify-center">1</span>
                Project
              </h2>
              {projects.length === 0
                ? <p className="text-sm text-[var(--text-muted)]">No projects. <Link href="/project/new" className="text-[var(--accent)]">Create one →</Link></p>
                : <select value={projectId} onChange={e => setProjectId(e.target.value)} className="input w-full">
                    <option value="">— Choose project —</option>
                    {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>}
              {project && (
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  UTM Zone {project.utm_zone}{project.hemisphere} · {allPoints.length} points total
                  ({allPoints.filter((p: any) => p.is_control).length} control, {allPoints.filter((p: any) => !p.is_control).length} survey)
                </p>
              )}
            </div>

            {/* Point filter */}
            {allPoints.length > 0 && (
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-black text-xs font-bold flex items-center justify-center">2</span>
                  Points to export
                </h2>
                <div className="flex gap-2 mb-3">
                  {([
                    { k:'all',     l:`All (${allPoints.length})` },
                    { k:'control', l:`Control (${allPoints.filter((p: any) =>p.is_control).length})` },
                    { k:'survey',  l:`Survey (${allPoints.filter((p: any) =>!p.is_control).length})` },
                  ] as const).map(({ k, l }) => (
                    <button key={k} onClick={() => setFilter(k)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${filter === k ? 'bg-[var(--accent)] text-black border-[var(--accent)]' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border-color)]'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {filteredPoints.length} points will be exported. For Civil 3D surface creation, export all points with elevation.
                </p>
              </div>
            )}

            {/* Format */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[var(--accent)] text-black text-xs font-bold flex items-center justify-center">3</span>
                Export format
              </h2>
              <div className="space-y-2">
                {CIVIL_FORMATS.map((f: any) => (
                  <label key={f.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${format === f.id ? 'bg-[var(--accent)]/5 border-[var(--accent)]/30' : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[var(--accent)]/20'}`}>
                    <input type="radio" name="fmt" value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} className="mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{f.label}</p>
                      <p className="text-xs text-[var(--text-muted)]">{f.software}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{f.desc}</p>
                    </div>
                    <span className="text-xs text-[var(--text-muted)] flex-shrink-0">.{f.ext}</span>
                  </label>
                ))}
              </div>
            </div>

            <button onClick={handleExport} disabled={!filteredPoints.length}
              className="btn btn-primary w-full text-base py-3 disabled:opacity-50">
              Download {filteredPoints.length > 0 ? `${filteredPoints.length} points` : ''} — {CIVIL_FORMATS.find((f: any) => f.id === format)?.label}
            </button>
          </div>

          <div className="space-y-5">
            {/* Preview */}
            {preview && (
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">File preview</h2>
                <pre className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-primary)] rounded-lg p-4 overflow-x-auto whitespace-pre-wrap max-h-64">{preview}</pre>
              </div>
            )}

            {/* Instructions per format */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Import instructions</h2>
              <div className="text-sm text-[var(--text-muted)] leading-relaxed space-y-2">
                {format === 'civil3d' && <>
                  <p><strong className="text-[var(--text-primary)]">AutoCAD Civil 3D:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Home tab → Create Ground Data → Points → Import Points</li>
                    <li>Format: PENZD (comma delimited)</li>
                    <li>Browse to the downloaded CSV file</li>
                    <li>Points will appear in the drawing at correct coordinates</li>
                  </ol>
                </>}
                {format === '12d' && <>
                  <p><strong className="text-[var(--text-primary)]">12d Model:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>File → Import → Survey ASCII Import</li>
                    <li>Select format: Name,E,N,RL,String</li>
                    <li>Import into a new or existing model</li>
                    <li>Points appear as a survey string in the 3D view</li>
                  </ol>
                </>}
                {format === 'shapefile_csv' && <>
                  <p><strong className="text-[var(--text-primary)]">QGIS:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Layer → Add Layer → Add Delimited Text Layer</li>
                    <li>X field: Lon_WGS84 · Y field: Lat_WGS84</li>
                    <li>CRS: EPSG:4326 (WGS84)</li>
                    <li>Then reproject to project CRS using Vector → Data Management Tools → Reproject</li>
                  </ol>
                  <p className="text-xs mt-2"><strong className="text-[var(--text-primary)]">ArcGIS Pro:</strong> Add Data → XY Point Data, set X = Lon_WGS84, Y = Lat_WGS84.</p>
                </>}
                {format === 'landxml_surface' && <>
                  <p><strong className="text-[var(--text-primary)]">Civil 3D Existing Ground:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Toolspace → Prospector → Surfaces → right-click → Import LandXML</li>
                    <li>The surface imports as a TIN surface with all survey points as breaklines</li>
                    <li>Use for cut/fill volumes against a design surface</li>
                  </ol>
                </>}
                {format === 'pointcloud' && <>
                  <p><strong className="text-[var(--text-primary)]">CloudCompare:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>File → Open → select the .txt file</li>
                    <li>Columns: X Y Z Intensity (skip Name)</li>
                    <li>View the survey as a 3D point cloud</li>
                  </ol>
                  <p className="text-xs mt-2"><strong className="text-[var(--text-primary)]">Civil 3D:</strong> Insert → Point Cloud — import the .txt as an ASCII point cloud.</p>
                </>}
                {format === 'moss' && <>
                  <p><strong className="text-[var(--text-primary)]">MOSS / Microdrainage:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Survey menu → Import Points → ASCII format</li>
                    <li>Select the .def file</li>
                    <li>Columns are pre-formatted for MOSS standard import</li>
                  </ol>
                </>}
              </div>
            </div>

            {/* Value prop for engineers */}
            <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-xl p-4 text-sm">
              <p className="text-[var(--text-secondary)] leading-relaxed">
                <strong className="text-[var(--text-primary)]">For civil engineers:</strong> Survey data from METARDU is always correctly georeferenced in UTM with the datum declared. 
                You won't receive DXF files in unknown coordinate systems or CSV with missing elevations. 
                The LandXML Surface format creates an existing ground surface in Civil 3D ready for road design and earthwork volumes immediately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
