'use client';

/**
 * TinTab — TIN generation + Cut/Fill from point clouds.
 *
 * Self-contained component (like VolumeTab) that routes through
 * surfaceService's heavy path: clouds >= 100k points compute in the
 * Python sidecar (scipy Delaunay), smaller clouds use the local
 * Delaunator engine. A source badge shows which path was used.
 *
 * Cut/fill also routes through computeVolumeHeavy for large clouds.
 */

import { useState, useCallback } from 'react';
import type { TINTriangle } from '@/lib/compute/tin';
import type { BoundingBox, ImportedPoint } from './types';
import { fmt } from './helpers';

interface TinTabProps {
  points: ImportedPoint[];
  boundingBox: BoundingBox | null;
}

export default function TinTab({ points, boundingBox }: TinTabProps) {
  // ── TIN state ─────────────────────────────────────────────────────────────
  const [triangles, setTriangles] = useState<TINTriangle[] | null>(null);
  const [surfaceArea, setSurfaceArea] = useState(0);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [source, setSource] = useState<'local' | 'python-sidecar' | null>(null);

  // ── Cut/Fill state ────────────────────────────────────────────────────────
  const [datumRL, setDatumRL] = useState('');
  const [cutFillResult, setCutFillResult] = useState<{
    totalCutVolume: number;
    totalFillVolume: number;
    netVolume: number;
    cutArea: number;
    fillArea: number;
    balancePoint: number;
  } | null>(null);
  const [cutFillError, setCutFillError] = useState('');
  const [cutFillRunning, setCutFillRunning] = useState(false);
  const [cutFillSource, setCutFillSource] = useState<'local' | 'python-sidecar' | null>(null);

  // ── TIN generation ────────────────────────────────────────────────────────
  const runTIN = useCallback(async () => {
    if (points.length < 3) {
      setError('At least 3 points are required for TIN generation.');
      return;
    }
    setRunning(true);
    setError('');

    try {
      const tinPoints = points.map((p, i) => ({
        id: p.id || `tin-${i}`,
        x: p.easting,
        y: p.northing,
        z: p.elevation,
      }));

      // Route through surfaceService's heavy path: >= 100k points go to
      // the Python sidecar (scipy.spatial.Delaunay); smaller clouds use
      // the local Delaunator engine. Falls back to local when sidecar is
      // unavailable.
      const { generateTINHeavy } = await import('@/lib/compute/surfaceService');
      const heavy = await generateTINHeavy(tinPoints);

      setTriangles(heavy.triangles);
      setSource(heavy.source === 'worker' ? 'python-sidecar' : 'local');

      // Compute surface area
      const area = heavy.triangles.reduce((s, t) => s + t.area_m2, 0);
      setSurfaceArea(area);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'TIN generation failed.');
    } finally {
      setRunning(false);
    }
  }, [points]);

  // ── Export TIN CSV ────────────────────────────────────────────────────────
  const exportTINCSV = useCallback(() => {
    if (!triangles) return;
    const header = 'Triangle,E1,N1,Z1,E2,N2,Z2,E3,N3,Z3,Area_m2';
    const rows = triangles.map((t, i) => [
      i + 1,
      t.a.x.toFixed(4), t.a.y.toFixed(4), t.a.z.toFixed(4),
      t.b.x.toFixed(4), t.b.y.toFixed(4), t.b.z.toFixed(4),
      t.c.x.toFixed(4), t.c.y.toFixed(4), t.c.z.toFixed(4),
      t.area_m2.toFixed(4),
    ].join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tin_mesh.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [triangles]);

  // ── Cut/Fill computation ──────────────────────────────────────────────────
  const runCutFill = useCallback(async () => {
    if (points.length < 3) {
      setCutFillError('At least 3 points are required for cut/fill computation.');
      return;
    }
    const datum = parseFloat(datumRL);
    if (isNaN(datum)) {
      setCutFillError('Please enter a valid datum RL.');
      return;
    }
    setCutFillRunning(true);
    setCutFillError('');

    try {
      const dtmPoints = points.map(p => ({
        easting: p.easting,
        northing: p.northing,
        elevation: p.elevation,
      }));

      // Route through surfaceService's heavy path for large clouds
      const { computeVolumeHeavy } = await import('@/lib/compute/surfaceService');
      const { result, source: src } = await computeVolumeHeavy({
        surface1: dtmPoints,
        mode: 'cutfill',
        cellSize: 1.0,
        baseElevation: datum,
      });

      setCutFillResult({
        totalCutVolume: result.cut,
        totalFillVolume: result.fill,
        netVolume: result.net,
        cutArea: result.cutArea ?? 0,
        fillArea: result.fillArea ?? 0,
        balancePoint: result.balanceElevation ?? datum,
      });
      setCutFillSource(src === 'worker' ? 'python-sidecar' : 'local');
    } catch (err) {
      setCutFillError(err instanceof Error ? err.message : 'Cut/fill computation failed.');
    } finally {
      setCutFillRunning(false);
    }
  }, [points, datumRL]);

  // ── Export Cut/Fill CSV ───────────────────────────────────────────────────
  const exportCutFillCSV = useCallback(() => {
    if (!cutFillResult) return;
    const lines = [
      'Metric,Value',
      `Cut Volume (m³),${cutFillResult.totalCutVolume.toFixed(3)}`,
      `Fill Volume (m³),${cutFillResult.totalFillVolume.toFixed(3)}`,
      `Net Volume (m³),${cutFillResult.netVolume.toFixed(3)}`,
      `Cut Area (m²),${cutFillResult.cutArea.toFixed(2)}`,
      `Fill Area (m²),${cutFillResult.fillArea.toFixed(2)}`,
      `Balance Point (m),${cutFillResult.balancePoint.toFixed(3)}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cut_fill_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [cutFillResult]);

  // ── Source badge ──────────────────────────────────────────────────────────
  const SourceBadge = ({ src }: { src: 'local' | 'python-sidecar' | null }) => {
    if (!src) return null;
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
        src === 'python-sidecar'
          ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
          : 'bg-emerald-500/15 text-emerald-400'
      }`}>
        {src === 'python-sidecar' ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            Python sidecar
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Local engine
          </>
        )}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ═══ TIN generation ═══ */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <span className="label">TIN Generation (Delaunay Triangulation)</span>
          <SourceBadge src={source} />
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Generates a Triangulated Irregular Network from the imported points.
          {points.length >= 100_000
            ? ' Large cloud — routed to the Python sidecar (scipy Delaunay) when available.'
            : ' Uses Delaunator for Delaunay triangulation.'}
        </p>
        <button
          onClick={runTIN}
          disabled={running || points.length < 3}
          className="btn btn-primary"
        >
          {running ? 'Generating TIN...' : 'Generate TIN'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {triangles && (
        <>
          {/* TIN Results */}
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
                <span className="font-mono text-xl text-[var(--accent)]">{triangles.length.toLocaleString()}</span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Plan Area (2D)</span>
                <span className="font-mono text-xl">
                  {triangles.reduce((s, t) => s + t.area_m2, 0).toFixed(1)} m²
                </span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Surface Area (3D)</span>
                <span className="font-mono text-xl">
                  {surfaceArea.toFixed(1)} m²
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
                  const maxTris = 2000;
                  const step = Math.max(1, Math.floor(triangles.length / maxTris));
                  return triangles
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
                {triangles.length > 2000 && (
                  <span className="text-xs text-[var(--text-muted)] ml-4">
                    (showing ~2,000 of {triangles.length.toLocaleString()} triangles)
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ Cut/Fill by Datum Plane ═══ */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <span className="label">Cut / Fill by Datum Plane</span>
          <SourceBadge src={cutFillSource} />
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Compute cut and fill volumes relative to a horizontal datum RL.
          {points.length >= 100_000
            ? ' Large cloud — routed to the Python sidecar grid-method engine.'
            : ' Uses the slope analysis engine (IDW grid).'}
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
            disabled={cutFillRunning || points.length < 3 || datumRL === ''}
            className="btn btn-primary"
          >
            {cutFillRunning ? 'Computing...' : 'Compute Cut/Fill'}
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
