'use client';

import { useState } from 'react';
import { dmsToDecimal } from '@/lib/engine/angles';

export default function TacheometryCalculator() {
  const [inputs, setInputs] = useState({
    hi: '',           // instrument height
    upper: '',        // upper staff reading
    middle: '',       // middle staff reading  
    lower: '',        // lower staff reading
    vertDeg: '',      // vertical angle degrees
    vertMin: '',      // vertical angle minutes
    vertSec: '',      // vertical angle seconds
    k: '100',         // multiplying constant
    c: '0'            // additive constant
  });
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    const HI = parseFloat(inputs.hi);
    const upper = parseFloat(inputs.upper);
    const middle = parseFloat(inputs.middle);
    const lower = parseFloat(inputs.lower);
    const vertAngle = dmsToDecimal({ 
      degrees: parseInt(inputs.vertDeg) || 0, 
      minutes: parseInt(inputs.vertMin) || 0, 
      seconds: parseFloat(inputs.vertSec) || 0,
      direction: 'N'
    });
    const K = parseFloat(inputs.k) || 100;
    const C = parseFloat(inputs.c) || 0;

    if (isNaN(HI) || isNaN(upper) || isNaN(middle) || isNaN(lower) || isNaN(vertAngle)) return;

    const S = upper - lower; // staff intercept
    const rad = vertAngle * Math.PI / 180;

    // Tacheometry formulas
    const horizDist = K * S * Math.pow(Math.cos(rad), 2) + C;
    const vertDist = 0.5 * K * S * Math.sin(2 * rad);
    const elevOfStaff = HI + vertDist - middle;

    setResult({
      S,
      vertAngle,
      horizDist,
      vertDist,
      elevOfStaff,
      HI,
      middle,
      formulas: {
        horiz: 'D = K×S×cos²(θ)',
        vert: 'V = ½K×S×sin(2θ)',
        elev: 'RL = HI + V - middle'
      },
      substitution: {
        horiz: `D = ${K}×${S.toFixed(4)}×cos²(${vertAngle.toFixed(4)}°)`,
        vert: `V = 0.5×${K}×${S.toFixed(4)}×sin(2×${vertAngle.toFixed(4)}°)`
      },
      steps: [
        `Staff Intercept S = ${upper.toFixed(4)} - ${lower.toFixed(4)} = ${S.toFixed(4)} m`,
        `θ = ${vertAngle.toFixed(4)}°`,
        `cos²(θ) = ${Math.pow(Math.cos(rad), 2).toFixed(6)}`,
        `Horizontal Distance = ${K} × ${S.toFixed(4)} × ${Math.pow(Math.cos(rad), 2).toFixed(6)} = ${horizDist.toFixed(4)} m`,
        `sin(2θ) = ${Math.sin(2 * rad).toFixed(6)}`,
        `Vertical Distance = 0.5 × ${K} × ${S.toFixed(4)} × ${Math.sin(2 * rad).toFixed(6)} = ${vertDist.toFixed(4)} m`,
        `Staff Station RL = ${HI.toFixed(4)} + ${vertDist.toFixed(4)} - ${middle.toFixed(4)} = ${elevOfStaff.toFixed(4)} m`
      ]
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Tacheometry</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Calculate horizontal distance and elevation from staff intercept and vertical angle</p>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="card">
          <div className="card-header"><span className="label">Tacheometry Data</span></div>
          <div className="card-body space-y-4">
            <div>
              <label className="label">Instrument Height HI (m)</label>
              <input className="input" value={inputs.hi} onChange={e => setInputs({...inputs, hi: e.target.value})} placeholder="1.500" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label">Upper</label>
                <input className="input" value={inputs.upper} onChange={e => setInputs({...inputs, upper: e.target.value})} placeholder="1.850" />
              </div>
              <div>
                <label className="label">Middle</label>
                <input className="input" value={inputs.middle} onChange={e => setInputs({...inputs, middle: e.target.value})} placeholder="1.500" />
              </div>
              <div>
                <label className="label">Lower</label>
                <input className="input" value={inputs.lower} onChange={e => setInputs({...inputs, lower: e.target.value})} placeholder="1.150" />
              </div>
            </div>
            <div>
              <label className="label">Vertical Angle</label>
              <div className="flex gap-2">
                <input className="input flex-1" value={inputs.vertDeg} onChange={e => setInputs({...inputs, vertDeg: e.target.value})} placeholder="05" />
                <input className="input flex-1" value={inputs.vertMin} onChange={e => setInputs({...inputs, vertMin: e.target.value})} placeholder="30" />
                <input className="input flex-1" value={inputs.vertSec} onChange={e => setInputs({...inputs, vertSec: e.target.value})} placeholder="00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Multiplying Constant K</label>
                <input className="input" value={inputs.k} onChange={e => setInputs({...inputs, k: e.target.value})} placeholder="100" />
              </div>
              <div>
                <label className="label">Additive Constant C</label>
                <input className="input" value={inputs.c} onChange={e => setInputs({...inputs, c: e.target.value})} placeholder="0" />
              </div>
            </div>
            <button onClick={calculate} className="btn btn-primary w-full">Calculate</button>
          </div>
        </div>

        {result && (
          <div className="card">
            <div className="card-header"><span className="label">Results</span></div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 p-4 rounded text-center">
                  <div className="text-sm text-gray-400">Horizontal Distance</div>
                  <div className="text-2xl font-mono text-[var(--accent)]">{result.horizDist.toFixed(4)} m</div>
                </div>
                <div className="bg-gray-800 p-4 rounded text-center">
                  <div className="text-sm text-gray-400">Elevation</div>
                  <div className="text-2xl font-mono text-[var(--accent)]">{result.elevOfStaff.toFixed(4)} m</div>
                </div>
              </div>
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-sm text-gray-400 mb-1">Vertical Distance</div>
                <div className="font-mono text-[var(--accent)]">{result.vertDist >= 0 ? '+' : ''}{result.vertDist.toFixed(4)} m</div>
              </div>
              <div className="border-t border-gray-700 pt-4">
                <div className="text-xs text-gray-500 mb-2">Formulas</div>
                <div className="text-xs font-mono text-gray-400">D = {result.formulas.horiz}</div>
                <div className="text-xs font-mono text-gray-400">V = {result.formulas.vert}</div>
                <div className="text-xs font-mono text-gray-400">RL = {result.formulas.elev}</div>
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
