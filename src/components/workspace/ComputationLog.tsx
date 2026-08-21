'use client';

import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useWorkspaceBridge,
  type ComputationLogEntry,
} from '@/hooks/useWorkspaceBridge';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Color tokens mapped from log level to Tailwind utilities */
const LEVEL_STYLES: Record<
  ComputationLogEntry['level'],
  { dot: string; text: string; border: string; badge: string }
> = {
  info: {
    dot: 'bg-sky-400',
    text: 'text-sky-300',
    border: 'border-sky-500/20',
    badge: 'bg-sky-500/10 text-sky-400',
  },
  success: {
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    border: 'border-emerald-500/20',
    badge: 'bg-emerald-500/10 text-emerald-400',
  },
  warning: {
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    border: 'border-amber-500/20',
    badge: 'bg-amber-500/10 text-amber-400',
  },
  error: {
    dot: 'bg-red-400',
    text: 'text-red-300',
    border: 'border-red-500/20',
    badge: 'bg-red-500/10 text-red-400',
  },
};

const PHASE_STYLES: Record<
  ComputationLogEntry['phase'],
  { badge: string }
> = {
  input: { badge: 'bg-violet-500/10 text-violet-400' },
  compute: { badge: 'bg-cyan-500/10 text-cyan-400' },
  adjustment: { badge: 'bg-orange-500/10 text-orange-400' },
  output: { badge: 'bg-emerald-500/10 text-emerald-400' },
};

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/* ------------------------------------------------------------------ */
/*  Single log entry (memoised)                                        */
/* ------------------------------------------------------------------ */

interface LogEntryRowProps {
  entry: ComputationLogEntry;
}

const LogEntryRow = memo(function LogEntryRow({ entry }: LogEntryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const levelStyle = LEVEL_STYLES[entry.level];
  const phaseStyle = PHASE_STYLES[entry.phase];

  return (
    <div
      className={cn(
        'group flex items-start gap-2 px-3 py-1.5 border-l-2 transition-colors',
        levelStyle.border,
        'hover:bg-[var(--bg-tertiary)]',
      )}
    >
      {/* Timestamp */}
      <span className="flex-shrink-0 text-xs font-mono text-[var(--text-muted)] pt-0.5 select-none w-16">
        {formatTime(entry.timestamp)}
      </span>

      {/* Level dot */}
      <span
        className={cn('flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5', levelStyle.dot)}
        title={entry.level}
      />

      {/* Phase badge */}
      <span
        className={cn(
          'flex-shrink-0 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded',
          phaseStyle.badge,
        )}
      >
        {entry.phase}
      </span>

      {/* Message */}
      <span
        className={cn('flex-1 text-xs leading-relaxed min-w-0', levelStyle.text)}
      >
        {entry.message}
      </span>

      {/* Expand toggle for detail */}
      {entry.detail && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors opacity-0 group-hover:opacity-100"
          aria-label={expanded ? 'Hide detail' : 'Show detail'}
        >
          {expanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Computation Log Component                                          */
/* ------------------------------------------------------------------ */

export default function ComputationLog() {
  const { computationLogs, isComputing, clearLogs } = useWorkspaceBridge();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (!collapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [computationLogs.length, collapsed]);

  const handleClear = useCallback(() => {
    clearLogs();
  }, [clearLogs]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((v) => !v);
  }, []);

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden bg-[var(--bg-secondary)] transition-all duration-200',
        collapsed ? 'h-8' : 'h-full',
      )}
    >
      {/* ---- Header bar ---- */}
      <div className="flex items-center justify-between flex-shrink-0 h-8 px-3 border-b border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Computing pulse indicator */}
          {isComputing && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]" />
            </span>
          )}

          <span className="text-xs font-semibold text-[var(--text-primary)] tracking-tight">
            Computation Log
          </span>

          {/* Entry count badge */}
          {computationLogs.length > 0 && (
            <span className="text-xs font-medium tabular-nums bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded">
              {computationLogs.length}
            </span>
          )}

          {/* Level summary icons */}
          {computationLogs.length > 0 && (
            <div className="flex items-center gap-1 ml-1">
              {computationLogs.some((e) => e.level === 'error') && (
                <AlertCircle className="w-3 h-3 text-red-400" />
              )}
              {computationLogs.some(
                (e) => e.level === 'warning' && !computationLogs.some((l) => l.level === 'error'),
              ) && (
                <AlertTriangle className="w-3 h-3 text-amber-400" />
              )}
              {computationLogs.every(
                (e) => e.level === 'info' || e.level === 'success',
              ) && (
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Clear button */}
          {computationLogs.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors min-h-[36px]"
              title="Clear all logs"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}

          {/* Collapse toggle */}
          <button
            onClick={toggleCollapse}
            aria-label={collapsed ? 'Expand log' : 'Collapse log'}
            className="flex-shrink-0 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            {collapsed ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* ---- Log list (hidden when collapsed) ---- */}
      {!collapsed && (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto min-h-0 custom-scrollbar"
        >
          {computationLogs.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full py-6 text-center select-none">
              <Info className="w-5 h-5 text-[var(--text-muted)] mb-2" />
              <p className="text-xs text-[var(--text-muted)]">
                No computation entries yet.
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 opacity-70">
                Run a computation to see results here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[color-mix(in_srgb,var(--border-color)_50%,transparent)]">
              {computationLogs.map((entry) => (
                <LogEntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}

          {/* Computing overlay */}
          {isComputing && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[var(--bg-secondary)] to-transparent flex items-center justify-center pointer-events-none">
              <Loader2 className="w-3.5 h-3.5 text-[var(--accent)] animate-spin" />
              <span className="text-xs text-[var(--accent)] ml-1.5 font-medium">
                Computing…
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
