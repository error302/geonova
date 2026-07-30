// ──────────────────────────────────────────────────────────────────────────
// METARDU — Offline Sync Manager
// ──────────────────────────────────────────────────────────────────────────
// Handles:
//   - Queueing field data for offline storage
//   - Background sync when connectivity returns
//   - Conflict detection and resolution
//   - Retry with exponential backoff
//   - Sync status events for UI updates
//
// Usage:
//   const sync = getSyncManager();
//   await sync.saveObservation(observation);  // saves locally + queues sync
//   sync.forceSyncNow();                      // manual sync trigger
//   sync.onStatusChange((status) => { ... }); // listen for status
// ──────────────────────────────────────────────────────────────────────────

import {
  getOfflineDB,
  OfflineObservation,
  OfflineStation,
  SyncQueueEntry,
  type OfflineMediaAttachment,
} from './db';

// ─── Types ───────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncAt: number | null;
  lastError: string | null;
  isOnline: boolean;
}

export interface SyncResult {
  synced: number;
  failed: number;
  conflicts: number;
  duration: number;
}

type StatusListener = (state: SyncState) => void;

// ─── Constants ───────────────────────────────────────────────────────────

const MAX_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 1000;
const SYNC_DEBOUNCE_MS = 3000;
const BATCH_SIZE = 20;

// ─── Sync Manager Singleton ──────────────────────────────────────────────

class SyncManager {
  private state: SyncState = {
    status: 'idle',
    pendingCount: 0,
    lastSyncAt: null,
    lastError: null,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  };

