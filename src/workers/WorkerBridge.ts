/**
 * METARDU Worker Bridge
 * ======================
 * Client-side wrapper that manages communication with the compute Web Worker.
 * Provides a Promise-based API for all worker operations.
 *
 * Usage:
 *   const result = await workerBridge.parseCSVPoints(csvText)
 *   const grid = await workerBridge.generateIDWGrid(params)
 *
 * The bridge automatically handles worker lifecycle (spawn on first use,
 * terminate on idle timeout), request correlation (matching responses to
 * requests by ID), and error propagation.
 */

import type {
  WorkerRequestType,
  WorkerResponseType,
  WorkerMessage,
} from './compute.worker'

type RequestId = string

interface PendingRequest {
  resolve: (payload: any) => void
  reject: (error: Error) => void
  startTime: number
}

class WorkerBridge {
  private worker: Worker | null = null
  private pendingRequests = new Map<RequestId, PendingRequest>()
  private idleTimeout: ReturnType<typeof setTimeout> | null = null
  private readonly IDLE_TIMEOUT = 30000 // 30 seconds
  private requestIdCounter = 0

  /**
   * Get or create the worker instance
   */
  private getWorker(): Worker {
    if (this.worker) {
      this.resetIdleTimeout()
      return this.worker
    }

    // Create worker from the compiled file
    // Next.js handles worker bundling via webpack config
    this.worker = new Worker(
      new URL('./compute.worker.ts', import.meta.url),
      { type: 'module' }
    )

    this.worker.onmessage = (event: MessageEvent<WorkerMessage<unknown>>) => {
      const { type, payload, id } = event.data
      const pending = this.pendingRequests.get(id)

      if (!pending) return

      if (type === 'ERROR') {
        pending.reject(new Error(String(payload)))
        this.pendingRequests.delete(id)
      } else if (type === 'PROGRESS') {
        // Progress updates don't resolve the promise
        // They're handled via the onProgress callback
      } else {
        pending.resolve(payload)
        this.pendingRequests.delete(id)
      }
    }

    this.worker.onerror = (error) => {
      console.error('[WorkerBridge] Worker error:', error)
      // Reject all pending requests
      this.pendingRequests.forEach((pending, id) => {
        pending.reject(new Error('Worker crashed'))
      })
      this.pendingRequests.clear()
      this.terminateWorker()
    }

    this.resetIdleTimeout()
    return this.worker
  }

  /**
   * Send a message to the worker and return a promise
   */
  private send<T = any>(type: WorkerRequestType, payload: any, timeoutMs = 60000): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `req_${Date.now()}_${this.requestIdCounter++}`
      const worker = this.getWorker()

      // Set up timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Worker request '${type}' timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      this.pendingRequests.set(id, {
        resolve: (payload) => {
          clearTimeout(timer)
          resolve(payload as T)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
        startTime: Date.now()
      })

      const message: WorkerMessage = { type, payload, id }
      worker.postMessage(message)
    })
  }

  /**
   * Reset idle timeout
   */
  private resetIdleTimeout() {
    if (this.idleTimeout) clearTimeout(this.idleTimeout)
    this.idleTimeout = setTimeout(() => this.terminateWorker(), this.IDLE_TIMEOUT)
  }

  /**
   * Terminate the worker (cleanup)
   */
  private terminateWorker() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout)
      this.idleTimeout = null
    }
    // Reject any remaining pending requests
    this.pendingRequests.forEach((pending) => {
      pending.reject(new Error('Worker terminated'))
    })
    this.pendingRequests.clear()
  }

  // ─── Public API ──────────────────────────────────────────────────────

  /**
   * Parse a CSV file containing survey control points
   * @param csvText - Raw CSV text
   * @param delimiter - Column delimiter (default ',')
   * @returns Parsed points array
   */
  async parseCSVPoints(csvText: string, delimiter = ',') {
    return this.send<{ points: unknown[]; count: number }>(
      'PARSE_CSV_POINTS',
      { csvText, delimiter }
    )
  }

  /**
   * Parse a CSV file containing field observations
   */
  async parseCSVObservations(csvText: string, delimiter = ',') {
    return this.send<{ observations: unknown[]; count: number }>(
      'PARSE_CSV_OBSERVATIONS',
      { csvText, delimiter }
    )
  }

  /**
   * Parse a CSV file containing leveling data
   */
  async parseCSVLeveling(csvText: string, delimiter = ',') {
    return this.send<{ readings: unknown[]; count: number }>(
      'PARSE_CSV_LEVELING',
      { csvText, delimiter }
    )
  }

  /**
   * Transform coordinates between CRS systems
   */
  async transformCoordinates(params: {
    fromEpsg: number
    toEpsg: number
    coordinates: Array<{ lat: number; lng: number } | { northing: number; easting: number }>
  }) {
    return this.send<{ coordinates: unknown[]; count: number }>(
      'TRANSFORM_COORDINATES',
      params,
      120000 // Longer timeout for bulk transforms
    )
  }

  /**
   * Compute bearing and distance between two points
   */
  async computeBearingDistance(
    from: { northing: number; easting: number },
    to: { northing: number; easting: number }
  ) {
    return this.send<{
      bearing: number
      distance: number
      dEasting: number
      dNorthing: number
    }>('COMPUTE_BEARING_DISTANCE', { from, to })
  }

  /**
   * Compute area from polygon coordinates (Shoelace)
   */
  async computeArea(coordinates: Array<{ northing: number; easting: number }>) {
    return this.send<{
      areaSqM: number
      areaHa: number
      areaAc: number
    }>('COMPUTE_AREA', { coordinates })
  }

  /**
   * Compute Bowditch traverse adjustment
   */
  async computeTraverseAdjustment(params: {
    legs: Array<{
      fromStation: string
      toStation: string
      angle: number
      distance: number
    }>
    startCoordinates: { northing: number; easting: number }
    startBearing: number
    closed: boolean
    endCoordinates?: { northing: number; easting: number }
  }) {
    return this.send<{
      adjustedLegs: unknown[]
      misclosure: {
        linear: number
        angular: number
        bearing: number
        ratio: string
      }
    }>('COMPUTE_TRAVERSE_ADJUSTMENT', params)
  }

  /**
   * Generate IDW interpolation grid from scattered points
   */
  async generateIDWGrid(params: {
    points: Array<{ x: number; y: number; value: number }>
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
    resolution: number
    power?: number
  }) {
    return this.send<{
      grid: number[][]
      rows: number
      cols: number
      bounds: any
    }>('GENERATE_IDW_GRID', params, 120000)
  }

  /**
   * Validate a field book entry
   */
  async validateFieldBook(entries: unknown[]) {
    return this.send<{ errors: unknown[]; warnings: unknown[] }>(
      'VALIDATE_FIELD_BOOK',
      { entries }
    )
  }

  /**
   * Check if the worker is alive
   */
  async ping(): Promise<boolean> {
    try {
      await this.send('PING', null, 5000)
      return true
    } catch {
      return false
    }
  }

  /**
   * Force-terminate the worker
   */
  dispose() {
    this.terminateWorker()
  }
}

// ─── Singleton Export ────────────────────────────────────────────────────

export const workerBridge = new WorkerBridge()
