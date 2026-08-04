'use client';

import { useState, useMemo, useCallback } from 'react'
import {
  exportMachineControl,
  MACHINE_FORMATS,
  type MachineControlPoint,
  type MachineControlFormat,
} from '@/lib/export/machineControlExport'

// ─── Demo data: 20 points simulating a road alignment ────────────────────────

function generateDemoData(): MachineControlPoint[] {
  const points: MachineControlPoint[] = []
  const baseE = 374500.000
  const baseN = 9843200.000
  const baseZ = 1542.500

  for (let i = 0; i < 20; i++) {
    const chainage = i * 20 // 0, 20, 40, … 380m
    const eOffset = chainage * 0.3 + Math.sin(chainage * 0.02) * 2.5
    const nOffset = chainage * 0.98 + Math.cos(chainage * 0.015) * 1.8
    const elev = baseZ - chainage * 0.008 + Math.sin(chainage * 0.01) * 0.5

    let code = 'CTR'
    let desc = `Centreline chainage ${chainage}+000`

    if (i % 5 === 0) {
      code = 'PI'
      desc = `Point of intersection at ${chainage}+000`
    } else if (i % 4 === 0) {
      code = 'EP'
      desc = `Edge of pavement at ${chainage}+000`
    } else if (i % 3 === 0) {
      code = 'SHL'
      desc = `Shoulder at ${chainage}+000`
    }

    points.push({
      name: `Rd-${String(chainage).padStart(4, '0')}`,
      easting: parseFloat((baseE + eOffset).toFixed(4)),
      northing: parseFloat((baseN + nOffset).toFixed(4)),
      elevation: parseFloat(elev.toFixed(4)),
      code,
      description: desc,
    })
  }

  return points
}

// ─── CSV parser ──────────────────────────────────────────────────────────────

function parseCSV(text: string): MachineControlPoint[] {
  const lines = text.trim().split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'))
  if (lines.length === 0) return []

  // Skip header if it contains alpha words
  const firstLine = lines[0].split(',').map((s) => s.trim().toLowerCase())
  const isHeader = firstLine.some(
    (h) => h === 'name' || h === 'easting' || h === 'easting(e)' || h === 'northing' || h === 'point'
  )
  const dataLines = isHeader ? lines.slice(1) : lines

  return dataLines.map((line, idx) => {
    const parts = line.split(',').map((s) => s.trim())
    return {
      name: parts[0] || `P${idx + 1}`,
      easting: parseFloat(parts[1]) || 0,
      northing: parseFloat(parts[2]) || 0,
      elevation: parseFloat(parts[3]) || 0,
      code: parts[4] || 'PT',
      description: parts[5] || '',
    }
  })
}

function pointsToCSV(points: MachineControlPoint[]): string {
  const header = 'Name,E,N,Z,Code,Description'
  const rows = points.map(
    (p) =>
      `${p.name},${p.easting.toFixed(4)},${p.northing.toFixed(4)},${p.elevation.toFixed(4)},${p.code},"${p.description || ''}"`
  )
  return [header, ...rows].join('\n')
}

// ─── Format description lookup ───────────────────────────────────────────────

