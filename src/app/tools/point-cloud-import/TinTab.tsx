'use client';

import type { CutFillDatumResult } from '@/lib/engineering/slopeAnalysis';
import type { TINTriangle } from '@/lib/compute/tin';
import type { BoundingBox, ImportedPoint } from './types';
import { fmt } from './helpers';

interface TinTabProps {
  points: ImportedPoint[];
  boundingBox: BoundingBox | null;
  tinTriangles: TINTriangle[] | null;
  tinError: string;
  isTinRunning: boolean;
  tinSurfaceArea: number;
  runTINGeneration: () => void;
  exportTINCSV: () => void;
  datumRL: string;
  setDatumRL: (s: string) => void;
  cutFillResult: CutFillDatumResult | null;
  cutFillError: string;
  isCutFillRunning: boolean;
  runCutFill: () => void;
  exportCutFillCSV: () => void;
}

export default function TinTab({
  points,
  boundingBox,
  tinTriangles,
  tinError,
  isTinRunning,
  tinSurfaceArea,
  runTINGeneration,
  exportTINCSV,
  datumRL,
  setDatumRL,
  cutFillResult,
  cutFillError,
  isCutFillRunning,
  runCutFill,
  exportCutFillCSV,
}: TinTabProps) {
  return (
    <div className="space-y-6">
      {/* TIN generation */}
      <div className="card">
        <div className="card-header">
          <span className="label">TIN Generation (Delaunay Triangulation)</span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Generates a Triangulated Irregular Network from the imported points.
          Uses Delaunator for Delaunay triangulation.
        </p>
        <button
          onClick={runTINGeneration}
          disabled={isTinRunning || points.length < 3}
          className="btn btn-primary"
        >
          {isTinRunning ? 'Generating TIN...' : 'Generate TIN'}
        </button>
      </div>

      {tinError && (
        <div className="p-4 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
          {tinError}
        </div>
      )}

      {tinTriangles && (
        <>
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <span className="label">TIN Results</span>
              <button onClick={exportTINCSV} className="btn btn-secondary text-sm">
                Export TIN CSV
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Input Points</span>
                <span className="font-mono text-xl">{points.length.toLocaleString()}</span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Triangles</span>
                <span className="font-mono text-xl text-[var(--accent)]">{tinTriangles.length.toLocaleString()}</span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Plan Area (2D)</span>
                <span className="font-mono text-xl">
                  {tinTriangles.reduce((s, t) => s + t.area_m2, 0).toFixed(1)} m²
                </span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Surface Area (3D)</span>
                <span className="font-mono text-xl">
                  {tinSurfaceArea.toFixed(1)} m²
                </span>
              </div>
            </div>
          </div>

          {/* TIN mesh preview */}
          <div className="card">
            <div className="card-header">
              <span className="label">TIN Mesh Preview</span>
            </div>
            {boundingBox && (
              <svg viewBox="0 0 500 350" className="w-full bg-[var(--bg-secondary)] rounded" style={{ maxHeight: '350px' }}>
                <rect x="30" y="20" width="440" height="280" fill="none" stroke="var(--border-color)" strokeWidth="1" />
                {(() => {
                  const rangeE = boundingBox.maxE - boundingBox.minE || 1;
                  const rangeN = boundingBox.maxN - boundingBox.minN || 1;
                  const toX = (e: number) => 30 + ((e - boundingBox.minE) / rangeE) * 440;
                  const toY = (n: number) => 300 - ((n - boundingBox.minN) / rangeN) * 280;
                  const rangeZ = boundingBox.maxZ - boundingBox.minZ || 1;
                  // Limit triangles rendered to first 2000 for performance
                  const maxTris = 2000;
                  const step = Math.max(1, Math.floor(tinTriangles.length / maxTris));
                  return tinTriangles
                    .filter((_, i) => i % step === 0)
                    .map((tri, i) => {
                      const avgZ = (tri.a.z + tri.b.z + tri.c.z) / 3;
                      const t = (avgZ - boundingBox.minZ) / rangeZ;
                      const r = Math.round(t < 0.5 ? t * 2 * 200 : 200);
                      const g = Math.round(t < 0.5 ? 100 + t * 2 * 155 : 255 - (t - 0.5) * 2 * 155);
                      const b = Math.round(t < 0.5 ? 200 - t * 2 * 200 : 0);
                      const color = `rgb(${r},${g},${b})`;
                      const pts = `${toX(tri.a.x).toFixed(1)},${toY(tri.a.y).toFixed(1)} ${toX(tri.b.x).toFixed(1)},${toY(tri.b.y).toFixed(1)} ${toX(tri.c.x).toFixed(1)},${toY(tri.c.y).toFixed(1)}`;
                      return <polygon key={`${tri}-${i}`} points={pts} fill={color} fillOpacity="0.6" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />;
                    });
                })()}
                <text x="30" y="315" fill="var(--text-muted)" fontSize="10">E: {fmt(boundingBox.minE, 1)}</text>
                <text x="390" y="315" fill="var(--text-muted)" fontSize="10">{fmt(boundingBox.maxE, 1)}</text>
                <text x="30" y="15" fill="var(--text-muted)" fontSize="10">N: {fmt(boundingBox.maxN, 1)}</text>
                <text x="390" y="335" fill="var(--text-muted)" fontSize="10">{fmt(boundingBox.minN, 1)}</text>
              </svg>
            )}
            {boundingBox && (
              <div className="flex items-center gap-2 mt-2 justify-center">
                <span className="text-xs text-[var(--text-muted)]">Low Z</span>
                <div className="w-32 h-3 rounded" style={{ background: 'linear-gradient(to right, rgb(0,100,200), rgb(200,255,0), rgb(200,0,0))' }} />
                <span className="text-xs text-[var(--text-muted)]">High Z</span>
                {tinTriangles.length > 2000 && (
                  <span className="text-xs text-[var(--text-muted)] ml-4">
                    (showing ~2,000 of {tinTriangles.length.toLocaleString()} triangles)
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Cut/Fill computation */}
      <div className="card">
        <div className="card-header">
          <span className="label">Cut / Fill by Datum Plane</span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Compute cut and fill volumes relative to a horizontal datum RL using the slope analysis engine (IDW grid).
        </p>
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1" htmlFor="datum-rl-m">Datum RL (m)</label>
            <input
               id="datum-rl-m" className="input w-32 font-mono"
              type="number"
              step="0.1"
              aria-label="Datum RL (m)" placeholder="e.g. 1200"
              value={datumRL}
              onChange={e => setDatumRL(e.target.value)}
            />
          </div>
          <button
            onClick={runCutFill}
            disabled={isCutFillRunning || points.length < 3 || datumRL === ''}
            className="btn btn-primary"
          >
            {isCutFillRunning ? 'Computing...' : 'Compute Cut/Fill'}
          </button>
          {boundingBox && (
            <span className="text-xs text-[var(--text-muted)]">
              Elev. range: {fmt(boundingBox.minZ, 1)} – {fmt(boundingBox.maxZ, 1)} m
            </span>
          )}
        </div>
      </div>

      {cutFillError && (
        <div className="p-4 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
          {cutFillError}
        </div>
      )}

      {cutFillResult && (
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <span className="label">Cut/Fill Results</span>
            <button onClick={exportCutFillCSV} className="btn btn-secondary text-sm">
              Export CSV
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Cut Volume</span>
              <span className="font-mono text-xl text-orange-400">
                {cutFillResult.totalCutVolume.toFixed(1)} m³
              </span>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Fill Volume</span>
              <span className="font-mono text-xl text-blue-400">
                {cutFillResult.totalFillVolume.toFixed(1)} m³
              </span>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Net Volume</span>
              <span className={`font-mono text-xl ${cutFillResult.netVolume >= 0 ? 'text-orange-400' : 'text-blue-400'}`}>
                {cutFillResult.netVolume >= 0 ? '+' : ''}{cutFillResult.netVolume.toFixed(1)} m³
              </span>
              <span className="text-xs text-[var(--text-muted)] block">{cutFillResult.netVolume >= 0 ? '(net cut)' : '(net fill)'}</span>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Balance Point</span>
              <span className="font-mono text-xl text-[var(--accent)]">
                {cutFillResult.balancePoint.toFixed(3)} m
              </span>
              <span className="text-xs text-[var(--text-muted)] block">RL where cut ≈ fill</span>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Cut Area</span>
              <span className="font-mono text-lg">{cutFillResult.cutArea.toFixed(1)} m²</span>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Fill Area</span>
              <span className="font-mono text-lg">{cutFillResult.fillArea.toFixed(1)} m²</span>
            </div>
          </div>

          {/* Cut/Fill visual bar */}
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-[var(--text-secondary)]">Cut vs Fill Distribution:</span>
            </div>
            <div className="flex h-8 rounded overflow-hidden">
              {(() => {
                const total = cutFillResult.totalCutVolume + cutFillResult.totalFillVolume || 1;
                const cutPct = (cutFillResult.totalCutVolume / total) * 100;
                const fillPct = (cutFillResult.totalFillVolume / total) * 100;
                return (
                  <>
                    <div className="bg-orange-500 flex items-center justify-center text-xs text-white" style={{ width: `${Math.max(cutPct, 1)}%` }}>
                      {cutPct > 5 ? `Cut ${cutPct.toFixed(1)}%` : ''}
                    </div>
                    <div className="bg-blue-500 flex items-center justify-center text-xs text-white" style={{ width: `${Math.max(fillPct, 1)}%` }}>
                      {fillPct > 5 ? `Fill ${fillPct.toFixed(1)}%` : ''}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
