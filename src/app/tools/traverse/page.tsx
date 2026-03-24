'use client';

import { useState } from 'react';
import { bowditchAdjustment, transitAdjustment } from '@/lib/engine/traverse';
import { trackEvent } from '@/lib/analytics/events';
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { bowditchAdjustmentSolvedFromResult, transitAdjustmentSolvedFromResult } from '@/lib/engine/solution/wrappers/traverse'
import { computeTraverseAccuracy } from '@/lib/reports/traverseAccuracy'

interface Leg {
  id: number;
  name: string;
  n: string;
  e: string;
  dist: string;
  bearingD: string;
  bearingM: string;
  bearingS: string;
}

function dmsToDecimal(d: string, m: string, s: string): number {
  const deg = parseFloat(d) || 0;
  const min = parseFloat(m) || 0;
  const sec = parseFloat(s) || 0;
  return deg + min / 60 + sec / 3600;
}

export default function TraverseCalculator() {
  const [legs, setLegs] = useState<Leg[]>([
    { id: 1, name: 'A', n: '5000', e: '3000', dist: '250.0', bearingD: '45', bearingM: '32', bearingS: '08' },
    { id: 2, name: 'B', n: '', e: '', dist: '180.5', bearingD: '120', bearingM: '07', bearingS: '24' },
    { id: 3, name: 'C', n: '', e: '', dist: '220.75', bearingD: '200', bearingM: '20', bearingS: '44' },
    { id: 4, name: 'D', n: '', e: '', dist: '190.25', bearingD: '290', bearingM: '34', bearingS: '04' },
  ]);
  const [method, setMethod] = useState<'bowditch' | 'transit'>('bowditch');
  const [result, setResult] = useState<any>(null);
  const [steps, setSteps] = useState<SolutionStep[] | null>(null)
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined)
  const [calcError, setCalcError] = useState<string | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [copied, setCopied] = useState(false)

  const addLeg = () => {
    const nextChar = String.fromCharCode(65 + legs.length);
    setLegs([...legs, { id: Date.now(), name: nextChar, n: '', e: '', dist: '', bearingD: '', bearingM: '', bearingS: '' }]);
  };

  const updateLeg = (id: number, field: keyof Leg, value: string) => {
    setLegs(legs.map(l => l.id === id ? { ...l, [field]: value } : l));
  };


  const copyResults = () => {
    if (!result) return
    const header = [
      `METARDU Traverse — ${method === 'bowditch' ? 'Bowditch' : 'Transit'} Method`,
      `Total Distance: ${result.totalDistance.toFixed(4)} m`,
      `Linear Error: ${result.linearError.toFixed(6)} m`,
      `Precision Ratio: 1 : ${Math.round(1 / result.precisionRatio)}`,
      `Grade: ${result.precisionGrade}`,
      '',
      'Adjusted Coordinates:',
    ]
    const rows = result.legs.map((l: any) =>
      `  ${l.pointName ?? '—'}  E: ${l.adjEasting?.toFixed(4) ?? '—'}  N: ${l.adjNorthing?.toFixed(4) ?? '—'}`
    )
    navigator.clipboard.writeText([...header, ...rows].join('\n'))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => {})
  }

  const calculate = () => {
    setCalcError(null)
    setCalculating(true)
    try {
      const points = legs
        .filter(l => l.n && l.e)
        .map(l => ({ name: l.name, northing: parseFloat(l.n), easting: parseFloat(l.e) }));

      const distances = legs.map(l => parseFloat(l.dist)).filter(d => !isNaN(d));
      const bearings = legs.map(l => dmsToDecimal(l.bearingD, l.bearingM, l.bearingS)).filter(b => !isNaN(b));

      if (points.length < 2 || distances.length < 2 || bearings.length < 2) {
        setCalcError('Please enter at least 2 legs with valid distances, bearings, and at least one known coordinate.')
        return
      }

      const r = method === 'bowditch'
        ? bowditchAdjustment({ points, distances, bearings })
        : transitAdjustment({ points, distances, bearings });
      setResult(r);
      trackEvent('tool_used', { tool: 'traverse', method });
      try {
        const s = method === 'bowditch' ? bowditchAdjustmentSolvedFromResult(r) : transitAdjustmentSolvedFromResult(r)
        setSteps(s.steps)
        setSolutionTitle(s.solution.title)
      } catch {
        setSteps(null)
        setSolutionTitle(undefined)
      }
    } catch (err: any) {
      setCalcError(err?.message || 'Calculation failed. Check your inputs.')
      setResult(null)
      setSteps(null)
    } finally {
      setCalculating(false)
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 md:px-4 py-4 md:py-8">
      <h1 className="text-3xl font-bold mb-2">Traverse Adjustment</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Closed traverse adjustment using Bowditch or Transit rules</p>

      <div className="mb-4 px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-muted)] flex flex-wrap gap-x-6 gap-y-1">
        <span><span className="text-[var(--text-secondary)] font-medium">Bearings</span> — Enter Whole Circle Bearing in Degrees Minutes Seconds as read from your instrument.</span>
        <span><span className="text-[var(--text-secondary)] font-medium">Distances</span> — horizontal distances in metres.</span>
        <span><span className="text-[var(--text-secondary)] font-medium">First row</span> — must have Northing &amp; Easting coordinates (the starting known point).</span>
      </div>

      <div className="flex gap-4 mb-6">
        <button onClick={() => { setMethod('bowditch'); setResult(null); setSteps(null); setSolutionTitle(undefined); }} className={`btn ${method === 'bowditch' ? 'btn-primary' : 'btn-secondary'}`}>
          Bowditch Rule
        </button>
        <button onClick={() => { setMethod('transit'); setResult(null); setSteps(null); setSolutionTitle(undefined); }} className={`btn ${method === 'transit' ? 'btn-primary' : 'btn-secondary'}`}>
          Transit Rule
        </button>
      </div>

      <div className="grid gap-6 mb-6">
        <div className="card">
          <div className="card-header">
            <span className="label">Traverse Computation Table — Bowditch Adjustment</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[550px] table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Dist (m)</th>
                  <th>WCB</th>
                  <th>N (m)</th>
                  <th>E (m)</th>
                </tr>
              </thead>
              <tbody>
                {legs.map((l, i) => (
                  <tr key={l.id}>
                    <td className="text-left font-semibold">{l.name}</td>
                    <td><input className="input" value={l.dist} placeholder="e.g. 250.00" onChange={e => updateLeg(l.id, 'dist', e.target.value)} /></td>
                    <td>
                      <div className="flex items-center gap-0.5 md:gap-1">
                        <input className="input w-10 md:w-12 text-center text-xs md:text-sm" value={l.bearingD} placeholder="DDD" maxLength={3} onChange={e => updateLeg(l.id, 'bearingD', e.target.value)} />
                        <span className="text-[var(--text-muted)] text-xs">°</span>
                        <input className="input w-8 md:w-10 text-center text-xs md:text-sm" value={l.bearingM} placeholder="MM" maxLength={2} onChange={e => updateLeg(l.id, 'bearingM', e.target.value)} />
                        <span className="text-[var(--text-muted)] text-xs">&apos;</span>
                        <input className="input w-10 md:w-12 text-center text-xs md:text-sm" value={l.bearingS} placeholder="SS" maxLength={5} onChange={e => updateLeg(l.id, 'bearingS', e.target.value)} />
                        <span className="text-[var(--text-muted)] text-xs">&quot;</span>
                      </div>
                    </td>
                    <td><input className="input" value={l.n} placeholder={i === 0 ? 'required' : 'auto'} onChange={e => updateLeg(l.id, 'n', e.target.value)} /></td>
                    <td><input className="input" value={l.e} placeholder={i === 0 ? 'required' : 'auto'} onChange={e => updateLeg(l.id, 'e', e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4">
            <button onClick={addLeg} className="btn btn-secondary">+ Add Leg</button>
          </div>
        </div>

        <button onClick={calculate} disabled={calculating} className="btn btn-primary disabled:opacity-60 disabled:cursor-not-allowed">
          {calculating ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              Calculating…
            </>
          ) : 'Calculate Adjustment'}
        </button>
      </div>

      {calcError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 mb-6 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <p className="font-semibold">Error</p>
          <p>{calcError}</p>
        </div>
      )}

      {result && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <span className="label">Error Analysis</span>
              <div className="flex items-center gap-2">
                <span className={`badge ${result.isClosed ? 'badge-success' : 'badge-warning'}`}>
                  {result.isClosed ? 'Closed' : 'Not Closed'}
                </span>
                <button
                  onClick={copyResults}
                  className="text-xs text-[var(--accent)] hover:text-[var(--accent-dim)] transition-colors"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="card-body space-y-3">
              <ResultRow label="Method" value={method === 'bowditch' ? 'Bowditch Rule' : 'Transit Rule'} />
              <ResultRow label="Total Distance" value={`${result.totalDistance.toFixed(4)} m`} />
              <ResultRow label="ΣDepartures" value={`${result.legs.reduce((s: number, l: any) => s + l.departure, 0).toFixed(4)} m`} />
              <ResultRow label="ΣLatitudes" value={`${result.legs.reduce((s: number, l: any) => s + l.latitude, 0).toFixed(4)} m`} />
              <ResultRow label="Linear Misclosure" value={`${result.linearError.toFixed(6)} m`} />
              <ResultRow label="Precision Ratio" value={`1 : ${Math.round(1/result.precisionRatio)}`} highlight />
            </div>
          </div>

          {(() => {
            const acc = computeTraverseAccuracy(result.linearError, result.totalDistance)
            if (!acc) return null
            const badgeClass = acc.order === 'FIRST ORDER CLASS I' ? 'bg-emerald-700 text-white'
              : acc.order === 'FIRST ORDER CLASS II' ? 'bg-emerald-600 text-white'
              : acc.order === 'SECOND ORDER CLASS I' ? 'bg-amber-500 text-black'
              : acc.order === 'SECOND ORDER CLASS II' ? 'bg-orange-600 text-white'
              : 'bg-red-600 text-white'
            return (
              <div className="card">
                <div className="card-header">
                  <span className="label">Traverse Accuracy — RDM 1.1</span>
                </div>
                <div className="card-body space-y-3">
                  <ResultRow label="Total Perimeter" value={`${result.totalDistance.toFixed(4)} m`} />
                  <ResultRow label="Linear Misclosure" value={`${result.linearError.toFixed(6)} m`} />
                  <ResultRow label="Precision Ratio" value={`1 : ${Math.round(1 / result.precisionRatio)}`} />
                  <ResultRow label="Allowable (RDM 1.1)" value={`m = ${acc.m_mm}√K mm`} />
                  <ResultRow label="Computed m" value={`${acc.allowed.toFixed(4)} mm/√km`} />
                  <div className="mt-3 p-4 rounded-lg text-center">
                    <p className="text-xs text-[var(--text-muted)] mb-2">TRAVERSE ACCURACY</p>
                    <span className={`inline-block px-4 py-2 rounded-lg font-bold text-sm ${badgeClass}`}>
                      {acc.order}
                    </span>
                    <p className="text-xs text-[var(--text-muted)] mt-2 font-mono">{acc.formula}</p>
                  </div>
                </div>
              </div>
            )
          })()}

          <div className="card">
            <div className="card-header">
              <span className="label">Table 1 — Traverse Computation</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] px-4 pt-2">Source: Ghilani &amp; Wolf, Elementary Surveying 16th Ed., Chapter 10, Table 10.1</p>
            <div className="overflow-x-auto">
              <table className="min-w-[550px] table">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>WCB</th>
                    <th className="text-right">HD</th>
                    <th className="text-right">DEP</th>
                    <th className="text-right">LAT</th>
                  </tr>
                </thead>
                <tbody>
                  {result.legs.map((l: any, i: number) => (
                    <tr key={i}>
                      <td className="font-semibold">{l.from} → {l.to}</td>
                      <td className="font-mono">{l.bearingDMS}</td>
                      <td className="text-right font-mono">{l.distance.toFixed(4)}</td>
                      <td className="text-right font-mono">{l.departure >= 0 ? '+' : ''}{l.departure.toFixed(4)}</td>
                      <td className="text-right font-mono">{l.latitude >= 0 ? '+' : ''}{l.latitude.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold bg-[var(--bg-tertiary)]">
                    <td colSpan={3} className="text-right">Σ</td>
                    <td className="text-right font-mono">{result.legs.reduce((s: number, l: any) => s + l.departure, 0).toFixed(4)}</td>
                    <td className="text-right font-mono">{result.legs.reduce((s: number, l: any) => s + l.latitude, 0).toFixed(4)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="label">Table 2 — Bowditch Corrections</span>
            </div>
              <div className="overflow-x-auto">
                <table className="min-w-[650px] table">
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th className="text-right">HD</th>
                      <th className="text-right">C-Dep</th>
                      <th className="text-right">C-Lat</th>
                      <th className="text-right">A-Dep</th>
                      <th className="text-right">A-Lat</th>
                    </tr>
                </thead>
                <tbody>
                  {result.legs.map((l: any, i: number) => (
                    <tr key={i}>
                      <td className="font-semibold">{l.from} → {l.to}</td>
                      <td className="text-right font-mono">{l.distance.toFixed(4)}</td>
                      <td className="text-right font-mono">{(l.correctedDeparture - l.departure).toFixed(4)}</td>
                      <td className="text-right font-mono">{(l.correctedLatitude - l.latitude).toFixed(4)}</td>
                      <td className="text-right font-mono font-semibold">{l.correctedDeparture.toFixed(4)}</td>
                      <td className="text-right font-mono font-semibold">{l.correctedLatitude.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="label">Table 3 — Adjusted Coordinates</span>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Point</th>
                    <th className="text-right">EASTING (m)</th>
                    <th className="text-right">NORTHING (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.legs.map((l: any, i: number) => (
                    <tr key={i}>
                      <td className="font-semibold">{l.to}</td>
                      <td className="text-right font-mono font-semibold text-[var(--accent)]">{l.adjEasting.toFixed(4)}</td>
                      <td className="text-right font-mono font-semibold text-[var(--accent)]">{l.adjNorthing.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {steps ? (
            <div className="md:col-span-2">
              <SolutionStepsRenderer title={solutionTitle} steps={steps} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className={`font-mono ${highlight ? 'result-accent font-bold' : ''}`}>{value}</span>
    </div>
  );
}
