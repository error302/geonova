'use client'

/**
 * MobileMeasurementCapture — Take survey readings directly on mobile
 *
 * Allows surveyors to capture field measurements on their phone with:
 * - GPS position capture (one-tap to record current location)
 * - Manual bearing/distance entry with Kenya DDD.MMSS format
 * - Face Left / Face Right angle entry with mean computation
 * - Quick-add presets for common observation types
 * - GPS accuracy guardrail integration
 * - Photo attachment for beacons
 * - Voice-to-text remarks (uses Web Speech API if available)
 */

import { useState, useCallback, useRef } from 'react'
import {
  Crosshair, MapPin, Camera, Mic, MicOff,
  Check, X, Navigation, Ruler, Triangle,
} from 'lucide-react'
import { GPSGuardrail, type AccuracyLevel, type GPSReading } from '@/components/survey/GPSGuardrail'
import { CoordinateChip } from '@/components/survey/CoordinateChip'

export interface CapturedMeasurement {
  id: string
  type: 'gps' | 'bearing-distance' | 'angle' | 'offset'
  timestamp: number
  lat?: number
  lng?: number
  elevation?: number
  accuracy?: number
  bearing?: number
  distance?: number
  faceLeft?: number
  faceRight?: number
  meanAngle?: number
  offsetE?: number
  offsetN?: number
  station?: string
  target?: string
  remarks?: string
  photos?: string[]
}

interface MobileMeasurementCaptureProps {
  onCapture: (measurement: CapturedMeasurement) => void
  stationName?: string
  surveyType: 'leveling' | 'traverse' | 'control'
}

type CaptureMode = 'gps' | 'bearing-distance' | 'angle' | 'offset'

const MODE_CONFIG: Record<CaptureMode, { label: string; icon: typeof Crosshair; color: string }> = {
  gps: { label: 'GPS Point', icon: MapPin, color: 'text-emerald-400' },
  'bearing-distance': { label: 'Bearing + Dist', icon: Navigation, color: 'text-blue-400' },
  angle: { label: 'Angle Obs', icon: Triangle, color: 'text-purple-400' },
  offset: { label: 'Offset', icon: Ruler, color: 'text-amber-400' },
}

