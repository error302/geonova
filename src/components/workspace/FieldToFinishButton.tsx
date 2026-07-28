// ──────────────────────────────────────────────────────────────────────────
// METARDU — Field-to-Finish Button
// ──────────────────────────────────────────────────────────────────────────
// One-click button that runs the complete pipeline:
//   EDM corrections → traverse adjustment → closure check → area → pre-submit
//
// Shows results inline — the surveyor sees everything in one place.
// ──────────────────────────────────────────────────────────────────────────

'use client';

import { useState } from 'react';
import { Zap, CheckCircle2, XCircle, AlertTriangle, Loader2, Ruler, MapPin, FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface FieldToFinishResult {
  status: 'ready' | 'warning' | 'failed';
  instantFeedback: {
    closingErrorE: number;
    closingErrorN: number;
    linearMisclosure: number;
    perimeter: number;
    precisionRatio: number;
    precisionFormatted: string;
    passes: boolean;
    standard: string;
    grade: string;
    message: string;
  };
  area: {
    squareMetres: number;
    hectares: number;
    acres: number;
  };
  closureCheck: {
    closingErrorE: number;
    closingErrorN: number;
    perimeter: number;
    precisionRatio: string;
    passes: boolean;
  };
  corrections: Array<{
    from: string;
    to: string;
    rawSlopeDistance: number;
    correctedDistance: number;
    horizontalDistance: number;
    gridDistance: number;
    atmosphericPPM: number;
    curvatureRefractionMM: number;
    scaleFactor: number;
  }>;
  adjustedPoints: Array<{
    name: string;
    easting: number;
    northing: number;
  }>;
  deedPlanData: {
    boundaryPoints: Array<{ id: string; easting: number; northing: number }>;
    boundaryLegs: Array<{ from: string; to: string; bearing: string; distance: number }>;
    area: number;
  } | null;
  preSubmit: {
    ready: boolean;
    score: number;
    summary: string;
    blockers: number;
    warnings: number;
    categories: Array<{
      name: string;
      icon: string;
      items: Array<{
        label: string;
        status: 'pass' | 'fail' | 'warning' | 'skip';
        detail?: string;
        blocking: boolean;
      }>;
      passed: number;
      total: number;
    }>;
  };
  errors: string[];
  warnings: string[];
  processingTimeMs: number;
}

interface FieldToFinishButtonProps {
  projectId: string;
  disabled?: boolean;
}

export function FieldToFinishButton({ projectId, disabled }: FieldToFinishButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FieldToFinishResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const runPipeline = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/project/${projectId}/field-to-finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Pipeline failed (${res.status})`);
      }

      const data = await res.json();
      setResult(data);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const gradeColors: Record<string, string> = {
    excellent: 'text-emerald-400',
    good: 'text-green-400',
    acceptable: 'text-yellow-400',
    poor: 'text-orange-400',
    unacceptable: 'text-red-400',
  };

  return (
    <div className="space-y-3">
      {/* Main Button */}
      <button
        onClick={runPipeline}
        disabled={disabled || loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Running pipeline...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Field to Finish — One Click
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-lg border border-[var(--border-color)] overflow-hidden">
          {/* Header */}
          <div className={`p-3 flex items-center justify-between ${
            result.status === 'ready' ? 'bg-emerald-500/10' :
            result.status === 'warning' ? 'bg-yellow-500/10' :
            'bg-red-500/10'
          }`}>
            <div className="flex items-center gap-2">
              {result.status === 'ready' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : result.status === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <span className={`font-semibold text-sm ${
                result.status === 'ready' ? 'text-emerald-400' :
                result.status === 'warning' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {result.status === 'ready' ? 'Ready for Submission' :
                 result.status === 'warning' ? 'Ready with Warnings' :
                 'Issues Found'}
              </span>
            </div>
            <span className="text-xs text-[var(--text-muted)]">{result.processingTimeMs}ms</span>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-[var(--bg-primary)]/40">
            <div className="text-center">
              <div className="text-xs text-[var(--text-muted)]">Precision</div>
              <div className={`font-mono font-bold text-sm ${gradeColors[result.instantFeedback.grade] || 'text-red-400'}`}>
                {result.instantFeedback.precisionFormatted}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-[var(--text-muted)]">Area</div>
              <div className="font-mono font-bold text-sm text-[var(--text-primary)]">
                {result.area.hectares > 0 ? `${result.area.hectares} ha` : '—'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-[var(--text-muted)]">Pre-Submit</div>
              <div className={`font-bold text-sm ${result.preSubmit.ready ? 'text-emerald-400' : 'text-red-400'}`}>
                {result.preSubmit.score}%
              </div>
            </div>
          </div>

          {/* Expandable Details */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]/40 transition-colors border-t border-[var(--border-color)]"
          >
            <span>Details & Pre-Submission Check</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {expanded && (
            <div className="p-3 space-y-3 border-t border-[var(--border-color)]">
              {/* Closure Detail */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Ruler className="w-3 h-3 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground">Misclosure</div>
                    <div className="font-mono">{result.instantFeedback.linearMisclosure.toFixed(4)} m</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground">Perimeter</div>
                    <div className="font-mono">{result.instantFeedback.perimeter.toFixed(1)} m</div>
                  </div>
                </div>
              </div>

              {/* EDM Corrections Summary */}
              {result.corrections.length > 0 && (
                <div className="text-xs">
                  <div className="font-medium text-[var(--text-secondary)] mb-1">EDM Corrections Applied</div>
                  <div className="text-muted-foreground">
                    {result.corrections.length} observation(s) corrected — atmospheric, C&R, grid scale factor
                  </div>
                </div>
              )}

              {/* Pre-Submission Categories */}
              {result.preSubmit.categories.map((cat) => (
                <div key={cat.name} className="text-xs">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span>{cat.icon}</span>
                    <span className="font-medium text-[var(--text-secondary)]">{cat.name}</span>
                    <span className="text-muted-foreground">({cat.passed}/{cat.total})</span>
                  </div>
                  <div className="space-y-0.5 ml-5">
                    {cat.items.map((item) => (
                      <div key={item.label} className="flex items-center gap-1.5">
                        {item.status === 'pass' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : item.status === 'fail' ? (
                          <XCircle className="w-3 h-3 text-red-400" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 text-yellow-400" />
                        )}
                        <span className={item.status === 'pass' ? 'text-emerald-400' : item.status === 'fail' ? 'text-red-400' : 'text-yellow-400'}>
                          {item.label}
                        </span>
                        {item.detail && <span className="text-muted-foreground">— {item.detail}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Deed Plan Data */}
              {result.deedPlanData && (
                <div className="text-xs">
                  <div className="flex items-center gap-1.5 mb-1">
                    <FileText className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium text-[var(--text-secondary)]">Deed Plan Data Ready</span>
                  </div>
                  <div className="text-muted-foreground ml-5">
                    {result.deedPlanData.boundaryLegs.length} boundary legs, area: {(result.deedPlanData.area / 10000).toFixed(4)} ha
                  </div>
                </div>
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="space-y-1">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-400">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              <div className={`text-xs p-2 rounded ${result.preSubmit.ready ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {result.preSubmit.summary}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