  private listeners: Set<StatusListener> = new Set();
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private isSyncing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Listen for online/offline events
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());

      // Listen for visibility change (sync when user returns to tab)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.state.isOnline) {
          this.scheduleSync();
        }
      });

      // Initial pending count
      this.refreshPendingCount();
    }
  }

  // ─── Public API: Save Data ───────────────────────────────────────────

  /**
   * Save an observation locally and queue for sync.
   */
  async saveObservation(obs: Omit<OfflineObservation, 'synced' | 'syncAttempts' | 'lastSyncError' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const db = await getOfflineDB();
    const now = Date.now();

    const record: OfflineObservation = {
      ...obs,
      createdAt: now,
      updatedAt: now,
      synced: false,
      syncAttempts: 0,
      lastSyncError: null,
    };

    await db.put('observations', record);

    // Queue sync entry
    await this.enqueue({
      operation: 'create',
      entity: 'observation',
      entityId: record.id,
      payload: record,
      priority: 1,
    });

    this.scheduleSync();
    await this.refreshPendingCount();

    return record.id;
  }

  /**
   * Update an existing observation locally and queue for sync.
   */
  async updateObservation(id: string, updates: Partial<OfflineObservation>): Promise<void> {
    const db = await getOfflineDB();
    const existing = await db.get('observations', id);
    if (!existing) throw new Error(`Observation ${id} not found in offline store`);

    const updated: OfflineObservation = {
      ...existing,
      ...updates,
      id, // ensure id is not overwritten
      updatedAt: Date.now(),
      synced: false,
      syncAttempts: 0,
      lastSyncError: null,
    };

    await db.put('observations', updated);

    await this.enqueue({
      operation: 'update',
      entity: 'observation',
      entityId: id,
      payload: updated,
      priority: 1,
    });

    this.scheduleSync();
    await this.refreshPendingCount();
  }

  /**
   * Save a station locally and queue for sync.
   */
  async saveStation(station: Omit<OfflineStation, 'synced' | 'createdAt'>): Promise<void> {
    const db = await getOfflineDB();
    const record: OfflineStation = {
      ...station,
      createdAt: Date.now(),
      synced: false,
    };

    await db.put('stations', record);

    await this.enqueue({
      operation: 'create',
      entity: 'station',
      entityId: record.id,
      payload: record,
      priority: 2,
    });

    this.scheduleSync();
    await this.refreshPendingCount();
  }

  /**
   * Save a media attachment (photo, sketch) for later sync.
   */
  async saveMedia(media: Omit<OfflineMediaAttachment, 'synced' | 'createdAt'>): Promise<void> {
    const db = await getOfflineDB();
    const record: OfflineMediaAttachment = {
      ...media,
      createdAt: Date.now(),
      synced: false,
    };

    await db.put('media', record);

    await this.enqueue({
      operation: 'create',
      entity: 'media',
      entityId: record.id,
      payload: { ...record, blob: undefined }, // Don't queue blob in sync entry
      priority: 3,
    });

    this.scheduleSync();
    await this.refreshPendingCount();
  }

  // ─── Public API: Read Data ───────────────────────────────────────────

  /**
   * Get all unsynced observations for a survey.
   */
  async getUnsyncedObservations(surveyId: string): Promise<OfflineObservation[]> {
    const db = await getOfflineDB();
    const all = await db.getAllFromIndex('observations', 'by-survey', surveyId);
    return all.filter((obs) => !obs.synced);
  }

  /**
   * Get all observations for a survey (both synced and unsynced).
   */
  async getAllObservations(surveyId: string): Promise<OfflineObservation[]> {
    const db = await getOfflineDB();
    return db.getAllFromIndex('observations', 'by-survey', surveyId);
  }

  /**
   * Get a single observation by id.
   */
  async getObservation(id: string): Promise<OfflineObservation | undefined> {
    const db = await getOfflineDB();
    return db.get('observations', id);
  }

  /**
   * Delete an observation locally.
   */
  async deleteObservation(id: string): Promise<void> {
    const db = await getOfflineDB();
    await db.delete('observations', id);

    await this.enqueue({
      operation: 'delete',
      entity: 'observation',
      entityId: id,
      payload: { id },
      priority: 1,
    });

    this.scheduleSync();
    await this.refreshPendingCount();
  }

  /**
   * Get the count of pending (unsynced) items.
   */
  async getPendingCount(): Promise<number> {
    const db = await getOfflineDB();
    const queue = await db.getAll('syncQueue');
    return queue.length;
  }

  // ─── Public API: Sync Control ────────────────────────────────────────

  /**
   * Force an immediate sync attempt.
   */
  async forceSyncNow(): Promise<SyncResult> {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    return this.executeSync();
  }

  /**
   * Get current sync state.
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * Subscribe to sync status changes.
   */
  onStatusChange(listener: StatusListener): () => void {
    this.listeners.add(listener);
    // Emit current state immediately
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  // ─── Internal: Sync Execution ────────────────────────────────────────

  private async executeSync(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { synced: 0, failed: 0, conflicts: 0, duration: 0 };
    }

    if (!this.state.isOnline) {
      this.updateState({ status: 'offline' });
      return { synced: 0, failed: 0, conflicts: 0, duration: 0 };
    }

    this.isSyncing = true;
    this.updateState({ status: 'syncing', lastError: null });

    const startTime = performance.now();
    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    try {
      const db = await getOfflineDB();

      // Get sync queue sorted by priority
      const queue = await db.getAllFromIndex('syncQueue', 'by-priority');

      // Process in batches
      for (let i = 0; i < queue.length; i += BATCH_SIZE) {
        const batch = queue.slice(i, i + BATCH_SIZE);

        for (const entry of batch) {
          try {
            const result = await this.syncEntry(entry);

            if (result === 'conflict') {
              conflicts++;
              // Keep in queue but mark conflict
              await db.put('syncQueue', {
                ...entry,
                attempts: entry.attempts + 1,
                lastError: 'CONFLICT: Server version differs',
              });
            } else {
              // Success — remove from queue
              await db.delete('syncQueue', entry.id);
              synced++;
            }
          } catch (err) {
            const attempts = entry.attempts + 1;
            const errorMsg = err instanceof Error ? err.message : String(err);

            if (attempts >= MAX_RETRY_ATTEMPTS) {
              // Max retries reached — remove from queue, mark as failed
              await db.delete('syncQueue', entry.id);
              await this.markEntitySyncFailed(entry.entity, entry.entityId, errorMsg);
              failed++;
            } else {
              // Update retry count
              await db.put('syncQueue', {
                ...entry,
                attempts,
                lastError: errorMsg,
              });
              failed++;
            }
          }
        }
      }

      const duration = Math.round(performance.now() - startTime);
      const pendingCount = await this.getPendingCount();

      this.updateState({
        status: 'idle',
        pendingCount,
        lastSyncAt: Date.now(),
        lastError: null,
      });

      return { synced, failed, conflicts, duration };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.updateState({
        status: 'error',
        lastError: errorMsg,
      });
      return { synced, failed, conflicts, duration: Math.round(performance.now() - startTime) };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single queue entry to the server.
   */
  private async syncEntry(entry: SyncQueueEntry): Promise<'ok' | 'conflict'> {
    const endpoint = this.getEndpoint(entry.entity);
    const method = entry.operation === 'delete' ? 'DELETE' : entry.operation === 'update' ? 'PUT' : 'POST';

    const res = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Source': 'offline',
        'X-Sync-Entry-Id': entry.id,
      },
      body: JSON.stringify(entry.payload),
    });

    if (res.status === 409) {
      return 'conflict';
    }

    if (!res.ok) {
      throw new Error(`Sync failed: ${res.status} ${res.statusText}`);
    }

    // Mark entity as synced in local DB
    await this.markEntitySynced(entry.entity, entry.entityId);

    return 'ok';
  }

  private getEndpoint(entity: SyncQueueEntry['entity']): string {
    switch (entity) {
      case 'observation':
        return '/api/sync/observations';
      case 'station':
        return '/api/sync/stations';
      case 'media':
        return '/api/sync/media';
      default:
        throw new Error(`Unknown entity type: ${entity}`);
    }
  }

  private async markEntitySynced(entity: SyncQueueEntry['entity'], entityId: string): Promise<void> {
    const db = await getOfflineDB();

    if (entity === 'observation') {
      const obs = await db.get('observations', entityId);
      if (obs) {
        await db.put('observations', { ...obs, synced: true, lastSyncError: null });
      }
    } else if (entity === 'station') {
      const station = await db.get('stations', entityId);
      if (station) {
        await db.put('stations', { ...station, synced: true });
      }
    } else if (entity === 'media') {
      const media = await db.get('media', entityId);
      if (media) {
        await db.put('media', { ...media, synced: true });
      }
    }
  }

  private async markEntitySyncFailed(entity: SyncQueueEntry['entity'], entityId: string, error: string): Promise<void> {
    const db = await getOfflineDB();

    if (entity === 'observation') {
      const obs = await db.get('observations', entityId);
      if (obs) {
        await db.put('observations', { ...obs, lastSyncError: error });
      }
    }
  }

  // ─── Internal: Queue Management ──────────────────────────────────────

  private async enqueue(entry: Omit<SyncQueueEntry, 'id' | 'createdAt' | 'attempts' | 'lastError'>): Promise<void> {
    const db = await getOfflineDB();
    const record: SyncQueueEntry = {
      ...entry,
      id: `sync_${entry.entity}_${entry.entityId}_${Date.now()}`,
      createdAt: Date.now(),
      attempts: 0,
      lastError: null,
    };
    await db.put('syncQueue', record);
  }

  // ─── Internal: Connectivity ──────────────────────────────────────────

  private handleOnline(): void {
    this.updateState({ isOnline: true, status: 'idle' });
    this.scheduleSync();
  }

  private handleOffline(): void {
    this.updateState({ isOnline: false, status: 'offline' });
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private scheduleSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    this.syncTimer = setTimeout(() => {
      this.executeSync();
    }, SYNC_DEBOUNCE_MS);
  }

  // ─── Internal: State Management ──────────────────────────────────────

  private updateState(partial: Partial<SyncState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('[SyncManager] Listener error:', err);
      }
    }
  }

  private async refreshPendingCount(): Promise<void> {
    try {
      const count = await this.getPendingCount();
      this.updateState({ pendingCount: count });
    } catch {
      // DB might not be available during SSR
    }
  }
}

// ─── Singleton Export ────────────────────────────────────────────────────

let instance: SyncManager | null = null;

export function getSyncManager(): SyncManager {
  if (!instance) {
    instance = new SyncManager();
  }
  return instance;
}
