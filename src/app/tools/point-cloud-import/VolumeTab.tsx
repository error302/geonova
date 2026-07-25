'use client'

/**
 * VolumeTab — Volume computation from point clouds.
 *
 * Wired to src/lib/compute/pointCloudVolume.ts
 *
 * Computes cut/fill volumes between two surfaces using:
 *   - Grid method (IDW interpolation to regular grid)
 *   - TIN-to-TIN method (adaptive cell size)
 *   - Stockpile volume (single surface + base plane)
 *
 * Includes cross-check: grid vs. TIN should agree within 2%.
 */

import { useState, useCallback } from 'react'
import {
  gridMethodVolume,
  tinToTinVolume,
  stockpileVolume,
  crossCheckVolume,
  type Point3D,
  type VolumeResult,
} from '@/lib/compute/pointCloudVolume'
import { Layers, TrendingDown, TrendingUp, ArrowDownToLine, AlertCircle, CheckCircle2 } from 'lucide-react'

interface VolumeTabProps {
  /** Points from the imported point cloud */
  points: Array<{ easting: number; northing: number; elevation: number }>
}

export function VolumeTab({ points }: VolumeTabProps) {
  const [mode, setMode] = useState<'cutfill' | 'stockpile'>('cutfill')
  const [cellSize, setCellSize] = useState(1.0)
  const [baseElevation, setBaseElevation] = useState(0)
  const [result, setResult] = useState<VolumeResult | null>(null)
  const [crossCheck, setCrossCheck] = useState<ReturnType<typeof crossCheckVolume> | null>(null)
  const [loading, setLoading] = useState(false)

  const compute = useCallback(async () => {
    setLoading(true)
    try {
      // Use a small timeout to let the UI update (computation can take a moment for large datasets)
      await new Promise(r => setTimeout(r, 50))

      const pts = points as Point3D[]

      if (mode === 'stockpile') {
        const r = stockpileVolume(pts, baseElevation)
        setResult(r)
        setCrossCheck(null)
      } else {
        // Cut/Fill: we need two surfaces. For a single point cloud,
        // we use the grid method with the imported surface as "surface1"
        // and a flat base plane as "surface2".
        const baseSurface: Point3D[] = pts.map(p => ({ ...p, elevation: baseElevation }))
        const r = gridMethodVolume(pts, baseSurface, cellSize)
        setResult(r)

        // Also compute via TIN method for cross-check
        const cc = crossCheckVolume(pts, baseSurface)
        setCrossCheck(cc)
      }
    } finally {
      setLoading(false)
    }
  }, [points, mode, cellSize, baseElevation])

  if (points.length < 3) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Layers className="w-10 h-10 text-[var(--text-muted)] mb-3 opacity-50" />
        <p className="text-sm text-[var(--text-muted)]">
          Import a point cloud first to compute volumes.
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Need at least 3 points with elevation data.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Mode selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('cutfill')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
            mode === 'cutfill'
              ? 'bg-[var(--accent)] text-black'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
          }`}
        >
          Cut / Fill (vs. Base)
        </button>
        <button
          onClick={() => setMode('stockpile')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
            mode === 'stockpile'
              ? 'bg-[var(--accent)] text-black'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
          }`}
        >
          Stockpile Volume
        </button>
      </div>

      {/* Parameters */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">
            Base Elevation (m)
          </label>
          <input
            type="number"
            step="0.1"
            value={baseElevation}
            onChange={e => setBaseElevation(parseFloat(e.target.value) || 0)}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
          />
        </div>
        {mode === 'cutfill' && (
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">
              Grid Cell Size (m)
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={cellSize}
              onChange={e => setCellSize(parseFloat(e.target.value) || 1)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
        )}
      </div>

      {/* Compute button */}
      <button
        onClick={compute}
        disabled={loading}
        className="w-full py-2.5 bg-[var(--accent)] text-black font-semibold rounded-lg hover:bg-[var(--accent-dim)] disabled:opacity-40 text-sm flex items-center justify-center gap-2"
      >
        {loading ? 'Computing...' : `Compute ${mode === 'cutfill' ? 'Cut/Fill' : 'Stockpile'} Volume`}
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Volume summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
              <TrendingDown className="w-5 h-5 text-red-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-red-400">{result.cut.toFixed(1)}</p>
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Cut (m³)</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
              <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-emerald-400">{result.fill.toFixed(1)}</p>
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Fill (m³)</p>
            </div>
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 text-center">
              <ArrowDownToLine className="w-5 h-5 text-[var(--accent)] mx-auto mb-1" />
              <p className={`text-lg font-bold ${result.net >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {result.net.toFixed(1)}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Net (m³)</p>
            </div>
          </div>

          {/* Method + area */}
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Method: {result.method}</span>
            <span>Area: {(result.area / 10000).toFixed(4)} ha ({result.area.toFixed(1)} m²)</span>
          </div>

          {/* Cross-check result */}
          {crossCheck && (
            <div className={`rounded-xl border p-3 flex items-center gap-3 ${
              crossCheck.agree
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-amber-500/20 bg-amber-500/5'
            }`}>
              {crossCheck.agree
                ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                : <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              }
              <div className="flex-1">
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Cross-check: {crossCheck.agree ? 'Methods agree' : 'Methods disagree'}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Grid: {crossCheck.gridResult.net.toFixed(1)}m³ vs TIN: {crossCheck.tinResult.net.toFixed(1)}m³
                  (diff: {crossCheck.differencePercent.toFixed(2)}%)
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
