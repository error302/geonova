'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Sun, Eye } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useLanguage } from '@/lib/i18n/LanguageContext'

/* ── Types ─────────────────────────────────────────────────────────────── */
type DisplayMode = 'dark' | 'field'

const STORAGE_KEY = 'metardu_display_mode'
const SENSOR_OPT_IN_KEY = 'metardu_auto_field_sensor'

/* ── Helpers ───────────────────────────────────────────────────────────── */

function getStoredMode(): DisplayMode {
  if (typeof window === 'undefined') return 'dark'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'field' || stored === 'dark') return stored
  } catch { /* ignore */ }
  return 'dark'
}

function applyMode(mode: DisplayMode) {
  const html = document.documentElement
  // v0.3: set data-theme for new theming system + keep field-mode class for backward compat
  if (mode === 'field') {
    html.setAttribute('data-theme', 'field')
    html.classList.add('field-mode')
  } else {
    html.setAttribute('data-theme', 'dark')
    html.classList.remove('field-mode')
  }
}

function isSensorOptIn(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(SENSOR_OPT_IN_KEY) === 'true'
  } catch { return false }
}

/* ── Component ─────────────────────────────────────────────────────────── */

interface AmbientLightSensorInstance {
  illuminance?: number
  addEventListener: (event: string, callback: () => void) => void
  removeEventListener: (event: string, callback: () => void) => void
  start: () => void
  stop: () => void
}

