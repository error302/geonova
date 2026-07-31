// ──────────────────────────────────────────────────────────────────────────
// METARDU — Offline IndexedDB Database Layer
// ──────────────────────────────────────────────────────────────────────────
// Provides persistent offline storage for field book data when surveyors
// work in areas without connectivity (rural Kenya, underground mines, etc).
//
// Stores: observations, stations, measurements, project snapshots
// Syncs: queued entries pushed to server when back online
// ──────────────────────────────────────────────────────────────────────────

import { openDB, IDBPDatabase, DBSchema } from 'idb';

// ─── Schema Definition ───────────────────────────────────────────────────

export interface OfflineObservation {
  id: string;
  surveyId: string;
  projectId: string;
  fromStationId: string;
  toStationId: string;
  rawHorizontalAngle: number | null;
  rawVerticalAngle: number | null;
  rawSlopeDistance: number | null;
  temperature: number | null;
  pressure: number | null;
  humidity: number | null;
  instrumentHeight: number | null;
  targetHeight: number | null;
  edmConstant: number | null;
  ppmSetting: number | null;
  observationDate: string | null;
  createdAt: number;       // epoch ms — when recorded offline
  updatedAt: number;
  synced: boolean;
  syncAttempts: number;
  lastSyncError: string | null;
}

export interface OfflineStation {
  id: string;
  surveyId: string;
  projectId: string;
  name: string;
  type: 'TRAVERSE' | 'CONTROL' | 'BEACON' | 'BENCHMARK';
  order: number;
  createdAt: number;
  synced: boolean;
}

export interface OfflineProjectSnapshot {
  projectId: string;
  data: unknown;
  cachedAt: number;
  expiresAt: number;
}

export interface OfflineMediaAttachment {
  id: string;
  observationId: string;
  type: 'beacon_photo' | 'field_sketch' | 'gnss_log';
  blob: Blob;
  filename: string;
  mimeType: string;
  createdAt: number;
  synced: boolean;
}

export interface SyncQueueEntry {
  id: string;
  operation: 'create' | 'update' | 'delete';
  entity: 'observation' | 'station' | 'media';
  entityId: string;
  payload: unknown;
  createdAt: number;
  attempts: number;
  lastError: string | null;
  priority: number; // lower = higher priority
}

interface MetarduOfflineDB extends DBSchema {
  observations: {
    key: string;
    value: OfflineObservation;
    indexes: {
      'by-survey': string;
      'by-project': string;
      'by-synced': number;
      'by-created': number;
    };
  };
  stations: {
    key: string;
    value: OfflineStation;
    indexes: {
      'by-survey': string;
      'by-synced': number;
    };
  };
  cache: {
    key: string;
    value: OfflineProjectSnapshot;
    indexes: {
      'by-expiry': number;
    };
  };
  media: {
    key: string;
    value: OfflineMediaAttachment;
    indexes: {
      'by-observation': string;
      'by-synced': number;
    };
  };
  syncQueue: {
    key: string;
    value: SyncQueueEntry;
    indexes: {
      'by-priority': [number, number]; // [priority, createdAt]
      'by-entity': string;
    };
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
}

// ─── Database Singleton ──────────────────────────────────────────────────

const DB_NAME = 'metardu-offline';
const DB_VERSION = 2;

let dbInstance: IDBPDatabase<MetarduOfflineDB> | null = null;

export async function getOfflineDB(): Promise<IDBPDatabase<MetarduOfflineDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<MetarduOfflineDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      // ── Version 1: Core stores ──
      if (oldVersion < 1) {
        const obsStore = db.createObjectStore('observations', { keyPath: 'id' });
        obsStore.createIndex('by-survey', 'surveyId');
        obsStore.createIndex('by-project', 'projectId');
        obsStore.createIndex('by-synced', 'synced');
        obsStore.createIndex('by-created', 'createdAt');

        const stationStore = db.createObjectStore('stations', { keyPath: 'id' });
        stationStore.createIndex('by-survey', 'surveyId');
        stationStore.createIndex('by-synced', 'synced');

        const cacheStore = db.createObjectStore('cache', { keyPath: 'projectId' });
        cacheStore.createIndex('by-expiry', 'expiresAt');

        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('by-priority', ['priority', 'createdAt']);
        syncStore.createIndex('by-entity', 'entity');

        db.createObjectStore('meta', { keyPath: 'key' });
      }

      // ── Version 2: Media attachments ──
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('media')) {
          const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
          mediaStore.createIndex('by-observation', 'observationId');
          mediaStore.createIndex('by-synced', 'synced');
        }
      }
    },
  });

  return dbInstance;
}

// ─── Cleanup Utilities ───────────────────────────────────────────────────

/**
 * Purge expired cache entries and already-synced data older than maxAgeDays.
 */
export async function purgeStaleData(maxAgeDays: number = 30): Promise<{
  purgedObservations: number;
  purgedCache: number;
  purgedMedia: number;
}> {
  const db = await getOfflineDB();
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let purgedObservations = 0;
  let purgedCache = 0;
  let purgedMedia = 0;

  // Purge synced observations older than cutoff
  const tx = db.transaction(['observations', 'cache', 'media'], 'readwrite');

  const syncedObs = await tx.objectStore('observations').index('by-synced').getAll(IDBKeyRange.bound(0, 1));
  for (const obs of syncedObs) {
    if (obs.synced && obs.createdAt < cutoff) {
      await tx.objectStore('observations').delete(obs.id);
      purgedObservations++;
    }
  }

  // Purge expired cache
  const allCache = await tx.objectStore('cache').index('by-expiry').getAll();
  for (const entry of allCache) {
    if (entry.expiresAt < Date.now()) {
      await tx.objectStore('cache').delete(entry.projectId);
      purgedCache++;
    }
  }

  // Purge synced media older than cutoff
  const syncedMedia = await tx.objectStore('media').index('by-synced').getAll(IDBKeyRange.bound(0, 1));
  for (const m of syncedMedia) {
    if (m.synced && m.createdAt < cutoff) {
      await tx.objectStore('media').delete(m.id);
      purgedMedia++;
    }
  }

  await tx.done;

  return { purgedObservations, purgedCache, purgedMedia };
}

/**
 * Get storage usage estimate (navigator.storage API).
 */
export async function getStorageEstimate(): Promise<{
  usageMB: number;
  quotaMB: number;
  percentUsed: number;
} | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return {
    usageMB: Math.round(usage / 1024 / 1024 * 100) / 100,
    quotaMB: Math.round(quota / 1024 / 1024),
    percentUsed: quota > 0 ? Math.round((usage / quota) * 10000) / 100 : 0,
  };
}
