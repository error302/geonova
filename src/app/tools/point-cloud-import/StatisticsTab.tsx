'use client';

import type { BoundingBox, ImportedPoint, SortColumn } from './types';
import { downloadCSV, fmt } from './helpers';

interface StatisticsTabProps {
  points: ImportedPoint[];
  boundingBox: BoundingBox | null;
  avgSpacing: number;
  filteredPoints: ImportedPoint[];
  filterMinElev: string;
  filterMaxElev: string;
  setFilterMinElev: (s: string) => void;
  setFilterMaxElev: (s: string) => void;
  sortCol: SortColumn;
  handleSort: (col: SortColumn) => void;
  sortIndicator: (col: SortColumn) => string;
}

export default function StatisticsTab({
  points,
  boundingBox,
  avgSpacing,
  filteredPoints,
  filterMinElev,
  filterMaxElev,
  setFilterMinElev,
  setFilterMaxElev,
  sortCol,
  handleSort,
  sortIndicator,
}: StatisticsTabProps) {
  return (
    <div className="space-y-6">
      {/* Summary statistics */}
      <div className="card">
        <div className="card-header">
          <span className="label">Summary Statistics</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-[var(--bg-tertiary)] rounded">
            <span className="text-[var(--text-secondary)] text-sm block">Point Count</span>
            <span className="font-mono text-xl">{points.length.toLocaleString()}</span>
          </div>
          <div className="p-4 bg-[var(--bg-tertiary)] rounded">
            <span className="text-[var(--text-secondary)] text-sm block">Elevation Range</span>
            <span className="font-mono text-xl">
              {boundingBox ? `${fmt(boundingBox.minZ, 1)}–${fmt(boundingBox.maxZ, 1)}` : '—'}
            </span>
          </div>
          <div className="p-4 bg-[var(--bg-tertiary)] rounded">
            <span className="text-[var(--text-secondary)] text-sm block">Avg. Spacing</span>
            <span className="font-mono text-xl">{fmt(avgSpacing, 2)} m</span>
          </div>
          <div className="p-4 bg-[var(--bg-tertiary)] rounded">
            <span className="text-[var(--text-secondary)] text-sm block">Easting Extent</span>
            <span className="font-mono text-xl">
              {boundingBox ? `${(boundingBox.maxE - boundingBox.minE).toFixed(1)} m` : '—'}
            </span>
          </div>
          <div className="p-4 bg-[var(--bg-tertiary)] rounded">
            <span className="text-[var(--text-secondary)] text-sm block">Northing Extent</span>
            <span className="font-mono text-xl">
              {boundingBox ? `${(boundingBox.maxN - boundingBox.minN).toFixed(1)} m` : '—'}
            </span>
          </div>
          <div className="p-4 bg-[var(--bg-tertiary)] rounded">
            <span className="text-[var(--text-secondary)] text-sm block">Mean Elevation</span>
            <span className="font-mono text-xl">
              {points.length > 0
                ? fmt(points.reduce((s, p) => s + p.elevation, 0) / points.length, 2)
                : '—'} m
            </span>
          </div>
          <div className="p-4 bg-[var(--bg-tertiary)] rounded">
            <span className="text-[var(--text-secondary)] text-sm block">Std. Dev. (Z)</span>
            <span className="font-mono text-xl">
              {(() => {
                if (points.length === 0) return '—';
                const mean = points.reduce((s, p) => s + p.elevation, 0) / points.length;
                const variance = points.reduce((s, p) => s + (p.elevation - mean) ** 2, 0) / points.length;
                return Math.sqrt(variance).toFixed(2);
              })()} m
            </span>
          </div>
          <div className="p-4 bg-[var(--bg-tertiary)] rounded">
            <span className="text-[var(--text-secondary)] text-sm block">BBox SW Corner</span>
            <span className="font-mono text-sm">
              {boundingBox ? `${fmt(boundingBox.minE, 1)}, ${fmt(boundingBox.minN, 1)}` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Point cloud scatter map preview */}
      <div className="card">
        <div className="card-header">
          <span className="label">Point Cloud Map Preview</span>
        </div>
        {boundingBox && (
          <svg viewBox="0 0 500 350" className="w-full bg-[var(--bg-secondary)] rounded" style={{ maxHeight: '350px' }}>
            <rect x="30" y="20" width="440" height="280" fill="none" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4" />
            {(() => {
              const sampleStep = Math.max(1, Math.floor(points.length / 1000));
              const sampledPoints = points.filter((_, i) => i % sampleStep === 0);
              return sampledPoints.map((p, i) => {
                const rangeE = boundingBox.maxE - boundingBox.minE || 1;
                const rangeN = boundingBox.maxN - boundingBox.minN || 1;
                const x = 30 + ((p.easting - boundingBox.minE) / rangeE) * 440;
                const y = 300 - ((p.northing - boundingBox.minN) / rangeN) * 280;
                const rangeZ = boundingBox.maxZ - boundingBox.minZ || 1;
                const t = (p.elevation - boundingBox.minZ) / rangeZ;
                // Color gradient: green (low) → yellow → red (high)
                const r = Math.round(t < 0.5 ? t * 2 * 255 : 255);
                const g = Math.round(t < 0.5 ? 255 : (1 - (t - 0.5) * 2) * 255);
                const color = `rgb(${r},${g},0)`;
                return <circle key={`${p}-${i}`} cx={x} cy={y} r="2" fill={color} opacity="0.7" />;
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
            <div className="w-32 h-3 rounded" style={{ background: 'linear-gradient(to right, #00ff00, #ffff00, #ff0000)' }} />
            <span className="text-xs text-[var(--text-muted)]">High Z</span>
            {points.length > 1000 && (
              <span className="text-xs text-[var(--text-muted)] ml-4">
                (showing ~1,000 of {points.length.toLocaleString()} points)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Filter controls */}
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <span className="label">Point Data ({points.length.toLocaleString()} total, showing {filteredPoints.length})</span>
        </div>
        <div className="flex gap-4 items-end mb-4 flex-wrap">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1" htmlFor="min-elevation">Min Elevation</label>
            <input id="min-elevation"
              className="input w-32 font-mono"
              type="number"
              placeholder="min Z"
              value={filterMinElev}
              onChange={e => setFilterMinElev(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1" htmlFor="max-elevation">Max Elevation</label>
            <input
               id="max-elevation" className="input w-32 font-mono"
              type="number"
              placeholder="max Z"
              value={filterMaxElev}
              onChange={e => setFilterMaxElev(e.target.value)}
            />
          </div>
          <button
            onClick={() => { setFilterMinElev(''); setFilterMaxElev(''); }}
            className="btn btn-secondary text-sm"
          >
            Clear Filter
          </button>
          <button
            onClick={() => {
              const csv = 'Name,Easting,Northing,Elevation\n' +
                points.map(p => `${p.name},${fmt(p.easting)},${fmt(p.northing)},${fmt(p.elevation)}`).join('\n');
              downloadCSV('point_cloud_data.csv', csv);
            }}
            className="btn btn-secondary text-sm ml-auto"
          >
            Export Points CSV
          </button>
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="table">
            <thead className="sticky top-0">
              <tr>
                <th className="cursor-pointer" onClick={() => handleSort('name')}>
                  Name{sortIndicator('name')}
                </th>
                <th className="cursor-pointer" onClick={() => handleSort('easting')}>
                  Easting (m){sortIndicator('easting')}
                </th>
                <th className="cursor-pointer" onClick={() => handleSort('northing')}>
                  Northing (m){sortIndicator('northing')}
                </th>
                <th className="cursor-pointer" onClick={() => handleSort('elevation')}>
                  Elevation (m){sortIndicator('elevation')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPoints.map(p => (
                <tr key={p.id}>
                  <td className="font-semibold">{p.name}</td>
                  <td className="font-mono">{fmt(p.easting)}</td>
                  <td className="font-mono">{fmt(p.northing)}</td>
                  <td className="font-mono">{fmt(p.elevation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {points.length > 50 && (
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Displaying first 50 of {points.length.toLocaleString()} points (sorted).
          </p>
        )}
      </div>
    </div>
  );
}
