'use client';

import { useState } from 'react';
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { twoPegTestSolved } from '@/lib/engine/solution/wrappers/twoPegTest'

export default function TwoPegTestCalculator() {
  const [inputs, setInputs] = useState({
    a1: '',  // Staff at A from position 1
    b1: '',  // Staff at B from position 1
    a2: '',  // Staff at A from position 2
    b2: ''   // Staff at B from position 2
  });
  const [steps, setSteps] = useState<SolutionStep[] | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined);

  const calculate = () => {
    const A1 = parseFloat(inputs.a1);
    const B1 = parseFloat(inputs.b1);
    const A2 = parseFloat(inputs.a2);
    const B2 = parseFloat(inputs.b2);

    if (isNaN(A1) || isNaN(B1) || isNaN(A2) || isNaN(B2)) return;

    const s = twoPegTestSolved({ A1, B1, A2, B2 })
    setSteps(s.steps)
    setSolutionTitle(s.solution.title)
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

        {steps ? <SolutionStepsRenderer title={solutionTitle} steps={steps} /> : null}
      </div>
    </div>
  );

  }
