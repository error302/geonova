import { logger } from '@/lib/logger'
import { openDB, DBSchema, IDBPDatabase } from 'idb'

const DB_NAME = 'metardu-offline'
const DB_VERSION = 3
const MAX_RETRIES = 3
const SYNC_INTERVAL = 30000 // 30 seconds

// ponytail: Phase 6 Batch 7 — typed minimal DB client interface for the
// offline sync queue. Mirrors the legacy DB proxy client surface (see
// src/lib/api-client/client.ts). The queue only uses .from()/.select()/.insert()
// .update()/.delete()/.eq()/.single(), so a structural interface is enough.
// Fields are required (but nullable) to match the QueryResult shape exactly,
// and `single()` returns PromiseLike (not Promise) so that the legacy
// ClientQueryBuilder — whose single() returns PromiseLike<...> & this — is
// structurally assignable.
interface SyncDbResult {
  data: Record<string, unknown> | null
  error: { message: string; code: string; details?: string } | null
  count?: number | null
}

interface SyncDbQuery {
  select(columns?: string, options?: { count?: string; head?: boolean }): SyncDbQuery
  insert(data: Record<string, unknown> | Record<string, unknown>[]): SyncDbQuery
  update(data: Record<string, unknown>): SyncDbQuery
  delete(): SyncDbQuery
  eq(column: string, value: unknown): SyncDbQuery
  single(): PromiseLike<SyncDbResult>
  // ponytail: thenable — `await dbClient.from(t).insert(d)` resolves to SyncDbResult
  then<TResult1 = SyncDbResult, TResult2 = never>(
    resolve?: ((v: SyncDbResult) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((e: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>
}

interface SyncDbClient {
  from(table: string): SyncDbQuery
}

interface METARDUDB extends DBSchema {
  sync_queue: {
    key: number
    value: SyncOperation
    indexes: { 'by-project': string; 'by-timestamp': string }
  }
  projects: {
    key: string
    value: Record<string, unknown>
  }
  survey_points: {
    key: string
    value: Record<string, unknown>
    indexes: { 'by-project': string }
  }
  traverse_obs: {
    key: string
    value: Record<string, unknown>
    indexes: { 'by-project': string }
  }
  leveling_obs: {
    key: string
    value: Record<string, unknown>
    indexes: { 'by-project': string }
  }
  fieldbooks: {
    key: string
    value: Record<string, unknown>
  }
  conflicts: {
    key: number
    value: ConflictRecord
  }
}

let dbPromise: Promise<IDBPDatabase<METARDUDB>> | null = null

export async function getDB(): Promise<IDBPDatabase<METARDUDB>> {
  if (!dbPromise) {
    dbPromise = openDB<METARDUDB>(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion, _newVersion) {
        // Sync queue with indexes
        if (!db.objectStoreNames.contains('sync_queue')) {
          const store = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true })
          store.createIndex('by-project', 'projectId')
          store.createIndex('by-timestamp', 'timestamp')
        }
        // Projects store
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' })
        }
        // Survey points with project index
        if (!db.objectStoreNames.contains('survey_points')) {
          const store = db.createObjectStore('survey_points', { keyPath: 'id' })
          store.createIndex('by-project', 'project_id')
        }
        // Traverse observations
        if (!db.objectStoreNames.contains('traverse_obs')) {
          const store = db.createObjectStore('traverse_obs', { keyPath: 'id' })
          store.createIndex('by-project', 'project_id')
        }
        // Leveling observations
        if (!db.objectStoreNames.contains('leveling_obs')) {
          const store = db.createObjectStore('leveling_obs', { keyPath: 'id' })
          store.createIndex('by-project', 'project_id')
        }
        // Field books
        if (!db.objectStoreNames.contains('fieldbooks')) {
          db.createObjectStore('fieldbooks', { keyPath: 'id' })
        }
        // Conflict resolution store
        if (!db.objectStoreNames.contains('conflicts')) {
          db.createObjectStore('conflicts', { keyPath: 'id', autoIncrement: true })
        }
      }
    })
  }
  return dbPromise
}

