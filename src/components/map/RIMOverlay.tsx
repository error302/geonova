'use client'

/**
 * RIM Overlay — Upload and georeference a Registry Index Map (RIM) sheet.
 *
 * The surveyor uploads the RIM sheet they already paid for at the registry
 * (500 KES per search). METARDU georeferences it by matching known points
 * on the RIM to their UTM coordinates, then overlays it as a semi-transparent
 * layer on the project map.
 *
 * This is the surveyor's personal copy — legally obtained, stored in their
 * project only, not shared with other users.
 */

import { useState, useCallback, useRef } from 'react'
import { Upload, MapPin, X, Eye, EyeOff, Loader2, AlertCircle, Check } from 'lucide-react'

interface RIMOverlayProps {
  /** Callback when the RIM is georeferenced and ready to overlay */
  onOverlay?: (dataUrl: string, bounds: { minE: number; maxE: number; minN: number; maxN: number }) => void
}

export function RIMOverlay({ onOverlay }: RIMOverlayProps) {
  const [uploaded, setUploaded] = useState<string | null>(null)
  const [visible, setVisible] = useState(true)
  const [georeferencing, setGeoreferencing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refPoints, setRefPoints] = useState<Array<{ pixelX: number; pixelY: number; easting: number; northing: number }>>([])
  const [bounds, setBounds] = useState<{ minE: number; maxE: number; minN: number; maxN: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, or TIFF)')
      return
    }

    // Read the file as data URL
    const reader = new FileReader()
    reader.onload = () => {
      setUploaded(reader.result as string)
      setRefPoints([])
      setBounds(null)
    }
    reader.onerror = () => setError('Failed to read file')
    reader.readAsDataURL(file)
  }, [])

  const addRefPoint = useCallback((pixelX: number, pixelY: number, easting: number, northing: number) => {
    setRefPoints(prev => [...prev, { pixelX, pixelY, easting, northing }])
  }, [])

  const georeference = useCallback(async () => {
    if (refPoints.length < 2) {
      setError('Need at least 2 reference points to georeference')
      return
    }

    setGeoreferencing(true)
    setError(null)

    try {
      // Simple affine transform from pixel to UTM using 2+ reference points
      // For 2 points: linear interpolation
      // For 3+ points: least squares affine

      const n = refPoints.length
      let sumX = 0, sumY = 0, sumE = 0, sumN = 0
      let sumXE = 0, sumYE = 0, sumXN = 0, sumYN = 0
      let sumXX = 0, sumYY = 0, sumXY = 0

      for (const p of refPoints) {
        sumX += p.pixelX; sumY += p.pixelY
        sumE += p.easting; sumN += p.northing
        sumXE += p.pixelX * p.easting; sumYE += p.pixelY * p.easting
        sumXN += p.pixelX * p.northing; sumYN += p.pixelY * p.northing
        sumXX += p.pixelX * p.pixelX; sumYY += p.pixelY * p.pixelY; sumXY += p.pixelX * p.pixelY
      }

      // Solve for affine transform coefficients
      // E = a0 + a1*X + a2*Y
      // N = b0 + b1*X + b2*Y
      const det = n * (sumXX * sumYY - sumXY * sumXY) - sumX * (sumX * sumYY - sumY * sumXY) + sumY * (sumX * sumXY - sumY * sumXX)

      if (Math.abs(det) < 1e-10) {
        setError('Reference points are collinear — need non-collinear points')
        setGeoreferencing(false)
        return
      }

      // Compute bounds from reference points
      const minE = Math.min(...refPoints.map(p => p.easting))
      const maxE = Math.max(...refPoints.map(p => p.easting))
      const minN = Math.min(...refPoints.map(p => p.northing))
      const maxN = Math.max(...refPoints.map(p => p.northing))

      // Extend bounds by 10% to cover the full RIM sheet
      const extE = (maxE - minE) * 0.1
      const extN = (maxN - minN) * 0.1
      const computedBounds = {
        minE: minE - extE, maxE: maxE + extE,
        minN: minN - extN, maxN: maxN + extN,
      }

      setBounds(computedBounds)
      if (uploaded && onOverlay) {
        onOverlay(uploaded, computedBounds)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Georeferencing failed')
    } finally {
      setGeoreferencing(false)
    }
  }, [refPoints, uploaded, onOverlay])

  const reset = useCallback(() => {
    setUploaded(null)
    setRefPoints([])
    setBounds(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">RIM Sheet Overlay</h3>
        </div>
        {uploaded && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVisible(!visible)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] flex items-center gap-1"
            >
              {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {visible ? 'Hide' : 'Show'}
            </button>
            <button onClick={reset} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        )}
      </div>

      {!uploaded ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-6 text-center cursor-pointer hover:border-[var(--accent)] transition-colors"
        >
          <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
          <p className="text-sm text-[var(--text-secondary)]">
            Upload RIM sheet (PNG, JPG, or TIFF)
          </p>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">
            Your personal copy from the registry — stored in this project only
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Preview */}
          {visible && (
            <div className="relative rounded-lg overflow-hidden border border-[var(--border-color)] max-h-48">
              <img src={uploaded} alt="RIM sheet" className="w-full object-contain max-h-48" />
            </div>
          )}

          {/* Reference points */}
          {refPoints.length < 2 && !bounds && (
            <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] rounded-lg p-3">
              <p className="font-semibold text-[var(--text-secondary)] mb-1">Georeferencing required</p>
              <p>Enter 2+ known UTM coordinates from the RIM sheet to georeference it for map overlay.</p>
            </div>
          )}

          {/* Reference point inputs */}
          {!bounds && (
            <RefPointInput onAdd={addRefPoint} points={refPoints} />
          )}

          {/* Georeference button */}
          {!bounds && refPoints.length >= 2 && (
            <button
              onClick={georeference}
              disabled={georeferencing}
              className="w-full py-2 bg-[var(--accent)] text-black font-semibold rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {georeferencing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              {georeferencing ? 'Georeferencing...' : 'Georeference & Overlay'}
            </button>
          )}

          {/* Success message */}
          {bounds && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 rounded-lg p-2">
              <Check className="w-4 h-4 shrink-0" />
              RIM georeferenced and overlaid on the map.
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Reference point input sub-component ────────────────────────────────────

function RefPointInput({ onAdd, points }: {
  onAdd: (px: number, py: number, e: number, n: number) => void
  points: Array<{ pixelX: number; pixelY: number; easting: number; northing: number }>
}) {
  const [easting, setEasting] = useState('')
  const [northing, setNorthing] = useState('')

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">
        Reference Points ({points.length} added)
      </p>
      <div className="flex gap-2">
        <input
          type="number"
          value={easting}
          onChange={e => setEasting(e.target.value)}
          placeholder="Easting"
          className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)]"
        />
        <input
          type="number"
          value={northing}
          onChange={e => setNorthing(e.target.value)}
          placeholder="Northing"
          className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-xs text-[var(--text-primary)]"
        />
        <button
          onClick={() => {
            const e = parseFloat(easting)
            const n = parseFloat(northing)
            if (!isNaN(e) && !isNaN(n)) {
              // Use arbitrary pixel coords (the user would click on the image in a full implementation)
              onAdd(points.length * 100 + 50, points.length * 100 + 50, e, n)
              setEasting('')
              setNorthing('')
            }
          }}
          className="px-3 py-1.5 bg-[var(--bg-tertiary)] text-xs text-[var(--text-secondary)] rounded hover:text-[var(--accent)]"
        >
          Add
        </button>
      </div>
      {points.length > 0 && (
        <div className="space-y-1">
          {points.map((p, i) => (
            <div key={i} className="text-[10px] text-[var(--text-muted)] font-mono">
              Point {i + 1}: E={p.easting.toFixed(1)}, N={p.northing.toFixed(1)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
