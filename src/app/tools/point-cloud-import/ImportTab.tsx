'use client';

import type React from 'react';
import { AlertTriangle } from 'lucide-react'
import { MAX_POINTS } from './constants';
import type { BoundingBox, ImportStats, ImportedPoint, ParseError } from './types';
import { fmt } from './helpers';

interface ImportTabProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleDropZone: (e: React.DragEvent) => void;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePasteParse: () => void;
  fileName: string;
  rawText: string;
  setRawText: (s: string) => void;
  isParsing: boolean;
  points: ImportedPoint[];
  importStats: ImportStats | null;
  boundingBox: BoundingBox | null;
  previewRows: ImportedPoint[];
  parseErrors: ParseError[];
  warningMsg: string;
}

export default function ImportTab({
  fileInputRef,
  handleDropZone,
  handleFileInput,
  handlePasteParse,
  fileName,
  rawText,
  setRawText,
  isParsing,
  points,
  importStats,
  boundingBox,
  previewRows,
  parseErrors,
  warningMsg,
}: ImportTabProps) {
  return (
    <div className="space-y-6">
      {/* File upload zone */}
      <div className="card">
        <div className="card-header">
          <span className="label">Upload Point Cloud File</span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Accepts CSV, TXT, XYZ, and PLY files from CloudCompare, Agisoft Metashape, or manual exports.
          Maximum {MAX_POINTS.toLocaleString()} points.
        </p>
        <div
          onDrop={handleDropZone}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
          className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-8 text-center hover:border-[var(--accent)] transition-colors cursor-pointer mb-4"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-3xl mb-2">[Folder]</div>
          <p className="text-[var(--text-secondary)]">
            Drag & drop a file here, or click to browse
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            .csv .txt .xyz .ply — max {MAX_POINTS.toLocaleString()} points
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.xyz,.ply"
            aria-label="Upload point cloud file (CSV, TXT, XYZ, PLY)"
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
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <span className="label">Paste Data Directly</span>
          <button
            onClick={handlePasteParse}
            disabled={isParsing || !rawText.trim()}
            className="btn btn-primary text-sm"
          >
            {isParsing ? 'Parsing...' : 'Parse Data'}
          </button>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Paste tab-separated, comma-separated, or space-separated XYZ data. Auto-detects delimiters and headers.
          Comment lines starting with <code className="font-mono bg-[var(--bg-tertiary)] px-1 rounded">#</code> are skipped.
        </p>
        <textarea
          className="input w-full font-mono text-xs"
          rows={10}
          placeholder={`Name,Easting,Northing,Elevation\nCP1,484500.0000,9863100.0000,1205.500\nCP2,484750.0000,9863250.0000,1182.250\n...`}
          value={rawText}
          onChange={e => setRawText(e.target.value)}
        />
      </div>

      {/* Parse results */}
      {points.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="label">Import Summary</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Points Loaded</span>
              <span className="font-mono text-xl text-[var(--accent)]">{points.length.toLocaleString()}</span>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Delimiter</span>
              <span className="font-mono text-xl">{importStats?.delimiter || '—'}</span>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Header Detected</span>
              <span className="font-mono text-xl">{importStats?.hasHeader ? 'Yes' : 'No'}</span>
            </div>
            <div className="p-4 bg-[var(--bg-tertiary)] rounded">
              <span className="text-[var(--text-secondary)] text-sm block">Errors</span>
              <span className={`font-mono text-xl ${parseErrors.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {parseErrors.length}
              </span>
            </div>
          </div>

          {boundingBox && (
            <div className="mb-4">
              <span className="text-sm text-[var(--text-secondary)]">Bounding Box: </span>
              <span className="font-mono text-sm">
                E [{fmt(boundingBox.minE, 2)}, {fmt(boundingBox.maxE, 2)}] m &nbsp;
                N [{fmt(boundingBox.minN, 2)}, {fmt(boundingBox.maxN, 2)}] m &nbsp;
                Z [{fmt(boundingBox.minZ, 2)}, {fmt(boundingBox.maxZ, 2)}] m
              </span>
            </div>
          )}

          {/* Preview table */}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Easting (m)</th>
                  <th>Northing (m)</th>
                  <th>Elevation (m)</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map(p => (
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
          {points.length > 5 && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Showing first 5 of {points.length.toLocaleString()} points. Go to Statistics tab for full view.
            </p>
          )}
        </div>
      )}

      {/* Warnings */}
      {warningMsg && (
        <div className="p-4 bg-yellow-900/30 border border-yellow-600 rounded text-yellow-400 text-sm">
          <AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> {warningMsg}
        </div>
      )}

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="label text-red-400">Parse Errors ({parseErrors.length})</span>
          </div>
          <div className="overflow-x-auto max-h-48">
            <table className="table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {parseErrors.map((err, i) => (
                  <tr key={`${err}-${i}`}>
                    <td className="font-mono">{err.row}</td>
                    <td className="text-red-400 text-sm">{err.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parseErrors.length >= 50 && (
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Showing first 50 errors only.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
