/**
 * Mobile field UX enhancements.
 *
 * Addresses the 5 biggest mobile field-work pain points:
 *   1. Haptic feedback on key actions (add reading, delete, save)
 *   2. Voice input for remarks (surveyors in bright sun can't type)
 *   3. Quick-action shortcuts (repeat last, GPS position, timestamp)
 *   4. Sticky computation summary (always visible, not buried)
 *   5. Offline cache indicator (shows how much data is cached locally)
 */

'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Mic, MicOff, Copy, MapPin, Clock, Vibrate,
  Wifi, WifiOff, Database, X, Check,
} from 'lucide-react'

// ─── 1. Haptic Feedback Hook ────────────────────────────────────────────────

/**
 * Trigger device vibration for haptic feedback.
 * Falls back silently on devices without vibration support.
 *
 * Patterns:
 *   - 'light': 10ms (button tap)
 *   - 'medium': 30ms (reading added)
 *   - 'heavy': [50, 30, 50] (error/alert)
 *   - 'success': [10, 30, 10] (save successful)
 */
export function useHaptics() {
  return useCallback((pattern: 'light' | 'medium' | 'heavy' | 'success' = 'light') => {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return

    const patterns: Record<string, number | number[]> = {
      light: 10,
      medium: 30,
      heavy: [50, 30, 50],
      success: [10, 30, 10],
    }

    try {
      navigator.vibrate(patterns[pattern])
    } catch {
      // Vibration not supported — silent fallback
    }
  }, [])
}

// ─── 2. Voice Input Component ───────────────────────────────────────────────

interface VoiceInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/**
 * Text input with voice-to-text for remarks.
 *
 * Uses the Web Speech API (available in Chrome/Edge/Safari).
 * The surveyor taps the mic icon, speaks, and the text is transcribed
 * into the input field. Critical for field work in bright sunlight
 * where typing on a small screen is difficult.
 */
