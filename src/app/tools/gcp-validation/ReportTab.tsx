'use client';

// Tab 4: Report
//
// Extracted from src/app/tools/gcp-validation/page.tsx.

import type { AccuracyClass, ValidationSummary } from './types';
import { fmt } from './helpers';

interface ReportTabProps {
  validationSummary: ValidationSummary | null;
  selectedClass: AccuracyClass;
  generateReportText: () => string;
  handleCopyReport: () => void;
  handleExportCSV: () => void;
  handlePrint: () => void;
}

export function ReportTab({
  validationSummary,
  selectedClass,
  generateReportText,
  handleCopyReport,
  handleExportCSV,
  handlePrint,
}: ReportTabProps) {
  return (
    <div className="space-y-6">
      {/* Report Preview */}
      <div className="card">
        <div className="card-header flex justify-between items-center flex-wrap gap-2">
          <span className="label">Validation Report</span>
          <div className="flex gap-2">
            <button onClick={handleCopyReport} className="btn btn-secondary text-sm">
              Copy to Clipboard
            </button>
            <button onClick={handleExportCSV} className="btn btn-secondary text-sm" disabled={!validationSummary}>
              Export CSV
            </button>
            <button onClick={handlePrint} className="btn btn-primary text-sm">
              Print / PDF
            </button>
          </div>
        </div>

        <div className="print-area p-6 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
          <pre className="font-mono text-sm whitespace-pre-wrap overflow-x-auto leading-relaxed text-[var(--text-secondary)]">
            {generateReportText()}
          </pre>
        </div>
      </div>

      {/* Print-only full table */}
      {validationSummary && (
        <div className="card print:block">
          <div className="card-header">
            <span className="label">Detailed Table (Print View)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table print:table-auto print:text-xs">
              <thead>
                <tr>
                  <th>GCP</th>
                  <th>Known E</th>
                  <th>Software E</th>
                  <th>ΔE</th>
                  <th>Known N</th>
                  <th>Software N</th>
                  <th>ΔN</th>
                  <th>ΔZ</th>
                  <th>Horiz Error</th>
                  <th>3D Error</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {validationSummary.points.map((p, _i) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td className="font-mono">{fmt(p.knownE)}</td>
                    <td className="font-mono">{fmt(p.softwareE)}</td>
                    <td className="font-mono">{fmt(p.deltaE)}</td>
                    <td className="font-mono">{fmt(p.knownN)}</td>
                    <td className="font-mono">{fmt(p.softwareN)}</td>
                    <td className="font-mono">{fmt(p.deltaN)}</td>
                    <td className="font-mono">{fmt(p.deltaZ)}</td>
                    <td className="font-mono">{fmt(p.horizontalError)}</td>
                    <td className="font-mono">{fmt(p.error3D)}</td>
                    <td className={p.overallPass ? 'text-green-400' : 'text-red-400'}>
                      {p.overallPass ? 'PASS' : 'FAIL'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Accuracy Class Reference */}
      <div className="card">
        <div className="card-header">
          <span className="label">Kenya ISK Accuracy Classes Reference</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Map Scale</th>
                <th>Horizontal Limit (m)</th>
                <th>Vertical Limit (m)</th>
                <th>Typical Application</th>
              </tr>
            </thead>
            <tbody>
              <tr className={selectedClass.name === 'Class I' ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]' : ''}>
                <td className="font-semibold">Class I</td>
                <td>1:500</td>
                <td className="font-mono">≤ 0.075</td>
                <td className="font-mono">≤ 0.150</td>
                <td className="text-[var(--text-muted)] text-sm">Engineering surveys, as-built, high-precision topographic</td>
              </tr>
              <tr className={selectedClass.name === 'Class II' ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]' : ''}>
                <td className="font-semibold">Class II</td>
                <td>1:1000</td>
                <td className="font-mono">≤ 0.150</td>
                <td className="font-mono">≤ 0.300</td>
                <td className="text-[var(--text-muted)] text-sm">General topographic, cadastral, planning surveys</td>
              </tr>
              <tr className={selectedClass.name === 'Class III' ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]' : ''}>
                <td className="font-semibold">Class III</td>
                <td>1:2500</td>
                <td className="font-mono">≤ 0.375</td>
                <td className="font-mono">≤ 0.750</td>
                <td className="text-[var(--text-muted)] text-sm">Reconnaissance, route surveys, feasibility studies</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
