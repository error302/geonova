'use client';

import { useState } from 'react';
import { Wrench, Save, CheckCircle } from 'lucide-react';
import { logger } from '@/lib/logger'

/**
 * Engineering Compute Panel — wraps existing engineering sub-components.
 * Provides tabs for Horizontal Curves, Superelevation, and Volumes.
 */
export default function EngineeringComputePanel({ projectId }: { projectId: string }) {
  const [activeTab, setActiveTab] = useState<'curves' | 'superelev' | 'volumes'>('curves');
  const [saved, setSaved] = useState(false);

  // Horizontal Curve state
  const [radius, setRadius] = useState(300);
  const [deflection, setDeflection] = useState(45);
  const [designSpeed, setDesignSpeed] = useState(80);

  // Superelevation state
  const [curveRadius, setCurveRadius] = useState(250);
  const [speed] = useState(80);

  // Volumes state
  const [earthworkPoints, setEarthworkPoints] = useState('0,0,0,0\n5,0,-1.2,0.8\n10,0,-0.5,0.3\n15,0,0,0');

  // Compute horizontal curve
  const tangent = radius * Math.tan((deflection / 2) * Math.PI / 180);
  const curveLength = radius * (deflection * Math.PI / 180);
  const midOrdinate = radius * (1 - Math.cos((deflection / 2) * Math.PI / 180));
  const minRadius = (speed * speed) / (127 * 0.07);

  // Compute superelevation
  const e = (speed * speed) / (127 * curveRadius);
  const eMax = 0.07;
  const eActual = Math.min(e, eMax);

  // Compute volumes
  const volumeResult = (() => {
    const lines = earthworkPoints.trim().split('\n').filter(l => l.trim());
    const pts = lines.map(l => l.split(',').map(Number)).filter(p => !p.some(isNaN) && p.length >= 4);
    if (pts.length < 2) return null;
    let cut = 0, fill = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const avgCut = (Math.max(pts[i][2], 0) + Math.max(pts[i + 1][2], 0)) / 2;
      const avgFill = (Math.max(-pts[i][3], 0) + Math.max(-pts[i + 1][3], 0)) / 2;
      const dist = Math.abs(pts[i + 1][0] - pts[i][0]);
      cut += avgCut * dist;
      fill += avgFill * dist;
    }
    return { cut, fill, net: cut - fill };
  })();

  const handleSave = async () => {
    try {
      await fetch(`/api/project/${projectId}/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'engineering', results: { activeTab, radius, deflection, curveLength, tangent } }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { logger.error(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold"><Wrench className="w-4 h-4 inline mr-1" />Engineering Computations</h3>
        <div className="flex gap-1">
          {([['curves', 'Curves'], ['superelev', 'Superelev.'], ['volumes', 'Volumes']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-2 py-1 rounded text-xs font-medium ${activeTab === key ? 'bg-amber-500/20 border border-amber-500 text-amber-400' : 'border border-zinc-700 text-zinc-400'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'curves' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div><label className="block text-xs text-zinc-500 mb-1" htmlFor="radius-m">Radius (m)</label><input id="radius-m" aria-label="Radius (m)" type="number" value={radius} onChange={e => setRadius(Number(e.target.value))} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-white text-sm" /></div>
            <div><label className="block text-xs text-zinc-500 mb-1" htmlFor="deflection-angle">Deflection Angle (°)</label><input id="deflection-angle" aria-label="Deflection Angle (°)" type="number" value={deflection} onChange={e => setDeflection(Number(e.target.value))} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-white text-sm" /></div>
            <div><label className="block text-xs text-zinc-500 mb-1" htmlFor="design-speed-km-h">Design Speed (km/h)</label><input id="design-speed-km-h" aria-label="Design Speed (km/h)" type="number" value={designSpeed} onChange={e => setDesignSpeed(Number(e.target.value))} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-white text-sm" /></div>
          </div>
          <div className="p-4 bg-zinc-900 rounded border border-zinc-700">
            <h4 className="text-xs font-semibold text-zinc-400 mb-3">Curve Parameters</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-400">Tangent Length:</span><span className="text-white font-semibold">{tangent.toFixed(2)} m</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Curve Length:</span><span className="text-amber-400 font-semibold">{curveLength.toFixed(2)} m</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Mid-Ordinate:</span><span className="text-white">{midOrdinate.toFixed(2)} m</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Min Radius (v={designSpeed}):</span><span className={radius < minRadius ? 'text-red-400' : 'text-green-400'}>{minRadius.toFixed(0)} m {radius < minRadius ? '(TOO SMALL)' : '(OK)'}</span></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'superelev' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div><label className="block text-xs text-zinc-500 mb-1" htmlFor="curve-radius-m">Curve Radius (m)</label><input id="curve-radius-m" aria-label="Curve Radius (m)" type="number" value={curveRadius} onChange={e => setCurveRadius(Number(e.target.value))} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-white text-sm" /></div>
            <div><div className="block text-xs text-zinc-500 mb-1">Speed (km/h)</div><div className="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-white text-sm">{speed}</div></div>
          </div>
          <div className="p-4 bg-zinc-900 rounded border border-zinc-700">
            <h4 className="text-xs font-semibold text-zinc-400 mb-3">Superelevation</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-400">Required e:</span><span className="text-white font-semibold">{(e * 100).toFixed(2)}%</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Actual e (max 7%):</span><span className="text-amber-400 font-semibold">{(eActual * 100).toFixed(2)}%</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Cant (mm):</span><span className="text-white">{(eActual * 1000).toFixed(0)} mm</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Transition Length (L):</span><span className="text-white">{((eActual * speed * speed) / 3.6).toFixed(1)} m</span></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'volumes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1" htmlFor="section-data-chainage-cut-fill-existing">Section Data (chainage, cut, fill, existing)</label>
            <textarea  id="section-data-chainage-cut-fill-existing" value={earthworkPoints} onChange={e => setEarthworkPoints(e.target.value)} rows={6} className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-xs font-mono" />
          </div>
          <div className="p-4 bg-zinc-900 rounded border border-zinc-700 h-fit">
            <h4 className="text-xs font-semibold text-zinc-400 mb-3">Earthwork Summary</h4>
            {volumeResult ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-zinc-400">Cut:</span><span className="text-red-400 font-semibold">{volumeResult.cut.toFixed(1)} m³</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Fill:</span><span className="text-green-400 font-semibold">{volumeResult.fill.toFixed(1)} m³</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Net:</span><span className={`font-semibold ${volumeResult.net >= 0 ? 'text-red-400' : 'text-green-400'}`}>{volumeResult.net >= 0 ? '+' : ''}{volumeResult.net.toFixed(1)} m³</span></div>
              </div>
            ) : <p className="text-xs text-zinc-500">Enter valid section data</p>}
          </div>
        </div>
      )}

      <button onClick={handleSave} disabled={saved} className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--accent)] text-black text-xs rounded hover:bg-[var(--accent-dim)] disabled:opacity-50">
        {saved ? <CheckCircle className="w-3 h-3" /> : <Save className="w-3 h-3" />}{saved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}
