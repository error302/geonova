'use client'
import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { detectTotalStationFormat, TotalStationFormat } from '@/lib/import/totalStation/detectFormat'
import { parseGSI } from '@/lib/import/totalStation/parseGSI'
import { parseJobXML } from '@/lib/import/totalStation/parseJobXML'
import { parseTopcon } from '@/lib/import/totalStation/parseTopcon'
import { parseSDR } from '@/lib/import/totalStation/parseSDR'

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
  const supabase = createClient()
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (data) setProjects(data)
      setLoadingProjects(false)
    }
    loadProjects()
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

    let parsed: any = { records: [], warnings: [] }

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
    setPoints(parsed.records.map((r: any) => ({
      pointId: r.pointId,
      easting: r.easting,
      northing: r.northing,
      elevation: r.elevation,
      selected: true
    })))
  }, [])

  const toggleAll = (select: boolean) => {
    setPoints(points.map(p => ({ ...p, selected: select })))
  }

  const togglePoint = (idx: number) => {
    setPoints(points.map((p, i) => i === idx ? { ...p, selected: !p.selected } : p))
  }

  const handleImport = async () => {
    if (!selectedProject) return

    setImporting(true)
    const selectedPoints = points.filter(p => p.selected)

    const insertData = selectedPoints.map(p => ({
      project_id: selectedProject,
      name: p.pointId,
      easting: p.easting || 0,
      northing: p.northing || 0,
      elevation: p.elevation || 0,
      is_control: false
    }))

    const { error } = await supabase.from('survey_points').insert(insertData)

    if (error) {
      console.error('Import error:', error)
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
    csv: 'CSV',
    unknown: 'Unknown'
  }

  const selectedCount = points.filter(p => p.selected).length
  const projectName = projects.find(p => p.id === selectedProject)?.name

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-12">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-3xl font-bold text-white mb-2">Total Station Import</h1>
        <p className="text-gray-400 mb-8">
          Import data directly from your total station
        </p>

        {imported !== null ? (
          <div className="bg-green-900/20 border border-green-500 rounded-xl p-8 text-center">
            <div className="text-4xl mb-4">✓</div>
            <h2 className="text-xl font-bold text-green-400 mb-2">
              {imported} points imported
            </h2>
            <p className="text-gray-400 mb-6">
              Successfully imported to {projectName}
            </p>
            <div className="flex gap-4 justify-center">
              <a
                href={`/project/${selectedProject}`}
                className="px-6 py-2 bg-amber-500 text-black font-bold rounded hover:bg-amber-400"
              >
                Open Project
              </a>
              <button
                onClick={() => { setFile(null); setPoints([]); setImported(null); }}
                className="px-6 py-2 border border-amber-500 text-amber-500 font-bold rounded hover:bg-amber-500/10"
              >
                Import More
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-[#111] rounded-xl border border-[#222] p-8 mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">Supported Formats</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FormatBadge color="blue" name="Leica GSI" />
                <FormatBadge color="red" name="Trimble JobXML" />
                <FormatBadge color="yellow" name="Topcon GTS" />
                <FormatBadge color="green" name="Sokkia SDR" />
              </div>

              <div className="mt-8">
                <label className="block">
                  <div className="border-2 border-dashed border-amber-500/50 rounded-xl p-12 text-center cursor-pointer hover:border-amber-500 transition-colors">
                    <div className="text-4xl mb-4">📁</div>
                    <p className="text-white font-medium mb-2">
                      {file ? file.name : 'Drop your file here or click to browse'}
                    </p>
                    <p className="text-gray-500 text-sm">
                      Supported: .gsi, .job, .jxl, .sdr, .csv
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".gsi,.job,.jxl,.sdr,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {format !== 'unknown' && points.length > 0 && (
              <div className="bg-[#111] rounded-xl border border-[#222] p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-white font-semibold">
                      Format detected: {formatNames[format]}
                    </h3>
                    <p className="text-gray-400 text-sm">
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
                      className="text-sm text-gray-400 hover:text-white"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {warnings.length > 0 && (
                  <div className="bg-amber-900/20 border border-amber-500/50 rounded p-3 mb-4">
                    {warnings.map((w, i) => (
                      <p key={i} className="text-amber-400 text-sm">⚠ {w}</p>
                    ))}
                  </div>
                )}

                <div className="max-h-64 overflow-y-auto space-y-2 mb-6">
                  {points.map((p, i) => (
                    <div
                      key={i}
                      onClick={() => togglePoint(i)}
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer ${
                        p.selected ? 'bg-amber-500/10' : 'bg-gray-900/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={p.selected}
                        onChange={() => togglePoint(i)}
                        className="accent-amber-500"
                      />
                      <span className="text-white font-mono text-sm w-16">{p.pointId}</span>
                      {p.easting !== undefined ? (
                        <span className="text-gray-400 text-xs">
                          E: {p.easting.toFixed(4)} N: {p.northing?.toFixed(4)} Z: {p.elevation?.toFixed(3)}
                        </span>
                      ) : (
                        <span className="text-red-400 text-xs">No coordinates</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mb-6">
                  <label className="block text-sm text-gray-400 mb-2">
                    Import to project:
                  </label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-4 py-2 text-white"
                  >
                    <option value="">Select a project...</option>
                    {projects.map(proj => (
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
  const colors: Record<string, string> = {
    blue: 'bg-blue-900/30 text-blue-400 border-blue-500',
    red: 'bg-red-900/30 text-red-400 border-red-500',
    yellow: 'bg-yellow-900/30 text-yellow-400 border-yellow-500',
    green: 'bg-green-900/30 text-green-400 border-green-500',
  }
  return (
    <div className={`p-3 rounded-lg border ${colors[color]} text-center text-sm font-medium`}>
      {name}
    </div>
  )
}
