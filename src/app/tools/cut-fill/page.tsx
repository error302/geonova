'use client'

import { useState } from 'react'
import { Layers, AlertCircle, Download } from 'lucide-react'
import { buildTIN, computeCutFill, computeStockpileVolume, type SurfacePoint, type CutFillResult } from '@/lib/survey/surfaceTIN'
import { CutFillHeatMap } from '@/components/tools/CutFillHeatMap'
import { ComputeLimitNotice } from '@/components/tools/ComputeLimitNotice'

export default function CutFillPage() {
  const [mode, setMode] = useState<'cut_fill' | 'stockpile'>('cut_fill')
  const [designInput, setDesignInput] = useState('')
  const [groundInput, setGroundInput] = useState('')
  const [surfaceInput, setSurfaceInput] = useState('')
  const [datumRL, setDatumRL] = useState('0')
  const [gridSpacing, setGridSpacing] = useState('5')
  const [result, setResult] = useState<CutFillResult | ReturnType<typeof computeStockpileVolume> | null>(null)
  const [error, setError] = useState('')

  const parsePoints = (text: string): SurfacePoint[] => {
    return text.trim().split('\n').map(line => {
      const cols = line.split(',').map(c => parseFloat(c.trim()))
      return { x: cols[0], y: cols[1], z: cols[2] }
    }).filter(p => !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.z))
  }

  const handleCompute = () => {
    setError(''); setResult(null)
    try {
      const spacing = parseFloat(gridSpacing)
      if (mode === 'cut_fill') {
        const designPoints = parsePoints(designInput)
        const groundPoints = parsePoints(groundInput)
        if (designPoints.length < 3 || groundPoints.length < 3) { setError('Need ≥3 points for each surface'); return }
        const designTIN = buildTIN(designPoints)
        const groundTIN = buildTIN(groundPoints)
        setResult(computeCutFill(designTIN, groundTIN, spacing))
      } else {
        const surfacePoints = parsePoints(surfaceInput)
        if (surfacePoints.length < 3) { setError('Need ≥3 surface points'); return }
        const tin = buildTIN(surfacePoints)
        setResult(computeStockpileVolume(tin, parseFloat(datumRL), spacing))
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
  }

  const inputCls = "w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] focus:border-[var(--accent)]/30 focus:outline-none"

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Cut & Fill Volumes</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">TIN-based earthworks — handles irregular surfaces (stockpiles, borrow pits, complex interchanges)</p>

      <ComputeLimitNotice
        tool="Cut & fill volumes"
        message="The web tool computes a fixed grid TIN for quick estimates. For large earthworks projects, dense TINs, or mass-haul runs, the METARDU desktop app computes everything locally — no size limits, no uploads."
      />

      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode('cut_fill')} className={`px-4 py-2 text-xs font-semibold rounded-lg ${mode === 'cut_fill' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}`}>Cut/Fill (Design vs Ground)</button>
        <button onClick={() => setMode('stockpile')} className={`px-4 py-2 text-xs font-semibold rounded-lg ${mode === 'stockpile' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}`}>Stockpile / Borrow Pit</button>
      </div>

      {mode === 'cut_fill' ? (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-2">Design Surface (Easting, Northing, RL)</h2>
            <textarea value={designInput} onChange={e => setDesignInput(e.target.value)} className={inputCls + ' h-40 font-mono'} placeholder="0,0,10&#10;100,0,10&#10;0,100,10&#10;100,100,10" />
          </div>
          <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-2">Ground Surface (Easting, Northing, RL)</h2>
            <textarea value={groundInput} onChange={e => setGroundInput(e.target.value)} className={inputCls + ' h-40 font-mono'} placeholder="0,0,12&#10;100,0,12&#10;0,100,12&#10;100,100,12" />
          </div>
        </div>
      ) : (
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold mb-2">Surface Points (Easting, Northing, RL)</h2>
          <textarea value={surfaceInput} onChange={e => setSurfaceInput(e.target.value)} className={inputCls + ' h-40 font-mono'} placeholder="0,0,12&#10;100,0,12&#10;0,100,12&#10;100,100,12" />
          <div className="mt-2"><label className="text-[10px] text-[var(--text-muted)] block mb-1">Datum RL (reference level)</label><input value={datumRL} onChange={e => setDatumRL(e.target.value)} className={inputCls + ' w-32'} /></div>
        </div>
      )}

      <div className="flex gap-4 items-end mb-4">
        <div><label className="text-[10px] text-[var(--text-muted)] block mb-1">Grid Spacing (m)</label><input value={gridSpacing} onChange={e => setGridSpacing(e.target.value)} className={inputCls + ' w-32'} /></div>
        <button onClick={handleCompute} className="px-4 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)]">Compute Volume</button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-xs text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

      {result && (
        <>
          <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Layers className="w-4 h-4" /> Volume Results</h2>
              <button
                onClick={() => {
                  const json = JSON.stringify(result, null, 2)
                  const blob = new Blob([json], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `metardu-${mode}-${Date.now()}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="text-[10px] px-2 py-1 rounded-md border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)] flex items-center gap-1"
              >
                <Download className="w-3 h-3" /> Export JSON
              </button>
            </div>
            {'cutVolume' in result ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-red-500/10 rounded-lg"><div className="text-2xl font-bold text-red-400">{result.cutVolume.toFixed(1)}</div><div className="text-[10px] text-[var(--text-muted)]">CUT (m³)</div></div>
                <div className="text-center p-3 bg-blue-500/10 rounded-lg"><div className="text-2xl font-bold text-blue-400">{result.fillVolume.toFixed(1)}</div><div className="text-[10px] text-[var(--text-muted)]">FILL (m³)</div></div>
                <div className="text-center p-3 bg-[var(--accent)]/10 rounded-lg"><div className="text-2xl font-bold text-[var(--accent)]">{result.netVolume > 0 ? '+' : ''}{result.netVolume.toFixed(1)}</div><div className="text-[10px] text-[var(--text-muted)]">NET ({result.netVolume > 0 ? 'CUT' : 'FILL'}) m³</div></div>
                <div className="col-span-3 grid grid-cols-3 gap-2 text-xs text-[var(--text-muted)]">
                  <div>Area: {result.area.toFixed(1)} m²</div>
                  <div>Cells: {result.cellCount}</div>
                  <div>Avg Cut: {result.avgCutDepth.toFixed(3)}m / Avg Fill: {result.avgFillDepth.toFixed(3)}m</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-[var(--accent)]/10 rounded-lg"><div className="text-2xl font-bold text-[var(--accent)]">{result.volume.toFixed(1)}</div><div className="text-[10px] text-[var(--text-muted)]">VOLUME (m³)</div></div>
                <div className="text-center p-3 bg-[var(--bg-tertiary)] rounded-lg"><div className="text-2xl font-bold text-[var(--text-primary)]">{result.area.toFixed(1)}</div><div className="text-[10px] text-[var(--text-muted)]">AREA (m²)</div></div>
                <div className="text-center p-3 bg-[var(--bg-tertiary)] rounded-lg"><div className="text-2xl font-bold text-[var(--text-primary)]">{result.avgHeight.toFixed(3)}</div><div className="text-[10px] text-[var(--text-muted)]">AVG HEIGHT (m)</div></div>
              </div>
            )}
          </div>

          {'cutVolume' in result && result.cells.length > 0 && (
            <CutFillHeatMap cells={result.cells} gridSpacing={result.gridSpacing} />
          )}
        </>
      )}
    </div>
  )
}
