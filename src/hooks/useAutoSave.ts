/**
 * Auto-save hook with debounce.
 *
 * Automatically saves field book data every 30 seconds (configurable)
 * without the surveyor needing to click "Save". Also saves on page
 * visibility change (when the surveyor switches to another app).
 *
 * Usage:
 *   const { lastAutoSave, pendingChanges } = useAutoSave({
 *     data: fieldBookData,
 *     onSave: async (data) => { await saveToServer(data) },
 *     interval: 30000,
 *   })
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface AutoSaveOptions {
  /** Data to save (must be JSON-serializable) */
  data: unknown
  /** Save function (async) */
  onSave: (data: unknown) => Promise<void>
  /** Debounce interval in ms (default: 30000 = 30s) */
  interval?: number
  /** Whether auto-save is enabled */
  enabled?: boolean
}

interface AutoSaveState {
  /** Timestamp of last successful save */
  lastAutoSave: Date | null
  /** Whether a save is in progress */
  saving: boolean
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean
  /** Error message if save failed */
  error: string | null
}

export function useAutoSave({ data, onSave, interval = 30000, enabled = true }: AutoSaveOptions): AutoSaveState & {
  saveNow: () => Promise<void>
} {
  const [state, setState] = useState<AutoSaveState>({
    lastAutoSave: null,
    saving: false,
    hasUnsavedChanges: false,
    error: null,
  })

  const dataRef = useRef(data)
  const lastSavedRef = useRef(data)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)

  // Track data changes
  useEffect(() => {
    dataRef.current = data
    if (JSON.stringify(data) !== JSON.stringify(lastSavedRef.current)) {
      setState(s => ({ ...s, hasUnsavedChanges: true }))

      // Debounce: reset the timer on every change
      if (timerRef.current) clearTimeout(timerRef.current)
      if (enabled) {
        timerRef.current = setTimeout(() => {
          doSave()
        }, interval)
      }
    }
  }, [data, interval, enabled])

  // Save on page visibility change (surveyor switches to another app)
  useEffect(() => {
    if (!enabled) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && state.hasUnsavedChanges) {
        doSave()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [enabled, state.hasUnsavedChanges])

  // Save on page unload (beforeunload)
  useEffect(() => {
    if (!enabled) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
        // Try to save synchronously (may not complete, but try)
        doSave()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [enabled, state.hasUnsavedChanges])

  const doSave = useCallback(async () => {
    if (savingRef.current) return
    savingRef.current = true

    setState(s => ({ ...s, saving: true, error: null }))

    try {
      await onSave(dataRef.current)
      lastSavedRef.current = dataRef.current
      setState(s => ({
        ...s,
        saving: false,
        hasUnsavedChanges: false,
        lastAutoSave: new Date(),
        error: null,
      }))
    } catch (err) {
      setState(s => ({
        ...s,
        saving: false,
        error: err instanceof Error ? err.message : 'Save failed',
      }))
    } finally {
      savingRef.current = false
    }
  }, [onSave])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { ...state, saveNow: doSave }
}
