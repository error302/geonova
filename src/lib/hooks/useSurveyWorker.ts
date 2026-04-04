import { useCallback, useRef, useEffect, useState } from 'react'

type CalculationType = 'traverse' | 'leveling' | 'volume' | 'tin' | 'contours'

interface WorkerResponse {
  id: string
  success: boolean
  result?: unknown
  error?: string
}

const workerCode = `
  self.onmessage = async (event) => {
    const { type, id, data } = event.data;
    try {
      let result;
      switch (type) {
        case 'traverse': {
          const { points, method } = data;
          if (points.length < 2) throw new Error('Need at least 2 points');
          let sumDx = 0, sumDy = 0;
          for (let i = 1; i < points.length; i++) {
            const p0 = points[i - 1], p1 = points[i];
            if (p1.bearing !== undefined && p1.distance !== undefined) {
              const rad = (p1.bearing * Math.PI) / 180;
              sumDx += p1.distance * Math.sin(rad);
              sumDy += p1.distance * Math.cos(rad);
            }
          }
          const totalDistance = points.reduce((sum, p, i) => {
            if (i === 0) return sum;
            return sum + (p.distance || 0);
          }, 0);
          const error = Math.sqrt(sumDx * sumDx + sumDy * sumDy);
          result = { error, precision: totalDistance / error, method };
          break;
        }
        case 'leveling': {
          const { readings, benchmark } = data;
          let currentHeight = benchmark;
          let totalRise = 0, totalFall = 0;
          for (const r of readings) {
            if (r.backsight !== undefined) currentHeight += r.backsight;
            if (r.foresight !== undefined) {
              const rise = currentHeight - r.foresight;
              if (rise > 0) totalRise += rise;
              else totalFall += Math.abs(rise);
              currentHeight = r.foresight;
            }
          }
          result = { totalRise, totalFall, check: totalRise - totalFall };
          break;
        }
        case 'volume': {
          const { surfacePoints, referenceZ } = data;
          if (surfacePoints.length < 3) throw new Error('Need at least 3 points');
          const xs = surfacePoints.map((p: any) => p.x), ys = surfacePoints.map((p: any) => p.y), zs = surfacePoints.map((p: any) => p.z);
          const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
          const resolution = 50, stepX = (maxX - minX) / resolution, stepY = (maxY - minY) / resolution;
          let cutVolume = 0, fillVolume = 0;
          for (let i = 0; i < resolution; i++) {
            for (let j = 0; j < resolution; j++) {
              const x = minX + i * stepX, y = minY + j * stepY;
              const nearest = surfacePoints.reduce((prev, curr) => {
                const dist = Math.sqrt(Math.pow(curr.x - x, 2) + Math.pow(curr.y - y, 2));
                const prevDist = Math.sqrt(Math.pow(prev.x - x, 2) + Math.pow(prev.y - y, 2));
                return dist < prevDist ? curr : prev;
              });
              const diff = nearest.z - referenceZ;
              const cellArea = stepX * stepY;
              if (diff > 0) cutVolume += diff * cellArea;
              else fillVolume += Math.abs(diff) * cellArea;
            }
          }
          result = { cutVolume, fillVolume, netVolume: cutVolume - fillVolume };
          break;
        }
        default:
          throw new Error('Unknown type');
      }
      self.postMessage({ id, success: true, result });
    } catch (err) {
      self.postMessage({ id, success: false, error: err.message });
    }
  };
`;

export function useSurveyWorker() {
  const workerRef = useRef<Worker | null>(null)
  const [isReady, setIsReady] = useState(false)
  const pendingRef = useRef<Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>>(new Map())
  const idRef = useRef(0)

  useEffect(() => {
    const blob = new Blob([workerCode], { type: 'application/javascript' })
    const worker = new Worker(URL.createObjectURL(blob))
    
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { id, success, result, error } = event.data
      const pending = pendingRef.current.get(id)
      if (pending) {
        if (success) {
          pending.resolve(result)
        } else {
          pending.reject(new Error(error || 'Calculation failed'))
        }
        pendingRef.current.delete(id)
      }
    }

    workerRef.current = worker
    setIsReady(true)

    return () => {
      worker.terminate()
    }
  }, [])

  const calculate = useCallback(<T>(type: CalculationType, data: unknown): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not ready'))
        return
      }

      const id = `calc_${++idRef.current}`
      pendingRef.current.set(id, { resolve: resolve as (v: unknown) => void, reject })
      
      workerRef.current.postMessage({ type, id, data })
    })
  }, [])

  return { calculate, isReady }
}

const calculationCache = new Map<string, { result: unknown; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000

export function getCachedCalculation<T>(key: string): T | null {
  const cached = calculationCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result as T
  }
  calculationCache.delete(key)
  return null
}

export function setCachedCalculation(key: string, result: unknown): void {
  calculationCache.set(key, { result, timestamp: Date.now() })
}

export function clearCalculationCache(): void {
  calculationCache.clear()
}
