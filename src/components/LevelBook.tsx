'use client';

import { useState } from 'react'
import { computeLevelBook } from '@/lib/computations/traverseEngine'
import { printLevelBookSheet, type LevelBookPrintInput } from '@/lib/print/levelBookPrint'
import { PrintMetaPanel, defaultPrintMeta, type PrintMeta } from '@/components/shared/PrintMetaPanel'

interface LevelBookProps {
  projectId?: string
}

export default function LevelBook({ projectId: _projectId }: LevelBookProps) {
  const [rows, setRows] = useState<Array<{
    station: string; bs: string; is: string; fs: string; distance: string; remarks: string
  }>>([
    { station: 'BM1', bs: '1.523', is: '', fs: '', distance: '', remarks: 'Benchmark' },
    { station: '1',   bs: '',      is: '', fs: '1.234', distance: '', remarks: '' },
    { station: '2',   bs: '',      is: '1.456', fs: '', distance: '', remarks: 'IS' },
    { station: '3',   bs: '',      is: '', fs: '1.789', distance: '', remarks: '' },
    { station: '4',   bs: '',      is: '1.234', fs: '', distance: '', remarks: 'IS' },
    { station: '5',   bs: '',      is: '', fs: '1.567', distance: '', remarks: '' },
  ])
  const [openingRL,   setOpeningRL]   = useState('100.000')
  const [closingRL,   setClosingRL]   = useState('')
  const [distanceKm,  setDistanceKm]  = useState('0.5')
  const [method,      setMethod]      = useState<'rise_and_fall' | 'height_of_collimation'>('rise_and_fall')
  const [result,      setResult]      = useState<ReturnType<typeof computeLevelBook> | null>(null)
  const [error,       setError]       = useState('')
  const [activeTab,   setActiveTab]   = useState<'input' | 'compute' | 'print'>('input')
  const [printMeta,   setPrintMeta]   = useState<PrintMeta>(defaultPrintMeta)

  const addRow = () => setRows(prev => [
    ...prev,
    { station: String(prev.length + 1), bs: '', is: '', fs: '', distance: '', remarks: '' }
  ])

  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i))

  const updateRow = (i: number, field: string, value: string) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))

  const handleCompute = () => {
    setError('')
    if (!openingRL) { setError('Enter opening benchmark RL'); return }
    const obsRows = rows.map(r => ({
      station:  r.station,
      bs:       r.bs       ? parseFloat(r.bs)       : undefined,
      is:       r.is       ? parseFloat(r.is)        : undefined,
      fs:       r.fs       ? parseFloat(r.fs)        : undefined,
      distance: r.distance ? parseFloat(r.distance)  : undefined,
      remarks:  r.remarks,
    }))
    try {
      const res = computeLevelBook({
        openingRL:  parseFloat(openingRL),
        closingRL:  closingRL ? parseFloat(closingRL) : undefined,
        distanceKm: parseFloat(distanceKm) || 0.5,
        method,
        rows: obsRows,
      })
      setResult(res)
      setActiveTab('compute')
    } catch (err: unknown) {
      setError((err as Error).message || 'Computation failed')
    }
  }

  const handlePrint = () => {
    if (!result) return
    const inp: LevelBookPrintInput = {
      result,
      meta: { ...printMeta, title: `Level Book — ${method === 'rise_and_fall' ? 'Rise & Fall' : 'Height of Collimation'}` }
    }
    printLevelBookSheet(inp)
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Tabs + Method switch */}
      <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-2 flex-wrap">
        {(['input', 'compute', 'print'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'bg-[var(--accent)] text-black'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-hover)]'
            }`}>
            {tab === 'input' ? 'Field Book' : tab === 'compute' ? 'Results' : 'Print'}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => { setMethod('rise_and_fall'); setResult(null) }}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            method === 'rise_and_fall'
              ? 'bg-[var(--accent)] text-black'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
          }`}>
          Rise &amp; Fall
        </button>
        <button
          onClick={() => { setMethod('height_of_collimation'); setResult(null) }}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            method === 'height_of_collimation'
              ? 'bg-[var(--accent)] text-black'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
          }`}>
          Height of Collimation
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">{error}</div>
      )}

      {/* ── INPUT TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'input' && (
        <div className="space-y-4">
          {/* Setup fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 md:p-4 bg-[color-mix(in_srgb,var(--bg-tertiary)_50%,transparent)] rounded border border-[var(--border-color)]">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="opening-bm-rl-m">Opening BM RL (m)</label>
              <input id="opening-bm-rl-m" aria-label="Opening BM RL (m)" value={openingRL} onChange={e => setOpeningRL(e.target.value)}
                type="number" step="0.001"
                className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="closing-bm-rl-m">Closing BM RL (m)</label>
              <input id="closing-bm-rl-m" value={closingRL} onChange={e => setClosingRL(e.target.value)}
                type="number" step="0.001" placeholder="Optional"
                className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="total-distance-km">Total Distance (km)</label>
              <input  id="total-distance-km" aria-label="Total Distance (km)" value={distanceKm} onChange={e => setDistanceKm(e.target.value)}
                type="number" step="0.001"
                className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
            </div>
          </div>

          {/* Field book table */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="min-w-[700px] w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-tertiary)_30%,transparent)]">
                  <th className="px-1.5 py-2 text-left text-[var(--text-muted)] w-8">#</th>
                  <th className="px-1.5 py-2 text-left text-[var(--text-secondary)]">Station</th>
                  <th className="px-1.5 py-2 text-right text-[var(--text-secondary)]">BS</th>
                  <th className="px-1.5 py-2 text-right text-[var(--text-secondary)]">IS</th>
                  <th className="px-1.5 py-2 text-right text-[var(--text-secondary)]">FS</th>
                  <th className="px-1.5 py-2 text-right text-[var(--text-secondary)]">Dist (m)</th>
                  <th className="px-1.5 py-2 text-left text-[var(--text-secondary)]">Remarks</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.station} className="border-b border-[color-mix(in_srgb,var(--border-color)_30%,transparent)]">
                    <td className="px-1.5 py-1 text-[var(--text-muted)]">{i + 1}</td>
                    <td className="px-1 py-1">
                      <input value={row.station} onChange={e => updateRow(i, 'station', e.target.value)}
                        aria-label="Station" placeholder="BM1"
                        className="w-full px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" />
                    </td>
                    <td className="px-1 py-1">
                      <input value={row.bs} onChange={e => updateRow(i, 'bs', e.target.value)}
                        type="number" step="0.001" aria-label="Backsight (m)" placeholder="0.000"
                        className="w-16 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" />
                    </td>
                    <td className="px-1 py-1">
                      <input value={row.is} onChange={e => updateRow(i, 'is', e.target.value)}
                        type="number" step="0.001" aria-label="Intermediate sight (m)" placeholder="0.000"
                        className="w-16 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" />
                    </td>
                    <td className="px-1 py-1">
                      <input value={row.fs} onChange={e => updateRow(i, 'fs', e.target.value)}
                        type="number" step="0.001" aria-label="Foresight (m)" placeholder="0.000"
                        className="w-16 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" />
                    </td>
                    <td className="px-1 py-1">
                      <input value={row.distance} onChange={e => updateRow(i, 'distance', e.target.value)}
                        type="number" step="0.01" aria-label="Distance (m)" placeholder="0.00"
                        className="w-16 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" />
                    </td>
                    <td className="px-1 py-1">
                      <input value={row.remarks} onChange={e => updateRow(i, 'remarks', e.target.value)}
                        aria-label="Remarks" placeholder="IS / BM / CP"
                        className="w-full px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" />
                    </td>
                    <td>
                      <button onClick={() => removeRow(i)}
                        className="text-red-400 hover:text-red-300 text-lg leading-none px-1">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={addRow}
            className="px-3 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-xs">
            + Add Row
          </button>

          <div className="flex justify-end">
            <button onClick={handleCompute}
              className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded text-sm">
              Compute Level Book →
            </button>
          </div>
        </div>
      )}

      {/* ── RESULTS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'compute' && result && (
        <div className="space-y-4">

          {/* Closure summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[color-mix(in_srgb,var(--bg-tertiary)_50%,transparent)] rounded p-3">
              <p className="text-xs text-[var(--text-secondary)]">ΣBS</p>
              <p className="text-lg font-mono">{result.sumBS.toFixed(3)} m</p>
            </div>
            <div className="bg-[color-mix(in_srgb,var(--bg-tertiary)_50%,transparent)] rounded p-3">
              <p className="text-xs text-[var(--text-secondary)]">ΣFS</p>
              <p className="text-lg font-mono">{result.sumFS.toFixed(3)} m</p>
            </div>
            <div className={`rounded p-3 ${result.arithmeticPass ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
              <p className="text-xs text-[var(--text-secondary)]">Arithmetic Check</p>
              <p className={`text-lg font-semibold ${result.arithmeticPass ? 'text-green-400' : 'text-red-400'}`}>
                {result.arithmeticPass ? 'PASS' : 'FAIL'}
              </p>
            </div>
            <div className={`rounded p-3 ${result.isAcceptable ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
              <p className="text-xs text-[var(--text-secondary)]">Closure (10√K mm)</p>
              <p className={`text-lg font-semibold ${result.isAcceptable ? 'text-green-400' : 'text-red-400'}`}>
                {result.isAcceptable ? 'OK' : 'FAIL'}
              </p>
            </div>
          </div>

          <p className="text-xs text-[var(--text-muted)] font-mono">{result.formula}</p>

          {/* Results table — HPC not HI */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-tertiary)_50%,transparent)]">
                  <th className="px-2 py-2 text-left">Station</th>
                  <th className="px-2 py-2 text-right">BS</th>
                  <th className="px-2 py-2 text-right">IS</th>
                  <th className="px-2 py-2 text-right">FS</th>
                  {/* HPC = Height of Plane of Collimation — British/East African convention */}
                  <th className="px-2 py-2 text-right">HPC (m)</th>
                  {method === 'rise_and_fall' && <th className="px-2 py-2 text-right">Rise</th>}
                  {method === 'rise_and_fall' && <th className="px-2 py-2 text-right">Fall</th>}
                  <th className="px-2 py-2 text-right">RL (m)</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={`item-${i}`} className="border-b border-[color-mix(in_srgb,var(--border-color)_30%,transparent)]">
                    <td className="px-2 py-1.5 font-mono">{row.station}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--text-secondary)]">
                      {row.bs !== undefined ? row.bs.toFixed(3) : ''}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--text-secondary)]">
                      {row.is !== undefined ? row.is.toFixed(3) : ''}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--text-secondary)]">
                      {row.fs !== undefined ? row.fs.toFixed(3) : ''}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--text-secondary)]">
                      {/* row.hi is the data property (Height of Collimation value); displayed as HPC */}
                      {row.hi !== undefined ? row.hi.toFixed(3) : ''}
                    </td>
                    {method === 'rise_and_fall' && (
                      <td className="px-2 py-1.5 text-right font-mono text-green-400">
                        {row.rise !== undefined ? row.rise.toFixed(3) : ''}
                      </td>
                    )}
                    {method === 'rise_and_fall' && (
                      <td className="px-2 py-1.5 text-right font-mono text-red-400">
                        {row.fall !== undefined ? row.fall.toFixed(3) : ''}
                      </td>
                    )}
                    <td className="px-2 py-1.5 text-right font-mono font-bold text-[var(--accent)]">
                      {row.rl !== undefined ? row.rl.toFixed(3) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setActiveTab('input')}
              className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm">
              ← Back to Input
            </button>
            <button onClick={() => setActiveTab('print')}
              className="px-5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded text-sm">
              Print Sheet →
            </button>
          </div>
        </div>
      )}

      {/* ── PRINT TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'print' && (
        <div className="space-y-4">
          {!result && (
            <div className="p-4 bg-amber-900/20 border border-amber-700 rounded text-amber-300 text-sm">
              Compute the level book first (Field Book tab) before printing.
            </div>
          )}

          <PrintMetaPanel meta={printMeta} onChange={setPrintMeta} />

          <div className="p-4 bg-[color-mix(in_srgb,var(--bg-tertiary)_50%,transparent)] rounded border border-[var(--border-color)] text-sm space-y-1.5">
            <p className="font-semibold text-[var(--text-primary)]">The printed sheet will include:</p>
            <ul className="text-[var(--text-muted)] text-xs space-y-0.5 list-disc list-inside">
              <li>Standard 6-field document header (project · client · date · surveyor · reg/ISK · instrument)</li>
              <li>Table 1 — Field Observations (Station, BS, IS, FS, HPC, Rise, Fall, RL, Dist, Remarks)</li>
              <li>Table 2 — Arithmetic Checks &amp; Closure (ΣBS, ΣFS, ΣRise, ΣFall, 10√K misclosure)</li>
              <li>Surveyor&apos;s Certificate block — Survey Regulations 1994, Regulation 3(2)</li>
            </ul>
            <p className="text-xs text-[var(--text-muted)] font-mono mt-2">
              HPC = Height of Plane of Collimation (British/East African convention)
            </p>
          </div>

          <button
            onClick={handlePrint}
            disabled={!result}
            className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-dim)] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded text-sm">
            Print Level Book Computation Sheet
          </button>
        </div>
      )}
    </div>
  )
}
