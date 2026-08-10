/**
 * @deprecated This module is a thin re-export layer over syncQueue.ts (v2).
 * The v1 IndexedDB database (DB_VERSION=1) is superseded by v2 (DB_VERSION=3)
 * which provides conflict resolution, priority queues, and richer data types.
 *
 * Import from './syncQueue' directly for new code.
 * This file exists only for backward compatibility.
 */

// ─── Re-export all v2 functions as the canonical implementations ───
export {
  getDB as getOfflineDB,
  queueOperation as addToSyncQueue,
  getPendingOperations as getSyncQueue,
  removeSyncedOperation as removeSyncQueueItem,
  saveProjectOffline,
  getOfflineProjects as getAllProjectsOffline,
  clearOfflineData,
  isOnline,
  setupOnlineListener,
  syncPendingOperations,
  startBackgroundSync,
  stopBackgroundSync,
  savePointsOffline,
  getOfflinePoints,
  saveTraverseOffline,
  getOfflineTraverses,
  saveLevelingOffline,
  getOfflineLevelings,
  type SyncOperation,
  type ConflictRecord,
} from './syncQueue'

// ─── Deprecated v1 type aliases (backward compatibility) ───

/**
 * @deprecated Use the `projects` store shape from syncQueue.ts instead.
 * Kept for backward compatibility with code that imports OfflineProject.
 */
export interface OfflineProject {
  id: string
  name: string
  survey_type: string
  created_at: string
  last_sync: string | null
  dirty: boolean
}

/**
 * @deprecated Use the `traverse_obs` or `leveling_obs` stores from syncQueue.ts instead.
 * Kept for backward compatibility with code that imports OfflineObservation.
 */
export interface OfflineObservation {
  id: string
  project_id: string
  station_from: string
  station_to: string
  horizontal_angle: number
  vertical_angle: number
  slope_distance: number
  target_height: number
  instrument_height: number
  remarks: string
  photo_url?: string
  timestamp: string
  synced: boolean
}

/**
 * @deprecated Use SyncOperation from syncQueue.ts instead.
 * Kept for backward compatibility with code that imports SyncQueueItem.
 */
export interface SyncQueueItem {
  id: string
  type: 'observation' | 'project'
  action: 'create' | 'update' | 'delete'
  data: OfflineObservation | OfflineProject
  attempts: number
  last_attempt: string | null
  error?: string
}

// ─── Deprecated v1 function wrappers (delegate to v2) ───

/**
 * @deprecated Use saveProjectOffline from syncQueue.ts directly.
 */
export async function getProjectOffline(projectId: string): Promise<OfflineProject | undefined> {
  const { getDB } = await import('./syncQueue')
  const db = await getDB()
  return db.get('projects', projectId) as Promise<OfflineProject | undefined>
}

/**
 * @deprecated Use getOfflineProjects from syncQueue.ts directly.
 */
export async function saveObservationOffline(observation: OfflineObservation): Promise<void> {
  const { getDB, queueOperation } = await import('./syncQueue')
  const db = await getDB()
  // Store in traverse_obs as the closest v2 equivalent
  await db.put('traverse_obs', observation as unknown as Record<string, unknown>)
  await queueOperation({
    type: 'INSERT',
    table: 'observations',
    data: observation as unknown as Record<string, unknown>,
    timestamp: new Date().toISOString(),
    projectId: observation.project_id,
    priority: 'normal',
  })
}

/**
 * @deprecated Use getOfflineTraverses from syncQueue.ts directly.
 */
export async function getObservationsOffline(projectId: string): Promise<OfflineObservation[]> {
  const { getDB } = await import('./syncQueue')
  const db = await getDB()
  const all = await db.getAllFromIndex('traverse_obs', 'by-project', projectId)
  return (all as unknown as OfflineObservation[]).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

/**
 * @deprecated Use getPendingOperations from syncQueue.ts with project filter.
 */
export async function getUnsyncedObservations(projectId: string): Promise<OfflineObservation[]> {
  const { getDB } = await import('./syncQueue')
  const db = await getDB()
  const all = await db.getAllFromIndex('traverse_obs', 'by-project', projectId)
  return (all as unknown as OfflineObservation[]).filter(o => !o.synced)
}

/**
 * @deprecated Synced state is managed by syncQueue's removeSyncedOperation.
 */
export async function markObservationSynced(observationId: string): Promise<void> {
  const { getDB } = await import('./syncQueue')
  const db = await getDB()
  const obs = await db.get('traverse_obs', observationId)
  if (obs) {
    ;(obs as any).synced = true
    await db.put('traverse_obs', obs)
  }
}

/**
 * @deprecated Use queueOperation from syncQueue.ts directly.
 */
export async function updateSyncQueueItem(item: import('./syncQueue').SyncOperation): Promise<void> {
  const { getDB } = await import('./syncQueue')
  const db = await getDB()
  await db.put('sync_queue', item)
}

/**
 * @deprecated Use getPendingOperations from syncQueue.ts directly.
 */
export async function getOfflineStats(projectId?: string): Promise<{
  totalProjects: number
  totalObservations: number
  unsyncedObservations: number
  dirtyProjects: number
}> {
  const { getDB, getPendingOperations } = await import('./syncQueue')
  const db = await getDB()
  const projects = await db.getAll('projects')
  const observations = projectId
    ? await db.getAllFromIndex('traverse_obs', 'by-project', projectId)
    : await db.getAll('traverse_obs')
  const pending = await getPendingOperations(projectId)

  return {
    totalProjects: projects.length,
    totalObservations: observations.length,
    unsyncedObservations: (observations as any[]).filter(o => !o.synced).length,
    dirtyProjects: pending.length,
  }
}
