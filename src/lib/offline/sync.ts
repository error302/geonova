/**
 * @deprecated This module is a thin compatibility layer over syncQueue.ts (v2).
 * Import from './syncQueue' directly for new code.
 *
 * The v1 sync functions operated on the observations store which no longer
 * exists in DB_VERSION=3. All sync operations now go through the priority
 * queue in syncQueue.ts.
 */

import {
  getDB,
  syncPendingOperations,
  isOnline as isOnlineV2,
  setupOnlineListener,
  clearOfflineData,
  type SyncOperation,
} from './syncQueue'

export interface SyncResult {
  success: boolean
  synced: number
  failed: number
  errors: string[]
}

export interface SyncProgress {
  total: number
  current: number
  status: 'idle' | 'syncing' | 'complete' | 'error'
  message: string
}

export type SyncProgressCallback = (progress: SyncProgress) => void

/**
 * @deprecated Use syncPendingOperations from syncQueue.ts directly.
 * This wrapper exists for backward compatibility.
 */
export async function syncProject(
  projectId: string,
  onProgress?: SyncProgressCallback
): Promise<SyncResult> {
  const { getPendingOperations } = await import('./syncQueue')
  const pending = await getPendingOperations(projectId)

  if (pending.length === 0) {
    return { success: true, synced: 0, failed: 0, errors: [] }
  }

  onProgress?.({
    total: pending.length,
    current: 0,
    status: 'syncing',
    message: 'Starting sync...',
  })

  // Use a simple fetch-based sync (v1 style) as fallback
  let synced = 0
  let failed = 0
  const errors: string[] = []

  for (let i = 0; i < pending.length; i++) {
    const op = pending[i]

    onProgress?.({
      total: pending.length,
      current: i + 1,
      status: 'syncing',
      message: `Syncing operation ${i + 1} of ${pending.length}...`,
    })

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op),
      })

      if (response.ok) {
        if (op.id) {
          const { removeSyncedOperation } = await import('./syncQueue')
          await removeSyncedOperation(op.id)
        }
        synced++
      } else {
        const error = await response.text()
        errors.push(`Operation ${op.type} on ${op.table}: ${error}`)
        failed++
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`Operation ${op.type} on ${op.table}: ${message}`)
      failed++
    }
  }

  // Update project last_sync timestamp
  if (failed === 0) {
    const db = await getDB()
    const project = await db.get('projects', projectId)
    if (project) {
      project.last_sync = new Date().toISOString()
      project.dirty = false
      await db.put('projects', project)
    }
  }

  onProgress?.({
    total: pending.length,
    current: pending.length,
    status: failed === 0 ? 'complete' : 'error',
    message: failed === 0
      ? `Synced ${synced} operations`
      : `Synced ${synced}, failed ${failed}`,
  })

  return {
    success: failed === 0,
    synced,
    failed,
    errors,
  }
}

/**
 * @deprecated Use isOnline from syncQueue.ts directly.
 */
export function isOnline(): boolean {
  return isOnlineV2()
}

/**
 * @deprecated Use setupOnlineListener from syncQueue.ts directly.
 */
export function registerNetworkListeners(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  return setupOnlineListener(onOnline)
}

/**
 * @deprecated Use startBackgroundSync from syncQueue.ts directly.
 */
export function enableAutoSync(projectId: string): () => void {
  let syncing = false

  const handleOnline = async () => {
    if (syncing) return
    syncing = true
    try {
      await syncProject(projectId)
    } finally {
      syncing = false
    }
  }

  return setupOnlineListener(handleOnline)
}
