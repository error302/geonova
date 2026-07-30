'use client'

import { useEffect, useState, useRef } from 'react'

/**
 * NorthArrowOverlay — always-on north arrow that rotates inversely to map rotation.
 *
 * Surveyors rotate maps constantly in the field. "Which way is north?" should
 * never require opening a panel. This component listens to the OpenLayers view's
 * rotation change event and rotates the arrow to always point to true north.
 *
 * Uses v0.3 design tokens (sienna accent on tinted dark bg).
 */

interface NorthArrowOverlayProps {
  /** Ref to the OpenLayers map instance */
  mapInstance: React.MutableRefObject<any>
}

export function NorthArrowOverlay({ mapInstance }: NorthArrowOverlayProps) {
  const [rotation, setRotation] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    const view = map.getView()
    if (!view) return

    // Initial rotation
    setRotation((view.getRotation() * 180) / Math.PI)
    setVisible(true)

    // Listen for rotation changes
    const onRotate = () => {
      setRotation((view.getRotation() * 180) / Math.PI)
    }
    view.on('change:rotation', onRotate)

    return () => {
      view.un('change:rotation', onRotate)
    }
  }, [mapInstance])

  if (!visible) return null

  return (
    <div
      className="flex flex-col items-center select-none pointer-events-none"
      aria-label={`North arrow, map rotation ${rotation.toFixed(1)} degrees`}
    >
      <div
        style={{ transform: `rotate(${-rotation}deg)`, transition: 'transform 100ms linear' }}
        className="flex flex-col items-center"
      >
        <svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* N label */}
          <text x="18" y="6" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--accent)" fontFamily="JetBrains Mono, monospace">
            N
          </text>
          {/* Arrow head — sienna filled triangle */}
          <polygon points="18,8 12,22 18,18 24,22" fill="var(--accent)" />
          {/* Arrow shaft */}
          <line x1="18" y1="18" x2="18" y2="44" stroke="var(--accent)" strokeWidth="2" />
          {/* Arrow tail — open */}
          <polygon points="18,46 14,38 18,40 22,38" fill="none" stroke="var(--text-muted)" strokeWidth="1" />
        </svg>
      </div>
      {Math.abs(rotation) > 0.5 && (
        <div className="mt-1 px-1.5 py-0.5 bg-[var(--bg-card)] border border-[var(--border-color)] font-mono text-[9px] text-[var(--text-muted)] tracking-[0.04em]">
          {rotation.toFixed(0)}°
        </div>
      )}
    </div>
  )
}