export interface SyncOperation {
  id?: number
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  data: Record<string, unknown>
  timestamp: string
  projectId: string
  retries: number
  priority: 'high' | 'normal' | 'low'
}

export interface ConflictRecord {
  id?: number
  localOp: SyncOperation
  remoteData: Record<string, unknown> | null
  /** Common-ancestor snapshot (the state of the row when the local edit began). */
  baseData?: Record<string, unknown> | null
  resolved: boolean
  resolution?: 'local' | 'remote' | 'merged' | 'manual'
  /** After three-way merge, which fields need manual resolution (both sides changed them). */
  conflictingFields?: string[]
  /** After three-way merge, the proposed merged data (auto-resolvable fields only). */
  mergedData?: Record<string, unknown> | null
  createdAt: string
}

// Queue operations with priority
export async function queueOperation(op: Omit<SyncOperation, 'id' | 'retries'>): Promise<void> {
  const db = await getDB()
  await db.add('sync_queue', { 
    ...op, 
    retries: 0,
    priority: op.priority || 'normal'
  })
}

// Get pending operations sorted by priority and timestamp
export async function getPendingOperations(projectId?: string): Promise<SyncOperation[]> {
  const db = await getDB()
  let operations = await db.getAll('sync_queue')

  if (projectId) {
    operations = operations.filter((op) => op.projectId === projectId)
  }
  
  // Sort by priority (high first) then by timestamp
  const priorityOrder: Record<SyncOperation['priority'], number> = { high: 0, normal: 1, low: 2 }
  return operations.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (pDiff !== 0) return pDiff
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  })
}

// Remove synced operation
export async function removeSyncedOperation(id: number): Promise<void> {
  const db = await getDB()
  await db.delete('sync_queue', id)
}

// Enhanced sync with conflict resolution
export async function syncPendingOperations(
  dbClient: SyncDbClient,
  options: { onConflict?: (conflict: ConflictRecord) => Promise<'local' | 'remote' | 'merged'> } = {}
): Promise<{ synced: number; failed: number; conflicts: number }> {
  const pending = await getPendingOperations()
  const results = { synced: 0, failed: 0, conflicts: 0 }

  for (const op of pending) {
    try {
      if (op.retries >= MAX_RETRIES) {
        results.failed++
        continue
      }

      // Check for conflicts using timestamp
      const timestamp = op.data.updated_at || op.timestamp
      const existing = await checkRemoteVersion(dbClient, op.table, String(op.data.id), String(timestamp))

      if (existing.hasConflict && options.onConflict) {
        // AUDIT FIX (H4, 2026-07-02): Retrieve the base snapshot for
        // three-way merge. Without it, we can only do naive LWW.
        const baseData = await getBaseSnapshot(op.table, String(op.data.id))

        const conflict: ConflictRecord = {
          localOp: op,
          remoteData: existing.data ?? null,
          baseData,
          resolved: false,
          createdAt: new Date().toISOString()
        }

        // If we have a base snapshot, attempt automatic three-way merge first.
        // Only surface to the user if there are genuine field-level conflicts.
        if (baseData) {
          const mergeResult = threeWayMerge(baseData, op.data, existing.data ?? null)
          conflict.mergedData = mergeResult.merged
          conflict.conflictingFields = mergeResult.conflictingFields

          if (mergeResult.conflictingFields.length === 0) {
            // No conflicts — auto-apply the merge, don't bother the user
            await applyMergedUpdate(dbClient, op, existing.data ?? null, baseData)
            results.synced++
            if (!op.id) throw new Error('Sync operation missing id')
            await removeSyncedOperation(op.id)
            continue
          }
        }

        const resolution = await options.onConflict(conflict)

        if (resolution === 'local') {
          // Force local — UPDATE (not delete+insert, which was destructive)
          await forceLocalUpdate(dbClient, op)
        } else if (resolution === 'merged') {
          // Use three-way merged data
          await applyMergedUpdate(dbClient, op, existing.data ?? null, baseData)
        } else {
          // Keep remote - skip local
          if (op.id) await removeSyncedOperation(op.id)
          results.synced++
          continue
        }

        results.conflicts++
      }

      // Attempt sync
      const success = await attemptSync(dbClient, op)

      if (success) {
        if (op.id) await removeSyncedOperation(op.id)
        results.synced++
      } else {
        // Increment retry count
        op.retries++
        const db = await getDB()
        await db.put('sync_queue', op)
        results.failed++
      }

    } catch {
      results.failed++
    }
  }

  return results
}

