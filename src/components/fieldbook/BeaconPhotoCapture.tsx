'use client';

/**
 * BeaconPhotoCapture
 * ────────────────────────────────────────────────────────────────────────────
 * Photo capture widget for field observations. Records a beacon / site
 * photo and extracts EXIF GPS data immediately so the surveyor can:
 *   • see the captured location on a map chip
 *   • embed the GPS coords into the row's remarks / metadata
 *   • keep an immutable evidence chain for cadastral / legal work
 *
 * Uses the existing /lib/engineering/exifPhoto.ts parser (zero deps).
 */

import { useState, useRef, useCallback } from 'react'
import { Camera, X, MapPin, Loader2, CheckCircle2, AlertTriangle, ImageOff } from 'lucide-react'
import { extractEXIFGPS, isEXIFSupported, type EXIFGPSData } from '@/lib/engineering/exifPhoto'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { logger } from '@/lib/logger'

export interface CapturedBeaconPhoto {
  /** object URL for preview — revoke on unmount */
  previewUrl: string
  file: File
  exif: EXIFGPSData | null
  /** True if EXIF parsing ran but found no GPS tag */
  missingGps: boolean
  caption: string
}

interface BeaconPhotoCaptureProps {
  photos: CapturedBeaconPhoto[]
  onChange: (photos: CapturedBeaconPhoto[]) => void
  maxPhotos?: number
}

export function BeaconPhotoCapture({ photos, onChange, maxPhotos = 4 }: BeaconPhotoCaptureProps) {
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const exifSupported = isEXIFSupported()

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      if (photos.length >= maxPhotos) {
        setError(t('photoCapture.maxPhotosReached', { count: maxPhotos }))
        return
      }
      setError(null)
      setBusy(true)

      const remaining = maxPhotos - photos.length
      const toProcess = Array.from(files).slice(0, remaining)
      const additions: CapturedBeaconPhoto[] = []

      for (const file of toProcess) {
        // Basic type guard — only JPEG / HEIC / PNG
        if (!/^image\/(jpeg|png|heic|heif)$/i.test(file.type) && !/\.(jpe?g|heic|heif|png)$/i.test(file.name)) {
          setError(t('photoCapture.unsupportedFormat', { name: file.name }))
          continue
        }

        try {
          let exif: EXIFGPSData | null = null
          let missingGps = false
          try {
            exif = await extractEXIFGPS(file)
            if (!exif) missingGps = true
          } catch (err) {
            logger.warn('EXIF parse failed for', { fileName: file.name, error: err })
            missingGps = true
          }

          additions.push({
            previewUrl: URL.createObjectURL(file),
            file,
            exif,
            missingGps,
            caption: '',
          })
        } catch (err) {
          logger.error('Photo capture failed:', { error: err })
          setError(t('photoCapture.captureFailed', { name: file.name }))
        }
      }

      if (additions.length > 0) {
        onChange([...photos, ...additions])
      }
      setBusy(false)
      // Reset input so the same file can be re-captured if needed
      if (inputRef.current) inputRef.current.value = ''
    },
    [photos, maxPhotos, onChange, t]
  )

  const removePhoto = (idx: number) => {
    const next = [...photos]
    const [removed] = next.splice(idx, 1)
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
    onChange(next)
  }

  const updateCaption = (idx: number, caption: string) => {
    const next = [...photos]
    next[idx] = { ...next[idx], caption }
    onChange(next)
  }

  const slotsLeft = maxPhotos - photos.length

  return (
    <div className="space-y-2">
      {/* Capture button */}
      {slotsLeft > 0 && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic,image/heif"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="w-full p-4 border-2 border-dashed border-[var(--border-color)] rounded-xl flex items-center justify-center gap-2 text-[var(--text-secondary)] hover:border-[color-mix(in_srgb,var(--accent)_50%,transparent)] hover:text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] transition active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">{t('photoCapture.processing')}</span>
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {t('photoCapture.captureButton')}
                </span>
              </>
            )}
          </button>
          {!exifSupported && (
            <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {t('photoCapture.exifNotSupported')}
            </p>
          )}
        </>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 px-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {/* Captured photos grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((photo, idx) => (
            <div
              key={`${photo}-${idx}`}
              className="relative rounded-lg overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt={photo.caption || `Beacon photo ${idx + 1}`}
                className="w-full h-24 object-cover"
              />

              {/* GPS badge */}
              <div className="absolute top-1.5 left-1.5">
                {photo.exif ? (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/90 text-white text-[9px] font-mono backdrop-blur-sm">
                    <MapPin className="w-2.5 h-2.5" />
                    {photo.exif.latitude.toFixed(5)}, {photo.exif.longitude.toFixed(5)}
                  </span>
                ) : photo.missingGps ? (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/90 text-black text-[9px] font-medium backdrop-blur-sm">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {t('photoCapture.noGPS')}
                  </span>
                ) : null}
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute top-1.5 right-1.5 grid place-items-center w-6 h-6 rounded-md bg-black/70 text-white hover:bg-red-500/80 transition"
                aria-label="Remove photo"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Caption */}
              <input aria-label="Caption"
                type="text"
                value={photo.caption}
                onChange={(e) => updateCaption(idx, e.target.value)}
                placeholder={t('photoCapture.captionPlaceholder')}
                className="w-full px-2 py-1.5 text-xs bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] border-t border-[var(--border-color)] focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {photos.length === 0 && !busy && (
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] px-1">
          <ImageOff className="w-3 h-3" />
          {t('photoCapture.emptyState', { count: maxPhotos })}
        </div>
      )}

      {/* GPS detail line */}
      {photos.length > 0 && photos.some((p) => p.exif) && (
        <div className="flex items-center gap-1 text-[10px] text-emerald-400 px-1">
          <CheckCircle2 className="w-3 h-3" />
          {t('photoCapture.gpsEvidence', { count: photos.filter((p) => p.exif).length })}
        </div>
      )}
    </div>
  )
}

/**
 * Free object URLs held by captured photos. Call on parent unmount
 * to avoid memory leaks.
 */
export function revokeCapturedPhotos(photos: CapturedBeaconPhoto[]) {
  for (const p of photos) {
    try {
      URL.revokeObjectURL(p.previewUrl)
    } catch {
      /* ignore */
    }
  }
}
