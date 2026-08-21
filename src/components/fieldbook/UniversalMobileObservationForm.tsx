'use client';

/**
 * UniversalMobileObservationForm
 * ------------------------------
 * A single bottom-sheet form that adapts its fields to whichever
 * FieldbookType is currently active on the /fieldbook page.
 *
 * Why this exists:
 *   The old QuickAddModal only supported polar observations
 *   (HA / VA / SD) and was therefore unusable for leveling,
 *   hydrographic, mining, etc.  Field surveyors on phones
 *   needed ONE quick-entry surface that works for every
 *   survey type METARDU supports.
 *
 *   Note: mining + hydrographic were removed in v1 scope narrowing.
 *   They live in the separate `metardu-industrial` repo. The mobile
 *   form now supports the big three mobile-relevant types: leveling,
 *   traverse, control.
 */

import { useState, useEffect, useMemo } from 'react'
import { X, Check, MapPin, Ruler, Compass, Bluetooth, RefreshCw } from 'lucide-react'
import { BeaconPhotoCapture, type CapturedBeaconPhoto } from './BeaconPhotoCapture'
import { VoiceDictationButton } from '@/components/shared/VoiceDictationButton'
import { logger } from '@/lib/logger'

export type MobileSurveyType = 'leveling' | 'traverse' | 'control'

interface FieldDef {
  key: string
  label: string
  placeholder?: string
  inputMode?: 'decimal' | 'numeric' | 'text'
  step?: string
  default?: string
  required?: boolean
  /** when true, uppercase + auto-advance on Enter */
  station?: boolean
}

const FIELD_SETS: Record<MobileSurveyType, FieldDef[]> = {
  leveling: [
    { key: 'station', label: 'Station / TP', placeholder: 'TP1', station: true, required: true },
    { key: 'bs', label: 'Backsight (BS)', placeholder: '1.245', inputMode: 'decimal', step: '0.001' },
    { key: 'is', label: 'Intermediate (IS)', placeholder: '1.502', inputMode: 'decimal', step: '0.001' },
    { key: 'fs', label: 'Foresight (FS)', placeholder: '0.873', inputMode: 'decimal', step: '0.001' },
    { key: 'remarks', label: 'Remarks', placeholder: 'Concrete BM, flush' },
  ],
  traverse: [
    { key: 'station', label: 'Station', placeholder: 'A1', station: true, required: true },
    { key: 'bearing', label: 'Bearing', placeholder: '45°30\'20"', inputMode: 'decimal' },
    { key: 'slopeDist', label: 'Slope Dist (m)', placeholder: '125.456', inputMode: 'decimal', step: '0.001', required: true },
    { key: 'vaDeg', label: 'Vert. Angle (°)', placeholder: '90.0000', inputMode: 'decimal', step: '0.0001' },
    { key: 'ih', label: 'HI (m)', placeholder: '1.500', inputMode: 'decimal', step: '0.001', default: '1.500' },
    { key: 'th', label: 'TH (m)', placeholder: '1.500', inputMode: 'decimal', step: '0.001', default: '1.500' },
    { key: 'remarks', label: 'Remarks', placeholder: 'Road centerline' },
  ],
  control: [
    { key: 'pointId', label: 'Point ID', placeholder: 'P1', station: true, required: true },
    { key: 'bearing', label: 'Bearing', placeholder: '120°15\'00"', inputMode: 'decimal' },
    { key: 'verticalAngle', label: 'Vert. Angle (°)', placeholder: '90.0000', inputMode: 'decimal', step: '0.0001' },
    { key: 'slopeDistance', label: 'Slope Dist (m)', placeholder: '85.234', inputMode: 'decimal', step: '0.001', required: true },
    { key: 'instrumentHeight', label: 'IH (m)', placeholder: '1.500', inputMode: 'decimal', step: '0.001', default: '1.500' },
    { key: 'targetHeight', label: 'TH (m)', placeholder: '1.500', inputMode: 'decimal', step: '0.001', default: '1.500' },
    { key: 'remarks', label: 'Remarks', placeholder: 'Wall corner beacon' },
  ],
}

const TYPE_META: Record<MobileSurveyType, { label: string; icon: typeof Compass; accent: string }> = {
  leveling:     { label: 'Leveling',     icon: Ruler,    accent: 'text-sky-400' },
  traverse:     { label: 'Traverse',     icon: Compass,  accent: 'text-amber-400' },
  control:      { label: 'Control',      icon: MapPin,   accent: 'text-emerald-400' },
}

