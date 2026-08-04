'use client'

// Sub-sheet inspector — renders the sub-sheet corner residuals banner and
// the visual 5×5 sub-sheet grid picker.
//
// Extracted from src/app/tools/cassini-utm/page.tsx.

import { Grid3X3 } from 'lucide-react'
import { verifyWithCommonPoints, getSubSheetGrid } from '@/lib/geo/cassini'
import type { SubSheetDef } from '@/lib/geo/cassini'

interface SubSheetCornerBannerProps {
  activeSubSheet: SubSheetDef
}

/** Top-of-page banner showing the corner residuals for the active sub-sheet. */
export function SubSheetCornerBanner({ activeSubSheet }: SubSheetCornerBannerProps) {
  return (
    <div className="mb-6 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-2">
        <Grid3X3 className="h-3.5 w-3.5" />
        Sub-sheet {activeSubSheet.fullId} — {activeSubSheet.corners.length} Corner Points
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-[var(--border-color)]">
              <th className="py-1 px-1.5 text-left text-[var(--text-muted)]">Corner</th>
              <th className="py-1 px-1.5 text-right text-[var(--text-muted)]">Cass X (ft)</th>
              <th className="py-1 px-1.5 text-right text-[var(--text-muted)]">Cass Y (ft)</th>
              <th className="py-1 px-1.5 text-right text-[var(--text-muted)]">UTM E (m)</th>
              <th className="py-1 px-1.5 text-right text-[var(--text-muted)]">UTM N (m)</th>
              <th className="py-1 px-1.5 text-right text-[var(--text-muted)]">Helmert dE</th>
              <th className="py-1 px-1.5 text-right text-[var(--text-muted)]">Helmert dN</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const vr = verifyWithCommonPoints(activeSubSheet.helmertParams)
              return activeSubSheet.corners.map((c, i) => {
                const r = vr[i]
                const absE = r ? Math.abs(r.residualE) : 0
                const absN = r ? Math.abs(r.residualN) : 0
                return (
                  <tr key={`${c}-${i}`} className="border-b border-[var(--border-color)]/50">
                    <td className="py-1 px-1.5 font-medium">C{i + 1}</td>
                    <td className="py-1 px-1.5 text-right font-mono">{c.cassX.toFixed(1)}</td>
                    <td className="py-1 px-1.5 text-right font-mono">{c.cassY.toFixed(1)}</td>
                    <td className="py-1 px-1.5 text-right font-mono">{c.utmE.toFixed(1)}</td>
                    <td className="py-1 px-1.5 text-right font-mono">{c.utmN.toFixed(1)}</td>
                    <td className={`py-1 px-1.5 text-right font-mono ${absE < 0.01 ? 'text-emerald-400' : absE < 0.1 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {r ? `${(r.residualE * 1000).toFixed(1)} mm` : '—'}
                    </td>
                    <td className={`py-1 px-1.5 text-right font-mono ${absN < 0.01 ? 'text-emerald-400' : absN < 0.1 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {r ? `${(r.residualN * 1000).toFixed(1)} mm` : '—'}
                    </td>
                  </tr>
                )
              })
            })()}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface SubSheetGridPickerProps {
  selectedSheetId: string
  selectedSubSheetId: string
  setSelectedSubSheetId: (v: string) => void
  setDetectedSubSheet: (v: undefined) => void
  detectedSubSheet?: SubSheetDef
  activeSubSheet?: SubSheetDef
}

/** Visual 5×5 sub-sheet grid picker rendered inside the sheet selector card. */
export function SubSheetGridPicker({
  selectedSheetId,
  selectedSubSheetId,
  setSelectedSubSheetId,
  setDetectedSubSheet,
  detectedSubSheet,
  activeSubSheet,
}: SubSheetGridPickerProps) {
  const grid = getSubSheetGrid(selectedSheetId)
  if (grid.length === 0) return null

  return (
    <div>
      <div className="label text-xs text-[var(--text-muted)] mb-1.5 block">
        Sub-sheet Map
        <span className="ml-1 text-[9px] text-zinc-400">Click to select · North = top</span>
      </div>
      <div className="grid grid-cols-5 gap-[2px]">
        {grid.map((row, ri) =>
          row.map((sub, ci) => {
            const isDetected = detectedSubSheet?.subId === sub?.subId
            const isActive = activeSubSheet?.subId === sub?.subId
            return (
              <button
                key={`${ri}-${ci}`}
                onClick={() => {
                  if (sub) {
                    setSelectedSubSheetId(sub.subId)
                    setDetectedSubSheet(undefined)
                  }
                }}
                className={`relative text-center py-1.5 px-0.5 text-[10px] font-mono rounded transition-all ${
                  !sub
                    ? 'bg-[var(--bg-tertiary)] opacity-30 cursor-default'
                    : isActive
                      ? 'bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 font-bold shadow-sm shadow-emerald-500/10'
                      : 'bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--accent)]/10 hover:border-[var(--accent)]/30 hover:text-[var(--accent)] cursor-pointer'
                }`}
              >
                {sub ? sub.subId : ''}
                {isDetected && selectedSubSheetId === '__auto__' && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            )
          })
        )}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-3 mt-1.5 text-[9px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-emerald-500/30 border border-emerald-500/50" /> Active
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Auto-detected
        </span>
      </div>
    </div>
  )
}
