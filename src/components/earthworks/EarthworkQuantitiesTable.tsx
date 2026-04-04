'use client'

import { type EarthworkResult, type CrossSectionComputed } from '@/lib/computations/earthworksEngine'

interface Props {
  result: EarthworkResult | null
  sections: CrossSectionComputed[]
}

export default function EarthworkQuantitiesTable({ result, sections }: Props) {
  if (!result || result.legs.length === 0) {
    return (
      <div className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg p-6 text-center text-sm text-[var(--text-muted)]">
        Compute sections to see quantities table
      </div>
    )
  }

  const fmtCh = (ch: number) => {
    const km = Math.floor(ch / 1000)
    const m = ch % 1000
    return km > 0 ? `${km}+${m.toFixed(3)}` : `${m.toFixed(3)}`
  }

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)]">
        <h3 className="text-sm font-semibold">Earthwork Quantities</h3>
        <p className="text-xs text-[var(--text-muted)]">
          End Area Method | Prismoidal | Shrinkage = {result.shrinkageFactor}
        </p>
      </div>

      <div className="p-2">
        <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800/30 rounded p-2 mb-3">
          Warning: End Area Method overestimates by up to 3%. Use Prismoidal values for precise quantities.
          <br />
          <span className="text-[var(--text-muted)]">Source: Ghilani &amp; Wolf, Elementary Surveying 16th Ed., Chapter 26</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-[var(--bg-tertiary)]">
                {['From', 'To', 'Dist', 'Cut A1', 'Fill A1', 'Cut A2', 'Fill A2', 'Cut Vol\n(EA)', 'Fill Vol\n(EA)', 'Cut Vol\n(Pris)', 'Fill Vol\n(Pris)', 'Cum Cut', 'Cum Fill'].map((h: any) => (
                  <th key={h} className="px-1.5 py-1.5 text-[var(--text-muted)] font-medium border border-[var(--border-color)] whitespace-pre-line text-[10px] leading-tight">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* First section row */}
              {sections.length > 0 && (
                <tr className="border border-[var(--border-color)]/50">
                  <td className="px-1.5 py-1 text-[var(--text-primary)]">{fmtCh(sections[0].chainage)}</td>
                  <td className="px-1.5 py-1 text-[var(--text-primary)]">—</td>
                  <td className="px-1.5 py-1 text-[var(--text-secondary)] text-right">—</td>
                  <td className="px-1.5 py-1 text-red-400 text-right">{sections[0].cutArea.toFixed(2)}</td>
                  <td className="px-1.5 py-1 text-blue-400 text-right">{sections[0].fillArea.toFixed(2)}</td>
                  <td className="px-1.5 py-1 text-[var(--text-secondary)] text-right">—</td>
                  <td className="px-1.5 py-1 text-[var(--text-secondary)] text-right">—</td>
                  <td className="px-1.5 py-1 text-[var(--text-secondary)] text-right">—</td>
                  <td className="px-1.5 py-1 text-[var(--text-secondary)] text-right">—</td>
                  <td className="px-1.5 py-1 text-[var(--text-secondary)] text-right">—</td>
                  <td className="px-1.5 py-1 text-[var(--text-secondary)] text-right">—</td>
                  <td className="px-1.5 py-1 text-[var(--text-secondary)] text-right">—</td>
                  <td className="px-1.5 py-1 text-[var(--text-secondary)] text-right">—</td>
                </tr>
              )}
              {result.legs.map((leg, i) => (
                <tr key={i} className="border border-[var(--border-color)]/50 hover:bg-[var(--bg-tertiary)]/30">
                  <td className="px-1.5 py-1 text-[var(--text-primary)]">{fmtCh(leg.fromChainage)}</td>
                  <td className="px-1.5 py-1 text-[var(--text-primary)]">{fmtCh(leg.toChainage)}</td>
                  <td className="px-1.5 py-1 text-[var(--text-secondary)] text-right">{leg.distance.toFixed(3)}</td>
                  <td className="px-1.5 py-1 text-red-400 text-right">{leg.cutArea1.toFixed(2)}</td>
                  <td className="px-1.5 py-1 text-blue-400 text-right">{leg.fillArea1.toFixed(2)}</td>
                  <td className="px-1.5 py-1 text-red-400 text-right">{leg.cutArea2.toFixed(2)}</td>
                  <td className="px-1.5 py-1 text-blue-400 text-right">{leg.fillArea2.toFixed(2)}</td>
                  <td className="px-1.5 py-1 text-[var(--text-secondary)] text-right">{leg.cutVolEndArea.toFixed(2)}</td>
                  <td className="px-1.5 py-1 text-[var(--text-secondary)] text-right">{leg.fillVolEndArea.toFixed(2)}</td>
                  <td className="px-1.5 py-1 text-[var(--text-primary)] text-right font-medium">{leg.cutVolPrismoidal.toFixed(2)}</td>
                  <td className="px-1.5 py-1 text-[var(--text-primary)] text-right font-medium">{leg.fillVolPrismoidal.toFixed(2)}</td>
                  <td className="px-1.5 py-1 text-[var(--text-primary)] text-right">{leg.cumCutPrismoidal.toFixed(2)}</td>
                  <td className="px-1.5 py-1 text-[var(--text-primary)] text-right">{leg.cumFillPrismoidal.toFixed(2)}</td>
                </tr>
              ))}
              {/* Totals */}
              <tr className="bg-[var(--bg-tertiary)] font-bold border-2 border-[var(--border-color)]">
                <td className="px-1.5 py-1.5 text-[var(--text-primary)]" colSpan={3}>TOTALS</td>
                <td className="px-1.5 py-1.5 text-red-400 text-right">—</td>
                <td className="px-1.5 py-1.5 text-blue-400 text-right">—</td>
                <td className="px-1.5 py-1.5 text-red-400 text-right">—</td>
                <td className="px-1.5 py-1.5 text-blue-400 text-right">—</td>
                <td className="px-1.5 py-1.5 text-[var(--text-secondary)] text-right">{result.totalCutEndArea.toFixed(2)}</td>
                <td className="px-1.5 py-1.5 text-[var(--text-secondary)] text-right">{result.totalFillEndArea.toFixed(2)}</td>
                <td className="px-1.5 py-1.5 text-[var(--text-primary)] text-right">{result.totalCutPrismoidal.toFixed(2)}</td>
                <td className="px-1.5 py-1.5 text-[var(--text-primary)] text-right">{result.totalFillPrismoidal.toFixed(2)}</td>
                <td className="px-1.5 py-1.5 text-[var(--text-primary)] text-right">—</td>
                <td className="px-1.5 py-1.5 text-[var(--text-primary)] text-right">—</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-[var(--bg-tertiary)] rounded p-2">
            <p className="text-[var(--text-muted)]">Total Cut (Prismoidal)</p>
            <p className="text-[var(--text-primary)] text-sm">{result.totalCutPrismoidal.toFixed(2)} m&sup3;</p>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded p-2">
            <p className="text-[var(--text-muted)]">Total Fill (Prismoidal)</p>
            <p className="text-[var(--text-primary)] text-sm">{result.totalFillPrismoidal.toFixed(2)} m&sup3;</p>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded p-2">
            <p className="text-[var(--text-muted)]">Adjusted Cut (&times;{result.shrinkageFactor})</p>
            <p className="text-[var(--text-primary)] text-sm">{result.adjustedCut.toFixed(2)} m&sup3;</p>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded p-2">
            <p className="text-[var(--text-muted)]">Net (Adj Cut &minus; Fill)</p>
            <p className={`text-sm ${result.adjustedCut - result.totalFillPrismoidal >= 0 ? 'text-yellow-400' : 'text-blue-400'}`}>
              {(result.adjustedCut - result.totalFillPrismoidal).toFixed(2)} m&sup3;
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
