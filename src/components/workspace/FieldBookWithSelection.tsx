'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  BookOpen,
  ExternalLink,
  Crosshair,
  Loader2,
  AlertCircle,
  TableProperties,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/api-client/client';
import { SurveyType } from '@/types/project';
import { type FieldBookColumn, type FieldBookRow } from '@/types/fieldbook';
import { getFieldBookTemplate } from '@/lib/workflows/fieldBookTemplates';
import { useWorkspaceBridge } from '@/hooks/useWorkspaceBridge';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FieldBookWithSelectionProps {
  projectId: string;
  surveyType: SurveyType;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Identify which column represents the "station name" for selection */
function stationColumnFor(columns: FieldBookColumn[]): string {
  const fixed = columns.find(
    (c) =>
      c.fixedColumn === 'station' ||
      c.key === 'station' ||
      c.key === 'gcp_no' ||
      c.key === 'point_no',
  );
  return fixed?.key ?? columns[0]?.key ?? '';
}

/** Identify easting/northing column keys (if present) */
function coordColumnsFor(
  columns: FieldBookColumn[],
): { easting: string; northing: string } {
  let easting = '';
  let northing = '';

  for (const c of columns) {
    const k = c.key.toLowerCase();
    if (k === 'easting' || k === 'e') easting = c.key;
    if (k === 'northing' || k === 'n') northing = c.key;
  }

  return { easting, northing };
}

/** Safely format a number for display */
function fmtNum(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—';
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toFixed(3);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FieldBookWithSelection({
  projectId,
  surveyType,
}: FieldBookWithSelectionProps) {
  const { selection, setSelection, clearSelection, addLog } =
    useWorkspaceBridge();

  const template = getFieldBookTemplate(surveyType);
  const columns = template.columns;

  const stationCol = useMemo(() => stationColumnFor(columns), [columns]);
  const { easting: eastingCol, northing: northingCol } = useMemo(
    () => coordColumnsFor(columns),
    [columns],
  );

  const [rows, setRows] = useState<FieldBookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---- Load data from DB ---- */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const db = createClient();
        const { data, error: fetchError } = await db
          .from('project_fieldbook_entries')
          .select('*')
          .eq('project_id', projectId)
          .eq('survey_type', surveyType)
                    .order('row_index', { ascending: true }) as unknown as { data: Array<Record<string, unknown>> | null; error: { message: string } | null };

        if (cancelled) return;

        if (fetchError) {
          setError('Failed to load entries: ' + fetchError.message);
          addLog({
            phase: 'input',
            level: 'warning',
            message: `Failed to load field book entries: ${fetchError.message}`,
          });
          setLoading(false);
          return;
        }

        const rows = (data ?? []) as Array<Record<string, unknown>>;
        if (rows.length > 0) {
          const loaded = rows.map((r) => {
            const raw = (r.raw_data ?? {}) as Record<string, unknown>;
            const row: FieldBookRow = {} as FieldBookRow;
            for (const [k, v] of Object.entries(raw)) {
              row[k] = v as string | number | null;
            }
            // Also merge fixed columns from the top level
            for (const fixed of [
              'station',
              'bs',
              'is',
              'fs',
              'rl',
              'instrument_height',
              'remark',
            ] as const) {
              if (r[fixed] != null && !(fixed in row)) {
                row[fixed] = r[fixed] as string | number | null;
              }
            }
            return row;
          });
          setRows(loaded as FieldBookRow[]);
          addLog({
            phase: 'input',
            level: 'success',
            message: `Loaded ${loaded.length} field book entries`,
          });
        } else {
          setRows([]);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? (err as Error).message : 'Unknown error';
          setError(msg);
          addLog({
            phase: 'input',
            level: 'error',
            message: `Error loading entries: ${msg}`,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [projectId, surveyType, addLog]);

  /* ---- Row click handler ---- */
  const handleRowClick = useCallback(
    (rowIdx: number) => {
      const row = rows[rowIdx];
      if (!row) return;

      const stationName = String(row[stationCol] ?? `Row ${rowIdx + 1}`);
      const easting = eastingCol ? Number(row[eastingCol]) : undefined;
      const northing = northingCol ? Number(row[northingCol]) : undefined;

      if (
        selection.type === 'station' &&
        selection.index === rowIdx
      ) {
        // Toggle off
        clearSelection();
      } else {
        setSelection({
          type: 'station',
          index: rowIdx,
          stationName,
          easting: isNaN(easting as number) ? undefined : (easting as number),
          northing: isNaN(northing as number) ? undefined : (northing as number),
        });
      }
    },
    [rows, stationCol, eastingCol, northingCol, selection, setSelection, clearSelection],
  );

  /* ---- Navigate to full field book ---- */
  const handleGoToFieldBook = useCallback(() => {
    // Use Next.js router soft navigation
    window.location.hash = '#fieldbook';
  }, []);

  /* ---- Columns to display in the compact view ---- */
  // Show only the first 5 most relevant columns for the compact viewer
  const displayColumns = useMemo(() => {
    return columns.slice(0, 6);
  }, [columns]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)]">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-card)] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <TableProperties className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
          <h3 className="text-xs font-semibold text-[var(--text-primary)] truncate">
            {template.title}
          </h3>
          {!loading && !error && (
            <span className="text-xs font-medium tabular-nums bg-[var(--bg-tertiary)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded flex-shrink-0">
              {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleGoToFieldBook}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors font-medium"
          >
            <BookOpen className="w-3 h-3" />
            <span>Go to Field Book</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </button>
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className="flex-1 overflow-auto min-h-0 custom-scrollbar">
        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
            <span className="text-xs text-[var(--text-muted)] ml-2">
              Loading entries…
            </span>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex items-start gap-2 p-3 m-2 rounded-md bg-red-500/5 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-red-300">Failed to load field book entries</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-center select-none">
            <TableProperties className="w-5 h-5 text-[var(--text-muted)] mb-2" />
            <p className="text-xs text-[var(--text-muted)]">
              No observations recorded yet.
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 opacity-70">
              Open the full Field Book to add entries.
            </p>
          </div>
        )}

        {/* Data table */}
        {!loading && !error && rows.length > 0 && (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--bg-card)]">
                {/* Row number */}
                <th className="w-7 px-1 py-1.5 text-left text-xs font-medium text-[var(--text-muted)] border-b border-[var(--border-color)]">
                  #
                </th>
                {/* Station selection indicator */}
                <th className="w-5 py-1.5 border-b border-[var(--border-color)]" />
                {displayColumns.map((col) => (
                  <th
                    key={col.key}
                    className="px-2 py-1.5 text-left text-xs font-medium text-[var(--text-muted)] border-b border-[var(--border-color)] whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
                {/* Extra column count */}
                {columns.length > 6 && (
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-[var(--text-muted)] border-b border-[var(--border-color)]">
                    +{columns.length - 6}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => {
                const isSelected =
                  selection.type === 'station' &&
                  selection.index === rowIdx;

                return (
                  <tr
                    key={rowIdx}
                    onClick={() => handleRowClick(rowIdx)}
                    className={cn(
                      'cursor-pointer transition-colors border-b border-[var(--border-color)]/40',
                      isSelected
                        ? 'bg-[var(--accent)]/10 border-l-2 border-l-[var(--accent)]'
                        : 'hover:bg-[var(--bg-tertiary)] border-l-2 border-l-transparent',
                    )}
                  >
                    {/* Row number */}
                    <td className="px-1 py-1 text-xs text-[var(--text-muted)] text-right select-none font-mono">
                      {rowIdx + 1}
                    </td>
                    {/* Selection dot */}
                    <td className="py-1 text-center">
                      {isSelected && (
                        <Crosshair className="w-3 h-3 text-[var(--accent)] mx-auto" />
                      )}
                    </td>
                    {/* Data cells */}
                    {displayColumns.map((col) => {
                      const val = row[col.key];
                      const display = fmtNum(val as string | number | null | undefined);
                      const isCoordCol =
                        col.key === eastingCol || col.key === northingCol;

                      return (
                        <td
                          key={col.key}
                          className={cn(
                            'px-2 py-1 whitespace-nowrap max-w-[120px] truncate',
                            isCoordCol && 'font-mono text-xs',
                            isSelected
                              ? 'text-[var(--text-primary)]'
                              : 'text-[var(--text-secondary)]',
                          )}
                          title={display}
                        >
                          {display}
                        </td>
                      );
                    })}
                    {/* Extra indicator */}
                    {columns.length > 6 && (
                      <td className="px-2 py-1 text-xs text-[var(--text-muted)]">
                        …
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ---- Footer ---- */}
      {!loading && !error && rows.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-[var(--border-color)] bg-[var(--bg-card)] flex-shrink-0">
          <span className="text-xs text-[var(--text-muted)]">
            Click a row to select it on the map
          </span>
          {selection.type !== 'none' && (
            <button
              onClick={clearSelection}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
