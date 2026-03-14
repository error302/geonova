import { openDB, DBSchema, IDBPDatabase } from 'idb'

const DB_NAME = 'geonova-offline'
const DB_VERSION = 2

interface GeoNovaDB extends DBSchema {
  sync_queue: {
    key: number
    value: {
      id?: number
      type: 'INSERT' | 'UPDATE' | 'DELETE'
      table: string
      data: Record<string, any>
      timestamp: string
      projectId: string
      retries: number
    }
  }
  projects: {
    key: string
    value: any
  }
  survey_points: {
    key: string
    value: any
  }
  fieldbooks: {
    key: string
    value: any
  }
}

let dbPromise: Promise<IDBPDatabase<GeoNovaDB>> | null = null

export async function getDB(): Promise<IDBPDatabase<GeoNovaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<GeoNovaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', {
            keyPath: 'id',
            autoIncrement: true
          })
        }
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('survey_points')) {
          db.createObjectStore('survey_points', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('fieldbooks')) {
          db.createObjectStore('fieldbooks', { keyPath: 'id' })
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
}

export async function queueOperation(op: Omit<SyncOperation, 'id' | 'retries'>): Promise<void> {
  const db = await getDB()
  await db.add('sync_queue', { ...op, retries: 0 })
}

export async function getPendingOperations(): Promise<SyncOperation[]> {
  const db = await getDB()
  return db.getAll('sync_queue')
}

export async function removeSyncedOperation(id: number): Promise<void> {
  const db = await getDB()
  await db.delete('sync_queue', id)
}

export async function syncPendingOperations(supabase: any): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingOperations()
  const results = { synced: 0, failed: 0 }

  for (const op of pending) {
    try {
      if (op.type === 'INSERT') {
        const { error } = await supabase.from(op.table).insert(op.data)
        if (!error) {
          if (op.id) {
            await removeSyncedOperation(op.id)
          }
          results.synced++
        } else {
          results.failed++
        }
      }
      if (op.type === 'UPDATE') {
        const { error } = await supabase
          .from(op.table)
          .update(op.data)
          .eq('id', op.data.id)
        if (!error) {
          if (op.id) {
            await removeSyncedOperation(op.id)
          }
          results.synced++
        } else {
          results.failed++
        }
      }
      if (op.type === 'DELETE') {
        const { error } = await supabase
          .from(op.table)
          .delete()
          .eq('id', op.data.id)
        if (!error) {
          if (op.id) {
            await removeSyncedOperation(op.id)
          }
          results.synced++
        } else {
          results.failed++
        }
      }
    } catch (e) {
      results.failed++
    }
  }
  return results
}

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
    ...points.map(p => tx.store.put(p)),
    tx.done
  ])
}

export async function getOfflinePoints(projectId: string): Promise<any[]> {
  const db = await getDB()
  const allPoints = await db.getAll('survey_points')
  return allPoints.filter(p => p.project_id === projectId)
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

export async function setupOnlineListener(onOnline: () => void): Promise<void> {
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', () => {
      console.log('Offline mode - changes will sync when connected')
    })
  }
}