export function VoiceInput({ value, onChange, placeholder = 'Tap mic to speak...', className = '' }: VoiceInputProps) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const haptics = useHaptics()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        setSupported(true)
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = false
        recognition.lang = 'en-US'

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript
          onChange(value ? `${value} ${transcript}` : transcript)
          haptics('success')
        }

        recognition.onerror = () => {
          setListening(false)
          haptics('heavy')
        }

        recognition.onend = () => {
          setListening(false)
        }

        recognitionRef.current = recognition
      }
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch {}
      }
    }
  }, [value, onChange, haptics])

  const toggleListening = () => {
    if (!supported || !recognitionRef.current) return

    if (listening) {
      recognitionRef.current.stop()
      setListening(false)
    } else {
      try {
        recognitionRef.current.start()
        setListening(true)
        haptics('medium')
      } catch {
        setListening(false)
      }
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pr-10 pl-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
      />
      {supported && (
        <button
          onClick={toggleListening}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
            listening
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--accent)]'
          }`}
          aria-label={listening ? 'Stop voice input' : 'Start voice input'}
        >
          {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  )
}

// ─── 3. Quick Action Bar ────────────────────────────────────────────────────

interface QuickActionBarProps {
  onRepeatLast: () => void
  onGPSPosition: () => void
  onTimestamp: () => void
  hasLastReading: boolean
}

/**
 * Quick-action shortcuts for field work.
 *
 * Appears as a horizontal bar above the reading cards on mobile.
 * - Repeat Last: duplicates the last reading (common in traverse work)
 * - GPS: injects current GPS position as a reading
 * - Time: inserts current timestamp into remarks
 *
 * Each action has haptic feedback for eyes-free operation.
 */
export function QuickActionBar({ onRepeatLast, onGPSPosition, onTimestamp, hasLastReading }: QuickActionBarProps) {
  const haptics = useHaptics()

  return (
    <div className="flex gap-2 px-4 py-2 bg-[var(--bg-secondary)]/50 border-b border-[var(--border-color)]">
      <button
        onClick={() => { haptics('medium'); onRepeatLast() }}
        disabled={!hasLastReading}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] disabled:opacity-30 transition active:scale-95"
      >
        <Copy className="w-3.5 h-3.5" />
        Repeat
      </button>
      <button
        onClick={() => { haptics('medium'); onGPSPosition() }}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition active:scale-95"
      >
        <MapPin className="w-3.5 h-3.5" />
        GPS
      </button>
      <button
        onClick={() => { haptics('light'); onTimestamp() }}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[var(--bg-tertiary)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition active:scale-95"
      >
        <Clock className="w-3.5 h-3.5" />
        Time
      </button>
    </div>
  )
}

// ─── 4. Sticky Computation Summary ──────────────────────────────────────────

interface StickySummaryProps {
  /** Primary value to show (e.g., "1:5000" or "PASS") */
  primary: string
  /** Label for the primary value */
  primaryLabel: string
  /** Whether the primary value is good (green) or bad (red) */
  primaryGood: boolean
  /** Secondary value (e.g., misclosure) */
  secondary?: string
  secondaryLabel?: string
  /** Number of readings */
  readingCount: number
}

/**
 * Sticky computation summary that stays visible at the top of the mobile
 * field book. Shows the most important QC metric at a glance.
 *
 * Before: surveyor had to scroll down past cards to see if their traverse
 * was closing. Now: the precision ratio is always visible.
 */
export function StickySummary({ primary, primaryLabel, primaryGood, secondary, secondaryLabel, readingCount }: StickySummaryProps) {
  return (
    <div className="sticky top-[88px] z-10 mx-4 my-2">
      <div className="flex items-center justify-between bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-sm px-3 py-2">
        {/* Primary metric */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${primaryGood ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`} />
          <div>
            <div className={`text-sm font-bold font-mono ${primaryGood ? 'text-emerald-400' : 'text-red-400'}`}>
              {primary}
            </div>
            <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
              {primaryLabel}
            </div>
          </div>
        </div>

        {/* Secondary metric */}
        {secondary && (
          <div className="text-right">
            <div className="text-xs font-mono text-[var(--text-primary)]">{secondary}</div>
            <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
              {secondaryLabel}
            </div>
          </div>
        )}

        {/* Reading count */}
        <div className="text-right">
          <div className="text-xs font-mono text-[var(--text-primary)]">{readingCount}</div>
          <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">Readings</div>
        </div>
      </div>
    </div>
  )
}

// ─── 5. Offline Cache Indicator ─────────────────────────────────────────────

interface OfflineIndicatorProps {
  online: boolean
  cachedReadings: number
  pendingSync: number
  lastSync?: string | null
}

/**
 * Shows the offline cache state — how many readings are stored locally
 * and how many are pending sync.
 *
 * Gives the surveyor confidence that their data is safe even when offline.
 */
export function OfflineCacheIndicator({ online, cachedReadings, pendingSync, lastSync }: OfflineIndicatorProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="px-4 py-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-[10px] text-[var(--text-muted)]"
      >
        <span className="flex items-center gap-1.5">
          <Database className="w-3 h-3" />
          {cachedReadings} cached locally
          {pendingSync > 0 && (
            <span className="text-amber-400">· {pendingSync} pending sync</span>
          )}
        </span>
        {online ? (
          <span className="flex items-center gap-1 text-emerald-400">
            <Wifi className="w-3 h-3" /> Online
          </span>
        ) : (
          <span className="flex items-center gap-1 text-amber-400">
            <WifiOff className="w-3 h-3" /> Offline
          </span>
        )}
      </button>

      {expanded && lastSync && (
        <div className="text-[9px] text-[var(--text-muted)] mt-1 ml-5">
          Last sync: {new Date(lastSync).toLocaleString()}
        </div>
      )}
    </div>
  )
}
