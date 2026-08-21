'use client';

import type React from 'react';
import type { BBox, SurveyId } from './types';
import type { SurfacePoint } from '@/lib/engine/volume';

interface SurveyTabProps {
  survey: SurveyId;
  points: SurfacePoint[];
  text: string;
  setText: (s: string) => void;
  errors: string[];
  bbox: BBox | null;
  fileRef: React.RefObject<HTMLInputElement>;
  inputClass: string;
  overlapBBox: BBox | null;
  overlapPct: number;
  bboxA: BBox | null;
  handleFileUpload: (file: File, survey: SurveyId) => void;
  handleLoadDemoA: () => void;
  handleLoadDemoB: () => void;
  handleLoadFromText: (text: string, survey: SurveyId) => void;
  clearSurvey: (survey: SurveyId) => void;
}

export default function SurveyTab({
  survey,
  points,
  text,
  setText,
  errors,
  bbox,
  fileRef,
  inputClass,
  overlapBBox,
  overlapPct,
  bboxA,
  handleFileUpload,
  handleLoadDemoA,
  handleLoadDemoB,
  handleLoadFromText,
  clearSurvey,
}: SurveyTabProps) {
  const elevations = points.map(p => p.elevation);
  const minElev = elevations.length > 0 ? Math.min(...elevations) : 0;
  const maxElev = elevations.length > 0 ? Math.max(...elevations) : 0;

  return (
    <div className="space-y-6">
      {/* File upload */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Import {survey === 'A' ? 'Survey A' : 'Survey B'} Point Data
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              Upload File (CSV/TXT/XYZ)
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.xyz"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, survey);
              }}
            />
            <button
              onClick={() => survey === 'A' ? handleLoadDemoA() : handleLoadDemoB()}
              className="px-3 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Load Demo {survey}
            </button>
          </div>
        </div>

        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Paste point data below or upload a file. Expected columns: <span className="font-mono text-[var(--text-primary)]">Name, Easting, Northing, Elevation</span> (or just 3 numeric columns: E, N, Z). Auto-detects comma, tab, semicolon, or space delimiters.
        </p>

        <textarea
          className={inputClass}
          rows={10}
          placeholder={`Name,Easting,Northing,Elevation\nP1,484575.00,9863075.00,121.500\nP2,484577.00,9863075.00,121.350\n...`}
          value={text}
          onChange={e => setText(e.target.value)}
        />

        <div className="flex gap-3 mt-3">
          <button
            onClick={() => handleLoadFromText(text, survey)}
            className="px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Parse Data
          </button>
          <button
            onClick={() => clearSurvey(survey)}
            className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg text-sm hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        </div>

        {errors.length > 0 && (
          <div className="mt-3 p-3 bg-red-900/20 border border-red-800/30 rounded-lg">
            <h4 className="text-sm font-medium text-red-400 mb-1">Parse Errors</h4>
            <ul className="text-xs text-red-300/80 space-y-0.5">
              {errors.map((err, i) => <li key={`${err}-${i}`}>{err}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Stats panel */}
      {points.length > 0 && bbox && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Survey {survey} Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <div className="text-xs text-[var(--text-secondary)] mb-1">Point Count</div>
              <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{points.length}</div>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <div className="text-xs text-[var(--text-secondary)] mb-1">Elevation Range</div>
              <div className="text-lg font-bold font-mono text-[var(--text-primary)]">
                {minElev.toFixed(1)} — {maxElev.toFixed(1)} m
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">Δ = {(maxElev - minElev).toFixed(2)} m</div>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <div className="text-xs text-[var(--text-secondary)] mb-1">Easting Range</div>
              <div className="text-sm font-mono text-[var(--text-primary)]">
                {bbox.minE.toFixed(1)} — {bbox.maxE.toFixed(1)}
              </div>
              <div className="text-xs text-[var(--text-muted)]">Width: {(bbox.maxE - bbox.minE).toFixed(1)} m</div>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <div className="text-xs text-[var(--text-secondary)] mb-1">Northing Range</div>
              <div className="text-sm font-mono text-[var(--text-primary)]">
                {bbox.minN.toFixed(1)} — {bbox.maxN.toFixed(1)}
              </div>
              <div className="text-xs text-[var(--text-muted)]">Height: {(bbox.maxN - bbox.minN).toFixed(1)} m</div>
            </div>
          </div>

          {/* Overlap indicator for Survey B */}
          {survey === 'B' && bboxA && overlapBBox && (
            <div className={`mt-4 p-4 rounded-lg border ${overlapPct > 50 ? 'bg-emerald-900/20 border-emerald-800/30' : overlapPct > 10 ? 'bg-amber-900/20 border-amber-800/30' : 'bg-red-900/20 border-red-800/30'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Overlap with Survey A</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    ({overlapBBox.minE.toFixed(1)}, {overlapBBox.minN.toFixed(1)}) to ({overlapBBox.maxE.toFixed(1)}, {overlapBBox.maxN.toFixed(1)})
                  </div>
                </div>
                <div className={`text-2xl font-bold font-mono ${overlapPct > 50 ? 'text-emerald-400' : overlapPct > 10 ? 'text-amber-400' : 'text-red-400'}`}>
                  {overlapPct.toFixed(1)}%
                </div>
              </div>
            </div>
          )}

          {/* Point preview table */}
          <div className="mt-4">
            <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">
              Point Preview (first 10 of {points.length})
            </h4>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                    <th className="text-left py-1.5 px-2">#</th>
                    <th className="text-right py-1.5 px-2">Easting</th>
                    <th className="text-right py-1.5 px-2">Northing</th>
                    <th className="text-right py-1.5 px-2">Elevation</th>
                  </tr>
                </thead>
                <tbody>
                  {points.slice(0, 10).map((p, i) => (
                    <tr key={`${p}-${i}`} className="border-b border-[color-mix(in_srgb,var(--border-color)_30%,transparent)]">
                      <td className="py-1.5 px-2 text-[var(--text-muted)]">{i + 1}</td>
                      <td className="py-1.5 px-2 text-right font-mono">{p.easting.toFixed(2)}</td>
                      <td className="py-1.5 px-2 text-right font-mono">{p.northing.toFixed(2)}</td>
                      <td className="py-1.5 px-2 text-right font-mono">{p.elevation.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {points.length === 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-12 text-center">
          <div className="text-4xl mb-3 opacity-40">[Compass]</div>
          <p className="text-[var(--text-secondary)]">
            No data loaded for Survey {survey}.
          </p>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Upload a CSV/TXT/XYZ file, paste data, or load demo data.
          </p>
        </div>
      )}
    </div>
  );
}
