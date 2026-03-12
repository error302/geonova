'use client';

import { useState } from 'react';
import { riseAndFall, heightOfCollimation } from '@/lib/engine/leveling';
import type { LevelingReading } from '@/lib/engine/types';

interface Reading {
  id: number;
  station: string;
  bs: string;
  fs: string;
}

export default function LevelingCalculator() {
  const [bm, setBm] = useState('100.0000');
  const [closingBm, setClosingBm] = useState('');
  const [method, setMethod] = useState<'rf' | 'hoc'>('rf');
  const [readings, setReadings] = useState<Reading[]>([
    { id: 1, station: '1', bs: '1.523', fs: '' },
    { id: 2, station: '2', bs: '', fs: '1.234' },
    { id: 3, station: '3', bs: '', fs: '1.456' },
    { id: 4, station: '4', bs: '', fs: '1.789' },
  ]);
  const [result, setResult] = useState<any>(null);

  const addReading = () => {
    setReadings([...readings, { id: Date.now(), station: String(readings.length + 1), bs: '', fs: '' }]);
  };

  const updateReading = (id: number, field: 'bs' | 'fs', value: string) => {
    setReadings(readings.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const calculate = () => {
    const openingRL = parseFloat(bm);
    const closing = closingBm ? parseFloat(closingBm) : undefined;
    if (isNaN(openingRL)) return;

    const obs = readings.map(r => ({
      station: r.station,
      bs: r.bs ? parseFloat(r.bs) : undefined,
      fs: r.fs ? parseFloat(r.fs) : undefined
    }));

    const r = method === 'rf'
      ? riseAndFall({ readings: obs, openingRL, closingRL: closing, method: 'rise_and_fall' })
      : heightOfCollimation({ readings: obs, openingRL, method: 'height_of_collimation' });

    setResult(r);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Leveling Calculator</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Based on N.N. Basak, Chapter 9</p>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <label className="label">Opening Benchmark (m)</label>
          <input className="input" value={bm} onChange={e => setBm(e.target.value)} />
        </div>
        <div className="card p-4">
          <label className="label">Closing Benchmark (m)</label>
          <input className="input" value={closingBm} onChange={e => setClosingBm(e.target.value)} placeholder="Optional" />
        </div>
        <div className="card p-4">
          <label className="label">Method</label>
          <div className="flex gap-2 mt-2">
            <button onClick={() => { setMethod('rf'); setResult(null); }} className={`flex-1 btn text-xs ${method === 'rf' ? 'btn-primary' : 'btn-secondary'}`}>
              Rise & Fall
            </button>
            <button onClick={() => { setMethod('hoc'); setResult(null); }} className={`flex-1 btn text-xs ${method === 'hoc' ? 'btn-primary' : 'btn-secondary'}`}>
              HOC
            </button>
          </div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="card-header">
          <span className="label">Level Book</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Station</th>
                <th>BS (m)</th>
                <th>FS (m)</th>
                <th>Rise (m)</th>
                <th>Fall (m)</th>
                <th>RL (m)</th>
                {result && <th>Adj RL (m)</th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-left font-semibold">BM</td>
                <td colSpan={2} className="text-left text-[var(--text-muted)]">{bm}</td>
                <td></td>
                <td></td>
                <td className="font-mono">{bm}</td>
                <td className="font-mono">{bm}</td>
              </tr>
              {readings.map((r, i) => (
                <tr key={r.id}>
                  <td className="text-left">{r.station}</td>
                  <td><input className="input" value={r.bs} onChange={e => updateReading(r.id, 'bs', e.target.value)} placeholder="0.000" /></td>
                  <td><input className="input" value={r.fs} onChange={e => updateReading(r.id, 'fs', e.target.value)} placeholder="0.000" /></td>
                  {result ? (
                    <>
                      <td className="font-mono">{result.readings[i + 1]?.rise?.toFixed(4) || '—'}</td>
                      <td className="font-mono">{result.readings[i + 1]?.fall?.toFixed(4) || '—'}</td>
                      <td className="font-mono">{result.readings[i + 1]?.reducedLevel?.toFixed(4) || '—'}</td>
                      <td className="font-mono">{result.readings[i + 1]?.adjustedRL?.toFixed(4) || '—'}</td>
                    </>
                  ) : (
                    <td colSpan={4}></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4">
          <button onClick={addReading} className="btn btn-secondary">+ Add Reading</button>
        </div>
      </div>

      <button onClick={calculate} className="btn btn-primary mb-6">Calculate</button>

      {result && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <span className="label">Results</span>
              <span className={`badge ${result.isAcceptable ? 'badge-success' : 'badge-error'}`}>
                {result.isAcceptable ? 'Acceptable' : 'Unacceptable'}
              </span>
            </div>
            <div className="card-body space-y-3">
              <ResultRow label="Method" value={method === 'rf' ? 'Rise & Fall' : 'Height of Collimation'} />
              <ResultRow label="Misclosure" value={`${result.misclosure.toFixed(6)} m`} />
              <ResultRow label="Allowable (±12√K)" value={`±${(result.allowableMisclosure * 1000).toFixed(3)} mm`} />
              <ResultRow 
                label="Arithmetic Check" 
                value={result.arithmeticCheck ? 'PASS ✓' : 'FAIL ✗'} 
                highlight={result.arithmeticCheck}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="label">Summary</span>
            </div>
            <div className="card-body space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-secondary)]">Opening RL</span>
                <span className="font-mono">{bm} m</span>
              </div>
              {result.readings.length > 0 && (
                <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                  <span className="text-[var(--text-secondary)]">Final RL (Raw)</span>
                  <span className="font-mono">{result.readings[result.readings.length - 1]?.reducedLevel?.toFixed(4)} m</span>
                </div>
              )}
              {result.readings.some((r: LevelingReading) => r.adjustedRL) && (
                <div className="flex justify-between py-2 border-b border-[var(--border-color)]">
                  <span className="text-[var(--text-secondary)]">Final RL (Adjusted)</span>
                  <span className="font-mono result-accent">
                    {result.readings[result.readings.length - 1]?.adjustedRL?.toFixed(4)} m
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className={`font-mono ${highlight !== undefined ? (highlight ? 'result-positive' : 'result-negative') : ''}`}>
        {value}
      </span>
    </div>
  );
}
