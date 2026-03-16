'use client';

import { useState } from 'react';
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { tacheometrySolved } from '@/lib/engine/solution/wrappers/tacheometry'

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
  const [steps, setSteps] = useState<SolutionStep[] | null>(null);
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined);

  const calculate = () => {
    const HI = parseFloat(inputs.hi);
    const upper = parseFloat(inputs.upper);
    const middle = parseFloat(inputs.middle);
    const lower = parseFloat(inputs.lower);
    const K = parseFloat(inputs.k) || 100;
    const C = parseFloat(inputs.c) || 0;

    const deg = parseFloat(inputs.vertDeg) || 0
    const min = parseFloat(inputs.vertMin) || 0
    const sec = parseFloat(inputs.vertSec) || 0

    if (isNaN(HI) || isNaN(upper) || isNaN(middle) || isNaN(lower)) return;

    const s = tacheometrySolved({
      instrumentHeight: HI,
      upper,
      middle,
      lower,
      verticalAngle: { degrees: deg, minutes: min, seconds: sec, direction: 'N' },
      K,
      C,
    })
    setSteps(s.steps)
    setSolutionTitle(s.solution.title)
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

        {steps ? <SolutionStepsRenderer title={solutionTitle} steps={steps} /> : null}
      </div>
    </div>
  );
}
