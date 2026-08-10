/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * METARDU Offline Field Book — IndexedDB-backed field data collection
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Works offline in rural Kenya (no 4G). Observations are stored in IndexedDB
 * and synced to PostgreSQL when connectivity returns.
 *
 * The surveyor's workflow becomes:
 *   1. Open field book on phone/tablet in the field (offline)
 *   2. Record observations (traverse stations, levels, topo points)
 *   3. Return to office → data auto-syncs to METARDU server
 *   4. Compute → Review → Submit
 *
 * No instrument software needed. No pen-and-paper. No Excel.
 */

import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'metardu-fieldbook'
const DB_VERSION = 1

// ─── Types ─────────────────────────────────────────────────────────────────

export type ObservationType = 'traverse' | 'leveling' | 'topo' | 'gnss' | 'hydro' | 'mining'

export interface OfflineObservation {
  id: string                  // UUID generated client-side
  projectId: string
  surveyType: ObservationType
  station: string             // Station name/number
  backsight?: string          // BS station
  foresight?: string          // FS station
  // Traverse fields
  bearingDeg?: number
  bearingMin?: number
  bearingSec?: number
  slopeDistance?: number
  horizontalDistance?: number
  verticalAngle?: number
  // Leveling fields
  backsightReading?: number   // BS staff reading
  foresightReading?: number   // FS staff reading
  // Topo fields
  easting?: number
  northing?: number
  elevation?: number
  // GNSS fields
  latitude?: number
  longitude?: number
  // Metadata
  notes?: string
  photoUrl?: string           // local blob URL (stored separately in IndexedDB)
  createdAt: string           // ISO timestamp
  syncedAt: string | null     // null = not yet synced
  syncError?: string          // last sync error message
}

export interface OfflineProject {
  id: string
  name: string
  surveyType: ObservationType
  createdAt: string
  lastModifiedAt: string
}

// ─── Database Schema ───────────────────────────────────────────────────────

interface FieldBookDB {
  observations: OfflineObservation[]
  projects: OfflineProject[]
  photos: { id: string; blob: Blob }
}

let dbPromise: Promise<IDBPDatabase<FieldBookDB>> | null = null

function getDB(): Promise<IDBPDatabase<FieldBookDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FieldBookDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const obsStore = db.createObjectStore('observations', { keyPath: 'id' })
        obsStore.createIndex('byProject', 'projectId')
        obsStore.createIndex('bySync', 'syncedAt')
        obsStore.createIndex('byProjectType', ['projectId', 'surveyType'])

        const projStore = db.createObjectStore('projects', { keyPath: 'id' })
        projStore.createIndex('byModified', 'lastModifiedAt')

        db.createObjectStore('photos', { keyPath: 'id' })
      },
    })
  }
  return dbPromise
}

// ─── Observation CRUD ──────────────────────────────────────────────────────

export async function saveObservation(obs: OfflineObservation): Promise<void> {
  const db = await getDB()
  await db.put('observations', obs)
}

export async function getObservations(projectId: string, surveyType?: ObservationType): Promise<OfflineObservation[]> {
  const db = await getDB()
  if (surveyType) {
    return (await db.getAllFromIndex('observations', 'byProjectType', [projectId, surveyType])) as OfflineObservation[]
  }
  return (await db.getAllFromIndex('observations', 'byProject', projectId)) as OfflineObservation[]
}

export async function deleteObservation(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('observations', id)
}

export async function getUnsyncedObservations(): Promise<OfflineObservation[]> {
  const db = await getDB()
  // ponytail: getAllFromIndex with null — IndexedDB doesn't support querying
  // for null values directly. Get all and filter. For a few hundred observations
  // this is fine; for thousands, add a separate 'unsynced' store.
  const all = (await db.getAll('observations')) as OfflineObservation[]
  return all.filter(o => o.syncedAt === null)
}

// ─── Photo Storage ─────────────────────────────────────────────────────────

export async function savePhoto(id: string, blob: Blob): Promise<void> {
  const db = await getDB()
  await db.put('photos', { id, blob })
}

export async function getPhoto(id: string): Promise<Blob | null> {
  const db = await getDB()
  const result = (await db.get('photos', id)) as { id: string; blob: Blob } | undefined
  return result?.blob ?? null
}

// ─── Sync ──────────────────────────────────────────────────────────────────

export async function syncObservations(): Promise<{ synced: number; failed: number; errors: string[] }> {
  const unsynced = await getUnsyncedObservations()
  if (unsynced.length === 0) return { synced: 0, failed: 0, errors: [] }

  let synced = 0
  let failed = 0
  const errors: string[] = []

  for (const obs of unsynced) {
    try {
      const res = await fetch('/api/fieldbook/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(obs),
      })

      if (res.ok) {
        obs.syncedAt = new Date().toISOString()
        obs.syncError = undefined
        await saveObservation(obs)
        synced++
      } else {
        const err = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
        obs.syncError = err.error || `HTTP ${res.status}`
        await saveObservation(obs)
        failed++
        errors.push(`${obs.station}: ${obs.syncError}`)
      }
    } catch (err) {
      // Network error — will retry on next sync cycle
      obs.syncError = err instanceof Error ? err.message : 'Network error'
      await saveObservation(obs)
      failed++
      errors.push(`${obs.station}: ${obs.syncError}`)
    }
  }

  return { synced, failed, errors }
}

// ─── Connectivity ──────────────────────────────────────────────────────────

export function isOnline(): boolean {
  return navigator.onLine
}

export function onConnectivityChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

// ─── Auto-sync ─────────────────────────────────────────────────────────────

let syncInterval: ReturnType<typeof setInterval> | null = null

export function startAutoSync(intervalMs = 30000): void {
  if (syncInterval) return

  // Sync immediately on start
  syncObservations().catch(console.error)

  // Sync on connectivity restore
  const unsubscribe = onConnectivityChange((online) => {
    if (online) syncObservations().catch(console.error)
  })

  // Sync periodically
  syncInterval = setInterval(() => {
    if (isOnline()) {
      syncObservations().catch(console.error)
    }
  }, intervalMs)

  // Store unsubscribe for cleanup
  ;(startAutoSync as unknown as { _unsubscribe?: () => void })._unsubscribe = unsubscribe
}

export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
  const unsub = (startAutoSync as unknown as { _unsubscribe?: () => void })._unsubscribe
  if (unsub) {
    unsub()
    ;(startAutoSync as unknown as { _unsubscribe?: () => void })._unsubscribe = undefined
  }
}

// ─── Utility ───────────────────────────────────────────────────────────────

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `obs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export async function getSyncStatus(): Promise<{ total: number; unsynced: number; synced: number }> {
  const db = await getDB()
  const all = (await db.getAll('observations')) as OfflineObservation[]
  const unsynced = all.filter(o => o.syncedAt === null)
  return {
    total: all.length,
    unsynced: unsynced.length,
    synced: all.length - unsynced.length,
  }
}
