'use client';

import { useState } from 'react';
import { polarPoint, distanceBearing } from '@/lib/engine/distance';
import { dmsToDecimal, decimalToDMS } from '@/lib/engine/angles';

export default function SettingOutCalculator() {
  const [mode, setMode] = useState<'coords' | 'bearing'>('coords');
  
  const [station, setStation] = useState({ e: '', n: '' });
  const [bearing, setBearing] = useState({ d: '', m: '', s: '' });
  const [distance, setDistance] = useState('');
  const [result, setResult] = useState<any>(null);

  const [target, setTarget] = useState({ e: '', n: '' });
  const [result2, setResult2] = useState<any>(null);

  const calculatePegCoords = () => {
    const e1 = parseFloat(station.e);
    const n1 = parseFloat(station.n);
    const d = parseFloat(distance);
    const bearingDec = dmsToDecimal({ degrees: parseInt(bearing.d) || 0, minutes: parseInt(bearing.m) || 0, seconds: parseFloat(bearing.s) || 0, direction: 'N' });
    
    if (isNaN(e1) || isNaN(n1) || isNaN(d) || isNaN(bearingDec)) return;

    const peg = polarPoint({ easting: e1, northing: n1 }, bearingDec, d);
    
    setResult({
      pegEasting: peg.easting,
      pegNorthing: peg.northing,
      bearing: bearingDec,
      bearingDMS: decimalToDMS(bearingDec, false),
      distance: d,
      formula: `E₂ = E₁ + d×sin(θ), N₂ = N₁ + d×cos(θ)`,
      substitution: `E₂ = ${e1.toFixed(4)} + ${d}×sin(${bearingDec.toFixed(4)}°), N₂ = ${n1.toFixed(4)} + ${d}×cos(${bearingDec.toFixed(4)}°)`,
      steps: [
        `θ = ${bearingDec.toFixed(4)}°`,
        `sin(${bearingDec.toFixed(4)}°) = ${Math.sin(bearingDec * Math.PI / 180).toFixed(6)}`,
        `cos(${bearingDec.toFixed(4)}°) = ${Math.cos(bearingDec * Math.PI / 180).toFixed(6)}`,
        `ΔE = ${d} × ${Math.sin(bearingDec * Math.PI / 180).toFixed(6)} = ${(d * Math.sin(bearingDec * Math.PI / 180)).toFixed(4)} m`,
        `ΔN = ${d} × ${Math.cos(bearingDec * Math.PI / 180).toFixed(6)} = ${(d * Math.cos(bearingDec * Math.PI / 180)).toFixed(4)} m`
      ]
    });
  };

  const calculateBearingDistance = () => {
    const e1 = parseFloat(station.e);
    const n1 = parseFloat(station.n);
    const e2 = parseFloat(target.e);
    const n2 = parseFloat(target.n);
    
    if (isNaN(e1) || isNaN(n1) || isNaN(e2) || isNaN(n2)) return;

    const r = distanceBearing({ easting: e1, northing: n1 }, { easting: e2, northing: n2 });
    
    setResult2({
      bearing: r.bearing,
      bearingDMS: r.bearingDMS,
      distance: r.distance,
      deltaE: r.deltaE,
      deltaN: r.deltaN,
      formula: `θ = atan2(ΔE, ΔN), D = √(ΔE² + ΔN²)`,
      substitution: `θ = atan2(${r.deltaE.toFixed(4)}, ${r.deltaN.toFixed(4)}), D = √(${r.deltaE.toFixed(4)}² + ${r.deltaN.toFixed(4)}²)`,
      steps: [
        `ΔE = ${e2.toFixed(4)} - ${e1.toFixed(4)} = ${r.deltaE.toFixed(4)} m`,
        `ΔN = ${n2.toFixed(4)} - ${n1.toFixed(4)} = ${r.deltaN.toFixed(4)} m`,
        `Distance = √(${r.deltaE.toFixed(4)}² + ${r.deltaN.toFixed(4)}²) = ${r.distance.toFixed(4)} m`,
        `Bearing = atan2(${r.deltaE.toFixed(4)}, ${r.deltaN.toFixed(4)}) = ${r.bearing.toFixed(4)}° = ${r.bearingDMS}`
      ]
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Setting Out (Stakeout)</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Compute peg coordinates or bearing & distance to target</p>

      <div className="flex gap-4 mb-6">
        <button onClick={() => { setMode('coords'); setResult(null); setResult2(null); }} className={`btn ${mode === 'coords' ? 'btn-primary' : 'btn-secondary'}`}>
          Station + Bearing → Peg
        </button>
        <button onClick={() => { setMode('bearing'); setResult(null); setResult2(null); }} className={`btn ${mode === 'bearing' ? 'btn-primary' : 'btn-secondary'}`}>
          Station → Target
        </button>
      </div>

      {mode === 'coords' ? (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="card">
            <div className="card-header"><span className="label">Station & Direction</span></div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Station Easting (m)</label>
                  <input className="input" value={station.e} onChange={e => setStation({...station, e: e.target.value})} placeholder="500000.0000" />
                </div>
                <div>
                  <label className="label">Station Northing (m)</label>
                  <input className="input" value={station.n} onChange={e => setStation({...station, n: e.target.value})} placeholder="9500000.0000" />
                </div>
              </div>
              <div>
                <label className="label">Bearing (Degrees Minutes Seconds)</label>
                <div className="flex gap-2">
                  <input className="input flex-1" value={bearing.d} onChange={e => setBearing({...bearing, d: e.target.value})} placeholder="045" />
                  <input className="input flex-1" value={bearing.m} onChange={e => setBearing({...bearing, m: e.target.value})} placeholder="30" />
                  <input className="input flex-1" value={bearing.s} onChange={e => setBearing({...bearing, s: e.target.value})} placeholder="00" />
                </div>
              </div>
              <div>
                <label className="label">Distance (m)</label>
                <input className="input" value={distance} onChange={e => setDistance(e.target.value)} placeholder="25.000" />
              </div>
              <button onClick={calculatePegCoords} className="btn btn-primary w-full">Calculate Peg Coordinates</button>
            </div>
          </div>

          {result && (
            <div className="card">
              <div className="card-header"><span className="label">Results</span></div>
              <div className="card-body space-y-4">
                <div className="text-center py-4">
                  <div className="text-sm text-gray-400 mb-2">Peg Coordinates</div>
                  <div className="text-3xl font-mono text-[var(--accent)]">
                    E: {result.pegEasting.toFixed(4)} m<br/>
                    N: {result.pegNorthing.toFixed(4)} m
                  </div>
                </div>
                <div className="border-t border-gray-700 pt-4">
                  <div className="text-xs text-gray-500 mb-2">{result.formula}</div>
                  <div className="text-xs text-gray-400 mb-2">{result.substitution}</div>
                  {result.steps.map((step: string, i: number) => (
                    <div key={i} className="text-xs font-mono text-gray-400">{step}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="card">
            <div className="card-header"><span className="label">Station → Target</span></div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Station Easting (m)</label>
                  <input className="input" value={station.e} onChange={e => setStation({...station, e: e.target.value})} placeholder="500000.0000" />
                </div>
                <div>
                  <label className="label">Station Northing (m)</label>
                  <input className="input" value={station.n} onChange={e => setStation({...station, n: e.target.value})} placeholder="9500000.0000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Target Easting (m)</label>
                  <input className="input" value={target.e} onChange={e => setTarget({...target, e: e.target.value})} placeholder="500025.0000" />
                </div>
                <div>
                  <label className="label">Target Northing (m)</label>
                  <input className="input" value={target.n} onChange={e => setTarget({...target, n: e.target.value})} placeholder="9500018.0000" />
                </div>
              </div>
              <button onClick={calculateBearingDistance} className="btn btn-primary w-full">Calculate Bearing & Distance</button>
            </div>
          </div>

          {result2 && (
            <div className="card">
              <div className="card-header"><span className="label">Results</span></div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center py-4">
                  <div>
                    <div className="text-sm text-gray-400">Bearing</div>
                    <div className="text-2xl font-mono text-[var(--accent)]">{result2.bearingDMS}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Distance</div>
                    <div className="text-2xl font-mono text-[var(--accent)]">{result2.distance.toFixed(4)} m</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-gray-800 p-2 rounded">
                    <div className="text-xs text-gray-400">ΔE</div>
                    <div className="font-mono text-[var(--accent)]">{result2.deltaE >= 0 ? '+' : ''}{result2.deltaE.toFixed(4)} m</div>
                  </div>
                  <div className="bg-gray-800 p-2 rounded">
                    <div className="text-xs text-gray-400">ΔN</div>
                    <div className="font-mono text-[var(--accent)]">{result2.deltaN >= 0 ? '+' : ''}{result2.deltaN.toFixed(4)} m</div>
                  </div>
                </div>
                <div className="border-t border-gray-700 pt-4">
                  <div className="text-xs text-gray-500 mb-2">{result2.formula}</div>
                  {result2.steps.map((step: string, i: number) => (
                    <div key={i} className="text-xs font-mono text-gray-400">{step}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
