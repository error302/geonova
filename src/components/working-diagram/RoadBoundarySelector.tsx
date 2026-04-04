'use client'
import type { BoundaryType } from '@/lib/working-diagram/types'

interface Props {
  value: BoundaryType
  onChange: (value: BoundaryType) => void
  roadLabel?: string
  onRoadLabelChange?: (label: string) => void
}

const BOUNDARY_OPTIONS: { value: BoundaryType; label: string; preview: string }[] = [
  { value: 'standard', label: 'Standard boundary', preview: '————————' },
  { value: 'surveyed_road', label: 'Surveyed road', preview: '══════════' },
  { value: 'unsurveyed_road', label: 'Unsurveyed road', preview: '- - - - - -' },
  { value: 'water', label: 'Water boundary', preview: '≈≈≈≈≈≈≈≈' },
  { value: 'fence', label: 'Fence', preview: '—·—·—·—·' },
]

export function RoadBoundarySelector({ value, onChange, roadLabel, onRoadLabelChange }: Props) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Boundary Type</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as BoundaryType)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
      >
        {BOUNDARY_OPTIONS.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="flex gap-2 mt-2">
        {BOUNDARY_OPTIONS.map((opt: any) => (
          value === opt.value && (
            <span key={opt.value} className="text-xs text-gray-500 font-mono">
              {opt.preview}
            </span>
          )
        ))}
      </div>
      {(value === 'surveyed_road' || value === 'unsurveyed_road') && (
        <div className="mt-2">
          <label className="block text-xs text-gray-500">Road Label</label>
          <input
            type="text"
            value={roadLabel || ''}
            onChange={(e) => onRoadLabelChange?.(e.target.value)}
            placeholder={value === 'unsurveyed_road' ? 'Unsurveyed road' : 'ZLde road'}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm mt-1"
          />
        </div>
      )}
    </div>
  )
}
