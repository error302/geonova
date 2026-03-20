'use client';

import { useState } from 'react';
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { chainageTableSolved, computeChainageTable, reverseChainageSolved } from '@/lib/engine/solution/wrappers/chainage'

interface AlignmentPoint {
  id: string;
  name: string;
  easting: string;
  northing: string;
}

interface ChainageResult {
  pointName: string;
  easting: number;
  northing: number;
  chainage: number;
  distance: number;
}

export default function ChainageCalculator() {
  const [startStation, setStartStation] = useState({ easting: '500000.0000', northing: '500000.0000' });
  const [startChainage, setStartChainage] = useState('0');
  const [alignmentPoints, setAlignmentPoints] = useState<AlignmentPoint[]>([
    { id: '1', name: 'A', easting: '500000.0000', northing: '500000.0000' },
    { id: '2', name: 'B', easting: '500100.0000', northing: '500124.0000' },
    { id: '3', name: 'C', easting: '500285.0000', northing: '500260.0000' },
    { id: '4', name: 'D', easting: '500400.0000', northing: '500345.0000' },
  ]);
  const [reverseChainage, setReverseChainage] = useState('');
  const [reverseResult, setReverseResult] = useState<{ easting: number; northing: number } | null>(null);
  const [results, setResults] = useState<ChainageResult[]>([]);
  const [steps, setSteps] = useState<SolutionStep[] | null>(null)
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined)
  const [reverseSteps, setReverseSteps] = useState<SolutionStep[] | null>(null)
  const [reverseTitle, setReverseTitle] = useState<string | undefined>(undefined)

  const addPoint = () => {
    const newId = Date.now().toString();
    const lastPoint = alignmentPoints[alignmentPoints.length - 1];
    const newLetter = String.fromCharCode(65 + alignmentPoints.length);
    setAlignmentPoints([
      ...alignmentPoints,
      { id: newId, name: newLetter, easting: lastPoint.easting, northing: lastPoint.northing }
    ]);
  };

  const removePoint = (id: string) => {
    if (alignmentPoints.length > 2) {
      setAlignmentPoints(alignmentPoints.filter(p => p.id !== id));
    }
  };

  const updatePoint = (id: string, field: keyof AlignmentPoint, value: string) => {
    setAlignmentPoints(alignmentPoints.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const calculate = () => {
    const startE = parseFloat(startStation.easting);
    const startN = parseFloat(startStation.northing);
    const startCh = parseFloat(startChainage) || 0;

    if (isNaN(startE) || isNaN(startN)) return;

    const alignment = alignmentPoints
      .map(p => ({ name: p.name, easting: parseFloat(p.easting), northing: parseFloat(p.northing) }))
      .filter(p => !isNaN(p.easting) && !isNaN(p.northing))

    const table = computeChainageTable({
      start: { easting: startE, northing: startN },
      startChainage: startCh,
      alignment,
    })

    setResults(table)
    const s = chainageTableSolved({ startChainage: startCh, start: { easting: startE, northing: startN }, alignmentCount: alignment.length, table })
    setSteps(s.steps)
    setSolutionTitle(s.solution.title)
    setReverseResult(null)
    setReverseSteps(null)
    setReverseTitle(undefined)
  };

  const calculateReverse = () => {
    const targetCh = parseFloat(reverseChainage);
    if (isNaN(targetCh) || results.length === 0) return;

    const s = reverseChainageSolved({ targetChainage: targetCh, table: results })
    setReverseResult(s.result)
    setReverseSteps(s.steps)
    setReverseTitle(s.solution.title)
  };

  const formatChainage = (value: number): string => {
    const km = Math.floor(value / 1000);
    const m = value % 1000;
    return `${km}+${m.toFixed(3).padStart(3, '0')}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Chainage Calculator</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Calculate chainage along an alignment (road/pipeline surveys)</p>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Starting Station</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Easting (m)</label>
                <input className="input" value={startStation.easting} onChange={e => setStartStation({...startStation, easting: e.target.value})} />
              </div>
              <div>
                <label className="label">Northing (m)</label>
                <input className="input" value={startStation.northing} onChange={e => setStartStation({...startStation, northing: e.target.value})} />
              </div>
            </div>
            <div className="mt-4">
              <label className="label">Starting Chainage (m)</label>
              <input className="input" value={startChainage} onChange={e => setStartChainage(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-[var(--text-primary)]">Alignment Points</h3>
              <button onClick={addPoint} className="text-sm px-3 py-1 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded hover:bg-[var(--border-hover)]">+ Add Point</button>
            </div>
            <div className="space-y-3">
              {alignmentPoints.map((point, idx) => (
                <div key={point.id} className="flex gap-2 items-center">
                  <input className="input w-16 text-center" value={point.name} onChange={e => updatePoint(point.id, 'name', e.target.value)} />
                  <input className="input flex-1" value={point.easting} onChange={e => updatePoint(point.id, 'easting', e.target.value)} placeholder="Easting" />
                  <input className="input flex-1" value={point.northing} onChange={e => updatePoint(point.id, 'northing', e.target.value)} placeholder="Northing" />
                  {alignmentPoints.length > 2 && (
                    <button onClick={() => removePoint(point.id)} className="text-red-400 hover:text-red-300 px-2">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button onClick={calculate} className="w-full px-6 py-4 bg-[#E8841A] hover:bg-[#d67715] text-black font-bold rounded-lg">
            Calculate Chainages
          </button>

          {results.length > 0 && (
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
              <h3 className="font-semibold text-[var(--text-primary)] mb-4">Reverse Calculation</h3>
              <p className="text-xs text-[var(--text-muted)] mb-3">Find coordinates at a given chainage</p>
              <div className="flex gap-2">
                <input className="input flex-1" value={reverseChainage} onChange={e => setReverseChainage(e.target.value)} placeholder="Chainage (m)" />
                <button onClick={calculateReverse} className="px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded hover:bg-[var(--border-hover)]">Find</button>
              </div>
              {reverseResult && (
                <div className="mt-4 p-3 bg-[var(--bg-tertiary)]/50 rounded-lg">
                  <p className="text-sm text-[var(--text-secondary)]">Coordinates at {reverseChainage}m:</p>
                  <p className="font-mono text-[var(--text-primary)]">E: {reverseResult.easting.toFixed(4)} m</p>
                  <p className="font-mono text-[var(--text-primary)]">N: {reverseResult.northing.toFixed(4)} m</p>
                </div>
              )}
              {reverseSteps ? (
                <div className="mt-4">
                  <SolutionStepsRenderer title={reverseTitle} steps={reverseSteps} />
                </div>
              ) : null}
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
            {steps ? (
              <div className="mb-6">
                <SolutionStepsRenderer title={solutionTitle} steps={steps} />
              </div>
            ) : null}
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Chainage Table</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    <th className="text-left py-2 text-[var(--text-secondary)]">Point</th>
                    <th className="text-right py-2 text-[var(--text-secondary)]">Easting</th>
                    <th className="text-right py-2 text-[var(--text-secondary)]">Northing</th>
                    <th className="text-right py-2 text-[var(--text-secondary)]">Chainage</th>
                    <th className="text-right py-2 text-[var(--text-secondary)]">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, idx) => (
                    <tr key={idx} className="border-b border-[var(--border-color)]">
                      <td className="py-2 text-[var(--text-primary)] font-medium">{r.pointName}</td>
                      <td className="py-2 text-right font-mono text-[var(--text-primary)]">{r.easting.toFixed(3)}</td>
                      <td className="py-2 text-right font-mono text-[var(--text-primary)]">{r.northing.toFixed(3)}</td>
                      <td className="py-2 text-right font-mono text-[#E8841A]">{formatChainage(r.chainage)}</td>
                      <td className="py-2 text-right font-mono text-[var(--text-secondary)]">
                        {r.distance > 0 ? r.distance.toFixed(3) + ' m' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-[var(--bg-tertiary)]/30 rounded-lg">
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-[var(--text-secondary)]">Total Points:</span>
                <span className="text-[var(--text-primary)] font-mono">{results.length}</span>
                <span className="text-[var(--text-secondary)]">Start Chainage:</span>
                <span className="text-[var(--text-primary)] font-mono">{formatChainage(results[0].chainage)}</span>
                <span className="text-[var(--text-secondary)]">End Chainage:</span>
                <span className="text-[var(--text-primary)] font-mono">{formatChainage(results[results.length - 1].chainage)}</span>
                <span className="text-[var(--text-secondary)]">Total Length:</span>
                <span className="text-[var(--text-primary)] font-mono">{(results[results.length - 1].chainage - results[0].chainage).toFixed(3)} m</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
