'use client';

import type React from 'react';
import type { BBox, GridCell, Method } from './types';
import type { SurfacePoint } from '@/lib/engine/volume';

interface AnalysisTabProps {
  surveyAPoints: SurfacePoint[];
  surveyBPoints: SurfacePoint[];
  overlapBBox: BBox | null;
  gridSpacing: number;
  setGridSpacing: (n: number) => void;
  method: Method;
  setMethod: (m: Method) => void;
  computing: boolean;
  handleCompute: () => void;
  computeErrors: string[];
  computeWarnings: string[];
  cutVolume: number | null;
  fillVolume: number | null;
  netVolume: number | null;
  overlapArea: number | null;
  balancePoint: number | null;
  gridCells: GridCell[];
  gridBBox: BBox;
  showGrid: boolean;
  setShowGrid: (b: boolean) => void;
  hasComputedRef: React.MutableRefObject<boolean>;
  inputClass: string;
}

export default function AnalysisTab({
  surveyAPoints,
  surveyBPoints,
  overlapBBox,
  gridSpacing,
  setGridSpacing,
  method,
  setMethod,
  computing,
  handleCompute,
  computeErrors,
  computeWarnings,
  cutVolume,
  fillVolume,
  netVolume,
  overlapArea,
  balancePoint,
  gridCells,
  gridBBox,
  showGrid,
  setShowGrid,
  hasComputedRef,
  inputClass,
}: AnalysisTabProps) {
  const total = (cutVolume ?? 0) + (fillVolume ?? 0);
  const cutPct = total > 0 ? ((cutVolume ?? 0) / total) * 100 : 0;
  const fillPct = total > 0 ? ((fillVolume ?? 0) / total) * 100 : 0;
  const maxAbsDiff = gridCells.length > 0 ? Math.max(...gridCells.map(c => Math.abs(c.diff)), 0.001) : 1;

  return (
    <div className="space-y-6">
      {/* Configuration panel */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Computation Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-2" htmlFor="grid-spacing-m">Grid Spacing (m)</label>
            <input id="grid-spacing-m" aria-label="Grid Spacing (m)"
              type="number"
              min={0.1}
              max={5.0}
              step={0.1}
              value={gridSpacing}
              onChange={e => setGridSpacing(Math.max(0.1, Math.min(5.0, Number(e.target.value))))}
              className={inputClass}
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">Range: 0.1 — 5.0 m (default: 1.0)</p>
          </div>
          <div>
            <div className="block text-sm text-[var(--text-secondary)] mb-2">Method</div>
            <div className="flex gap-2">
              <button
                onClick={() => setMethod('tin')}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${method === 'tin' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)]'}`}
              >
                TIN Interpolation
              </button>
              <button
                onClick={() => setMethod('idw')}
                className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${method === 'idw' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)]'}`}
              >
                IDW Grid
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {method === 'tin' ? 'Delaunay TIN with barycentric interpolation' : 'Inverse Distance Weighting (power=2)'}
            </p>
          </div>
          <div>
            <button
              onClick={handleCompute}
              disabled={computing || surveyAPoints.length < 3 || surveyBPoints.length < 3 || !overlapBBox}
              className="w-full px-4 py-3 bg-[var(--accent)] text-black rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {computing ? 'Computing...' : 'Compute Volume'}
            </button>
            {!overlapBBox && surveyAPoints.length >= 3 && surveyBPoints.length >= 3 && (
              <p className="text-xs text-red-400 mt-1">Surveys do not overlap.</p>
            )}
          </div>
        </div>
      </div>

      {/* Errors */}
      {computeErrors.length > 0 && (
        <div className="p-4 bg-red-900/20 border border-red-800/30 rounded-lg">
          <h4 className="text-sm font-medium text-red-400 mb-1">Computation Errors</h4>
          <ul className="text-xs text-red-300/80 space-y-0.5">
            {computeErrors.map((err, i) => <li key={`${err}-${i}`}>{err}</li>)}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {computeWarnings.length > 0 && (
        <div className="p-4 bg-amber-900/20 border border-amber-800/30 rounded-lg">
          <h4 className="text-sm font-medium text-amber-400 mb-1">Warnings</h4>
          <ul className="text-xs text-amber-300/80 space-y-0.5">
            {computeWarnings.map((w, i) => <li key={`${w}-${i}`}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Results */}
      {cutVolume !== null && fillVolume !== null && netVolume !== null && (
        <>
          {/* Volume Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[#8B4513]/15 border border-[#8B4513]/40 rounded-lg">
              <div className="text-xs text-[#D2691E] mb-1">Cut Volume</div>
              <div className="text-2xl font-bold font-mono text-[#D2691E]">{cutVolume.toFixed(2)} m³</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">
                Material removed ({cutPct.toFixed(1)}%)
              </div>
            </div>
            <div className="p-4 bg-[#4169E1]/15 border border-[#4169E1]/40 rounded-lg">
              <div className="text-xs text-[#6495ED] mb-1">Fill Volume</div>
              <div className="text-2xl font-bold font-mono text-[#6495ED]">{fillVolume.toFixed(2)} m³</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">
                Material added ({fillPct.toFixed(1)}%)
              </div>
            </div>
            <div className={`p-4 border rounded-lg ${netVolume >= 0 ? 'bg-amber-900/20 border-amber-800/30' : 'bg-blue-900/20 border-blue-800/30'}`}>
              <div className={`text-xs mb-1 ${netVolume >= 0 ? 'text-amber-400' : 'text-blue-400'}`}>Net Volume</div>
              <div className={`text-2xl font-bold font-mono ${netVolume >= 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                {netVolume >= 0 ? '+' : ''}{netVolume.toFixed(2)} m³
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">
                {netVolume >= 0 ? 'Cut dominant — surplus material' : 'Fill dominant — borrow needed'}
              </div>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg">
              <div className="text-xs text-[var(--text-secondary)] mb-1">Area Overlap</div>
              <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{overlapArea?.toFixed(2)} m²</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">
                Grid: {gridSpacing}m spacing
              </div>
            </div>
          </div>

          {/* Cut/Fill Bar */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Cut / Fill Balance</h3>
            <div className="relative h-12 rounded-lg overflow-hidden flex">
              {cutPct > 0 && (
                <div
                  className="flex items-center justify-center transition-all duration-500"
                  style={{
                    width: `${cutPct}%`,
                    backgroundColor: '#8B4513',
                    minWidth: cutVolume > 0 ? '40px' : '0',
                  }}
                >
                  <span className="text-white text-xs font-mono font-bold drop-shadow">
                    Cut {cutPct.toFixed(0)}%
                  </span>
                </div>
              )}
              {fillPct > 0 && (
                <div
                  className="flex items-center justify-center transition-all duration-500"
                  style={{
                    width: `${fillPct}%`,
                    backgroundColor: '#4169E1',
                    minWidth: fillVolume > 0 ? '40px' : '0',
                  }}
                >
                  <span className="text-white text-xs font-mono font-bold drop-shadow">
                    Fill {fillPct.toFixed(0)}%
                  </span>
                </div>
              )}
              {total === 0 && (
                <div className="w-full flex items-center justify-center bg-gray-600">
                  <span className="text-white text-xs">No volume</span>
                </div>
              )}
            </div>
            <div className="flex justify-between mt-2 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#8B4513' }} />
                Cut (Survey A &gt; B)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#4169E1' }} />
                Fill (Survey B &gt; A)
              </span>
            </div>
          </div>

          {/* Additional metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {fillVolume > 0 && (
              <div className="p-4 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
                <div className="text-xs text-[var(--text-secondary)] mb-1">Cut/Fill Ratio</div>
                <div className="text-xl font-bold font-mono text-[var(--text-primary)]">{(cutVolume! / fillVolume!).toFixed(3)}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {Math.abs(cutVolume! / fillVolume! - 1) < 0.05
                    ? 'Nearly balanced — minimal import/export'
                    : cutVolume! / fillVolume! > 1
                      ? 'Cut surplus — export material needed'
                      : 'Fill deficit — import material needed'}
                </div>
              </div>
            )}
            {balancePoint !== null && (
              <div className="p-4 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
                <div className="text-xs text-[var(--text-secondary)] mb-1">Balance Point (Datum)</div>
                <div className="text-xl font-bold font-mono text-[var(--text-primary)]">{balancePoint.toFixed(3)} m</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  Elevation where cut = fill
                </div>
              </div>
            )}
            <div className="p-4 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
              <div className="text-xs text-[var(--text-secondary)] mb-1">Computation Method</div>
              <div className="text-xl font-bold font-mono text-[var(--text-primary)]">
                {method === 'tin' ? 'TIN' : 'IDW'}
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">
                Grid spacing: {gridSpacing}m | {gridCells.length} cells evaluated
              </div>
            </div>
          </div>

          {/* Per-cell grid visualization */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Per-Cell Analysis Grid</h3>
              <button
                onClick={() => setShowGrid(!showGrid)}
                className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg text-xs hover:border-[var(--accent)] transition-colors"
              >
                {showGrid ? 'Hide Grid' : 'Show Grid'}
              </button>
            </div>

            {showGrid && gridCells.length > 0 && (
              <div className="overflow-x-auto">
                <svg
                  viewBox={`${gridBBox.minE} ${gridBBox.minN} ${gridBBox.maxE - gridBBox.minE} ${gridBBox.maxN - gridBBox.minN}`}
                  className="w-full border border-[var(--border-color)] rounded bg-[#1a1a1a]"
                  style={{ minHeight: 300, maxHeight: 600 }}
                >
                  {gridCells.map((cell, i) => {
                    const opacity = Math.min(1, (Math.abs(cell.diff) / maxAbsDiff) * 0.85 + 0.15);
                    let color: string;
                    if (cell.type === 'cut') color = `rgba(139, 69, 19, ${opacity})`;
                    else if (cell.type === 'fill') color = `rgba(65, 105, 225, ${opacity})`;
                    else color = `rgba(128, 128, 128, 0.15)`;

                    return (
                      <g key={`${cell}-${i}`}>
                        <rect
                          x={cell.easting}
                          y={cell.northing}
                          width={gridSpacing}
                          height={gridSpacing}
                          fill={color}
                          stroke="#333"
                          strokeWidth={0.5}
                        />
                      </g>
                    );
                  })}
                  {/* Scale reference */}
                  <rect
                    x={gridBBox.minE + 2}
                    y={gridBBox.minN + 2}
                    width={10 * gridSpacing}
                    height={5 * gridSpacing}
                    fill="none"
                    stroke="#fff"
                    strokeWidth={1}
                    rx={2}
                  />
                  <text
                    x={gridBBox.minE + 2 + 5 * gridSpacing}
                    y={gridBBox.minN + 2 + 5 * gridSpacing + 4}
                    fill="#fff"
                    fontSize={gridSpacing * 2}
                    textAnchor="middle"
                  >
                    {10 * gridSpacing}m
                  </text>
                </svg>

                {/* Legend */}
                <div className="flex items-center gap-6 mt-3 text-xs text-[var(--text-muted)] justify-center">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#8B4513' }} />
                    <span>Cut (A higher)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#4169E1' }} />
                    <span>Fill (B higher)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'rgba(128, 128, 128, 0.15)', border: '1px solid #555' }} />
                    <span>No change</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[var(--text-secondary)]">Opacity ∝ magnitude</span>
                  </div>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="p-3 bg-[var(--bg-tertiary)] rounded text-center">
                    <div className="text-xs text-[var(--text-muted)]">Cut Cells</div>
                    <div className="text-lg font-bold font-mono text-[#D2691E]">
                      {gridCells.filter(c => c.type === 'cut').length}
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--bg-tertiary)] rounded text-center">
                    <div className="text-xs text-[var(--text-muted)]">Fill Cells</div>
                    <div className="text-lg font-bold font-mono text-[#6495ED]">
                      {gridCells.filter(c => c.type === 'fill').length}
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--bg-tertiary)] rounded text-center">
                    <div className="text-xs text-[var(--text-muted)]">No Change</div>
                    <div className="text-lg font-bold font-mono text-[var(--text-secondary)]">
                      {gridCells.filter(c => c.type === 'none').length}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!showGrid && gridCells.length > 0 && (
              <p className="text-sm text-[var(--text-secondary)]">
                Click &quot;Show Grid&quot; to display {gridCells.length} color-coded cells.
              </p>
            )}

            {gridCells.length === 0 && hasComputedRef.current && (
              <p className="text-sm text-[var(--text-muted)]">
                No grid cells were computed. Ensure both surveys have overlapping extents.
              </p>
            )}
          </div>
        </>
      )}

      {/* Not yet computed */}
      {cutVolume === null && computeErrors.length === 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-12 text-center">
          <div className="text-4xl mb-3 opacity-40">[Chart]</div>
          <p className="text-[var(--text-secondary)]">
            Configure settings and click &quot;Compute Volume&quot; to see results.
          </p>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Load data for both Survey A and Survey B first.
          </p>
        </div>
      )}
    </div>
  );
}