interface SpeechRecognitionHandle {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

export function MobileMeasurementCapture({ onCapture, stationName, surveyType }: MobileMeasurementCaptureProps) {
  const [mode, setMode] = useState<CaptureMode>('gps')
  const [gpsReading, setGpsReading] = useState<GPSReading | null>(null)
  const [accuracyLevel, setAccuracyLevel] = useState<AccuracyLevel>('unknown')
  const [showForm, setShowForm] = useState(false)

  const [station, setStation] = useState(stationName || '')
  const [target, setTarget] = useState('')
  const [bearingDeg, setBearingDeg] = useState('')
  const [bearingMin, setBearingMin] = useState('')
  const [bearingSec, setBearingSec] = useState('')
  const [distance, setDistance] = useState('')
  const [faceLeft, setFaceLeft] = useState('')
  const [faceRight, setFaceRight] = useState('')
  const [offsetE, setOffsetE] = useState('')
  const [offsetN, setOffsetN] = useState('')
  const [remarks, setRemarks] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionHandle | null>(null)

  const handleCaptureGPS = useCallback(() => {
    if (!gpsReading) { alert('Waiting for GPS signal...'); return }
    if (accuracyLevel === 'low') { if (!confirm('GPS accuracy is low (>10m). Capture anyway?')) return }
    onCapture({
      id: crypto.randomUUID(), type: 'gps', timestamp: Date.now(),
      lat: gpsReading.lat, lng: gpsReading.lng, elevation: gpsReading.altitude ?? undefined,
      accuracy: gpsReading.accuracy, station: station || 'GPS Point', remarks, photos,
    })
    resetForm(); setShowForm(false)
  }, [gpsReading, accuracyLevel, station, remarks, photos, onCapture])

  const handleCaptureBearingDistance = useCallback(() => {
    const deg = parseFloat(bearingDeg) || 0
    const min = parseFloat(bearingMin) || 0
    const sec = parseFloat(bearingSec) || 0
    const bearing = deg + min / 60 + sec / 3600
    const dist = parseFloat(distance)
    if (!isFinite(dist) || dist <= 0) { alert('Enter a valid distance'); return }
    onCapture({
      id: crypto.randomUUID(), type: 'bearing-distance', timestamp: Date.now(),
      bearing, distance: dist, station: station || 'Setup', target: target || 'Target', remarks, photos,
    })
    resetForm(); setShowForm(false)
  }, [bearingDeg, bearingMin, bearingSec, distance, station, target, remarks, photos, onCapture])

  const handleCaptureAngle = useCallback(() => {
    const fl = parseFloat(faceLeft)
    const fr = parseFloat(faceRight)
    if (!isFinite(fl) || !isFinite(fr)) { alert('Enter both Face Left and Face Right readings'); return }
    let mean = (fl + (fr + 180) % 360) / 2
    if (mean < 0) mean += 360
    if (mean >= 360) mean -= 360
    onCapture({
      id: crypto.randomUUID(), type: 'angle', timestamp: Date.now(),
      faceLeft: fl, faceRight: fr, meanAngle: mean,
      station: station || 'Setup', target: target || 'Target', remarks, photos,
    })
    resetForm(); setShowForm(false)
  }, [faceLeft, faceRight, station, target, remarks, photos, onCapture])

  const handleCaptureOffset = useCallback(() => {
    const e = parseFloat(offsetE)
    const n = parseFloat(offsetN)
    if (!isFinite(e) || !isFinite(n)) { alert('Enter valid offset values'); return }
    onCapture({
      id: crypto.randomUUID(), type: 'offset', timestamp: Date.now(),
      offsetE: e, offsetN: n, station: station || 'Base', target: target || 'Offset Point', remarks, photos,
    })
    resetForm(); setShowForm(false)
  }, [offsetE, offsetN, station, target, remarks, photos, onCapture])

  const resetForm = useCallback(() => {
    setTarget(''); setBearingDeg(''); setBearingMin(''); setBearingSec('')
    setDistance(''); setFaceLeft(''); setFaceRight(''); setOffsetE(''); setOffsetN('')
    setRemarks(''); setPhotos([])
  }, [])

  const toggleVoiceInput = useCallback(() => {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { alert('Voice input not supported. Use Chrome or Edge.'); return }
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setRemarks(prev => prev + (prev ? ' ' : '') + transcript)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start()
    recognitionRef.current = recognition
    setListening(true)
  }, [listening])

  const handlePhotoCapture = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => setPhotos(prev => [...prev, reader.result as string])
      reader.readAsDataURL(file)
    }
    input.click()
  }, [])

  const handleAccuracyChange = useCallback((level: AccuracyLevel, reading: GPSReading | null) => {
    setAccuracyLevel(level); setGpsReading(reading)
  }, [])

  const handleSubmit = () => {
    switch (mode) {
      case 'gps': handleCaptureGPS(); break
      case 'bearing-distance': handleCaptureBearingDistance(); break
      case 'angle': handleCaptureAngle(); break
      case 'offset': handleCaptureOffset(); break
    }
  }

  const availableModes: CaptureMode[] = surveyType === 'leveling'
    ? ['bearing-distance', 'angle', 'offset']
    : ['gps', 'bearing-distance', 'angle', 'offset']

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="bg-[#0d0d14]/95 backdrop-blur-xl border-t border-white/[0.06] px-3 py-2 flex items-center justify-between gap-2">
        <GPSGuardrail compact onAccuracyChange={handleAccuracyChange} />
        <span className="text-[10px] text-gray-500 truncate">{station ? `Stn: ${station}` : 'No station set'}</span>
      </div>

      {!showForm && (
        <div className="bg-[#0d0d14]/95 backdrop-blur-xl border-t border-white/[0.06] px-3 py-3">
          <div className="grid grid-cols-4 gap-2">
            {availableModes.map(m => {
              const cfg = MODE_CONFIG[m]
              const Icon = cfg.icon
              return (
                <button
                  key={m}
                  onClick={() => { setMode(m); setShowForm(true) }}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all min-h-[48px] ${
                    mode === m ? 'bg-[#D17B47]/10 border-[#D17B47]/30 text-[#D17B47]' : 'bg-white/[0.02] border-white/[0.06] text-gray-400 hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[9px] font-medium leading-tight text-center">{cfg.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-[#0d0d14]/98 backdrop-blur-2xl border-t border-white/[0.06] rounded-t-2xl max-h-[75vh] overflow-y-auto">
          <div className="sticky top-0 bg-[#0d0d14]/98 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(() => { const Icon = MODE_CONFIG[mode].icon; return <Icon className={`w-4 h-4 ${MODE_CONFIG[mode].color}`} /> })()}
              <span className="text-sm font-medium text-white">{MODE_CONFIG[mode].label}</span>
            </div>
            <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="mmc-station" className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Station</label>
                <input id="mmc-station" type="text" value={station} onChange={e => setStation(e.target.value)} placeholder="A" className="w-full h-11 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white placeholder-gray-600 focus:border-[#D17B47]/30 focus:outline-none" />
              </div>
              <div>
                <label htmlFor="mmc-target" className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Target</label>
                <input id="mmc-target" type="text" value={target} onChange={e => setTarget(e.target.value)} placeholder="B" className="w-full h-11 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white placeholder-gray-600 focus:border-[#D17B47]/30 focus:outline-none" />
              </div>
            </div>

            {mode === 'gps' && (
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <GPSGuardrail onAccuracyChange={handleAccuracyChange} showCoords />
                {gpsReading && (
                  <CoordinateChip
                    lat={gpsReading.lat}
                    lng={gpsReading.lng}
                    accuracy={gpsReading.accuracy}
                    label="Captured Point (RTK)"
                    compact
                  />
                )}
                <p className="text-[11px] text-gray-500">Tap "Capture" to record the current GPS position as a survey point.</p>
              </div>
            )}

            {mode === 'bearing-distance' && (
              <>
                <div>
                  <div className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Bearing (DDD.MMSS format)</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="relative">
                      <input type="number" value={bearingDeg} onChange={e => setBearingDeg(e.target.value)} aria-label="Bearing degrees" placeholder="45" className="w-full h-11 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white font-mono placeholder-gray-600 focus:border-[#D17B47]/30 focus:outline-none" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-600">DEG</span>
                    </div>
                    <div className="relative">
                      <input type="number" value={bearingMin} onChange={e => setBearingMin(e.target.value)} aria-label="Bearing minutes" placeholder="30" className="w-full h-11 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white font-mono placeholder-gray-600 focus:border-[#D17B47]/30 focus:outline-none" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-600">MIN</span>
                    </div>
                    <div className="relative">
                      <input type="number" value={bearingSec} onChange={e => setBearingSec(e.target.value)} aria-label="Bearing seconds" placeholder="15" className="w-full h-11 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white font-mono placeholder-gray-600 focus:border-[#D17B47]/30 focus:outline-none" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-600">SEC</span>
                    </div>
                  </div>
                  {bearingDeg && <p className="text-[10px] text-blue-400 mt-1 font-mono">= {((parseFloat(bearingDeg) || 0) + (parseFloat(bearingMin) || 0) / 60 + (parseFloat(bearingSec) || 0) / 3600).toFixed(6)}°</p>}
                </div>
                <div>
                  <label htmlFor="mmc-slope-distance" className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Slope Distance (m)</label>
                  <input id="mmc-slope-distance" type="number" step="0.001" value={distance} onChange={e => setDistance(e.target.value)} placeholder="125.456" className="w-full h-11 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white font-mono placeholder-gray-600 focus:border-[#D17B47]/30 focus:outline-none" />
                </div>
              </>
            )}

            {mode === 'angle' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="mmc-face-left" className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Face Left (°)</label>
                  <input id="mmc-face-left" type="number" step="0.0001" value={faceLeft} onChange={e => setFaceLeft(e.target.value)} placeholder="45.3015" className="w-full h-11 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white font-mono placeholder-gray-600 focus:border-[#D17B47]/30 focus:outline-none" />
                </div>
                <div>
                  <label htmlFor="mmc-face-right" className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Face Right (°)</label>
                  <input id="mmc-face-right" type="number" step="0.0001" value={faceRight} onChange={e => setFaceRight(e.target.value)} placeholder="225.3020" className="w-full h-11 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white font-mono placeholder-gray-600 focus:border-[#D17B47]/30 focus:outline-none" />
                </div>
                {faceLeft && faceRight && (
                  <div className="col-span-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <p className="text-[10px] text-purple-400">Mean Angle:</p>
                    <p className="text-sm text-white font-mono">{(() => {
                      const fl = parseFloat(faceLeft) || 0
                      const fr = parseFloat(faceRight) || 0
                      let mean = (fl + (fr + 180) % 360) / 2
                      if (mean < 0) mean += 360
                      if (mean >= 360) mean -= 360
                      return mean.toFixed(6) + '°'
                    })()}</p>
                  </div>
                )}
              </div>
            )}

            {mode === 'offset' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="mmc-offset-e" className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Offset E (m)</label>
                  <input id="mmc-offset-e" type="number" step="0.001" value={offsetE} onChange={e => setOffsetE(e.target.value)} placeholder="0.000" className="w-full h-11 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white font-mono placeholder-gray-600 focus:border-[#D17B47]/30 focus:outline-none" />
                </div>
                <div>
                  <label htmlFor="mmc-offset-n" className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Offset N (m)</label>
                  <input id="mmc-offset-n" type="number" step="0.001" value={offsetN} onChange={e => setOffsetN(e.target.value)} placeholder="0.000" className="w-full h-11 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white font-mono placeholder-gray-600 focus:border-[#D17B47]/30 focus:outline-none" />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="mmc-remarks" className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Remarks</label>
              <div className="relative">
                <textarea id="mmc-remarks" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Add notes about this observation..." rows={2} className="w-full px-3 py-2 pr-12 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white placeholder-gray-600 focus:border-[#D17B47]/30 focus:outline-none resize-none" />
                <button onClick={toggleVoiceInput} className={`absolute right-2 top-2 w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${listening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-white/[0.06] text-gray-400 hover:text-white'}`} title={listening ? 'Stop voice input' : 'Start voice input'}>
                  {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {photos.map((photo, i) => (
                  <div key={`${photo}-${i}`} className="relative shrink-0">
                    <img src={photo} alt={`Captured sighting ${i + 1}`} className="w-16 h-16 rounded-lg object-cover" />
                    <button onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={handlePhotoCapture} className="flex items-center justify-center gap-1.5 px-4 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-gray-300 hover:bg-white/[0.06] min-w-[48px]">
                <Camera className="w-4 h-4" /><span className="hidden sm:inline">Photo</span>
              </button>
              <button onClick={handleSubmit} disabled={mode === 'gps' && accuracyLevel === 'low'} className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-[#D17B47] hover:bg-[#FFB84D] text-black font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Check className="w-4 h-4" />Capture Reading
              </button>
            </div>

            {mode === 'gps' && accuracyLevel === 'low' && (
              <p className="text-[10px] text-red-400 text-center">GPS accuracy too low. Wait for better signal or switch to manual entry.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
