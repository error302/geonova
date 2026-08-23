'use client';

/**
 * UniversalMobileObservationForm — Observation Wizard
 * ---------------------------------------------------
 * Sequential bottom-sheet wizard for field data collection.
 * One concept per screen: Station → backsight → foresight → confirm,
 * with large glanceable live readouts, offline-first save badges and
 * quick-repeat station chaining (A → B → C / TP1 → TP2).
 *
 * Replaces the old flat all-fields-at-once sheet which was unreadable
 * in field conditions (sun glare, gloves, one-thumb operation).
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  X, Check, MapPin, Ruler, Compass, Bluetooth, RefreshCw,
  ArrowLeft, ArrowRight, CheckCircle2, CloudUpload, CloudOff,
} from 'lucide-react'
import { BeaconPhotoCapture, type CapturedBeaconPhoto } from './BeaconPhotoCapture'
import { VoiceDictationButton } from '@/components/shared/VoiceDictationButton'
import { logger } from '@/lib/logger'

export type MobileSurveyType = 'leveling' | 'traverse' | 'control'

interface FieldDef {
  key: string
  label: string
  shortLabel?: string
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
    { key: 'is', label: 'Intermediate (IS)', shortLabel: 'Intersight', placeholder: '1.502', inputMode: 'decimal', step: '0.001' },
    { key: 'fs', label: 'Foresight (FS)', placeholder: '0.873', inputMode: 'decimal', step: '0.001' },
    { key: 'remarks', label: 'Remarks', placeholder: 'Concrete BM, flush' },
  ],
  traverse: [
    { key: 'station', label: 'Station', placeholder: 'A1', station: true, required: true },
    { key: 'bearing', label: 'Bearing', placeholder: '45.5056', inputMode: 'decimal' },
    { key: 'slopeDist', label: 'Slope Distance', shortLabel: 'Slope Dist', placeholder: '125.456', inputMode: 'decimal', step: '0.001', required: true },
    { key: 'vaDeg', label: 'Vertical Angle (°)', shortLabel: 'Vert Angle', placeholder: '90.0000', inputMode: 'decimal', step: '0.0001' },
    { key: 'ih', label: 'Height of Instrument', shortLabel: 'HI', placeholder: '1.500', inputMode: 'decimal', step: '0.001', default: '1.500' },
    { key: 'th', label: 'Target Height', shortLabel: 'TH', placeholder: '1.500', inputMode: 'decimal', step: '0.001', default: '1.500' },
    { key: 'remarks', label: 'Remarks', placeholder: 'Road centerline' },
  ],
  control: [
    { key: 'pointId', label: 'Point ID', placeholder: 'P1', station: true, required: true },
    { key: 'bearing', label: 'Bearing', placeholder: '120.2500', inputMode: 'decimal' },
    { key: 'verticalAngle', label: 'Vertical Angle (°)', shortLabel: 'Vert Angle', placeholder: '90.0000', inputMode: 'decimal', step: '0.0001' },
    { key: 'slopeDistance', label: 'Slope Distance', shortLabel: 'Slope Dist', placeholder: '85.234', inputMode: 'decimal', step: '0.001', required: true },
    { key: 'instrumentHeight', label: 'Instrument Height', shortLabel: 'IH', placeholder: '1.500', inputMode: 'decimal', step: '0.001', default: '1.500' },
    { key: 'targetHeight', label: 'Target Height', shortLabel: 'TH', placeholder: '1.500', inputMode: 'decimal', step: '0.001', default: '1.500' },
    { key: 'remarks', label: 'Remarks', placeholder: 'Wall corner beacon' },
  ],
}

/**
 * Screens group field KEYS into single-focus wizard steps.
 * HI/TH share a screen (natural pair, both defaulted).
 */
type WizardScreen = string[]

