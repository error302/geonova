'use client'

/**
 * StakeoutRadar — Hot/Cold directional guidance for beacon recovery + AR Mode
 *
 * Features:
 * - Radar-style circular display
 * - Augmented Reality (AR) Camera overlay mode
 * - Directional arrow pointing to target
 * - Distance countdown (large, color-coded)
 * - Color shifts: Red (far) → Amber (close) → Green (on target)
 * - Bearing display in DMS
 * - Vibration feedback when within 1m (mobile)
 * - Audio beep that speeds up as you approach
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Target, Navigation, Crosshair, Volume2, VolumeX, X, Camera, Compass } from 'lucide-react'

interface StakeoutRadarProps {
  targetE: number
  targetN: number
  onClose?: () => void
  epsg?: string
}

interface Position {
  lat: number
  lng: number
  accuracy: number
  easting: number
  northing: number
}

export function StakeoutRadar({ targetE, targetN, onClose, epsg = 'EPSG:21037' }: StakeoutRadarProps) {
  const [position, setPosition] = useState<Position | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [bearing, setBearing] = useState<number | null>(null)
  const [soundOn, setSoundOn] = useState(true)
  const [watching, setWatching] = useState(false)
  
  // AR State
  const [viewMode, setViewMode] = useState<'radar' | 'ar'>('radar')
  const [compassHeading, setCompassHeading] = useState<number | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  
  const watchIdRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const lastBeepRef = useRef<number>(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Transform WGS84 to UTM
  const transformToUTM = useCallback(async (lat: number, lng: number): Promise<{ easting: number; northing: number }> => {
    try {
      const { transform } = await import('ol/proj')
      const [e, n] = transform([lng, lat], 'EPSG:4326', epsg) as [number, number]
      return { easting: e, northing: n }
    } catch {
      return { easting: 0, northing: 0 }
    }
  }, [epsg])

  const playBeep = useCallback((frequency: number) => {
    if (!soundOn) return
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.frequency.value = frequency
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.15)
    } catch {}
  }, [soundOn])

  // GPS Watch
  const startWatch = useCallback(() => {
    if (watching) return
    setWatching(true)
    if (!('geolocation' in navigator)) {
      setWatching(false)
      return
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { easting, northing } = await transformToUTM(pos.coords.latitude, pos.coords.longitude)
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          easting,
          northing,
        })
        const dE = targetE - easting
        const dN = targetN - northing
        const dist = Math.sqrt(dE * dE + dN * dN)
        let brg = Math.atan2(dE, dN) * 180 / Math.PI
        if (brg < 0) brg += 360

        setDistance(dist)
        setBearing(brg)

        if (soundOn && dist < 10) {
          const now = Date.now()
          const interval = dist < 0.5 ? 200 : dist < 2 ? 500 : 1000
          if (now - lastBeepRef.current > interval) {
            lastBeepRef.current = now
            playBeep(dist < 0.5 ? 880 : dist < 2 ? 660 : 440)
          }
        }
        if (dist < 1 && 'vibrate' in navigator) {
          navigator.vibrate(100)
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 }
    )
  }, [watching, targetE, targetN, transformToUTM, soundOn, playBeep])

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setWatching(false)
  }, [])

  useEffect(() => {
    startWatch()
    return () => stopWatch()
  }, [startWatch, stopWatch])

  // --- AR Camera & Compass Integration ---
  
  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    let heading = null
    if (typeof e.webkitCompassHeading === 'number') {
      // iOS
      heading = e.webkitCompassHeading
    } else if (e.alpha !== null) {
      // Android
      // Note: DeviceOrientationEvent uses alpha = 0 for North (if absolute) in some specs, 
      // but commonly compass heading is 360 - alpha.
      heading = 360 - e.alpha
      if (heading === 360) heading = 0
    }
    if (heading !== null) {
      setCompassHeading(heading)
    }
  }, [])

  const startAR = async () => {
    setCameraError(null)
    
    // 1. Camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      setCameraError('Camera access denied or unavailable.')
      return
    }

    // 2. Compass
    try {
      const DeviceOrientationEventCtor = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<'granted' | 'denied'>
      }
      if (typeof DeviceOrientationEventCtor.requestPermission === 'function') {
        const permissionState = await DeviceOrientationEventCtor.requestPermission()
        if (permissionState === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation, true)
        } else {
          setCameraError('Compass access denied.')
        }
      } else {
        window.addEventListener('deviceorientationabsolute', handleOrientation, true)
        // Fallback for non-absolute browsers
        window.addEventListener('deviceorientation', handleOrientation, true)
      }
    } catch (err) {
      setCameraError('Compass not supported on this device.')
    }
  }

  const stopAR = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    window.removeEventListener('deviceorientationabsolute', handleOrientation, true)
    window.removeEventListener('deviceorientation', handleOrientation, true)
  }, [handleOrientation])

  const toggleViewMode = () => {
    if (viewMode === 'radar') {
      setViewMode('ar')
      startAR()
    } else {
      setViewMode('radar')
      stopAR()
    }
  }

  // Cleanup AR on unmount
  useEffect(() => {
    return () => {
      stopAR()
    }
  }, [handleOrientation, stopAR])

  // --- Rendering ---
  
  const getColor = (dist: number | null) => {
    if (dist == null) return { ring: '#6b7280', text: 'text-gray-400', bg: 'bg-gray-500/10' }
    if (dist < 0.1) return { ring: '#10b981', text: 'text-emerald-400', bg: 'bg-emerald-500/10' }
    if (dist < 0.5) return { ring: '#10b981', text: 'text-emerald-400', bg: 'bg-emerald-500/10' }
    if (dist < 2) return { ring: '#84cc16', text: 'text-lime-400', bg: 'bg-lime-500/10' }
    if (dist < 5) return { ring: '#eab308', text: 'text-amber-400', bg: 'bg-amber-500/10' }
    if (dist < 15) return { ring: '#f97316', text: 'text-orange-400', bg: 'bg-orange-500/10' }
    return { ring: '#ef4444', text: 'text-red-400', bg: 'bg-red-500/10' }
  }

  const colors = getColor(distance)
  const isOnTarget = distance != null && distance < 0.5

  const formatBearing = (brg: number) => {
    const deg = Math.floor(brg)
    const minFull = (brg - deg) * 60
    const min = Math.floor(minFull)
    const sec = (minFull - min) * 60
    return `${deg}°${min}'${sec.toFixed(0)}"`
  }

  // Calculate AR target X position (-50vw to +50vw)
  // Assuming 60 degrees horizontal field of view
  let arTargetLeft = '50%'
  let arTargetVisible = false
  if (bearing != null && compassHeading != null) {
    let diff = bearing - compassHeading
    if (diff > 180) diff -= 360
    if (diff < -180) diff += 360
    
    if (Math.abs(diff) < 90) {
      arTargetVisible = true
      // Linear mapping: 30 degrees = 50vw offset
      const offsetVw = (diff / 30) * 50
      arTargetLeft = `calc(50% + ${offsetVw}vw)`
    }
  }

  // Scale target marker by distance (closer = bigger)
  let arScale = 1
  if (distance != null && distance > 0) {
    arScale = Math.max(0.2, Math.min(2.0, 10 / distance))
  }

  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 overflow-hidden ${viewMode === 'radar' ? 'bg-[#0a0a0f]' : 'bg-black'}`}>
      
      {/* AR Video Background */}
      {viewMode === 'ar' && (
        <div className="absolute inset-0 overflow-hidden">
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-8 text-center text-red-400">
              {cameraError}
            </div>
          )}
        </div>
      )}

      {/* AR Target Marker */}
      {viewMode === 'ar' && !cameraError && (
        <div className="absolute inset-0 pointer-events-none">
          {arTargetVisible ? (
            <div 
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-75 ease-linear"
              style={{ 
                left: arTargetLeft, 
                transform: `translate(-50%, -50%) scale(${arScale})` 
              }}
            >
              <div className="flex flex-col items-center drop-shadow-xl">
                <Target className="w-16 h-16 transition-colors duration-300 animate-pulse" style={{ color: colors.ring }} />
                <div className="mt-2 px-3 py-1 rounded bg-black/60 backdrop-blur text-white font-mono text-xl font-bold border border-white/20">
                  {distance?.toFixed(2)}m
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/50 bg-black/40 px-4 py-2 rounded-full backdrop-blur-md">
              Turn towards target...
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          <Target className="w-4 h-4 text-[#D17B47]" />
          <span className="text-sm font-semibold text-white">
            {viewMode === 'radar' ? 'Stakeout Radar' : 'AR Stakeout'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <button
            onClick={toggleViewMode}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-gray-300 hover:text-white transition-all hover:bg-white/10"
            title={viewMode === 'radar' ? 'Switch to AR Camera' : 'Switch to 2D Radar'}
          >
            {viewMode === 'radar' ? <Camera className="w-4 h-4" /> : <Compass className="w-4 h-4" />}
          </button>
          
          <button
            onClick={() => setSoundOn(!soundOn)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-gray-300 hover:text-white transition-all hover:bg-white/10"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/20 backdrop-blur-md border border-red-500/30 text-red-400 hover:bg-red-500/40 hover:text-red-300 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 2D Radar display */}
      {viewMode === 'radar' && (
        <div className="relative w-72 h-72 mb-8 z-10">
          <div className="absolute inset-0 rounded-full border-2 transition-colors duration-300" style={{ borderColor: colors.ring, opacity: 0.3 }} />
          <div className="absolute inset-8 rounded-full border transition-colors duration-300" style={{ borderColor: colors.ring, opacity: 0.2 }} />
          <div className="absolute inset-16 rounded-full border transition-colors duration-300" style={{ borderColor: colors.ring, opacity: 0.4 }} />
          <div className="absolute top-1/2 left-0 right-0 h-px" style={{ backgroundColor: colors.ring, opacity: 0.2 }} />
          <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ backgroundColor: colors.ring, opacity: 0.2 }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className={`w-4 h-4 rounded-full ${isOnTarget ? 'animate-ping' : ''}`} style={{ backgroundColor: colors.ring }} />
          </div>
          {bearing != null && (
            <div className="absolute top-1/2 left-1/2 origin-bottom" style={{ transform: `translate(-50%, -100%) rotate(${bearing}deg)`, height: '50%' }}>
              <div className="flex flex-col items-center">
                <Navigation className="w-8 h-8 transition-colors duration-300" style={{ color: colors.ring }} fill="currentColor" />
              </div>
            </div>
          )}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-500">N</div>
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-gray-500">S</div>
          <div className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500">W</div>
          <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500">E</div>
        </div>
      )}

      {/* Distance display (bottom center) */}
      <div className={`absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center z-10 ${viewMode === 'ar' ? 'bg-black/40 backdrop-blur-xl px-8 py-4 rounded-3xl border border-white/10' : ''}`}>
        <div className={`text-6xl font-bold font-mono ${colors.text} transition-colors duration-300`}>
          {distance != null ? distance.toFixed(2) : '—'}
        </div>
        <div className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-semibold">Meters to target</div>
        
        {bearing != null && (
          <div className="flex items-center gap-2 mt-4 text-gray-300 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
            <Crosshair className="w-4 h-4 opacity-50" />
            <span className="text-sm font-mono">Bearing: {formatBearing(bearing)}</span>
            {compassHeading != null && (
              <span className="text-sm font-mono ml-2 border-l border-white/20 pl-3">HDG: {Math.round(compassHeading)}°</span>
            )}
          </div>
        )}

        <div className={`mt-4 px-4 py-2 rounded-xl ${colors.bg} border ${colors.text} border-current/20 backdrop-blur-md w-full`}>
          <p className="text-sm font-medium text-center">
            {isOnTarget ? 'ON TARGET — Dig here!' :
             distance == null ? 'Waiting for GPS...' :
             distance < 2 ? 'Almost there — slow down' :
             distance < 5 ? 'Getting close' :
             distance < 15 ? 'Approaching target' :
             'Follow the beacon'}
          </p>
        </div>
      </div>
    </div>
  )
}
