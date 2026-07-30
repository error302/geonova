'use client'

import { useState, useMemo, useCallback } from 'react'
import { Mountain, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Layers, Search } from 'lucide-react'
import { KENYA_TOPO_CODES } from '@/lib/topo/featureCodes'

interface TopoPoint {
  pointNumber: string; easting: number; northing: number; rl: number
  code: string; description: string
}

interface BreaklineInput {
  points: Array<{ x: number; y: number; z: number }>
  type: 'hard' | 'soft' | 'ridge' | 'valley'
}

export default function TopographicSurveyPage() {
  const [points, setPoints] = useState<TopoPoint[]>([])
  const [breaklines, setBreaklines] = useState<BreaklineInput[]>([])
  const [pointInput, setPointInput] = useState('')
  const [breaklineInput, setBreaklineInput] = useState('')
  const [contourInterval, setContourInterval] = useState('1.0')
  const [contours, setContours] = useState<any>(null)
  const [sanity, setSanity] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [codeFilter, setCodeFilter] = useState('')

  // Feature code lookup
  const codeMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const def of KENYA_TOPO_CODES) m.set(def.code.toUpperCase(), def.description)
    return m
  }, [])

  const filteredCodes = useMemo(() => {
    if (!codeFilter) return KENYA_TOPO_CODES.slice(0, 30)
    return KENYA_TOPO_CODES.filter(c =>
      c.code.toLowerCase().includes(codeFilter.toLowerCase()) ||
      c.description.toLowerCase().includes(codeFilter.toLowerCase())
    ).slice(0, 30)
  }, [codeFilter])

  const handleParsePoints = useCallback(() => {
    const parsed = pointInput.trim().split('\n').map(line => {
      const cols = line.split(',').map(c => c.trim())
      return {
        pointNumber: cols[0] || `PT${Date.now()}`,
        easting: parseFloat(cols[1]), northing: parseFloat(cols[2]),
        rl: parseFloat(cols[3]),
        code: cols[4] || '', description: cols[5] || codeMap.get((cols[4] || '').toUpperCase()) || '',
      }
    }).filter(p => !isNaN(p.easting) && !isNaN(p.northing) && !isNaN(p.rl))
    setPoints(parsed)
  }, [pointInput, codeMap])

  const handleParseBreaklines = useCallback(() => {
    // Format: type,x1,y1,z1,x2,y2,z2,...
    const lines = breaklineInput.trim().split('\n')
    const parsed: BreaklineInput[] = []
    for (const line of lines) {
      const cols = line.split(',').map(c => c.trim())
      const type = (cols[0] as BreaklineInput['type']) || 'hard'
      const pts: Array<{ x: number; y: number; z: number }> = []
      for (let i = 1; i < cols.length - 2; i += 3) {
        const x = parseFloat(cols[i]), y = parseFloat(cols[i + 1]), z = parseFloat(cols[i + 2])
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) pts.push({ x, y, z })
      }
      if (pts.length >= 2) parsed.push({ points: pts, type })
    }
    setBreaklines(parsed)
  }, [breaklineInput])

  const handleGenerateContours = async () => {
    if (points.length < 3) { setError('Need ≥3 points'); return }
    setLoading(true); setError(''); setContours(null); setSanity(null)
    try {
      const res = await fetch('/api/topo/generate-contours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: points.map(p => ({ x: p.easting, y: p.northing, z: p.rl })),
          breaklines,
          interval: parseFloat(contourInterval),
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed') }
      const data = await res.json()
      setContours(data.data.contours)
      setSanity(data.data.sanity)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  const handleExportDXF = async () => {
    if (points.length === 0) return
    try {
      const res = await fetch('/api/topo/export-dxf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: points.map(p => ({
            easting: p.easting, northing: p.northing, elevation: p.rl,
            code: p.code, pointNumber: p.pointNumber,
          })),
          projectName: 'Topographic Survey',
        }),
      })
      if (!res.ok) throw new Error('Export failed')
      const data = await res.json()
      const blob = new Blob([data.content], { type: data.mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = data.filename; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setError(e instanceof Error ? e.message : 'Export failed') }
  }

  const handleExportSpotHeights = async () => {
    if (points.length === 0) return
    try {
      const res = await fetch('/api/topo/spot-height-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: points.map(p => ({
            pointNumber: p.pointNumber, easting: p.easting, northing: p.northing,
            rl: p.rl, code: p.code, description: p.description,
          })),
          projectName: 'Topographic Survey',
          surveyorName: 'METARDU User',
        }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'spot_height_schedule.xlsx'; a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setError(e instanceof Error ? e.message : 'Export failed') }
  }

  const inputCls = "w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] focus:border-[var(--accent)]/30 focus:outline-none"

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Topographic Survey</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">Feature-coded points → breakline-aware TIN → contour generation → DXF + Spot Height Schedule export</p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Point Input */}
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-2">1. Survey Points</h2>
          <p className="text-[10px] text-[var(--text-muted)] mb-1">Format: point_no, easting, northing, RL, code, description</p>
          <textarea value={pointInput} onChange={e => setPointInput(e.target.value)}
            className={inputCls + ' h-40 font-mono'}
            placeholder={'1,264000,9861000,1500.00,SH,Spot height&#10;2,264010,9861000,1500.15,RD,Road edge&#10;3,264020,9861000,1500.30,RD,Road edge&#10;4,264030,9861000,1500.50,BLD,Building corner'} />
          <button onClick={handleParsePoints} className="mt-2 px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--border-hover)]">
            Parse Points ({points.length} loaded)
          </button>
        </div>

        {/* Breakline Input */}
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-2">2. Breaklines (optional)</h2>
          <p className="text-[10px] text-[var(--text-muted)] mb-1">Format: type,x1,y1,z1,x2,y2,z2,...</p>
          <textarea value={breaklineInput} onChange={e => setBreaklineInput(e.target.value)}
            className={inputCls + ' h-40 font-mono'}
            placeholder={'hard,264010,9861000,1500.15,264020,9861000,1500.30,264030,9861000,1500.50'} />
          <button onClick={handleParseBreaklines} className="mt-2 px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--border-hover)]">
            Parse Breaklines ({breaklines.length} loaded)
          </button>
        </div>
      </div>

      {/* Feature Code Library */}
      <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2"><Layers className="w-4 h-4" /> Kenya Feature Code Library ({KENYA_TOPO_CODES.length} codes)</h2>
        <div className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input value={codeFilter} onChange={e => setCodeFilter(e.target.value)} placeholder="Search codes..."
              className={inputCls + ' pl-7'} />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto">
          {filteredCodes.map(def => (
            <div key={def.code} className="text-[10px] px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)]/30">
              <span className="font-mono font-bold text-[var(--accent)]">{def.code}</span>
              <span className="text-[var(--text-muted)] ml-1">{def.description}</span>
              <span className="text-[var(--text-muted)]/50 ml-1">→ {def.dxfLayer}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Contour Generation */}
      <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">3. Contour Generation</h2>
          <div className="flex gap-2 items-center">
            <label className="text-[10px] text-[var(--text-muted)]">Interval (m):</label>
            <input value={contourInterval} onChange={e => setContourInterval(e.target.value)} className={inputCls + ' w-20'} />
            <button onClick={handleGenerateContours} disabled={loading || points.length < 3}
              className="px-4 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)] disabled:opacity-50">
              {loading ? 'Generating...' : 'Generate Contours'}
            </button>
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-3 text-xs text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

        {sanity && (
          <div className={`p-3 rounded-lg mb-3 text-xs ${sanity.passed ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            <div className="flex items-center gap-2 font-semibold">
              {sanity.passed ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              Contour Sanity Check
            </div>
            <p className="mt-1 opacity-80">{sanity.summary}</p>
            {sanity.issues.length > 0 && (
              <div className="mt-2 space-y-1">
                {sanity.issues.map((issue: any, i: number) => (
                  <div key={i} className="text-[10px]">
                    <span className={issue.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}>[{issue.severity.toUpperCase()}]</span>
                    {' '}{issue.message}
                    <span className="text-[var(--text-muted)] block ml-4">→ {issue.suggestion}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {contours && (
          <div className="text-xs text-[var(--text-secondary)]">
            Generated {contours.length} contour lines at {contourInterval}m interval
          </div>
        )}
      </div>

      {/* Export */}
      <div className="flex gap-3">
        <button onClick={handleExportDXF} disabled={points.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] text-xs font-semibold rounded-lg hover:bg-[var(--accent)]/25 disabled:opacity-50">
          <Download className="w-4 h-4" /> Export Topo DXF
        </button>
        <button onClick={handleExportSpotHeights} disabled={points.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] text-xs font-semibold rounded-lg hover:bg-[var(--accent)]/25 disabled:opacity-50">
          <FileSpreadsheet className="w-4 h-4" /> Spot Height Schedule (Excel)
        </button>
      </div>

      {/* Points Table */}
      {points.length > 0 && (
        <div className="mt-4 bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-2">Loaded Points ({points.length})</h3>
          <div className="overflow-x-auto max-h-60">
            <table className="w-full text-xs">
              <thead><tr className="text-[var(--text-muted)] border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-secondary)]">
                <th className="text-left py-1 px-1">Pt No</th><th className="text-right">Easting</th><th className="text-right">Northing</th><th className="text-right">RL</th><th className="text-left">Code</th><th className="text-left">Description</th>
              </tr></thead>
              <tbody>
                {points.map((p, i) => (
                  <tr key={i} className="border-b border-[var(--border-color)]/30 text-[var(--text-secondary)]">
                    <td className="py-1 px-1 font-mono">{p.pointNumber}</td>
                    <td className="text-right font-mono">{p.easting.toFixed(3)}</td>
                    <td className="text-right font-mono">{p.northing.toFixed(3)}</td>
                    <td className="text-right font-mono">{p.rl.toFixed(3)}</td>
                    <td className="font-mono text-[var(--accent)]">{p.code}</td>
                    <td>{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
