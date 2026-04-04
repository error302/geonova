'use client'

import { useState } from 'react'
import { computeLevelBook, type LevelBookRow } from '@/lib/computations/traverseEngine'

interface LevelBookProps {
  projectId?: string
}

function openPrint(html: string, title: string) {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.document.title = title
  setTimeout(() => { win.focus(); win.print() }, 400)
}

export default function LevelBook({ projectId }: LevelBookProps) {
  const [rows, setRows] = useState<Array<{ station: string; bs: string; is: string; fs: string; distance: string; remarks: string }>>([
    { station: 'BM1', bs: '1.523', is: '', fs: '', distance: '', remarks: 'Benchmark' },
    { station: '1', bs: '', is: '', fs: '1.234', distance: '', remarks: '' },
    { station: '2', bs: '', is: '1.456', fs: '', distance: '', remarks: 'IS' },
    { station: '3', bs: '', is: '', fs: '1.789', distance: '', remarks: '' },
    { station: '4', bs: '', is: '1.234', fs: '', distance: '', remarks: 'IS' },
    { station: '5', bs: '', is: '', fs: '1.567', distance: '', remarks: '' },
  ])
  const [openingRL, setOpeningRL] = useState('100.000')
  const [closingRL, setClosingRL] = useState('')
  const [closingBM, setClosingBM] = useState('')
  const [distanceKm, setDistanceKm] = useState('0.5')
  const [method, setMethod] = useState<'rise_and_fall' | 'height_of_collimation'>('rise_and_fall')
  const [result, setResult] = useState<ReturnType<typeof computeLevelBook> | null>(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'input' | 'compute' | 'print'>('input')

  const addRow = () => setRows(prev => [...prev, { station: String(prev.length + 1), bs: '', is: '', fs: '', distance: '', remarks: '' }])

  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i))

  const updateRow = (i: number, field: string, value: string) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  const handleCompute = () => {
    setError('')
    if (!openingRL) { setError('Enter opening benchmark RL'); return }
    const obsRows = rows.map((r: any) => ({
      station: r.station,
      bs: r.bs ? parseFloat(r.bs) : undefined,
      is: r.is ? parseFloat(r.is) : undefined,
      fs: r.fs ? parseFloat(r.fs) : undefined,
      distance: r.distance ? parseFloat(r.distance) : undefined,
      remarks: r.remarks,
    }))
    try {
      const res = computeLevelBook({
        openingRL: parseFloat(openingRL),
        closingRL: closingRL ? parseFloat(closingRL) : undefined,
        distanceKm: parseFloat(distanceKm) || 0.5,
        method,
        rows: obsRows,
      })
      setResult(res)
      setActiveTab('compute')
    } catch (err: any) {
      setError(err.message || 'Computation failed')
    }
  }

  const handlePrint = () => {
    if (!result) return
    const r = result
    const html = `
<html><head><title>Level Book Computation</title>
<style>
  body { font-family: 'Courier New', monospace; font-size: 11px; margin: 20px; color: #000; }
  h1 { font-size: 16px; border-bottom: 2px solid #000; padding-bottom: 4px; }
  h2 { font-size: 13px; margin-top: 16px; border-bottom: 1px solid #ccc; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px; }
  th { background: #333; color: #fff; padding: 4px 6px; text-align: left; }
  td { padding: 4px 6px; border: 1px solid #ccc; }
  tr:nth-child(even) { background: #f5f5f5; }
  .header-bar { background: #333; color: #fff; padding: 8px 12px; margin-bottom: 16px; }
  .summary { background: #f0f0f0; border: 1px solid #333; padding: 12px; margin-top: 12px; }
  .pass { color: green; font-weight: bold; } .fail { color: red; font-weight: bold; }
  .right { text-align: right; } .center { text-align: center; }
  @media print { body { margin: 10px; } }
</style></head><body>
<div class="header-bar"><strong>METARDU</strong> — Level Book | Survey Act Cap 299 | RDM 1.1 (2025)</div>

<h1>Table 1 — Field Book</h1>
<table>
<tr><th>Station</th><th>BS (m)</th><th>IS (m)</th><th>FS (m)</th><th>HI (m)</th><th>Rise (m)</th><th>Fall (m)</th><th>RL (m)</th><th>Dist (m)</th><th>Remarks</th></tr>
${r.rows.map((row: any) => `<tr>
<td>${row.station}</td>
<td class="right">${row.bs !== undefined ? row.bs.toFixed(3) : ''}</td>
<td class="right">${row.is !== undefined ? row.is.toFixed(3) : ''}</td>
<td class="right">${row.fs !== undefined ? row.fs.toFixed(3) : ''}</td>
<td class="right">${row.hi !== undefined ? row.hi.toFixed(3) : ''}</td>
<td class="right">${row.rise !== undefined ? row.rise.toFixed(3) : ''}</td>
<td class="right">${row.fall !== undefined ? row.fall.toFixed(3) : ''}</td>
<td class="right">${row.rl !== undefined ? row.rl.toFixed(3) : ''}</td>
<td class="right">${row.distance !== undefined ? row.distance.toFixed(2) : ''}</td>
<td>${row.remarks || ''}</td>
</tr>`).join('\n')}
</table>

<div class="summary">
<h2>Summary — ${method === 'rise_and_fall' ? 'Rise & Fall' : 'Height of Collimation'}</h2>
<p><strong>Method:</strong> ${method === 'rise_and_fall' ? 'Rise & Fall' : 'Height of Collimation'}</p>
<p><strong>ΣBS:</strong> ${r.sumBS.toFixed(3)} m | <strong>ΣFS:</strong> ${r.sumFS.toFixed(3)} m</p>
${method === 'rise_and_fall' ? `<p><strong>ΣRise:</strong> ${r.sumRise.toFixed(3)} m | <strong>ΣFall:</strong> ${r.sumFall.toFixed(3)} m</p>` : ''}
<p><strong>Arithmetic Check:</strong> <span class="${r.arithmeticPass ? 'pass' : 'fail'}">${r.arithmeticPass ? 'PASS' : 'FAIL'} (${r.arithmeticCheck.toFixed(6)} m)</span></p>
<p><strong>Misclosure:</strong> ${r.misclosure > 0 ? r.misclosure.toFixed(6) : '—'} m</p>
<p><strong>Allowable (10√K):</strong> ${r.allowableMisclosure.toFixed(3)} m</p>
<p><strong>Acceptable:</strong> <span class="${r.isAcceptable ? 'pass' : 'fail'}">${r.isAcceptable ? 'YES' : 'NO'}</span></p>
<p><strong>Formula:</strong> ${r.formula}</p>
</div>

<div style="margin-top:20px;font-size:9px;color:#666;text-align:center">
Computed using METARDU | Survey Act Cap 299 | RDM 1.1 (2025) | Generated ${new Date().toLocaleDateString('en-GB')}
</div>
</body></html>`
    openPrint(html, 'Level Book Computation')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-2">
        {(['input', 'compute', 'print'] as const).map((tab: any) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors ${
              activeTab === tab ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-hover)]'
            }`}>
            {tab === 'input' ? 'Field Book' : tab === 'compute' ? 'Results' : 'Print'}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex gap-1">
          <button onClick={() => { setMethod('rise_and_fall'); setResult(null); }}
            className={`px-3 py-1.5 rounded text-xs font-medium ${method === 'rise_and_fall' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}`}>
            Rise & Fall
          </button>
          <button onClick={() => { setMethod('height_of_collimation'); setResult(null); }}
            className={`px-3 py-1.5 rounded text-xs font-medium ${method === 'height_of_collimation' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}`}>
            HOC
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">{error}</div>
      )}

      {activeTab === 'input' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 md:p-4 bg-[var(--bg-tertiary)]/50 rounded border border-[var(--border-color)]">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Opening BM RL (m)</label>
              <input value={openingRL} onChange={e => setOpeningRL(e.target.value)} type="number" step="0.001"
                className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Closing BM RL (m)</label>
              <input value={closingRL} onChange={e => setClosingRL(e.target.value)} type="number" step="0.001" placeholder="Optional"
                className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Total Distance (km)</label>
              <input value={distanceKm} onChange={e => setDistanceKm(e.target.value)} type="number" step="0.001"
                className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[700px] w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                  <th className="px-1.5 py-2 text-left text-[var(--text-secondary)] w-8">#</th>
                  <th className="px-1.5 py-2 text-left text-[var(--text-secondary)]">Station</th>
                  <th className="px-1.5 py-2 text-right text-[var(--text-secondary)]">BS</th>
                  <th className="px-1.5 py-2 text-right text-[var(--text-secondary)]">IS</th>
                  <th className="px-1.5 py-2 text-right text-[var(--text-secondary)]">FS</th>
                  <th className="px-1.5 py-2 text-right text-[var(--text-secondary)]">Dist</th>
                  <th className="px-1.5 py-2 text-left text-[var(--text-secondary)]">Remarks</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-[var(--border-color)]/30">
                    <td className="px-1.5 py-1 text-[var(--text-muted)]">{i + 1}</td>
                    <td className="px-1 py-1"><input value={row.station} onChange={e => updateRow(i, 'station', e.target.value)}
                      className="w-full px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" placeholder="BM1" /></td>
                    <td className="px-1 py-1"><input value={row.bs} onChange={e => updateRow(i, 'bs', e.target.value)}
                      type="number" step="0.001" placeholder="0.000"
                      className="w-12 md:w-16 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" /></td>
                    <td className="px-1 py-1"><input value={row.is} onChange={e => updateRow(i, 'is', e.target.value)}
                      type="number" step="0.001" placeholder="0.000"
                      className="w-12 md:w-16 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" /></td>
                    <td className="px-1 py-1"><input value={row.fs} onChange={e => updateRow(i, 'fs', e.target.value)}
                      type="number" step="0.001" placeholder="0.000"
                      className="w-12 md:w-16 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" /></td>
                    <td className="px-1 py-1"><input value={row.distance} onChange={e => updateRow(i, 'distance', e.target.value)}
                      type="number" step="0.01" placeholder="0.00"
                      className="w-12 md:w-16 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" /></td>
                    <td className="px-1 py-1"><input value={row.remarks} onChange={e => updateRow(i, 'remarks', e.target.value)}
                      className="w-full px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" placeholder="IS / BM" /></td>
                    <td><button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-300 text-lg leading-none">×</button></td>
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

      {activeTab === 'compute' && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[var(--bg-tertiary)]/50 rounded p-3">
              <p className="text-xs text-[var(--text-secondary)]">ΣBS</p>
              <p className="text-lg font-mono text-[var(--text-primary)]">{result.sumBS.toFixed(3)} m</p>
            </div>
            <div className="bg-[var(--bg-tertiary)]/50 rounded p-3">
              <p className="text-xs text-[var(--text-secondary)]">ΣFS</p>
              <p className="text-lg font-mono text-[var(--text-primary)]">{result.sumFS.toFixed(3)} m</p>
            </div>
            <div className={`rounded p-3 ${result.arithmeticPass ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
              <p className="text-xs text-[var(--text-secondary)]">Arithmetic Check</p>
              <p className={`text-lg font-semibold ${result.arithmeticPass ? 'text-green-400' : 'text-red-400'}`}>
                {result.arithmeticPass ? 'PASS' : 'FAIL'}
              </p>
            </div>
            <div className={`rounded p-3 ${result.isAcceptable ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
              <p className="text-xs text-[var(--text-secondary)]">Misclosure</p>
              <p className={`text-lg font-semibold ${result.isAcceptable ? 'text-green-400' : 'text-red-400'}`}>
                {result.misclosure > 0 ? `${result.misclosure.toFixed(4)} m` : '—'}
              </p>
            </div>
          </div>

          <p className="text-xs text-[var(--text-muted)] font-mono">{result.formula}</p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/50">
                  <th className="px-2 py-2 text-left">Station</th>
                  <th className="px-2 py-2 text-right">BS</th>
                  <th className="px-2 py-2 text-right">IS</th>
                  <th className="px-2 py-2 text-right">FS</th>
                  <th className="px-2 py-2 text-right">HI</th>
                  {method === 'rise_and_fall' && <th className="px-2 py-2 text-right">Rise</th>}
                  {method === 'rise_and_fall' && <th className="px-2 py-2 text-right">Fall</th>}
                  <th className="px-2 py-2 text-right">RL</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className="border-b border-[var(--border-color)]/30">
                    <td className="px-2 py-1.5 font-mono text-[var(--text-primary)]">{row.station}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--text-secondary)]">{row.bs !== undefined ? row.bs.toFixed(3) : ''}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--text-secondary)]">{row.is !== undefined ? row.is.toFixed(3) : ''}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--text-secondary)]">{row.fs !== undefined ? row.fs.toFixed(3) : ''}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--text-secondary)]">{row.hi !== undefined ? row.hi.toFixed(3) : ''}</td>
                    {method === 'rise_and_fall' && <td className="px-2 py-1.5 text-right font-mono text-[var(--text-secondary)]">{row.rise !== undefined ? row.rise.toFixed(3) : ''}</td>}
                    {method === 'rise_and_fall' && <td className="px-2 py-1.5 text-right font-mono text-[var(--text-secondary)]">{row.fall !== undefined ? row.fall.toFixed(3) : ''}</td>}
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--accent)]">{row.rl !== undefined ? row.rl.toFixed(3) : ''}</td>
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
            <button onClick={handlePrint}
              className="px-5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded text-sm">
              Print Computation Sheet
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