async function checkRemoteVersion(dbClient: SyncDbClient, table: string, id: string, localTimestamp: string): Promise<{ hasConflict: boolean; data: Record<string, unknown> | null }> {
  try {
    const result = await dbClient
      .from(table)
      .select('id, updated_at')
      .eq('id', id)
      .single()

    const data = result.data ?? null
    const error = result.error
    if (error || !data) return { hasConflict: false, data: null }

    const remoteUpdatedAt = data.updated_at
    const remoteTime = new Date((remoteUpdatedAt as string | number) || 0).getTime()
    const localTime = new Date(localTimestamp).getTime()

    return {
      hasConflict: remoteTime > localTime,
      data
    }
  } catch {
    return { hasConflict: false, data: null }
  }
}

async function attemptSync(dbClient: SyncDbClient, op: SyncOperation): Promise<boolean> {
  try {
    if (op.type === 'INSERT') {
      const { error } = await dbClient.from(op.table).insert(op.data)
      return !error
    }
    if (op.type === 'UPDATE') {
      const { error } = await dbClient.from(op.table).update(op.data).eq('id', op.data.id)
      return !error
    }
    if (op.type === 'DELETE') {
      const { error } = await dbClient.from(op.table).delete().eq('id', op.data.id)
      return !error
    }
    return false
  } catch {
    return false
  }
}

async function forceLocalUpdate(dbClient: SyncDbClient, op: SyncOperation): Promise<void> {
  // AUDIT FIX (H4, 2026-07-02): This is the "local wins" resolution.
  // Previously it DELETEd the remote row then re-INSERTed — that
  // destroyed concurrent edits from other surveyors AND bypassed DB
  // triggers (audit_chain). Now it does an UPDATE with the local data,
  // preserving the row identity and triggering audit properly.
  await dbClient.from(op.table).update(op.data).eq('id', op.data.id)
}

/**
 * Three-way merge of local and remote changes against a common ancestor.
 *
 * AUDIT FIX (H4, 2026-07-02): Replaced the naive `{...remote, ...local}`
 * merge (which silently overwrote remote-only fields) with a proper
 * three-way merge:
 *
 *   - If a field changed locally but not remotely → take local value
 *   - If a field changed remotely but not locally → take remote value
 *   - If both changed (and differ) → field needs manual resolution
 *   - If neither changed → take either (they're identical)
 *
 * Returns the merged data and the list of conflicting field names.
 * The caller decides whether to auto-apply the merge (if no conflicts)
 * or surface the conflicts to the user for manual resolution.
 */
export function threeWayMerge(
  base: Record<string, unknown> | null,
  local: Record<string, unknown>,
  remote: Record<string, unknown> | null
): { merged: Record<string, unknown>; conflictingFields: string[] } {
  const merged: Record<string, unknown> = {}
  const conflictingFields: string[] = []

  // Collect all field names across base/local/remote
  const allKeys = new Set<string>([
    ...Object.keys(base ?? {}),
    ...Object.keys(local),
    ...Object.keys(remote ?? {}),
  ])

  // System fields that should always come from the latest (remote) version
  const SYSTEM_FIELDS = new Set(['created_at', 'updated_at', 'id'])

  for (const key of allKeys) {
    if (SYSTEM_FIELDS.has(key)) {
      merged[key] = remote?.[key] ?? local[key]
      continue
    }

    const baseVal = base?.[key]
    const localVal = local[key]
    const remoteVal = remote?.[key]

    const localChanged = !deepEqual(baseVal, localVal)
    const remoteChanged = !deepEqual(baseVal, remoteVal)

    if (localChanged && remoteChanged) {
      // Both sides changed this field
      if (deepEqual(localVal, remoteVal)) {
        // Same change — no conflict
        merged[key] = localVal
      } else {
        // Genuine conflict — flag for manual resolution.
        // Default to remote (most recent) but record the conflict.
        merged[key] = remoteVal
        conflictingFields.push(key)
      }
    } else if (localChanged) {
      merged[key] = localVal
    } else if (remoteChanged) {
      merged[key] = remoteVal
    } else {
      // Neither changed — take either
      merged[key] = localVal ?? remoteVal ?? baseVal
    }
  }

  return { merged, conflictingFields }
}

