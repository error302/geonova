/**
 * Auto-save hook with a fixed-interval heartbeat.
 *
 * Automatically saves data every `interval` ms (default 30s) without the
 * surveyor needing to click "Save". Also saves when the page is hidden
 * (surveyor switches apps) and on unload.
 *
 * Why a heartbeat instead of a debounce:
 *   A debounce that resets its timer on every change never fires while the
 *   surveyor is actively typing (they change a field more often than the
 *   interval). A heartbeat guarantees a save at most `interval` ms after the
 *   first unsaved change, no matter how fast data keeps changing.
 *
 * Change detection is content-based (JSON), so editing a value *inside* an
 * existing row is detected — not just adding/removing rows.
 *
 * Usage:
 *   const { lastAutoSave, hasUnsavedChanges } = useAutoSave({
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
  /** Heartbeat interval in ms (default: 30000 = 30s) */
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
  // Serialized snapshot of the last successfully-saved data.
  const lastSavedSerializedRef = useRef<string>(safeStringify(data))
  const savingRef = useRef(false)
  const dirtyRef = useRef(false)
  // Keep onSave in a ref so the heartbeat interval doesn't need to be
  // re-created (and reset) every time the parent passes a new closure.
  const onSaveRef = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  const doSave = useCallback(async () => {
    if (savingRef.current) return
    // Snapshot what we're about to persist so we can compare accurately.
    const snapshot = safeStringify(dataRef.current)
    if (snapshot === lastSavedSerializedRef.current && !dirtyRef.current) return

    savingRef.current = true
    setState(s => ({ ...s, saving: true, error: null }))

    try {
      await onSaveRef.current(dataRef.current)
      lastSavedSerializedRef.current = snapshot
      dirtyRef.current = false
      setState(s => ({
        ...s,
        saving: false,
        hasUnsavedChanges: false,
        lastAutoSave: new Date(),
        error: null,
      }))
    } catch (err) {
      // Keep dirty=true so the next heartbeat retries.
      setState(s => ({
        ...s,
        saving: false,
        error: err instanceof Error ? err.message : 'Save failed',
      }))
    } finally {
      savingRef.current = false
    }
  }, [])

  // Track data changes (content-based) and flag dirty.
  useEffect(() => {
    dataRef.current = data
    const serialized = safeStringify(data)
    if (serialized !== lastSavedSerializedRef.current) {
      if (!dirtyRef.current) {
        dirtyRef.current = true
        setState(s => (s.hasUnsavedChanges ? s : { ...s, hasUnsavedChanges: true }))
      }
    }
  }, [data])

  // Heartbeat: fires at a fixed cadence and saves only when dirty.
  // Not re-created on data changes, so active typing never delays the save.
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => {
      if (dirtyRef.current) void doSave()
    }, interval)
    return () => clearInterval(id)
  }, [enabled, interval, doSave])

  // Save when the page is hidden (surveyor switches to another app).
  useEffect(() => {
    if (!enabled) return
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current) void doSave()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [enabled, doSave])

  // Warn + best-effort save on unload.
  useEffect(() => {
    if (!enabled) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault()
        e.returnValue = ''
        void doSave()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [enabled, doSave])

  return { ...state, saveNow: doSave }
}

/** JSON.stringify that never throws (circular refs → empty marker). */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return ''
  }
}
