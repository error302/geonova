'use client'

/**
 * CutFillPanel — Earthwork cut/fill visualization
 *
 * Lets surveyors:
 * - Import existing ground surface (CSV: E, N, Z)
 * - Import design grade surface (CSV: E, N, Z)
 * - Compute cut/fill volumes
 * - View heat map (red=cut, green=fill)
 * - Export CSV report
 */

import { useState, useCallback } from 'react'
import {
  Mountain, Upload, Download, Loader2, CheckCircle2,
} from 'lucide-react'
import {
  computeCutFill,
  getHeatMapColor,
  generateCutFillReport,
  type GridSurface,
  type GridPoint,
  type CutFillResult,
} from '@/lib/engine/cutFillEngine'

export function CutFillPanel() {
  const [existingSurface, setExistingSurface] = useState<GridSurface | null>(null)
  const [designSurface, setDesignSurface] = useState<GridSurface | null>(null)
  const [result, setResult] = useState<CutFillResult | null>(null)
  const [computing, setComputing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parseSurfaceCSV = useCallback((text: string): GridSurface => {
    const lines = text.split('\n').filter(l => l.trim())
    const points: GridPoint[] = []
    let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity

    for (const line of lines) {
      const cols = line.split(',').map(c => c.trim())
      if (cols.length < 3) continue
      const e = parseFloat(cols[0])
      const n = parseFloat(cols[1])
      const z = parseFloat(cols[2])
      if (!isFinite(e) || !isFinite(n) || !isFinite(z)) continue
      points.push({ easting: e, northing: n, elevation: z })
      minE = Math.min(minE, e)
      maxE = Math.max(maxE, e)
      minN = Math.min(minN, n)
      maxN = Math.max(maxN, n)
    }

    // Infer grid spacing
    const spacing = points.length > 1 ? Math.sqrt(Math.abs((maxE - minE) * (maxN - minN)) / points.length) : 1
    const cols_count = Math.round((maxE - minE) / spacing) + 1
    const rows = Math.round((maxN - minN) / spacing) + 1

    return { points, spacing, rows, cols: cols_count }
  }, [])

  const handleFileUpload = useCallback(async (file: File, type: 'existing' | 'design') => {
    try {
      const text = await file.text()
      const surface = parseSurfaceCSV(text)
      if (type === 'existing') setExistingSurface(surface)
      else setDesignSurface(surface)
      setResult(null)
    } catch {
      setError('Failed to parse CSV file')
    }
  }, [parseSurfaceCSV])

  const handleCompute = useCallback(() => {
    if (!existingSurface || !designSurface) return
    setComputing(true)
    setError(null)
    try {
      const res = computeCutFill(existingSurface, designSurface)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Computation failed')
    } finally {
      setComputing(false)
    }
  }, [existingSurface, designSurface])

  const handleExport = useCallback(() => {
    if (!result) return
    const csv = generateCutFillReport(result)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cut-fill-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [result])

  return (
    <div className="space-y-4">
      {/* Surface imports */}
      <div className="grid grid-cols-2 gap-3">
        <SurfaceImportCard
          label="Existing Ground"
          surface={existingSurface}
          onUpload={(file) => handleFileUpload(file, 'existing')}
        />
        <SurfaceImportCard
          label="Design Grade"
          surface={designSurface}
          onUpload={(file) => handleFileUpload(file, 'design')}
        />
      </div>

      {/* Compute button */}
      <button
        onClick={handleCompute}
        disabled={!existingSurface || !designSurface || computing}
        className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:bg-[var(--accent-dim)] disabled:opacity-40"
      >
        {computing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mountain className="w-4 h-4" />}
        {computing ? 'Computing...' : 'Compute Cut & Fill'}
      </button>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-red-400">{error}</div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
              <div className="text-lg font-bold text-red-400">{result.totalCutVolume.toFixed(1)}</div>
              <div className="text-[9px] text-gray-500 uppercase">Cut (m³)</div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
              <div className="text-lg font-bold text-emerald-400">{result.totalFillVolume.toFixed(1)}</div>
              <div className="text-[9px] text-gray-500 uppercase">Fill (m³)</div>
            </div>
            <div className={`p-3 rounded-lg border text-center ${
              result.netVolume < 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/20'
            }`}>
              <div className={`text-lg font-bold ${result.netVolume < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {result.netVolume > 0 ? '+' : ''}{result.netVolume.toFixed(1)}
              </div>
              <div className="text-[9px] text-gray-500 uppercase">Net (m³)</div>
            </div>
          </div>

          {/* Heat map grid */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">Heat Map</span>
              <button
                onClick={handleExport}
                className="flex items-center gap-1 px-2 h-7 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[10px] text-gray-400 hover:text-gray-200"
              >
                <Download className="w-3 h-3" />
                Export CSV
              </button>
            </div>
            <div
              className="grid gap-px overflow-hidden rounded-lg"
              style={{
                gridTemplateColumns: `repeat(${Math.min(result.cells.length, 20)}, 1fr)`,
                maxHeight: '200px',
              }}
            >
              {result.cells.slice(0, 400).map((cell, i) => (
                <div
                  key={`${cell}-${i}`}
                  className="aspect-square"
                  style={{ backgroundColor: getHeatMapColor(cell.deltaZ) }}
                  title={`E:${cell.easting.toFixed(1)} N:${cell.northing.toFixed(1)} ΔZ:${cell.deltaZ.toFixed(2)}m`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 text-[9px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm" /> Cut</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-500 rounded-sm" /> No change</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded-sm" /> Fill</span>
            </div>
          </div>

          {/* Additional stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50">
              <span className="text-gray-500">Cut area:</span> <span className="text-red-400">{result.cutArea.toFixed(0)} m²</span>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50">
              <span className="text-gray-500">Fill area:</span> <span className="text-emerald-400">{result.fillArea.toFixed(0)} m²</span>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50">
              <span className="text-gray-500">Max cut:</span> <span className="text-red-400">{result.maxCutDepth.toFixed(2)} m</span>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50">
              <span className="text-gray-500">Max fill:</span> <span className="text-emerald-400">{result.maxFillDepth.toFixed(2)} m</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SurfaceImportCard({ label, surface, onUpload }: {
  label: string
  surface: GridSurface | null
  onUpload: (file: File) => void
}) {
  return (
    <div className="card p-3">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</div>
      {surface ? (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-[var(--text-primary)]">{surface.points.length} points</div>
            <div className="text-[9px] text-gray-500">Grid: {surface.rows}×{surface.cols} @ {surface.spacing.toFixed(1)}m</div>
          </div>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center h-16 border-2 border-dashed border-[var(--border-color)] rounded-lg cursor-pointer hover:border-[var(--accent)]/30">
          <Upload className="w-4 h-4 text-gray-500 mb-1" />
          <span className="text-[10px] text-gray-500">Upload CSV (E,N,Z)</span>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])}
            className="hidden"
          />
        </label>
      )}
    </div>
  )
}
