'use client';

import { useState, useRef, useEffect, useId } from 'react'
import { Download } from 'lucide-react'
import { computeSettingOut, checkCoordinate, parseSettingOutCSV, type InstrumentStation, type Backsight, type DesignPoint, type ReObservation, type SettingOutResult, type SettingOutRow } from '@/lib/computations/settingOutEngine'
import SettingOutTable from './SettingOutTable'
import StakeOutSheet from './StakeOutSheet'
import ChainageOffsetTable from './ChainageOffsetTable'
import { generatePDF, downloadCSV, toCSV } from '@/lib/export/helpers'

type PointRow = {
  id: string
  e: string
  n: string
  rl: string
  th: string
  desc: string
}

const pointFields: Array<keyof PointRow> = ['id', 'e', 'n', 'rl', 'th', 'desc']
const pointHeaders = ['ID', 'Easting', 'Northing', 'RL', 'TH', 'Description', ''] as const

export default function SettingOutCalculator() {
  const [station, setStation] = useState({ e: '', n: '', rl: '', ih: '' })
  const [bs, setBs] = useState({ e: '', n: '' })
  const [points, setPoints] = useState<PointRow[]>([])
  const [result, setResult] = useState<SettingOutResult | null>(null)
  const [checkResults, setCheckResults] = useState<{ pointId: string; obsHz: string; obsHD: string; obsRL: string }>({ pointId: '', obsHz: '', obsHD: '', obsRL: '' })
  const [checkResult, setCheckResult] = useState<ReturnType<typeof checkCoordinate> | null>(null)
  const [activeTab, setActiveTab] = useState<'table' | 'chainage' | 'check'>('table')
  const [csvError, setCsvError] = useState('')
  const [showStakeOutSheet, setShowStakeOutSheet] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Close the stake-out sheet on Escape (document-level, works regardless of focus)
  useEffect(() => {
    if (!showStakeOutSheet) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowStakeOutSheet(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showStakeOutSheet])

  function compute() {
    const stationVal: InstrumentStation = {
      e: parseFloat(station.e),
      n: parseFloat(station.n),
      rl: parseFloat(station.rl),
      ih: parseFloat(station.ih),
    }
    const bsVal: Backsight = { e: parseFloat(bs.e), n: parseFloat(bs.n) }
    const pts: DesignPoint[] = points
      .filter(p => p.e && p.n && p.rl)
      .map(p => ({
        id: p.id || crypto.randomUUID(),
        e: parseFloat(p.e),
        n: parseFloat(p.n),
        rl: parseFloat(p.rl),
        th: parseFloat(p.th) || 2.0,
        description: p.desc,
      }))

    if (pts.length === 0) return
    const r = computeSettingOut(stationVal, bsVal, pts)
    setResult(r)
  }

  function runCheck() {
    if (!result || !checkResults.pointId) return
    const pt = result.rows.find((r: SettingOutRow) => r.id === checkResults.pointId)
    if (!pt) return
    const obs: ReObservation = {
      observedHz: parseFloat(checkResults.obsHz) || 0,
      observedHD: parseFloat(checkResults.obsHD) || 0,
      observedRL: checkResults.obsRL ? parseFloat(checkResults.obsRL) : undefined,
    }
    const designPt: DesignPoint = {
      id: pt.id,
      e: pt.designE,
      n: pt.designN,
      rl: pt.designRL,
      th: pt.TH,
    }
    const r = checkCoordinate(
      { e: parseFloat(station.e), n: parseFloat(station.n), rl: parseFloat(station.rl), ih: parseFloat(station.ih) },
      result.bsBearingDecimal,
      obs,
      designPt
    )
    setCheckResult(r)
  }

  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvError('')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string
        const parsed = parseSettingOutCSV(text)
        if (parsed.length === 0) { setCsvError('No valid points found'); return }
        setPoints(parsed.map(p => ({
          id: p.id, e: p.e.toString(), n: p.n.toString(),
          rl: p.rl.toString(), th: p.th.toString(), desc: p.description || '',
        })))
      } catch {
        setCsvError('Failed to parse CSV')
      }
    }
    reader.readAsText(file)
  }

  function addPoint() {
    setPoints(prev => [...prev, { id: '', e: '', n: '', rl: '', th: '2.000', desc: '' }])
  }

  function removePoint(i: number) {
    setPoints(prev => prev.filter((_, idx) => idx !== i))
  }

  function updatePoint(i: number, field: keyof PointRow, value: string) {
    setPoints(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }

  return (
    <div className="space-y-6">
      {/* Instrument Setup */}
      <div className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3">Instrument Station Setup</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Station E" value={station.e} onChange={v => setStation(s => ({ ...s, e: v }))} />
          <Field label="Station N" value={station.n} onChange={v => setStation(s => ({ ...s, n: v }))} />
          <Field label="Station RL (m)" value={station.rl} onChange={v => setStation(s => ({ ...s, rl: v }))} />
          <Field label="IH (m)" value={station.ih} onChange={v => setStation(s => ({ ...s, ih: v }))} />
          <Field label="BS E" value={bs.e} onChange={v => setBs(b => ({ ...b, e: v }))} />
          <Field label="BS N" value={bs.n} onChange={v => setBs(b => ({ ...b, n: v }))} />
        </div>
        {result && (
          <p className="text-xs font-mono mt-2 text-[var(--accent)]">
            BS Bearing: <span className="font-bold">{result.bsBearing}</span>
          </p>
        )}
      </div>

      {/* Design Points */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Design Points</h3>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-xs border border-[var(--border-color)] rounded text-[var(--text-muted)]">Import CSV</button>
            <button onClick={addPoint} className="px-3 py-1.5 text-xs bg-[var(--accent)] text-black rounded">+ Add Point</button>
          </div>
        </div>
        {csvError && <p className="text-xs text-red-400 mb-2">{csvError}</p>}
        <p className="text-xs text-[var(--text-muted)] mb-2">Format: point_id, easting, northing, rl, TH, description</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
                <tr className="bg-[var(--bg-tertiary)]">
                  {pointHeaders.map(h => (
                    <th key={h} className="px-2 py-2 text-left border border-[var(--border-color)] text-[var(--text-muted)] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr key={`${p}-${i}`} className="hover:bg-[var(--bg-tertiary)]/30">
                    {pointFields.map(f => (
                      <td key={f} className="px-1 py-1 border border-[var(--border-color)]/50">
                        <input aria-label={pointHeaders[pointFields.indexOf(f)] ?? f} value={p[f]} onChange={e => updatePoint(i, f, e.target.value)}
                          className="w-full px-2 py-1 bg-transparent text-[var(--text-primary)]" />
                    </td>
                  ))}
                  <td className="px-1 py-1 border border-[var(--border-color)]/50">
                    <button onClick={() => removePoint(i)} className="text-red-400 hover:text-red-300 text-xs px-1">[x]</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compute */}
      <div className="flex flex-wrap gap-3">
        <button onClick={compute} className="px-6 py-2 bg-[var(--accent)] text-black rounded font-medium hover:opacity-90">
          Compute Setting Out
        </button>
        {result && (
          <button onClick={() => setShowStakeOutSheet(true)} className="px-4 py-2 border border-[var(--border-color)] rounded text-sm hover:bg-[var(--bg-tertiary)]">
            Generate Stake Out Sheet
          </button>
        )}
        {result && (
          <>
            <button
              onClick={() => {
                generatePDF(
                  { title: 'Setting Out Schedule', reference: 'Ghilani & Wolf Ch.23 | RDM 1.1 Table 5.2' },
                  [
                    { title: 'Instrument Station', rows: [
                      { label: 'Station E', value: station.e || '—' },
                      { label: 'Station N', value: station.n || '—' },
                      { label: 'Station RL', value: `${station.rl || '—'} m` },
                      { label: 'IH', value: `${station.ih || '—'} m` },
                      { label: 'BS Bearing', value: result.bsBearing },
                    ]},
                  ],
                  [
                    { title: 'Setting Out Table', headers: ['Point ID', 'Hz Angle', 'HD (m)', 'ΔRL (m)', 'Design E', 'Design N', 'Design RL'], rows: result.rows.map((r: SettingOutRow) => [
                      r.id, r.HzAngle || '—', r.HD?.toFixed(4) || '—',
                      r.heightDiff?.toFixed(4) || '—', r.designE?.toFixed(3) || '—',
                      r.designN?.toFixed(3) || '—', r.designRL?.toFixed(3) || '—',
                    ]) },
                  ],
                )
              }}
              className="px-4 py-2 border border-[var(--border-color)] rounded text-sm inline-flex items-center gap-2 hover:bg-[var(--bg-tertiary)]"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
            <button
              onClick={() => {
                const csv = toCSV(
                  ['Point ID', 'Hz Angle', 'HD (m)', 'Delta RL (m)', 'Design E', 'Design N', 'Design RL'],
                  result.rows.map((r: SettingOutRow) => [
                    r.id, r.HzAngle || '', r.HD?.toFixed(4) || '',
                    r.heightDiff?.toFixed(4) || '', r.designE?.toFixed(3) || '',
                    r.designN?.toFixed(3) || '', r.designRL?.toFixed(3) || '',
                  ]),
                )
                downloadCSV(csv, 'setting-out-data')
              }}
              className="px-4 py-2 border border-[var(--border-color)] rounded text-sm inline-flex items-center gap-2 hover:bg-[var(--bg-tertiary)]"
            >
              <Download className="w-4 h-4" /> Download CSV
            </button>
          </>
        )}
      </div>

      {/* Tabs */}
      {result && (
        <div className="flex gap-1 border-b border-[var(--border-color)]">
          {(['table', 'chainage', 'check'] as const).map((tab: 'table' | 'chainage' | 'check') => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 rounded-t ${activeTab === tab ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-muted)]'}`}>
              {tab === 'table' ? 'Setting Out Table' : tab === 'chainage' ? 'Chainage & Offset' : 'Re-Observation Check'}
            </button>
          ))}
        </div>
      )}

      {result && activeTab === 'table' && <SettingOutTable result={result} />}

      {result && activeTab === 'chainage' && <ChainageOffsetTable points={result.rows} />}

      {result && activeTab === 'check' && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-semibold">Re-Observation Check</h3>
          <p className="text-xs text-[var(--text-muted)]">Source: RDM 1.1 Table 5.2 — Construction tolerance: ±25mm horizontal, ±15mm vertical</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-[var(--text-muted)] mb-1 block" htmlFor="point-id">Point ID</label>
              <select id="point-id" value={checkResults.pointId} onChange={e => setCheckResults(r => ({ ...r, pointId: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm">
                <option value="">Select point</option>
                {result.rows.map((r: SettingOutRow) => <option key={r.id} value={r.id}>{r.id} — {r.designE.toFixed(3)}/{r.designN.toFixed(3)}</option>)}
              </select>
            </div>
            <Field label="Observed Hz (°)" value={checkResults.obsHz} onChange={v => setCheckResults(r => ({ ...r, obsHz: v }))} />
            <Field label="Observed HD (m)" value={checkResults.obsHD} onChange={v => setCheckResults(r => ({ ...r, obsHD: v }))} />
            <Field label="Observed RL (m)" value={checkResults.obsRL} onChange={v => setCheckResults(r => ({ ...r, obsRL: v }))} />
          </div>
          <button onClick={runCheck} className="px-5 py-2 bg-[var(--accent)] text-black rounded text-sm font-medium">Check</button>

          {checkResult && (
            <div className={`border rounded-lg p-4 ${checkResult.isCompliant ? 'border-green-800 bg-green-900/20' : 'border-red-800 bg-red-900/20'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-lg font-bold ${checkResult.isCompliant ? 'text-green-400' : 'text-red-400'}`}>
                  {checkResult.isCompliant ? ' PASS — Within Tolerance' : '[x] FAIL — Re-set Required'}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                <div><span className="text-[var(--text-muted)]">ΔE: </span><span className={checkResult.deltaE > checkResult.hTolerance ? 'text-red-400' : 'text-green-400'}>{checkResult.deltaE.toFixed(4)}m</span></div>
                <div><span className="text-[var(--text-muted)]">ΔN: </span><span className={checkResult.deltaN > checkResult.hTolerance ? 'text-red-400' : 'text-green-400'}>{checkResult.deltaN.toFixed(4)}m</span></div>
                {checkResult.deltaRL !== null && (
                  <div><span className="text-[var(--text-muted)]">ΔRL: </span><span className={checkResult.vAccuracy === 'RED' ? 'text-red-400' : 'text-green-400'}>{checkResult.deltaRL.toFixed(4)}m</span></div>
                )}
                <div><span className="text-[var(--text-muted)]">Tolerance: </span><span>±{(checkResult.hTolerance * 1000).toFixed(0)}mm H / ±{(checkResult.vTolerance * 1000).toFixed(0)}mm V</span></div>
              </div>
              {checkResult.messages.map((m, i) => <p key={`${m}-${i}`} className="text-xs mt-1 text-[var(--text-secondary)]">{m}</p>)}
            </div>
          )}
        </div>
      )}

      {/* Stake Out Sheet Modal */}
      {showStakeOutSheet && result && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close dialog" tabIndex={-1} className="absolute inset-0 cursor-pointer border-0 p-0" onClick={() => setShowStakeOutSheet(false)} />
          <div className="relative bg-[var(--bg-primary)] max-w-2xl w-full rounded-lg overflow-hidden max-h-[90vh] overflow-y-auto border border-[var(--border-color)]" role="dialog" aria-modal="true" aria-label="Setting Out Schedule">
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center">
              <h2 className="font-bold text-[var(--text-primary)]">Setting Out Schedule</h2>
              <button onClick={() => setShowStakeOutSheet(false)} className="text-gray-500 hover:text-black">[x] Close</button>
            </div>
            <div className="p-4">
              <StakeOutSheet result={result} station={station} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="text-xs text-[var(--text-muted)] mb-1 block">{label}</label>
      <input id={id} value={value} onChange={e => onChange(e.target.value)} type="number" step="0.001"
        className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
    </div>
  )
}