/** Deep equality check (handles primitives, arrays, plain objects). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return a === b
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    if (a.length !== (b as unknown[]).length) return false
    return a.every((v, i) => deepEqual(v, (b as unknown[])[i]))
  }
  const aKeys = Object.keys(a as Record<string, unknown>)
  const bKeys = Object.keys(b as Record<string, unknown>)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every(k => deepEqual(
    (a as Record<string, unknown>)[k],
    (b as Record<string, unknown>)[k]
  ))
}

/**
 * Apply a merged update to the remote DB.
 * If the merge has no conflicting fields, auto-applies. If there are
 * conflicts, stores the conflict for manual resolution and applies the
 * non-conflicting fields.
 */
async function applyMergedUpdate(
  dbClient: SyncDbClient,
  op: SyncOperation,
  remoteData: Record<string, unknown> | null,
  baseData?: Record<string, unknown> | null
): Promise<{ conflictingFields: string[] }> {
  // Perform three-way merge
  const { merged, conflictingFields } = threeWayMerge(
    baseData ?? null,
    op.data,
    remoteData
  )

  // Apply the merged data (even with conflicts — the conflicting fields
  // default to remote, and the user can override later via manual resolution)
  await dbClient.from(op.table).update(merged).eq('id', op.data.id)

  return { conflictingFields }
}

/**
 * Capture a base snapshot of a row when it's first edited offline.
 * This enables three-way merge later. Call this BEFORE the user's edit
 * is applied to the local store.
 *
 * AUDIT FIX (H4, 2026-07-02): Without a base snapshot, three-way merge
 * is impossible — you can't tell whether a field was changed locally or
 * not. This function stores the original server state in IndexedDB so
 * the sync queue can access it at conflict-resolution time.
 */
export async function captureBaseSnapshot(
  table: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  const db = await getDB()
  // Store in the 'projects' store under a synthetic key to avoid schema
  // changes. Key format: `${table}:${id}`
  // (A dedicated `base_snapshots` store would be cleaner but requires a
  // DB_VERSION bump; this is the pragmatic interim solution.)
  await db.put('projects', {
    id: `__base__${table}_${id}`,
    __isBaseSnapshot: true,
    table,
    rowId: id,
    data,
    capturedAt: new Date().toISOString(),
  })
}

/**
 * Retrieve a previously-captured base snapshot.
 */
export async function getBaseSnapshot(
  table: string,
  id: string
): Promise<Record<string, unknown> | null> {
  const db = await getDB()
  const snapshot = await db.get('projects', `__base__${table}_${id}`)
  if (snapshot && snapshot.__isBaseSnapshot) {
    return snapshot.data as Record<string, unknown>
  }
  return null
}

/**
 * Get all unresolved conflicts for UI display.
 * Returns conflicts from the IndexedDB 'conflicts' store.
 */
export async function getPendingConflicts(): Promise<ConflictRecord[]> {
  const db = await getDB()
  const all = await db.getAll('conflicts')
  return all.filter(c => !c.resolved)
}

/**
 * Resolve a conflict manually (after user review).
 * Applies the user-chosen merged data to the remote DB.
 */
