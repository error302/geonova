'use client';

// Tab 2: Import Residuals
//
// Extracted from src/app/tools/gcp-validation/page.tsx.

import type { KnownGCP, ResidualFormat, ResidualRow } from './types';
import { AlertTriangle } from 'lucide-react'
import { fmt } from './helpers';

interface ResidualsTabProps {
  residualText: string;
  setResidualText: (v: string) => void;
  residualFormat: ResidualFormat;
  setResidualFormat: (v: ResidualFormat) => void;
  detectedFormat: ResidualFormat | null;
  setDetectedFormat: (v: ResidualFormat | null) => void;
  setParsedResiduals: (v: ResidualRow[]) => void;
  parseError: string | null;
  parsedResiduals: ResidualRow[];
  knownGCPs: KnownGCP[];
  loadSampleResiduals: () => void;
  clearResiduals: () => void;
  handleResidualFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleParseResiduals: () => void;
  handleRunValidation: () => void;
}

export function ResidualsTab({
  residualText,
  setResidualText,
  residualFormat,
  setResidualFormat,
  detectedFormat,
  setDetectedFormat,
  setParsedResiduals,
  parseError,
  parsedResiduals,
  knownGCPs,
  loadSampleResiduals,
  clearResiduals,
  handleResidualFileUpload,
  handleParseResiduals,
  handleRunValidation,
}: ResidualsTabProps) {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header flex justify-between items-center flex-wrap gap-2">
          <span className="label">Import Residual Table</span>
          <div className="flex gap-2">
            <button onClick={loadSampleResiduals} className="btn btn-secondary text-sm">Load Sample</button>
            <button onClick={clearResiduals} className="btn btn-secondary text-sm">Clear</button>
            <label className="btn btn-secondary text-sm cursor-pointer">
              Upload File
              <input
                type="file"
                accept=".csv,.txt,.tsv"
                className="hidden"
                onChange={handleResidualFileUpload}
              />
            </label>
          </div>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Paste the residual output table from Agisoft Metashape or Pix4D. The tool will auto-detect the format
          and match GCP names against your known coordinates.
        </p>

        {/* Format Selector */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-[var(--text-secondary)]" htmlFor="format">Format:</label>
          <select
             id="format" className="input w-48"
            value={residualFormat}
            onChange={e => setResidualFormat(e.target.value as ResidualFormat)}
          >
            <option value="auto">Auto-detect</option>
            <option value="agisoft">Agisoft Metashape</option>
            <option value="pix4d">Pix4D</option>
          </select>
          {detectedFormat && (
            <span className="text-xs px-2 py-1 rounded bg-[var(--accent)]/20 text-[var(--accent)]">
              Detected: {detectedFormat === 'agisoft' ? 'Agisoft Metashape' : 'Pix4D'}
            </span>
          )}
        </div>

        {/* Textarea */}
        <textarea
          className="input font-mono text-sm w-full"
          rows={10}
          placeholder={`Paste residual table here...\n\nAgisoft format example:\n#point  x(m)  y(m)  z(m)  error(m)\nGCP-01  484500.012  9863100.008  120.485  0.023\n\nPix4D format example:\nGCP_Name,...,X_GCP,Y_GCP,Z_GCP,ErrorX,ErrorY,ErrorZ,ErrorXY,ErrorTotal`}
          value={residualText}
          onChange={e => {
            setResidualText(e.target.value);
            setParsedResiduals([]);
            setDetectedFormat(null);
          }}
        />

        <div className="mt-3 flex gap-3">
          <button onClick={handleParseResiduals} className="btn btn-primary">
            Parse Residuals
          </button>
        </div>

        {parseError && (
          <div className="mt-4 p-4 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
            {parseError}
          </div>
        )}
      </div>

      {/* Format Reference */}
      <div className="card">
        <div className="card-header">
          <span className="label">Format Reference</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[var(--bg-tertiary)] rounded">
            <h4 className="font-semibold text-sm mb-2 text-[var(--accent)]">Agisoft Metashape</h4>
            <pre className="text-xs font-mono text-[var(--text-muted)] whitespace-pre-wrap overflow-x-auto">
{`#point  x(m)    y(m)    z(m)    error(m)
GCP-01  484500.012 9863100.008 120.485 0.023
GCP-02  484750.018 9863249.995 118.235 0.031`}
            </pre>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              Whitespace/tab separated. Coordinates are the software-computed positions.
              The &quot;error&quot; column is the reprojection error in pixels.
              This tool compares software coords against your known GCPs.
            </p>
          </div>
          <div className="p-4 bg-[var(--bg-tertiary)] rounded">
            <h4 className="font-semibold text-sm mb-2 text-[var(--accent)]">Pix4D</h4>
            <pre className="text-xs font-mono text-[var(--text-muted)] whitespace-pre-wrap overflow-x-auto">
{`GCP_Name,X_photo,Y_photo,Z_photo,X_GCP,Y_GCP,Z_GCP,
  ErrorX,ErrorY,ErrorZ,ErrorXY,ErrorTotal
GCP-01,1234.5,567.8,120.485,484500,9863100,120.500,
  0.012,0.008,0.015,0.014,0.023`}
            </pre>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              CSV format. The X_GCP/Y_GCP/Z_GCP columns are the software-computed positions.
              ErrorX/ErrorY/ErrorZ are per-axis residuals. ErrorTotal is the overall error.
              This tool uses the coordinate columns for comparison.
            </p>
          </div>
        </div>
      </div>

      {/* Parsed Preview */}
      {parsedResiduals.length > 0 && (
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <span className="label">Parsed Residuals ({parsedResiduals.length} rows)</span>
            {detectedFormat && (
              <span className="text-xs px-2 py-1 rounded bg-[var(--accent)]/20 text-[var(--accent)]">
                {detectedFormat === 'agisoft' ? 'Agisoft Metashape' : 'Pix4D'} format
              </span>
            )}
          </div>

          {/* Match Status */}
          <div className="mb-4 p-3 bg-[var(--bg-tertiary)] rounded text-sm">
            {(() => {
              const knownNames = new Set(knownGCPs.map(g => g.name.trim()));
              const matched = parsedResiduals.filter(r => knownNames.has(r.name.trim())).length;
              const unmatched = parsedResiduals.filter(r => !knownNames.has(r.name.trim()));
              return (
                <div className="flex flex-wrap gap-4">
                  <div>
                    <span className="text-[var(--text-secondary)]">Matched: </span>
                    <span className={`font-semibold ${matched === parsedResiduals.length ? 'text-green-400' : 'text-amber-400'}`}>
                      {matched}/{parsedResiduals.length}
                    </span>
                  </div>
                  {unmatched.length > 0 && (
                    <div>
                      <span className="text-[var(--text-secondary)]">Unmatched: </span>
                      <span className="text-red-400">{unmatched.map(r => r.name).join(', ')}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="overflow-x-auto max-h-[400px]">
            <table className="table">
              <thead className="sticky top-0">
                <tr>
                  <th>Name</th>
                  <th>Source</th>
                  <th>Software E (m)</th>
                  <th>Software N (m)</th>
                  <th>Software Z (m)</th>
                  {detectedFormat === 'pix4d' && (
                    <>
                      <th>ErrorX</th>
                      <th>ErrorY</th>
                      <th>ErrorZ</th>
                      <th>ErrorTotal</th>
                    </>
                  )}
                  {detectedFormat === 'agisoft' && (
                    <th>Reproj. Error</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {parsedResiduals.map(r => {
                  const knownNames = new Set(knownGCPs.map(g => g.name.trim()));
                  const isMatched = knownNames.has(r.name.trim());
                  return (
                    <tr key={r.id} className={isMatched ? '' : 'opacity-50'}>
                      <td className="font-semibold">
                        {r.name}
                        {!isMatched && <span className="ml-2 text-xs text-red-400"><AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> no match</span>}
                      </td>
                      <td className="text-xs text-[var(--text-muted)]">{r.source === 'pix4d' ? 'Pix4D' : 'Agisoft'}</td>
                      <td className="font-mono">{fmt(r.softwareE)}</td>
                      <td className="font-mono">{fmt(r.softwareN)}</td>
                      <td className="font-mono">{fmt(r.softwareZ)}</td>
                      {detectedFormat === 'pix4d' && (
                        <>
                          <td className="font-mono">{r.errorX !== undefined ? fmt(r.errorX) : '—'}</td>
                          <td className="font-mono">{r.errorY !== undefined ? fmt(r.errorY) : '—'}</td>
                          <td className="font-mono">{r.errorZ !== undefined ? fmt(r.errorZ) : '—'}</td>
                          <td className="font-mono">{r.errorTotal !== undefined ? fmt(r.errorTotal) : '—'}</td>
                        </>
                      )}
                      {detectedFormat === 'agisoft' && (
                        <td className="font-mono">{r.reprojectionError !== undefined ? fmt(r.reprojectionError) : '—'}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <button onClick={handleRunValidation} className="btn btn-primary py-3 px-8 text-base">
              Run Validation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
