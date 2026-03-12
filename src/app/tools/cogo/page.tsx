'use client';

import { useState } from 'react';
import { radiation, bearingIntersection, tienstraResection } from '@/lib/engine/cogo';

export default function COGOCalculator() {
  const [mode, setMode] = useState<'radiation' | 'intersection' | 'resection'>('radiation');
  const [input, setInput] = useState({
    fromN: '5000', fromE: '3000', bearing: '45.5234', distance: '150.0',
    stAN: '5000', stAE: '3000', bearA: '30', stBN: '5100', stBE: '3200', bearB: '120',
    p1N: '5000', p1E: '3000', p2N: '5234', p2E: '3156', p3N: '5100', p3E: '3400',
    ang1: '45', ang2: '60'
  });
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    try {
      if (mode === 'radiation') {
        const from = { northing: parseFloat(input.fromN), easting: parseFloat(input.fromE) };
        const bear = parseFloat(input.bearing), dist = parseFloat(input.distance);
        if (isNaN(from.northing) || isNaN(bear) || isNaN(dist)) return;
        const r = radiation(from, bear, dist);
        setResult({ type: 'radiation', point: r.point, distance: dist, bearing: bear });
      } else if (mode === 'intersection') {
        const stA = { northing: parseFloat(input.stAN), easting: parseFloat(input.stAE) };
        const stB = { northing: parseFloat(input.stBN), easting: parseFloat(input.stBE) };
        const bearA = parseFloat(input.bearA), bearB = parseFloat(input.bearB);
        if (isNaN(stA.northing) || isNaN(stB.northing) || isNaN(bearA) || isNaN(bearB)) return;
        const r = bearingIntersection(stA, bearA, stB, bearB);
        if (r) setResult({ type: 'intersection', point: r.point, distA: r.distanceFromA, distB: r.distanceFromB });
      } else {
        const p1 = { northing: parseFloat(input.p1N), easting: parseFloat(input.p1E) };
        const p2 = { northing: parseFloat(input.p2N), easting: parseFloat(input.p2E) };
        const p3 = { northing: parseFloat(input.p3N), easting: parseFloat(input.p3E) };
        const a1 = parseFloat(input.ang1), a2 = parseFloat(input.ang2);
        if (isNaN(p1.northing) || isNaN(a1) || isNaN(a2)) return;
        const r = tienstraResection(p1, p2, p3, a1, a2);
        if (r) setResult({ type: 'resection', point: r.point, d1: r.distanceToP1, d2: r.distanceToP2, d3: r.distanceToP3 });
      }
    } catch (e) {
      setResult({ error: 'Calculation error - check inputs' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">COGO Tools</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Coordinate Geometry — Based on N.N. Basak</p>

      <div className="flex gap-4 mb-6 flex-wrap">
        <button onClick={() => { setMode('radiation'); setResult(null); }} className={`btn ${mode === 'radiation' ? 'btn-primary' : 'btn-secondary'}`}>Radiation</button>
        <button onClick={() => { setMode('intersection'); setResult(null); }} className={`btn ${mode === 'intersection' ? 'btn-primary' : 'btn-secondary'}`}>Bearing Intersection</button>
        <button onClick={() => { setMode('resection'); setResult(null); }} className={`btn ${mode === 'resection' ? 'btn-primary' : 'btn-secondary'}`}>Resection (Tienstra)</button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="card">
            <div className="card-header"><span className="label">
              {mode === 'radiation' ? 'Instrument Station → New Point' : 
               mode === 'intersection' ? 'Two Stations + Bearings' : 'Three Known Points'}
            </span></div>
            <div className="card-body space-y-4">
              {mode === 'radiation' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">From Northing</label><input className="input" value={input.fromN} onChange={e => setInput({...input, fromN: e.target.value})} /></div>
                    <div><label className="label">From Easting</label><input className="input" value={input.fromE} onChange={e => setInput({...input, fromE: e.target.value})} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Bearing (°)</label><input className="input" value={input.bearing} onChange={e => setInput({...input, bearing: e.target.value})} /></div>
                    <div><label className="label">Distance (m)</label><input className="input" value={input.distance} onChange={e => setInput({...input, distance: e.target.value})} /></div>
                  </div>
                </>
              )}
              {mode === 'intersection' && (
                <>
                  <div className="grid grid-cols-2 gap-4"><div><label className="label">Station A Northing</label><input className="input" value={input.stAN} onChange={e => setInput({...input, stAN: e.target.value})} /></div><div><label className="label">Station A Easting</label><input className="input" value={input.stAE} onChange={e => setInput({...input, stAE: e.target.value})} /></div></div>
                  <div><label className="label">Bearing from A (°)</label><input className="input" value={input.bearA} onChange={e => setInput({...input, bearA: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-4"><div><label className="label">Station B Northing</label><input className="input" value={input.stBN} onChange={e => setInput({...input, stBN: e.target.value})} /></div><div><label className="label">Station B Easting</label><input className="input" value={input.stBE} onChange={e => setInput({...input, stBE: e.target.value})} /></div></div>
                  <div><label className="label">Bearing from B (°)</label><input className="input" value={input.bearB} onChange={e => setInput({...input, bearB: e.target.value})} /></div>
                </>
              )}
              {mode === 'resection' && (
                <>
                  <div className="grid grid-cols-2 gap-4"><div><label className="label">P1 Northing</label><input className="input" value={input.p1N} onChange={e => setInput({...input, p1N: e.target.value})} /></div><div><label className="label">P1 Easting</label><input className="input" value={input.p1E} onChange={e => setInput({...input, p1E: e.target.value})} /></div></div>
                  <div className="grid grid-cols-2 gap-4"><div><label className="label">P2 Northing</label><input className="input" value={input.p2N} onChange={e => setInput({...input, p2N: e.target.value})} /></div><div><label className="label">P2 Easting</label><input className="input" value={input.p2E} onChange={e => setInput({...input, p2E: e.target.value})} /></div></div>
                  <div className="grid grid-cols-2 gap-4"><div><label className="label">P3 Northing</label><input className="input" value={input.p3N} onChange={e => setInput({...input, p3N: e.target.value})} /></div><div><label className="label">P3 Easting</label><input className="input" value={input.p3E} onChange={e => setInput({...input, p3E: e.target.value})} /></div></div>
                  <div className="grid grid-cols-2 gap-4"><div><label className="label">Angle at P1 (°)</label><input className="input" value={input.ang1} onChange={e => setInput({...input, ang1: e.target.value})} /></div><div><label className="label">Angle at P2 (°)</label><input className="input" value={input.ang2} onChange={e => setInput({...input, ang2: e.target.value})} /></div></div>
                </>
              )}
            </div>
          </div>
          <button onClick={calculate} className="btn btn-primary w-full">Calculate</button>
        </div>

        {result && !result.error && (
          <div className="card">
            <div className="card-header"><span className="label">Results</span></div>
            <div className="card-body space-y-3">
              {result.type === 'radiation' && (
                <>
                  <ResultRow label="Computed Point Northing" value={result.point.northing.toFixed(4)} />
                  <ResultRow label="Computed Point Easting" value={result.point.easting.toFixed(4)} />
                  <ResultRow label="Distance" value={`${result.distance} m`} />
                  <ResultRow label="Bearing" value={`${result.bearing}°`} />
                </>
              )}
              {result.type === 'intersection' && (
                <>
                  <ResultRow label="Intersect Northing" value={result.point.northing.toFixed(4)} />
                  <ResultRow label="Intersect Easting" value={result.point.easting.toFixed(4)} />
                  <ResultRow label="Distance from A" value={`${result.distA.toFixed(4)} m`} />
                  <ResultRow label="Distance from B" value={`${result.distB.toFixed(4)} m`} />
                </>
              )}
              {result.type === 'resection' && (
                <>
                  <ResultRow label="Station Northing" value={result.point.northing.toFixed(4)} />
                  <ResultRow label="Station Easting" value={result.point.easting.toFixed(4)} />
                  <ResultRow label="Distance to P1" value={`${result.d1.toFixed(4)} m`} />
                  <ResultRow label="Distance to P2" value={`${result.d2.toFixed(4)} m`} />
                  <ResultRow label="Distance to P3" value={`${result.d3.toFixed(4)} m`} />
                </>
              )}
            </div>
          </div>
        )}
        {result?.error && <div className="card p-4"><p className="text-[var(--error)]">{result.error}</p></div>}
      </div>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