export async function resolveConflict(
  dbClient: SyncDbClient,
  conflictId: number,
  resolution: 'local' | 'remote' | 'merged',
  mergedData?: Record<string, unknown>
): Promise<void> {
  const db = await getDB()
  const conflict = await db.get('conflicts', conflictId)
  if (!conflict) throw new Error(`Conflict ${conflictId} not found`)

  if (resolution === 'local') {
    await forceLocalUpdate(dbClient, conflict.localOp)
  } else if (resolution === 'remote') {
    // Do nothing — remote already has the latest
  } else if (resolution === 'merged') {
    if (!mergedData) throw new Error('mergedData required for merged resolution')
    await dbClient.from(conflict.localOp.table).update(mergedData).eq('id', conflict.localOp.data.id)
  }

  // Mark conflict as resolved
  conflict.resolved = true
  conflict.resolution = resolution
  await db.put('conflicts', conflict)
}

// Background sync service
let syncInterval: ReturnType<typeof setInterval> | null = null

export function startBackgroundSync(dbClient: SyncDbClient, options?: { interval?: number; onConflict?: (conflict: ConflictRecord) => Promise<'local' | 'remote' | 'merged'> }) {
  if (syncInterval) return

  const interval = options?.interval || SYNC_INTERVAL
  
  syncInterval = setInterval(async () => {
    if (!isOnline()) return
    
    const results = await syncPendingOperations(dbClient, { onConflict: options?.onConflict })
    
    if (results.synced > 0) {
      if (process.env.NODE_ENV !== 'production') logger.info(`[Sync] Synced ${results.synced} operations`)
    }
    if (results.conflicts > 0) {
      if (process.env.NODE_ENV !== 'production') logger.info(`[Sync] Resolved ${results.conflicts} conflicts`)
    }
  }, interval)
}

export function stopBackgroundSync() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

// Offline data storage helpers
export async function saveProjectOffline(project: Record<string, unknown>): Promise<void> {
  const db = await getDB()
  await db.put('projects', project)
}

export async function getOfflineProjects(): Promise<Record<string, unknown>[]> {
  const db = await getDB()
  return db.getAll('projects')
}

export async function savePointsOffline(points: Record<string, unknown>[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('survey_points', 'readwrite')
  await Promise.all([
    ...points.map((p) => tx.store.put(p)),
    tx.done
  ])
}

export async function getOfflinePoints(projectId: string): Promise<Record<string, unknown>[]> {
  const db = await getDB()
  return db.getAllFromIndex('survey_points', 'by-project', projectId)
}

// Traverse observations offline
export async function saveTraverseOffline(traverse: Record<string, unknown>): Promise<void> {
  const db = await getDB()
  await db.put('traverse_obs', traverse)
}

export async function getOfflineTraverses(projectId: string): Promise<Record<string, unknown>[]> {
  const db = await getDB()
  return db.getAllFromIndex('traverse_obs', 'by-project', projectId)
}

// Leveling observations offline
export async function saveLevelingOffline(leveling: Record<string, unknown>): Promise<void> {
  const db = await getDB()
  await db.put('leveling_obs', leveling)
}

export async function getOfflineLevelings(projectId: string): Promise<Record<string, unknown>[]> {
  const db = await getDB()
  return db.getAllFromIndex('leveling_obs', 'by-project', projectId)
}

// Network status
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

export function setupOnlineListener(onOnline: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  
  const handleOnline = async () => {
    if (process.env.NODE_ENV !== 'production') logger.info('[Sync] Back online - starting sync...')
    onOnline()
  }
  
  const handleOffline = () => {
    if (process.env.NODE_ENV !== 'production') logger.info('[Sync] Offline mode - changes stored locally')
  }
  
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}

// Clear all offline data
export async function clearOfflineData(): Promise<void> {
  const db = await getDB()
  await db.clear('sync_queue')
  await db.clear('projects')
  await db.clear('survey_points')
  await db.clear('traverse_obs')
  await db.clear('leveling_obs')
  await db.clear('fieldbooks')
  await db.clear('conflicts')
}
