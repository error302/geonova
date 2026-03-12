'use client';

import { useState } from 'react';
import { curveElements, curveStakeout } from '@/lib/engine/curves';

export default function CurvesCalculator() {
  const [input, setInput] = useState({ radius: '500', deflection: '30', piChain: '2500', interval: '20' });
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    const r = parseFloat(input.radius), d = parseFloat(input.deflection), pc = parseFloat(input.piChain), int = parseFloat(input.interval);
    if (isNaN(r) || isNaN(d)) return;
    
    const elements = curveElements(r, d);
    
    if (!isNaN(pc) && !isNaN(int)) {
      const stakeout = curveStakeout(pc, 0, r, d, int);
      setResult({ elements, stakeout });
    } else {
      setResult({ elements, stakeout: null });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Horizontal Curve Calculator</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Based on N.N. Basak, Chapter 10</p>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="card">
            <div className="card-header"><span className="label">Curve Parameters</span></div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Radius (m)</label><input className="input" value={input.radius} onChange={e => setInput({...input, radius: e.target.value})} /></div>
                <div><label className="label">Deflection Angle (°)</label><input className="input" value={input.deflection} onChange={e => setInput({...input, deflection: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">PI Chainage (m)</label><input className="input" value={input.piChain} onChange={e => setInput({...input, piChain: e.target.value})} placeholder="Optional" /></div>
                <div><label className="label">Stakeout Interval (m)</label><input className="input" value={input.interval} onChange={e => setInput({...input, interval: e.target.value})} placeholder="20" /></div>
              </div>
            </div>
          </div>
          <button onClick={calculate} className="btn btn-primary w-full">Calculate</button>
        </div>

        {result && (
          <div className="space-y-6">
            <div className="card">
              <div className="card-header"><span className="label">Curve Elements</span></div>
              <div className="card-body space-y-3">
                <ResultRow label="Radius (R)" value={`${result.elements.radius} m`} />
                <ResultRow label="Deflection Angle (Δ)" value={`${result.elements.deflectionAngle}°`} />
                <ResultRow label="Tangent Length (T)" value={`${result.elements.tangentLength} m`} />
                <ResultRow label="Arc Length (L)" value={`${result.elements.arcLength} m`} />
                <ResultRow label="Long Chord (C)" value={`${result.elements.longChord} m`} />
                <ResultRow label="External Distance (E)" value={`${result.elements.externalDistance} m`} />
                <ResultRow label="Mid-Ordinate (M)" value={`${result.elements.midOrdinate} m`} />
                <ResultRow label="Degree of Curve (D)" value={`${result.elements.degreeOfCurve}°`} />
              </div>
            </div>

            {result.stakeout && (
              <div className="card">
                <div className="card-header"><span className="label">Stakeout Table</span></div>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Chainage</th>
                        <th>Deflection</th>
                        <th>Total Defl.</th>
                        <th>Chord</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.stakeout.points.map((p: any, i: number) => (
                        <tr key={i}>
                          <td>{p.chainage}</td>
                          <td>{p.deflectionAngle}</td>
                          <td>{p.totalDeflection}</td>
                          <td>{p.chordLength}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
