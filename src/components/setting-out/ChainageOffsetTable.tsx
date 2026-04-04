'use client'

import { type SettingOutRow } from '@/lib/computations/settingOutEngine'

interface Props {
  points: SettingOutRow[]
  halfCarriageway?: number
  shoulderWidth?: number
}

export default function ChainageOffsetTable({ points, halfCarriageway = 3.5, shoulderWidth = 1.5 }: Props) {
  const halfWidth = halfCarriageway + shoulderWidth

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)]">
        <h3 className="text-sm font-semibold">Chainage &amp; Offset Table</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Source: RDM 1.3 Kenya §5.5.3 | Half-formation width = {halfWidth.toFixed(2)}m
        </p>
      </div>
      <div className="overflow-x-auto p-4">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="bg-[var(--bg-tertiary)]">
              {['Chainage', 'CL RL', 'Left Offset', 'Right Offset', 'Left RL', 'Right RL', 'Cut/Fill at CL'].map((h: any) => (
                <th key={h} className="px-3 py-2 text-left border border-[var(--border-color)] text-[var(--text-muted)] font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((row: any) => {
              const cutFill = 0
              const mode = 'LEVEL'
              return (
                <tr key={row.id} className="border border-[var(--border-color)]/50 hover:bg-[var(--bg-tertiary)]/30">
                  <td className="px-3 py-2 text-[var(--text-primary)]">{row.id}</td>
                  <td className="px-3 py-2 text-[var(--text-primary)] text-right">{row.designRL.toFixed(3)}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)] text-right">{halfWidth.toFixed(3)}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)] text-right">{halfWidth.toFixed(3)}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)] text-right">—</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)] text-right">—</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">0.000 LEVEL</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
