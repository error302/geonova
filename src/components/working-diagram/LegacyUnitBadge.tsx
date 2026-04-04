'use client'
import type { LegacyUnit } from '@/lib/working-diagram/types'
import { metersToLegacy, formatLegacy } from '@/lib/working-diagram/units'

interface Props {
  showLegacy: boolean
  onShowLegacyChange: (show: boolean) => void
  legacyUnit: LegacyUnit | undefined
  onLegacyUnitChange: (unit: LegacyUnit) => void
  distanceMeters: number
  legacyDistance?: number
  onLegacyDistanceChange?: (distance: number) => void
}

const UNIT_OPTIONS: { value: LegacyUnit; label: string }[] = [
  { value: 'perches', label: 'Perches (P)' },
  { value: 'links', label: 'Links (Lk)' },
  { value: 'chains', label: 'Chains (Ch)' },
  { value: 'feet', label: 'Feet (ft)' },
]

export function LegacyUnitBadge({
  showLegacy,
  onShowLegacyChange,
  legacyUnit,
  onLegacyUnitChange,
  distanceMeters,
  legacyDistance,
  onLegacyDistanceChange,
}: Props) {
  const autoCalculated = legacyUnit ? metersToLegacy(distanceMeters, legacyUnit) : 0

  return (
    <div className="space-y-2 border p-2 rounded bg-gray-50">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showLegacy}
          onChange={(e) => onShowLegacyChange(e.target.checked)}
          className="rounded"
        />
        Show legacy units
      </label>

      {showLegacy && (
        <div className="space-y-2">
          <select
            value={legacyUnit || 'perches'}
            onChange={(e) => onLegacyUnitChange(e.target.value as LegacyUnit)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            {UNIT_OPTIONS.map((opt: any) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Legacy:</label>
            <input
              type="number"
              step="0.01"
              value={legacyDistance ?? autoCalculated}
              onChange={(e) => onLegacyDistanceChange?.(parseFloat(e.target.value))}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
            />
            <span className="text-xs text-gray-500">
              {legacyUnit ? formatLegacy(legacyDistance ?? autoCalculated, legacyUnit) : ''}
            </span>
          </div>
          
          <div className="text-xs text-gray-400">
            Auto: {autoCalculated.toFixed(3)} {legacyUnit}
          </div>
        </div>
      )}
    </div>
  )
}
