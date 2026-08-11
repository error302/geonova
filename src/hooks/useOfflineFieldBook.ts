'use client';

/**
 * useOfflineFieldBook — React hook for offline field data collection
 *
 * Usage:
 *   const { observations, addObservation, deleteObservation, syncStatus, isOnline } = useOfflineFieldBook(projectId)
 *
 * The hook:
 * 1. Loads observations from IndexedDB on mount
 * 2. Provides addObservation() that saves to IndexedDB (works offline)
 * 3. Auto-syncs to server when online
 * 4. Reports sync status (total / unsynced / synced)
 * 5. Reports connectivity status
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  type OfflineObservation,
  type ObservationType,
  getObservations,
  saveObservation,
  deleteObservation,
  syncObservations,
  startAutoSync,
  stopAutoSync,
  isOnline,
  onConnectivityChange,
  generateId,
  getSyncStatus,
} from '@/lib/offline/fieldBookDB'
import { logger } from '@/lib/logger'

export function useOfflineFieldBook(projectId: string, surveyType?: ObservationType) {
  const [observations, setObservations] = useState<OfflineObservation[]>([])
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(isOnline())
  const [syncStatus, setSyncStatus] = useState({ total: 0, unsynced: 0, synced: 0 })
  const [syncing, setSyncing] = useState(false)
  const mountedRef = useRef(true)

  // Load observations from IndexedDB
  const loadObservations = useCallback(async () => {
    try {
      const obs = await getObservations(projectId, surveyType)
      if (mountedRef.current) {
        setObservations(obs.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
        const status = await getSyncStatus()
        if (mountedRef.current) setSyncStatus(status)
      }
    } catch (err) {
      logger.error('[useOfflineFieldBook] Failed to load observations:', { error: err })
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [projectId, surveyType])

  // Add observation (works offline)
  const addObservation = useCallback(async (data: Omit<OfflineObservation, 'id' | 'projectId' | 'createdAt' | 'syncedAt'>) => {
    const obs: OfflineObservation = {
      ...data,
      id: generateId(),
      projectId,
      createdAt: new Date().toISOString(),
      syncedAt: null,
    }
    await saveObservation(obs)
    if (mountedRef.current) {
      setObservations(prev => [...prev, obs])
      setSyncStatus(prev => ({ ...prev, total: prev.total + 1, unsynced: prev.unsynced + 1 }))
    }
    // Try to sync immediately if online
    if (isOnline()) {
      setSyncing(true)
      try {
        await syncObservations()
        const status = await getSyncStatus()
        if (mountedRef.current) setSyncStatus(status)
      } finally {
        if (mountedRef.current) setSyncing(false)
      }
    }
    return obs
  }, [projectId])

  // Delete observation
  const removeObservation = useCallback(async (id: string) => {
    await deleteObservation(id)
    if (mountedRef.current) {
      setObservations(prev => prev.filter(o => o.id !== id))
      setSyncStatus(prev => ({ ...prev, total: prev.total - 1 }))
    }
  }, [])

  // Manual sync trigger
  const syncNow = useCallback(async () => {
    setSyncing(true)
    try {
      const result = await syncObservations()
      await loadObservations() // reload to get updated syncedAt
      return result
    } finally {
      if (mountedRef.current) setSyncing(false)
    }
  }, [loadObservations])

  // Initialize on mount
  useEffect(() => {
    mountedRef.current = true
    loadObservations()
    startAutoSync(30000)

    const unsubscribe = onConnectivityChange((isOnlineNow) => {
      if (mountedRef.current) setOnline(isOnlineNow)
      if (isOnlineNow) {
        loadObservations()
      }
    })

    return () => {
      mountedRef.current = false
      stopAutoSync()
      unsubscribe()
    }
  }, [loadObservations])

  return {
    observations,
    loading,
    online,
    syncStatus,
    syncing,
    addObservation,
    removeObservation,
    syncNow,
  }
}
