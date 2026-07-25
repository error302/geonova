'use client'

import { useState } from 'react'
import { AlertCircle, Activity } from 'lucide-react'
import { compareEpochs, type EpochSet, type DeformationReport } from '@/lib/survey/deformationMonitoring'

export default function DeformationMonitoringPage() {
  const [baselineJson, setBaselineJson] = useState('')
  const [currentJson, setCurrentJson] = useState('')
  const [tolH, setTolH] = useState('0.005')
  const [tolV, setTolV] = useState('0.003')
  const [report, setReport] = useState<DeformationReport | null>(null)
  const [error, setError] = useState('')

  const handleCompare = () => {
    setError(''); setReport(null)
    try {
      const baseline = JSON.parse(baselineJson) as EpochSet
      const current = JSON.parse(currentJson) as EpochSet
      const result = compareEpochs(baseline, current, {
        horizontal: parseFloat(tolH), vertical: parseFloat(tolV),
      })
      setReport(result)
    } catch (e) { setError(e instanceof Error ? e.message : 'Invalid JSON') }
  }

  const inputCls = "w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] focus:border-[var(--accent)]/30 focus:outline-none"

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Deformation Monitoring</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">Compare monument positions between two epochs. Tectonic plate drift is automatically removed via ITRF2014 Somali plate velocity propagation.</p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-2">Baseline Epoch (JSON)</h2>
          <textarea value={baselineJson} onChange={e => setBaselineJson(e.target.value)} className={inputCls + ' h-48 font-mono'} placeholder='{"label":"Baseline 2024","epoch":2024.0,"monuments":[{"monumentId":"DM-01","latitude":-1.0,"longitude":37.0,"height":1500,"frame":"ITRF2014","epoch":2024.0,"sigmaE":0.002,"sigmaN":0.002}]}' />
        </div>
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-2">Current Epoch (JSON)</h2>
          <textarea value={currentJson} onChange={e => setCurrentJson(e.target.value)} className={inputCls + ' h-48 font-mono'} placeholder='{"label":"Q2 2025","epoch":2025.5,"monuments":[...]}' />
        </div>
      </div>

      <div className="flex gap-4 items-end mb-4">
        <div><label className="text-[10px] text-[var(--text-muted)] block mb-1">Tolerance H (m)</label><input value={tolH} onChange={e => setTolH(e.target.value)} className={inputCls + ' w-32'} /></div>
        <div><label className="text-[10px] text-[var(--text-muted)] block mb-1">Tolerance V (m)</label><input value={tolV} onChange={e => setTolV(e.target.value)} className={inputCls + ' w-32'} /></div>
        <button onClick={handleCompare} className="px-4 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)]">Compare Epochs</button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-xs text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

      {report && (
        <div className="space-y-4">
          <div className={`p-4 rounded-xl text-sm font-semibold ${report.verdict === 'STABLE' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : report.verdict === 'DEFORMING' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
            <div className="flex items-center gap-2"><Activity className="w-5 h-5" /> {report.verdict}</div>
            <p className="text-xs font-normal mt-1 opacity-80">{report.summary}</p>
          </div>

          {report.alerts.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-red-400 mb-2">Alerts ({report.alerts.length})</h3>
              {report.alerts.map((a, i) => (
                <div key={i} className={`p-2 mb-2 rounded text-xs ${a.severity === 'critical' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                  <span className="font-bold">{a.severity.toUpperCase()}</span> — {a.message}
                </div>
              ))}
            </div>
          )}

          <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-2">Per-Monument Vectors</h3>
            <table className="w-full text-xs">
              <thead><tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                <th className="text-left py-1">Monument</th><th className="text-right">dE (mm)</th><th className="text-right">dN (mm)</th><th className="text-right">dH (mm)</th><th className="text-right">|H| (mm)</th><th className="text-right">Bearing</th><th className="text-center">Significant?</th>
              </tr></thead>
              <tbody>
                {report.vectors.map(v => (
                  <tr key={v.monumentId} className={`border-b border-[var(--border-color)]/30 ${v.exceedsTolerance ? 'text-red-400' : 'text-[var(--text-secondary)]'}`}>
                    <td className="py-1 font-mono">{v.monumentId}</td>
                    <td className="text-right font-mono">{(v.deltaE * 1000).toFixed(2)}</td>
                    <td className="text-right font-mono">{(v.deltaN * 1000).toFixed(2)}</td>
                    <td className="text-right font-mono">{(v.deltaH * 1000).toFixed(2)}</td>
                    <td className="text-right font-mono">{(v.horizontalDisplacement * 1000).toFixed(2)}</td>
                    <td className="text-right font-mono">{v.bearing.toFixed(1)}°</td>
                    <td className="text-center">{v.isSignificant ? '✗ YES' : '✓ no'}</td>
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
