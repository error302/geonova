'use client'

import { useState } from 'react'
import type { IntersectionPoint, RoadDesignData } from '@/types/engineering'

/**
 * Step 2 — Horizontal Alignment (IPs and circular curve radii).
 *
 * Extracted verbatim from src/app/project/[id]/engineering/page.tsx.
 */
export function Step2Horizontal({
  data,
  onSave
}: {
  data: RoadDesignData | null
  onSave: (ips: IntersectionPoint[]) => void
}) {
  const [ips, setIps] = useState<IntersectionPoint[]>(data?.ips || [])

  const addIP = () => {
    const newIp: IntersectionPoint = {
      id: `IP${ips.length + 1}`,
      name: `IP${ips.length + 1}`,
      easting: 0,
      northing: 0,
      radius: 100
    }
    setIps([...ips, newIp])
  }

  const updateIP = (index: number, field: keyof IntersectionPoint, value: IntersectionPoint[keyof IntersectionPoint]) => {
    const updated = [...ips]
    updated[index] = { ...updated[index], [field]: value }
    setIps(updated)
  }

  const removeIP = (index: number) => {
    setIps(ips.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    onSave(ips)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Horizontal Alignment</h3>
        <p className="text-zinc-400 text-sm">Define intersection points (IPs) and circular curve radii.</p>
      </div>

      {ips.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">
          <p>No IPs defined. Add at least 2 IPs for a valid alignment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ips.map((ip, idx) => (
            <div key={ip.id} className="border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-white">IP {idx + 1}</span>
                <button
                  onClick={() => removeIP(idx)}
                  className="text-red-400 text-sm hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label htmlFor={`ip-${idx}-name`} className="block text-xs text-zinc-500 mb-1">Name</label>
                  <input id={`ip-${idx}-name`}
                    type="text"
                    value={ip.name}
                    onChange={e => updateIP(idx, 'name', e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`ip-${idx}-easting`} className="block text-xs text-zinc-500 mb-1">Easting (m)</label>
                  <input id={`ip-${idx}-easting`}
                    type="number"
                    value={ip.easting}
                    onChange={e => updateIP(idx, 'easting', Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`ip-${idx}-northing`} className="block text-xs text-zinc-500 mb-1">Northing (m)</label>
                  <input id={`ip-${idx}-northing`}
                    type="number"
                    value={ip.northing}
                    onChange={e => updateIP(idx, 'northing', Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`ip-${idx}-radius`} className="block text-xs text-zinc-500 mb-1">Radius (m)</label>
                  <input id={`ip-${idx}-radius`}
                    type="number"
                    value={ip.radius}
                    onChange={e => updateIP(idx, 'radius', Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={addIP}
        className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800"
      >
        + Add IP
      </button>

      {ips.length >= 2 && (
        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400"
        >
          Save IPs
        </button>
      )}
    </div>
  )
}
