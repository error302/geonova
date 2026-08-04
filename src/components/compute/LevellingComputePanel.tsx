'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calculator, Loader2, Save, CheckCircle } from 'lucide-react';

interface FieldBookRow {
  fromStation: string;
  toStation: string;
  angle?: string;
  bearing?: number;
  distance?: number;
  bs?: number;
  is?: number;
  fs?: number;
}

interface LevelRow {
  id: number;
  fromStation: string;
  bs: number | null;
  is: number | null;
  fs: number | null;
  distance: number;
  rise?: number;
  fall?: number;
  rl?: number;
  adjustment?: number;
  adjRL?: number;
}

export default function LevellingComputePanel({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<LevelRow[]>([
    { id: 1, fromStation: 'TBM1', bs: 1.525, is: null, fs: null, distance: 0.050 },
    { id: 2, fromStation: 'CP1', bs: 2.310, is: 1.845, fs: null, distance: 0.030 },
    { id: 3, fromStation: 'CP1', bs: null, is: 1.925, fs: null, distance: 0.030 },
    { id: 4, fromStation: 'A', bs: null, is: null, fs: 0.655, distance: 0.040 },
    { id: 5, fromStation: 'A', bs: 1.780, is: null, fs: null, distance: 0.030 },
    { id: 6, fromStation: 'B', bs: null, is: 2.150, fs: null, distance: 0.035 },
    { id: 7, fromStation: 'TBM1', bs: null, is: null, fs: 3.420, distance: 0.045 },
  ]);
  const [tbmRL, setTbmRL] = useState<number>(150.000);
  const [saved, setSaved] = useState(false);

  const compute = useCallback(() => {
    let cumulativeRL = tbmRL;
    return rows.map((row, i) => {
      const rise = row.bs !== null && i > 0 ? null : null; // computed differently
      let rise2 = 0, fall2 = 0;

      if (row.bs !== null) {
        // BS reading: rise from previous to this
        const prevFS = rows[i - 1]?.fs;
        if (prevFS !== null && prevFS !== undefined) {
          if (row.bs > prevFS) rise2 = row.bs - prevFS;
          else fall2 = prevFS - row.bs;
        }
      }
      if (row.fs !== null && row.bs === null) {
        // FS reading on same station or IS→FS transition
        const prevBS = rows[i - 1]?.bs;
        const prevIS = rows[i - 1]?.is;
        if (prevIS !== null && prevIS !== undefined) {
          if (prevIS > row.fs) rise2 = prevIS - row.fs;
          else fall2 = row.fs - prevIS;
        }
      }
      if (row.is !== null && row.bs === null && row.fs === null) {
        const prev = rows[i - 1];
        const prevVal = prev?.is || prev?.bs;
        if (prevVal !== null && prevVal !== undefined) {
          if (prevVal > row.is) rise2 = prevVal - row.is;
          else fall2 = row.is - prevVal;
        }
      }

      const rl = cumulativeRL + rise2 - fall2;
      cumulativeRL = rl;

      return { ...row, rise: rise2 || 0, fall: fall2 || 0, rl };
    });
  }, [rows, tbmRL]);

  const computedRows = compute();
  const lastRow = computedRows[computedRows.length - 1];
  const misclosure = lastRow ? (lastRow.rl || 0) - tbmRL : 0;
  const totalDistance = rows.reduce((s, r) => s + r.distance, 0);
  const allowableMisclosure = 10 * Math.sqrt(totalDistance * 1000) / 1000; // 10√K mm → m
  const passesCheck = Math.abs(misclosure) <= allowableMisclosure;

  // Distribute adjustment proportionally
  const adjustedRows = computedRows.map((row, i) => {
    const proportion = totalDistance > 0 ? (row.distance / totalDistance) : 0;
    const adjustment = -misclosure * proportion;
    return { ...row, adjustment, adjRL: (row.rl || 0) + adjustment };
  });

  const updateRow = (id: number, field: keyof LevelRow, value: number | null) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const addRow = () => {
    setRows(prev => [...prev, { id: prev.length + 1, fromStation: `P${prev.length + 1}`, bs: null, is: null, fs: null, distance: 0.030 }]);
  };

  const handleSave = async () => {
    try {
      await fetch(`/api/project/${projectId}/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'levelling',
          results: { rows: adjustedRows, misclosure, allowableMisclosure, passesCheck, tbmRL },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold"><Calculator className="w-4 h-4 inline mr-1" />Rise & Fall Levelling</h3>
        <div className="flex gap-2">
          <div className="text-xs">
            <label className="text-zinc-500 mr-1" htmlFor="tbm-rl">TBM RL:</label>
            <input  id="tbm-rl" aria-label="TBM RL:" type="number" step="0.001" value={tbmRL} onChange={e => setTbmRL(Number(e.target.value))} className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-white text-xs" />
          </div>
          <button onClick={addRow} className="px-2 py-0.5 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-400 hover:text-white">+ Row</button>
        </div>
      </div>

      <div className="bg-zinc-900 rounded border border-zinc-700 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-700 bg-zinc-800/50">
              <th className="px-2 py-1.5 text-left text-zinc-400">Station</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">BS</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">IS</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">FS</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">Rise</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">Fall</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">RL</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">Dist (km)</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">Adj</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">Adj RL</th>
            </tr>
          </thead>
          <tbody>
            {adjustedRows.map(r => (
              <tr key={r.id} className="border-b border-zinc-800">
                <td className="px-2 py-1 font-mono text-zinc-300">{r.fromStation}</td>
                <td className="px-2 py-1"><input aria-label="Bs" type="number" step="0.001" value={r.bs ?? ''} onChange={e => updateRow(r.id, 'bs', e.target.value ? Number(e.target.value) : null)} className="w-16 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white" /></td>
                <td className="px-2 py-1"><input aria-label="Is" type="number" step="0.001" value={r.is ?? ''} onChange={e => updateRow(r.id, 'is', e.target.value ? Number(e.target.value) : null)} className="w-16 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white" /></td>
                <td className="px-2 py-1"><input aria-label="Fs" type="number" step="0.001" value={r.fs ?? ''} onChange={e => updateRow(r.id, 'fs', e.target.value ? Number(e.target.value) : null)} className="w-16 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white" /></td>
                <td className="px-2 py-1 font-mono">{r.rise ? r.rise.toFixed(3) : ''}</td>
                <td className="px-2 py-1 font-mono">{r.fall ? r.fall.toFixed(3) : ''}</td>
                <td className="px-2 py-1 font-mono text-white">{(r.rl ?? 0).toFixed(3)}</td>
                <td className="px-2 py-1"><input aria-label="Distance" type="number" step="0.001" value={r.distance} onChange={e => updateRow(r.id, 'distance', Number(e.target.value))} className="w-16 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white" /></td>
                <td className="px-2 py-1 font-mono text-blue-400">{(r.adjustment ?? 0).toFixed(4)}</td>
                <td className="px-2 py-1 font-mono font-semibold text-amber-400">{(r.adjRL ?? 0).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`p-3 rounded-lg border ${passesCheck ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="text-xs text-zinc-500">Misclosure</div>
          <div className={`text-sm font-bold ${passesCheck ? 'text-green-400' : 'text-red-400'}`}>{misclosure >= 0 ? '+' : ''}{misclosure.toFixed(4)} m</div>
        </div>
        <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700">
          <div className="text-xs text-zinc-500">Allowable (10√K)</div>
          <div className="text-sm font-bold text-white">{allowableMisclosure.toFixed(4)} m</div>
        </div>
        <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700">
          <div className="text-xs text-zinc-500">Total Distance</div>
          <div className="text-sm font-bold text-white">{(totalDistance * 1000).toFixed(0)} m</div>
        </div>
        <div className={`p-3 rounded-lg border ${passesCheck ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="text-xs text-zinc-500">Result</div>
          <div className={`text-sm font-bold ${passesCheck ? 'text-green-400' : 'text-red-400'}`}>{passesCheck ? 'PASS' : 'FAIL'}</div>
        </div>
      </div>

      <button onClick={handleSave} disabled={saved}
        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-black text-xs rounded hover:bg-[var(--accent-dim)] disabled:opacity-50">
        {saved ? <CheckCircle className="w-3 h-3" /> : <Save className="w-3 h-3" />}
        {saved ? 'Saved' : 'Save Results'}
      </button>
    </div>
  );
}
