'use client'

import { useState } from 'react'
import type { DrainageData, Manhole } from '@/types/engineering'

/**
 * Drainage Step 1 — Manholes.
 *
 * Extracted verbatim from src/app/project/[id]/engineering/page.tsx.
 */
export function DrainageStep1Manholes({
  data,
  onSave
}: {
  data: DrainageData | null
  onSave: (manholes: Manhole[]) => void
}) {
  const [manholes, setManholes] = useState<Manhole[]>(data?.manholes || [])

  const addManhole = () => {
    const newMh: Manhole = {
      id: `MH${manholes.length + 1}`,
      name: `MH${manholes.length + 1}`,
      chainage: manholes.length > 0 ? manholes[manholes.length - 1].chainage + 30 : 0,
      coverLevel: 0,
      invertLevelIn: 0,
      invertLevelOut: 0,
      pipeDiameterOut: 450,
      pipeMaterial: 'Concrete'
    }
    setManholes([...manholes, newMh])
  }

  const updateManhole = (index: number, field: keyof Manhole, value: any) => {
    const updated = [...manholes]
    updated[index] = { ...updated[index], [field]: value }
    setManholes(updated)
  }

  const removeManhole = (index: number) => {
    setManholes(manholes.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    onSave(manholes)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Manholes</h3>
        <p className="text-zinc-400 text-sm">Define manhole locations, cover and invert levels.</p>
      </div>

      {manholes.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">
          <p>No manholes defined. Add at least 2 manholes for a drainage line.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {manholes.map((mh, idx) => (
            <div key={mh.id} className="border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-white">Manhole {idx + 1}</span>
                <button
                  onClick={() => removeManhole(idx)}
                  className="text-red-400 text-sm hover:text-red-300"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label htmlFor={`mh-${idx}-name`} className="block text-xs text-zinc-500 mb-1">Name</label>
                  <input id={`mh-${idx}-name`}
                    type="text"
                    value={mh.name}
                    onChange={e => updateManhole(idx, 'name', e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`mh-${idx}-chainage`} className="block text-xs text-zinc-500 mb-1">Chainage (m)</label>
                  <input id={`mh-${idx}-chainage`}
                    type="number"
                    value={mh.chainage}
                    onChange={e => updateManhole(idx, 'chainage', Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`mh-${idx}-cover`} className="block text-xs text-zinc-500 mb-1">Cover Level (m)</label>
                  <input id={`mh-${idx}-cover`}
                    type="number"
                    step="0.001"
                    value={mh.coverLevel}
                    onChange={e => updateManhole(idx, 'coverLevel', Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`mh-${idx}-invert`} className="block text-xs text-zinc-500 mb-1">Invert Out (m)</label>
                  <input id={`mh-${idx}-invert`}
                    type="number"
                    step="0.001"
                    value={mh.invertLevelOut}
                    onChange={e => updateManhole(idx, 'invertLevelOut', Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`mh-${idx}-pipeDia`} className="block text-xs text-zinc-500 mb-1">Pipe Dia (mm)</label>
                  <input id={`mh-${idx}-pipeDia`}
                    type="number"
                    value={mh.pipeDiameterOut}
                    onChange={e => updateManhole(idx, 'pipeDiameterOut', Number(e.target.value))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`mh-${idx}-material`} className="block text-xs text-zinc-500 mb-1">Material</label>
                  <select
                    id={`mh-${idx}-material`}
                    value={mh.pipeMaterial}
                    onChange={e => updateManhole(idx, 'pipeMaterial', e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm"
                  >
                    <option value="Concrete">Concrete</option>
                    <option value="HDPE">HDPE</option>
                    <option value="uPVC">uPVC</option>
                    <option value="VCP">VCP</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={`mh-${idx}-depth`} className="block text-xs text-zinc-500 mb-1">Depth (m)</label>
                  <input id={`mh-${idx}-depth`}
                    type="number"
                    step="0.01"
                    value={mh.coverLevel - mh.invertLevelOut}
                    disabled
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-zinc-500 text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={addManhole}
        className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800"
      >
        + Add Manhole
      </button>

      {manholes.length >= 2 && (
        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400"
        >
          Save Manholes
        </button>
      )}
    </div>
  )
}
