'use client';

import { useState } from 'react';
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { compoundCurveSolved, reverseCurveSolved, simpleCurveSolved } from '@/lib/engine/solution/wrappers/curves'

type CurveType = 'simple' | 'compound' | 'reverse';

export default function CurvesCalculator() {
  const [curveType, setCurveType] = useState<CurveType>('simple');
  const [input, setInput] = useState({
    radius: '300',
    defDeg: '20',
    defMin: '00',
    defSec: '00',
    piChain: '2500.00',
    interval: '20',
    r1: '200',
    r2: '400',
    delta1: '15',
    delta2: '15',
    commonChainage: '1000',
    r1_rev: '250',
    r2_rev: '300',
    abDistance: '150'
  });
  const [result, setResult] = useState<null | { type: CurveType; title?: string; steps: SolutionStep[]; stakePoints?: any[] }>(null);

  const calculate = () => {
    if (curveType === 'simple') {
      const R = parseFloat(input.radius);
      const piChainage = parseFloat(input.piChain);
      const interval = parseFloat(input.interval);

      const deflectionDec = (parseFloat(input.defDeg) || 0) + (parseFloat(input.defMin) || 0) / 60 + (parseFloat(input.defSec) || 0) / 3600

      if (isNaN(R) || isNaN(deflectionDec) || isNaN(piChainage) || isNaN(interval)) return;

      const s = simpleCurveSolved({
        radius: R,
        deflectionDeg: deflectionDec,
        piChainage,
        interval,
      })

      setResult({ type: 'simple', title: s.solution.title, steps: s.steps, stakePoints: s.result.points })
    } else if (curveType === 'compound') {
      const R1 = parseFloat(input.r1);
      const R2 = parseFloat(input.r2);
      const delta1 = parseFloat(input.delta1);
      const delta2 = parseFloat(input.delta2);
      const commonChainage = parseFloat(input.commonChainage);

      if ([R1, R2, delta1, delta2, commonChainage].some(n => isNaN(n))) return;
      const s = compoundCurveSolved({ R1, R2, delta1Deg: delta1, delta2Deg: delta2, junctionChainage: commonChainage })
      setResult({ type: 'compound', title: s.solution.title, steps: s.steps })
    } else if (curveType === 'reverse') {
      const R1 = parseFloat(input.r1_rev);
      const R2 = parseFloat(input.r2_rev);
      const AB = parseFloat(input.abDistance);

      if (isNaN(R1) || isNaN(R2) || isNaN(AB)) return;
      const s = reverseCurveSolved({ R1, R2, AB })
      setResult({ type: 'reverse', title: s.solution.title, steps: s.steps })
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Curve Calculator</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Horizontal curve calculations</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => { setCurveType('simple'); setResult(null); }} className={`px-4 py-2 rounded-lg font-medium ${curveType === 'simple' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}>Simple Curve</button>
        <button onClick={() => { setCurveType('compound'); setResult(null); }} className={`px-4 py-2 rounded-lg font-medium ${curveType === 'compound' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}>Compound Curve</button>
        <button onClick={() => { setCurveType('reverse'); setResult(null); }} className={`px-4 py-2 rounded-lg font-medium ${curveType === 'reverse' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}>Reverse Curve</button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-6">
            {curveType === 'simple' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Radius (m)</label><input className="input" value={input.radius} onChange={e => setInput({...input, radius: e.target.value})} /></div>
                  <div><label className="label">Deflection (° ' ")</label>
                    <div className="grid grid-cols-3 gap-1">
                      <input className="input" value={input.defDeg} onChange={e => setInput({...input, defDeg: e.target.value})} />
                      <input className="input" value={input.defMin} onChange={e => setInput({...input, defMin: e.target.value})} />
                      <input className="input" value={input.defSec} onChange={e => setInput({...input, defSec: e.target.value})} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div><label className="label">PI Chainage (m)</label><input className="input" value={input.piChain} onChange={e => setInput({...input, piChain: e.target.value})} /></div>
                  <div><label className="label">Interval (m)</label><input className="input" value={input.interval} onChange={e => setInput({...input, interval: e.target.value})} /></div>
                </div>
              </>
            )}
            {curveType === 'compound' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Radius R1 (m)</label><input className="input" value={input.r1} onChange={e => setInput({...input, r1: e.target.value})} /></div>
                  <div><label className="label">Radius R2 (m)</label><input className="input" value={input.r2} onChange={e => setInput({...input, r2: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div><label className="label">Δ1 (degrees)</label><input className="input" value={input.delta1} onChange={e => setInput({...input, delta1: e.target.value})} /></div>
                  <div><label className="label">Δ2 (degrees)</label><input className="input" value={input.delta2} onChange={e => setInput({...input, delta2: e.target.value})} /></div>
                </div>
                <div className="mt-4"><label className="label">Junction Chainage (m)</label><input className="input" value={input.commonChainage} onChange={e => setInput({...input, commonChainage: e.target.value})} /></div>
              </>
            )}
            {curveType === 'reverse' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Radius R1 (m)</label><input className="input" value={input.r1_rev} onChange={e => setInput({...input, r1_rev: e.target.value})} /></div>
                  <div><label className="label">Radius R2 (m)</label><input className="input" value={input.r2_rev} onChange={e => setInput({...input, r2_rev: e.target.value})} /></div>
                </div>
                <div className="mt-4"><label className="label">Distance AB (m)</label><input className="input" value={input.abDistance} onChange={e => setInput({...input, abDistance: e.target.value})} /></div>
              </>
            )}
          </div>
          <button onClick={calculate} className="w-full px-6 py-4 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-bold rounded-lg">Calculate</button>
        </div>

        {result && (
          <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-6">
            <SolutionStepsRenderer title={result.title} steps={result.steps} />

            {result.type === 'simple' && result.stakePoints && result.stakePoints.length > 0 ? (
              <div className="mt-6">
                <h3 className="font-semibold text-[var(--text-primary)] mb-3">Stakeout Table</h3>
                <div className="max-h-56 overflow-y-auto text-sm border border-[var(--border-color)] rounded">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-950/40">
                        <th className="text-left px-3 py-2">Chainage</th>
                        <th className="text-right px-3 py-2">Chord (m)</th>
                        <th className="text-right px-3 py-2">Deflection</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.stakePoints.map((p: any, i: number) => (
                        <tr key={i} className="border-t border-[var(--border-color)]">
                          <td className="px-3 py-2 font-mono">{p.chainage.toFixed(3)}</td>
                          <td className="px-3 py-2 text-right font-mono">{p.chordLength?.toFixed?.(3) ?? '—'}</td>
                          <td className="px-3 py-2 text-right font-mono">{p.totalDeflection ?? p.deflectionAngle ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );

  }
