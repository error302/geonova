'use client';

import { useState, useMemo } from 'react';
import { BarChart3, AlertTriangle, Save, CheckCircle } from 'lucide-react';
import { logger } from '@/lib/logger'

interface EpochPoint {
  name: string;
  easting: number;
  northing: number;
  elevation: number;
}

interface EpochData {
  epochName: string;
  date: string;
  points: EpochPoint[];
}

interface Displacement {
  name: string;
  dE: number;
  dN: number;
  dZ: number;
  horizontal: number;
  total3D: number;
  bearing: number;
  exceedsThreshold: boolean;
}

function computeDisplacements(epoch1: EpochPoint[], epoch2: EpochPoint[]): Displacement[] {
  const map2 = new Map(epoch2.map(p => [p.name, p]));
  return epoch1.map(p1 => {
    const p2 = map2.get(p1.name);
    if (!p2) return null;
    const dE = p2.easting - p1.easting;
    const dN = p2.northing - p1.northing;
    const dZ = p2.elevation - p1.elevation;
    const horizontal = Math.sqrt(dE * dE + dN * dN);
    const total3D = Math.sqrt(dE * dE + dN * dN + dZ * dZ);
    const bearing = (Math.atan2(dE, dN) * 180) / Math.PI;
    const bearingNorm = bearing < 0 ? bearing + 360 : bearing;
    return { name: p1.name, dE, dN, dZ, horizontal, total3D, bearing: bearingNorm, exceedsThreshold: false };
  }).filter(Boolean) as Displacement[];
}

const DEMO_EPOCH1: EpochPoint[] = [
  { name: 'P1', easting: 500000.000, northing: 9980000.000, elevation: 1520.000 },
  { name: 'P2', easting: 500010.000, northing: 9980010.000, elevation: 1518.500 },
  { name: 'P3', easting: 500025.000, northing: 9979995.000, elevation: 1522.800 },
  { name: 'P4', easting: 500015.000, northing: 9979985.000, elevation: 1515.900 },
  { name: 'P5', easting: 500035.000, northing: 9980005.000, elevation: 1519.550 },
];

const DEMO_EPOCH2: EpochPoint[] = [
  { name: 'P1', easting: 500000.005, northing: 9980000.003, elevation: 1520.008 },
  { name: 'P2', easting: 500010.012, northing: 9980009.995, elevation: 1518.502 },
  { name: 'P3', easting: 500024.995, northing: 9979995.010, elevation: 1522.805 },
  { name: 'P4', easting: 500015.008, northing: 9979985.002, elevation: 1515.895 },
  { name: 'P5', easting: 500035.003, northing: 9980005.006, elevation: 1519.558 },
];

