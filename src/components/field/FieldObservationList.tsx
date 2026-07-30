'use client';

/**
 * FieldObservationList — scrollable list of captured measurements
 *
 * Shows recent measurements with:
 *   - Point ID + timestamp
 *   - Coordinates (E/N/Z for total station, lat/lon for GNSS)
 *   - Sync status (synced/pending)
 *   - Quick delete (swipe or trash button)
 *
 * Designed for field use: large touch targets, high contrast.
 */

import { memo } from 'react'
import { Trash2, CloudCheck, CloudOff, Clock } from 'lucide-react'
import type { FieldMeasurement } from '@/lib/field/fieldSession'

interface FieldObservationListProps {
  measurements: FieldMeasurement[]
  onDelete?: (id: string) => void
}

export const FieldObservationList = memo(function FieldObservationList({
  measurements,
  onDelete,
}: FieldObservationListProps) {
  if (measurements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="w-8 h-8 text-[var(--text-muted)] mb-2" />
        <p className="text-sm text-[var(--text-muted)]">No measurements yet</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Set up your station and tap MEASURE to begin
        </p>
      </div>
    )
  }

  // Show most recent first
  const sorted = [...measurements].sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div className="overflow-y-auto max-h-[calc(100vh-20rem)]">
      <div className="px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {measurements.length} Measurement{measurements.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="divide-y divide-[var(--border-color)]">
        {sorted.map((m) => (
          <ObservationRow key={m.id} measurement={m} onDelete={onDelete} />
        ))}
      </div>
    </div>
  )
})

function ObservationRow({
  measurement,
  onDelete,
}: {
  measurement: FieldMeasurement
  onDelete?: (id: string) => void
}) {
  const time = new Date(measurement.timestamp).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const isGNSS = measurement.instrumentType === 'gnss_rover'

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-[var(--bg-secondary)] transition-colors">
      {/* Sync icon */}
      <div className="mt-0.5 shrink-0">
        {measurement.synced ? (
          <CloudCheck className="w-4 h-4 text-[var(--success)]" />
        ) : (
          <CloudOff className="w-4 h-4 text-[var(--warning)]" />
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
            {measurement.pointId}
          </span>
          <span className="text-xs text-[var(--text-muted)] font-mono">{time}</span>
        </div>

        {/* Coordinates */}
        <div className="mt-0.5 text-xs font-mono text-[var(--text-secondary)]">
          {isGNSS ? (
            <>
              {measurement.latitude?.toFixed(7)}, {measurement.longitude?.toFixed(7)}
              {measurement.fixQuality && (
                <span className={`ml-2 px-1 rounded text-[10px] ${
                  measurement.fixQuality === 'fixed'
                    ? 'bg-[var(--success)]/20 text-[var(--success)]'
                    : 'bg-[var(--warning)]/20 text-[var(--warning)]'
                }`}>
                  {measurement.fixQuality.toUpperCase()}
                </span>
              )}
            </>
          ) : (
            <>
              E: {measurement.easting?.toFixed(3)}, N: {measurement.northing?.toFixed(3)}
              {measurement.elevation != null && (
                <span className="ml-2 text-[var(--text-muted)]">
                  Z: {measurement.elevation.toFixed(3)}
                </span>
              )}
            </>
          )}
        </div>

        {/* Measurement details */}
        {!isGNSS && measurement.slopeDistance != null && (
          <div className="mt-0.5 text-xs text-[var(--text-muted)] font-mono">
            SD: {measurement.slopeDistance.toFixed(3)}m
            {measurement.horizontalAngle && (
              <span className="ml-2">
                HA: {measurement.horizontalAngle.deg}°{measurement.horizontalAngle.min}'{measurement.horizontalAngle.sec}"
              </span>
            )}
            {measurement.verticalAngle && (
              <span className="ml-2">
                VA: {measurement.verticalAngle.deg}°{measurement.verticalAngle.min}'{measurement.verticalAngle.sec}"
              </span>
            )}
          </div>
        )}

        {/* GNSS quality */}
        {isGNSS && measurement.satellites != null && (
          <div className="mt-0.5 text-xs text-[var(--text-muted)] font-mono">
            🛰 {measurement.satellites} sats
            {measurement.hdop != null && ` · HDOP ${measurement.hdop.toFixed(1)}`}
            {measurement.elevation != null && ` · H ${measurement.elevation.toFixed(2)}m`}
          </div>
        )}

        {/* Notes */}
        {measurement.notes && (
          <div className="mt-0.5 text-xs text-[var(--text-muted)] italic">
            📝 {measurement.notes}
          </div>
        )}
      </div>

      {/* Delete */}
      {onDelete && (
        <button
          onClick={() => onDelete(measurement.id)}
          className="shrink-0 p-1 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
          aria-label="Delete measurement"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
