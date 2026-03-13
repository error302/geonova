'use client';

import { useState } from 'react';

export default function TwoPegTestCalculator() {
  const [inputs, setInputs] = useState({
    a1: '',  // Staff at A from position 1
    b1: '',  // Staff at B from position 1
    a2: '',  // Staff at A from position 2
    b2: ''   // Staff at B from position 2
  });
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    const A1 = parseFloat(inputs.a1);
    const B1 = parseFloat(inputs.b1);
    const A2 = parseFloat(inputs.a2);
    const B2 = parseFloat(inputs.b2);

    if (isNaN(A1) || isNaN(B1) || isNaN(A2) || isNaN(B2)) return;

    // True difference in elevation (average of both setups)
    const trueDiff = ((A1 - B1) + (A2 - B2)) / 2;
    
    // Observed differences
    const obsDiff1 = A1 - B1;
    const obsDiff2 = A2 - B2;
    
    // Collimation error (difference between observed and true)
    const collimationError = (obsDiff1 - obsDiff2) / 2;
    
    // Collimation error per 100m (assuming 100m baseline)
    const collimationPer100m = collimationError * 100 / 100; // per 100m
    
    // Pass/Fail based on acceptable error (typically 10mm per 100m)
    const acceptableError = 0.010; // 10mm per 100m
    const isPass = Math.abs(collimationPer100m) <= acceptableError;

    setResult({
      trueDiff,
      obsDiff1,
      obsDiff2,
      collimationError,
      collimationPer100m,
      isPass,
      formula: 'Error = (Obs₁ - Obs₂) / 2',
      substitution: `Error = (${obsDiff1.toFixed(4)} - ${obsDiff2.toFixed(4)}) / 2`,
      steps: [
        `Setup 1: A - B = ${A1.toFixed(4)} - ${B1.toFixed(4)} = ${obsDiff1.toFixed(4)} m`,
        `Setup 2: A - B = ${A2.toFixed(4)} - ${B2.toFixed(4)} = ${obsDiff2.toFixed(4)} m`,
        `True diff = (${obsDiff1.toFixed(4)} + ${obsDiff2.toFixed(4)}) / 2 = ${trueDiff.toFixed(4)} m`,
        `Collimation error = (${obsDiff1.toFixed(4)} - ${obsDiff2.toFixed(4)}) / 2 = ${collimationError.toFixed(4)} m`,
        `Error per 100m = ${collimationError.toFixed(4)} × 100 / 100 = ${(collimationPer100m * 1000).toFixed(2)} mm/100m`
      ]
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Two Peg Test</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Check leveling instrument collimation error</p>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="card">
          <div className="card-header"><span className="label">Staff Readings</span></div>
          <div className="card-body space-y-4">
            <div className="border-b border-gray-700 pb-4 mb-4">
              <div className="text-sm text-gray-400 mb-3">Instrument Position 1</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Staff at A (m)</label>
                  <input className="input" value={inputs.a1} onChange={e => setInputs({...inputs, a1: e.target.value})} placeholder="1.525" />
                </div>
                <div>
                  <label className="label">Staff at B (m)</label>
                  <input className="input" value={inputs.b1} onChange={e => setInputs({...inputs, b1: e.target.value})} placeholder="1.415" />
                </div>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-3">Instrument Position 2</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Staff at A (m)</label>
                  <input className="input" value={inputs.a2} onChange={e => setInputs({...inputs, a2: e.target.value})} placeholder="1.530" />
                </div>
                <div>
                  <label className="label">Staff at B (m)</label>
                  <input className="input" value={inputs.b2} onChange={e => setInputs({...inputs, b2: e.target.value})} placeholder="1.420" />
                </div>
              </div>
            </div>
            <button onClick={calculate} className="btn btn-primary w-full">Run Two Peg Test</button>
          </div>
        </div>

        {result && (
          <div className="card">
            <div className="card-header"><span className="label">Results</span></div>
            <div className="card-body space-y-4">
              <div className={`p-4 rounded text-center ${result.isPass ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
                <div className="text-sm text-gray-400 mb-2">Instrument Status</div>
                <div className={`text-3xl font-bold ${result.isPass ? 'text-green-400' : 'text-red-400'}`}>
                  {result.isPass ? '✓ PASS' : '✗ FAIL'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 p-3 rounded">
                  <div className="text-xs text-gray-400">True Elevation Diff</div>
                  <div className="font-mono text-[var(--accent)]">{result.trueDiff.toFixed(4)} m</div>
                </div>
                <div className="bg-gray-800 p-3 rounded">
                  <div className="text-xs text-gray-400">Collimation Error</div>
                  <div className="font-mono text-[var(--accent)]">{(result.collimationPer100m * 1000).toFixed(2)} mm/100m</div>
                </div>
              </div>
              <div className="text-xs text-gray-400">
                <div>Setup 1 diff: {result.obsDiff1.toFixed(4)} m</div>
                <div>Setup 2 diff: {result.obsDiff2.toFixed(4)} m</div>
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
