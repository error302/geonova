/**
 * Sync Service for Mobile Field Data
 * Handles upload when connectivity returns
 */

import { offlineStorage, SyncQueueItem, type FieldObservation, type PhotoData } from './offlineStorage'
import type { BrowserClient } from '@/lib/api-client/client'
import { createClient } from '@/lib/api-client/client'

// The sync queue stores the same records offlineStorage persists, with the
// generated id and a server-side timestamp guaranteed by addToSyncQueue.
type ObservationPayload = FieldObservation & { id: string; timestamp: number }
type PhotoPayload = PhotoData & { id: string; timestamp: number }

interface SurveyPointPayload {
  id: string
  projectId: string
  name: string
  easting: number
  northing: number
  elevation?: number
  isControl?: boolean
  description?: string
  timestamp: number
}

class SyncService {
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  private syncInterval: NodeJS.Timeout | null = null
  private isSyncing = false

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline())
      window.addEventListener('offline', () => this.handleOffline())
    }
  }

  startAutoSync(intervalMs = 30000) {
    if (this.syncInterval) return

    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncPending()
      }
    }, intervalMs)
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  private handleOnline() {
    this.isOnline = true
    this.syncPending()
  }

  private handleOffline() {
    this.isOnline = false
  }

  async syncPending(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing) return { synced: 0, failed: 0 }
    if (!this.isOnline) return { synced: 0, failed: 0 }

    this.isSyncing = true
    const items = await offlineStorage.getPendingSyncItems()

    let synced = 0
    let failed = 0

    for (const item of items) {
      const id = item.id
      if (!id) { failed++; continue }
      try {
        await this.syncItem(item)
        synced++
      } catch (error) {
        failed++
        // eslint-disable-next-line no-console -- background sync loop operational log, not user-facing UI
        console.error('[Sync] Failed to sync item:', item.id, error)

        // Mark as failed after 3 retries
        if ((item.retryCount || 0) >= 3) {
          await offlineStorage.updateSyncStatus(
            id,
            'failed',
            error instanceof Error ? error.message : 'Unknown error'
          )
        } else {
          await offlineStorage.updateSyncStatus(id, 'pending')
        }
      }
    }

    this.isSyncing = false
    return { synced, failed }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    if (!item.id) throw new Error('Sync item missing id')
    const dbClient = createClient()

    await offlineStorage.updateSyncStatus(item.id, 'syncing')

    switch (item.type) {
      case 'field_observation':
        await this.syncObservation(dbClient, item.data as ObservationPayload)
        break
      case 'photo':
        await this.syncPhoto(dbClient, item.data as PhotoPayload)
        break
      case 'survey_point':
        await this.syncSurveyPoint(dbClient, item.data as SurveyPointPayload)
        break
    }

    await offlineStorage.updateSyncStatus(item.id, 'synced')
    await offlineStorage.removeFromSyncQueue(item.id)
  }

  private async syncObservation(dbClient: BrowserClient, payload: ObservationPayload): Promise<void> {
    const { error } = await dbClient.from('survey_observations').insert({
      project_id: payload.projectId,
      point_name: payload.pointName,
      point_id: payload.pointId,
      observation_type: payload.observationType,
      northing: payload.northing,
      easting: payload.easting,
      elevation: payload.elevation,
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy: payload.accuracy,
      satellites: payload.satellites,
      solution_type: payload.solutionType,
      hdop: payload.hdop,
      vdop: payload.vdop,
      pdop: payload.pdop,
      instrument_height: payload.instrumentHeight,
      rod_height: payload.rodHeight,
      backsight: payload.backsight,
      foresight: payload.foresight,
      horizontal_angle: payload.horizontalAngle,
      vertical_angle: payload.verticalAngle,
      slope_distance: payload.slopeDistance,
      temperature: payload.temperature,
      pressure: payload.pressure,
      humidity: payload.humidity,
      weather: payload.weather,
      notes: payload.notes,
      observed_at: new Date(payload.timestamp).toISOString(),
    })

    if (error) throw error

    // Mark observation as synced
    await offlineStorage.update('field_observations', payload.id, { synced: true })
  }

  private async syncPhoto(dbClient: BrowserClient, payload: PhotoPayload): Promise<void> {
    // First upload the image to storage
    const fileName = `field_photos/${payload.projectId}/${payload.id}.jpg`
    const base64Data = payload.data.split(',')[1]
    const blob = Buffer.from(base64Data, 'base64')

    const { error: uploadError } = await dbClient.storage.from('survey-photos').upload(fileName, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    })

    if (uploadError) throw uploadError

    // Then create the database record
    const { error } = await dbClient.from('field_photos').insert({
      project_id: payload.projectId,
      point_id: payload.pointId,
      point_name: payload.pointName,
      storage_path: fileName,
      thumbnail: payload.thumbnail,
      caption: payload.caption,
      orientation: payload.orientation,
      captured_at: new Date(payload.timestamp).toISOString(),
    }).select().single()

    if (error) throw error

    await offlineStorage.update('photos', payload.id, { synced: true, storagePath: fileName })
  }

  private async syncSurveyPoint(dbClient: BrowserClient, payload: SurveyPointPayload): Promise<void> {
    const { error } = await dbClient.from('survey_points').upsert({
      id: payload.id,
      project_id: payload.projectId,
      name: payload.name,
      easting: payload.easting,
      northing: payload.northing,
      elevation: payload.elevation,
      is_control: payload.isControl,
      description: payload.description,
      observed_at: new Date(payload.timestamp).toISOString(),
    })

    if (error) throw error
  }

  async forceSync(): Promise<{ synced: number; failed: number }> {
    return this.syncPending()
  }

  getSyncStatus(): { isOnline: boolean; isSyncing: boolean } {
    return { isOnline: this.isOnline, isSyncing: this.isSyncing }
  }
}

export const syncService = new SyncService()
export default syncService