function getFormatDescription(formatId: MachineControlFormat): string {
  const fmt = MACHINE_FORMATS.find((f) => f.id === formatId)
  return fmt ? `${fmt.software} — ${fmt.description}` : ''
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MachineControlExportPanel() {
  const [points, setPoints] = useState<MachineControlPoint[]>([])
  const [selectedFormat, setSelectedFormat] = useState<MachineControlFormat>('trimble_csv')
  const [coordSystem, setCoordSystem] = useState('Arc 1960 / UTM Zone 37S')
  const [projectName, setProjectName] = useState('Road_Alignment')
  const [csvInput, setCsvInput] = useState('')
  const [importError, setImportError] = useState('')

  const selectedFormatDescriptor = useMemo(
    () => MACHINE_FORMATS.find((f) => f.id === selectedFormat),
    [selectedFormat]
  )

  const handleImportCSV = useCallback(() => {
    setImportError('')
    if (!csvInput.trim()) {
      setImportError('Please paste or type CSV data before importing.')
      return
    }
    try {
      const parsed = parseCSV(csvInput)
      if (parsed.length === 0) {
        setImportError('No valid points found. Expected format: Name,E,N,Z,Code,Description')
        return
      }
      setPoints(parsed)
      setCsvInput('')
    } catch {
      setImportError('Failed to parse CSV. Check the format: Name,E,N,Z,Code,Description')
    }
  }, [csvInput])

  const handleLoadDemo = useCallback(() => {
    setPoints(generateDemoData())
    setImportError('')
    setCsvInput('')
  }, [])

  const handleClearAll = useCallback(() => {
    setPoints([])
    setCsvInput('')
    setImportError('')
  }, [])

  const handleRemovePoint = useCallback((index: number) => {
    setPoints((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleExport = useCallback(() => {
    if (points.length === 0) return

    const result = exportMachineControl(points, {
      format: selectedFormat,
      coordinateSystem: coordSystem,
    })

    const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_')
    const filename = `${safeName}_${result.filename}`

    const blob = new Blob([result.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [points, selectedFormat, coordSystem, projectName])

  const handleCopyCSV = useCallback(() => {
    if (points.length === 0) return
    navigator.clipboard.writeText(pointsToCSV(points))
  }, [points])

  return (
    <div className="space-y-6">
      {/* ── Stats Bar ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 items-center text-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-zinc-400">Points:</span>
          <span className="font-mono font-semibold text-blue-400">{points.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-zinc-400">Format:</span>
          <span className="font-mono text-emerald-400">
            {selectedFormatDescriptor?.label ?? '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-zinc-400">Software:</span>
          <span className="font-mono text-amber-400">
            {selectedFormatDescriptor?.software ?? '—'}
          </span>
        </div>
      </div>

      {/* ── Import Section ──────────────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          Import Points
        </h2>

        <div className="mb-3">
          <textarea
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            placeholder={`Paste CSV data here. Expected format:\nName,E,N,Z,Code,Description\nCL-0000,374500.000,9843200.000,1542.500,CTR,Centreline\n...`}
            rows={5}
            className="w-full rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm font-mono text-zinc-200 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          />
        </div>

        {importError && (
          <p className="text-xs text-red-400 mb-3 font-mono">{importError}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleImportCSV}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
          >
            Import CSV
          </button>
          <button
            onClick={handleLoadDemo}
            className="rounded-md bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-600 transition-colors"
          >
            Load Demo Data (20 Points)
          </button>
          {points.length > 0 && (
            <button
              onClick={handleCopyCSV}
              className="rounded-md bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-600 transition-colors"
            >
              Copy Points CSV
            </button>
          )}
          {points.length > 0 && (
            <button
              onClick={handleClearAll}
              className="rounded-md bg-red-900/50 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900 transition-colors ml-auto"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* ── Export Configuration ────────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Export Settings
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Format selector */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="output-format">Output Format</label>
            <select id="output-format"
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as MachineControlFormat)}
              className="w-full rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm font-mono text-zinc-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {MACHINE_FORMATS.map((fmt) => (
                <option key={fmt.id} value={fmt.id}>
                  {fmt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Coordinate system */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="coordinate-system">Coordinate System</label>
            <input id="coordinate-system"
              type="text"
              value={coordSystem}
              onChange={(e) => setCoordSystem(e.target.value)}
              className="w-full rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm font-mono text-zinc-200 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Arc 1960 / UTM Zone 37S"
            />
          </div>

          {/* Project name */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1" htmlFor="project-name">Project Name</label>
            <input id="project-name"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm font-mono text-zinc-200 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Road_Alignment"
            />
          </div>
        </div>

        {/* Format description */}
        <p className="text-xs text-zinc-500 font-mono bg-zinc-900 rounded-md px-3 py-2 border border-zinc-700">
          {getFormatDescription(selectedFormat)}
        </p>
      </div>

      {/* ── Point Table ─────────────────────────────────────────────────── */}
      {points.length > 0 && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Points ({points.length})
            </h2>
            <span className="text-xs text-zinc-500 font-mono">
              File: {projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_{selectedFormatDescriptor?.extension || '.csv'}
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs font-mono">
              <thead className="sticky top-0 bg-zinc-800 z-10">
                <tr className="text-left text-zinc-400 border-b border-zinc-700">
                  <th className="px-3 py-2 w-8">#</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2 text-right">Easting</th>
                  <th className="px-3 py-2 text-right">Northing</th>
                  <th className="px-3 py-2 text-right">Elevation</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {points.map((pt, idx) => (
                  <tr
                    key={pt.name}
                    className="border-b border-zinc-700/50 hover:bg-zinc-700/30 transition-colors"
                  >
                    <td className="px-3 py-1.5 text-zinc-500">{idx + 1}</td>
                    <td className="px-3 py-1.5 text-blue-400">{pt.name}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-300">{pt.easting.toFixed(4)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-300">{pt.northing.toFixed(4)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-300">{pt.elevation.toFixed(4)}</td>
                    <td className="px-3 py-1.5">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px]">
                        {pt.code}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-zinc-400 max-w-[200px] truncate">{pt.description}</td>
                    <td className="px-3 py-1.5">
                      <button
                        onClick={() => handleRemovePoint(idx)}
                        className="text-zinc-600 hover:text-red-400 transition-colors"
                        title="Remove point"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Export buttons */}
          <div className="px-4 py-3 border-t border-zinc-700 flex flex-wrap gap-2">
            <button
              onClick={handleExport}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
              Export {selectedFormatDescriptor?.label}
            </button>

            {/* Quick format buttons */}
            <div className="flex gap-1 ml-auto">
              {MACHINE_FORMATS.map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => {
                    if (points.length === 0) return
                    const result = exportMachineControl(points, {
                      format: fmt.id,
                      coordinateSystem: coordSystem,
                    })
                    const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_')
                    const blob = new Blob([result.content], { type: 'text/plain;charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${safeName}_${result.filename}`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                  }}
                  disabled={points.length === 0}
                  className={`rounded-md px-2 py-1 text-[10px] font-mono transition-colors ${
                    fmt.id === selectedFormat
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={`Export as ${fmt.label}`}
                >
                  {fmt.extension}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Empty State ─────────────────────────────────────────────────── */}
      {points.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-800/30 p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-800 mb-4">
            <svg className="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-zinc-400 mb-1">No Points Loaded</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Import design points from CSV or click &quot;Load Demo Data&quot; to generate 20 sample road alignment points for testing.
          </p>
        </div>
      )}

      {/* ── Format Reference ────────────────────────────────────────────── */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-4">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Format Reference
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {MACHINE_FORMATS.map((fmt) => (
            <div
              key={fmt.id}
              className={`rounded-md border p-3 transition-colors ${
                fmt.id === selectedFormat
                  ? 'border-blue-500 bg-blue-500/5'
                  : 'border-zinc-700 bg-zinc-900/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-zinc-200">{fmt.label}</span>
                <span className="text-[10px] font-mono text-zinc-500">{fmt.extension}</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">{fmt.description}</p>
              <p className="text-[10px] text-blue-400 mt-1 font-mono">{fmt.software}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
