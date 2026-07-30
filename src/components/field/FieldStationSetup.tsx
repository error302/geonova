'use client';

/**
 * FieldStationSetup — station setup form for the field data collector
 *
 * Collects:
 *   - Station name (e.g., "BM-1", "TS-A")
 *   - Instrument height (meters)
 *   - Target/prism height (meters)
 *   - Backsight station + bearing (for traverses)
 *   - Temperature & pressure (for atmospheric corrections)
 *   - Known coordinates (if setting up on a control point)
 *
 * After setup, the measure button becomes active.
 */

import { useState } from 'react'
import { MapPin, Ruler, Thermometer, Gauge, Check } from 'lucide-react'
import type { StationSetup } from '@/lib/field/fieldSession'

interface FieldStationSetupProps {
  onComplete: (setup: StationSetup) => void
  onCancel?: () => void
  initialSetup?: StationSetup | null
}

export function FieldStationSetup({ onComplete, onCancel, initialSetup }: FieldStationSetupProps) {
  const [setup, setSetup] = useState<StationSetup>(
    initialSetup || {
      stationName: '',
      instrumentHeight: 1.5,
      targetHeight: 1.5,
      isControlPoint: false,
    }
  )

  const update = (field: keyof StationSetup, value: any) => {
    setSetup(prev => ({ ...prev, [field]: value }))
  }

  const isValid = setup.stationName.length > 0 && setup.instrumentHeight > 0

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-[var(--accent)]" />
        <h3 className="font-semibold text-[var(--text-primary)]">Station Setup</h3>
      </div>

      {/* Station Name */}
      <div>
        <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
          Station Name <span className="text-[var(--error)]">*</span>
        </label>
        <input
          type="text"
          value={setup.stationName}
          onChange={(e) => update('stationName', e.target.value)}
          placeholder="e.g., BM-1, TS-A, CP-42"
          className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm font-mono focus:border-[var(--accent)] outline-none"
        />
      </div>

      {/* Heights */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1">
            <Ruler className="w-3 h-3" /> Instrument Height (m)
          </label>
          <input
            type="number"
            step="0.001"
            value={setup.instrumentHeight}
            onChange={(e) => update('instrumentHeight', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm font-mono focus:border-[var(--accent)] outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1">
            <Ruler className="w-3 h-3" /> Target Height (m)
          </label>
          <input
            type="number"
            step="0.001"
            value={setup.targetHeight}
            onChange={(e) => update('targetHeight', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm font-mono focus:border-[var(--accent)] outline-none"
          />
        </div>
      </div>

      {/* Backsight (for traverses) */}
      <div className="border-t border-[var(--border-color)] pt-3">
        <p className="text-xs text-[var(--text-muted)] mb-2">Backsight (optional — for traverses)</p>
        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-1">
            <label className="block text-xs text-[var(--text-muted)] mb-1">Station</label>
            <input
              type="text"
              value={setup.backsightStation || ''}
              onChange={(e) => update('backsightStation', e.target.value)}
              placeholder="BM-0"
              className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Bearing °</label>
            <input
              type="number"
              value={setup.backsightBearing?.deg || 0}
              onChange={(e) => update('backsightBearing', { ...setup.backsightBearing!, deg: parseInt(e.target.value) || 0, min: setup.backsightBearing?.min || 0, sec: setup.backsightBearing?.sec || 0 })}
              className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">'</label>
            <input
              type="number"
              min="0" max="59"
              value={setup.backsightBearing?.min || 0}
              onChange={(e) => update('backsightBearing', { ...setup.backsightBearing!, deg: setup.backsightBearing?.deg || 0, min: parseInt(e.target.value) || 0, sec: setup.backsightBearing?.sec || 0 })}
              className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">"</label>
            <input
              type="number"
              min="0" max="59"
              value={setup.backsightBearing?.sec || 0}
              onChange={(e) => update('backsightBearing', { ...setup.backsightBearing!, deg: setup.backsightBearing?.deg || 0, min: setup.backsightBearing?.min || 0, sec: parseInt(e.target.value) || 0 })}
              className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* Atmospheric corrections */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1">
            <Thermometer className="w-3 h-3" /> Temperature (°C)
          </label>
          <input
            type="number"
            value={setup.temperature ?? ''}
            onChange={(e) => update('temperature', e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder="25"
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm font-mono focus:border-[var(--accent)] outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1 flex items-center gap-1">
            <Gauge className="w-3 h-3" /> Pressure (hPa)
          </label>
          <input
            type="number"
            value={setup.pressure ?? ''}
            onChange={(e) => update('pressure', e.target.value ? parseFloat(e.target.value) : undefined)}
            placeholder="1013"
            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm font-mono focus:border-[var(--accent)] outline-none"
          />
        </div>
      </div>

      {/* Control point toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={setup.isControlPoint}
          onChange={(e) => update('isControlPoint', e.target.checked)}
          className="w-4 h-4 accent-[var(--accent)]"
        />
        <span className="text-sm text-[var(--text-secondary)]">
          Setting up on a known control point
        </span>
      </label>

      {/* Known coordinates (if control point) */}
      {setup.isControlPoint && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Easting</label>
            <input
              type="number"
              value={setup.easting ?? ''}
              onChange={(e) => update('easting', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="500000"
              className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Northing</label>
            <input
              type="number"
              value={setup.northing ?? ''}
              onChange={(e) => update('northing', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="9900000"
              className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Elevation</label>
            <input
              type="number"
              step="0.001"
              value={setup.elevation ?? ''}
              onChange={(e) => update('elevation', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="1500"
              className="w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-xs font-mono"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => isValid && onComplete(setup)}
          disabled={!isValid}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--accent)] text-[var(--bg-primary)] rounded-lg font-semibold hover:bg-[var(--accent-dim)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" /> Confirm Setup
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2.5 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-secondary)]"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
