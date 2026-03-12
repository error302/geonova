'use client';

import { useState } from 'react';
import { distanceBearing, horizontalDistance, verticalDistance, gradient } from '@/lib/engine/distance';

export default function DistanceCalculator() {
  const [mode, setMode] = useState<'coords' | 'slope'>('coords');
  const [p1, setP1] = useState({ n: '', e: '' });
  const [p2, setP2] = useState({ n: '', e: '' });
  const [slope, setSlope] = useState({ dist: '', angle: '' });
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    if (mode === 'coords') {
      const n1 = parseFloat(p1.n), e1 = parseFloat(p1.e);
      const n2 = parseFloat(p2.n), e2 = parseFloat(p2.e);
      if (isNaN(n1) || isNaN(e1) || isNaN(n2) || isNaN(e2)) return;
      
      const r = distanceBearing({ easting: e1, northing: n1 }, { easting: e2, northing: n2 });
      setResult({ type: 'coords', ...r });
    } else {
      const sd = parseFloat(slope.dist), va = parseFloat(slope.angle);
      if (isNaN(sd) || isNaN(va)) return;
      
      const h = horizontalDistance(sd, va);
      const v = verticalDistance(sd, va);
      const g = gradient(v, h);
      setResult({ type: 'slope', slopeDist: sd, vertAngle: va, horizontal: h, vertical: v, gradient: g });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Distance & Bearing Calculator</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Based on N.N. Basak, Chapter 3</p>

      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => { setMode('coords'); setResult(null); }}
          className={`btn ${mode === 'coords' ? 'btn-primary' : 'btn-secondary'}`}
        >
          By Coordinates
        </button>
        <button 
          onClick={() => { setMode('slope'); setResult(null); }}
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

        {result && (
          <div className="space-y-6">
            {result.type === 'coords' ? (
              <>
                <div className="card">
                  <div className="card-header">
                    <span className="label">Results</span>
                  </div>
                  <div className="card-body space-y-3">
                    <ResultRow label="Horizontal Distance" value={`${result.distance.toFixed(4)} m`} highlight />
                    <ResultRow label="Bearing (WCB)" value={`${result.bearing.toFixed(4)}°`} />
                    <ResultRow label="Bearing (DMS)" value={result.bearingDMS} />
                    <ResultRow label="Back Bearing" value={result.backBearingDMS} />
                    <ResultRow label="Quadrant" value={result.quadrant} />
                    <ResultRow label="Δ Northing" value={`${result.deltaN.toFixed(4)} m`} />
                    <ResultRow label="Δ Easting" value={`${result.deltaE.toFixed(4)} m`} />
                  </div>
                </div>

                <div className="working-box">
                  <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--accent)' }}>Working</h4>
                  <div className="working-step">
                    <div className="text-[var(--text-muted)]">Given:</div>
                    <div>A({p1.e}, {p1.n}), B({p2.e}, {p2.n})</div>
                  </div>
                  <div className="working-step">
                    <div className="text-[var(--text-muted)]">Formula:</div>
                    <div className="working-formula">Distance = √(ΔE² + ΔN²)</div>
                  </div>
                  <div className="working-step">
                    <div className="text-[var(--text-muted)]">Substituted:</div>
                    <div className="working-formula">= √({result.deltaE.toFixed(4)}² + {result.deltaN.toFixed(4)}²)</div>
                  </div>
                  <div className="working-step">
                    <div className="text-[var(--text-muted)]">Result:</div>
                    <div className="working-formula">{result.distance.toFixed(4)} m</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="card">
                <div className="card-header">
                  <span className="label">Results</span>
                </div>
                <div className="card-body space-y-3">
                  <ResultRow label="Horizontal Distance" value={`${result.horizontal.toFixed(4)} m`} highlight />
                  <ResultRow label="Vertical Distance" value={`${result.vertical.toFixed(4)} m`} />
                  <ResultRow label="Gradient" value={`${result.gradient.percentage.toFixed(2)}% (${result.gradient.degrees.toFixed(2)}°)`} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className={`font-mono font-semibold ${highlight ? 'result-accent' : ''}`}>{value}</span>
    </div>
  );
}
