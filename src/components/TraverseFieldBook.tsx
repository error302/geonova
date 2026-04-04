'use client'

import { useState, useRef, useCallback } from 'react'
import { computeTraverse, type RawObservation, type TraverseComputationResult } from '@/lib/computations/traverseEngine'
import { parseTraverseCSV } from '@/lib/parsers/totalStation'
import { bearingToString } from '@/lib/engine/angles'

interface TraverseFieldBookProps {
  projectId: string
  onImport?: (data: RawObservation[]) => void
}

function openPrint(html: string, title: string) {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.document.title = title
  setTimeout(() => { win.focus(); win.print() }, 400)
}

export default function TraverseFieldBook({ projectId, onImport }: TraverseFieldBookProps) {
  const [observations, setObservations] = useState<RawObservation[]>([
    { station: '', bs: '', fs: '', hclDeg: '', hclMin: '', hclSec: '', hcrDeg: '', hcrMin: '', hcrSec: '', slopeDist: '', vaDeg: '', vaMin: '', vaSec: '', ih: '1.5', th: '1.5' },
  ])
  const [openingName, setOpeningName] = useState('')
  const [openingE, setOpeningE] = useState('')
  const [openingN, setOpeningN] = useState('')
  const [openingRL, setOpeningRL] = useState('')
  const [bsDeg, setBsDeg] = useState('')
  const [bsMin, setBsMin] = useState('')
  const [bsSec, setBsSec] = useState('')
  const [closingName, setClosingName] = useState('')
  const [closingE, setClosingE] = useState('')
  const [closingN, setClosingN] = useState('')
  const [result, setResult] = useState<TraverseComputationResult | null>(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'input' | 'compute' | 'print'>('input')
  const fileRef = useRef<HTMLInputElement>(null)

  const addRow = () => setObservations(prev => [...prev, {
    station: '', bs: '', fs: '',
    hclDeg: '', hclMin: '', hclSec: '',
    hcrDeg: '', hcrMin: '', hcrSec: '',
    slopeDist: '', vaDeg: '', vaMin: '', vaSec: '', ih: '1.5', th: '1.5',
  }])

  const removeRow = (i: number) => setObservations(prev => prev.filter((_, idx) => idx !== i))

  const updateObs = (i: number, field: keyof RawObservation, value: string) => {
    setObservations(prev => prev.map((o, idx) => idx === i ? { ...o, [field]: value } : o))
  }

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { headers, rows, errors } = parseTraverseCSV(text)
      if (errors.length > 0) { setError(errors.join(', ')); return }
      const stationIdx = headers.findIndex(h => h.includes('station'))
      const sdIdx = headers.findIndex(h => h.includes('slope_dist') || h.includes('_dist') || h === 'sd')
      const hclD = headers.findIndex(h => h.includes('hcl_deg') || h.includes('hcl_d'))
      const hclM = headers.findIndex(h => h.includes('hcl_min') || h.includes('hcl_m'))
      const hclS = headers.findIndex(h => h.includes('hcl_sec') || h.includes('hcl_s'))
      const hcrD = headers.findIndex(h => h.includes('hcr_deg') || h.includes('hcr_d'))
      const hcrM = headers.findIndex(h => h.includes('hcr_min') || h.includes('hcr_m'))
      const hcrS = headers.findIndex(h => h.includes('hcr_sec') || h.includes('hcr_s'))
      const vaD = headers.findIndex(h => h.includes('va_deg') || h.includes('va_d') || h.includes('vert_d'))
      const vaM = headers.findIndex(h => h.includes('va_min') || h.includes('va_m') || h.includes('vert_m'))
      const vaS = headers.findIndex(h => h.includes('va_sec') || h.includes('va_s') || h.includes('vert_s'))
      const ihIdx = headers.findIndex(h => h.includes('ih'))
      const thIdx = headers.findIndex(h => h.includes('th'))
      const imported: RawObservation[] = rows.map((row: any) => ({
        station: stationIdx >= 0 ? row[stationIdx] || '' : '',
        bs: '', fs: '',
        hclDeg: hclD >= 0 ? row[hclD] || '' : '',
        hclMin: hclM >= 0 ? row[hclM] || '' : '',
        hclSec: hclS >= 0 ? row[hclS] || '' : '',
        hcrDeg: hcrD >= 0 ? row[hcrD] || '' : '',
        hcrMin: hcrM >= 0 ? row[hcrM] || '' : '',
        hcrSec: hcrS >= 0 ? row[hcrS] || '' : '',
        slopeDist: sdIdx >= 0 ? row[sdIdx] || '' : '',
        vaDeg: vaD >= 0 ? row[vaD] || '' : '',
        vaMin: vaM >= 0 ? row[vaM] || '' : '',
        vaSec: vaS >= 0 ? row[vaS] || '' : '',
        ih: ihIdx >= 0 ? row[ihIdx] || '1.5' : '1.5',
        th: thIdx >= 0 ? row[thIdx] || '1.5' : '1.5',
      }))
      if (imported.length > 0) { setObservations(imported); onImport?.(imported) }
      else setError('No valid data rows found in CSV')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleCompute = () => {
    setError('')
    if (!openingE || !openingN) { setError('Enter opening point coordinates'); return }
    if (!bsDeg) { setError('Enter backsight bearing'); return }
    const validObs = observations.filter((o: any) => o.station && o.slopeDist)
    if (validObs.length === 0) { setError('At least one valid observation required'); return }
    try {
      const res = computeTraverse({
        openingEasting: parseFloat(openingE),
        openingNorthing: parseFloat(openingN),
        openingRL: openingRL ? parseFloat(openingRL) : undefined,
        openingStation: openingName || 'CP1',
        closingEasting: closingE ? parseFloat(closingE) : undefined,
        closingNorthing: closingN ? parseFloat(closingN) : undefined,
        closingStation: closingName,
        observations: validObs,
        backsightBearingDeg: parseInt(bsDeg) || 0,
        backsightBearingMin: parseInt(bsMin) || 0,
        backsightBearingSec: parseFloat(bsSec) || 0,
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
<html><head><title>Traverse Computation Sheet</title>
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
<div class="header-bar"><strong>METARDU</strong> — Traverse Computation Sheet | Survey Act Cap 299 | RDM 1.1 (2025)</div>

<h1>Table 1 — Field Book Reduction</h1>
<table>
<tr><th>Station</th><th>BS</th><th>FS</th><th>HCL (DMS)</th><th>HCR (DMS)</th><th>Mean Angle</th><th>SD (m)</th><th>VA (DMS)</th><th>HD (m)</th><th>ΔH (m)</th></tr>
${r.rawObservations.map((raw, i) => {
  const red = r.observations[i]
  return `<tr>
<td>${raw.station}</td><td>${raw.bs || '—'}</td><td>${raw.fs || '—'}</td>
<td class="center">${raw.hclDeg || '0'}° ${raw.hclMin || '0'}′ ${raw.hclSec || '0'}″</td>
<td class="center">${raw.hcrDeg || '0'}° ${raw.hcrMin || '0'}′ ${raw.hcrSec || '0'}″</td>
<td class="center">${red?.meanAngleDMS || '—'}</td>
<td class="right">${raw.slopeDist}</td>
<td class="center">${raw.vaDeg || '0'}° ${raw.vaMin || '0'}′ ${raw.vaSec || '0'}″</td>
<td class="right">${red?.horizontalDist.toFixed(3) || '—'}</td>
<td class="right">${red?.deltaH.toFixed(3) || '—'}</td>
</tr>`}).join('\n')}
</table>

<h1>Table 2 — Traverse Computation</h1>
<table>
<tr><th>Line</th><th>WCB</th><th>SD (m)</th><th>HD (m)</th><th>Departure</th><th>Latitude</th><th>Dep Corr.</th><th>Lat Corr.</th><th>Adj Dep</th><th>Adj Lat</th></tr>
${r.legs.map((l: any) => `<tr>
<td>${l.from} → ${l.to}</td>
<td class="center">${l.wcbDMS}</td>
<td class="right">${l.sd.toFixed(3)}</td>
<td class="right">${l.hd.toFixed(3)}</td>
<td class="right">${l.departure >= 0 ? '+' : ''}${l.departure.toFixed(4)}</td>
<td class="right">${l.latitude >= 0 ? '+' : ''}${l.latitude.toFixed(4)}</td>
<td class="right">${l.depCorrection >= 0 ? '+' : ''}${l.depCorrection.toFixed(4)}</td>
<td class="right">${l.latCorrection >= 0 ? '+' : ''}${l.latCorrection.toFixed(4)}</td>
<td class="right">${l.adjDep >= 0 ? '+' : ''}${l.adjDep.toFixed(4)}</td>
<td class="right">${l.adjLat >= 0 ? '+' : ''}${l.adjLat.toFixed(4)}</td>
</tr>`).join('\n')}
<tr style="background:#ddd;font-weight:bold">
<td>Σ</td><td></td><td class="right">${r.totalPerimeter.toFixed(3)}</td><td></td>
<td class="right">${r.sumDepartures >= 0 ? '+' : ''}${r.sumDepartures.toFixed(4)}</td>
<td class="right">${r.sumLatitudes >= 0 ? '+' : ''}${r.sumLatitudes.toFixed(4)}</td>
<td></td><td></td><td></td><td></td>
</tr>
</table>

<h1>Table 3 — Adjusted Coordinate List</h1>
<table>
<tr><th>Point</th><th>Easting (m)</th><th>Northing (m)</th><th>RL (m)</th></tr>
${r.coordinates.map((c: any) => `<tr>
<td>${c.station}</td><td class="right">${c.easting.toFixed(4)}</td><td class="right">${c.northing.toFixed(4)}</td><td class="right">${c.rl?.toFixed(3) ?? '—'}</td>
</tr>`).join('\n')}
</table>

<div class="summary">
<h2>Summary</h2>
<p><strong>Total Perimeter:</strong> ${r.totalPerimeter.toFixed(3)} m</p>
<p><strong>Sum of Departures:</strong> ${r.sumDepartures >= 0 ? '+' : ''}${r.sumDepartures.toFixed(4)} m</p>
<p><strong>Sum of Latitudes:</strong> ${r.sumLatitudes >= 0 ? '+' : ''}${r.sumLatitudes.toFixed(4)} m</p>
<p><strong>Linear Misclosure:</strong> ${r.linearError.toFixed(4)} m</p>
<p><strong>Precision Ratio:</strong> 1 : ${r.precisionRatio > 0 ? Math.round(r.precisionRatio).toLocaleString() : '—'}</p>
<p><strong>Accuracy Order (RDM 1.1):</strong> <span class="${r.C_mm <= r.allowable ? 'pass' : 'fail'}">${r.accuracyOrder}</span></p>
<p><strong>Formula:</strong> ${r.formula}</p>
</div>

<div style="margin-top:20px;font-size:9px;color:#666;text-align:center">
Computed using METARDU | Survey Act Cap 299 | RDM 1.1 (2025) | Generated ${new Date().toLocaleDateString('en-GB')}
</div>
</body></html>`
    openPrint(html, 'Traverse Computation Sheet')
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
        <button onClick={() => fileRef.current?.click()}
          className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded text-xs">
          Import CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCSVImport} />
      </div>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">{error}</div>
      )}

      {activeTab === 'input' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 p-4 bg-[var(--bg-tertiary)]/50 rounded border border-[var(--border-color)]">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Opening Station</label>
              <input value={openingName} onChange={e => setOpeningName(e.target.value)} placeholder="CP1"
                className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Opening Easting (m)</label>
              <input value={openingE} onChange={e => setOpeningE(e.target.value)} type="number" step="0.001"
                className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Opening Northing (m)</label>
              <input value={openingN} onChange={e => setOpeningN(e.target.value)} type="number" step="0.001"
                className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Opening RL (m)</label>
              <input value={openingRL} onChange={e => setOpeningRL(e.target.value)} type="number" step="0.001" placeholder="Optional"
                className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-[var(--text-muted)] mb-1">Backsight Bearing (DMS)</label>
              <div className="flex gap-2">
                <input value={bsDeg} onChange={e => setBsDeg(e.target.value)} type="number" placeholder="Deg" min="0" max="359"
                  className="w-16 px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
                <input value={bsMin} onChange={e => setBsMin(e.target.value)} type="number" placeholder="Min" min="0" max="59"
                  className="w-14 px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
                <input value={bsSec} onChange={e => setBsSec(e.target.value)} type="number" step="0.001" placeholder="Sec"
                  className="flex-1 px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Closing Station (optional)</label>
              <input value={closingName} onChange={e => setClosingName(e.target.value)} placeholder="CP1"
                className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Closing Easting (m)</label>
              <input value={closingE} onChange={e => setClosingE(e.target.value)} type="number" step="0.001" placeholder="Optional"
                className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Closing Northing (m)</label>
              <input value={closingN} onChange={e => setClosingN(e.target.value)} type="number" step="0.001" placeholder="Optional"
                className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                  <th className="px-1.5 py-2 text-left text-[var(--text-secondary)] w-8">#</th>
                  <th className="px-1.5 py-2 text-left text-[var(--text-secondary)]">Station</th>
                  <th className="px-1.5 py-2 text-left text-[var(--text-secondary)]">BS</th>
                  <th className="px-1.5 py-2 text-left text-[var(--text-secondary)]">FS</th>
                  <th className="px-1.5 py-2 text-center text-[var(--text-secondary)]" colSpan={3}>HCL (DMS)</th>
                  <th className="px-1.5 py-2 text-center text-[var(--text-secondary)]" colSpan={3}>HCR (DMS)</th>
                  <th className="px-1.5 py-2 text-right text-[var(--text-secondary)]">Slope Dist (m)</th>
                  <th className="px-1.5 py-2 text-center text-[var(--text-secondary)]" colSpan={3}>VA (DMS)</th>
                  <th className="px-1.5 py-2 text-right text-[var(--text-secondary)]">IH (m)</th>
                  <th className="px-1.5 py-2 text-right text-[var(--text-secondary)]">TH (m)</th>
                  <th className="w-6"></th>
                </tr>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                  <th></th><th></th><th></th><th></th>
                  {[1,2,3,4,5,6,7,8,9].map((i: any) => <th key={i} className="px-1 py-1 text-[10px] text-[var(--text-muted)]">{['','Deg','Min','Sec','','Deg','Min','Sec','','Deg','Min','Sec','',''][i-1]}</th>)}
                </tr>
              </thead>
              <tbody>
                {observations.map((obs, i) => (
                  <tr key={i} className="border-b border-[var(--border-color)]/30">
                    <td className="px-1.5 py-1 text-[var(--text-muted)]">{i + 1}</td>
                    <td className="px-1 py-1"><input value={obs.station} onChange={e => updateObs(i, 'station', e.target.value)}
                      className="w-full px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" placeholder="T1" /></td>
                    <td className="px-1 py-1"><input value={obs.bs} onChange={e => updateObs(i, 'bs', e.target.value)}
                      className="w-12 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" /></td>
                    <td className="px-1 py-1"><input value={obs.fs} onChange={e => updateObs(i, 'fs', e.target.value)}
                      className="w-12 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" /></td>
                    {(['hclDeg','hclMin','hclSec']).map((f: any) => (
                      <td key={f} className="px-0.5 py-1"><input value={(obs as any)[f]} onChange={e => updateObs(i, f as keyof RawObservation, e.target.value)}
                        type="number" className="w-12 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" /></td>
                    ))}
                    <td className="w-3"></td>
                    {(['hcrDeg','hcrMin','hcrSec']).map((f: any) => (
                      <td key={f} className="px-0.5 py-1"><input value={(obs as any)[f]} onChange={e => updateObs(i, f as keyof RawObservation, e.target.value)}
                        type="number" className="w-12 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" /></td>
                    ))}
                    <td className="px-1 py-1"><input value={obs.slopeDist} onChange={e => updateObs(i, 'slopeDist', e.target.value)}
                      type="number" step="0.001" className="w-16 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" /></td>
                    {(['vaDeg','vaMin','vaSec']).map((f: any) => (
                      <td key={f} className="px-0.5 py-1"><input value={(obs as any)[f]} onChange={e => updateObs(i, f as keyof RawObservation, e.target.value)}
                        type="number" className="w-12 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" /></td>
                    ))}
                    <td className="px-1 py-1"><input value={obs.ih} onChange={e => updateObs(i, 'ih', e.target.value)}
                      type="number" step="0.001" className="w-12 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" /></td>
                    <td className="px-1 py-1"><input value={obs.th} onChange={e => updateObs(i, 'th', e.target.value)}
                      type="number" step="0.001" className="w-12 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" /></td>
                    <td><button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-300 text-lg leading-none">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={addRow}
            className="px-3 py-1.5 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-xs">
            + Add Observation Row
          </button>

          <div className="flex justify-end">
            <button onClick={handleCompute}
              className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded text-sm">
              Compute Traverse →
            </button>
          </div>
        </div>
      )}

      {activeTab === 'compute' && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[var(--bg-tertiary)]/50 rounded p-3">
              <p className="text-xs text-[var(--text-secondary)]">Total Perimeter</p>
              <p className="text-lg font-mono text-[var(--text-primary)]">{result.totalPerimeter.toFixed(3)} m</p>
            </div>
            <div className="bg-[var(--bg-tertiary)]/50 rounded p-3">
              <p className="text-xs text-[var(--text-secondary)]">Linear Misclosure</p>
              <p className="text-lg font-mono text-[var(--text-primary)]">{result.linearError.toFixed(4)} m</p>
            </div>
            <div className="bg-[var(--bg-tertiary)]/50 rounded p-3">
              <p className="text-xs text-[var(--text-secondary)]">Precision</p>
              <p className="text-lg font-mono text-[var(--text-primary)]">1 : {result.precisionRatio > 0 ? Math.round(result.precisionRatio).toLocaleString() : '—'}</p>
            </div>
            <div className={`rounded p-3 ${result.C_mm <= result.allowable ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
              <p className="text-xs text-[var(--text-secondary)]">Accuracy Order</p>
              <p className={`text-lg font-semibold ${result.C_mm <= result.allowable ? 'text-green-400' : 'text-red-400'}`}>{result.accuracyOrder}</p>
            </div>
          </div>

          <p className="text-xs text-[var(--text-muted)] font-mono">{result.formula}</p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/50">
                  <th className="px-2 py-2 text-left">Line</th>
                  <th className="px-2 py-2 text-center">WCB</th>
                  <th className="px-2 py-2 text-right">SD (m)</th>
                  <th className="px-2 py-2 text-right">HD (m)</th>
                  <th className="px-2 py-2 text-right">Dep</th>
                  <th className="px-2 py-2 text-right">Lat</th>
                  <th className="px-2 py-2 text-right">Adj Dep</th>
                  <th className="px-2 py-2 text-right">Adj Lat</th>
                  <th className="px-2 py-2 text-right">Easting</th>
                  <th className="px-2 py-2 text-right">Northing</th>
                </tr>
              </thead>
              <tbody>
                {result.legs.map((l, i) => (
                  <tr key={i} className="border-b border-[var(--border-color)]/30">
                    <td className="px-2 py-1.5 font-mono text-[var(--text-primary)]">{l.from} → {l.to}</td>
                    <td className="px-2 py-1.5 text-center font-mono text-[var(--text-secondary)]">{l.wcbDMS}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--text-secondary)]">{l.sd.toFixed(3)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--text-secondary)]">{l.hd.toFixed(3)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--text-secondary)]">{l.departure >= 0 ? '+' : ''}{l.departure.toFixed(4)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--text-secondary)]">{l.latitude >= 0 ? '+' : ''}{l.latitude.toFixed(4)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--accent)]">{l.adjDep >= 0 ? '+' : ''}{l.adjDep.toFixed(4)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--accent)]">{l.adjLat >= 0 ? '+' : ''}{l.adjLat.toFixed(4)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--text-primary)]">{result.coordinates[i + 1]?.easting.toFixed(4)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-[var(--text-primary)]">{result.coordinates[i + 1]?.northing.toFixed(4)}</td>
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
