'use client'

import type { DrainageData } from '@/types/engineering'

/**
 * Drainage Step 3 — Hydraulic Summary (read-only tables of manhole invert
 * levels and pipe capacity checks).
 *
 * Extracted verbatim from src/app/project/[id]/engineering/page.tsx.
 */
export function DrainageStep3Outputs({
  data
}: {
  data: DrainageData | null
}) {
  const manholes = data?.manholes || []
  const pipes = data?.pipeRuns || []

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Hydraulic Summary</h3>
        <p className="text-zinc-400 text-sm">Pipe capacities, velocities, sizing verification.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-zinc-700 rounded-lg p-4">
          <h4 className="font-medium text-white mb-3">Invert Levels Schedule</h4>
          {manholes.length === 0 ? (
            <p className="text-zinc-500 text-sm">Add manholes to see schedule.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs">
                  <th className="text-left pb-2">Manhole</th>
                  <th className="text-right pb-2">Cover</th>
                  <th className="text-right pb-2">Invert</th>
                  <th className="text-right pb-2">Depth</th>
                </tr>
              </thead>
              <tbody>
                {manholes.map((m, _i) => (
                  <tr key={m.name} className="border-t border-zinc-800">
                    <td className="py-1.5 text-white">{m.name}</td>
                    <td className="py-1.5 text-right text-zinc-400">{m.coverLevel.toFixed(3)}</td>
                    <td className="py-1.5 text-right text-zinc-400">{m.invertLevelOut.toFixed(3)}</td>
                    <td className="py-1.5 text-right text-zinc-400">{(m.coverLevel - m.invertLevelOut).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border border-zinc-700 rounded-lg p-4">
          <h4 className="font-medium text-white mb-3">Pipe Capacity Check</h4>
          {pipes.length === 0 ? (
            <p className="text-zinc-500 text-sm">Add pipe runs to verify sizing.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs">
                  <th className="text-left pb-2">Run</th>
                  <th className="text-right pb-2">Capacity</th>
                  <th className="text-right pb-2">Velocity</th>
                </tr>
              </thead>
              <tbody>
                {pipes.map((p, i) => (
                  <tr key={`${p}-${i}`} className="border-t border-zinc-800">
                    <td className="py-1.5 text-white">{p.fromMH}-{p.toMH}</td>
                    <td className="py-1.5 text-right text-zinc-400">{(p.fullBoreCapacity * 1000).toFixed(1)} L/s</td>
                    <td className="py-1.5 text-right text-zinc-400">{p.velocity.toFixed(2)} m/s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
