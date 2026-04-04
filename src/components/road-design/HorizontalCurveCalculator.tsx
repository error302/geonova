'use client'

import { useState } from 'react'
import { horizontalCurveElements, type HorizontalCurveInput, type HorizontalCurveResult } from '@/lib/computations/roadDesignEngine'

type Tab = 'elements' | 'setout'

export default function HorizontalCurveCalculator() {
  const [tab, setTab] = useState<Tab>('elements')
  const [result, setResult] = useState<HorizontalCurveResult | null>(null)
  const [resultSetout, setResultSetout] = useState<{ T: number; L: number; CT: number } | null>(null)

  const [radius, setRadius] = useState('300')
  const [deltaD, setDeltaD] = useState('45')
  const [deltaM, setDeltaM] = useState('00')
  const [deltaS, setDeltaS] = useState('00')
  const [ipChainage, setIpChainage] = useState('2500.000')

  const [interval, setInterval] = useState('20')

  function computeElements() {
    const input: HorizontalCurveInput = {
      radius: parseFloat(radius),
      deflectionAngleDeg: parseInt(deltaD) || 0,
      deflectionAngleMin: parseInt(deltaM) || 0,
      deflectionAngleSec: parseFloat(deltaS) || 0,
      ipChainage: parseFloat(ipChainage),
    }
    const r = horizontalCurveElements(input)
    setResult(r)
    setResultSetout({ T: r.tangentLength, L: r.curveLength, CT: r.ctChainage })
  }

  function ChainageDisplay(ch: number) {
    const km = Math.floor(ch / 1000)
    const m = ch % 1000
    return km > 0 ? `${km}+${m.toFixed(3)}` : `${m.toFixed(3)}`
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-[var(--border-color)] pb-3">
        <button onClick={() => setTab('elements')} className={`px-4 py-2 rounded-t text-sm font-medium ${tab === 'elements' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>Curve Elements</button>
        <button onClick={() => setTab('setout')} className={`px-4 py-2 rounded-t text-sm font-medium ${tab === 'setout' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>Set-Out Table</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Radius R (m)</label>
          <input value={radius} onChange={e => setRadius(e.target.value)} type="number" min="1"
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Δ Degrees</label>
          <input value={deltaD} onChange={e => setDeltaD(e.target.value)} type="number" min="1" max="180"
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Δ Minutes</label>
          <input value={deltaM} onChange={e => setDeltaM(e.target.value)} type="number" min="0" max="59"
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Δ Seconds</label>
          <input value={deltaS} onChange={e => setDeltaS(e.target.value)} type="number" step="0.001" min="0" max="59.999"
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">IP Chainage (m)</label>
          <input value={ipChainage} onChange={e => setIpChainage(e.target.value)} type="number" min="0"
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={computeElements} className="px-5 py-2 bg-[var(--accent)] text-white rounded text-sm font-medium hover:opacity-90">
          Compute
        </button>
        {result && (
          <span className={`text-xs font-mono px-2 py-1 rounded ${result.arithmeticCheck.passed ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            {result.arithmeticCheck.passed ? '✓ Arithmetic Check PASS' : `✗ Arithmetic Check FAIL (diff=${result.arithmeticCheck.diff.toFixed(4)}m)`}
          </span>
        )}
      </div>

      {tab === 'elements' && result && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Tangent Length (T)', `${result.tangentLength.toFixed(4)} m`, 'RDM 1.3 §5.2'],
            ['Curve Length (L)', `${result.curveLength.toFixed(4)} m`, 'RDM 1.3 §5.2'],
            ['Long Chord (C)', `${result.longChord.toFixed(4)} m`, 'RDM 1.3 §5.2'],
            ['Mid Ordinate (M)', `${result.midOrdinate.toFixed(4)} m`, 'RDM 1.3 §5.2'],
            ['External Dist (E)', `${result.externalDistance.toFixed(4)} m`, 'RDM 1.3 §5.2'],
            ['Degree of Curve (D)', `${result.degreeOfCurve.toFixed(4)}°`, 'RDM 1.3 §5.2'],
            ['TC Chainage', ChainageDisplay(result.tcChainage), 'RDM 1.3 §5.2'],
            ['CC Chainage', ChainageDisplay(result.ccChainage), 'RDM 1.3 §5.2'],
            ['CT Chainage', ChainageDisplay(result.ctChainage), 'RDM 1.3 §5.2'],
            ['Δ (radians)', result.delta.toFixed(8), 'Ghilani Ch.24 Eq.24.1'],
          ].map(([label, value, source]) => (
            <div key={label} className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded p-3">
              <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
              <p className="text-lg font-mono text-[var(--text-primary)]">{value}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">{source}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'elements' && result && result.steps && (
        <details className="text-xs">
          <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium mb-2">Show Computation Steps</summary>
          <div className="space-y-1">
            {result.steps.map((step, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-2 font-mono py-1 border-b border-[var(--border-color)]/20">
                <span className="text-[var(--text-secondary)]">{step.description}</span>
                <span className="text-[var(--text-muted)]">=</span>
                <span className="text-[var(--text-primary)]">{step.value}</span>
                <span className="text-[var(--text-muted)] text-right">{step.formula}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {tab === 'setout' && resultSetout && (
        <SetOutDisplay radius={parseFloat(radius)} T={resultSetout.T} tcChainage={parseFloat(radius) * Math.tan((parseFloat(deltaD) + parseFloat(deltaM)/60 + parseFloat(deltaS)/3600) * Math.PI / 360)} interval={parseInt(interval) || 20} deltaD={parseInt(deltaD)||0} deltaM={parseInt(deltaM)||0} deltaS={parseFloat(deltaS)||0} />
      )}

      {tab === 'setout' && !resultSetout && (
        <div className="text-sm text-[var(--text-muted)] text-center py-8">
          Compute curve elements first, then switch to Set-Out tab
        </div>
      )}

      {tab === 'setout' && (
        <div className="mt-2">
          <label className="block text-xs text-[var(--text-muted)] mb-1">Peg Interval (m)</label>
          <input value={interval} onChange={e => setInterval(e.target.value)} type="number" min="1" max="100"
            className="w-24 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
        </div>
      )}
    </div>
  )
}

function SetOutDisplay({ radius, T, tcChainage, interval, deltaD, deltaM, deltaS }: { radius: number; T: number; tcChainage: number; interval: number; deltaD: number; deltaM: number; deltaS: number }) {
  const delta = (deltaD + deltaM / 60 + deltaS / 3600) * Math.PI / 180
  const ctChainage = tcChainage + (Math.PI * radius * delta / 180)
  const rows: Array<{ peg: string; chainage: number; chord: number; defAngle: string; totalDef: string; remarks: string }> = []

  rows.push({ peg: 'TC', chainage: tcChainage, chord: 0, defAngle: '0°00\'00"', totalDef: '0°00\'00"', remarks: 'Tangent/Curve' })

  let ch = Math.ceil(tcChainage / interval) * interval
  while (ch < ctChainage) {
    const arc = ch - tcChainage
    const defRad = arc / radius
    const defDeg = (defRad * 180 / Math.PI) / 2
    const d = Math.floor(defDeg)
    const mf = (defDeg - d) * 60
    const m = Math.floor(mf)
    const s = (mf - m) * 60
    const chord = 2 * radius * Math.sin(arc / (2 * radius))
    rows.push({ peg: String(rows.length), chainage: ch, chord, defAngle: `${d}°${String(m).padStart(2,'0')}'${s.toFixed(1).padStart(4,'0')}"`, totalDef: `${d}°${String(m).padStart(2,'0')}'${s.toFixed(1).padStart(4,'0')}"`, remarks: '' })
    ch += interval
  }

  const finalArc = ctChainage - tcChainage
  const finalDefDeg = ((finalArc / radius) * 180 / Math.PI) / 2
  const fd = Math.floor(finalDefDeg)
  const fmf = (finalDefDeg - fd) * 60
  const fm = Math.floor(fmf)
  const fs = (fmf - fm) * 60
  const finalChord = 2 * radius * Math.sin(finalArc / (2 * radius))
  rows.push({ peg: 'CT', chainage: ctChainage, chord: finalChord, defAngle: `${fd}°${String(fm).padStart(2,'0')}'${fs.toFixed(1).padStart(4,'0')}"`, totalDef: `${fd}°${String(fm).padStart(2,'0')}'${fs.toFixed(1).padStart(4,'0')}"`, remarks: 'Curve/Tangent' })

  function fmtCh(ch: number) {
    const km = Math.floor(ch / 1000)
    const m = ch % 1000
    return km > 0 ? `${km}+${m.toFixed(3)}` : `${m.toFixed(3)}`
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono border-collapse">
        <thead>
          <tr className="bg-[var(--bg-tertiary)]">
            {['Peg', 'Chainage', 'Chord (m)', 'Deflection Angle', 'Cumulative Def', 'Remarks'].map((h: any) => (
              <th key={h} className="px-3 py-2 text-left text-[var(--text-muted)] font-medium border border-[var(--border-color)]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border border-[var(--border-color)]/50 hover:bg-[var(--bg-tertiary)]/50">
              <td className="px-3 py-1.5 text-[var(--text-primary)]">{row.peg}</td>
              <td className="px-3 py-1.5 text-[var(--text-primary)]">{fmtCh(row.chainage)}</td>
              <td className="px-3 py-1.5 text-[var(--text-primary)] text-right">{row.chord > 0 ? row.chord.toFixed(3) : '—'}</td>
              <td className="px-3 py-1.5 text-[var(--text-primary)]">{row.defAngle}</td>
              <td className="px-3 py-1.5 text-[var(--text-primary)]">{row.totalDef}</td>
              <td className="px-3 py-1.5 text-[var(--text-muted)]">{row.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
