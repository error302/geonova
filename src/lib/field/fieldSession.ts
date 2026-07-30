/**
 * Field Session Manager — orchestrates the field data collection workflow
 *
 * Ties together: instrumentStore (connection) + fieldBookDB (persistence)
 * + liveToleranceChecker (QC) + syncQueue (sync) + stakeout (navigation)
 *
 * Works offline-first: all measurements saved locally, synced when online.
 */

import { useInstrumentStore } from '@/stores/instrumentStore'
import { checkTolerance, type ToleranceCheckResult } from '@/lib/survey/liveToleranceChecker'

// ─── Types ──────────────────────────────────────────────────────────────────

export type SurveyType = 'cadastral' | 'engineering' | 'topographic' | 'control' | 'leveling'
export type InstrumentType = 'total_station' | 'gnss_rover' | 'gnss_static' | 'level'
export type MeasurementMode = 'traverse' | 'radiation' | 'stakeout' | 'leveling' | 'walk'

export interface StationSetup {
  stationName: string
  instrumentHeight: number
  targetHeight: number
  backsightStation?: string
  backsightBearing?: { deg: number; min: number; sec: number }
  temperature?: number
  pressure?: number
  isControlPoint: boolean
  easting?: number
  northing?: number
  elevation?: number
}

export interface FieldMeasurement {
  id: string
  timestamp: number
  pointId: string
  stationFrom: string
  stationTo?: string
  // GNSS observations (from StreamedPoint)
  latitude?: number
  longitude?: number
  elevation?: number
  fixQuality?: string
  satellites?: number
  hdop?: number
  // Total station observations (from GSI parser — future)
  slopeDistance?: number
  horizontalAngle?: { deg: number; min: number; sec: number }
  verticalAngle?: { deg: number; min: number; sec: number }
  // Reduced coordinates
  easting?: number
  northing?: number
  // Metadata
  instrumentType: InstrumentType
  mode: MeasurementMode
  notes?: string
  synced: boolean
}

export interface FieldSessionState {
  projectId: string
  surveyType: SurveyType
  setup: StationSetup | null
  measurements: FieldMeasurement[]
  stakeoutTarget: { easting: number; northing: number; elevation: number } | null
  toleranceStatus: ToleranceCheckResult | null
  isOnline: boolean
  isSyncing: boolean
  pendingSyncCount: number
  lastSyncAt: number | null
}

// ─── Field Session Class ────────────────────────────────────────────────────

class FieldSession {
  private state: FieldSessionState
  private listeners: Set<(state: FieldSessionState) => void> = new Set()

  constructor(projectId: string, surveyType: SurveyType) {
    this.state = {
      projectId,
      surveyType,
      setup: null,
      measurements: [],
      stakeoutTarget: null,
      toleranceStatus: null,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: false,
      pendingSyncCount: 0,
      lastSyncAt: null,
    }
  }

