'use client';

import { useState } from 'react';
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer';
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder';
import { distanceBearingSolvedFromCoords, slopeReductionSolved } from '@/lib/engine/solution/wrappers/distance';

export default function DistanceCalculator() {
  const [mode, setMode] = useState<'coords' | 'slope'>('coords');
  const [p1, setP1] = useState({ n: '', e: '' });
  const [p2, setP2] = useState({ n: '', e: '' });
  const [slope, setSlope] = useState({ dist: '', angle: '' });
  const [steps, setSteps] = useState<SolutionStep[] | null>(null);
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined);

  const calculate = () => {
    if (mode === 'coords') {
      const n1 = parseFloat(p1.n), e1 = parseFloat(p1.e);
      const n2 = parseFloat(p2.n), e2 = parseFloat(p2.e);
      if (isNaN(n1) || isNaN(e1) || isNaN(n2) || isNaN(e2)) return;

      const s = distanceBearingSolvedFromCoords({ e1, n1, e2, n2 })
      setSteps(s.steps)
      setSolutionTitle(s.solution.title)
    } else {
      const sd = parseFloat(slope.dist), va = parseFloat(slope.angle);
      if (isNaN(sd) || isNaN(va)) return;

      const s = slopeReductionSolved({ slopeDistance: sd, verticalAngleDeg: va })
      setSteps(s.steps)
      setSolutionTitle(s.solution.title)
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Distance & Bearing Calculator</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Calculate distance, bearing, and slope corrections</p>

      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => { setMode('coords'); setSteps(null); setSolutionTitle(undefined); }}
          className={`btn ${mode === 'coords' ? 'btn-primary' : 'btn-secondary'}`}
        >
          By Coordinates
        </button>
        <button 
          onClick={() => { setMode('slope'); setSteps(null); setSolutionTitle(undefined); }}
          className={`btn ${mode === 'slope' ? 'btn-primary' : 'btn-secondary'}`}
        >
          By Slope Distance
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {mode === 'coords' ? (
            <div className="card">
              <div className="card-header">
                <span className="label">Point A → Point B</span>
              </div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Point A Northing (m)</label>
                    <input className="input" value={p1.n} onChange={e => setP1({...p1, n: e.target.value})} placeholder="5000.0000" />
                  </div>
                  <div>
                    <label className="label">Point A Easting (m)</label>
                    <input className="input" value={p1.e} onChange={e => setP1({...p1, e: e.target.value})} placeholder="3000.0000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Point B Northing (m)</label>
                    <input className="input" value={p2.n} onChange={e => setP2({...p2, n: e.target.value})} placeholder="5234.5678" />
                  </div>
                  <div>
                    <label className="label">Point B Easting (m)</label>
                    <input className="input" value={p2.e} onChange={e => setP2({...p2, e: e.target.value})} placeholder="3156.7890" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <span className="label">Slope Measurement</span>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="label">Slope Distance (m)</label>
                  <input className="input" value={slope.dist} onChange={e => setSlope({...slope, dist: e.target.value})} placeholder="150.2345" />
                </div>
                <div>
                  <label className="label">Vertical Angle (degrees)</label>
                  <input className="input" value={slope.angle} onChange={e => setSlope({...slope, angle: e.target.value})} placeholder="5.5" />
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
