'use client';

import { useState } from 'react';
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { heightOfObjectSolved } from '@/lib/engine/solution/wrappers/heightOfObject'

export default function HeightOfObjectCalculator() {
  const [inputs, setInputs] = useState({
    distance: '',     // horizontal distance to base
    angleTop: { d: '', m: '', s: '' },    // angle to top
    angleBase: { d: '', m: '', s: '' },  // angle to base
    hi: ''            // height of instrument
  });
  const [steps, setSteps] = useState<SolutionStep[] | null>(null);
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined);

  const calculate = () => {
    const D = parseFloat(inputs.distance);
    const HI = parseFloat(inputs.hi) || 0;

    const degTop = parseFloat(inputs.angleTop.d) || 0
    const minTop = parseFloat(inputs.angleTop.m) || 0
    const secTop = parseFloat(inputs.angleTop.s) || 0
    const degBase = parseFloat(inputs.angleBase.d) || 0
    const minBase = parseFloat(inputs.angleBase.m) || 0
    const secBase = parseFloat(inputs.angleBase.s) || 0

    if (isNaN(D)) return;

    const s = heightOfObjectSolved({
      horizontalDistance: D,
      angleTop: { degrees: degTop, minutes: minTop, seconds: secTop, direction: 'N' },
      angleBase: { degrees: degBase, minutes: minBase, seconds: secBase, direction: 'N' },
      instrumentHeight: HI,
    })
    setSteps(s.steps)
    setSolutionTitle(s.solution.title)
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

        {steps ? <SolutionStepsRenderer title={solutionTitle} steps={steps} /> : null}
      </div>
    </div>
  );
}
