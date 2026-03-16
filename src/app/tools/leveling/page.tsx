'use client';

import { useState } from 'react';
import { riseAndFall, heightOfCollimation } from '@/lib/engine/leveling';
import type { LevelingInput } from '@/lib/engine/leveling'
import type { LevelingReading } from '@/lib/engine/types';
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { levelingSolved } from '@/lib/engine/solution/wrappers/leveling'

interface Reading {
  id: number;
  station: string;
  bs: string;
  fs: string;
}

export default function LevelingCalculator() {
  const [bm, setBm] = useState('100.0000');
  const [closingBm, setClosingBm] = useState('');
  const [distanceKm, setDistanceKm] = useState('1');
  const [method, setMethod] = useState<'rf' | 'hoc'>('rf');
  const [readings, setReadings] = useState<Reading[]>([
    { id: 1, station: '1', bs: '1.523', fs: '' },
    { id: 2, station: '2', bs: '', fs: '1.234' },
    { id: 3, station: '3', bs: '', fs: '1.456' },
    { id: 4, station: '4', bs: '', fs: '1.789' },
  ]);
  const [result, setResult] = useState<any>(null);
  const [steps, setSteps] = useState<SolutionStep[] | null>(null)
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined)
  const [showProfile, setShowProfile] = useState(false);

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

    const levelingInput: LevelingInput =
      method === 'rf'
        ? { readings: obs, openingRL, closingRL: closing, method: 'rise_and_fall', distanceKm: parseFloat(distanceKm) || 1 }
        : { readings: obs, openingRL, closingRL: closing, method: 'height_of_collimation', distanceKm: parseFloat(distanceKm) || 1 }

    const r = method === 'rf' ? riseAndFall(levelingInput) : heightOfCollimation(levelingInput);

    // BLOCK RESULTS if arithmetic check fails (Basak rule)
    if (!r.arithmeticCheck) {
      alert('ARITHMETIC CHECK FAILED — Results will not be displayed.\n\nAccording to Basak standards, the calculation must pass the arithmetic check before results can be shown.\n\nCheck your readings: ΣBS - ΣFS must equal ΣRise - ΣFall');
      return;
    }

    setResult(r);
    const s = levelingSolved(levelingInput, r)
    setSteps(s.steps)
    setSolutionTitle(s.solution.title)
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Leveling Calculator</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Rise & Fall and Height of Collimation methods</p>

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
          <label className="label">Distance (km) for allowable error</label>
          <input className="input" value={distanceKm} onChange={e => setDistanceKm(e.target.value)} placeholder="1" />
        </div>
        <div className="card p-4">
          <label className="label">Method</label>
          <div className="flex gap-2 mt-2">
            <button onClick={() => { setMethod('rf'); setResult(null); setSteps(null); setSolutionTitle(undefined); }} className={`flex-1 btn text-xs ${method === 'rf' ? 'btn-primary' : 'btn-secondary'}`}>
              Rise & Fall
            </button>
            <button onClick={() => { setMethod('hoc'); setResult(null); setSteps(null); setSolutionTitle(undefined); }} className={`flex-1 btn text-xs ${method === 'hoc' ? 'btn-primary' : 'btn-secondary'}`}>
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

          {steps ? (
            <div className="md:col-span-2">
              <SolutionStepsRenderer title={solutionTitle} steps={steps} />
            </div>
          ) : null}

          {result && result.readings.length > 0 && (
            <div className="mt-4">
              <button 
                onClick={() => setShowProfile(!showProfile)}
                className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded"
              >
                {showProfile ? 'Hide Profile' : 'View Profile'}
              </button>
              
              {showProfile && (
                <div className="mt-4 bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-200 mb-4">Longitudinal Profile</h3>
                  <LevelingProfile readings={result.readings} />
                </div>
              )}
            </div>
          )}
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

function LevelingProfile({ readings }: { readings: any[] }) {
  const width = 600;
  const height = 250;
  const padding = 50;

  const validReadings = readings.filter(r => r.reducedLevel !== undefined);
  if (validReadings.length === 0) return null;

  const rls = validReadings.map(r => r.adjustedRL || r.reducedLevel);
  const minRL = Math.min(...rls) - 0.5;
  const maxRL = Math.max(...rls) + 0.5;
  const maxIdx = validReadings.length - 1;

  const toX = (idx: number) => padding + (idx / maxIdx) * (width - padding * 2);
  const toY = (rl: number) => height - padding - ((rl - minRL) / (maxRL - minRL)) * (height - padding * 2);

  const pathData = validReadings.map((r, i) => {
    const rl = r.adjustedRL || r.reducedLevel;
    return `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(rl)}`;
  }).join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="bg-gray-900 rounded border border-amber-500/30">
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#grid)"/>
      
      <path d={pathData} stroke="#E8841A" strokeWidth={2} fill="none"/>
      
      {validReadings.map((r, i) => {
        const rl = r.adjustedRL || r.reducedLevel;
        return (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(rl)} r={4} fill="#E8841A"/>
            <text x={toX(i)} y={height - 10} fill="white" fontSize={9} textAnchor="middle">{r.station}</text>
            <text x={toX(i)} y={toY(rl) - 8} fill="white" fontSize={7} textAnchor="middle">{rl.toFixed(2)}</text>
          </g>
        );
      })}
      
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="white" strokeWidth={1}/>
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="white" strokeWidth={1}/>
      
      <text x={width/2} y={height - 2} fill="gray" fontSize={9} textAnchor="middle">Station</text>
      <text x={12} y={height/2} fill="gray" fontSize={9} textAnchor="middle" transform={`rotate(-90, 12, ${height/2})`}>Reduced Level (m)</text>
    </svg>
  );
}
