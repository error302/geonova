'use client';

import type React from 'react';

export function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
        active ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' : 'bg-[color-mix(in_srgb,var(--bg-secondary)_40%,transparent)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-amber-500/30'
      } whitespace-nowrap`}
    >
      {children}
    </button>
  )
}
