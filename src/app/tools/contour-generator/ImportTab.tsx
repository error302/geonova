'use client';

// Tab 1: Import Points
//
// Extracted from src/app/tools/contour-generator/page.tsx.

import type { RefObject } from 'react';
import type { SpotHeight } from '@/lib/engine/contours';
import type { Bounds, ImportStats, ParseError } from './types';
import { fmt } from './helpers';

interface ImportTabProps {
  rawText: string;
  setRawText: (v: string) => void;
  fileName: string;
  points: SpotHeight[];
  parseErrors: ParseError[];
  importStats: ImportStats | null;
  isParsing: boolean;
  bounds: Bounds | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleDropZone: (e: React.DragEvent) => void;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePasteParse: () => void;
  handleLoadDemo: () => void;
}

export function ImportTab({
  rawText,
  setRawText,
  fileName,
  points,
  parseErrors,
  importStats,
  isParsing,
  bounds,
  fileInputRef,
  handleDropZone,
  handleFileInput,
  handlePasteParse,
  handleLoadDemo,
}: ImportTabProps) {
  const previewRows = points.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* File upload zone */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
        <h2 className="text-sm font-semibold text-white mb-2">Upload Point Cloud File</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Accepts CSV, TXT, and XYZ files. Expected columns: Name, Easting, Northing, Elevation.
          Comment lines starting with <code className="font-mono bg-[var(--bg-tertiary)] px-1 rounded">#</code> are skipped.
        </p>
        <div
          onDrop={handleDropZone}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
          className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-8 text-center hover:border-[var(--accent)] transition-colors cursor-pointer mb-4"
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-[var(--text-secondary)] mb-1">
            Drag &amp; drop a file here, or click to browse
          </p>
          <p className="text-xs text-zinc-400">
            .csv .txt .xyz
          </p>
          <input
            ref={fileInputRef as unknown as React.RefObject<HTMLInputElement>}
            type="file"
            accept=".csv,.txt,.xyz"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
        {fileName && (
          <div className="text-sm text-[var(--text-secondary)]">
            File: <span className="font-mono text-[var(--accent)]">{fileName}</span>
          </div>
        )}
      </div>

      {/* Text paste area */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold text-white">Paste Data Directly</h2>
          <div className="flex gap-2">
            <button
              onClick={handleLoadDemo}
              className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-zinc-300 hover:text-white transition-colors"
            >
              Load Demo Data
            </button>
            <button
              onClick={handlePasteParse}
              disabled={isParsing || !rawText.trim()}
              className="px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-semibold disabled:opacity-40"
            >
              {isParsing ? 'Parsing...' : 'Parse Data'}
            </button>
          </div>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Paste tab-separated, comma-separated, or space-separated data. Auto-detects delimiters and headers.
        </p>
        <textarea
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[var(--accent)] font-mono text-xs"
          rows={10}
          placeholder={`Name,Easting,Northing,Elevation\nCP1,484500.000,9863100.000,1205.500\nCP2,484750.000,9863250.000,1182.250\nCP3,485000.000,9863400.000,1198.800\n...`}
          value={rawText}
          onChange={e => setRawText(e.target.value)}
        />
      </div>

      {/* Import summary */}
      {points.length > 0 && bounds && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Import Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Point Count</span>
              <span className="font-mono text-xl text-[var(--accent)]">{points.length.toLocaleString()}</span>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Delimiter</span>
              <span className="font-mono text-xl">{importStats?.delimiter || '\u2014'}</span>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Header Detected</span>
              <span className="font-mono text-xl">{importStats?.hasHeader ? 'Yes' : 'No'}</span>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Elevation Range</span>
              <span className="font-mono text-xl">{fmt(bounds.minZ, 1)} \u2013 {fmt(bounds.maxZ, 1)} m</span>
            </div>
          </div>

          {/* Bounding box */}
          <div className="mb-4">
            <span className="text-sm text-[var(--text-secondary)]">Bounding Box: </span>
            <span className="font-mono text-sm">
              E [{fmt(bounds.minE, 2)}, {fmt(bounds.maxE, 2)}] &nbsp;
              N [{fmt(bounds.minN, 2)}, {fmt(bounds.maxN, 2)}] &nbsp;
              Z [{fmt(bounds.minZ, 2)}, {fmt(bounds.maxZ, 2)}]
            </span>
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left py-2 px-3 text-[var(--text-secondary)] font-medium">Name</th>
                  <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Easting (m)</th>
                  <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Northing (m)</th>
                  <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Elevation (m)</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((p, _i) => (
                  <tr key={p.name} className="border-b border-zinc-800">
                    <td className="py-2 px-3 font-semibold text-white">{p.name}</td>
                    <td className="py-2 px-3 text-right font-mono text-zinc-300">{fmt(p.easting)}</td>
                    <td className="py-2 px-3 text-right font-mono text-zinc-300">{fmt(p.northing)}</td>
                    <td className="py-2 px-3 text-right font-mono text-zinc-300">{fmt(p.elevation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {points.length > 5 && (
            <p className="text-xs text-zinc-400 mt-2">
              Showing first 5 of {points.length.toLocaleString()} points.
            </p>
          )}
        </div>
      )}

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
          <h2 className="text-sm font-semibold text-red-400 mb-3">
            Parse Errors ({parseErrors.length})
          </h2>
          <div className="overflow-x-auto max-h-48">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left py-2 px-3 text-[var(--text-secondary)] font-medium">Row</th>
                  <th className="text-left py-2 px-3 text-[var(--text-secondary)] font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {parseErrors.map((err, i) => (
                  <tr key={`${err}-${i}`} className="border-b border-zinc-800">
                    <td className="py-2 px-3 font-mono text-zinc-300">{err.row}</td>
                    <td className="py-2 px-3 text-red-400 text-sm">{err.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parseErrors.length >= 50 && (
            <p className="text-xs text-zinc-400 mt-2">Showing first 50 errors only.</p>
          )}
        </div>
      )}
    </div>
  );
}
