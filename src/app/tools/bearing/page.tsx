'use client';

import { useState } from 'react';
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer';
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder';
import { bearingSolvedFromCoords, backBearingSolved } from '@/lib/engine/solution/wrappers/bearing';

export default function BearingCalculator() {
  const [mode, setMode] = useState<'coords' | 'forward'>('coords');
  const [p1, setP1] = useState({ n: '', e: '' });
  const [p2, setP2] = useState({ n: '', e: '' });
  const [forward, setForward] = useState('');
  const [steps, setSteps] = useState<SolutionStep[] | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined);

  const calculate = () => {
    if (mode === 'coords') {
      const n1 = parseFloat(p1.n), e1 = parseFloat(p1.e);
      const n2 = parseFloat(p2.n), e2 = parseFloat(p2.e);
      if (isNaN(n1) || isNaN(e1) || isNaN(n2) || isNaN(e2)) return;
      const s = bearingSolvedFromCoords({ e1, n1, e2, n2 })
      setSteps(s.steps)
      setSolutionTitle(s.solution.title)
    } else {
      const s = backBearingSolved({ bearingDmsOrDeg: forward })
      setSteps(s.steps)
      setSolutionTitle(s.solution.title)
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Bearing Calculator</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Whole-Circle Bearing and Quadrant Bearing</p>

      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => { setMode('coords'); setSteps(null); setSolutionTitle(undefined); }}
          className={`btn ${mode === 'coords' ? 'btn-primary' : 'btn-secondary'}`}
        >
          From Coordinates
        </button>
        <button 
          onClick={() => { setMode('forward'); setSteps(null); setSolutionTitle(undefined); }}
          className={`btn ${mode === 'forward' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Back Bearing
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {mode === 'coords' ? (
            <div className="card">
              <div className="card-header">
                <span className="label">Calculate Bearing A → B</span>
              </div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Point A Northing (m)</label>
                    <input className="input" value={p1.n} onChange={e => setP1({...p1, n: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Point A Easting (m)</label>
                    <input className="input" value={p1.e} onChange={e => setP1({...p1, e: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Point B Northing (m)</label>
                    <input className="input" value={p2.n} onChange={e => setP2({...p2, n: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Point B Easting (m)</label>
                    <input className="input" value={p2.e} onChange={e => setP2({...p2, e: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <span className="label">Back Bearing Calculation</span>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="label">Forward Bearing (degrees or DMS)</label>
                  <input 
                    className="input" 
                    value={forward} 
                    onChange={e => setForward(e.target.value)} 
                    placeholder="45° 30' 22.5&quot; or 45.5"
                  />
                  <p className="text-xs text-[var(--text-muted)] mt-2">Accepts: 45.5, 45°30'22.5", 45 30 22.5</p>
                </div>
              </div>
            </div>
          )}

          <button onClick={calculate} className="btn btn-primary w-full">
            Calculate
          </button>
        </div>

        {steps ? <SolutionStepsRenderer title={solutionTitle} steps={steps} /> : null}
      </div>
    </div>
  );

  }
