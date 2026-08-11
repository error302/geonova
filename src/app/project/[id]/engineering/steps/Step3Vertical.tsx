'use client'

import { useState } from 'react'
import type { RoadDesignData, VerticalIP } from '@/types/engineering'

/**
 * Step 3 — Vertical Alignment (VIPs and parabolic curves).
 *
 * Extracted verbatim from src/app/project/[id]/engineering/page.tsx.
 */
export function Step3Vertical({
  data,
  onSave
}: {
  data: RoadDesignData | null
  onSave: (vips: VerticalIP[]) => void
}) {
  const [vips, setVips] = useState<VerticalIP[]>(data?.vips || [])

  const addVIP = () => {
    const newVip: VerticalIP = {
      id: `VIP${vips.length + 1}`,
      chainage: 0,
      reducedLevel: 0
    }
    setVips([...vips, newVip])
  }

  const updateVIP = (index: number, field: keyof VerticalIP, value: VerticalIP[keyof VerticalIP]) => {
    const updated = [...vips]
    updated[index] = { ...updated[index], [field]: value }
    setVips(updated)
  }

  const removeVIP = (index: number) => {
    setVips(vips.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    onSave(vips)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Vertical Alignment</h3>
        <p className="text-zinc-400 text-sm">Define vertical intersection points (VIPs) for vertical curves.</p>
      </div>

      {vips.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">
          <p>No VIPs defined. Add at least 1 VIP for vertical alignment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {vips.map((vip, idx) => (
            <div key={vip.id} className="border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-white">VIP {idx + 1}</span>
                <button
                  onClick={() => removeVIP(idx)}
                  className="text-red-400 text-sm hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label htmlFor={`vip-${idx}-chainage`} className="block text-xs text-zinc-500 mb-1">Chainage (m)</label>
                  <input id={`vip-${idx}-chainage`}
                    type="number"
                    value={vip.chainage}
                    onChange={e => updateVIP(idx, 'chainage', Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`vip-${idx}-rl`} className="block text-xs text-zinc-500 mb-1">Reduced Level (m)</label>
                  <input id={`vip-${idx}-rl`}
                    type="number"
                    step="0.001"
                    value={vip.reducedLevel}
                    onChange={e => updateVIP(idx, 'reducedLevel', Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`vip-${idx}-k`} className="block text-xs text-zinc-500 mb-1">K Value (optional)</label>
                  <input
                    id={`vip-${idx}-k`}
                    type="number"
                    step="0.1"
                    value={vip.kValue || ''}
                    onChange={e => updateVIP(idx, 'kValue', e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm"
                    placeholder="auto"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={addVIP}
        className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800"
      >
        + Add VIP
      </button>

      {vips.length >= 1 && (
        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400"
        >
          Save VIPs
        </button>
      )}
    </div>
  )
}
