'use client';

import { useState } from 'react';
import { Save, CheckCircle, TrendingUp, Layers, Target } from 'lucide-react';
import { logger } from '@/lib/logger'

interface AsBuiltPoint {
  id: string;
  name: string;
  designE: number;
  designN: number;
  designZ: number;
  asbuiltE: number;
  asbuiltN: number;
  asbuiltZ: number;
}

interface SettingOutPoint {
  id: string;
  name: string;
  stationE: number;
  stationN: number;
  stationZ: number;
  offsetE: number;
  offsetN: number;
  designE: number;
  designN: number;
  designZ: number;
}

const DEMO_ASBUILT: AsBuiltPoint[] = [
  { id: '1', name: 'FND-01', designE: 500100.000, designN: 9980100.000, designZ: 1250.000, asbuiltE: 500100.008, asbuiltN: 9980100.005, asbuiltZ: 1249.992 },
  { id: '2', name: 'FND-02', designE: 500110.000, designN: 9980100.000, designZ: 1250.000, asbuiltE: 500109.995, asbuiltN: 9980100.012, asbuiltZ: 1250.008 },
  { id: '3', name: 'FND-03', designE: 500110.000, designN: 9980110.000, designZ: 1250.000, asbuiltE: 500110.003, asbuiltN: 9980109.998, asbuiltZ: 1249.995 },
  { id: '4', name: 'FND-04', designE: 500100.000, designN: 9980110.000, designZ: 1250.000, asbuiltE: 500100.010, asbuiltN: 9980110.008, asbuiltZ: 1250.015 },
];

const DEMO_SETTINGOUT: SettingOutPoint[] = [
  { id: '1', name: 'S1', stationE: 500050.000, stationN: 9980050.000, stationZ: 1252.000, offsetE: 500100.000, offsetN: 9980100.000, designE: 500100.000, designN: 9980100.000, designZ: 1250.000 },
  { id: '2', name: 'S2', stationE: 500050.000, stationN: 9980050.000, stationZ: 1252.000, offsetE: 500110.000, offsetN: 9980100.000, designE: 500110.000, designN: 9980100.000, designZ: 1250.000 },
];

