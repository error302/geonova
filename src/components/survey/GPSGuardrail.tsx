'use client'

/**
 * GPSGuardrail — Real-time GPS accuracy indicator for field work
 *
 * Levels:
 * - HIGH (accuracy < 3m): "High Precision" — safe for cadastral work
 * - MODERATE (3-10m): "Moderate Accuracy" — OK for topo
 * - LOW (> 10m): "Low Precision" — warn user, don't capture
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { ShieldCheck, ShieldAlert, ShieldQuestion, Satellite, Activity } from 'lucide-react'
import { logger } from '@/lib/logger'

type AccuracyLevel = 'high' | 'moderate' | 'low' | 'unknown'

interface GPSReading {
  lat: number
  lng: number
  accuracy: number
  altitude?: number | null
  timestamp: number
}

interface GPSGuardrailProps {
  compact?: boolean
  onAccuracyChange?: (level: AccuracyLevel, reading: GPSReading | null) => void
  useCapacitor?: boolean
  showCoords?: boolean
}

const ACCURACY_CONFIG: Record<AccuracyLevel, {
  label: string
  description: string
  color: string
  bg: string
  border: string
  icon: typeof ShieldCheck
}> = {
  high: { label: 'High Precision', description: 'Safe for cadastral capture', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: ShieldCheck },
  moderate: { label: 'Moderate Accuracy', description: 'OK for topographic work', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: ShieldAlert },
  low: { label: 'Low Precision', description: 'Do not capture — poor signal', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: ShieldAlert },
  unknown: { label: 'No GPS Signal', description: 'Waiting for satellite fix...', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30', icon: ShieldQuestion },
}

function getAccuracyLevel(accuracy: number | null | undefined): AccuracyLevel {
  if (accuracy == null || !isFinite(accuracy)) return 'unknown'
  if (accuracy < 3) return 'high'
  if (accuracy <= 10) return 'moderate'
  return 'low'
}

export function GPSGuardrail({ compact = false, onAccuracyChange, useCapacitor = false, showCoords = false }: GPSGuardrailProps) {
  const [reading, setReading] = useState<GPSReading | null>(null)
  const [level, setLevel] = useState<AccuracyLevel>('unknown')
  const [watching, setWatching] = useState(false)
  const watchIdRef = useRef<string | number | null>(null)
  const lastCallbackRef = useRef<{ level: AccuracyLevel; reading: GPSReading | null }>({ level: 'unknown', reading: null })

  const startWatch = useCallback(async () => {
    if (watching) return
    setWatching(true)
    try {
      if (useCapacitor) {
        const { Geolocation } = await import('@capacitor/geolocation')
        const watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 },
          (pos, err) => {
            if (err || !pos) { setLevel('unknown'); setReading(null); return }
            const r: GPSReading = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, altitude: pos.coords.altitude, timestamp: pos.timestamp }
            setReading(r); setLevel(getAccuracyLevel(r.accuracy))
          }
        )
        watchIdRef.current = watchId
      } else {
        if (!('geolocation' in navigator)) { setLevel('unknown'); setWatching(false); return }
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const r: GPSReading = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, altitude: pos.coords.altitude, timestamp: pos.timestamp }
            setReading(r); setLevel(getAccuracyLevel(r.accuracy))
          },
          () => { setLevel('unknown'); setReading(null) },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
        )
        watchIdRef.current = watchId
      }
    } catch (err) {
      logger.warn('[GPSGuardrail] Failed to start watch:', { error: err })
      setWatching(false)
    }
  }, [useCapacitor, watching])

  const stopWatch = useCallback(async () => {
    if (watchIdRef.current != null) {
      try {
        if (useCapacitor) {
          const { Geolocation } = await import('@capacitor/geolocation')
          await Geolocation.clearWatch({ id: watchIdRef.current as string })
        } else {
          navigator.geolocation.clearWatch(watchIdRef.current as number)
        }
      } catch {}
      watchIdRef.current = null
    }
    setWatching(false)
  }, [useCapacitor])

  useEffect(() => {
    startWatch()
    return () => { stopWatch() }
  }, [startWatch, stopWatch])

  useEffect(() => {
    if (onAccuracyChange) {
      const last = lastCallbackRef.current
      if (last.level !== level || last.reading !== reading) {
        lastCallbackRef.current = { level, reading }
        onAccuracyChange(level, reading)
      }
    }
  }, [level, reading, onAccuracyChange])

  const config = ACCURACY_CONFIG[level]
  const Icon = config.icon

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${config.bg} ${config.border} ${config.color}`} title={`${config.label} — ${config.description}`}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-medium">{reading ? `±${reading.accuracy.toFixed(1)}m` : '—'}</span>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border ${config.bg} ${config.border} p-3`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${config.bg} ${config.border} border`}>
          <Icon className={`w-5 h-5 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
            {reading && <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>±{reading.accuracy.toFixed(2)}m</span>}
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">{config.description}</p>
          {showCoords && reading && (
            <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] font-mono text-gray-400">
              <div>Lat: {reading.lat.toFixed(6)}</div>
              <div>Lng: {reading.lng.toFixed(6)}</div>
              {reading.altitude != null && <div>Alt: {reading.altitude.toFixed(1)}m</div>}
              <div className="flex items-center gap-1"><Activity className="w-2.5 h-2.5" />{new Date(reading.timestamp).toLocaleTimeString()}</div>
            </div>
          )}
        </div>
        <div className="shrink-0"><Satellite className={`w-4 h-4 ${watching ? 'text-emerald-400 animate-pulse' : 'text-gray-600'}`} /></div>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <div className="flex-1 h-1.5 rounded-full bg-gray-700 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${level === 'high' ? 'bg-emerald-500 w-full' : level === 'moderate' ? 'bg-amber-500 w-2/3' : level === 'low' ? 'bg-red-500 w-1/3' : 'bg-gray-600 w-0'}`} />
        </div>
        <span className="text-[9px] text-gray-600 shrink-0">3m | 10m</span>
      </div>
    </div>
  )
}

export type { AccuracyLevel, GPSReading }
export { getAccuracyLevel }
