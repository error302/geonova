'use client'
/**
 * RotationControl — Map rotation indicator & north-reset button
 *
 * Shows the current map rotation angle and provides a one-click
 * "reset to north" button. The compass needle rotates in sync with
 * the map so surveyors always know their orientation.
 *
 * Reads map instance from MapReactContext.
 * Uses OL view.animate() for smooth reset.
 */

import React, { useState, useEffect, useCallback, memo } from 'react'
import { useMapContext } from '@/app/map/MapReactContext'

function RotationControlInner() {
  const { mapInstance } = useMapContext()
  const [rotation, setRotation] = useState(0)

  // ── Track rotation changes from the map view ──
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    const view = map.getView()
    if (!view) return

    // Initial value
    setRotation(view.getRotation() || 0)

    // Listen for rotation changes
    const onRotationChange = () => {
      setRotation(view.getRotation() || 0)
    }

    view.on('change:rotation', onRotationChange)

    return () => {
      view.un('change:rotation', onRotationChange)
    }
  }, [mapInstance])

  // ── Reset rotation to north (0) ──
  const handleResetNorth = useCallback(() => {
    const map = mapInstance.current
    if (!map) return

    const view = map.getView()
    if (!view) return

    view.animate({
      rotation: 0,
      duration: 300,
    })
  }, [mapInstance])

  // Convert radians to degrees for display
  const rotationDeg = Math.round((rotation * 180) / Math.PI)
  const isRotated = Math.abs(rotation) > 0.001

  // Don't render if map not available
  if (!mapInstance.current) return null

  return (
    <button
      onClick={handleResetNorth}
      className={[
        'relative w-10 h-10 rounded-lg border bg-[var(--bg-card)] shadow-sm transition-all',
        'flex items-center justify-center',
        isRotated
          ? 'border-[#1B3A5C] hover:bg-[color-mix(in_srgb,var(--primary-blue)_10%,transparent)] cursor-pointer'
          : 'border-[var(--border-color)] cursor-default opacity-50',
      ].join(' ')}
      title={isRotated ? `Reset North (rotated ${rotationDeg}°)` : 'North (0°)'}
      disabled={!isRotated}
      style={{ fontFamily: 'Calibri, sans-serif' }}
    >
      {/* Compass needle — rotates with map */}
      <svg
        className="w-6 h-6 transition-transform"
        style={{
          transform: `rotate(${rotationDeg}deg)`,
          transformOrigin: 'center',
        }}
        viewBox="0 0 24 24"
        fill="none"
      >
        {/* North needle (red) */}
        <path
          d="M12 2 L14 12 L12 10 L10 12 Z"
          fill={isRotated ? '#c0392b' : '#999'}
        />
        {/* South needle (dark) */}
        <path
          d="M12 22 L14 12 L12 14 L10 12 Z"
          fill={isRotated ? '#1B3A5C' : '#bbb'}
        />
        {/* Center dot */}
        <circle cx="12" cy="12" r="1.5" fill="#1B3A5C" />
      </svg>

      {/* Rotation badge */}
      {isRotated && (
        <span className="absolute -top-1 -right-1 bg-[#1B3A5C] text-[var(--text-primary)] text-[8px] font-bold px-1 py-0.5 rounded-full leading-none">
          {rotationDeg}°
        </span>
      )}
    </button>
  )
}

export const RotationControl = memo(RotationControlInner)
