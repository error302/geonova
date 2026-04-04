'use client'

import { useState } from 'react'
import type { BeaconType, BeaconStatus } from '@/types/deedPlan'
import { BEACON_DEFINITIONS, getBeaconSymbolSVG, BEACON_CATEGORIES } from '@/lib/compute/beaconSymbols'

interface BeaconPickerProps {
  value: BeaconType
  status: BeaconStatus
  onChange: (type: BeaconType, status: BeaconStatus) => void
  disabled?: boolean
}

const STATUSES: { value: BeaconStatus; label: string }[] = [
  { value: 'FOUND', label: 'Found' },
  { value: 'SET', label: 'Set' },
  { value: 'REFERENCED', label: 'Referenced' },
  { value: 'DESTROYED', label: 'Destroyed' },
  { value: 'NOT_FOUND', label: 'Not Found' }
]

const ALL_TYPES = [
  ...BEACON_CATEGORIES.CONTROL,
  ...BEACON_CATEGORIES.BOUNDARY,
  ...BEACON_CATEGORIES.LEVEL,
  ...BEACON_CATEGORIES.ROAD,
  ...BEACON_CATEGORIES.SPECIAL
] as BeaconType[]

export default function BeaconPicker({ value, status, onChange, disabled }: BeaconPickerProps) {
  const [hovered, setHovered] = useState<BeaconType | null>(null)

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Mark Type</label>
        <div className="grid grid-cols-4 gap-2">
          {ALL_TYPES.map(type => {
            const def = BEACON_DEFINITIONS[type]
            const isSelected = value === type
            
            return (
              <button
                key={type}
                type="button"
                disabled={disabled}
                onClick={() => onChange(type, status)}
                onMouseEnter={() => setHovered(type)}
                onMouseLeave={() => setHovered(null)}
                className={`
                  relative flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all
                  ${isSelected 
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5' 
                    : 'border-[var(--border-color)] hover:border-[var(--accent)]/50'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div 
                  className="w-6 h-6"
                  dangerouslySetInnerHTML={{ 
                    __html: getBeaconSymbolSVG(type, 'FOUND', 12) 
                  }} 
                />
                <span className="text-[10px] mt-1 text-[var(--text-muted)]">{def.shortCode}</span>
                
                {hovered === type && (
                  <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black text-white text-xs rounded-lg shadow-lg">
                    <div className="font-semibold">{def.fullName}</div>
                    <div className="text-gray-300 mt-1">{def.description}</div>
                    <div className="text-gray-400 mt-1 text-[10px]">{def.regulation}</div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Status</label>
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(value, s.value)}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${status === s.value
                  ? 'bg-[var(--accent)] text-black'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--border-hover)]'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {value && BEACON_DEFINITIONS[value] && (
        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{BEACON_DEFINITIONS[value].fullName}</span>
            {BEACON_DEFINITIONS[value].isPermanent && (
              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded">Permanent</span>
            )}
            {BEACON_DEFINITIONS[value].isControlMark && (
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded">Control</span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {BEACON_DEFINITIONS[value].regulation}
          </p>
        </div>
      )}
    </div>
  )
}