export interface UniversalMobileObservationFormProps {
  surveyType: MobileSurveyType
  /** station context (for control / mining where station header exists) */
  stationName?: string
  /**
   * Called when the user saves a reading. Returns the row plus any
   * captured beacon photos with embedded EXIF GPS data.
   */
  onAdd: (row: Record<string, string>, photos: CapturedBeaconPhoto[]) => void
  onClose: () => void
  /** auto-increment last station name (e.g. P1 -> P2) */
  lastStation?: string
  /**
   * Optional instrument-read callback. When provided, a "Pull from
   * instrument" button appears that calls this and fills the form
   * with the latest total-station reading (HA, VA, slope, etc.).
   */
  onPullInstrumentReading?: () => Promise<Partial<Record<string, string>>>
}

export function UniversalMobileObservationForm({
  surveyType,
  stationName,
  onAdd,
  onClose,
  lastStation,
  onPullInstrumentReading,
}: UniversalMobileObservationFormProps) {
  const fields = FIELD_SETS[surveyType]
  const meta = TYPE_META[surveyType]

  // Build initial form state with defaults
  const initial = useMemo(() => {
    const obj: Record<string, string> = {}
    for (const f of fields) obj[f.key] = f.default ?? ''
    // Smart next-station suggestion
    if (lastStation && fields[0]?.station) {
      const next = suggestNextStation(lastStation)
      if (next) obj[fields[0].key] = next
    }
    return obj
  }, [fields, lastStation])

  const [form, setForm] = useState<Record<string, string>>(initial)
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState<CapturedBeaconPhoto[]>([])
  const [instrumentConnected, setInstrumentConnected] = useState(false)
  const [readingFromInstrument, setReadingFromInstrument] = useState(false)

  // Reset form when survey type changes (so reopening doesn't keep stale values)
  useEffect(() => {
    setForm(initial)
    setPhotos([])
  }, [initial])

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      for (const p of photos) {
        try { URL.revokeObjectURL(p.previewUrl) } catch { /* ignore */ }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (key: string, value: string, field: FieldDef) => {
    setForm((prev) => ({ ...prev, [key]: field.station ? value.toUpperCase() : value }))
  }

  const requiredFields = fields.filter((f) => f.required)
  const isComplete = requiredFields.every((f) => form[f.key]?.trim() !== '')

  const handleSubmit = async () => {
    if (!isComplete) return
    setSaving(true)
    try {
      await onAdd(form, photos)
    } finally {
      setSaving(false)
    }
  }

  /** "Save & Add Another" — keep the form open for rapid entry */
  const handleSaveAndNew = async () => {
    if (!isComplete) return
    setSaving(true)
    try {
      await onAdd(form, photos)
      // suggest next station
      const firstStationField = fields.find((f) => f.station)
      if (firstStationField && form[firstStationField.key]) {
        const next = suggestNextStation(form[firstStationField.key])
        const reset: Record<string, string> = {}
        for (const f of fields) reset[f.key] = f.default ?? ''
        if (next) reset[firstStationField.key] = next
        setForm(reset)
      }
      // Revoke old photo preview URLs and clear
      for (const p of photos) {
        try { URL.revokeObjectURL(p.previewUrl) } catch { /* ignore */ }
      }
      setPhotos([])
    } finally {
      setSaving(false)
    }
  }

  /** Pull the latest reading from a connected total station / GNSS. */
  const handlePullFromInstrument = async () => {
    if (!onPullInstrumentReading || readingFromInstrument) return
    setReadingFromInstrument(true)
    try {
      const reading = await onPullInstrumentReading()
      if (reading && Object.keys(reading).length > 0) {
        const sanitized: Record<string, string> = {}
        for (const [k, v] of Object.entries(reading)) {
          if (v !== undefined && v !== null) sanitized[k] = String(v)
        }
        setForm((prev) => ({ ...prev, ...sanitized }))
        setInstrumentConnected(true)
      }
    } catch (err) {
      logger.error('Instrument read failed:', { error: err })
    } finally {
      setReadingFromInstrument(false)
    }
  }

  const inputClass =
    'w-full px-4 py-3.5 text-base bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none transition-all'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5'

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end animate-[slideUp_0.2s_ease-out]">
      <div className="w-full bg-[var(--bg-primary)] border-t border-[var(--border-color)] rounded-t-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Drag handle */}
        <div className="pt-2 pb-1 flex justify-center">
          <div className="w-12 h-1.5 bg-[var(--border-color)] rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-secondary)_50%,transparent)]">
          <div className="flex items-center gap-2.5">
            <div className="grid place-items-center w-9 h-9 rounded-lg bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--accent)_30%,transparent)]">
              <meta.icon className={`w-5 h-5 ${meta.accent}`} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">New {meta.label} Reading</h2>
              {stationName && (
                <p className="text-xs text-[var(--text-muted)]">Station: {stationName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] active:scale-95 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 overscroll-contain">
          {fields.map((field) => (
            <div key={field.key}>
              <label htmlFor={`umo-${field.key}`} className={labelClass}>
                {field.label}
                {field.required && <span className="text-[var(--accent)] ml-1">*</span>}
              </label>
              <div className={field.key === 'remarks' ? 'flex items-start gap-2' : undefined}>
                <input id={`umo-${field.key}`}
                  type={field.inputMode === 'decimal' || field.inputMode === 'numeric' ? 'number' : 'text'}
                  inputMode={field.inputMode}
                  step={field.step}
                  value={form[field.key]}
                  onChange={(e) => handleChange(field.key, e.target.value, field)}
                  className={field.key === 'remarks' ? inputClass + ' flex-1 min-w-0' : inputClass}
                  placeholder={field.placeholder}
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- focus moves into the dialog on open (WCAG 2.4.3)
                  autoFocus={field === fields[0]}
                  autoComplete="off"
                  autoCapitalize={field.station ? 'characters' : 'off'}
                />
                {field.key === 'remarks' && (
                  <VoiceDictationButton
                    value={form[field.key]}
                    onChange={(v) => handleChange(field.key, v, field)}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Pull-from-instrument button — only when an instrument
              connection is available (Bluetooth / Web Serial). */}
          {onPullInstrumentReading && (
            <div className="pt-2 border-t border-[var(--border-color)]">
              <button
                type="button"
                onClick={handlePullFromInstrument}
                disabled={readingFromInstrument}
                className={[
                  'w-full p-3.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all border',
                  instrumentConnected
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:text-[var(--accent)]',
                ].join(' ')}
              >
                {readingFromInstrument ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Reading from instrument…
                  </>
                ) : instrumentConnected ? (
                  <>
                    <Bluetooth className="w-4 h-4" />
                    Pull latest reading
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-4 h-4" />
                    Connect instrument & pull reading
                  </>
                )}
              </button>
            </div>
          )}

          {/* Photo capture — universal across all survey types, with
              EXIF GPS extraction for evidence chains. */}
          <div className="pt-3 border-t border-[var(--border-color)]">
            <div className={labelClass}>Beacon / Site Photos</div>
            <BeaconPhotoCapture photos={photos} onChange={setPhotos} maxPhotos={4} />
          </div>
        </div>

        {/* Sticky action bar — large touch targets */}
        <div className="border-t border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-secondary)_80%,transparent)] backdrop-blur-md p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
          <button
            onClick={handleSubmit}
            disabled={!isComplete || saving}
            className={[
              'w-full py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2',
              isComplete && !saving
                ? 'bg-[var(--accent)] text-black active:bg-[var(--accent-dim)] shadow-lg shadow-[var(--accent)]/20'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed',
            ].join(' ')}
          >
            {saving ? (
              <>
                <span className="w-5 h-5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Save Reading
              </>
            )}
          </button>

          <button
            onClick={handleSaveAndNew}
            disabled={!isComplete || saving}
            className={[
              'w-full py-3 rounded-xl font-medium text-sm transition-all border',
              isComplete && !saving
                ? 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] active:scale-[0.99]'
                : 'border-transparent text-[var(--text-muted)] cursor-not-allowed',
            ].join(' ')}
          >
            Save & Add Another →
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

/** Suggest the next station name based on simple patterns:
 *  P1 -> P2, A1 -> A2, BM1 -> BM2, TP1 -> TP2, etc. */
function suggestNextStation(prev: string): string | null {
  if (!prev) return null
  const match = prev.match(/^([A-Za-z]+)(\d+)$/)
  if (!match) return null
  const [, prefix, num] = match
  const next = (parseInt(num, 10) + 1).toString().padStart(num.length, '0')
  return `${prefix}${next}`
}
