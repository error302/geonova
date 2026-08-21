'use client'

/**
 * NeighborConsensusForm — Geofenced boundary sign-off
 *
 * Lets surveyors capture formal consensus from adjoining property owners:
 * - Neighbor name, National ID, phone, parcel number
 * - Signature on touchscreen canvas
 * - GPS geofence verification (must be within 5m of beacon)
 * - Cryptographic sealing of the consensus record
 *
 * The signature pad is locked until GPS verifies the surveyor is on-site.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  User, Phone, MapPin, PenTool, CheckCircle2, AlertTriangle,
  Loader2, Lock, ShieldCheck, X,
} from 'lucide-react'
import {
  createConsensusRecord,
  verifyGeofence,
  GEOFENCE_RADIUS_M,
  type NeighborConsensusRecord,
} from '@/lib/survey/neighborConsensus'

interface NeighborConsensusFormProps {
  beaconId: string
  beaconEasting: number
  beaconNorthing: number
  surveyorId: string
  surveyorLicense: string
  onConsensusCaptured?: (record: NeighborConsensusRecord) => void
  onClose?: () => void
  /** T1.5 FIX (2026-07-09): UTM EPSG for GPS→UTM transform (default 'EPSG:21037') */
  epsg?: string
}

export function NeighborConsensusForm({
  beaconId,
  beaconEasting,
  beaconNorthing,
  surveyorId,
  surveyorLicense,
  onConsensusCaptured,
  onClose,
  epsg = 'EPSG:21037',
}: NeighborConsensusFormProps) {
  const [neighborName, setNeighborName] = useState('')
  const [neighborNationalId, setNeighborNationalId] = useState('')
  const [neighborPhone, setNeighborPhone] = useState('')
  const [neighborParcelNumber, setNeighborParcelNumber] = useState('')

  // Geofence state
  const [currentPos, setCurrentPos] = useState<{ easting: number; northing: number } | null>(null)
  const [distanceFromBeacon, setDistanceFromBeacon] = useState<number | null>(null)
  const [geofenceValid, setGeofenceValid] = useState(false)
  const [checkingLocation, setCheckingLocation] = useState(false)

  // Signature state
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  // Saving state
  const [saving, setSaving] = useState(false)
  const [savedRecord, setSavedRecord] = useState<NeighborConsensusRecord | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check GPS location for geofence
  const checkLocation = useCallback(async () => {
    setCheckingLocation(true)
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported')
      setCheckingLocation(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { transform } = await import('ol/proj')
          const [e, n] = transform([pos.coords.longitude, pos.coords.latitude], 'EPSG:4326', epsg) as [number, number]
          const position = { easting: e, northing: n }
          setCurrentPos(position)

          const geofence = verifyGeofence(beaconEasting, beaconNorthing, e, n)
          setDistanceFromBeacon(geofence.distance)
          setGeofenceValid(geofence.isValid)
        } catch {
          setError('Failed to transform coordinates')
        }
        setCheckingLocation(false)
      },
      () => {
        setError('Failed to get GPS position')
        setCheckingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [beaconEasting, beaconNorthing, epsg])

  // Auto-check location on mount
  useEffect(() => {
    checkLocation()
  }, [checkLocation])

  // Signature pad handlers
  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!geofenceValid) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    setIsDrawing(true)
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    ctx.beginPath()
    ctx.moveTo(clientX - rect.left, clientY - rect.top)
  }, [geofenceValid])

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    ctx.lineTo(clientX - rect.left, clientY - rect.top)
    ctx.stroke()
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#000'
    setHasSignature(true)
  }, [isDrawing])

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
  }, [])

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }, [])

  // Save consensus
  const handleSave = useCallback(async () => {
    if (!geofenceValid) {
      setError('Must be within 5m of beacon to sign')
      return
    }
    if (!neighborName.trim() || !neighborNationalId.trim()) {
      setError('Neighbor name and National ID are required')
      return
    }
    if (!hasSignature) {
      setError('Signature is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const canvas = canvasRef.current
      const signatureData = canvas?.toDataURL('image/png') || ''

      const record = await createConsensusRecord({
        beaconId,
        beaconEasting,
        beaconNorthing,
        neighborName,
        neighborNationalId,
        neighborPhone,
        neighborParcelNumber,
        signatureData,
        signLocationEasting: currentPos?.easting || 0,
        signLocationNorthing: currentPos?.northing || 0,
        surveyorId,
        surveyorLicense,
      })

      setSavedRecord(record)
      onConsensusCaptured?.(record)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save consensus')
    } finally {
      setSaving(false)
    }
  }, [geofenceValid, neighborName, neighborNationalId, neighborPhone, neighborParcelNumber, hasSignature, beaconId, beaconEasting, beaconNorthing, currentPos, surveyorId, surveyorLicense, onConsensusCaptured])

  if (savedRecord) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-emerald-400">Consensus Captured</h3>
        <p className="text-[10px] text-gray-500 mt-1">
          {savedRecord.neighborName} signed at {new Date(savedRecord.signedAt).toLocaleString()}
        </p>
        <p className="text-[10px] text-gray-600 mt-2">
          Distance from beacon: {savedRecord.distanceFromBeacon.toFixed(2)}m ·
          Geofence: {savedRecord.isGeofenceValid ? 'VALID' : 'INVALID'} ·
          Sealed: {savedRecord.seal ? 'YES' : 'NO'}
        </p>
        {onClose && (
          <button onClick={onClose} className="mt-3 px-4 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium">
            Done
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">Boundary Consensus</span>
            <p className="text-[10px] text-gray-500">Geofenced sign-off for adjoining owner</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Geofence status */}
        <div className={`p-3 rounded-lg border ${
          geofenceValid ? 'bg-emerald-500/5 border-emerald-500/20' :
          distanceFromBeacon != null ? 'bg-red-500/5 border-red-500/20' :
          'bg-amber-500/5 border-amber-500/20'
        }`}>
          <div className="flex items-center gap-2">
            {checkingLocation ? (
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            ) : geofenceValid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className={`w-4 h-4 ${distanceFromBeacon != null ? 'text-red-400' : 'text-amber-400'}`} />
            )}
            <div>
              <span className={`text-xs font-medium ${
                geofenceValid ? 'text-emerald-400' :
                distanceFromBeacon != null ? 'text-red-400' : 'text-amber-400'
              }`}>
                {checkingLocation ? 'Checking location...' :
                 geofenceValid ? 'On-site — sign-off enabled' :
                 distanceFromBeacon != null ? `${distanceFromBeacon.toFixed(1)}m from beacon (must be <${GEOFENCE_RADIUS_M}m)` :
                 'Waiting for GPS...'}
              </span>
            </div>
          </div>
          <button
            onClick={checkLocation}
            className="mt-2 text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1"
          >
            <MapPin className="w-3 h-3" />
            Re-check location
          </button>
        </div>

        {/* Neighbor info */}
        <div className="space-y-2">
          <div>
            <label className="flex items-center gap-1 text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="neighbor-name">
              <User className="w-3 h-3" />
              Neighbor Name *
            </label>
            <input id="neighbor-name"
              type="text"
              value={neighborName}
              onChange={e => setNeighborName(e.target.value)}
              placeholder="John Doe"
              className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] placeholder-gray-600 focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="national-id">National ID *</label>
              <input id="national-id"
                type="text"
                value={neighborNationalId}
                onChange={e => setNeighborNationalId(e.target.value)}
                placeholder="12345678"
                className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] font-mono placeholder-gray-600 focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="phone">
                <Phone className="w-3 h-3" />
                Phone
              </label>
              <input id="phone"
                type="tel"
                value={neighborPhone}
                onChange={e => setNeighborPhone(e.target.value)}
                placeholder="0712 345 678"
                className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] font-mono placeholder-gray-600 focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="neighbor-parcel-no">Neighbor Parcel No.</label>
            <input id="neighbor-parcel-no"
              type="text"
              value={neighborParcelNumber}
              onChange={e => setNeighborParcelNumber(e.target.value)}
              placeholder="LR/12345/679"
              className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] font-mono placeholder-gray-600 focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none"
            />
          </div>
        </div>

        {/* Signature pad */}
        <div>
          <div className="flex items-center gap-1 text-[9px] text-gray-500 uppercase tracking-wider mb-1">
            <PenTool className="w-3 h-3" />
            Signature *
          </div>
          <div className={`relative ${!geofenceValid ? 'opacity-40 pointer-events-none' : ''}`}>
            <canvas
              ref={canvasRef}
              width={300}
              height={120}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-[120px] bg-white rounded-lg border border-[var(--border-color)] cursor-crosshair touch-none"
            />
            {!geofenceValid && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <Lock className="w-3 h-3" />
                  Move within {GEOFENCE_RADIUS_M}m of beacon to unlock
                </div>
              </div>
            )}
          </div>
          {hasSignature && geofenceValid && (
            <button
              onClick={clearSignature}
              className="mt-1 text-[9px] text-gray-500 hover:text-red-400"
            >
              Clear signature
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-400">{error}</p>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!geofenceValid || saving || !neighborName || !neighborNationalId || !hasSignature}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:bg-[var(--accent-dim)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {saving ? 'Sealing...' : 'Capture & Seal Consensus'}
        </button>
      </div>
    </div>
  )
}