  subscribe = (listener: (state: FieldSessionState) => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getSnapshot = (): FieldSessionState => this.state

  private setState(updates: Partial<FieldSessionState>) {
    this.state = { ...this.state, ...updates }
    this.listeners.forEach(l => l(this.state))
  }

  // ─── Station Setup ────────────────────────────────────────────────────────

  setupStation(setup: StationSetup) {
    this.setState({ setup })
  }

  isReady(): boolean {
    return this.state.setup !== null
  }

  // ─── Measurement Capture ──────────────────────────────────────────────────

  /**
   * Capture a measurement from the connected instrument.
   * Reads the latest reading from the instrument store and saves it.
   */
  async captureMeasurement(params: {
    pointId: string
    stationTo?: string
    targetHeight?: number
    notes?: string
  }): Promise<FieldMeasurement | null> {
    if (!this.state.setup) {
      console.warn('[field-session] Cannot capture — station not set up')
      return null
    }

    const instrumentStore = useInstrumentStore.getState()
    const latestPoint = instrumentStore.latestPoint

    if (!latestPoint) {
      console.warn('[field-session] No instrument reading available')
      return null
    }

    // Determine instrument type from the reading source
    const instrumentType: InstrumentType = latestPoint.source === 'nmea'
      ? 'gnss_rover'
      : latestPoint.source === 'gsi'
        ? 'total_station'
        : 'gnss_rover'

    // Build the measurement from the StreamedPoint
    const measurement: FieldMeasurement = {
      id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      pointId: params.pointId,
      stationFrom: this.state.setup.stationName,
      stationTo: params.stationTo,
      // GNSS fields (from StreamedPoint)
      latitude: latestPoint.latitude,
      longitude: latestPoint.longitude,
      elevation: latestPoint.elevation ?? undefined,
      fixQuality: latestPoint.quality != null
        ? (latestPoint.quality >= 4 ? 'fixed' : latestPoint.quality >= 2 ? 'float' : 'single')
        : undefined,
      satellites: latestPoint.satellites,
      hdop: latestPoint.hdop,
      // Reduced coordinates (StreamedPoint has easting/northing)
      easting: latestPoint.easting,
      northing: latestPoint.northing,
      // Metadata
      instrumentType,
      mode: this.state.surveyType === 'leveling' ? 'leveling' : 'traverse',
      notes: params.notes,
      synced: false,
    }

    // Save to IndexedDB (offline-first)
    try {
      const { saveObservation } = await import('@/lib/offline/fieldBookDB')
      await saveObservation({
        id: measurement.id,
        projectId: this.state.projectId,
        surveyType: measurement.mode as 'traverse' | 'leveling' | 'topo' | 'gnss' | 'hydro' | 'mining',
        station: measurement.stationFrom,
        backsight: this.state.setup.backsightStation,
        foresight: measurement.stationTo,
        // GNSS fields
        latitude: measurement.latitude,
        longitude: measurement.longitude,
        // Coordinates
        easting: measurement.easting,
        northing: measurement.northing,
        elevation: measurement.elevation,
        // Metadata
        notes: measurement.notes,
        createdAt: new Date(measurement.timestamp).toISOString(),
        syncedAt: null,
      })
    } catch (err) {
      console.error('[field-session] Failed to save offline:', err)
    }

    // Add to session state
    const measurements = [...this.state.measurements, measurement]
    this.setState({ measurements, pendingSyncCount: this.state.pendingSyncCount + 1 })

    // Trigger haptic feedback (mobile)
    this.hapticFeedback()

    return measurement
  }

  /**
   * Trigger haptic feedback on measurement capture.
   */
  private hapticFeedback() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(50)
    }
  }

  // ─── Stakeout ─────────────────────────────────────────────────────────────

  activateStakeout(target: { easting: number; northing: number; elevation: number }) {
    this.setState({ stakeoutTarget: target })
  }

  deactivateStakeout() {
    this.setState({ stakeoutTarget: null })
  }

  // ─── Sync ─────────────────────────────────────────────────────────────────

  async syncNow(): Promise<{ synced: number; failed: number }> {
    if (this.state.isSyncing) return { synced: 0, failed: 0 }

    this.setState({ isSyncing: true })

    try {
      const { syncObservations } = await import('@/lib/offline/fieldBookDB')
      const result = await syncObservations()

      const syncedCount = result.synced || 0
      const failedCount = result.failed || 0

      // Mark synced measurements
      const measurements = this.state.measurements.map(m => ({
        ...m,
        synced: m.synced || (syncedCount > 0 && !this.state.measurements.find(x => x.id === m.id && !x.synced)),
      }))

      this.setState({
        isSyncing: false,
        measurements,
        pendingSyncCount: Math.max(0, this.state.pendingSyncCount - syncedCount),
        lastSyncAt: Date.now(),
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      })

      return { synced: syncedCount, failed: failedCount }
    } catch (err) {
      console.error('[field-session] Sync failed:', err)
      this.setState({ isSyncing: false })
      return { synced: 0, failed: this.state.pendingSyncCount }
    }
  }

  /**
   * Load existing measurements from IndexedDB (for session resume).
   */
  async loadMeasurements() {
    try {
      const { getObservations } = await import('@/lib/offline/fieldBookDB')
      const observations = await getObservations(this.state.projectId)
      const measurements: FieldMeasurement[] = observations.map((obs: any) => ({
        id: obs.id,
        timestamp: new Date(obs.createdAt).getTime(),
        pointId: '',
        stationFrom: obs.station || '',
        stationTo: obs.foresight || undefined,
        latitude: obs.latitude,
        longitude: obs.longitude,
        elevation: obs.elevation ?? undefined,
        easting: obs.easting,
        northing: obs.northing,
        instrumentType: obs.latitude ? 'gnss_rover' : 'total_station',
        mode: (obs.surveyType as MeasurementMode) || 'traverse',
        notes: obs.notes,
        synced: obs.syncedAt != null,
      }))
      this.setState({
        measurements,
        pendingSyncCount: measurements.filter(m => !m.synced).length,
      })
    } catch (err) {
      console.warn('[field-session] Failed to load measurements:', err)
    }
  }

  /**
   * Clear all measurements.
   */
  clearMeasurements() {
    this.setState({ measurements: [], pendingSyncCount: 0, toleranceStatus: null })
  }
}

// ─── Session Registry ───────────────────────────────────────────────────────

const sessions = new Map<string, FieldSession>()

export function getFieldSession(projectId: string, surveyType: SurveyType = 'cadastral'): FieldSession {
  const key = `${projectId}:${surveyType}`
  if (!sessions.has(key)) {
    sessions.set(key, new FieldSession(projectId, surveyType))
  }
  return sessions.get(key)!
}

// ─── React Hook ─────────────────────────────────────────────────────────────

export function useFieldSession(options: {
  projectId: string
  surveyType?: SurveyType
}): FieldSession {
  const { projectId, surveyType = 'cadastral' } = options
  return getFieldSession(projectId, surveyType)
}