export default function FieldModeToggle() {
  const [mode, setMode] = useState<DisplayMode>('dark')
  const [mounted, setMounted] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [sensorEnabled, setSensorEnabled] = useState(false)
  const sensorRef = useRef<AmbientLightSensorInstance | null>(null)
  const tooltipDismissed = useRef(false)
  const addNotification = useUIStore((s) => s.addNotification)
  const { t } = useLanguage()

  /* ── Hydration-safe mount ───────────────────────────────────────────── */
  useEffect(() => {
    const stored = getStoredMode()
    setMode(stored)
    applyMode(stored)
    setSensorEnabled(isSensorOptIn())
    setMounted(true)
  }, [])

  /* ── First-use tooltip ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!mounted) return
    try {
      const hasSeenTooltip = localStorage.getItem('metardu_field_tooltip_seen')
      if (!hasSeenTooltip && !tooltipDismissed.current) {
        const timer = setTimeout(() => setShowTooltip(true), 800)
        return () => clearTimeout(timer)
      }
    } catch { /* ignore */ }
  }, [mounted])

  /* ── Ambient light sensor (opt-in) ─────────────────────────────────── */
  useEffect(() => {
    if (!mounted || !sensorEnabled) return

    let sensor: AmbientLightSensorInstance | null = null

    try {
      // The AmbientLightSensor API is only available in some browsers
      // and requires the 'ambient-light-sensor' permission.
      const AmbientLightSensorCtor = (window as unknown as { AmbientLightSensor?: new () => AmbientLightSensorInstance }).AmbientLightSensor
      if (!AmbientLightSensorCtor) return

      sensor = new AmbientLightSensorCtor()
      sensorRef.current = sensor

      sensor.addEventListener('reading', () => {
        const lux = sensor?.illuminance
        if (typeof lux !== 'number') return

        // Auto-switch: bright sunlight is typically > 10,000 lux
        // Shade/overcast outdoor is 1,000–10,000; indoor is 100–500
        const currentStored = getStoredMode()
        if (lux > 10000 && currentStored === 'dark') {
          setMode('field')
          applyMode('field')
          localStorage.setItem(STORAGE_KEY, 'field')
          addNotification({
            type: 'info',
            title: t('fieldMode.autoActivated'),
            message: t('fieldMode.autoActivatedDesc'),
            duration: 4000,
          })
        } else if (lux < 3000 && currentStored === 'field') {
          setMode('dark')
          applyMode('dark')
          localStorage.setItem(STORAGE_KEY, 'dark')
          addNotification({
            type: 'info',
            title: t('fieldMode.darkRestored'),
            message: t('fieldMode.darkRestoredDesc'),
            duration: 4000,
          })
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      sensor.addEventListener('error', () => {
        // Permission denied or sensor unavailable — silently disable
      })

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      sensor.start()
    } catch {
      // Sensor API not available — no-op
    }

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      try { sensor?.stop?.() } catch { /* ignore */ }
      sensorRef.current = null
    }
  }, [mounted, sensorEnabled, addNotification, t])

  /* ── Toggle handler ────────────────────────────────────────────────── */
  const toggleMode = useCallback(() => {
    const next: DisplayMode = mode === 'dark' ? 'field' : 'dark'
    setMode(next)
    applyMode(next)
    localStorage.setItem(STORAGE_KEY, next)

    addNotification({
      type: next === 'field' ? 'success' : 'info',
      title: next === 'field' ? t('fieldMode.fieldEnabled') : t('fieldMode.darkEnabled'),
      message: next === 'field' ? t('fieldMode.fieldEnabledDesc') : t('fieldMode.darkEnabledDesc'),
      duration: 3000,
    })
  }, [mode, addNotification, t])

  /* ── Dismiss tooltip ───────────────────────────────────────────────── */
  const dismissTooltip = useCallback(() => {
    setShowTooltip(false)
    tooltipDismissed.current = true
    try { localStorage.setItem('metardu_field_tooltip_seen', 'true') } catch { /* ignore */ }
  }, [])

  /* ── Toggle sensor opt-in ──────────────────────────────────────────── */
  const toggleSensor = useCallback(() => {
    const next = !sensorEnabled
    setSensorEnabled(next)
    try { localStorage.setItem(SENSOR_OPT_IN_KEY, String(next)) } catch { /* ignore */ }
  }, [sensorEnabled])

  /* ── Prevent hydration mismatch ────────────────────────────────────── */
  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)]/50 animate-pulse" />
    )
  }

  const isField = mode === 'field'

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        onClick={toggleMode}
        aria-label={isField ? t('fieldMode.switchToDark') : t('fieldMode.switchToField')}
        title={isField ? t('fieldMode.switchToDark') : t('fieldMode.tooltip')}
        className={`
          relative flex items-center justify-center
          w-10 h-10 rounded-lg
          transition-all duration-200 ease-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]
          group
          ${isField
            ? 'bg-[var(--accent)] text-black shadow-lg shadow-[var(--accent)]/25'
            : 'bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40'
          }
        `}
      >
        {isField ? (
          <Eye className="w-5 h-5" strokeWidth={2} />
        ) : (
          <Sun className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" strokeWidth={2} />
        )}

        {/* Field mode active indicator dot */}
        {isField && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full border-2 border-[var(--accent)]" />
        )}
      </button>

      {/* First-use tooltip */}
      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 z-50 w-64 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="bg-[var(--bg-secondary)] border border-[var(--accent)]/30 rounded-xl p-3 shadow-xl">
            <div className="flex items-start gap-2.5">
              <Sun className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" strokeWidth={2} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{t('field.fieldMode')}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  {t('fieldMode.fieldEnabledDesc')}
                </p>
              </div>
              <button
                onClick={dismissTooltip}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 -mt-0.5 -mr-0.5"
                aria-label="Dismiss tooltip"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Sensor opt-in toggle */}
            <div className="mt-3 pt-2 border-t border-[var(--border-color)]">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  className={`
                    relative w-8 h-[18px] rounded-full transition-colors duration-200
                    ${sensorEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'}
                  `}
                  onClick={toggleSensor}
                  role="switch"
                  aria-checked={sensorEnabled}
                  aria-label={t('fieldMode.autoDetectSunlight')}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSensor() } }}
                >
                  <div
                    className={`
                      absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform duration-200
                      ${sensorEnabled ? 'translate-x-[17px]' : 'translate-x-[2px]'}
                    `}
                  />
                </div>
                <span className="text-[11px] text-[var(--text-muted)] leading-tight">
                  {t('fieldMode.autoDetectSunlight')}
                </span>
              </label>
            </div>
          </div>

          {/* Arrow */}
          <div className="absolute -top-1.5 right-4 w-3 h-3 bg-[var(--bg-secondary)] border-l border-t border-[var(--accent)]/30 rotate-45" />
        </div>
      )}

      {/* Click-away to dismiss tooltip */}
      {showTooltip && (
        <button type="button" aria-label="Dismiss tooltip" tabIndex={-1} className="fixed inset-0 z-40 cursor-pointer border-0 p-0" onClick={dismissTooltip} />
      )}
    </div>
  )
}
