'use client';

/**
 * StatutoryGatePanel
 * ==================
 *
 * A self-contained panel that fetches the statutory validation result
 * for a project and displays it inline on the submission page.
 *
 * The surveyor sees this BEFORE the Generate buttons, so they know
 * whether their project will pass ArdhiSasa pre-flight before they
 * try to export.
 *
 * States:
 *   - loading: spinner with "Validating..."
 *   - passed:  green card with summary, expandable to see warnings
 *   - blocked: red card with violation list, each violation shows
 *              rule id, source citation, and the actual/allowable
 *              values where applicable
 *   - error:   amber card with the error message and a Retry button
 *
 * The panel auto-fetches on mount and exposes a "Re-run validation"
 * button so the surveyor can refresh after fixing issues in the
 * field book or traverse adjustment.
 */

import { useState, useCallback, useEffect } from 'react';
import { z } from 'zod';
import { apiGet, apiInvalidate, ApiError } from '@/lib/api/client';

// ─── Types (mirror src/lib/validation/statutoryGate.ts) ────────────────

type Severity = 'block' | 'warn' | 'info';

interface Violation {
  rule: string;
  source: string;
  severity: Severity;
  message: string;
  actual?: number;
  allowable?: number;
  unit?: string;
  field?: string;
}

interface GateResult {
  passed: boolean;
  violations: Violation[];
  profile: string;
  evaluatedAt: string;
  ruleVersion: string;
  summary: {
    block: number;
    warn: number;
    info: number;
    total: number;
  };
}

// ─── Response schema ────────────────────────────────────────────────────

const responseSchema = z.object({
  gate: z.object({
    passed: z.boolean(),
    violations: z.array(
      z.object({
        rule: z.string(),
        source: z.string(),
        severity: z.enum(['block', 'warn', 'info']),
        message: z.string(),
        actual: z.number().optional(),
        allowable: z.number().optional(),
        unit: z.string().optional(),
        field: z.string().optional(),
      })
    ),
    profile: z.string(),
    evaluatedAt: z.string(),
    ruleVersion: z.string(),
    summary: z.object({
      block: z.number(),
      warn: z.number(),
      info: z.number(),
      total: z.number(),
    }),
  }),
  formatted: z.string(),
}).passthrough();

// ─── Component ──────────────────────────────────────────────────────────

interface Props {
  projectId: string;
  /**
   * Called whenever the gate result changes (including on initial load
   * and on every Re-run). Parent components can use this to disable
   * export buttons when `result.summary.block > 0`.
   */
  onResult?: (result: GateResult | null) => void;
}

