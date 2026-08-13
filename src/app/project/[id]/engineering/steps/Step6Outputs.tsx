'use client'

import type { RoadDesignData } from '@/types/engineering'
import type { EngineeringProject } from '../shared'

/**
 * Step 6 — Computed Outputs (horizontal curves + earthworks summary).
 *
 * Extracted verbatim from src/app/project/[id]/engineering/page.tsx.
 * Computes deflection/tangent/arc for each IP pair and cut/fill areas
 * for each station against the cross-section template.
 */
export function Step6Outputs({
  project: _project,
  data
}: {
  project: EngineeringProject
  data: RoadDesignData | null
}) {
  const ips = data?.ips || []
  const stations = data?.stations || []
  const template = data?.crossSectionTemplate

  const computeCurves = () => {
    const results: Array<{
      name: string
      from: string
      to: string
      radius: number
      deflection: string
      tangent: string
      arc: string
    }> = []
    for (let i = 0; i < ips.length - 1; i++) {
      const ip1 = ips[i]
      const ip2 = ips[i + 1]
      const dx = ip2.easting - ip1.easting
      const dy = ip2.northing - ip1.northing
      const bearing = Math.atan2(dx, dy) * (180 / Math.PI)
      const radius = ip2.radius || 100
      const deflection = bearing - (i > 0 ? Math.atan2(ips[i].easting - ips[i-1].easting, ips[i].northing - ips[i-1].northing) * (180 / Math.PI) : bearing)
      const tangent = radius * Math.tan(Math.abs(deflection) / 2 * Math.PI / 180)
      const arc = radius * Math.abs(deflection) * Math.PI / 180
      results.push({
        name: ip2.name,
        from: ip1.name,
        to: ip2.name,
        radius,
        deflection: deflection.toFixed(2),
        tangent: tangent.toFixed(2),
        arc: arc.toFixed(2)
      })
    }
    return results
  }

  const computeEarthworks = () => {
    if (!template || stations.length < 2) return []
    const rows: Array<{
      chainage: number
      groundLevel: number
      cutArea: number
      fillArea: number
      cutVol: number
      fillVol: number
    }> = []
    for (let i = 0; i < stations.length; i++) {
      const s = stations[i]
      let cutArea = 0, fillArea = 0
      const halfW = template.carriagewayWidth / 2 + template.shoulderWidth
      const heightDiff = s.designLevel ? s.groundLevel - s.designLevel : 0
      if (heightDiff > 0) {
        cutArea = heightDiff * halfW * 2 + (heightDiff * heightDiff)
      } else {
        fillArea = Math.abs(heightDiff) * halfW * 2 + (heightDiff * heightDiff)
      }
      let cutVol = 0, fillVol = 0
      if (i > 0) {
        const prev = rows[i - 1]
        const d = s.chainage - prev.chainage
        cutVol = ((prev.cutArea || 0) + cutArea) / 2 * d
        fillVol = ((prev.fillArea || 0) + fillArea) / 2 * d
      }
      rows.push({ chainage: s.chainage, groundLevel: s.groundLevel, cutArea, fillArea, cutVol, fillVol })
    }
    return rows
  }

  const curves = computeCurves()
  const earthworks = computeEarthworks()

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Computed Outputs</h3>
        <p className="text-zinc-400 text-sm">Horizontal curves and earthworks summary.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-zinc-700 rounded-lg p-4">
          <h4 className="font-medium text-white mb-3">Horizontal Curves</h4>
          {curves.length === 0 ? (
            <p className="text-zinc-500 text-sm">Add at least 2 IPs to compute curves.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs">
                  <th className="text-left pb-2">IP</th>
                  <th className="text-right pb-2">Radius</th>
                  <th className="text-right pb-2">Defl</th>
                  <th className="text-right pb-2">Tangent</th>
                  <th className="text-right pb-2">Arc</th>
                </tr>
              </thead>
              <tbody>
                {curves.map((c) => (
                  <tr key={c.name} className="border-t border-zinc-800">
                    <td className="py-1.5 text-white">{c.name}</td>
                    <td className="py-1.5 text-right text-zinc-400">{c.radius}m</td>
                    <td className="py-1.5 text-right text-zinc-400">{c.deflection}°</td>
                    <td className="py-1.5 text-right text-zinc-400">{c.tangent}m</td>
                    <td className="py-1.5 text-right text-zinc-400">{c.arc}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border border-zinc-700 rounded-lg p-4">
          <h4 className="font-medium text-white mb-3">Earthworks Summary</h4>
          {earthworks.length === 0 ? (
            <p className="text-zinc-500 text-sm">Add stations and cross section template.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-500 text-xs">
                  <th className="text-left pb-2">Ch</th>
                  <th className="text-right pb-2">G.L.</th>
                  <th className="text-right pb-2">Cut</th>
                  <th className="text-right pb-2">Fill</th>
                </tr>
              </thead>
              <tbody>
                {earthworks.slice(0, 10).map((e, i) => (
                  <tr key={`${e}-${i}`} className="border-t border-zinc-800">
                    <td className="py-1.5 text-white">{e.chainage}m</td>
                    <td className="py-1.5 text-right text-zinc-400">{e.groundLevel.toFixed(2)}</td>
                    <td className="py-1.5 text-right text-green-400">{e.cutArea.toFixed(1)}m²</td>
                    <td className="py-1.5 text-right text-amber-400">{e.fillArea.toFixed(1)}m²</td>
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
