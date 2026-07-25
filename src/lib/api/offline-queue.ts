/**
 * Offline Mutation Queue — v0.3 redesign
 *
 * Per native-data-fetching + system-design skills:
 * - Stores pending mutations in IndexedDB when offline
 * - Generates client UUIDs for optimistic inserts
 * - Syncs FIFO when reconnects (oldest first)
 * - Handles conflicts by UUID (server reconciles)
 *
 * Usage:
 *   import { offlineQueue } from '@/lib/api/offline-queue'
 *
 *   // When a mutation fails because we're offline:
 *   await offlineQueue.enqueue({
 *     url: '/api/v1/projects/123/observations',
 *     method: 'POST',
 *     body: { station: 'T1', bearing: '87°14\'22"', distance: 124.83 },
 *     clientUuid: crypto.randomUUID(),
 *   })
 *
 *   // The queue auto-syncs on reconnect. Subscribe to know when it drains:
 *   const unsubscribe = offlineQueue.onSyncComplete(() => refetchData())
 */

import { onlineManager } from '@tanstack/react-query'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface QueuedMutation {
  id: string                  // client-generated UUID, primary key
  url: string                 // API endpoint, e.g. '/api/v1/projects/123/observations'
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown              // request body (JSON-serializable)
  createdAt: number           // epoch ms, for FIFO ordering
  attempts: number            // retry counter
  lastError?: string          // last error message, for debugging
  // Optional: which query keys to invalidate after this mutation syncs
  invalidateQueries?: string[][]
}

// ─── IndexedDB storage (lazy-initialized) ───────────────────────────────────

const DB_NAME = 'metardu-offline'
const STORE_NAME = 'mutations'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function getDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available'))
  }
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
  })
  return dbPromise
}

async function dbAdd(mutation: QueuedMutation): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).add(mutation)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function dbGetAll(): Promise<QueuedMutation[]> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result as QueuedMutation[])
    req.onerror = () => reject(req.error)
  })
}

async function dbDelete(id: string): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function dbUpdate(mutation: QueuedMutation): Promise<void> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(mutation)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ─── Queue class ────────────────────────────────────────────────────────────

class OfflineMutationQueue {
  private syncing = false
  private listeners = new Set<() => void>()

  /** Subscribe to sync-complete events. Returns unsubscribe fn. */
  onSyncComplete(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private notifySyncComplete() {
    this.listeners.forEach(fn => {
      try { fn() } catch { /* listener error — don't break sync */ }
    })
  }

  /** Returns true if IndexedDB is available (i.e. we're in a browser). */
  isAvailable(): boolean {
    return typeof indexedDB !== 'undefined'
  }

  /** Enqueue a mutation for later sync. Generates a UUID if not provided. */
  async enqueue(m: Omit<QueuedMutation, 'id' | 'createdAt' | 'attempts'> & { id?: string }): Promise<QueuedMutation> {
    const mutation: QueuedMutation = {
      id: m.id || (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID()! : `mut-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      url: m.url,
      method: m.method,
      body: m.body,
      createdAt: Date.now(),
      attempts: 0,
      invalidateQueries: m.invalidateQueries,
    }
    await dbAdd(mutation)
    return mutation
  }

  /** Returns the count of pending mutations (0 if unavailable). */
  async pendingCount(): Promise<number> {
    if (!this.isAvailable()) return 0
    try {
      const all = await dbGetAll()
      return all.length
    } catch {
      return 0
    }
  }

  /** Returns all pending mutations, ordered oldest-first. */
  async pending(): Promise<QueuedMutation[]> {
    if (!this.isAvailable()) return []
    try {
      const all = await dbGetAll()
      return all.sort((a, b) => a.createdAt - b.createdAt)
    } catch {
      return []
    }
  }

  /**
   * Sync all pending mutations. Called automatically on reconnect.
   * Returns the number of successfully synced mutations.
   *
   * Stops on first failure to preserve order (FIFO). Failed mutation
   * gets attempts++ and lastError set; will be retried next sync.
   */
  async sync(): Promise<{ synced: number; failed: number; remaining: number }> {
    if (this.syncing) return { synced: 0, failed: 0, remaining: 0 }
    if (!this.isAvailable()) return { synced: 0, failed: 0, remaining: 0 }
    if (!onlineManager.isOnline()) return { synced: 0, failed: 0, remaining: 0 }

    this.syncing = true
    let synced = 0
    let failed = 0

    try {
      const queue = await this.pending()
      for (const mutation of queue) {
        try {
          const response = await fetch(mutation.url, {
            method: mutation.method,
            headers: {
              'Content-Type': 'application/json',
              'X-Client-UUID': mutation.id,
            },
            body: mutation.body ? JSON.stringify(mutation.body) : undefined,
          })
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          await dbDelete(mutation.id)
          synced++
        } catch (err) {
          // Don't retry 4xx — those are client errors, will fail again
          if (err instanceof Error && /HTTP 4\d\d/.test(err.message)) {
            await dbDelete(mutation.id)
            failed++
            console.warn(`[offline-queue] dropping 4xx mutation ${mutation.id}:`, err.message)
          } else {
            // Network error or 5xx — increment attempts, will retry next sync
            mutation.attempts++
            mutation.lastError = err instanceof Error ? err.message : String(err)
            await dbUpdate(mutation)
            // Stop sync on first network failure to preserve order
            break
          }
        }
      }

      const remaining = await this.pendingCount()
      if (synced > 0) this.notifySyncComplete()
      return { synced, failed, remaining }
    } finally {
      this.syncing = false
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const offlineQueue = new OfflineMutationQueue()

// ─── Auto-sync on reconnect ─────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  // Sync when browser comes back online
  window.addEventListener('online', () => {
    offlineQueue.sync().catch(err => {
      console.error('[offline-queue] sync failed on reconnect:', err)
    })
  })

  // Also subscribe to React Query's onlineManager (covers Capacitor Network plugin)
  onlineManager.subscribe(() => {
    if (onlineManager.isOnline()) {
      offlineQueue.sync().catch(err => {
        console.error('[offline-queue] sync failed on onlineManager event:', err)
      })
    }
  })

  // On page load, if we're online, try to drain any pending mutations from last session
  setTimeout(() => {
    if (navigator.onLine) {
      offlineQueue.sync().catch(() => { /* silent — will retry on next online event */ })
    }
  }, 2000)
}
