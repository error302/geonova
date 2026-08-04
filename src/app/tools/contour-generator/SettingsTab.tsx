'use client';

// Tab 2: Settings & Generate
//
// Extracted from src/app/tools/contour-generator/page.tsx.

import type { ContourLine, TINSurface } from '@/lib/engine/contours';
import type { Bounds, VolumeResult } from './types';
import { fmt } from './helpers';

interface SettingsTabProps {
  contourInterval: number;
  setContourInterval: (v: number) => void;
  indexMultiplier: number;
  setIndexMultiplier: (v: number) => void;
  points: { length: number } & unknown;
  bounds: Bounds | null;
  isGenerating: boolean;
  generateError: string;
  handleGenerate: () => void;
  contours: ContourLine[];
  tinSurface: TINSurface | null;
  volumeResult: VolumeResult | null;
  generateProgress?: number;
  usingWorker?: boolean;
  breaklineCount?: number;
}

export function SettingsTab({
  contourInterval,
  setContourInterval,
  indexMultiplier,
  setIndexMultiplier,
  points,
  bounds,
  isGenerating,
  generateError,
  handleGenerate,
  contours,
  tinSurface,
  volumeResult,
  generateProgress = 0,
  usingWorker = false,
  breaklineCount = 0,
}: SettingsTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Contour Generation Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1" htmlFor="contour-interval-m">
              Contour Interval (m)
            </label>
            <input id="contour-interval-m" aria-label="Contour Interval (m)"
              type="number"
              step="0.1"
              min="0.01"
              value={contourInterval}
              onChange={e => setContourInterval(parseFloat(e.target.value) || 1.0)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[var(--accent)]"
            />
            <p className="text-xs text-zinc-500 mt-1">Vertical spacing between contours</p>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1" htmlFor="index-contour-multiplier">
              Index Contour Multiplier
            </label>
            <input id="index-contour-multiplier" aria-label="Index Contour Multiplier"
              type="number"
              step="1"
              min="1"
              value={indexMultiplier}
              onChange={e => setIndexMultiplier(parseInt(e.target.value) || 5)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[var(--accent)]"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Every Nth contour is an index (thick) line (interval &times; {indexMultiplier} = {(contourInterval * indexMultiplier).toFixed(1)} m)
            </p>
          </div>
          <div className="flex flex-col">
            <div className="block text-sm text-[var(--text-secondary)] mb-1">Points Available</div>
            <div className="px-3 py-2 bg-[var(--bg-tertiary)] border border-zinc-700 rounded-lg text-sm text-zinc-300">
              {points.length.toLocaleString()} points
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {bounds ? `Elevation range: ${fmt(bounds.minZ, 1)} \u2013 ${fmt(bounds.maxZ, 1)} m` : '\u2014'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || points.length < 3}
            className="px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-semibold disabled:opacity-40 flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : (
              'Generate Contours'
            )}
          </button>
          {isGenerating && (
            <div className="flex items-center gap-3 text-sm text-zinc-400 flex-1 min-w-[200px]">
              <div className="flex-1 max-w-xs">
                <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] transition-all duration-300"
                    style={{ width: `${Math.round(generateProgress * 100)}%` }}
                  />
                </div>
              </div>
              <span className="font-mono text-xs">
                {Math.round(generateProgress * 100)}%
              </span>
              {usingWorker ? (
                <span className="text-[10px] uppercase tracking-wider text-cyan-400 border border-cyan-700/50 rounded px-1.5 py-0.5">
                  Worker
                </span>
              ) : (
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">
                  Sync
                </span>
              )}
            </div>
          )}
          {!isGenerating && points.length >= 3 && (
            <span className="text-sm text-zinc-400">
              Ready to generate{breaklineCount > 0 ? ` (${breaklineCount} breakline${breaklineCount > 1 ? 's' : ''} active)` : '.'}
            </span>
          )}
          {!isGenerating && points.length < 3 && (
            <span className="text-sm text-zinc-500">Import at least 3 points first.</span>
          )}
        </div>
      </div>

      {generateError && (
        <div className="p-4 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
          {generateError}
        </div>
      )}

      {/* Results summary */}
      {contours.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Generation Results</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Contour Lines</span>
              <span className="font-mono text-xl text-[var(--accent)]">{contours.length}</span>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Index Contours</span>
              <span className="font-mono text-xl">{contours.filter(c => c.isIndex).length}</span>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">TIN Triangles</span>
              <span className="font-mono text-xl">{tinSurface?.triangles.length || 0}</span>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Volume (above min Z)</span>
              <span className="font-mono text-lg">
                {volumeResult ? `${fmt(volumeResult.cut, 1)} m\u00B3` : '\u2014'}
              </span>
            </div>
          </div>

          {/* Contour elevation list */}
          <div className="mt-4">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
              Contour Elevations
            </h3>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const uniqueElevations = [...new Set(contours.map(c => c.elevation))].sort((a, b) => a - b);
                return uniqueElevations.map(elev => {
                  const contour = contours.find(c => c.elevation === elev);
                  const isIndex = contour?.isIndex;
                  return (
                    <span
                      key={elev}
                      className={`px-2 py-1 rounded text-xs font-mono ${
                        isIndex
                          ? 'bg-[var(--accent)] text-black font-bold'
                          : 'bg-[var(--bg-tertiary)] text-zinc-400'
                      }`}
                    >
                      {elev.toFixed(1)}{isIndex ? ' (idx)' : ''}
                    </span>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
