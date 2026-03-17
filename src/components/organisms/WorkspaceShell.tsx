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

  return (
    <div className="min-h-[calc(100vh-4rem)] grid grid-rows-[1fr_auto] bg-[var(--bg-primary)]">
      <div className="p-3 grid grid-cols-1 lg:grid-cols-[18rem_1fr_22rem] gap-3 min-h-0">
        <aside className="min-h-0 lg:overflow-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]">
          {left}
        </aside>
        <main className="min-h-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden">
          {center}
        </main>
        <aside className="min-h-0 lg:overflow-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]">
          {right}
        </aside>
      </div>

      <div className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <button
          onClick={() => setBottomOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          aria-expanded={bottomOpen}
        >
          <span className="font-semibold">{bottomTitle}</span>
          <span className="text-xs">{bottomOpen ? '▾' : '▸'}</span>
        </button>
        {bottomOpen ? <div className="h-[260px] overflow-auto">{bottom}</div> : null}
      </div>
    </div>
  )
}

