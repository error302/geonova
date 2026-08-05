'use client';

import type { SlopeAnalysisResult } from '@/lib/engineering/slopeAnalysis';
import { SLOPE_CLASS_LABELS } from './constants';
import type { ImportedPoint } from './types';
import { fmt } from './helpers';

interface SlopeTabProps {
  points: ImportedPoint[];
  slopeResult: SlopeAnalysisResult | null;
  slopeError: string;
  isSlopeRunning: boolean;
  slopeGridRes: string;
  setSlopeGridRes: (s: string) => void;
  runSlopeAnalysis: () => void;
  exportSlopeCSV: () => void;
}

export default function SlopeTab({
  points,
  slopeResult,
  slopeError,
  isSlopeRunning,
  slopeGridRes,
  setSlopeGridRes,
  runSlopeAnalysis,
  exportSlopeCSV,
}: SlopeTabProps) {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <span className="label">Slope Analysis (KENHA/RDM Standards)</span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Generates an IDW-interpolated grid and computes slope using 4-neighbor finite differences.
          Classification per KENHA Design Manual 2017 and RDM 1.3 §4.
        </p>
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1" htmlFor="grid-resolution-m">Grid Resolution (m)</label>
            <input
               id="grid-resolution-m" className="input w-32 font-mono"
              type="number"
              step="0.5"
              min="0.5"
              aria-label="Grid Resolution (m)" placeholder="auto"
              value={slopeGridRes}
              onChange={e => setSlopeGridRes(e.target.value)}
            />
          </div>
          <button
            onClick={runSlopeAnalysis}
            disabled={isSlopeRunning || points.length < 3}
            className="btn btn-primary"
          >
            {isSlopeRunning ? 'Computing...' : 'Run Slope Analysis'}
          </button>
        </div>
      </div>

      {slopeError && (
        <div className="p-4 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
          {slopeError}
        </div>
      )}

      {slopeResult && (
        <>
          {/* Slope statistics */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <span className="label">Slope Statistics</span>
              <button onClick={exportSlopeCSV} className="btn btn-secondary text-sm">
                Export CSV
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Mean Slope</span>
                <span className="font-mono text-xl">{fmt(slopeResult.statistics.meanSlopePercent, 2)}%</span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Max Slope</span>
                <span className="font-mono text-xl text-red-400">{fmt(slopeResult.statistics.maxSlopePercent, 2)}%</span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Min Slope</span>
                <span className="font-mono text-xl text-green-400">{fmt(slopeResult.statistics.minSlopePercent, 2)}%</span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Grid Resolution</span>
                <span className="font-mono text-xl">{fmt(slopeResult.gridResolution, 2)} m</span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Total Area</span>
                <span className="font-mono text-xl">{slopeResult.statistics.totalArea.toFixed(1)} m²</span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Mean Slope (deg)</span>
                <span className="font-mono text-xl">{fmt(slopeResult.statistics.meanSlopeDegrees, 2)}°</span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Grid Points</span>
                <span className="font-mono text-xl">{slopeResult.slopePoints.length.toLocaleString()}</span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Total Points</span>
                <span className="font-mono text-xl">{points.length.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Slope distribution */}
          <div className="card">
            <div className="card-header">
              <span className="label">Slope Classification Distribution</span>
            </div>
            <div className="space-y-3">
              {(['flat', 'gentle', 'moderate', 'steep', 'very_steep', 'cliff'] as const).map(cls => {
                const info = SLOPE_CLASS_LABELS[cls];
                const count = slopeResult.statistics.slopeDistribution[cls];
                const area = slopeResult.statistics.areaByClass[cls];
                const total = slopeResult.statistics.totalArea || 1;
                const pct = (area / total) * 100;

                return (
                  <div key={cls} className="flex items-center gap-3">
                    <div className="w-24 text-sm font-medium shrink-0">{info.label}</div>
                    <div className="w-16 text-xs text-[var(--text-muted)] shrink-0">{info.range}</div>
                    <div className="flex-1 bg-[var(--bg-tertiary)] rounded-full h-6 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(pct, 0.5)}%`,
                          backgroundColor: info.color,
                        }}
                      />
                    </div>
                    <div className="w-20 text-right text-sm font-mono shrink-0">{pct.toFixed(1)}%</div>
                    <div className="w-24 text-right text-sm font-mono shrink-0">{area.toFixed(0)} m²</div>
                    <div className="w-16 text-right text-sm text-[var(--text-muted)] font-mono shrink-0">{count.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="w-24 text-sm shrink-0" />
              <div className="w-16 text-xs text-[var(--text-muted)] shrink-0" />
              <div className="w-20 text-xs text-[var(--text-muted)] shrink-0 text-right">% Area</div>
              <div className="w-24 text-xs text-[var(--text-muted)] shrink-0 text-right">Area</div>
              <div className="w-16 text-xs text-[var(--text-muted)] shrink-0 text-right">Count</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