export default function MonitoringComputePanel({ projectId }: { projectId: string }) {
  const [epochs] = useState<EpochData[]>([
    { epochName: 'Epoch 1', date: '2025-01-15', points: DEMO_EPOCH1 },
    { epochName: 'Epoch 2', date: '2025-06-15', points: DEMO_EPOCH2 },
  ]);
  const [compareIndex1, setCompareIndex1] = useState(0);
  const [compareIndex2, setCompareIndex2] = useState(1);
  const [threshold, setThreshold] = useState(0.010);
  const [saved, setSaved] = useState(false);

  const displacements = useMemo(() => {
    if (compareIndex1 === compareIndex2 || !epochs[compareIndex1] || !epochs[compareIndex2]) return [];
    const ds = computeDisplacements(epochs[compareIndex1].points, epochs[compareIndex2].points);
    return ds.map(d => ({ ...d, exceedsThreshold: d.total3D > threshold }));
  }, [epochs, compareIndex1, compareIndex2, threshold]);

  const alertCount = displacements.filter(d => d.exceedsThreshold).length;

  const maxDisp = displacements.length > 0 ? Math.max(...displacements.map(d => d.total3D)) : 0;
  const avgDisp = displacements.length > 0 ? displacements.reduce((s, d) => s + d.total3D, 0) / displacements.length : 0;
  const rmsH = Math.sqrt(displacements.reduce((s, d) => s + d.horizontal ** 2, 0) / (displacements.length || 1));
  const rmsV = Math.sqrt(displacements.reduce((s, d) => s + d.dZ ** 2, 0) / (displacements.length || 1));

  const handleSave = async () => {
    try {
      await fetch(`/api/project/${projectId}/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'monitoring', results: { displacements, rmsH, rmsV, maxDisp, avgDisp, alertCount } }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { logger.error(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold"><BarChart3 className="w-4 h-4 inline mr-1" />Multi-Epoch Displacement Monitoring</h3>

      {/* Controls */}
      <div className="flex gap-4 items-end flex-wrap">
        <div>
          <label className="block text-xs text-zinc-500 mb-1" htmlFor="base-epoch">Base Epoch</label>
          <select id="base-epoch" value={compareIndex1} onChange={e => setCompareIndex1(Number(e.target.value))} className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs">
            {epochs.map((ep, i) => <option key={`${ep}-${i}`} value={i}>{ep.epochName} ({ep.date})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1" htmlFor="latest-epoch">Latest Epoch</label>
          <select id="latest-epoch" value={compareIndex2} onChange={e => setCompareIndex2(Number(e.target.value))} className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs">
            {epochs.map((ep, i) => <option key={`${ep}-${i}`} value={i}>{ep.epochName} ({ep.date})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1" htmlFor="alert-threshold-m">Alert Threshold (m)</label>
          <input aria-label="Alert Threshold (m)" type="number" step="0.001" value={threshold} onChange={e => setThreshold(Number(e.target.value))} className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="p-2 bg-zinc-900 rounded border border-zinc-700 text-center">
          <div className="text-xs text-zinc-500">Points</div>
          <div className="text-sm font-bold text-white">{displacements.length}</div>
        </div>
        <div className="p-2 bg-zinc-900 rounded border border-zinc-700 text-center">
          <div className="text-xs text-zinc-500">Max 3D</div>
          <div className="text-sm font-bold text-red-400">{maxDisp.toFixed(4)} m</div>
        </div>
        <div className="p-2 bg-zinc-900 rounded border border-zinc-700 text-center">
          <div className="text-xs text-zinc-500">Avg 3D</div>
          <div className="text-sm font-bold text-amber-400">{avgDisp.toFixed(4)} m</div>
        </div>
        <div className="p-2 bg-zinc-900 rounded border border-zinc-700 text-center">
          <div className="text-xs text-zinc-500">RMS H</div>
          <div className="text-sm font-bold text-blue-400">{rmsH.toFixed(4)} m</div>
        </div>
        <div className={`p-2 rounded border text-center ${alertCount > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
          <div className="text-xs text-zinc-500">Alerts</div>
          <div className={`text-sm font-bold ${alertCount > 0 ? 'text-red-400' : 'text-green-400'}`}>{alertCount}</div>
        </div>
      </div>

      {/* Displacement Table */}
      <div className="bg-zinc-900 rounded border border-zinc-700 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-700 bg-zinc-800/50">
              <th className="px-2 py-1.5 text-left text-zinc-400">Point</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">dE (m)</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">dN (m)</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">dZ (m)</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">Horiz (m)</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">3D (m)</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">Bearing</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {displacements.map(d => (
              <tr key={d.name} className={`border-b border-zinc-800 ${d.exceedsThreshold ? 'bg-red-500/5' : ''}`}>
                <td className="px-2 py-1 font-mono font-semibold">{d.name}</td>
                <td className="px-2 py-1 font-mono">{d.dE >= 0 ? '+' : ''}{d.dE.toFixed(4)}</td>
                <td className="px-2 py-1 font-mono">{d.dN >= 0 ? '+' : ''}{d.dN.toFixed(4)}</td>
                <td className="px-2 py-1 font-mono">{d.dZ >= 0 ? '+' : ''}{d.dZ.toFixed(4)}</td>
                <td className="px-2 py-1 font-mono">{d.horizontal.toFixed(4)}</td>
                <td className={`px-2 py-1 font-mono font-semibold ${d.exceedsThreshold ? 'text-red-400' : 'text-white'}`}>{d.total3D.toFixed(4)}</td>
                <td className="px-2 py-1 font-mono">{d.bearing.toFixed(1)}°</td>
                <td className="px-2 py-1">
                  {d.exceedsThreshold ? (
                    <span className="flex items-center gap-1 text-red-400"><AlertTriangle className="w-3 h-3" />ALERT</span>
                  ) : (
                    <span className="text-green-400">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={handleSave} disabled={saved}
        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-black text-xs rounded hover:bg-[var(--accent-dim)] disabled:opacity-50">
        {saved ? <CheckCircle className="w-3 h-3" /> : <Save className="w-3 h-3" />}
        {saved ? 'Saved' : 'Save Results'}
      </button>
    </div>
  );
}
