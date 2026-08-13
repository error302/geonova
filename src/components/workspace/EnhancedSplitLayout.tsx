'use client';

import React, { type ReactNode } from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  Activity,
  Crosshair,
  AlertTriangle,
  CheckCircle2,
  PanelBottomClose,
  PanelBottomOpen,
  SquareSlash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaceBridge } from '@/hooks/useWorkspaceBridge';
import { useUIStore } from '@/stores/uiStore';

// Re-use the type from the existing layout (don't use the component itself)
import type { StatusBarEntry } from './SplitWorkspaceLayout';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface EnhancedSplitLayoutProps {
  /** Workflow stepper + step content */
  leftPanel: ReactNode;
  /** Map */
  rightPanel: ReactNode;
  /** ComputationLog component */
  logPanel: ReactNode;
  /** Optional pre-built status bar entries */
  statusBarEntries?: StatusBarEntry[];
  /** Optional class applied to the outermost wrapper */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Status icon (mirrors the one in SplitWorkspaceLayout)              */
/* ------------------------------------------------------------------ */

function StatusIcon({ status }: { status?: StatusBarEntry['status'] }) {
  switch (status) {
    case 'ok':
      return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
    case 'warning':
      return <AlertTriangle className="w-3 h-3 text-amber-400" />;
    case 'error':
      return <AlertTriangle className="w-3 h-3 text-red-400" />;
    default:
      return <Activity className="w-3 h-3 text-[var(--text-muted)]" />;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function EnhancedSplitLayout({
  leftPanel,
  rightPanel,
  logPanel,
  statusBarEntries = [],
  className,
}: EnhancedSplitLayoutProps) {
  const logCollapsed = !useUIStore(s => s.bottomPanelOpen);
  const toggleBottomPanel = useUIStore(s => s.toggleBottomPanel);
  const {
    misclosureValue,
    precisionValue,
    areaValue,
    selection,
  } = useWorkspaceBridge();

  // Derive status for bridge values
  const misclosureStatus: StatusBarEntry['status'] =
    misclosureValue !== '—' ? 'ok' : 'idle';
  const precisionStatus: StatusBarEntry['status'] =
    precisionValue !== '—' ? 'ok' : 'idle';
  const areaStatus: StatusBarEntry['status'] =
    areaValue !== '—' ? 'ok' : 'idle';

  // Selection display for status bar
  const selectionDisplay =
    selection.type !== 'none'
      ? `${selection.stationName ?? `#${selection.index ?? '—'}`}`
      : 'None';

  return (
    <div
      className={cn(
        'flex flex-col h-[calc(100vh-48px)] overflow-x-clip',
        className,
      )}
    >
      {/* ================================================================ */}
      {/*  Main resizable area: top = horizontal split, bottom = log       */}
      {/* ================================================================ */}
      <div className="flex-1 min-h-0">
        {/* Desktop: resizable panels */}
        <div className="hidden md:block h-full">
          <ResizablePanelGroup orientation="vertical" className="h-full">
            {/* ---- Top section: Left workflow + Right map ---- */}
            <ResizablePanel defaultSize={logCollapsed ? 100 : 75} minSize={40}>
              <div className="h-full overflow-hidden">
                <ResizablePanelGroup orientation="horizontal" className="h-full">
                  {/* Left panel — workflow content (55 %) */}
                  <ResizablePanel defaultSize={55} minSize={30}>
                    <div className="h-full overflow-y-auto scroll-smooth">
                      {leftPanel}
                    </div>
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  {/* Right panel — map (45 %) */}
                  <ResizablePanel defaultSize={45} minSize={25}>
                    <div className="h-full overflow-hidden bg-[var(--bg-tertiary)]">
                      {rightPanel}
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </div>
            </ResizablePanel>

            {/* ---- Horizontal divider ---- */}
            <ResizableHandle withHandle />

            {/* ---- Bottom section: Computation log ---- */}
            <ResizablePanel
              defaultSize={logCollapsed ? 0 : 25}
              minSize={logCollapsed ? 0 : 15}
              maxSize={logCollapsed ? 0 : 50}
              collapsible
              collapsedSize={0}
            >
              <div className="h-full overflow-hidden">{logPanel}</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Mobile: stacked layout */}
        <div className="md:hidden flex flex-col h-full">
          <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth">
            {leftPanel}
          </div>
          <div className="h-[35vh] border-t border-[var(--border-color)] bg-[var(--bg-tertiary)] overflow-hidden">
            {rightPanel}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/*  Compact status bar (28px)                                       */}
      {/* ================================================================ */}
      <div className="flex-shrink-0 h-7 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-x-clip">
        <div className="flex items-center justify-between h-full px-2 sm:px-3 gap-2 sm:gap-3">
          {/* Left section: user-provided entries */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 overflow-x-auto scrollbar-none">
            {statusBarEntries.map((entry) => (
              <div
                key={entry.label}
                className="flex items-center gap-1 text-xs whitespace-nowrap flex-shrink-0"
              >
                <StatusIcon status={entry.status} />
                <span className="text-[var(--text-muted)]">
                  {entry.label}:
                </span>
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    entry.status === 'ok' && 'text-emerald-400',
                    entry.status === 'warning' && 'text-amber-400',
                    entry.status === 'error' && 'text-red-400',
                    (!entry.status || entry.status === 'idle') &&
                      'text-[var(--text-secondary)]',
                  )}
                >
                  {entry.value}
                </span>
              </div>
            ))}
          </div>

          {/* Right section: bridge-derived values + log toggle */}
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {/* Selection */}
            <div className="flex items-center gap-1 text-xs">
              <Crosshair className="w-3 h-3 text-[var(--accent)]" />
              <span className="text-[var(--text-muted)]">Sel:</span>
              <span className="font-medium text-[var(--text-secondary)] tabular-nums">
                {selectionDisplay}
              </span>
            </div>

            {/* Misclosure */}
            <div className="hidden sm:flex items-center gap-1 text-xs">
              <StatusIcon status={misclosureStatus} />
              <span className="text-[var(--text-muted)]">Misc:</span>
              <span
                className={cn(
                  'font-medium tabular-nums',
                  misclosureStatus === 'ok'
                    ? 'text-emerald-400'
                    : 'text-[var(--text-secondary)]',
                )}
              >
                {misclosureValue}
              </span>
            </div>

            {/* Precision */}
            <div className="hidden sm:flex items-center gap-1 text-xs">
              <StatusIcon status={precisionStatus} />
              <span className="text-[var(--text-muted)]">Prec:</span>
              <span
                className={cn(
                  'font-medium tabular-nums',
                  precisionStatus === 'ok'
                    ? 'text-emerald-400'
                    : 'text-[var(--text-secondary)]',
                )}
              >
                {precisionValue}
              </span>
            </div>

            {/* Area */}
            <div className="hidden md:flex items-center gap-1 text-xs">
              <SquareSlash className="w-3 h-3 text-[var(--text-muted)]" />
              <span className="text-[var(--text-muted)]">Area:</span>
              <span
                className={cn(
                  'font-medium tabular-nums',
                  areaStatus === 'ok'
                    ? 'text-emerald-400'
                    : 'text-[var(--text-secondary)]',
                )}
              >
                {areaValue}
              </span>
            </div>

            {/* Separator */}
            <div className="w-px h-3 bg-[var(--border-color)]" />

            {/* Log collapse toggle */}
            <button
              onClick={toggleBottomPanel}
              aria-label={logCollapsed ? 'Show log' : 'Hide log'}
              className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors min-h-[36px]"
            >
              {logCollapsed ? (
                <>
                  <PanelBottomOpen className="w-3 h-3" />
                  <span>Log</span>
                </>
              ) : (
                <>
                  <PanelBottomClose className="w-3 h-3" />
                  <span>Log</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
