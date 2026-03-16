'use client';

import { useState } from 'react';
import { Point2D } from '@/lib/engine/types';
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer';
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder';
import { coordinateAreaSolution, offsetAreaSolution } from '@/lib/engine/solution/wrappers/area';

interface PointInput {
  id: number;
  n: string;
  e: string;
}

export default function AreaCalculator() {
  const [points, setPoints] = useState<PointInput[]>([
    { id: 1, n: '5000', e: '3000' },
    { id: 2, n: '5234.5678', e: '3156.7890' },
    { id: 3, n: '5100', e: '3400' },
    { id: 4, n: '4800', e: '3200' },
  ]);
  const [method, setMethod] = useState<'coordinate' | 'trapezoidal' | 'simpsons'>('coordinate');
  const [offsets, setOffsets] = useState('10, 15, 18, 22, 20, 16');
  const [interval, setInterval] = useState('20');
  const [steps, setSteps] = useState<SolutionStep[] | null>(null);
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined);

  const addPoint = () => {
    setPoints([...points, { id: Date.now(), n: '', e: '' }]);
  };

  const removePoint = (id: number) => {
    if (points.length > 3) {
      setPoints(points.filter(p => p.id !== id));
    }
  };

  const updatePoint = (id: number, field: 'n' | 'e', value: string) => {
    setPoints(points.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const calculate = () => {
    if (method === 'coordinate') {
      const pts: Point2D[] = points
        .map(p => ({ northing: parseFloat(p.n), easting: parseFloat(p.e) }))
        .filter(p => !isNaN(p.northing) && !isNaN(p.easting));
      
      if (pts.length >= 3) {
        const out = coordinateAreaSolution(pts)
        setSteps(out.steps)
        setSolutionTitle(out.solution.title)
      }
    } else {
      const ord = offsets.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      const int = parseFloat(interval);
      const out = offsetAreaSolution({ ordinates: ord, interval: int, method: method === 'trapezoidal' ? 'trapezoidal' : 'simpsons' })
      setSteps(out.steps)
      setSolutionTitle(out.solution.title)
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Area Calculator</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Calculate area using coordinate, trapezoidal, or Simpson's methods</p>

      <div className="flex gap-4 mb-6 flex-wrap">
        <button 
          onClick={() => { setMethod('coordinate'); setSteps(null); setSolutionTitle(undefined); }}
          className={`btn ${method === 'coordinate' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Coordinate Method
        </button>
        <button 
          onClick={() => { setMethod('trapezoidal'); setSteps(null); setSolutionTitle(undefined); }}
          className={`btn ${method === 'trapezoidal' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Trapezoidal
        </button>
        <button 
          onClick={() => { setMethod('simpsons'); setSteps(null); setSolutionTitle(undefined); }}
          className={`btn ${method === 'simpsons' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Simpson's Rule
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {method === 'coordinate' ? (
            <div className="card">
              <div className="card-header flex justify-between items-center">
                <span className="label">Polygon Coordinates</span>
                <span className="text-xs text-[var(--text-muted)]">Click points in order (clockwise or anticlockwise)</span>
              </div>
              <div className="card-body">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Pt</th>
                      <th>Northing (m)</th>
                      <th>Easting (m)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((p, i) => (
                      <tr key={p.id}>
                        <td className="text-left font-semibold">{String.fromCharCode(65 + i)}</td>
                        <td><input className="input" value={p.n} onChange={e => updatePoint(p.id, 'n', e.target.value)} /></td>
                        <td><input className="input" value={p.e} onChange={e => updatePoint(p.id, 'e', e.target.value)} /></td>
                        <td><button onClick={() => removePoint(p.id)} className="text-[var(--error)]">×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={addPoint} className="btn btn-secondary w-full mt-4">+ Add Point</button>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header">
                <span className="label">Offset Method</span>
              </div>
              <div className="card-body space-y-4">
                <div>
                  <label className="label">Ordinates (comma-separated, m)</label>
                  <input className="input" value={offsets} onChange={e => setOffsets(e.target.value)} placeholder="10, 15, 18, 22, 20, 16" />
                </div>
                <div>
                  <label className="label">Interval (m)</label>
                  <input className="input" value={interval} onChange={e => setInterval(e.target.value)} placeholder="20" />
                </div>
              </div>
            </div>
          )}

          <button onClick={calculate} className="btn btn-primary w-full">
            Calculate Area
          </button>
        </div>

        {steps ? <SolutionStepsRenderer title={solutionTitle} steps={steps} /> : null}
      </div>
    </div>
  );
}

 
