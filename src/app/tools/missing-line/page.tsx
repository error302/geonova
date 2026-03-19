'use client';

import { useState } from 'react';
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { distanceBearingSolvedFromCoords } from '@/lib/engine/solution/wrappers/distance'

export default function MissingLineCalculator() {
  const [pointA, setPointA] = useState({ e: '', n: '' });
  const [pointB, setPointB] = useState({ e: '', n: '' });
  const [steps, setSteps] = useState<SolutionStep[] | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined);

  const calculate = () => {
    const e1 = parseFloat(pointA.e);
    const n1 = parseFloat(pointA.n);
    const e2 = parseFloat(pointB.e);
    const n2 = parseFloat(pointB.n);

    if (isNaN(e1) || isNaN(n1) || isNaN(e2) || isNaN(n2)) return;

    const s = distanceBearingSolvedFromCoords({ e1, n1, e2, n2 })
    setSteps(s.steps)
    setSolutionTitle(s.solution.title)
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

        {steps ? <SolutionStepsRenderer title={solutionTitle} steps={steps} /> : null}
      </div>
    </div>
  );

  }
