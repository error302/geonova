'use client';

import React, { type ReactNode, useState, useCallback } from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  ChevronDown,
  ChevronUp,
  Activity,

  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface StatusBarEntry {
  label: string;
  value: string;
  status?: 'ok' | 'warning' | 'error' | 'idle';
}

interface SplitWorkspaceLayoutProps {
  /** Content rendered in the left (wider) panel — stepper, step panels, etc. */
  leftPanel: ReactNode;
  /** Content rendered in the right (narrower) panel — map placeholder, etc. */
  rightPanel: ReactNode;
  /** Entries displayed in the bottom status bar */
  statusBarEntries?: StatusBarEntry[];
  /** Collapsed state of the bottom panel (external control) */
  isBottomCollapsed?: boolean;
  /** Toggle callback for bottom panel collapse */
  onBottomToggle?: () => void;
  /** Optional class applied to the outermost wrapper */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function StatusIcon({ status }: { status?: StatusBarEntry['status'] }) {
  switch (status) {
    case 'ok':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case 'warning':
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
    case 'error':
      return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
    default:
      return <Activity className="w-3.5 h-3.5 text-[var(--text-muted)]" />;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SplitWorkspaceLayout({
  leftPanel,
  rightPanel,
  statusBarEntries = [],
  isBottomCollapsed: externalCollapsed,
  onBottomToggle,
  className,
}: SplitWorkspaceLayoutProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = externalCollapsed ?? internalCollapsed;
  const toggle = onBottomToggle ?? (() => setInternalCollapsed((v) => !v));

  const handleToggle = useCallback(toggle, [toggle]);

  return (
    <div
      className={cn(
        'flex flex-col h-[calc(100vh-48px)] overflow-x-clip',
        className,
      )}
    >
      {/* ---- Resizable main area ---- desktop: side-by-side, mobile: stacked */}
      <div className="flex-1 min-h-0">
        {/* Desktop: resizable panels */}
        <div className="hidden md:block h-full">
          <ResizablePanelGroup orientation="horizontal" className="h-full">
            {/* Left panel — workflow content */}
            <ResizablePanel defaultSize={60} minSize={35}>
              <div className="h-full overflow-y-auto scroll-smooth">
                {leftPanel}
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right panel — map */}
            <ResizablePanel defaultSize={40} minSize={25}>
              <div className="h-full overflow-hidden bg-[var(--bg-tertiary)]">
                {rightPanel}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Mobile: stacked layout */}
        <div className="md:hidden flex flex-col h-full">
          <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth">
            {leftPanel}
          </div>
          <div className="h-[40vh] border-t border-[var(--border-color)] bg-[var(--bg-tertiary)] overflow-hidden">
            {rightPanel}
          </div>
        </div>
      </div>

      {/* ---- Bottom status bar ---- */}
      {statusBarEntries.length > 0 && (
        <div
          className={cn(
            'flex-shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] transition-all duration-300 ease-in-out overflow-hidden',
            isCollapsed ? 'h-8' : 'h-10',
          )}
        >
          <div className="flex items-center justify-between h-full px-2 sm:px-4 gap-2 sm:gap-4">
            {/* Status entries */}
            <div className="flex items-center gap-2 sm:gap-5 min-w-0 overflow-x-auto scrollbar-none">
              {statusBarEntries.map((entry) => (
                <div
                  key={entry.label}
                  className="flex items-center gap-1.5 text-xs whitespace-nowrap flex-shrink-0"
                >
                  <StatusIcon status={entry.status} />
                  <span className="text-[var(--text-muted)]">{entry.label}:</span>
                  <span
                    className={cn(
                      'font-medium',
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

            {/* Collapse toggle */}
            <button
              onClick={handleToggle}
              aria-label={isCollapsed ? 'Expand status bar' : 'Collapse status bar'}
              className="flex-shrink-0 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              {isCollapsed ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
