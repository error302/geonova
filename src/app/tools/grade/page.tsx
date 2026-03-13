'use client';

import { useState } from 'react';

export default function GradeCalculator() {
  const [elev1, setElev1] = useState('');
  const [elev2, setElev2] = useState('');
  const [distance, setDistance] = useState('');
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    const e1 = parseFloat(elev1);
    const e2 = parseFloat(elev2);
    const d = parseFloat(distance);

    if (isNaN(e1) || isNaN(e2) || isNaN(d) || d === 0) return;

    const riseFall = e2 - e1;
    const gradientPercent = (riseFall / d) * 100;
    const gradientRatio = Math.abs(d / riseFall);
    const slopeAngle = Math.atan(riseFall / d) * 180 / Math.PI;

    setResult({
      riseFall,
      gradientPercent,
      gradientRatio: isFinite(gradientRatio) ? gradientRatio : 0,
      slopeAngle,
      formula: 'G% = (ΔH/D)×100, θ = atan(ΔH/D)',
      substitution: `G% = (${e2.toFixed(4)} - ${e1.toFixed(4)})/${d}×100`,
      steps: [
        `Rise/Fall = ${e2.toFixed(4)} - ${e1.toFixed(4)} = ${riseFall.toFixed(4)} m`,
        `Gradient % = (${riseFall.toFixed(4)} / ${d}) × 100 = ${gradientPercent.toFixed(4)}%`,
        `Gradient Ratio = 1 : ${isFinite(gradientRatio) ? gradientRatio.toFixed(2) : '∞'}`,
        `Slope Angle = atan(${riseFall.toFixed(4)} / ${d}) = ${slopeAngle.toFixed(4)}°`
      ]
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Grade / Slope Calculator</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Calculate gradient percentage, ratio, and slope angle</p>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="card">
          <div className="card-header"><span className="label">Elevations & Distance</span></div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Elevation 1 (m)</label>
                <input className="input" value={elev1} onChange={e => setElev1(e.target.value)} placeholder="100.000" />
              </div>
              <div>
                <label className="label">Elevation 2 (m)</label>
                <input className="input" value={elev2} onChange={e => setElev2(e.target.value)} placeholder="105.500" />
              </div>
            </div>
            <div>
              <label className="label">Horizontal Distance (m)</label>
              <input className="input" value={distance} onChange={e => setDistance(e.target.value)} placeholder="50.000" />
            </div>
            <button onClick={calculate} className="btn btn-primary w-full">Calculate Grade</button>
          </div>
        </div>

        {result && (
          <div className="card">
            <div className="card-header"><span className="label">Results</span></div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 p-4 rounded text-center">
                  <div className="text-sm text-gray-400">Gradient</div>
                  <div className="text-2xl font-mono text-[var(--accent)]">{result.gradientPercent.toFixed(2)}%</div>
                </div>
                <div className="bg-gray-800 p-4 rounded text-center">
                  <div className="text-sm text-gray-400">Slope Angle</div>
                  <div className="text-2xl font-mono text-[var(--accent)]">{result.slopeAngle.toFixed(2)}°</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 p-3 rounded">
                  <div className="text-xs text-gray-400">Rise/Fall</div>
                  <div className="font-mono text-[var(--accent)]">{result.riseFall >= 0 ? '+' : ''}{result.riseFall.toFixed(4)} m</div>
                </div>
                <div className="bg-gray-800 p-3 rounded">
                  <div className="text-xs text-gray-400">Ratio</div>
                  <div className="font-mono text-[var(--accent)]">1 : {result.gradientRatio.toFixed(2)}</div>
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
