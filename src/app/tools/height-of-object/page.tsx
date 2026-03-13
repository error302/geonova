'use client';

import { useState } from 'react';
import { dmsToDecimal, decimalToDMS } from '@/lib/engine/angles';

export default function HeightOfObjectCalculator() {
  const [inputs, setInputs] = useState({
    distance: '',     // horizontal distance to base
    angleTop: { d: '', m: '', s: '' },    // angle to top
    angleBase: { d: '', m: '', s: '' },  // angle to base
    hi: ''            // height of instrument
  });
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    const D = parseFloat(inputs.distance);
    const alpha = dmsToDecimal({ degrees: parseInt(inputs.angleTop.d) || 0, minutes: parseInt(inputs.angleTop.m) || 0, seconds: parseFloat(inputs.angleTop.s) || 0, direction: 'N' });
    const beta = dmsToDecimal({ degrees: parseInt(inputs.angleBase.d) || 0, minutes: parseInt(inputs.angleBase.m) || 0, seconds: parseFloat(inputs.angleBase.s) || 0, direction: 'N' });
    const HI = parseFloat(inputs.hi) || 0;

    if (isNaN(D) || isNaN(alpha) || isNaN(beta)) return;

    const alphaRad = alpha * Math.PI / 180;
    const betaRad = beta * Math.PI / 180;

    const heightFromHI = D * (Math.tan(alphaRad) - Math.tan(betaRad));
    const totalHeight = heightFromHI + HI;

    setResult({
      heightFromHI,
      totalHeight,
      HI,
      formula: 'H = D×(tan(α) - tan(β)) + HI',
      substitution: `H = ${D}×(tan(${alpha.toFixed(4)}°) - tan(${beta.toFixed(4)}°)) + ${HI}`,
      steps: [
        `α (top) = ${alpha.toFixed(4)}° = ${decimalToDMS(alpha, false)}`,
        `β (base) = ${beta.toFixed(4)}° = ${decimalToDMS(beta, false)}`,
        `tan(α) = ${Math.tan(alphaRad).toFixed(6)}`,
        `tan(β) = ${Math.tan(betaRad).toFixed(6)}`,
        `Height from HI = ${D}×(${Math.tan(alphaRad).toFixed(6)} - ${Math.tan(betaRad).toFixed(6)}) = ${heightFromHI.toFixed(4)} m`,
        `Total Height = ${heightFromHI.toFixed(4)} + ${HI} = ${totalHeight.toFixed(4)} m`
      ]
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Height of Object</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Calculate height of building, tower, or tree from distance and vertical angles</p>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="card">
          <div className="card-header"><span className="label">Measurements</span></div>
          <div className="card-body space-y-4">
            <div>
              <label className="label">Horizontal Distance to Base (m)</label>
              <input className="input" value={inputs.distance} onChange={e => setInputs({...inputs, distance: e.target.value})} placeholder="50.000" />
            </div>
            <div>
              <label className="label">Angle to Top</label>
              <div className="flex gap-2">
                <input className="input flex-1" value={inputs.angleTop.d} onChange={e => setInputs({...inputs, angleTop: {...inputs.angleTop, d: e.target.value}})} placeholder="30" />
                <input className="input flex-1" value={inputs.angleTop.m} onChange={e => setInputs({...inputs, angleTop: {...inputs.angleTop, m: e.target.value}})} placeholder="15" />
                <input className="input flex-1" value={inputs.angleTop.s} onChange={e => setInputs({...inputs, angleTop: {...inputs.angleTop, s: e.target.value}})} placeholder="00" />
              </div>
            </div>
            <div>
              <label className="label">Angle to Base</label>
              <div className="flex gap-2">
                <input className="input flex-1" value={inputs.angleBase.d} onChange={e => setInputs({...inputs, angleBase: {...inputs.angleBase, d: e.target.value}})} placeholder="02" />
                <input className="input flex-1" value={inputs.angleBase.m} onChange={e => setInputs({...inputs, angleBase: {...inputs.angleBase, m: e.target.value}})} placeholder="30" />
                <input className="input flex-1" value={inputs.angleBase.s} onChange={e => setInputs({...inputs, angleBase: {...inputs.angleBase, s: e.target.value}})} placeholder="00" />
              </div>
            </div>
            <div>
              <label className="label">Height of Instrument (m)</label>
              <input className="input" value={inputs.hi} onChange={e => setInputs({...inputs, hi: e.target.value})} placeholder="1.500" />
            </div>
            <button onClick={calculate} className="btn btn-primary w-full">Calculate Height</button>
          </div>
        </div>

        {result && (
          <div className="card">
            <div className="card-header"><span className="label">Results</span></div>
            <div className="card-body space-y-4">
              <div className="text-center py-4">
                <div className="text-sm text-gray-400 mb-2">Total Height of Object</div>
                <div className="text-4xl font-mono text-[var(--accent)]">{result.totalHeight.toFixed(4)} m</div>
              </div>
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-sm text-gray-400">Height above instrument</div>
                <div className="font-mono text-[var(--accent)]">{result.heightFromHI.toFixed(4)} m</div>
              </div>
              <div className="border-t border-gray-700 pt-4">
                <div className="text-xs text-gray-500 mb-2">Formula</div>
                <div className="text-xs font-mono text-gray-400">{result.formula}</div>
              </div>
              <div className="border-t border-gray-700 pt-4">
                <div className="text-xs text-gray-500 mb-2">Calculation</div>
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