export default function ConstructionComputePanel({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<'asbuilt' | 'settingout'>('asbuilt');
  const [asbuilt, setAsbuilt] = useState<AsBuiltPoint[]>(DEMO_ASBUILT);
  const [settingOut, setSettingOut] = useState<SettingOutPoint[]>(DEMO_SETTINGOUT);
  const [toleranceH, setToleranceH] = useState(0.020);
  const [toleranceV, setToleranceV] = useState(0.010);
  const [saved, setSaved] = useState(false);

  // As-built results
  const asbuiltResults = asbuilt.map(p => {
    const dE = p.asbuiltE - p.designE;
    const dN = p.asbuiltN - p.designN;
    const dZ = p.asbuiltZ - p.designZ;
    const horiz = Math.sqrt(dE * dE + dN * dN);
    const total3D = Math.sqrt(dE * dE + dN * dN + dZ * dZ);
    const hPass = horiz <= toleranceH;
    const vPass = Math.abs(dZ) <= toleranceV;
    return { ...p, dE, dN, dZ, horiz, total3D, hPass, vPass, pass: hPass && vPass };
  });

  const failCount = asbuiltResults.filter(r => !r.pass).length;

  // Setting-out results
  const settingOutResults = settingOut.map(p => {
    const dE = p.offsetE - p.stationE;
    const dN = p.offsetN - p.stationN;
    const distance = Math.sqrt(dE * dE + dN * dN);
    const bearing = (Math.atan2(dE, dN) * 180) / Math.PI;
    const bearingNorm = bearing < 0 ? bearing + 360 : bearing;
    const dZ = p.designZ - p.stationZ;
    return { ...p, distance, bearing: bearingNorm, dZ, horizDist: distance };
  });

  const updateAsbuilt = (id: string, field: keyof AsBuiltPoint, value: number) => {
    setAsbuilt(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleSave = async () => {
    try {
      await fetch(`/api/project/${projectId}/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'construction',
          results: activeTab === 'asbuilt'
            ? { asbuiltResults, failCount }
            : { settingOutResults },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { logger.error(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold"><TrendingUp className="w-4 h-4 inline mr-1" />Construction Computations</h3>
        <div className="flex gap-2">
          {(['asbuilt', 'settingout'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded text-xs font-medium ${activeTab === tab ? 'bg-amber-500/20 border border-amber-500 text-amber-400' : 'border border-zinc-700 text-zinc-400'}`}>
              {tab === 'asbuilt' ? <Layers className="w-3 h-3 inline mr-1" /> : <Target className="w-3 h-3 inline mr-1" />}
              {tab === 'asbuilt' ? 'As-Built Check' : 'Setting-Out'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'asbuilt' && (
        <>
          <div className="flex gap-4 text-xs">
            <div><label className="text-zinc-500" htmlFor="h-tol">H Tol:</label> <input id="h-tol" aria-label="H Tol:" type="number" step="0.001" value={toleranceH} onChange={e => setToleranceH(Number(e.target.value))} className="w-16 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white" />m</div>
            <div><label className="text-zinc-500" htmlFor="v-tol">V Tol:</label> <input id="v-tol" aria-label="V Tol:" type="number" step="0.001" value={toleranceV} onChange={e => setToleranceV(Number(e.target.value))} className="w-16 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white" />m</div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="p-2 bg-zinc-900 rounded border border-zinc-700 text-center">
              <div className="text-xs text-zinc-500">Points</div>
              <div className="text-sm font-bold text-white">{asbuilt.length}</div>
            </div>
            <div className="p-2 bg-zinc-900 rounded border border-zinc-700 text-center">
              <div className="text-xs text-zinc-500">Max Offset</div>
              <div className="text-sm font-bold text-red-400">{Math.max(...asbuiltResults.map(r => r.horiz)).toFixed(4)} m</div>
            </div>
            <div className="p-2 bg-zinc-900 rounded border border-zinc-700 text-center">
              <div className="text-xs text-zinc-500">Max ΔZ</div>
              <div className="text-sm font-bold text-blue-400">{Math.max(...asbuiltResults.map(r => Math.abs(r.dZ))).toFixed(4)} m</div>
            </div>
            <div className={`p-2 rounded border text-center ${failCount === 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <div className="text-xs text-zinc-500">Failures</div>
              <div className={`text-sm font-bold ${failCount === 0 ? 'text-green-400' : 'text-red-400'}`}>{failCount}</div>
            </div>
          </div>

          <div className="bg-zinc-900 rounded border border-zinc-700 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-700 bg-zinc-800/50">
                  <th className="px-2 py-1.5 text-left text-zinc-400">Name</th>
                  <th className="px-2 py-1.5 text-left text-zinc-400">dE</th>
                  <th className="px-2 py-1.5 text-left text-zinc-400">dN</th>
                  <th className="px-2 py-1.5 text-left text-zinc-400">dZ</th>
                  <th className="px-2 py-1.5 text-left text-zinc-400">Horiz</th>
                  <th className="px-2 py-1.5 text-left text-zinc-400">H</th>
                  <th className="px-2 py-1.5 text-left text-zinc-400">V</th>
                  <th className="px-2 py-1.5 text-left text-zinc-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {asbuiltResults.map(r => (
                  <tr key={r.id} className={`border-b border-zinc-800 ${!r.pass ? 'bg-red-500/5' : ''}`}>
                    <td className="px-2 py-1 font-mono font-semibold">{r.name}</td>
                    <td className="px-2 py-1 font-mono">{r.dE >= 0 ? '+' : ''}{r.dE.toFixed(4)}</td>
                    <td className="px-2 py-1 font-mono">{r.dN >= 0 ? '+' : ''}{r.dN.toFixed(4)}</td>
                    <td className="px-2 py-1 font-mono">{r.dZ >= 0 ? '+' : ''}{r.dZ.toFixed(4)}</td>
                    <td className="px-2 py-1 font-mono font-semibold">{r.horiz.toFixed(4)}</td>
                    <td className="px-2 py-1">{r.hPass ? <span className="text-green-400">OK</span> : <span className="text-red-400">FAIL</span>}</td>
                    <td className="px-2 py-1">{r.vPass ? <span className="text-green-400">OK</span> : <span className="text-red-400">FAIL</span>}</td>
                    <td className="px-2 py-1">{r.pass ? <span className="text-green-400 font-semibold">PASS</span> : <span className="text-red-400 font-semibold">FAIL</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'settingout' && (
        <div className="bg-zinc-900 rounded border border-zinc-700 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-700 bg-zinc-800/50">
                <th className="px-2 py-1.5 text-left text-zinc-400">Point</th>
                <th className="px-2 py-1.5 text-left text-zinc-400">Distance</th>
                <th className="px-2 py-1.5 text-left text-zinc-400">Bearing</th>
                <th className="px-2 py-1.5 text-left text-zinc-400">ΔZ</th>
                <th className="px-2 py-1.5 text-left text-zinc-400">Vertical Angle</th>
              </tr>
            </thead>
            <tbody>
              {settingOutResults.map(r => {
                const vAngle = (Math.atan2(r.dZ, r.distance) * 180) / Math.PI;
                return (
                  <tr key={r.id} className="border-b border-zinc-800">
                    <td className="px-2 py-1 font-mono font-semibold">{r.name}</td>
                    <td className="px-2 py-1 font-mono text-amber-400">{r.distance.toFixed(3)} m</td>
                    <td className="px-2 py-1 font-mono text-blue-400">{r.bearing.toFixed(3)}°</td>
                    <td className="px-2 py-1 font-mono">{r.dZ >= 0 ? '+' : ''}{r.dZ.toFixed(3)} m</td>
                    <td className="px-2 py-1 font-mono">{vAngle.toFixed(4)}°</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <button onClick={handleSave} disabled={saved} className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--accent)] text-black text-xs rounded hover:bg-[var(--accent-dim)] disabled:opacity-50">
        {saved ? <CheckCircle className="w-3 h-3" /> : <Save className="w-3 h-3" />}{saved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}
