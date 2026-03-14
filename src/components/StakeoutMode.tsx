'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { distanceBearing } from '@/lib/engine/distance'

interface StakeoutPoint {
  id: string
  name: string
  easting: number
  northing: number
  elevation?: number
}

interface StakeoutModeProps {
  points: StakeoutPoint[]
  onComplete?: (pointId: string) => void
}

export default function StakeoutMode({ points, onComplete }: StakeoutModeProps) {
  const [currentPointIndex, setCurrentPointIndex] = useState(0)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [bearing, setBearing] = useState<number | null>(null)
  const [isOnPoint, setIsOnPoint] = useState(false)
  const [watchId, setWatchId] = useState<number | null>(null)
  const [stakedPoints, setStakedPoints] = useState<Set<string>>(new Set())
  const [audioEnabled, setAudioEnabled] = useState(true)
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

  const utmToLatLon = (easting: number, northing: number, zone: number, hemisphere: 'N' | 'S'): { lat: number; lon: number } => {
    const k0 = 0.9996
    const e = 0.081819191
    const ePrimeSq = 0.006739497
    const FalseEasting = 500000
    const FalseNorthing = hemisphere === 'S' ? 10000000 : 0
    
    const x = easting - FalseEasting
    const y = northing - FalseNorthing
    
    const M = y / k0
    const mu = M / (6367449.145823 * (1 - e * e / 4 - 3 * e * e * e * e / 64))
    
    const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e))
    const phi1 = mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
      + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
      + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu)
    
    const N1 = 6367449.145823 * (1 - e * e) / Math.pow(1 - e * e * Math.sin(phi1) * Math.sin(phi1), 1.5)
    const T1 = Math.tan(phi1) * Math.tan(phi1)
    const C1 = ePrimeSq * Math.cos(phi1) * Math.cos(phi1)
    const R1 = 6367449.145823 * (1 - e * e) / Math.pow(1 - e * e * Math.sin(phi1) * Math.sin(phi1), 2.5)
    const D = x / (N1 * k0)
    
    const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (
      D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ePrimeSq) * D * D * D * D / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ePrimeSq - 3 * C1 * C1) * D * D * D * D * D * D / 720
    )
    
    const lon = (D - (1 + 2 * T1 + C1) * D * D * D / 6 + 
      (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ePrimeSq + 24 * T1 * T1) * D * D * D * D * D / 120) / Math.cos(phi1)
    
    const latDeg = lat * 180 / Math.PI
    const lonDeg = (zone * 6 - 180 + 3 + lon * 180 / Math.PI)
    
    return { lat: latDeg, lon: lonDeg }
  }

  const calculateDistanceAndBearing = useCallback(() => {
    if (!userLocation || !currentPoint) return

    const target = utmToLatLon(currentPoint.easting, currentPoint.northing, 36, 'N')
    
    const result = distanceBearing(
      { easting: userLocation.lon, northing: userLocation.lat },
      { easting: target.lon, northing: target.lat }
    )
    
    const distMeters = result.distance * 111320
    setDistance(distMeters)
    setBearing(result.bearing)
    
    playProximityBeep(distMeters)
    
    if (distMeters < 0.1) {
      setIsOnPoint(true)
      playProximityBeep(0)
    } else {
      setIsOnPoint(false)
    }
  }, [userLocation, currentPoint, playProximityBeep])

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
      setWatchId(id)

      return () => {
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId)
        }
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
        <h2 className="text-xl font-bold text-gray-100 mb-4">No Points to Stakeout</h2>
        <p className="text-gray-500">Add points to your project first.</p>
      </div>
    )
  }

  const progress = `${stakedPoints.size} of ${points.length} points staked`

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-100">GPS Stakeout</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">{progress}</span>
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`px-3 py-1 rounded text-sm ${
                audioEnabled ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'
              }`}
            >
              {audioEnabled ? '🔊' : '🔇'}
            </button>
          </div>
        </div>
      </header>

      {isOnPoint ? (
        <div className="flex-1 flex items-center justify-center bg-green-900/30">
          <div className="text-center">
            <div className="text-8xl mb-4">✓</div>
            <h2 className="text-3xl font-bold text-green-400 mb-4">ON POINT</h2>
            <p className="text-gray-300 mb-6">{currentPoint.name}</p>
            <button
              onClick={handleMarkStaked}
              className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-lg"
            >
              Mark as Staked ✓
            </button>
          </div>
        </div>
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-2xl font-bold text-gray-100 mb-2">{currentPoint.name}</h2>
            <p className="text-gray-400">
              E: {currentPoint.easting.toFixed(4)} m | N: {currentPoint.northing.toFixed(4)} m
            </p>
          </div>

          <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md">
            <div className="text-center mb-6">
              <div className="text-sm text-gray-500 uppercase tracking-wider mb-2">Distance</div>
              <div className="text-5xl font-bold text-[#E8841A]">
                {distance !== null ? `${distance.toFixed(2)} m` : '—'}
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm text-gray-500 uppercase tracking-wider mb-2">Bearing</div>
              <div className="text-2xl font-mono text-gray-200">
                {bearing !== null ? `${bearing.toFixed(1)}°` : '—'}
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 border-4 border-gray-700 rounded-full"></div>
                <div 
                  className="absolute inset-0 border-4 border-[#E8841A] rounded-full"
                  style={{
                    clipPath: bearing !== null ? `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.sin(bearing * Math.PI / 180)}% ${50 - 50 * Math.cos(bearing * Math.PI / 180)}%)` : 'none'
                  }}
                ></div>
                <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-[#E8841A] rounded-full -translate-x-1/2 -translate-y-1/2"></div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-4">
            <button
              onClick={handlePrevPoint}
              disabled={currentPointIndex === 0}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg disabled:opacity-50"
            >
              ← Previous
            </button>
            <button
              onClick={handleNextPoint}
              disabled={currentPointIndex === points.length - 1}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </main>
      )}

      <div className="bg-gray-900 border-t border-gray-800 p-4">
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
                  ? 'bg-[#E8841A] text-black font-bold' 
                  : stakedPoints.has(pt.id)
                    ? 'bg-green-900 text-green-400'
                    : 'bg-gray-800 text-gray-300'
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
