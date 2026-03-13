'use client';

import { useState } from 'react';
import { distanceBearing } from '@/lib/engine/distance';
import { decimalToDMS } from '@/lib/engine/angles';

export default function MissingLineCalculator() {
  const [pointA, setPointA] = useState({ e: '', n: '' });
  const [pointB, setPointB] = useState({ e: '', n: '' });
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    const e1 = parseFloat(pointA.e);
    const n1 = parseFloat(pointA.n);
    const e2 = parseFloat(pointB.e);
    const n2 = parseFloat(pointB.n);

    if (isNaN(e1) || isNaN(n1) || isNaN(e2) || isNaN(n2)) return;

    const r = distanceBearing({ easting: e1, northing: n1 }, { easting: e2, northing: n2 });

    setResult({
      distance: r.distance,
      bearing: r.bearing,
      bearingDMS: r.bearingDMS,
      deltaE: r.deltaE,
      deltaN: r.deltaN,
      formula: 'D = √(ΔE² + ΔN²), θ = atan2(ΔE, ΔN)',
      substitution: `D = √(${r.deltaE.toFixed(4)}² + ${r.deltaN.toFixed(4)}²), θ = atan2(${r.deltaE.toFixed(4)}, ${r.deltaN.toFixed(4)})`,
      steps: [
        `ΔE = ${e2.toFixed(4)} - ${e1.toFixed(4)} = ${r.deltaE.toFixed(4)} m`,
        `ΔN = ${n2.toFixed(4)} - ${n1.toFixed(4)} = ${r.deltaN.toFixed(4)} m`,
        `Distance = √(${r.deltaE.toFixed(4)}² + ${r.deltaN.toFixed(4)}²) = ${r.distance.toFixed(4)} m`,
        `Bearing = ${r.bearing.toFixed(4)}° = ${r.bearingDMS}`
      ]
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Missing Line</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Calculate distance and bearing between two points</p>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="card">
          <div className="card-header"><span className="label">Point A → Point B</span></div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Point A Easting (m)</label>
                <input className="input" value={pointA.e} onChange={e => setPointA({...pointA, e: e.target.value})} placeholder="500000.0000" />
              </div>
              <div>
                <label className="label">Point A Northing (m)</label>
                <input className="input" value={pointA.n} onChange={e => setPointA({...pointA, n: e.target.value})} placeholder="9500000.0000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Point B Easting (m)</label>
                <input className="input" value={pointB.e} onChange={e => setPointB({...pointB, e: e.target.value})} placeholder="500050.0000" />
              </div>
              <div>
                <label className="label">Point B Northing (m)</label>
                <input className="input" value={pointB.n} onChange={e => setPointB({...pointB, n: e.target.value})} placeholder="9500030.0000" />
              </div>
            </div>
            <button onClick={calculate} className="btn btn-primary w-full">Calculate Missing Line</button>
          </div>
        </div>

        {result && (
          <div className="card">
            <div className="card-header"><span className="label">Results</span></div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 p-4 rounded text-center">
                  <div className="text-sm text-gray-400">Distance</div>
                  <div className="text-3xl font-mono text-[var(--accent)]">{result.distance.toFixed(4)} m</div>
                </div>
                <div className="bg-gray-800 p-4 rounded text-center">
                  <div className="text-sm text-gray-400">Bearing</div>
                  <div className="text-2xl font-mono text-[var(--accent)]">{result.bearingDMS}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-800 p-3 rounded">
                  <div className="text-xs text-gray-400">ΔEasting</div>
                  <div className="font-mono text-[var(--accent)]">{result.deltaE >= 0 ? '+' : ''}{result.deltaE.toFixed(4)} m</div>
                </div>
                <div className="bg-gray-800 p-3 rounded">
                  <div className="text-xs text-gray-400">ΔNorthing</div>
                  <div className="font-mono text-[var(--accent)]">{result.deltaN >= 0 ? '+' : ''}{result.deltaN.toFixed(4)} m</div>
                </div>
              </div>
              <div className="border-t border-gray-700 pt-4">
                <div className="text-xs text-gray-500 mb-2">{result.formula}</div>
                {result.steps.map((step: string, i: number) => (
                  <div key={i} className="text-xs font-mono text-gray-400">{step}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
