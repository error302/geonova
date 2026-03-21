'use client';

import { useState } from 'react';
import { bowditchAdjustment, transitAdjustment } from '@/lib/engine/traverse';
import { trackEvent } from '@/lib/analytics/events';
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { bowditchAdjustmentSolvedFromResult, transitAdjustmentSolvedFromResult } from '@/lib/engine/solution/wrappers/traverse'

interface Leg {
  id: number;
  name: string;
  n: string;
  e: string;
  dist: string;
  bearing: string;
}

export default function TraverseCalculator() {
  const [legs, setLegs] = useState<Leg[]>([
    { id: 1, name: 'A', n: '5000', e: '3000', dist: '250.0', bearing: '45.5234' },
    { id: 2, name: 'B', n: '', e: '', dist: '180.5', bearing: '120.1234' },
    { id: 3, name: 'C', n: '', e: '', dist: '220.75', bearing: '200.3456' },
    { id: 4, name: 'D', n: '', e: '', dist: '190.25', bearing: '290.5678' },
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
    setLegs([...legs, { id: Date.now(), name: nextChar, n: '', e: '', dist: '', bearing: '' }]);
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
      const bearings = legs.map(l => parseFloat(l.bearing)).filter(b => !isNaN(b));

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
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Traverse Adjustment</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Closed traverse adjustment using Bowditch or Transit rules</p>

      <div className="mb-4 px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-muted)] flex flex-wrap gap-x-6 gap-y-1">
        <span><span className="text-[var(--text-secondary)] font-medium">Bearings</span> — whole circle bearing in decimal degrees (e.g. 45.5234°). North = 0°, East = 90°, South = 180°, West = 270°.</span>
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
            <span className="label">Traverse Legs — Gale's Table</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Distance <span className="font-normal opacity-60">m</span></th>
                  <th>Bearing <span className="font-normal opacity-60">WCB °</span></th>
                  <th>Northing <span className="font-normal opacity-60">m</span></th>
                  <th>Easting <span className="font-normal opacity-60">m</span></th>
                </tr>
              </thead>
              <tbody>
                {legs.map((l, i) => (
                  <tr key={l.id}>
                    <td className="text-left font-semibold">{l.name}</td>
                    <td><input className="input" value={l.dist} placeholder="e.g. 250.00" onChange={e => updateLeg(l.id, 'dist', e.target.value)} /></td>
                    <td><input className="input" value={l.bearing} placeholder="e.g. 45.5234" onChange={e => updateLeg(l.id, 'bearing', e.target.value)} /></td>
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
              <ResultRow label="Closing Error (E)" value={`${result.closingErrorE.toFixed(6)} m`} />
              <ResultRow label="Closing Error (N)" value={`${result.closingErrorN.toFixed(6)} m`} />
              <ResultRow label="Linear Error" value={`${result.linearError.toFixed(6)} m`} />
              <ResultRow label="Precision Ratio" value={`1 : ${Math.round(1/result.precisionRatio)}`} highlight />
              <ResultRow label="Grade" value={result.precisionGrade} />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="label">Adjusted Coordinates</span>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Pt</th>
                    <th>Northing (m)</th>
                    <th>Easting (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.legs.map((l: any, i: number) => (
                    <tr key={i}>
                      <td className="text-left">{l.from}</td>
                      <td>{l.adjNorthing.toFixed(4)}</td>
                      <td>{l.adjEasting.toFixed(4)}</td>
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
