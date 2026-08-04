'use client';

import { useState, useMemo } from 'react';
import { Mountain, Save, CheckCircle, Grid3X3 } from 'lucide-react';

interface TopoPoint {
  id: string;
  name: string;
  easting: number;
  northing: number;
  elevation: number;
  code: string;
}

function computeArea(points: TopoPoint[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].easting * points[j].northing;
    area -= points[j].easting * points[i].northing;
  }
  return Math.abs(area) / 2;
}

function computeDTMGrid(points: TopoPoint[], gridSize: number) {
  if (points.length < 3) return { grid: [], minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const xs = points.map(p => p.easting);
  const ys = points.map(p => p.northing);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const grid: { x: number; y: number; z: number; method: string }[] = [];
  const stepX = gridSize;
  const stepY = gridSize;

  for (let x = minX; x <= maxX; x += stepX) {
    for (let y = minY; y <= maxY; y += stepY) {
      // IDW interpolation with power 2, minimum 3 points
      let wSum = 0, wZSum = 0;
      const dists = points.map(p => {
        const d = Math.sqrt((p.easting - x) ** 2 + (p.northing - y) ** 2);
        return { d, p };
      }).sort((a, b) => a.d - b.d).slice(0, 8);

      for (const { d, p } of dists) {
        if (d === 0) { wSum = 1; wZSum = p.elevation; break; }
        const w = 1 / (d * d);
        wSum += w;
        wZSum += w * p.elevation;
      }

      const z = wSum > 0 ? wZSum / wSum : 0;
      const nearest = dists[0]?.d || Infinity;
      const method = nearest > gridSize * 1.5 ? 'extrapolated' : 'IDW';
      grid.push({ x, y, z, method });
    }
  }

  return { grid, minX, maxX, minY, maxY };
}

function computeContours(grid: ReturnType<typeof computeDTMGrid>['grid'], interval: number) {
  if (grid.length === 0) return [];
  const zs = grid.map(g => g.z);
  const minZ = Math.floor(Math.min(...zs) / interval) * interval;
  const maxZ = Math.ceil(Math.max(...zs) / interval) * interval;
  const levels = [];
  for (let z = minZ; z <= maxZ; z += interval) {
    const pointsAtLevel = grid.filter(g => Math.abs(g.z - z) < interval / 2);
    levels.push({ elevation: z, pointCount: pointsAtLevel.length, points: pointsAtLevel });
  }
  return levels;
}

const DEMO_POINTS: TopoPoint[] = [
  { id: '1', name: 'T1', easting: 100, northing: 100, elevation: 125.0, code: 'RM' },
  { id: '2', name: 'T2', easting: 200, northing: 100, elevation: 128.5, code: 'RM' },
  { id: '3', name: 'T3', easting: 300, northing: 100, elevation: 131.0, code: 'RM' },
  { id: '4', name: 'T4', easting: 300, northing: 200, elevation: 129.0, code: 'RM' },
  { id: '5', name: 'T5', easting: 200, northing: 200, elevation: 124.5, code: 'RM' },
  { id: '6', name: 'T6', easting: 100, northing: 200, elevation: 122.0, code: 'RM' },
  { id: '7', name: 'D1', easting: 150, northing: 150, elevation: 126.2, code: 'DP' },
  { id: '8', name: 'D2', easting: 250, northing: 150, elevation: 127.8, code: 'DP' },
];

export default function TopoComputePanel({ projectId }: { projectId: string }) {
  const [points, setPoints] = useState<TopoPoint[]>(DEMO_POINTS);
  const [gridSize, setGridSize] = useState(50);
  const [contourInterval, setContourInterval] = useState(1.0);
  const [saved, setSaved] = useState(false);

  const area = useMemo(() => computeArea(points), [points]);
  const dtm = useMemo(() => computeDTMGrid(points, gridSize), [points, gridSize]);
  const contours = useMemo(() => computeContours(dtm.grid, contourInterval), [dtm.grid, contourInterval]);

  const minElev = dtm.grid.length > 0 ? Math.min(...dtm.grid.map(g => g.z)) : 0;
  const maxElev = dtm.grid.length > 0 ? Math.max(...dtm.grid.map(g => g.z)) : 0;

  const addPoint = () => {
    setPoints(prev => [...prev, { id: String(prev.length + 1), name: `P${prev.length + 1}`, easting: 0, northing: 0, elevation: 0, code: 'DP' }]);
  };

  const updatePoint = (id: string, field: keyof TopoPoint, value: string | number) => {
    setPoints(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleSave = async () => {
    try {
      await fetch(`/api/project/${projectId}/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'topographic', results: { area, dtmGrid: dtm.grid, contours, minElev, maxElev } }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold"><Mountain className="w-4 h-4 inline mr-1" />Topographic Computations</h3>
        <div className="flex gap-2">
          <div className="text-xs">
            <label className="text-zinc-500 mr-1" htmlFor="grid">Grid:</label>
            <input id="grid" aria-label="Grid:" type="number" value={gridSize} onChange={e => setGridSize(Number(e.target.value))} className="w-14 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white text-xs" min={5} />m
          </div>
          <div className="text-xs">
            <label className="text-zinc-500 mr-1" htmlFor="contour">Contour:</label>
            <input aria-label="Contour:" type="number" step="0.5" value={contourInterval} onChange={e => setContourInterval(Number(e.target.value))} className="w-14 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white text-xs" min={0.1} />m
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="p-2 bg-zinc-900 rounded border border-zinc-700 text-center">
          <div className="text-xs text-zinc-500">Points</div>
          <div className="text-sm font-bold text-white">{points.length}</div>
        </div>
        <div className="p-2 bg-zinc-900 rounded border border-zinc-700 text-center">
          <div className="text-xs text-zinc-500">Area</div>
          <div className="text-sm font-bold text-amber-400">{area.toFixed(1)} m²</div>
        </div>
        <div className="p-2 bg-zinc-900 rounded border border-zinc-700 text-center">
          <div className="text-xs text-zinc-500">Elev Range</div>
          <div className="text-sm font-bold text-blue-400">{minElev.toFixed(1)}–{maxElev.toFixed(1)} m</div>
        </div>
        <div className="p-2 bg-zinc-900 rounded border border-zinc-700 text-center">
          <div className="text-xs text-zinc-500">DTM Grid</div>
          <div className="text-sm font-bold text-green-400"><Grid3X3 className="w-3 h-3 inline" />{dtm.grid.length} cells</div>
        </div>
      </div>

      {/* Point Table */}
      <div className="bg-zinc-900 rounded border border-zinc-700 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-700 bg-zinc-800/50">
              <th className="px-2 py-1.5 text-left text-zinc-400">Name</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">E</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">N</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">Z</th>
              <th className="px-2 py-1.5 text-left text-zinc-400">Code</th>
            </tr>
          </thead>
          <tbody>
            {points.map(p => (
              <tr key={p.id} className="border-b border-zinc-800">
                <td className="px-2 py-1"><input aria-label="Name" type="text" value={p.name} onChange={e => updatePoint(p.id, 'name', e.target.value)} className="w-14 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white" /></td>
                <td className="px-2 py-1"><input aria-label="Easting" type="number" step="0.1" value={p.easting} onChange={e => updatePoint(p.id, 'easting', Number(e.target.value))} className="w-20 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white" /></td>
                <td className="px-2 py-1"><input aria-label="Northing" type="number" step="0.1" value={p.northing} onChange={e => updatePoint(p.id, 'northing', Number(e.target.value))} className="w-20 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white" /></td>
                <td className="px-2 py-1"><input aria-label="Elevation" type="number" step="0.01" value={p.elevation} onChange={e => updatePoint(p.id, 'elevation', Number(e.target.value))} className="w-20 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white" /></td>
                <td className="px-2 py-1"><input aria-label="Code" type="text" value={p.code} onChange={e => updatePoint(p.id, 'code', e.target.value)} className="w-12 bg-zinc-800 border border-zinc-700 rounded px-1 py-0.5 text-white" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Contour Summary */}
      <div className="p-3 bg-zinc-900 rounded border border-zinc-700">
        <h4 className="text-xs font-semibold text-zinc-400 mb-2">Contour Levels ({contours.length})</h4>
        <div className="flex flex-wrap gap-2">
          {contours.slice(0, 20).map(c => (
            <div key={c.elevation} className="px-2 py-0.5 bg-zinc-800 rounded text-xs">
              <span className="text-amber-400 font-mono">{c.elevation.toFixed(1)}m</span>
              <span className="text-zinc-500 ml-1">({c.pointCount})</span>
            </div>
          ))}
          {contours.length > 20 && <span className="text-xs text-zinc-500">+{contours.length - 20} more</span>}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={addPoint} className="px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded text-zinc-400 hover:text-white">+ Point</button>
        <button onClick={handleSave} disabled={saved} className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--accent)] text-black text-xs rounded hover:bg-[var(--accent-dim)] disabled:opacity-50">
          {saved ? <CheckCircle className="w-3 h-3" /> : <Save className="w-3 h-3" />}{saved ? 'Saved' : 'Save Results'}
        </button>
      </div>
    </div>
  );
}