const WIZARD_SCREENS: Record<MobileSurveyType, WizardScreen[]> = {
  leveling: [
    ['station'],
    ['bs'],
    ['is'],
    ['fs'],
    ['remarks'],
  ],
  traverse: [
    ['station'],
    ['bearing'],
    ['slopeDist'],
    ['vaDeg'],
    ['ih', 'th'],
    ['remarks'],
  ],
  control: [
    ['pointId'],
    ['bearing'],
    ['verticalAngle'],
    ['slopeDistance'],
    ['instrumentHeight', 'targetHeight'],
    ['remarks'],
  ],
}

/** Fields whose values carry over between chained shots (quick-repeat). */
const CARRY_OVER_KEYS: Record<MobileSurveyType, string[]> = {
  leveling: [],
  traverse: ['vaDeg', 'ih', 'th'],
  control: ['verticalAngle', 'instrumentHeight', 'targetHeight'],
}

const TYPE_META: Record<MobileSurveyType, { label: string; icon: typeof Compass; accent: string }> = {
  leveling:     { label: 'Leveling',     icon: Ruler,    accent: 'text-sky-400' },
  traverse:     { label: 'Traverse',     icon: Compass,  accent: 'text-amber-400' },
  control:      { label: 'Control',      icon: MapPin,   accent: 'text-emerald-400' },
}

export interface UniversalMobileObservationFormProps {
  surveyType: MobileSurveyType
  /** station context (for control where station header exists) */
  stationName?: string
  /**
   * Called when the user saves a reading. Returns the row plus any
   * captured beacon photos with embedded EXIF GPS data.
   */
  onAdd: (row: Record<string, string>, photos: CapturedBeaconPhoto[]) => void
  onClose: () => void
  /** auto-increment last station name (e.g. P1 -> P2, A -> B) */
  lastStation?: string
  /**
   * Optional instrument-read callback. When provided, a "Pull from
   * instrument" button appears that calls this and fills the form
   * with the latest total-station reading (HA, VA, slope, etc.).
   */
  onPullInstrumentReading?: () => Promise<Partial<Record<string, string>>>
  /** connectivity — drives the offline-first save badge */
  online?: boolean
  /** rows saved locally but not yet synced to server */
  unsyncedCount?: number
}

