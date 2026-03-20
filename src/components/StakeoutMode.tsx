'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { distanceBearing } from '@/lib/engine/distance'
import { bearingToString } from '@/lib/engine/angles'
import { geographicToUTM } from '@/lib/engine/coordinates'
import { getUTMZoneFromLatLng } from '@/lib/engine/utmZones'

interface StakeoutPoint {
  id: string
  name: string
  easting: number
  northing: number
  elevation?: number
}

interface StakeoutModeProps {
  points: StakeoutPoint[]
  utmZone: number
  hemisphere: 'N' | 'S'
  onComplete?: (pointId: string) => void
}

export default function StakeoutMode({ points, utmZone, hemisphere, onComplete }: StakeoutModeProps) {
  const [currentPointIndex, setCurrentPointIndex] = useState(0)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [bearing, setBearing] = useState<number | null>(null)
  const [deltaE, setDeltaE] = useState<number | null>(null)
  const [deltaN, setDeltaN] = useState<number | null>(null)
  const [isOnPoint, setIsOnPoint] = useState(false)
  const [stakedPoints, setStakedPoints] = useState<Set<string>>(new Set())
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [toleranceM, setToleranceM] = useState(0.1)
  const [maxStakeAccuracyM, setMaxStakeAccuracyM] = useState(3)
  const [gpsWarning, setGpsWarning] = useState<string | null>(null)
  const [gpsNotice, setGpsNotice] = useState<string | null>(null)
  const lastBeepTime = useRef<number>(0)
  const audioContextRef = useRef<AudioContext | null>(null)

  const currentPoint = points[currentPointIndex]

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioContextRef.current
  }, [])

  const playProximityBeep = useCallback((dist: number) => {
    if (!audioEnabled) return
    
    const now = Date.now()
    if (now - lastBeepTime.current < (dist < 1 ? 200 : dist < 5 ? 400 : 800)) {
      return
    }
    lastBeepTime.current = now

    try {
      const audioCtx = getAudioContext()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)

      if (dist < 0.1) {
        oscillator.frequency.value = 1000
        gainNode.gain.value = 0.15
        oscillator.start()
        oscillator.stop(audioCtx.currentTime + 0.15)
      } else if (dist < 1) {
        oscillator.frequency.value = 880
        gainNode.gain.value = 0.12
        oscillator.start()
        oscillator.stop(audioCtx.currentTime + 0.1)
      } else if (dist < 5) {
        oscillator.frequency.value = 660
        gainNode.gain.value = 0.1
        oscillator.start()
        oscillator.stop(audioCtx.currentTime + 0.08)
      } else {
        oscillator.frequency.value = 440
        gainNode.gain.value = 0.08
        oscillator.start()
        oscillator.stop(audioCtx.currentTime + 0.06)
      }
    } catch (e) {
      console.error('Audio error:', e)
    }
  }, [audioEnabled, getAudioContext])

  const calculateDistanceAndBearing = useCallback(() => {
    if (!userLocation || !currentPoint) return

    const detected = getUTMZoneFromLatLng(userLocation.lat, userLocation.lon)
    if (detected.zone !== utmZone) {
      setGpsNotice(`GPS zone (${detected.zone}) differs from project zone (${utmZone}). Check project zone/hemisphere or your location.`)
    } else {
      setGpsNotice(null)
    }

    const userUtm = geographicToUTM(userLocation.lat, userLocation.lon, utmZone)
    if (userUtm.hemisphere !== hemisphere) {
      setGpsWarning(`GPS hemisphere (${userUtm.hemisphere}) does not match project hemisphere (${hemisphere}).`)
      setDistance(null)
      setBearing(null)
      setDeltaE(null)
      setDeltaN(null)
      setIsOnPoint(false)
      return
    }

    setGpsWarning(null)
    const result = distanceBearing(
      { easting: userUtm.easting, northing: userUtm.northing },
      { easting: currentPoint.easting, northing: currentPoint.northing }
    )

    setDistance(result.distance)
    setBearing(result.bearing)
    setDeltaE(result.deltaE)
    setDeltaN(result.deltaN)

    playProximityBeep(result.distance)

    if (result.distance < toleranceM) {
      setIsOnPoint(true)
      playProximityBeep(0)
    } else {
      setIsOnPoint(false)
    }
  }, [userLocation, currentPoint, playProximityBeep, utmZone, hemisphere, toleranceM])

  useEffect(() => {
    if (userLocation && currentPoint) {
      calculateDistanceAndBearing()
    }
  }, [userLocation, currentPoint, calculateDistanceAndBearing])

  useEffect(() => {
    if ('geolocation' in navigator) {
      const id = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          })
          setGpsAccuracy(Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null)
        },
        (error) => {
          console.error('GPS error:', error)
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      )

      return () => {
        navigator.geolocation.clearWatch(id)
      }
    }
  }, [])

  const handleMarkStaked = () => {
    if (!currentPoint) return
    const newStaked = new Set(stakedPoints)
    newStaked.add(currentPoint.id)
    setStakedPoints(newStaked)
    setIsOnPoint(false)
    
    if (onComplete) {
      onComplete(currentPoint.id)
    }

    if (currentPointIndex < points.length - 1) {
      setCurrentPointIndex(currentPointIndex + 1)
    }
  }

  const handleNextPoint = () => {
    if (currentPointIndex < points.length - 1) {
      setCurrentPointIndex(currentPointIndex + 1)
      setIsOnPoint(false)
    }
  }

  const handlePrevPoint = () => {
    if (currentPointIndex > 0) {
      setCurrentPointIndex(currentPointIndex - 1)
      setIsOnPoint(false)
    }
  }

  if (!currentPoint) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">No Points to Stakeout</h2>
        <p className="text-[var(--text-muted)]">Add points to your project first.</p>
      </div>
    )
  }

  const progress = `${stakedPoints.size} of ${points.length} points staked`
  const formatDistance = (m: number | null) => {
    if (m === null) return '—'
    if (m >= 10000) return `${(m / 1000).toFixed(2)} km`
    return `${m.toFixed(2)} m`
  }
  const moveInstruction = (() => {
    if (deltaE === null || deltaN === null) return null
    const eDir = deltaE >= 0 ? 'E' : 'W'
    const nDir = deltaN >= 0 ? 'N' : 'S'
    return {
      eText: `${eDir} ${Math.abs(deltaE).toFixed(2)} m`,
      nText: `${nDir} ${Math.abs(deltaN).toFixed(2)} m`,
    }
  })()

  const gpsQuality = (() => {
    if (gpsAccuracy === null) return { label: '—', tone: 'text-[var(--text-secondary)]', okToStake: false }
    if (gpsAccuracy <= 1) return { label: `±${gpsAccuracy.toFixed(0)} m (Good)`, tone: 'text-green-300', okToStake: true }
    if (gpsAccuracy <= maxStakeAccuracyM) return { label: `±${gpsAccuracy.toFixed(0)} m (Fair)`, tone: 'text-amber-300', okToStake: true }
    return { label: `±${gpsAccuracy.toFixed(0)} m (Poor)`, tone: 'text-red-300', okToStake: false }
  })()

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">GPS Stakeout</h1>
            <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
              Zone {utmZone}{hemisphere} · Tol {toleranceM.toFixed(2)} m · <span className={gpsQuality.tone}>{gpsQuality.label}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--text-secondary)]">{progress}</span>
            <button
              onClick={() => setShowSettings(true)}
              className="px-3 py-1 rounded text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)]"
            >
              ⚙ Settings
            </button>
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`px-3 py-1 rounded text-sm ${
                audioEnabled ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-[var(--text-secondary)]'
              }`}
            >
              {audioEnabled ? '🔊' : '🔇'}
            </button>
          </div>
        </div>
      </header>

      {showSettings ? (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold text-[var(--text-primary)]">Stakeout Settings</div>
              <button onClick={() => setShowSettings(false)} className="px-3 py-1 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)]">
                ✕
              </button>
            </div>

            <div className="grid gap-4">
              <div className="rounded-xl bg-[var(--bg-primary)]/40 border border-[var(--border-color)] p-4">
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Tolerance (on-point)</div>
                <div className="flex items-center gap-3">
                  <input
                    inputMode="decimal"
                    className="w-28 bg-[var(--bg-primary)]/40 border border-[var(--border-color)] rounded px-3 py-2 text-[var(--text-primary)] font-mono"
                    value={toleranceM}
                    onChange={(e) => setToleranceM(Math.max(0.01, Number(e.target.value) || 0.1))}
                  />
                  <div className="text-sm text-[var(--text-secondary)]">m (typical: 0.05–0.20 m)</div>
                </div>
              </div>

              <div className="rounded-xl bg-[var(--bg-primary)]/40 border border-[var(--border-color)] p-4">
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">GPS quality gate</div>
                <div className="flex items-center gap-3">
                  <input
                    inputMode="decimal"
                    className="w-28 bg-[var(--bg-primary)]/40 border border-[var(--border-color)] rounded px-3 py-2 text-[var(--text-primary)] font-mono"
                    value={maxStakeAccuracyM}
                    onChange={(e) => setMaxStakeAccuracyM(Math.max(1, Number(e.target.value) || 3))}
                  />
                  <div className="text-sm text-[var(--text-secondary)]">m max accuracy to allow “Mark as staked”</div>
                </div>
              </div>

              <div className="text-xs text-[var(--text-muted)]">
                Tip: if distance is unrealistically huge, verify project zone/hemisphere and confirm you’re physically near the project.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isOnPoint ? (
        <div className="flex-1 flex items-center justify-center bg-green-900/30">
          <div className="text-center">
            <div className="text-8xl mb-4">✓</div>
            <h2 className="text-3xl font-bold text-green-400 mb-4">ON POINT</h2>
            <p className="text-[var(--text-primary)] mb-6">{currentPoint.name}</p>
            <button
              onClick={() => {
                if (!gpsQuality.okToStake) {
                  if (!confirm('GPS accuracy is poor. Mark as staked anyway?')) return
                }
                handleMarkStaked()
              }}
              className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-lg disabled:opacity-50"
            >
              Mark as Staked ✓
            </button>
            {!gpsQuality.okToStake ? (
              <div className="mt-3 text-xs text-[var(--text-primary)]">
                Accuracy gate: <span className="text-red-300">{gpsQuality.label}</span> (raise the limit in Settings if needed)
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center mb-6">
            <div className="text-6xl mb-3">🎯</div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{currentPoint.name}</h2>
            <p className="text-[var(--text-secondary)] mt-1 font-mono text-sm">
              E {currentPoint.easting.toFixed(4)} m · N {currentPoint.northing.toFixed(4)} m
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              GPS: {userLocation ? `${userLocation.lat.toFixed(6)}, ${userLocation.lon.toFixed(6)}` : '—'} {gpsAccuracy !== null ? `· ±${gpsAccuracy.toFixed(0)} m` : ''}
            </p>
          </div>

          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 w-full max-w-xl border border-[var(--border-color)] shadow-xl">
            {gpsWarning ? (
              <div className="mb-4 p-3 rounded border border-yellow-700 bg-yellow-900/20 text-yellow-200 text-sm">
                {gpsWarning}
              </div>
            ) : null}
            {gpsNotice ? (
              <div className="mb-4 p-3 rounded border border-amber-700/50 bg-amber-900/10 text-amber-200 text-sm">
                {gpsNotice}
              </div>
            ) : null}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-[var(--bg-primary)]/40 border border-[var(--border-color)] p-4 text-center">
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Distance</div>
                <div className="mt-1 text-5xl font-bold text-[var(--accent)] tabular-nums">{formatDistance(distance)}</div>
                {distance !== null && distance > 5000 ? (
                  <div className="mt-2 text-xs text-[var(--text-muted)]">Very large distance — double-check project zone/hemisphere and GPS.</div>
                ) : null}
              </div>
              <div className="rounded-xl bg-[var(--bg-primary)]/40 border border-[var(--border-color)] p-4 text-center">
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Bearing (WCB)</div>
                <div className="mt-2 text-2xl font-mono text-[var(--text-primary)]">{bearing !== null ? bearingToString(bearing) : '—'}</div>

                <div className="mt-4 flex items-center justify-center">
                  <div className="relative w-28 h-28 rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)]/30">
                    <div className="absolute inset-x-0 top-2 text-center text-[10px] text-[var(--text-secondary)]">N</div>
                    <div className="absolute inset-y-0 right-2 flex items-center text-[10px] text-[var(--text-secondary)]">E</div>
                    <div className="absolute inset-x-0 bottom-2 text-center text-[10px] text-[var(--text-secondary)]">S</div>
                    <div className="absolute inset-y-0 left-2 flex items-center text-[10px] text-[var(--text-secondary)]">W</div>
                    <div
                      className="absolute left-1/2 top-1/2 w-1 h-10 bg-[var(--accent)] rounded origin-bottom"
                      style={{ transform: `translate(-50%, -100%) rotate(${bearing ?? 0}deg)` }}
                    />
                    <div className="absolute left-1/2 top-1/2 w-2.5 h-2.5 bg-[var(--accent)] rounded-full -translate-x-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-3 rounded bg-[var(--bg-primary)]/40 border border-[var(--border-color)]">
                <div className="text-[var(--text-muted)]">ΔE (m)</div>
                <div className={deltaE !== null && deltaE >= 0 ? 'text-green-300' : 'text-red-300'}>
                  {deltaE !== null ? deltaE.toFixed(4) : '—'}
                </div>
              </div>
              <div className="p-3 rounded bg-[var(--bg-primary)]/40 border border-[var(--border-color)]">
                <div className="text-[var(--text-muted)]">ΔN (m)</div>
                <div className={deltaN !== null && deltaN >= 0 ? 'text-green-300' : 'text-red-300'}>
                  {deltaN !== null ? deltaN.toFixed(4) : '—'}
                </div>
              </div>
            </div>

            {moveInstruction ? (
              <div className="mt-3 p-3 rounded bg-[var(--bg-primary)]/40 border border-[var(--border-color)]">
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">Move</div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-[var(--text-primary)]">East/West</div>
                  <div className="font-mono text-[var(--text-primary)]">{moveInstruction.eText}</div>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <div className="text-[var(--text-primary)]">North/South</div>
                  <div className="font-mono text-[var(--text-primary)]">{moveInstruction.nText}</div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={handlePrevPoint}
              disabled={currentPointIndex === 0}
              className="px-6 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded-lg disabled:opacity-50"
            >
              ← Previous
            </button>
            <button
              onClick={handleNextPoint}
              disabled={currentPointIndex === points.length - 1}
              className="px-6 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded-lg disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </main>
      )}

      <div className="bg-[var(--bg-secondary)] border-t border-[var(--border-color)] p-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {points.map((pt, idx) => (
            <button
              key={pt.id}
              onClick={() => {
                setCurrentPointIndex(idx)
                setIsOnPoint(false)
              }}
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
                idx === currentPointIndex 
                  ? 'bg-[var(--accent)] text-black font-bold' 
                  : stakedPoints.has(pt.id)
                    ? 'bg-green-900 text-green-400'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
              }`}
            >
              {stakedPoints.has(pt.id) && '✓ '}{pt.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
