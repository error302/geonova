'use client'

import { useState, useCallback } from 'react'
import { Download, AlertCircle, CheckCircle2, X } from 'lucide-react'
import { getAvailableFormats, exportStakeout, type InstrumentFormat } from '@/lib/survey/instrumentWriters'
import { computeSettingOut, type SettingOutResult, type InstrumentStation, type Backsight } from '@/lib/computations/settingOutEngine'
import { extractDesignPointsFromDXF } from '@/lib/survey/dxfDesignExtractor'
import { compareAsBuiltToDesign, type ComparisonReport } from '@/lib/survey/asBuiltComparison'

export default function SettingOutPage() {
  const [dxfContent, setDxfContent] = useState('')
  const [stationE, setStationE] = useState('')
  const [stationN, setStationN] = useState('')
  const [stationRL, setStationRL] = useState('0')
  const [backsightE, setBacksightE] = useState('')
  const [backsightN, setBacksightN] = useState('')
  const [result, setResult] = useState<SettingOutResult | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exportFormat, setExportFormat] = useState<InstrumentFormat>('CSV')
  const [comparison, setComparison] = useState<ComparisonReport | null>(null)
  const [asBuiltInput, setAsBuiltInput] = useState('')

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setDxfContent(reader.result as string)
    reader.readAsText(file)
  }, [])

  const handleImport = async () => {
    if (!dxfContent || !stationE || !stationN || !backsightE || !backsightN) {
      setError('DXF file and station/backsight coordinates are required')
      return
    }
    setLoading(true); setError(''); setResult(null); setWarnings([])
    try {
      // Run the parsing completely on the client (offline-first)
      const extraction = extractDesignPointsFromDXF(dxfContent, { layerFilter: [] })
      if (extraction.points.length === 0) {
        throw new Error('No design points found in DXF')
      }

      const station: InstrumentStation = {
        e: parseFloat(stationE),
        n: parseFloat(stationN),
        rl: parseFloat(stationRL || '0'),
        ih: 1.5,
      }
      const backsight: Backsight = {
        e: parseFloat(backsightE),
        n: parseFloat(backsightN),
      }

      const computedResult = computeSettingOut(station, backsight, extraction.points)
      setResult(computedResult)
      setWarnings(extraction.warnings || [])
    } catch (e) { 
      setError(e instanceof Error ? e.message : 'Failed to process DXF locally') 
    }
    finally { setLoading(false) }
  }

  const handleExport = async () => {
    if (!result) return
    try {
      // Generate export locally
      const exportData = exportStakeout(result, exportFormat, { stationName: 'STN1' })
      const blob = new Blob([exportData.content], { type: exportData.mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = exportData.filename; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { 
      setError(e instanceof Error ? e.message : 'Export failed locally') 
    }
  }

  const handleCompare = () => {
    if (!result) return
    try {
      const asBuiltPoints = asBuiltInput.trim().split('\n').map(line => {
        const cols = line.split(',').map(c => c.trim())
        return { id: cols[0], e: parseFloat(cols[1]), n: parseFloat(cols[2]), rl: parseFloat(cols[3] || '0') }
      }).filter(p => p.id && !isNaN(p.e) && !isNaN(p.n))

      const designPoints = result.rows.map(r => ({
        id: r.id, e: r.designE, n: r.designN, rl: r.designRL, th: r.TH,
      }))

      const report = compareAsBuiltToDesign({ designPoints, asBuiltPoints })
      setComparison(report)
    } catch { setError('Failed to parse as-built CSV. Use: id,easting,northing,rl') }
  }

  const inputCls = "w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none"

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Setting Out</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">Import design from DXF → compute stakeout list → export to instrument → compare as-built</p>

      {/* Step 1: Import DXF */}
      <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">1. Import Design from DXF</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-[var(--text-muted)] block mb-1" htmlFor="dxf-file">DXF File</label>
            <input id="dxf-file" type="file" accept=".dxf" onChange={handleFileUpload}
              className="w-full text-xs text-[var(--text-secondary)]" />
            {dxfContent && <CheckCircle2 className="w-4 h-4 text-green-500 inline ml-2" />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] text-[var(--text-muted)] block mb-1" htmlFor="station-e">Station E</label><input id="station-e" value={stationE} onChange={e => setStationE(e.target.value)} className={inputCls} placeholder="264000" /></div>
            <div><label className="text-[10px] text-[var(--text-muted)] block mb-1" htmlFor="station-n">Station N</label><input id="station-n" value={stationN} onChange={e => setStationN(e.target.value)} className={inputCls} placeholder="9861000" /></div>
            <div><label className="text-[10px] text-[var(--text-muted)] block mb-1" htmlFor="station-rl">Station RL</label><input id="station-rl" value={stationRL} onChange={e => setStationRL(e.target.value)} className={inputCls} /></div>
            <div><label className="text-[10px] text-[var(--text-muted)] block mb-1" htmlFor="ih">IH</label><input id="ih" defaultValue="1.5" className={inputCls} /></div>
            <div><label className="text-[10px] text-[var(--text-muted)] block mb-1" htmlFor="backsight-e">Backsight E</label><input id="backsight-e" value={backsightE} onChange={e => setBacksightE(e.target.value)} className={inputCls} /></div>
            <div><label className="text-[10px] text-[var(--text-muted)] block mb-1" htmlFor="backsight-n">Backsight N</label><input id="backsight-n" value={backsightN} onChange={e => setBacksightN(e.target.value)} className={inputCls} /></div>
          </div>
        </div>
        <button onClick={handleImport} disabled={loading} className="mt-3 px-4 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)] disabled:opacity-50">
          {loading ? 'Computing...' : 'Compute Stakeout List'}
        </button>
      </div>

      {warnings.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4 text-xs text-yellow-400">
          {warnings.map((w, i) => <div key={i} className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {w}</div>)}
        </div>
      )}
      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-xs text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

      {/* Step 2: Stakeout List */}
      {result && (
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">2. Stakeout List ({result.totalPoints} points)</h2>
            <div className="flex gap-2 items-center">
              <select value={exportFormat} onChange={e => setExportFormat(e.target.value as InstrumentFormat)} className={inputCls + ' w-auto'}>
                {getAvailableFormats().map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] text-xs font-semibold rounded-lg hover:bg-[var(--accent)]/25">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                <th className="text-left py-2 px-1">ID</th><th className="text-right">Hz Angle</th><th className="text-right">HD (m)</th><th className="text-right">SD (m)</th><th className="text-right">Design E</th><th className="text-right">Design N</th><th className="text-right">RL</th>
              </tr></thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--border-color)]/30 text-[var(--text-secondary)]">
                    <td className="py-1.5 px-1 font-mono">{row.id}</td>
                    <td className="text-right font-mono">{row.HzAngle}</td>
                    <td className="text-right font-mono">{row.HD.toFixed(3)}</td>
                    <td className="text-right font-mono">{row.SD.toFixed(3)}</td>
                    <td className="text-right font-mono">{row.designE.toFixed(3)}</td>
                    <td className="text-right font-mono">{row.designN.toFixed(3)}</td>
                    <td className="text-right font-mono">{row.designRL.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10px] text-[var(--text-muted)]">BS bearing: {result.bsBearing} | {result.rows.length} points</div>
        </div>
      )}

      {/* Step 3: As-Built Comparison */}
      {result && (
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">3. As-Built Comparison</h2>
          <p className="text-[10px] text-[var(--text-muted)] mb-2">Paste as-built shots (one per line: id,easting,northing,rl)</p>
          <textarea value={asBuiltInput} onChange={e => setAsBuiltInput(e.target.value)} placeholder="P1,264100.010,9861100.005,1500.002" className={inputCls + ' h-20 font-mono mb-2'} />
          <button onClick={handleCompare} className="px-4 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)]">Compare As-Built vs Design</button>

          {comparison && (
            <div className="mt-4">
              <div className={`p-3 rounded-lg mb-3 text-sm font-semibold ${comparison.verdict === 'PASS' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : comparison.verdict === 'FAIL' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                {comparison.summary}
              </div>
              <table className="w-full text-xs">
                <thead><tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                  <th className="text-left py-1">ID</th><th className="text-right">dE (mm)</th><th className="text-right">dN (mm)</th><th className="text-right">dH (mm)</th><th className="text-right">|H| (mm)</th><th className="text-center">Status</th>
                </tr></thead>
                <tbody>
                  {comparison.rows.map((row) => (
                    <tr key={row.designId} className={`border-b border-[var(--border-color)]/30 ${row.passed ? 'text-[var(--text-secondary)]' : 'text-red-400'}`}>
                      <td className="py-1 font-mono">{row.designId}</td>
                      <td className="text-right font-mono">{(row.deltaE * 1000).toFixed(1)}</td>
                      <td className="text-right font-mono">{(row.deltaN * 1000).toFixed(1)}</td>
                      <td className="text-right font-mono">{row.deltaRL !== null ? (row.deltaRL * 1000).toFixed(1) : '—'}</td>
                      <td className="text-right font-mono">{(row.horizontalOffset * 1000).toFixed(1)}</td>
                      <td className="text-center">{row.passed ? <CheckCircle2 className="w-4 h-4 inline text-green-400" /> : <X className="w-4 h-4 inline text-red-400" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
