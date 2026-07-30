// ──────────────────────────────────────────────────────────────────────────
// METARDU — useOfflineSync React Hook
// ──────────────────────────────────────────────────────────────────────────
// Provides a clean React interface to the offline sync system.
// Handles status, pending count, and reactive updates.
// ──────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSyncManager, type SyncState, type SyncResult } from '@/lib/offline/sync-manager';
import { getStorageEstimate, purgeStaleData, type OfflineObservation, type OfflineStation } from '@/lib/offline/db';

// ─── Types ───────────────────────────────────────────────────────────────

export interface UseOfflineSyncReturn {
  /** Current sync state */
  state: SyncState;
  /** Whether the browser is online */
  isOnline: boolean;
  /** Number of items waiting to sync */
  pendingCount: number;
  /** Last successful sync timestamp */
  lastSyncAt: number | null;
  /** Current sync status */
  status: SyncStatus;
  /** Last error message */
  lastError: string | null;

  /** Save an observation offline and queue for sync */
  saveObservation: (obs: Omit<OfflineObservation, 'synced' | 'syncAttempts' | 'lastSyncError' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  /** Save a station offline and queue for sync */
  saveStation: (station: Omit<OfflineStation, 'synced' | 'createdAt'>) => Promise<void>;
  /** Update an existing observation */
  updateObservation: (id: string, updates: Partial<OfflineObservation>) => Promise<void>;
  /** Delete an observation */
  deleteObservation: (id: string) => Promise<void>;

  /** Get all observations for a survey */
  getObservations: (surveyId: string) => Promise<OfflineObservation[]>;
  /** Get unsynced observations for a survey */
  getUnsyncedObservations: (surveyId: string) => Promise<OfflineObservation[]>;

  /** Force an immediate sync */
  syncNow: () => Promise<SyncResult>;
  /** Clean up old synced data */
  cleanup: (maxAgeDays?: number) => Promise<{ purgedObservations: number; purgedCache: number; purgedMedia: number }>;

  /** Storage usage info */
  storageEstimate: { usageMB: number; quotaMB: number; percentUsed: number } | null;
  /** Refresh storage estimate */
  refreshStorage: () => Promise<void>;
}

type SyncStatus = SyncState['status'];

// ─── Hook ────────────────────────────────────────────────────────────────

export function useOfflineSync(): UseOfflineSyncReturn {
  const [state, setState] = useState<SyncState>(() => {
    if (typeof window !== 'undefined') {
      return getSyncManager().getState();
    }
    return {
      status: 'idle' as SyncStatus,
      pendingCount: 0,
      lastSyncAt: null,
      lastError: null,
      isOnline: true,
    };
  });

  const [storageEstimate, setStorageEstimate] = useState<ReturnType<typeof getStorageEstimate> extends Promise<infer R> ? R : null>(null);
  const managerRef = useRef(getSyncManager());

  // Subscribe to sync status changes
  useEffect(() => {
    const manager = managerRef.current;
    const unsubscribe = manager.onStatusChange((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  // Load storage estimate on mount
  useEffect(() => {
    getStorageEstimate().then(setStorageEstimate);
  }, []);

  // ─── Wrapped Actions ──────────────────────────────────────────────────

  const saveObservation = useCallback(
    async (obs: Parameters<UseOfflineSyncReturn['saveObservation']>[0]) => {
      return managerRef.current.saveObservation(obs);
    },
    []
  );

  const saveStation = useCallback(
    async (station: Parameters<UseOfflineSyncReturn['saveStation']>[0]) => {
      return managerRef.current.saveStation(station);
    },
    []
  );

  const updateObservation = useCallback(
    async (id: string, updates: Partial<OfflineObservation>) => {
      return managerRef.current.updateObservation(id, updates);
    },
    []
  );

  const deleteObservation = useCallback(
    async (id: string) => {
      return managerRef.current.deleteObservation(id);
    },
    []
  );

  const getObservations = useCallback(
    async (surveyId: string) => {
      return managerRef.current.getAllObservations(surveyId);
    },
    []
  );

  const getUnsyncedObservations = useCallback(
    async (surveyId: string) => {
      return managerRef.current.getUnsyncedObservations(surveyId);
    },
    []
  );

  const syncNow = useCallback(async () => {
    return managerRef.current.forceSyncNow();
  }, []);

  const cleanup = useCallback(async (maxAgeDays?: number) => {
    const result = await purgeStaleData(maxAgeDays);
    // Refresh storage estimate after cleanup
    const estimate = await getStorageEstimate();
    setStorageEstimate(estimate);
    return result;
  }, []);

  const refreshStorage = useCallback(async () => {
    const estimate = await getStorageEstimate();
    setStorageEstimate(estimate);
  }, []);

  return {
    state,
    isOnline: state.isOnline,
    pendingCount: state.pendingCount,
    lastSyncAt: state.lastSyncAt,
    status: state.status,
    lastError: state.lastError,

    saveObservation,
    saveStation,
    updateObservation,
    deleteObservation,

    getObservations,
    getUnsyncedObservations,

    syncNow,
    cleanup,

    storageEstimate,
    refreshStorage,
  };
}

// ─── Convenience Hook: Just Online Status ────────────────────────────────

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// ─── Convenience Hook: Pending Sync Count ────────────────────────────────

export function usePendingSyncCount(): number {
  const { pendingCount } = useOfflineSync();
  return pendingCount;
}
