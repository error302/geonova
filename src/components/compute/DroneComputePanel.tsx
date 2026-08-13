'use client';

import { useState, useMemo } from 'react';
import { Plane, Save, CheckCircle, BarChart3 } from 'lucide-react';
import { logger } from '@/lib/logger'

interface GCPInput {
  id: string;
  name: string;
  knownE: number;
  knownN: number;
  knownZ: number;
  measE: number;
  measN: number;
  measZ: number;
}

const DEMO_GCPS: GCPInput[] = [
  { id: '1', name: 'GCP-01', knownE: 500000.123, knownN: 9980000.456, knownZ: 1520.10, measE: 500000.138, measN: 9980000.441, measZ: 1520.15 },
  { id: '2', name: 'GCP-02', knownE: 500010.789, knownN: 9980010.012, knownZ: 1518.35, measE: 500010.775, measN: 9980010.028, measZ: 1518.32 },
  { id: '3', name: 'GCP-03', knownE: 500025.456, knownN: 9979995.678, knownZ: 1522.80, measE: 500025.470, measN: 9979995.663, measZ: 1522.85 },
];

export default function DroneComputePanel({ projectId }: { projectId: string }) {
  const [gcps] = useState<GCPInput[]>(DEMO_GCPS);
  const [gridPoints, setGridPoints] = useState('0,0,1.2\n5,0,1.5\n10,0,1.3\n0,5,1.4\n5,5,1.8\n10,5,1.6');
  const [refPlane, setRefPlane] = useState(1.0);
  const [saved, setSaved] = useState(false);

  const residuals = useMemo(() => gcps.map(g => {
    const dE = g.measE - g.knownE;
    const dN = g.measN - g.knownN;
    const dZ = g.measZ - g.knownZ;
    const horiz = Math.sqrt(dE * dE + dN * dN);
    const total3D = Math.sqrt(dE * dE + dN * dN + dZ * dZ);
    return { name: g.name, dE, dN, dZ, horizontal: horiz, total3D };
  }), [gcps]);

  const n = residuals.length || 1;
  const hRMSE = Math.sqrt(residuals.reduce((s, r) => s + r.horizontal ** 2, 0) / n);
  const vRMSE = Math.sqrt(residuals.reduce((s, r) => s + r.dZ ** 2, 0) / n);
  const totalRMSE = Math.sqrt(residuals.reduce((s, r) => s + r.total3D ** 2, 0) / n);

  // Volume
  const volume = useMemo(() => {
    const lines = gridPoints.trim().split('\n').filter(l => l.trim());
    const pts = lines.map(l => l.split(',').map(Number)).filter(p => !p.some(isNaN));
    if (pts.length < 4) return null;
    const uniqueX = Array.from(new Set(pts.map(p => p[0]))).sort((a, b) => a - b);
    const uniqueY = Array.from(new Set(pts.map(p => p[1]))).sort((a, b) => a - b);
    const grid = new Map(pts.map(p => [`${p[0]},${p[1]}`, p]));
    let vol = 0;
    for (let i = 0; i < uniqueX.length - 1; i++) {
      for (let j = 0; j < uniqueY.length - 1; j++) {
        const c = [grid.get(`${uniqueX[i]},${uniqueY[j]}`), grid.get(`${uniqueX[i+1]},${uniqueY[j]}`), grid.get(`${uniqueX[i+1]},${uniqueY[j+1]}`), grid.get(`${uniqueX[i]},${uniqueY[j+1]}`)];
        if (c.every((v): v is number[] => Boolean(v))) {
          const cellArea = Math.abs(uniqueX[i+1] - uniqueX[i]) * Math.abs(uniqueY[j+1] - uniqueY[j]);
          const avgH = c.reduce((s, p) => s + Math.max(p[2] - refPlane, 0), 0) / 4;
          vol += avgH * cellArea;
        }
      }
    }
    return vol;
  }, [gridPoints, refPlane]);

  const handleSave = async () => {
    try {
      await fetch(`/api/project/${projectId}/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'drone', results: { residuals, hRMSE, vRMSE, totalRMSE, volume } }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { logger.error(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold"><Plane className="w-4 h-4 inline mr-1" />Drone Survey QA</h3>

      {/* RMSE Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 bg-zinc-900 rounded border border-zinc-700 text-center">
          <div className="text-xs text-zinc-500">H RMSE</div>
          <div className="text-sm font-bold text-amber-400">{hRMSE.toFixed(4)} m</div>
        </div>
        <div className="p-2 bg-zinc-900 rounded border border-zinc-700 text-center">
          <div className="text-xs text-zinc-500">V RMSE</div>
          <div className="text-sm font-bold text-blue-400">{vRMSE.toFixed(4)} m</div>
        </div>
        <div className="p-2 bg-zinc-900 rounded border border-zinc-700 text-center">
          <div className="text-xs text-zinc-500">3D RMSE</div>
          <div className="text-sm font-bold text-white">{totalRMSE.toFixed(4)} m</div>
        </div>
      </div>

      {/* GCP Table */}
      <div className="bg-zinc-900 rounded border border-zinc-700 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-700 bg-zinc-800/50">
              <th className="px-2 py-1.5 text-left text-zinc-400">Name</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">dE</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">dN</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">dZ</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">H</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">3D</th>
            </tr>
          </thead>
          <tbody>
            {residuals.map((r, _i) => (
              <tr key={r.name} className="border-b border-zinc-800">
                <td className="px-2 py-1 font-mono">{r.name}</td>
                <td className="px-2 py-1 font-mono">{r.dE >= 0 ? '+' : ''}{r.dE.toFixed(4)}</td>
                <td className="px-2 py-1 font-mono">{r.dN >= 0 ? '+' : ''}{r.dN.toFixed(4)}</td>
                <td className="px-2 py-1 font-mono">{r.dZ >= 0 ? '+' : ''}{r.dZ.toFixed(4)}</td>
                <td className="px-2 py-1 font-mono">{r.horizontal.toFixed(4)}</td>
                <td className="px-2 py-1 font-mono font-semibold text-amber-400">{r.total3D.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Volume Section */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="block text-xs text-zinc-500" htmlFor="grid-points-x-y-z-one-per-line">Grid Points (X,Y,Z) — one per line</label>
          <textarea  id="grid-points-x-y-z-one-per-line" value={gridPoints} onChange={e => setGridPoints(e.target.value)} rows={5} className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs font-mono" />
          <div className="flex gap-2 text-xs">
            <span className="text-zinc-500">Ref Plane:</span>
            <input aria-label="Grid Points (X,Y,Z) — one per line" type="number" step="0.1" value={refPlane} onChange={e => setRefPlane(Number(e.target.value))} className="w-16 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white" />
          </div>
        </div>
        <div className="p-3 bg-zinc-900 rounded border border-zinc-700 h-fit">
          <h4 className="text-xs font-semibold text-zinc-400 mb-2"><BarChart3 className="w-3 h-3 inline mr-1" />Volume Result</h4>
          <div className="text-lg font-bold text-amber-400">{volume !== null ? `${volume.toFixed(2)} m³` : 'Need 4+ points'}</div>
        </div>
      </div>

      <button onClick={handleSave} disabled={saved} className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--accent)] text-black text-xs rounded hover:bg-[var(--accent-dim)] disabled:opacity-50">
        {saved ? <CheckCircle className="w-3 h-3" /> : <Save className="w-3 h-3" />}{saved ? 'Saved' : 'Save Results'}
      </button>
    </div>
  );
}
