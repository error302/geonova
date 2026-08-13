'use client';

// Tab 3: Validation Results
//
// Extracted from src/app/tools/gcp-validation/page.tsx.

import type { AccuracyClass, ValidationSummary } from './types';
import { AlertTriangle } from 'lucide-react'
import { fmt } from './helpers';

interface ResultsTabProps {
  validationSummary: ValidationSummary | null;
  selectedClass: AccuracyClass;
  knownGCPs: { length: number } & unknown;
  parsedResiduals: { length: number } & unknown;
  setActiveTab: (id: 'gcp' | 'residuals' | 'results' | 'report') => void;
  handleRunValidation: () => void;
}

export function ResultsTab({
  validationSummary,
  selectedClass,
  knownGCPs,
  parsedResiduals,
  setActiveTab,
  handleRunValidation,
}: ResultsTabProps) {
  return (
    <div className="space-y-6">
      {!validationSummary ? (
        <div className="card">
          <div className="text-center py-16 text-[var(--text-muted)]">
            <p className="text-lg mb-2">No validation results yet</p>
            <p className="text-sm mb-6">
              Import known GCPs and residual data, then run the validation.
            </p>
            <button
              onClick={() => {
                if (knownGCPs.length === 0) setActiveTab('gcp');
                else if (parsedResiduals.length === 0) setActiveTab('residuals');
                else handleRunValidation();
              }}
              className="btn btn-primary"
            >
              {knownGCPs.length === 0
                ? 'Go to Known GCPs Tab'
                : parsedResiduals.length === 0
                  ? 'Go to Import Residuals Tab'
                  : 'Run Validation Now'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Overall Banner */}
          <div className={`p-4 rounded text-center text-lg font-semibold ${
            validationSummary.pass
              ? 'bg-green-900/30 border border-green-600 text-green-400'
              : 'bg-red-900/30 border border-red-600 text-red-400'
          }`}>
            {validationSummary.pass ? ' OVERALL PASS' : '[x] OVERALL FAIL'} — {selectedClass.name} ({selectedClass.scale})
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg">
              <span className="text-[var(--text-secondary)] text-sm block">Horizontal RMSE</span>
              <div className={`font-mono text-xl ${validationSummary.hPass ? 'text-green-400' : 'text-red-400'}`}>
                {fmt(validationSummary.hRMSE)} m
              </div>
              <div className="text-xs text-[var(--text-muted)]">Limit: ≤ {selectedClass.horizontal} m</div>
            </div>
            <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg">
              <span className="text-[var(--text-secondary)] text-sm block">Vertical RMSE</span>
              <div className={`font-mono text-xl ${validationSummary.vPass ? 'text-green-400' : 'text-red-400'}`}>
                {fmt(validationSummary.vRMSE)} m
              </div>
              <div className="text-xs text-[var(--text-muted)]">Limit: ≤ {selectedClass.vertical} m</div>
            </div>
            <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg">
              <span className="text-[var(--text-secondary)] text-sm block">Max Error</span>
              <div className="font-mono text-xl">{fmt(validationSummary.max3D)} m</div>
              <div className="text-xs text-[var(--text-muted)]">
                H: {fmt(validationSummary.maxHorizontal)} | V: {fmt(validationSummary.maxVertical)}
              </div>
            </div>
            <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg">
              <span className="text-[var(--text-secondary)] text-sm block">Pass Rate</span>
              <div className={`font-mono text-xl ${
                validationSummary.passCount === validationSummary.matchedGCPs
                  ? 'text-green-400'
                  : validationSummary.passCount > 0
                    ? 'text-amber-400'
                    : 'text-red-400'
              }`}>
                {validationSummary.matchedGCPs > 0
                  ? ((validationSummary.passCount / validationSummary.matchedGCPs) * 100).toFixed(1)
                  : '0.0'}%
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {validationSummary.passCount}/{validationSummary.matchedGCPs} GCPs
              </div>
            </div>
          </div>

          {/* Unmatched warning */}
          {validationSummary.unmatchedNames.length > 0 && (
            <div className="p-4 bg-amber-900/30 border border-amber-600 rounded text-sm">
              <span className="text-amber-400 font-semibold"><AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> Unmatched GCPs: </span>
              <span className="text-[var(--text-secondary)]">
                {validationSummary.unmatchedNames.join(', ')} — not found in known coordinates table.
                Check that names match exactly (case-sensitive).
              </span>
            </div>
          )}

          {/* Detailed Results Table */}
          <div className="card">
            <div className="card-header">
              <span className="label">Per-GCP Validation Details</span>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th rowSpan={2}>GCP</th>
                    <th colSpan={3} className="text-center">Known Coordinates</th>
                    <th colSpan={3} className="text-center">Software Coordinates</th>
                    <th colSpan={3} className="text-center">Residual (Δ)</th>
                    <th colSpan={2} className="text-center">Error</th>
                    <th rowSpan={2}>Status</th>
                  </tr>
                  <tr>
                    <th>E (m)</th>
                    <th>N (m)</th>
                    <th>Z (m)</th>
                    <th>E (m)</th>
                    <th>N (m)</th>
                    <th>Z (m)</th>
                    <th>ΔE (m)</th>
                    <th>ΔN (m)</th>
                    <th>ΔZ (m)</th>
                    <th>Horiz (m)</th>
                    <th>3D (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {validationSummary.points.map((p, _i) => (
                    <tr
                      key={p.name}
                      className={p.overallPass
                        ? 'border-l-2 border-l-green-600'
                        : 'border-l-2 border-l-red-600'}
                    >
                      <td className="font-semibold">{p.name}</td>
                      <td className="font-mono text-sm">{fmt(p.knownE)}</td>
                      <td className="font-mono text-sm">{fmt(p.knownN)}</td>
                      <td className="font-mono text-sm">{fmt(p.knownZ)}</td>
                      <td className="font-mono text-sm">{fmt(p.softwareE)}</td>
                      <td className="font-mono text-sm">{fmt(p.softwareN)}</td>
                      <td className="font-mono text-sm">{fmt(p.softwareZ)}</td>
                      <td className={`font-mono text-sm ${Math.abs(p.deltaE) > selectedClass.horizontal ? 'text-red-400' : 'text-green-400'}`}>
                        {fmt(p.deltaE)}
                      </td>
                      <td className={`font-mono text-sm ${Math.abs(p.deltaN) > selectedClass.horizontal ? 'text-red-400' : 'text-green-400'}`}>
                        {fmt(p.deltaN)}
                      </td>
                      <td className={`font-mono text-sm ${Math.abs(p.deltaZ) > selectedClass.vertical ? 'text-red-400' : 'text-green-400'}`}>
                        {fmt(p.deltaZ)}
                      </td>
                      <td className={`font-mono text-sm font-semibold ${p.horizontalError > selectedClass.horizontal ? 'text-red-400' : 'text-green-400'}`}>
                        {fmt(p.horizontalError)}
                      </td>
                      <td className="font-mono text-sm">{fmt(p.error3D)}</td>
                      <td>
                        {p.overallPass ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-900/50 text-green-400 border border-green-600">
                             PASS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-900/50 text-red-400 border border-red-600">
                            [x] FAIL
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button onClick={handleRunValidation} className="btn btn-primary">Re-run Validation</button>
            <button onClick={() => setActiveTab('report')} className="btn btn-secondary">View Report →</button>
          </div>
        </>
      )}
    </div>
  );
}
