'use client'
import type { SubArea, BeaconPoint } from '@/lib/working-diagram/types'

interface Props {
  subAreas: SubArea[]
  beacons: BeaconPoint[]
  onAdd: () => void
  onUpdate: (id: string, updates: Partial<SubArea>) => void
  onRemove: (id: string) => void
}

const FILL_PATTERNS = [
  { value: 'none', label: 'None' },
  { value: 'hatch', label: 'Hatch' },
  { value: 'cross_hatch', label: 'Cross Hatch' },
  { value: 'dots', label: 'Dots' },
]

const FILL_COLORS = [
  '#f0f4e8', '#e8f4f0', '#f4e8f0', '#e8f0f4', '#f0e8f4',
]

export function SubAreaPanel({ subAreas, beacons, onAdd, onUpdate, onRemove }: Props) {
  const nextId = String.fromCharCode(65 + subAreas.length)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Sub-Areas</h3>
        <button
          onClick={onAdd}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Area {nextId}
        </button>
      </div>

      {subAreas.length === 0 && (
        <p className="text-sm text-gray-500">No sub-areas defined. Click Add to create one.</p>
      )}

      {subAreas.map((area, idx) => (
        <div key={area.id} className="border rounded p-3 space-y-2 bg-white">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Area {area.id}</span>
            <button
              onClick={() => onRemove(area.id)}
              className="text-red-500 text-xs hover:underline"
            >
              Remove
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500">Label</label>
              <input
                type="text"
                value={area.label}
                onChange={(e) => onUpdate(area.id, { label: e.target.value })}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Area (Ha)</label>
              <input
                type="number"
                step="0.0001"
                value={area.areaHa}
                onChange={(e) => onUpdate(area.id, { 
                  areaHa: parseFloat(e.target.value),
                  areaAcres: parseFloat(e.target.value) * 2.47105
                })}
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500">Beacons (ordered)</label>
            <select
              multiple
              value={area.beaconIds}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, opt => opt.value)
                onUpdate(area.id, { beaconIds: selected })
              }}
              className="w-full px-2 py-1 border rounded text-sm h-20"
            >
              {beacons.map(b => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400">Hold Ctrl/Cmd to select multiple</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500">Fill Pattern</label>
              <select
                value={area.fillPattern}
                onChange={(e) => onUpdate(area.id, { fillPattern: e.target.value as SubArea['fillPattern'] })}
                className="w-full px-2 py-1 border rounded text-sm"
              >
                {FILL_PATTERNS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Fill Color</label>
              <input
                type="color"
                value={area.fillColor}
                onChange={(e) => onUpdate(area.id, { fillColor: e.target.value })}
                className="w-full h-7 border rounded"
              />
            </div>
          </div>

          <div className="text-xs text-gray-500">
            {area.areaAcres !== undefined && `(${area.areaAcres.toFixed(3)} Ac)`}
          </div>
        </div>
      ))}
    </div>
  )
}
