import { openDB, DBSchema, IDBPDatabase } from 'idb'

const DB_NAME = 'metardu-offline'
const DB_VERSION = 3
const MAX_RETRIES = 3
const SYNC_INTERVAL = 30000 // 30 seconds

interface METARDUDB extends DBSchema {
  sync_queue: {
    key: number
    value: SyncOperation
    indexes: { 'by-project': string; 'by-timestamp': string }
  }
  projects: {
    key: string
    value: any
  }
  survey_points: {
    key: string
    value: any
    indexes: { 'by-project': string }
  }
  traverse_obs: {
    key: string
    value: any
    indexes: { 'by-project': string }
  }
  leveling_obs: {
    key: string
    value: any
    indexes: { 'by-project': string }
  }
  fieldbooks: {
    key: string
    value: any
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
      upgrade(db, oldVersion, newVersion) {
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
  data: Record<string, any>
  timestamp: string
  projectId: string
  retries: number
  priority: 'high' | 'normal' | 'low'
}

export interface ConflictRecord {
  id?: number
  localOp: SyncOperation
  remoteData: any
  resolved: boolean
  resolution?: 'local' | 'remote' | 'merged'
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
    operations = operations.filter((op: any) => op.projectId === projectId)
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

// Exponential backoff retry
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Enhanced sync with conflict resolution
export async function syncPendingOperations(
  supabase: any, 
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
      const existing = await checkRemoteVersion(supabase, op.table, op.data.id, timestamp)

      if (existing.hasConflict && options.onConflict) {
        const conflict: ConflictRecord = {
          localOp: op,
          remoteData: existing.data,
          resolved: false,
          createdAt: new Date().toISOString()
        }
        
        const resolution = await options.onConflict(conflict)
        
        if (resolution === 'local') {
          // Force local - delete remote and re-insert
          await forceLocalUpdate(supabase, op)
        } else if (resolution === 'merged') {
          // Use merged data
          await applyMergedUpdate(supabase, op, existing.data)
        } else {
          // Keep remote - skip local
          if (op.id) await removeSyncedOperation(op.id)
          results.synced++
          continue
        }
        
        results.conflicts++
      }

      // Attempt sync
      const success = await attemptSync(supabase, op)
      
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
      
    } catch (e) {
      results.failed++
    }
  }
  
  return results
}

async function checkRemoteVersion(supabase: any, table: string, id: string, localTimestamp: string) {
  try {
    const { data, error } = await supabase
      .from(table)
      .select('id, updated_at')
      .eq('id', id)
      .single()
    
    if (error || !data) return { hasConflict: false, data: null }
    
    const remoteTime = new Date(data.updated_at || 0).getTime()
    const localTime = new Date(localTimestamp).getTime()
    
    return { 
      hasConflict: remoteTime > localTime, 
      data 
    }
  } catch {
    return { hasConflict: false, data: null }
  }
}

async function attemptSync(supabase: any, op: SyncOperation): Promise<boolean> {
  try {
    if (op.type === 'INSERT') {
      const { error } = await supabase.from(op.table).insert(op.data)
      return !error
    }
    if (op.type === 'UPDATE') {
      const { error } = await supabase.from(op.table).update(op.data).eq('id', op.data.id)
      return !error
    }
    if (op.type === 'DELETE') {
      const { error } = await supabase.from(op.table).delete().eq('id', op.data.id)
      return !error
    }
    return false
  } catch {
    return false
  }
}

async function forceLocalUpdate(supabase: any, op: SyncOperation): Promise<void> {
  // Delete remote and re-insert with local data
  await supabase.from(op.table).delete().eq('id', op.data.id)
  await supabase.from(op.table).insert(op.data)
}

async function applyMergedUpdate(supabase: any, op: SyncOperation, remoteData: any): Promise<void> {
  // Merge: take remote created_at but local updated values
  const merged = { ...remoteData, ...op.data }
  await supabase.from(op.table).update(merged).eq('id', op.data.id)
}

// Background sync service
let syncInterval: ReturnType<typeof setInterval> | null = null

export function startBackgroundSync(supabase: any, options?: { interval?: number; onConflict?: (conflict: ConflictRecord) => Promise<'local' | 'remote' | 'merged'> }) {
  if (syncInterval) return
  
  const interval = options?.interval || SYNC_INTERVAL
  
  syncInterval = setInterval(async () => {
    if (!isOnline()) return
    
    const results = await syncPendingOperations(supabase, { onConflict: options?.onConflict })
    
    if (results.synced > 0) {
      if (process.env.NODE_ENV !== 'production') console.log(`[Sync] Synced ${results.synced} operations`)
    }
    if (results.conflicts > 0) {
      if (process.env.NODE_ENV !== 'production') console.log(`[Sync] Resolved ${results.conflicts} conflicts`)
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
export async function saveProjectOffline(project: any): Promise<void> {
  const db = await getDB()
  await db.put('projects', project)
}

export async function getOfflineProjects(): Promise<any[]> {
  const db = await getDB()
  return db.getAll('projects')
}

export async function savePointsOffline(points: any[]): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('survey_points', 'readwrite')
  await Promise.all([
    ...points.map((p: any) => tx.store.put(p)),
    tx.done
  ])
}

export async function getOfflinePoints(projectId: string): Promise<any[]> {
  const db = await getDB()
  return db.getAllFromIndex('survey_points', 'by-project', projectId)
}

// Traverse observations offline
export async function saveTraverseOffline(traverse: any): Promise<void> {
  const db = await getDB()
  await db.put('traverse_obs', traverse)
}

export async function getOfflineTraverses(projectId: string): Promise<any[]> {
  const db = await getDB()
  return db.getAllFromIndex('traverse_obs', 'by-project', projectId)
}

// Leveling observations offline  
export async function saveLevelingOffline(leveling: any): Promise<void> {
  const db = await getDB()
  await db.put('leveling_obs', leveling)
}

export async function getOfflineLevelings(projectId: string): Promise<any[]> {
  const db = await getDB()
  return db.getAllFromIndex('leveling_obs', 'by-project', projectId)
}

// Network status
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

export async function setupOnlineListener(onOnline: () => void): Promise<() => void> {
  if (typeof window === 'undefined') return () => {}
  
  const handleOnline = async () => {
    if (process.env.NODE_ENV !== 'production') console.log('[Sync] Back online - starting sync...')
    onOnline()
  }
  
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', () => {
    if (process.env.NODE_ENV !== 'production') console.log('[Sync] Offline mode - changes stored locally')
  })
  
  return () => {
    window.removeEventListener('online', handleOnline)
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
