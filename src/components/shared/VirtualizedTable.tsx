'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  VariableSizeList as List,
  type ListChildComponentProps,
} from 'react-window';
import { Checkbox } from '@/components/ui/checkbox';
import { Inbox } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ColumnDef<T> {
  key: string;
  header: string;
  width: number;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface VirtualizedTableProps<T> {
  rows: T[];
  columns: ColumnDef<T>[];
  /** Fixed row height in px (default 40) */
  rowHeight?: number;
  /** Height of the entire table viewport in px (default 500) */
  tableHeight?: number;
  onRowClick?: (row: T, index: number) => void;
  /** Set of selected row *indices* */
  selectedRows?: Set<number>;
  onSelectionChange?: (selected: Set<number>) => void;
  /** Show the checkbox column (default false) */
  selectable?: boolean;
  /** Stick header row to the top (default true) */
  headerSticky?: boolean;
  /** Unique key per row — defaults to index */
  rowKey?: (row: T, index: number) => string;
  /** Custom empty-state message */
  emptyMessage?: string;
  className?: string;
  /** Accessible label for the table */
  'aria-label'?: string;
}

/* ------------------------------------------------------------------ */
/*  Fallback (non-virtualized) renderer                                */
/* ------------------------------------------------------------------ */

function FallbackTable<T>({
  rows,
  columns,
  rowHeight = 40,
  onRowClick,
  selectedRows,
  onSelectionChange,
  selectable,
  emptyMessage = 'No data',
  rowKey,
}: VirtualizedTableProps<T>) {
  const allSelected = rows.length > 0 && selectedRows && selectedRows.size === rows.length;
  const someSelected = selectedRows && selectedRows.size > 0 && !allSelected;

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(rows.map((_, i) => i)));
    }
  };

  const toggleRow = (idx: number) => {
    if (!onSelectionChange || !selectedRows) return;
    const next = new Set(selectedRows);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    onSelectionChange(next);
  };

  const totalWidth = columns.reduce((s, c) => s + c.width, 0) + (selectable ? 48 : 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]" style={{ maxHeight: 600 }}>
      <table className="w-full text-sm" style={{ minWidth: totalWidth }}>
        <thead className="sticky top-0 z-10">
          <tr
            className="border-b border-[var(--border-color)] text-left text-xs uppercase tracking-wider text-[var(--text-muted)]"
            style={{ background: 'var(--bg-secondary)' }}
          >
            {selectable && (
              <th className="px-3 py-2 w-12" style={{ width: 48 }}>
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-3 py-2 font-semibold whitespace-nowrap"
                style={{
                  width: col.width,
                  minWidth: col.width,
                  textAlign: col.align ?? 'left',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="py-16 text-center text-[var(--text-muted)]"
              >
                <Inbox className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((row, idx) => {
            const isSelected = selectedRows?.has(idx) ?? false;
            return (
              <tr
                key={rowKey ? rowKey(row, idx) : idx}
                className={`
                  border-b border-[color-mix(in_srgb,var(--border-color)_30%,transparent)] transition-colors
                  ${idx % 2 === 0 ? 'bg-[var(--bg-primary)]' : 'bg-[var(--bg-secondary)]'}
                  ${isSelected ? 'bg-[var(--accent-subtle)]' : ''}
                  ${onRowClick ? 'cursor-pointer hover:bg-[var(--accent-subtle)]' : ''}
                `}
                style={{ height: rowHeight }}
                onClick={() => onRowClick?.(row, idx)}
                onKeyDown={(e) => {
                  if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onRowClick(row, idx)
                  }
                }}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {selectable && (
                  <td className="px-3 py-2 w-12" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleRow(idx)}
                      aria-label={`Select row ${idx + 1}`}
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-3 py-2 whitespace-nowrap"
                    style={{ textAlign: col.align ?? 'left' }}
                  >
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Virtualized Table                                                  */
/* ------------------------------------------------------------------ */

function VirtualizedTableInner<T>(props: VirtualizedTableProps<T>) {
  const {
    rows,
    columns,
    rowHeight = 40,
    tableHeight = 500,
    onRowClick,
    selectedRows = new Set(),
    onSelectionChange,
    selectable = false,
    headerSticky = true,
    rowKey: _rowKey,
    emptyMessage = 'No data to display',
    className,
    'aria-label': ariaLabel,
  } = props;

  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  /* ---- Responsive width ---- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ---- Derived ---- */
  const totalWidth = useMemo(
    () => columns.reduce((s, c) => s + c.width, 0) + (selectable ? 48 : 0),
    [columns, selectable],
  );
  const needsHorizontalScroll = totalWidth > containerWidth && containerWidth > 0;
  const listWidth = needsHorizontalScroll ? totalWidth : containerWidth;

  const allSelected = rows.length > 0 && selectedRows.size === rows.length;
  const someSelected = selectedRows.size > 0 && !allSelected;

  /* ---- Handlers ---- */
  const toggleAll = useCallback(() => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(rows.map((_, i) => i)));
    }
  }, [allSelected, onSelectionChange, rows]);

  const toggleRow = useCallback(
    (idx: number) => {
      if (!onSelectionChange) return;
      const next = new Set(selectedRows);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      onSelectionChange(next);
    },
    [onSelectionChange, selectedRows],
  );

  /* ---- Row height estimator (constant for now, but VariableSizeList ready) ---- */
  const getRowSize = useCallback(() => rowHeight, [rowHeight]);
  const headerHeight = 42;

  /* ---- Row renderer ---- */
  const Row = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      const row = rows[index];
      const isSelected = selectedRows.has(index);
      const bgClass =
        isSelected
          ? 'bg-[var(--accent-subtle)]'
          : index % 2 === 0
            ? 'bg-[var(--bg-primary)]'
            : 'bg-[var(--bg-secondary)]';

      return (
        <div
          style={{
            ...style,
            display: 'flex',
            alignItems: 'center',
            cursor: onRowClick ? 'pointer' : undefined,
          }}
          className={`
            border-b border-[color-mix(in_srgb,var(--border-color)_20%,transparent)] transition-colors
            ${bgClass}
            ${onRowClick ? 'hover:bg-[var(--accent-subtle)]' : ''}
          `}
          onClick={() => onRowClick?.(row, index)}
          onKeyDown={(e) => {
            if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onRowClick(row, index)
            }
          }}
          tabIndex={onRowClick ? 0 : undefined}
          role="row"
        >
          {selectable && (
            <div
              className="flex items-center justify-center shrink-0"
              style={{ width: 48 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleRow(index)}
                aria-label={`Select row ${index + 1}`}
              />
            </div>
          )}
          {columns.map((col) => (
            <div
              key={col.key}
              className="px-3 py-2 text-sm whitespace-nowrap overflow-hidden text-ellipsis"
              style={{
                width: col.width,
                minWidth: col.width,
                textAlign: col.align ?? 'left',
              }}
              role="cell"
            >
              {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
            </div>
          ))}
        </div>
      );
    },
    [rows, columns, selectable, selectedRows, onRowClick, toggleRow],
  );

  /* ---- Scroll-to-row ---- */
  const scrollToRow = useCallback(
    (index: number) => {
      listRef.current?.scrollToItem(index, 'center');
    },
    [],
  );

  // Expose scrollToRow via ref (imperative handle)
  React.useImperativeHandle(
    (props as VirtualizedTableProps<T> & { ref?: React.Ref<{ scrollToRow: (i: number) => void }> }).ref,
    () => ({ scrollToRow }),
    [scrollToRow],
  );

  /* ---- Empty state ---- */
  if (rows.length === 0) {
    return (
      <div
        ref={containerRef}
        className={`rounded-lg border border-[var(--border-color)] flex flex-col items-center justify-center text-[var(--text-muted)] ${className ?? ''}`}
        style={{ height: tableHeight, background: 'var(--bg-primary)' }}
      >
        <Inbox className="h-10 w-10 mb-2 opacity-40" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  /* ---- Render ---- */
  return (
    <div
      ref={containerRef}
      className={`rounded-lg border border-[var(--border-color)] overflow-hidden ${className ?? ''}`}
      style={{ background: 'var(--bg-primary)' }}
      role="table"
      aria-label={ariaLabel}
      aria-rowcount={rows.length + 1}
      aria-colcount={columns.length + (selectable ? 1 : 0)}
    >
      {/* Sticky header */}
      {headerSticky && (
        <div
          className="flex items-center border-b border-[var(--border-color)] text-xs uppercase tracking-wider text-[var(--text-muted)] shrink-0"
          style={{
            height: headerHeight,
            background: 'var(--bg-secondary)',
            minWidth: needsHorizontalScroll ? totalWidth : undefined,
          }}
          role="row"
        >
          {selectable && (
            <div className="flex items-center justify-center shrink-0" style={{ width: 48 }} role="columnheader">
              <Checkbox
                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                aria-label="Select all rows"
              />
            </div>
          )}
          {columns.map((col) => (
            <div
              key={col.key}
              className="px-3 py-2 font-semibold whitespace-nowrap"
              style={{
                width: col.width,
                minWidth: col.width,
                textAlign: col.align ?? 'left',
              }}
              role="columnheader"
              aria-sort={col.sortable ? 'none' : undefined}
            >
              {col.header}
            </div>
          ))}
        </div>
      )}

      {/* Virtualized body — wrap in scroll container for horizontal scroll */}
      <div className={needsHorizontalScroll ? 'overflow-x-auto' : ''}>
        <List
          ref={listRef}
          height={tableHeight - headerHeight}
          itemCount={rows.length}
          itemSize={getRowSize}
          width={listWidth}
          overscanCount={8}
        >
          {Row}
        </List>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Export with dynamic import guard                                    */
/* ------------------------------------------------------------------ */

/**
 * VirtualizedTable wraps react-window's VariableSizeList for efficient
 * rendering of large datasets (500+ rows).
 *
 * If react-window fails to load, it falls back to a standard HTML table.
 */
export function VirtualizedTable<T>(props: VirtualizedTableProps<T>) {
  const [useVirtualized, setUseVirtualized] = useState(true);

  useEffect(() => {
    // Verify react-window is actually available at runtime
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const rw = require('react-window') as { VariableSizeList?: unknown };
      if (!rw.VariableSizeList) setUseVirtualized(false);
    } catch {
      setUseVirtualized(false);
    }
  }, []);

  if (!useVirtualized) {
    return <FallbackTable {...props} />;
  }

  return <VirtualizedTableInner {...props} />;
}

export default VirtualizedTable;