export function StatutoryGatePanel({ projectId, onResult }: Props) {
  const [result, setResult] = useState<GateResult | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Keep the parent informed whenever the result changes.
  // useCallback wraps the setter so it's stable across renders.
  const updateResult = useCallback((next: GateResult | null) => {
    setResult(next);
    if (onResult) onResult(next);
  }, [onResult]);

  const runValidation = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      // Bust the apiGet cache so we get a fresh result on re-run
      apiInvalidate(`/api/project/${projectId}/validate`);
      const res = await apiGet(
        `/api/project/${projectId}/validate`,
        responseSchema,
        { ttlMs: 0 } // never cache — surveyor wants fresh result on each click
      );
      updateResult(res.gate);
      setStatus('ready');
      // Auto-expand if there are block violations
      if (res.gate.summary.block > 0) {
        setExpanded(true);
      }
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Unknown error';
      setError(msg);
      setStatus('error');
      // On error, clear the result so the parent doesn't keep stale block state
      updateResult(null);
    }
  }, [projectId, updateResult]);

  useEffect(() => {
    runValidation();
  }, [runValidation]);

  // ─── Loading ──────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="font-medium text-[var(--text-primary)]">Statutory Validation</p>
            <p className="text-sm text-[var(--text-muted)]">Running pre-export compliance checks…</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────

  if (status === 'error') {
    return (
      <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 p-4 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-amber-400">Validation Unavailable</p>
            <p className="text-sm text-amber-300/80 mt-1">{error}</p>
          </div>
          <button
            onClick={runValidation}
            className="px-3 py-1.5 text-sm font-medium rounded bg-amber-700 text-white hover:bg-amber-600 transition shrink-0"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─── Ready (passed or blocked) ────────────────────────────────────────

  if (!result) return null;

  const isPassed = result.passed;
  const hasBlock = result.summary.block > 0;
  const hasWarn = result.summary.warn > 0;

  // Color scheme: red if blocked, green if clean, amber if passed-with-warnings
  const cardClass = hasBlock
    ? 'border-red-700/50 bg-red-950/20'
    : hasWarn
      ? 'border-amber-700/50 bg-amber-950/20'
      : 'border-green-700/50 bg-green-950/20';

  const titleClass = hasBlock
    ? 'text-red-400'
    : hasWarn
      ? 'text-amber-400'
      : 'text-green-400';

  const statusLabel = hasBlock
    ? 'Blocked — export will be refused'
    : isPassed && hasWarn
      ? 'Passed with warnings'
      : 'All checks passed';

  return (
    <div className={`rounded-lg border ${cardClass} p-4 mb-6`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold ${titleClass}`}>Statutory Validation</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              hasBlock ? 'bg-red-900/40 text-red-300' : hasWarn ? 'bg-amber-900/40 text-amber-300' : 'bg-green-900/40 text-green-300'
            }`}>
              {statusLabel}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-[var(--text-muted)]">
            <span>Profile: <span className="text-[var(--text-secondary)] font-mono">{result.profile}</span></span>
            <span>Rules: <span className="text-[var(--text-secondary)] font-mono">v{result.ruleVersion}</span></span>
            <span>Evaluated: <span className="text-[var(--text-secondary)]">{new Date(result.evaluatedAt).toLocaleString()}</span></span>
          </div>
        </div>
        <button
          onClick={runValidation}
          className="px-3 py-1.5 text-sm font-medium rounded border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition shrink-0"
        >
          Re-run
        </button>
      </div>

      {/* Summary counts */}
      <div className="flex gap-3 mt-3 text-sm">
        <CountBadge label="Block" count={result.summary.block} variant="block" />
        <CountBadge label="Warn" count={result.summary.warn} variant="warn" />
        <CountBadge label="Info" count={result.summary.info} variant="info" />
      </div>

      {/* Violations list (collapsible) */}
      {result.violations.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition flex items-center gap-1"
          >
            <span>{expanded ? '▼' : '▶'}</span>
            <span>{expanded ? 'Hide' : 'Show'} {result.violations.length} violation{result.violations.length === 1 ? '' : 's'}</span>
          </button>

          {expanded && (
            <ul className="mt-2 space-y-2">
              {result.violations.map((v, i) => (
                <ViolationRow key={`${v.rule}-${i}`} violation={v} />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Helpful hint when blocked */}
      {hasBlock && (
        <p className="mt-4 text-xs text-[var(--text-muted)] italic">
          Fix the blocking violations above, then re-run validation.
          Export buttons are disabled until the gate passes.
        </p>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function CountBadge({
  label,
  count,
  variant,
}: {
  label: string;
  count: number;
  variant: 'block' | 'warn' | 'info';
}) {
  const colorClass =
    variant === 'block'
      ? count > 0
        ? 'bg-red-900/40 text-red-300 border-red-700/50'
        : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-color)]'
      : variant === 'warn'
        ? count > 0
          ? 'bg-amber-900/40 text-amber-300 border-amber-700/50'
          : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-color)]'
        : count > 0
          ? 'bg-blue-900/40 text-blue-300 border-blue-700/50'
          : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-color)]';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium ${colorClass}`}>
      <span className="font-mono">{count}</span>
      <span>{label}</span>
    </span>
  );
}

function ViolationRow({ violation }: { violation: Violation }) {
  const severityLabel =
    violation.severity === 'block' ? 'BLOCK' : violation.severity === 'warn' ? 'WARN' : 'INFO';

  const severityClass =
    violation.severity === 'block'
      ? 'text-red-400 border-red-700/50'
      : violation.severity === 'warn'
        ? 'text-amber-400 border-amber-700/50'
        : 'text-blue-400 border-blue-700/50';

  // Human-readable source name
  const sourceLabel: Record<string, string> = {
    cap299: 'Survey Act Cap 299',
    survey_regs_1994: 'Survey Regulations 1994',
    rdm_1_1: 'RDM 1.1',
    ardhisasa: 'ArdhiSasa Spec',
    lra_2012: 'Land Registration Act 2012',
    sok_standard: 'Survey of Kenya Standard',
  };
  const source = sourceLabel[violation.source] ?? violation.source;

  return (
    <li className={`rounded border ${severityClass} bg-[var(--bg-primary)]/50 p-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold ${severityClass.split(' ')[0]}`}>{severityLabel}</span>
            <code className="text-xs text-[var(--text-secondary)] font-mono">{violation.rule}</code>
            <span className="text-xs text-[var(--text-muted)]">·</span>
            <span className="text-xs text-[var(--text-muted)]">{source}</span>
          </div>
          <p className="text-sm text-[var(--text-primary)] mt-1.5">{violation.message}</p>

          {/* Actual vs allowable */}
          {violation.actual !== undefined && violation.allowable !== undefined && (
            <div className="mt-2 flex gap-4 text-xs font-mono text-[var(--text-muted)]">
              <span>
                Actual: <span className="text-[var(--text-secondary)]">
                  {violation.actual.toFixed(2)} {violation.unit ?? ''}
                </span>
              </span>
              <span>
                Allowable: <span className="text-[var(--text-secondary)]">
                  {violation.allowable.toFixed(2)} {violation.unit ?? ''}
                </span>
              </span>
            </div>
          )}

          {/* Field reference */}
          {violation.field && (
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              Field: <code className="font-mono">{violation.field}</code>
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
