'use client'

import { useState } from 'react'
import HorizontalCurveCalculator from '@/components/road-design/HorizontalCurveCalculator'
import VerticalCurveCalculator from '@/components/road-design/VerticalCurveCalculator'
import SuperelevationCalculator from '@/components/road-design/SuperelevationCalculator'
import SightDistanceChecker from '@/components/road-design/SightDistanceChecker'

type Tab = 'horizontal' | 'vertical' | 'superelevation' | 'sight'

const TABS: Array<{ id: Tab; label: string; desc: string }> = [
  { id: 'horizontal', label: 'Horizontal Curve', desc: 'T, L, C, M, E, D — TC/CC/CT chainages — set-out table' },
  { id: 'vertical', label: 'Vertical Curve', desc: 'BVC/EVC chainages+RLs, RL at any point, peak/sag point' },
  { id: 'superelevation', label: 'Superelevation', desc: 'Required e, design e (capped 8%), transition length Ls' },
  { id: 'sight', label: 'Sight Distance', desc: 'SSD, PSD, minimum radius compliance (RDM 1.3 Tables 3-3 to 3-6)' },
]

export default function RoadDesignPage() {
  const [tab, setTab] = useState<Tab>('horizontal')

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Road Design</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        RDM 1.3 (Kenya, August 2023) | Kenya Roads Act Cap 403 | All computations shown with full derivation
      </p>

      <div className="flex gap-1 border-b border-[var(--border-color)] mb-6 overflow-x-auto">
        {TABS.map((t: any) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t border-b-2 transition-all ${tab === t.id ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-6">
        {tab === 'horizontal' && (
          <>
            <h2 className="text-lg font-semibold mb-1">Horizontal Curve Elements &amp; Set-Out</h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">Source: RDM 1.3 §5.2 | Ghilani &amp; Wolf Ch.24 | Basak Ch.14-16 | Schofield &amp; Breach Ch.11</p>
            <HorizontalCurveCalculator />
          </>
        )}
        {tab === 'vertical' && (
          <>
            <h2 className="text-lg font-semibold mb-1">Vertical Curve Design</h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">Source: RDM 1.3 §5.4 | Ghilani &amp; Wolf Ch.25</p>
            <VerticalCurveCalculator />
          </>
        )}
        {tab === 'superelevation' && (
          <>
            <h2 className="text-lg font-semibold mb-1">Superelevation Design</h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">Source: RDM 1.3 §5.3 | RDM 1.3 Table 3-4 (friction factors)</p>
            <SuperelevationCalculator />
          </>
        )}
        {tab === 'sight' && (
          <>
            <h2 className="text-lg font-semibold mb-1">Sight Distance &amp; Radius Compliance</h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">Source: RDM 1.3 §3.3 | Tables 3-3 to 3-6</p>
            <SightDistanceChecker />
          </>
        )}
      </div>
    </div>
  )
}
