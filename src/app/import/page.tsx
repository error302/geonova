'use client';
import { useState, useCallback, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/api-client/client'
import { detectTotalStationFormat, TotalStationFormat } from '@/lib/import/totalStation/detectFormat'
import { parseGSI } from '@/lib/import/totalStation/parseGSI'
import { parseJobXML } from '@/lib/import/totalStation/parseJobXML'
import { parseTopcon } from '@/lib/import/totalStation/parseTopcon'
import { parseSDR } from '@/lib/import/totalStation/parseSDR'
import { logger } from '@/lib/logger'

interface ParsedPoint {
  pointId: string
  easting?: number
  northing?: number
  elevation?: number
  selected: boolean
}

interface Project {
  id: string
  name: string
}

export default function ImportPage() {
  const dbClient = createClient()
  const [file, setFile] = useState<File | null>(null)
  const [content, setContent] = useState<string>('')
  const [format, setFormat] = useState<TotalStationFormat>('unknown')
  const [points, setPoints] = useState<ParsedPoint[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState<number | null>(null)
  const [loadingProjects, setLoadingProjects] = useState(true)

  useEffect(() => {
    async function loadProjects() {
      const { data: { session } } = await dbClient.auth.getSession()
      const user = session?.user
      if (!user) return

      const { data } = await dbClient
        .from('projects')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (data) setProjects(data as Project[])
      setLoadingProjects(false)
    }
    loadProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setImported(null)

    const text = await selectedFile.text()
    setContent(text)

    const detectedFormat = detectTotalStationFormat(text, selectedFile.name)
    setFormat(detectedFormat)

    interface TotalStationRecord { pointId: string; easting?: number; northing?: number; elevation?: number }
    let parsed: { records: TotalStationRecord[]; warnings: string[] } = { records: [], warnings: [] }

    switch (detectedFormat) {
      case 'gsi':
        parsed = parseGSI(text)
        break
      case 'jobxml':
        parsed = parseJobXML(text)
        break
      case 'topcon':
        parsed = parseTopcon(text)
        break
      case 'sokkia':
        parsed = parseSDR(text)
        break
      default:
        setWarnings(['Unknown format. Please try CSV import instead.'])
        return
    }

    setWarnings(parsed.warnings || [])
    setPoints(parsed.records.map((r) => ({
      pointId: r.pointId,
      easting: r.easting,
      northing: r.northing,
      elevation: r.elevation,
      selected: true
    })))
  }, [])

  const toggleAll = (select: boolean) => {
    setPoints(points.map((p) => ({ ...p, selected: select })))
  }

  const togglePoint = (idx: number) => {
    setPoints(points.map((p, i) => i === idx ? { ...p, selected: !p.selected } : p))
  }

  const handleImport = async () => {
    if (!selectedProject) return

    setImporting(true)
    const selectedPoints = points.filter((p) => p.selected)

    const insertData = selectedPoints.map((p) => ({
      project_id: selectedProject,
      name: p.pointId,
      easting: p.easting || 0,
      northing: p.northing || 0,
      elevation: p.elevation || 0,
      is_control: false
    }))

    const { error } = await dbClient.from('survey_points').insert(insertData)

    if (error) {
      logger.error('Import error:', { error: error })
      setImporting(false)
      return
    }

    setImported(selectedPoints.length)
    setImporting(false)
  }

  const formatNames: Record<TotalStationFormat, string> = {
    gsi: 'Leica GSI',
    jobxml: 'Trimble JobXML',
    topcon: 'Topcon GTS',
    sokkia: 'Sokkia SDR',
    south: 'South NTS/Galaxy',
    csv: 'CSV',
    unknown: 'Unknown'
  }

  const selectedCount = points.filter((p) => p.selected).length
  const projectName = projects.find((p) => p.id === selectedProject)?.name

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-6">
        <div className="mb-8 pb-5 border-b border-[var(--border-color)]">
          <div className="font-mono text-[11px] text-[var(--accent)] tracking-[0.12em] uppercase mb-2">
            Field data → Metardu
          </div>
          <h1 className="font-display text-3xl text-[var(--text-primary)] tracking-[-0.025em]">Import field data</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            Import from any total station, GNSS rover, or drone software. Metardu auto-detects the format.
          </p>
        </div>

        {imported !== null ? (
          <div className="bg-[var(--success)]/10 border border-[var(--success)]/30 rounded-lg p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 border border-[var(--success)] flex items-center justify-center">
              <svg className="w-7 h-7 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="font-display text-2xl text-[var(--success)] tracking-[-0.02em] mb-2">
              {imported} points imported
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Successfully imported to {projectName}
            </p>
            <div className="flex gap-3 justify-center">
              <a
                href={`/project/${selectedProject}`}
                className="px-5 py-2.5 bg-[var(--accent)] text-[var(--bg-primary)] font-medium rounded-md hover:bg-[var(--accent-dim)] transition-colors text-sm no-underline"
              >
                Open project →
              </a>
              <button
                onClick={() => { setFile(null); setPoints([]); setImported(null); }}
                className="px-5 py-2.5 border border-[var(--border-color)] text-[var(--text-primary)] font-medium rounded-md hover:bg-[var(--bg-tertiary)] transition-colors text-sm"
              >
                Import More
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] p-6 mb-8">
              <h2 className="font-display text-xl text-[var(--text-primary)] tracking-[-0.015em] mb-4">Supported formats</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Import data directly from your total station, GNSS rover, or drone processing software.
                Metardu auto-detects the format.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FormatBadge color="var(--accent)" name="Leica GSI (.gsi)" />
                <FormatBadge color="var(--accent)" name="Trimble JobXML (.job, .jxl)" />
                <FormatBadge color="var(--accent)" name="Trimble RW5 (.rw5)" />
                <FormatBadge color="var(--accent)" name="Sokkia SDR (.sdr)" />
                <FormatBadge color="var(--accent)" name="Topcon GTS (.gtl, .raw)" />
                <FormatBadge color="var(--accent)" name="South NTS (.dat)" />
                <FormatBadge color="var(--accent)" name="CSV / TXT (.csv, .txt)" />
                <FormatBadge color="var(--accent)" name="DXF (.dxf)" />
                <FormatBadge color="var(--accent)" name="GeoJSON (.geojson)" />
                <FormatBadge color="var(--accent)" name="KML (.kml)" />
                <FormatBadge color="var(--accent)" name="XYZ Point Cloud (.xyz)" />
                <FormatBadge color="var(--accent)" name="LAS / LAZ (.las, .laz)" />
                <FormatBadge color="var(--accent)" name="RINEX (.rnx, .obs)" />
                <FormatBadge color="var(--accent)" name="Pix4D (.p4d)" />
                <FormatBadge color="var(--accent)" name="PLY Mesh (.ply)" />
                <FormatBadge color="var(--accent)" name="XML (.xml)" />
              </div>

              <div className="mt-8">
                <label htmlFor="import-file" className="block">
                  <div aria-label="Drop your file here or click to browse" className="border-2 border-dashed border-[var(--border-hover)] rounded-lg p-12 text-center cursor-pointer hover:border-[var(--accent)] transition-colors">
                    <div className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.1em] uppercase mb-4">
                      {file ? file.name : 'Drop your file here or click to browse'}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] font-mono">
                      .gsi · .job · .jxl · .rw5 · .sdr · .csv · .txt · .dxf · .geojson · .kml · .xyz · .las · .laz · .rnx · .p4d · .ply · .xml
                    </p>
                  </div>
                  <input
                    id="import-file"
                    type="file"
                    accept=".gsi,.job,.jxl,.rw5,.sdr,.gtl,.raw,.dat,.csv,.txt,.dxf,.geojson,.json,.kml,.xyz,.las,.laz,.rnx,.obs,.p4d,.ply,.xml"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {format !== 'unknown' && points.length > 0 && (
              <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-[var(--text-primary)] font-semibold">
                      Format detected: {formatNames[format]}
                    </h3>
                    <p className="text-[var(--text-secondary)] text-sm">
                      {points.length} points found
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAll(true)}
                      className="text-sm text-amber-500 hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => toggleAll(false)}
                      className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {warnings.length > 0 && (
                  <div className="bg-amber-900/20 border border-amber-500/50 rounded p-3 mb-4">
                    {warnings.map((w, i) => (
                      <p key={`${w}-${i}`} className="text-amber-400 text-sm"><AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> {w}</p>
                    ))}
                  </div>
                )}

                <div className="max-h-64 overflow-y-auto space-y-2 mb-6">
                  {points.map((p, i) => (
                    <div
                      key={`${p}-${i}`}
                      onClick={() => togglePoint(i)}
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer ${
                        p.selected ? 'bg-amber-500/10' : 'bg-[var(--bg-card)]'
                      }`}
                    >
                      <input aria-label="Selected"
                        type="checkbox"
                        checked={p.selected}
                        onChange={() => togglePoint(i)}
                        className="accent-amber-500"
                      />
                      <span className="text-[var(--text-primary)] font-mono text-sm w-16">{p.pointId}</span>
                      {p.easting !== undefined ? (
                        <span className="text-[var(--text-secondary)] text-xs">
                          E: {p.easting.toFixed(4)} N: {p.northing?.toFixed(4)} Z: {p.elevation?.toFixed(3)}
                        </span>
                      ) : (
                        <span className="text-red-400 text-xs">No coordinates</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mb-6">
                  <label htmlFor="import-project" className="block text-sm text-[var(--text-secondary)] mb-2">
                    Import to project:
                  </label>
                  <select
                    id="import-project"
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-4 py-2 text-[var(--text-primary)]"
                  >
                    <option value="">Select a project...</option>
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>{proj.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleImport}
                  disabled={!selectedProject || selectedCount === 0 || importing}
                  className="w-full py-3 bg-amber-500 text-black font-bold rounded hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? 'Importing...' : `Import ${selectedCount} Points`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function FormatBadge({ color, name }: { color: string; name: string }) {
  return (
    <div
      className="p-3 rounded-md border text-center font-mono text-xs"
      style={{
        background: `${color}15`,
        color: color,
        borderColor: `${color}40`,
      }}
    >
      {name}
    </div>
  )
}
