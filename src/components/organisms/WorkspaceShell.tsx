'use client'

import { useState } from 'react'

export default function WorkspaceShell({
  left,
  center,
  right,
  bottom,
  bottomTitle,
}: {
  left: React.ReactNode
  center: React.ReactNode
  right: React.ReactNode
  bottom: React.ReactNode
  bottomTitle: string
}) {
  const [bottomOpen, setBottomOpen] = useState(true)
  const [leftCollapsed, setLeftCollapsed] = useState(false)

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-[var(--bg-primary)]">
      {/* Main 3-column area */}
      <div className="flex-1 flex min-h-0 p-2 gap-2">

        {/* Left sidebar — collapsible */}
        <aside
          className={`hidden md:flex flex-shrink-0 transition-all duration-200 min-h-0 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] ${
            leftCollapsed ? 'w-10' : 'w-72'
          }`}
        >
          {leftCollapsed ? (
            <button
              onClick={() => setLeftCollapsed(false)}
              className="w-full h-full flex items-start justify-center pt-3 text-[var(--text-muted)] hover:text-[var(--accent)]"
              title="Expand panel"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ) : (
            <div className="relative h-full">
              <button
                onClick={() => setLeftCollapsed(true)}
                className="absolute top-2 right-2 z-10 p-1 text-[var(--text-muted)] hover:text-[var(--accent)] rounded"
                title="Collapse panel"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              {left}
            </div>
          )}
        </aside>

        {/* Center — map / main view */}
        <main className="flex-1 min-w-0 min-h-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden">
          {center}
        </main>

        {/* Right sidebar */}
        <aside className="hidden lg:flex flex-shrink-0 w-80 min-h-0 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]">
          {right}
        </aside>
      </div>

      {/* Bottom panel — collapsible */}
      <div className="flex-shrink-0 mx-2 mb-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden">
        <button
          onClick={() => setBottomOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          aria-expanded={bottomOpen}
        >
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-[var(--accent)]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5M20.625 12h-7.5m-4.875 3.375h9.75" />
            </svg>
            <span className="font-medium text-xs tracking-wide">{bottomTitle}</span>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            className={`w-4 h-4 transition-transform ${bottomOpen ? 'rotate-180' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        {bottomOpen && (
          <div className="h-64 overflow-auto border-t border-[var(--border-color)]">
            {bottom}
          </div>
        )}
      </div>
    </div>
  )
}
