'use client';

/**
 * FieldMeasureButton — large one-tap measurement capture button
 *
 * Designed for field use:
 *   - Large touch target (min 120×120px) — works with gloves
 *   - High contrast — visible in sunlight
 *   - Haptic feedback on press (vibration)
 *   - Audio cue on successful capture
 *   - Shows point ID being measured
 *   - Disabled state when no instrument connected
 *
 * After capture:
 *   - Flashes green
 *   - Auto-increments point ID (P1 → P2 → P3…)
 *   - Shows last measurement summary for 2 seconds
 */

import { useState, useCallback, useRef } from 'react'
import { Crosshair, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { useInstrumentStore } from '@/stores/instrumentStore'

interface FieldMeasureButtonProps {
  onCapture: (pointId: string) => Promise<boolean>
  disabled?: boolean
  pointIdPrefix?: string  // e.g., 'P', 'BP', 'STN'
  stationSetup?: boolean  // is station set up?
}

export function FieldMeasureButton({
  onCapture,
  disabled = false,
  pointIdPrefix = 'P',
  stationSetup = false,
}: FieldMeasureButtonProps) {
  const [pointNumber, setPointNumber] = useState(1)
  const [isCapturing, setIsCapturing] = useState(false)
  const [lastResult, setLastResult] = useState<'success' | 'error' | null>(null)
  const [lastPointId, setLastPointId] = useState<string | null>(null)
  const flashTimer = useRef<any>(null)

  const { status, latestPoint } = useInstrumentStore()
  const isConnected = status === 'connected' || status === 'streaming'
  const isDisabled = disabled || !isConnected || !stationSetup || isCapturing

  const pointId = `${pointIdPrefix}${pointNumber}`

  const handleMeasure = useCallback(async () => {
    if (isDisabled) return

    // Haptic feedback
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(30)
    }

    setIsCapturing(true)
    setLastResult(null)

    try {
      const success = await onCapture(pointId)
      if (success) {
        setLastResult('success')
        setLastPointId(pointId)
        setPointNumber(n => n + 1)

        // Audio cue: short high beep
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.frequency.value = 880  // A5
          gain.gain.setValueAtTime(0.15, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
          osc.start()
          osc.stop(ctx.currentTime + 0.15)
        } catch {}

        // Clear flash after 2s
        if (flashTimer.current) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setLastResult(null), 2000)
      } else {
        setLastResult('error')
        // Error buzz: low tone
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([100, 50, 100])
        }
        if (flashTimer.current) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setLastResult(null), 3000)
      }
    } catch (err) {
      setLastResult('error')
      console.error('[field-measure] Capture failed:', err)
    } finally {
      setIsCapturing(false)
    }
  }, [isDisabled, onCapture, pointId])

  // Button styles based on state
  const baseClass = 'relative w-32 h-32 rounded-full flex flex-col items-center justify-center gap-1 transition-all duration-150 select-none font-bold'

  let buttonClass = baseClass
  let icon = <Crosshair className="w-8 h-8" />
  let label = 'MEASURE'

  if (isCapturing) {
    buttonClass += ' bg-[var(--accent)]/30 border-4 border-[var(--accent)] text-[var(--accent)]'
    icon = <Loader2 className="w-8 h-8 animate-spin" />
    label = 'CAPTURING…'
  } else if (lastResult === 'success') {
    buttonClass += ' bg-[var(--success)]/30 border-4 border-[var(--success)] text-[var(--success)] scale-105'
    icon = <CheckCircle className="w-8 h-8" />
    label = 'CAPTURED'
  } else if (lastResult === 'error') {
    buttonClass += ' bg-[var(--error)]/30 border-4 border-[var(--error)] text-[var(--error)]'
    icon = <AlertTriangle className="w-8 h-8" />
    label = 'FAILED'
  } else if (isDisabled) {
    buttonClass += ' bg-[var(--bg-tertiary)] border-4 border-[var(--border-color)] text-[var(--text-muted)] opacity-50 cursor-not-allowed'
    if (!isConnected) label = 'NO INSTRUMENT'
    else if (!stationSetup) label = 'SETUP FIRST'
  } else {
    buttonClass += ' bg-[var(--accent)]/15 border-4 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/25 active:scale-95 cursor-pointer'
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleMeasure}
        disabled={isDisabled}
        className={buttonClass}
        aria-label={`Measure point ${pointId}`}
      >
        {icon}
        <span className="text-sm tracking-wider">{label}</span>
      </button>

      {/* Point ID display */}
      <div className="text-center">
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Next Point</div>
        <div className="text-lg font-mono font-bold text-[var(--text-primary)]">{pointId}</div>
      </div>

      {/* Last measurement summary */}
      {lastResult === 'success' && lastPointId && latestPoint && (
        <div className="text-center text-xs text-[var(--success)] animate-fade-in">
          ✓ {lastPointId}: {
            latestPoint.source === 'nmea'
              ? `${latestPoint.latitude?.toFixed(6)}, ${latestPoint.longitude?.toFixed(6)}`
              : `${latestPoint.easting?.toFixed(3)}, ${latestPoint.northing?.toFixed(3)}`
          }
        </div>
      )}

      {/* Quick point ID controls */}
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={() => setPointNumber(n => Math.max(1, n - 1))}
          className="px-2 py-0.5 text-xs rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
        >
          −
        </button>
        <input
          type="text"
          value={pointId}
          onChange={(e) => {
            const match = e.target.value.match(/(\D+)(\d+)/)
            if (match) {
              setPointNumber(parseInt(match[2]) || 1)
            }
          }}
          className="w-20 text-center text-xs font-mono bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded px-1 py-0.5 text-[var(--text-primary)]"
        />
        <button
          onClick={() => setPointNumber(n => n + 1)}
          className="px-2 py-0.5 text-xs rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
        >
          +
        </button>
      </div>
    </div>
  )
}