export function UniversalMobileObservationForm({
  surveyType,
  stationName,
  onAdd,
  onClose,
  lastStation,
  onPullInstrumentReading,
  online = true,
  unsyncedCount = 0,
}: UniversalMobileObservationFormProps) {
  const fields = FIELD_SETS[surveyType]
  const screens = WIZARD_SCREENS[surveyType]
  const meta = TYPE_META[surveyType]

  const buildInitial = useCallback((forChain: boolean): Record<string, string> => {
    const obj: Record<string, string> = {}
    for (const f of fields) obj[f.key] = f.default ?? ''
    if (!forChain && lastStation && fields[0]?.station) {
      const next = suggestNextStation(lastStation)
      if (next) obj[fields[0].key] = next
    }
    return obj
  }, [fields, lastStation])

  const [form, setForm] = useState<Record<string, string>>(() => buildInitial(false))
  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savedShot, setSavedShot] = useState<Record<string, string> | null>(null)
  const [shotsThisSession, setShotsThisSession] = useState(0)
  const [photos, setPhotos] = useState<CapturedBeaconPhoto[]>([])
  const [instrumentConnected, setInstrumentConnected] = useState(false)
  const [readingFromInstrument, setReadingFromInstrument] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (savedShot) return
    setForm(buildInitial(false))
    setPhotos([])
    setStepIndex(0)
  }, [buildInitial, savedShot])

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

  const currentScreenFields = (screens[stepIndex] ?? [])
    .map((key) => fields.find((f) => f.key === key))
    .filter((f): f is FieldDef => Boolean(f))
  const canAdvance = currentScreenFields.every(
    (f) => !f.required || form[f.key]?.trim() !== ''
  )

  const advance = useCallback(() => {
    if (!canAdvance) return
    setStepIndex((i) => Math.min(i + 1, screens.length - 1))
  }, [canAdvance, screens.length])

  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0))

  const isComplete = fields
    .filter((f) => f.required)
    .every((f) => form[f.key]?.trim() !== '')

  const persist = async (): Promise<boolean> => {
    if (!isComplete || saving) return false
    setSaving(true)
    try {
      await onAdd(form, photos)
      setSavedShot(form)
      setShotsThisSession((n) => n + 1)
      for (const p of photos) {
        try { URL.revokeObjectURL(p.previewUrl) } catch { /* ignore */ }
      }
      setPhotos([])
      return true
    } catch (err) {
      logger.error('Failed to store reading:', { error: err })
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => { void persist() }

  /** Quick-repeat: reset measurements, chain the station, restart wizard. */
  const handleNextShot = () => {
    const next: Record<string, string> = buildInitial(true)
    const stationField = fields.find((f) => f.station)
    const prevStationVal = savedShot?.[stationField?.key ?? ''] ?? ''
    if (stationField) {
      const chained = suggestNextStation(prevStationVal)
      next[stationField.key] = chained ?? prevStationVal
    }
    for (const key of CARRY_OVER_KEYS[surveyType]) {
      if (savedShot?.[key]) next[key] = savedShot[key]
    }
    setForm(next)
    setSavedShot(null)
    setStepIndex(0)
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

  // ─── Derived live readouts ─────────────────────────────────────────────

  const num = (k: string) => {
    const v = parseFloat(form[k])
    return Number.isFinite(v) ? v : null
  }

  const liveDerived = useMemo(() => {
    if (surveyType === 'leveling') {
      const bs = num('bs')
      const fs = num('fs')
      if (bs !== null && fs !== null) {
        const dH = bs - fs
        return {
          label: dH >= 0 ? 'RISE' : 'FALL',
          value: `${Math.abs(dH).toFixed(3)} m`,
        }
      }
      return null
    }
    const sdKey = surveyType === 'traverse' ? 'slopeDist' : 'slopeDistance'
    const vaKey = surveyType === 'traverse' ? 'vaDeg' : 'verticalAngle'
    const sd = num(sdKey)
    const va = num(vaKey)
    if (sd !== null && va !== null) {
      const hd = sd * Math.cos((va * Math.PI) / 180)
      return { label: 'HORIZ DIST', value: `${hd.toFixed(3)} m` }
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, surveyType])

  const stationValue =
    form[fields.find((f) => f.station)?.key ?? 'station'] || ''

  // ─── Styling ────────────────────────────────────────────────────────────

  const inputClass =
    'w-full px-4 h-16 text-2xl font-mono bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none transition-all text-center'
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5'

  const ctaEnabled = !saving

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-end animate-[slideUp_0.2s_ease-out]" role="dialog" aria-modal="true" aria-label={`New ${meta.label} reading`}>
      <div className="w-full bg-[var(--bg-primary)] border-t border-[var(--border-color)] rounded-t-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Drag handle */}
        <div className="pt-2 pb-1 flex justify-center shrink-0">
          <div className="w-12 h-1.5 bg-[var(--border-color)] rounded-full" />
        </div>

        {/* Header — survey identity + large live readout */}
        <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-secondary)_50%,transparent)] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="grid place-items-center w-9 h-9 rounded-lg bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--accent)_30%,transparent)] shrink-0">
                <meta.icon className={`w-5 h-5 ${meta.accent}`} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">New {meta.label} Reading</h2>
                {stationName && (
                  <p className="text-xs text-[var(--text-muted)] truncate">Setup: {stationName}</p>
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

          {/* Glanceable readout strip */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 min-w-0 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Station</div>
              <div className="font-mono text-2xl leading-7 font-bold text-[var(--text-primary)] truncate">
                {stationValue || '—'}
              </div>
            </div>
            <div className="flex-1 min-w-0 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                {liveDerived?.label ?? (surveyType === 'leveling' ? 'ΔH' : 'Horiz Dist')}
              </div>
              <div className={`font-mono text-2xl leading-7 font-bold truncate ${liveDerived ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                {liveDerived?.value ?? '—'}
              </div>
            </div>
          </div>

          {/* Progress dots */}
          <div className="mt-3 flex items-center gap-1.5" role="progressbar" aria-valuenow={stepIndex + 1} aria-valuemin={1} aria-valuemax={screens.length}>
            {screens.map((screen, i) => (
              <button
                key={`dot-${i}`}
                onClick={() => setStepIndex(i)}
                aria-label={`Go to step ${i + 1}`}
                className={[
                  'h-1.5 rounded-full transition-all',
                  i === stepIndex
                    ? 'w-7 bg-[var(--accent)]'
                    : i < stepIndex
                      ? 'w-3 bg-[color-mix(in_srgb,var(--accent)_55%,transparent)]'
                      : 'w-3 bg-[var(--border-color)]',
                ].join(' ')}
              />
            ))}
            <span className="ml-auto text-[10px] font-mono text-[var(--text-muted)]">
              {stepIndex + 1}/{screens.length}
            </span>
          </div>
        </div>

        {/* Body */}
        {savedShot ? (
          /* ── Post-save confirmation: offline-first receipt ── */
          <div className="flex-1 overflow-y-auto px-4 py-8 flex flex-col items-center justify-center text-center overscroll-contain">
            <CheckCircle2 className="w-16 h-16 text-emerald-400" strokeWidth={1.5} />
            <h3 className="mt-4 text-xl font-bold text-[var(--text-primary)]">
              Shot #{shotsThisSession} stored
            </h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)] font-mono">
              {savedShot[fields.find((f) => f.station)?.key ?? 'station']}
              {' · '}
              {fields.filter((f) => f.key !== 'station' && f.key !== 'remarks' && savedShot[f.key]).map((f) => `${f.shortLabel ?? f.label}: ${savedShot[f.key]}`).join('  ')}
            </p>

            <div className="mt-5 flex items-center gap-2 rounded-full px-4 py-2 border text-xs font-medium"
              style={{
                borderColor: online ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : 'rgba(251,191,36,.35)',
                background: online ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'rgba(251,191,36,.08)',
                color: online ? 'var(--accent)' : '#fbbf24',
              }}
            >
              {online ? <CloudUpload className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
              {online
                ? 'Syncing to server…'
                : `Stored on device${unsyncedCount > 0 ? ` · ${unsyncedCount} queued` : ''}`}
            </div>
            {!online && (
              <p className="mt-2 text-xs text-[var(--text-muted)] max-w-[26ch]">
                Safe to keep shooting — this reading will upload automatically when you reconnect.
              </p>
            )}
          </div>
        ) : (
          /* ── Active wizard screen ── */
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 overscroll-contain">
            {currentScreenFields.map((field) => (
              <div key={field.key}>
                <label htmlFor={`umo-${field.key}`} className={labelClass}>
                  <span className="font-mono text-[var(--accent)] mr-1">{String(stepIndex + 1).padStart(2, '0')}</span>
                  {field.label}
                  {field.required && <span className="text-[var(--accent)] ml-1">*</span>}
                </label>
                <div className={field.key === 'remarks' ? 'flex items-start gap-2' : undefined}>
                  <input id={`umo-${field.key}`}
                    ref={inputRef}
                    type={field.inputMode === 'decimal' || field.inputMode === 'numeric' ? 'number' : 'text'}
                    inputMode={field.inputMode}
                    enterKeyHint={canAdvance && stepIndex < screens.length - 1 ? 'next' : 'done'}
                    step={field.step}
                    value={form[field.key]}
                    onChange={(e) => handleChange(field.key, e.target.value, field)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (stepIndex === screens.length - 1) { handleSave() } else { advance() }
                      }
                    }}
                    className={field.key === 'remarks' ? inputClass.replace('text-center', '') + ' !py-3.5 !text-base flex-1 min-w-0' : inputClass}
                    placeholder={field.placeholder}
                    autoFocus
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

            {onPullInstrumentReading && (
              <button
                type="button"
                onClick={handlePullFromInstrument}
                disabled={readingFromInstrument}
                className={[
                  'w-full py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-all border',
                  instrumentConnected
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-[var(--border-color)] bg-transparent text-[var(--text-muted)] hover:border-[var(--border-color)] hover:text-[var(--text-secondary)]',
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
                    Connect instrument &amp; fill readings
                  </>
                )}
              </button>
            )}

            {/* Beacon photos available on every screen via the review step;
                keep capture affordance here so evidence is never skipped. */}
            {stepIndex === screens.length - 1 && (
              <div className="pt-3 border-t border-[var(--border-color)]">
                <div className={labelClass}>Beacon / Site Photos</div>
                <BeaconPhotoCapture photos={photos} onChange={setPhotos} maxPhotos={4} />
              </div>
            )}
          </div>
        )}

        {/* Sticky action bar — one-thumb reach zone */}
        <div className="shrink-0 border-t border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-secondary)_80%,transparent)] backdrop-blur-md p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {savedShot ? (
            <div className="flex gap-2">
              <button
                onClick={handleNextShot}
                className="flex-1 py-4 min-h-[56px] rounded-xl font-semibold text-base bg-[var(--accent)] text-black active:bg-[var(--accent-dim)] shadow-lg shadow-[color-mix(in_srgb,var(--accent)_20%,transparent)] transition-all flex items-center justify-center gap-2"
              >
                Next shot
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="px-6 py-4 min-h-[56px] rounded-xl font-medium text-sm border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] active:scale-[0.99] transition-all"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <button
                  onClick={goBack}
                  disabled={ctaEnabled === false}
                  className="grid place-items-center w-14 h-14 shrink-0 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] active:scale-95 transition-all"
                  aria-label="Previous step"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}

              {stepIndex < screens.length - 1 ? (
                <button
                  onClick={advance}
                  disabled={!canAdvance}
                  className={[
                    'flex-1 py-4 min-h-[56px] rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2',
                    canAdvance
                      ? 'bg-[var(--accent)] text-black active:bg-[var(--accent-dim)] shadow-lg shadow-[color-mix(in_srgb,var(--accent)_20%,transparent)]'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed',
                  ].join(' ')}
                >
                  Next
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={!isComplete || saving}
                  className={[
                    'flex-1 py-4 min-h-[56px] rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2',
                    isComplete && !saving
                      ? 'bg-[var(--accent)] text-black active:bg-[var(--accent-dim)] shadow-lg shadow-[color-mix(in_srgb,var(--accent)_20%,transparent)]'
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
              )}
            </div>
          )}
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
 *  P1 -> P2, A1 -> A2, BM1 -> BM2, TP1 -> TP2,
 *  A -> B, B -> C … Z -> AA (quick-repeat chaining). */
export function suggestNextStation(prev: string): string | null {
  if (!prev) return null
  const pureLetters = prev.match(/^([A-Za-z]+)$/)
  if (pureLetters) return incrementLetters(pureLetters[1])
  const match = prev.match(/^([A-Za-z]+)(\d+)$/)
  if (!match) return null
  const [, prefix, num] = match
  const next = (parseInt(num, 10) + 1).toString().padStart(num.length, '0')
  return `${prefix}${next}`
}

/** Bijective base-26 letter increment: A→B … Z→AA … AZ→BA. */
function incrementLetters(s: string): string {
  const chars = s.toUpperCase().split('')
  let i = chars.length - 1
  while (i >= 0) {
    if (chars[i] === 'Z') {
      chars[i] = 'A'
      i--
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1)
      return chars.join('')
    }
  }
  return `A${chars.join('')}`
}
