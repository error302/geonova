'use client'

import { useState } from 'react'
import { verticalCurve, type VerticalCurveInput, type VerticalCurveResult } from '@/lib/computations/roadDesignEngine'

export default function VerticalCurveCalculator() {
  const [result, setResult] = useState<VerticalCurveResult | null>(null)
  const [g1, setG1] = useState('-2.5')
  const [g2, setG2] = useState('3.0')
  const [vpiCh, setVpiCh] = useState('2400.000')
  const [vpiRL, setVpiRL] = useState('105.500')
  const [lengthMode, setLengthMode] = useState<'L' | 'K'>('L')
  const [L, setL] = useState('200')
  const [K, setK] = useState('80')
  const [interval, setInterval] = useState('20')

  function compute() {
    const input: VerticalCurveInput = {
      g1: parseFloat(g1),
      g2: parseFloat(g2),
      vpiChainage: parseFloat(vpiCh),
      vpiRL: parseFloat(vpiRL),
      curveLength: lengthMode === 'L' ? (parseFloat(L) || 0) : undefined,
      kValue: lengthMode === 'K' ? (parseFloat(K) || 0) : undefined,
      interval: parseInt(interval) || 20,
    }
    try {
      setResult(verticalCurve(input))
    } catch (e: unknown) {
      alert((e instanceof Error ? e.message : String(e)))
    }
  }

  function fmtCh(ch: number) {
    const km = Math.floor(ch / 1000)
    const m = ch % 1000
    return km > 0 ? `${km}+${m.toFixed(3)}` : `${m.toFixed(3)}`
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">G₁ — Incoming Grade (%)</label>
          <input value={g1} onChange={e => setG1(e.target.value)} type="number" step="0.001"
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">G₂ — Outgoing Grade (%)</label>
          <input value={g2} onChange={e => setG2(e.target.value)} type="number" step="0.001"
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">VPI Chainage (m)</label>
          <input value={vpiCh} onChange={e => setVpiCh(e.target.value)} type="number" step="0.001"
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">VPI Reduced Level (m)</label>
          <input value={vpiRL} onChange={e => setVpiRL(e.target.value)} type="number" step="0.001"
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Length Mode</label>
          <div className="flex gap-1">
            <button onClick={() => setLengthMode('L')} className={`flex-1 px-2 py-2 text-xs rounded ${lengthMode === 'L' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-muted)]'}`}>L (m)</button>
            <button onClick={() => setLengthMode('K')} className={`flex-1 px-2 py-2 text-xs rounded ${lengthMode === 'K' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-muted)]'}`}>K</button>
          </div>
        </div>
        {lengthMode === 'L' ? (
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Curve Length L (m)</label>
            <input value={L} onChange={e => setL(e.target.value)} type="number" min="1"
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
          </div>
        ) : (
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">K Value</label>
            <input value={K} onChange={e => setK(e.target.value)} type="number" min="1"
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={compute} className="px-5 py-2 bg-[var(--accent)] text-white rounded text-sm font-medium hover:opacity-90">
          Compute
        </button>
        <div>
          <label className="text-xs text-[var(--text-muted)] mr-1">RL Table Interval (m)</label>
          <input value={interval} onChange={e => setInterval(e.target.value)} type="number" min="1"
            className="w-20 px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
        </div>
        {result && (
          <span className={`text-xs font-mono px-2 py-1 rounded ${result.arithmeticCheck.passed ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            {result.arithmeticCheck.passed ? '✓ Arithmetic Check PASS' : `✗ FAIL (diff=${result.arithmeticCheck.diff.toFixed(4)}m)`}
          </span>
        )}
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Algebraic Diff A (%)', `${result.A.toFixed(4)}%`, 'RDM 1.3 §5.4'],
              ['Curve Length L (m)', `${result.L.toFixed(4)} m`, 'RDM 1.3 §5.4'],
              ['K Value', result.K.toFixed(4), 'RDM 1.3 §5.4'],
              ['Curve Type', result.isCrest ? 'Crest (↑ +A)' : 'Sag (↓ −A)', 'RDM 1.3 §5.4'],
              ['BVC Chainage', fmtCh(result.bvcChainage), 'RDM 1.3 §5.4'],
              ['BVC RL (m)', result.bvcRL.toFixed(4), 'RDM 1.3 §5.4'],
              ['EVC Chainage', fmtCh(result.evcChainage), 'RDM 1.3 §5.4'],
              ['EVC RL (m)', result.evcRL.toFixed(4), 'RDM 1.3 §5.4'],
              ['Peak/Sag Chainage', fmtCh(result.chainagePeak), 'RDM 1.3 §5.4'],
              ['Peak/Sag RL (m)', result.rlPeak.toFixed(4), 'RDM 1.3 §5.4'],
            ].map(([label, value, source]) => (
              <div key={label} className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded p-3">
                <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
                <p className="text-lg font-mono text-[var(--text-primary)]">{value}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">{source}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="bg-[var(--bg-tertiary)]">
                  {['Chainage', 'RL (m)', 'x (m)', 'y (m)', 'Point'].map((h: any) => (
                    <th key={h} className="px-3 py-2 text-left text-[var(--text-muted)] font-medium border border-[var(--border-color)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className="border border-[var(--border-color)]/50 hover:bg-[var(--bg-tertiary)]/50">
                    <td className="px-3 py-1.5 text-[var(--text-primary)]">{fmtCh(row.chainage)}</td>
                    <td className="px-3 py-1.5 text-[var(--text-primary)] text-right">{row.rl.toFixed(3)}</td>
                    <td className="px-3 py-1.5 text-[var(--text-secondary)] text-right">{row.x.toFixed(3)}</td>
                    <td className="px-3 py-1.5 text-[var(--text-secondary)] text-right">{row.y.toFixed(3)}</td>
                    <td className="px-3 py-1.5">
                      {row.isBVC && <span className="text-[var(--accent)] font-bold">BVC</span>}
                      {row.isEVC && <span className="text-[var(--accent)] font-bold">EVC</span>}
                      {row.isPeak && !row.isBVC && !row.isEVC && <span className="text-yellow-400">PEAK</span>}
                      {row.isSag && !row.isBVC && !row.isEVC && !row.isPeak && <span className="text-blue-400">SAG</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
