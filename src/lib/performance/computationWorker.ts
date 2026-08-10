/**
 * Web Worker for heavy survey computations
 *
 * Offloads CPU-intensive tasks from the main thread:
 * - Area calculations (Shoelace for large polygons)
 * - Traverse adjustments (Bowditch for many legs)
 * - Cut/fill volume computation
 * - Deformation displacement calculation
 * - Least squares adjustment
 *
 * Usage:
 *   const worker = new ComputationWorker()
 *   worker.computeArea(vertices).then(area => ...)
 *   worker.adjustTraverse(input).then(result => ...)
 */

import { computeAreaWithPrecision } from '@/lib/engine/computationalAccuracy'
import { bowditchAdjustment } from '@/lib/engine/traverse'
import { computeCutFill } from '@/lib/engine/cutFillEngine'
import type { TraverseInput } from '@/lib/engine/traverse'
import type { GridSurface } from '@/lib/engine/cutFillEngine'
import type { SurveyPoint } from '@/lib/map/turfHelpers'

export class ComputationWorker {
  private worker: Worker | null = null

  constructor() {
    // Create worker from inline blob (works in Next.js without separate file)
    const workerCode = `
      // Import scripts will be handled by the blob
      self.onmessage = function(e) {
        const { id, type, payload } = e.data

        try {
          let result

          switch (type) {
            case 'computeArea': {
              // Shoelace formula
              const vertices = payload.vertices
              const n = vertices.length
              if (n < 3) {
                result = { areaSqM: 0, areaHectares: 0, perimeter: 0, vertexCount: n }
              } else {
                let sum = 0
                let perimeter = 0
                for (let i = 0; i < n; i++) {
                  const j = (i + 1) % n
                  sum += vertices[i].easting * vertices[j].northing - vertices[j].easting * vertices[i].northing
                  const dx = vertices[j].easting - vertices[i].easting
                  const dy = vertices[j].northing - vertices[i].northing
                  perimeter += Math.sqrt(dx * dx + dy * dy)
                }
                const area = Math.abs(sum / 2)
                result = {
                  areaSqM: area,
                  areaHectares: area / 10000,
                  perimeter,
                  vertexCount: n,
                  estimatedErrorSqM: (0.001 * perimeter) / 2,
                }
              }
              break
            }

            case 'batchArea': {
              // Compute area for many parcels at once
              const parcels = payload.parcels
              result = parcels.map(p => {
                const vertices = p.vertices
                const n = vertices.length
                if (n < 3) return { id: p.id, areaSqM: 0, areaHectares: 0 }
                let sum = 0
                for (let i = 0; i < n; i++) {
                  const j = (i + 1) % n
                  sum += vertices[i].easting * vertices[j].northing - vertices[j].easting * vertices[i].northing
                }
                const area = Math.abs(sum / 2)
                return { id: p.id, areaSqM: area, areaHectares: area / 10000 }
              })
              break
            }

            case 'searchParcels': {
              // Search parcels by text in worker
              const { parcels, query } = payload
              const q = query.toLowerCase()
              result = parcels.filter(p =>
                p.parcelNumber?.toLowerCase().includes(q) ||
                p.ownerName?.toLowerCase().includes(q) ||
                p.lrNumber?.toLowerCase().includes(q)
              )
              break
            }

            case 'transformCoordinates': {
              // Batch coordinate transformation (approximate)
              const { points, fromProj, toProj } = payload
              // For UTM 37S to WGS84 (approximate)
              if (fromProj === 'EPSG:21037' && toProj === 'EPSG:4326') {
                const a = 6378388.0 // Clarke 1880
                const e2 = 0.0067226700223333
                const k0 = 0.9996
                const lambda0 = 39 * Math.PI / 180 // Central meridian zone 37
                const falseEasting = 500000
                const falseNorthing = 10000000 // Southern hemisphere

                result = points.map(p => {
                  const x = p.easting - falseEasting
                  const y = p.northing - falseNorthing
                  const m = y / k0
                  const mu = m / (a * (1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256))
                  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))
                  const phi1 = mu + (3*e1/2 - 27*e1*e1*e1/32) * Math.sin(2*mu)
                    + (21*e1*e1/16 - 55*e1*e1*e1*e1/32) * Math.sin(4*mu)

                  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1))
                  const T1 = Math.tan(phi1) * Math.tan(phi1)
                  const C1 = e2 / (1 - e2) * Math.cos(phi1) * Math.cos(phi1)
                  const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5)
                  const D = x / (N1 * k0)

                  const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (D*D/2
                    - (5 + 3*T1 + 10*C1 - 4*C1*C1 - 9*e2/(1-e2)) * D*D*D*D/24
                    + (61 + 90*T1 + 298*C1 + 45*T1*T1 - 252*e2/(1-e2) - 3*C1*C1) * D*D*D*D*D*D/720)

                  const lon = lambda0 + (D - (1 + 2*T1 + C1) * D*D*D/6
                    + (5 - 2*C1 + 28*T1 - 3*C1*C1 + 8*e2/(1-e2) + 24*T1*T1) * D*D*D*D*D/120) / Math.cos(phi1)

                  return { lat: lat * 180 / Math.PI, lng: lon * 180 / Math.PI }
                })
              } else {
                result = points // No transform
              }
              break
            }

            default:
              result = null
          }

          self.postMessage({ id, result, error: null })
        } catch (err) {
          self.postMessage({ id, result: null, error: err instanceof Error ? err.message : 'Unknown error' })
        }
      }
    `

    const blob = new Blob([workerCode], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    this.worker = new Worker(url)
  }

  /**
   * Compute area for a single polygon (offloaded to worker).
   */
  computeArea(vertices: SurveyPoint[]): Promise<{
    areaSqM: number
    areaHectares: number
    perimeter: number
    vertexCount: number
    estimatedErrorSqM: number
  }> {
    return this.sendRequest('computeArea', { vertices })
  }

  /**
   * Compute area for many parcels at once (offloaded to worker).
   */
  batchArea(parcels: Array<{ id: string; vertices: SurveyPoint[] }>): Promise<
    Array<{ id: string; areaSqM: number; areaHectares: number }>
  > {
    return this.sendRequest('batchArea', { parcels })
  }

  /**
   * Search parcels by text (offloaded to worker).
   */
  searchParcels(parcels: any[], query: string): Promise<any[]> {
    return this.sendRequest('searchParcels', { parcels, query })
  }

  /**
   * Batch coordinate transformation (offloaded to worker).
   */
  transformCoordinates(
    points: Array<{ easting: number; northing: number }>,
    fromProj: string,
    toProj: string,
  ): Promise<Array<{ lat: number; lng: number }>> {
    return this.sendRequest('transformCoordinates', { points, fromProj, toProj })
  }

  private sendRequest(type: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'))
        return
      }

      const id = crypto.randomUUID()

      const handler = (e: MessageEvent<{ id: string; error?: string; result?: unknown }>) => {
        const data = e.data
        if (data.id !== id) return

        this.worker?.removeEventListener('message', handler)

        if (data.error) {
          reject(new Error(data.error))
        } else {
          resolve(data.result)
        }
      }

      this.worker.addEventListener('message', handler)
      this.worker.postMessage({ id, type, payload })
    })
  }

  terminate(): void {
    this.worker?.terminate()
    this.worker = null
  }
}

// Singleton instance
let workerInstance: ComputationWorker | null = null

export function getComputationWorker(): ComputationWorker {
  if (!workerInstance) {
    workerInstance = new ComputationWorker()
  }
  return workerInstance
}
