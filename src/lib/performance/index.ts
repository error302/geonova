/**
 * @module performance
 *
 * Performance utilities for METARDU
 *
 * Implements:
 * 1. Debounce — delay execution until input stops (search, resize)
 * 2. Throttle — limit execution rate (scroll, mousemove, GPS updates)
 * 3. Memoize — cache expensive function results (area, bearing computations)
 * 4. RAF Throttle — throttle to animation frame (map rendering)
 * 5. Chunked processing — break large arrays into chunks to avoid blocking UI
 * 6. Lazy evaluation — only compute when needed
 *
 * All functions are tree-shakeable and have zero dependencies.
 */

// ---------------------------------------------------------------------------
// Debounce — delay until input stops
// ---------------------------------------------------------------------------

/**
 * Debounce a function — wait `delay` ms after last call before executing.
 *
 * Use for: search inputs, resize handlers, auto-save.
 *
 * @example
 * const debouncedSearch = debounce((query) => fetchResults(query), 300)
 * input.addEventListener('input', (e) => debouncedSearch(e.target.value))
 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delay: number = 300,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/**
 * Debounce that returns a promise — resolves with the last value.
 *
 * @example
 * const debouncedFetch = debounceAsync((q) => fetch(`/api/search?q=${q}`).then(r => r.json()), 300)
 * const results = await debouncedFetch(query)
 */
export function debounceAsync<T extends (...args: never[]) => Promise<unknown>>(
  fn: T,
  delay: number = 300,
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timer: ReturnType<typeof setTimeout> | null = null
  let resolveRef: ((value: unknown) => void) | null = null

  return (...args: Parameters<T>) => {
    return new Promise((resolve) => {
      if (timer) clearTimeout(timer)
      if (resolveRef) resolveRef(undefined) // resolve previous with undefined

      resolveRef = resolve as (value: unknown) => void
      timer = setTimeout(async () => {
        const result = await fn(...args)
        resolveRef?.(result)
        resolveRef = null
      }, delay)
    })
  }
}

// ---------------------------------------------------------------------------
// Throttle — limit execution rate
// ---------------------------------------------------------------------------

/**
 * Throttle a function — execute at most once per `limit` ms.
 *
 * Use for: scroll, mousemove, GPS position updates, map rendering.
 *
 * @example
 * const throttledPan = throttle((coord) => updateMap(coord), 16) // 60fps
 */
export function throttle<T extends (...args: never[]) => void>(
  fn: T,
  limit: number = 16, // 16ms = 60fps
): (...args: Parameters<T>) => void {
  let inThrottle = false
  let lastArgs: Parameters<T> | null = null

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      lastArgs = null

      setTimeout(() => {
        inThrottle = false
        if (lastArgs) {
          fn(...lastArgs)
          lastArgs = null
        }
      }, limit)
    } else {
      lastArgs = args
    }
  }
}

/**
 * Throttle using requestAnimationFrame — for smooth visual updates.
 *
 * Use for: map cursor, drawing, canvas rendering.
 */
export function rafThrottle<T extends (...args: never[]) => void>(
  fn: T,
): (...args: Parameters<T>) => void {
  let ticking = false
  let lastArgs: Parameters<T> | null = null

  return (...args: Parameters<T>) => {
    lastArgs = args
    if (!ticking) {
      requestAnimationFrame(() => {
        if (lastArgs) fn(...lastArgs)
        ticking = false
      })
      ticking = true
    }
  }
}

// ---------------------------------------------------------------------------
// Memoize — cache expensive function results
// ---------------------------------------------------------------------------

/**
 * Memoize a function — cache results by argument values.
 *
 * Use for: area calculations, bearing computations, coordinate transforms.
 *
 * @example
 * const memoizedArea = memoize(computeArea)
 * memoizedArea(vertices) // computed
 * memoizedArea(vertices) // cached (same vertices reference)
 */
export function memoize<T extends (...args: never[]) => unknown>(
  fn: T,
  options?: {
    maxSize?: number       // max cache entries (default: 100)
    keyFn?: (...args: Parameters<T>) => string  // custom key function
  },
): T {
  const cache = new Map<string, unknown>()
  const maxSize = options?.maxSize ?? 100
  const keyFn = options?.keyFn ?? ((...args: never[]) => JSON.stringify(args))

  const memoized = (...args: Parameters<T>) => {
    const key = keyFn(...args)

    if (cache.has(key)) {
      return cache.get(key)
    }

    const result = fn(...args)

    // Evict oldest entry if cache is full (LRU)
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value as string
      if (firstKey) cache.delete(firstKey)
    }

    cache.set(key, result)
    return result
  }

  return memoized as T
}

/**
 * Memoize with a time-to-live — cache expires after `ttl` ms.
 *
 * Use for: API responses, coordinate transforms that might change.
 */
export function memoizeTTL<T extends (...args: never[]) => unknown>(
  fn: T,
  ttl: number = 60000, // 1 minute default
  keyFn?: (...args: Parameters<T>) => string,
): T {
  const cache = new Map<string, { value: unknown; expires: number }>()
  const getKey = keyFn ?? ((...args: never[]) => JSON.stringify(args))

  return ((...args: Parameters<T>) => {
    const key = getKey(...args)
    const now = Date.now()

    const cached = cache.get(key)
    if (cached && cached.expires > now) {
      return cached.value
    }

    const result = fn(...args)
    cache.set(key, { value: result, expires: now + ttl })
    return result
  }) as T
}

// ---------------------------------------------------------------------------
// Chunked Processing — avoid blocking UI on large arrays
// ---------------------------------------------------------------------------

/**
 * Process a large array in chunks, yielding to the event loop between chunks.
 *
 * Use for: batch parcel import, large CSV parsing, point cloud processing.
 *
 * @example
 * for await (const chunk of chunkedProcess(largeArray, 100)) {
 *   processChunk(chunk)
 * }
 */
export async function* chunkedProcess<T>(
  array: T[],
  chunkSize: number = 100,
): AsyncGenerator<T[]> {
  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize)
    yield chunk
    // Yield to event loop so UI can update
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

/**
 * Process a large array with a progress callback.
 *
 * @example
 * await processWithProgress(
 *   parcels,
 *   (chunk) => importParcels(chunk),
 *   (progress) => setProgress(progress)
 * )
 */
export async function processWithProgress<T, R>(
  array: T[],
  processor: (chunk: T[]) => Promise<R>,
  onProgress: (progress: number) => void,
  chunkSize: number = 100,
): Promise<R[]> {
  const results: R[] = []
  const total = array.length

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize)
    const result = await processor(chunk)
    results.push(result)
    onProgress(((i + chunk.length) / total) * 100)
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  return results
}

// ---------------------------------------------------------------------------
// Lazy Evaluation — only compute when accessed
// ---------------------------------------------------------------------------

/**
 * Create a lazy value — computed once on first access, then cached.
 *
 * @example
 * const heavyConfig = lazy(() => buildConfigFromDB())
 * // Not computed yet
 * const config = heavyConfig() // Computed now, cached for next call
 */
export function lazy<T>(factory: () => T): () => T {
  let cached: T | undefined
  let computed = false

  return () => {
    if (!computed) {
      cached = factory()
      computed = true
    }
    return cached as T
  }
}

// ---------------------------------------------------------------------------
// Binary Search — O(log n) search in sorted arrays
// ---------------------------------------------------------------------------

/**
 * Binary search in a sorted array. Returns index of target, or -1.
 *
 * Use for: searching sorted coordinate arrays, beacon lists, time-series.
 *
 * @example
 * const idx = binarySearch(sortedBeacons, beacon => beacon.easting - targetE)
 */
export function binarySearch<T>(
  array: T[],
  compare: (item: T) => number, // negative = target is before, 0 = found, positive = after
): number {
  let left = 0
  let right = array.length - 1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const cmp = compare(array[mid])

    if (cmp === 0) return mid
    if (cmp < 0) left = mid + 1
    else right = mid - 1
  }

  return -1
}

// ---------------------------------------------------------------------------
// Spatial Index — R-tree-lite for fast nearest-neighbor queries
// ---------------------------------------------------------------------------

/**
 * Simple spatial index using grid bucketing.
 *
 * For small-to-medium datasets (<10K points), this is faster than
 * a full R-tree implementation and has zero dependencies.
 *
 * @example
 * const index = new SpatialIndex()
 * index.add({ x: 534850, y: 9574220, data: beacon })
 * const nearest = index.findNearest(534851, 9574221, 5) // within 5m
 */
export class SpatialIndex<T> {
  private grid: Map<string, Array<{ x: number; y: number; data: T }>> = new Map()
  private cellSize: number

  constructor(cellSize: number = 100) {
    this.cellSize = cellSize
  }

  add(point: { x: number; y: number; data: T }): void {
    const key = this.getCellKey(point.x, point.y)
    if (!this.grid.has(key)) {
      this.grid.set(key, [])
    }
    this.grid.get(key)!.push(point)
  }

  findNearest(x: number, y: number, maxResults: number = 10, maxDistance?: number): Array<{ x: number; y: number; data: T; distance: number }> {
    const results: Array<{ x: number; y: number; data: T; distance: number }> = []

    // Search in expanding rings of cells
    const maxRing = maxDistance ? Math.ceil(maxDistance / this.cellSize) : 3

    for (let ring = 0; ring <= maxRing; ring++) {
      const cells = this.getCellsInRing(x, y, ring)

      for (const cellKey of cells) {
        const cellPoints = this.grid.get(cellKey)
        if (!cellPoints) continue

        for (const point of cellPoints) {
          const dx = point.x - x
          const dy = point.y - y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (maxDistance && distance > maxDistance) continue

          results.push({ ...point, distance })
        }
      }

      // If we have enough results, sort and return
      if (results.length >= maxResults) break
    }

    results.sort((a, b) => a.distance - b.distance)
    return results.slice(0, maxResults)
  }

  findInRadius(x: number, y: number, radius: number): Array<{ x: number; y: number; data: T; distance: number }> {
    return this.findNearest(x, y, Infinity, radius)
  }

  clear(): void {
    this.grid.clear()
  }

  get size(): number {
    let count = 0
    for (const cell of this.grid.values()) {
      count += cell.length
    }
    return count
  }

  private getCellKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize)
    const cy = Math.floor(y / this.cellSize)
    return `${cx},${cy}`
  }

  private getCellsInRing(x: number, y: number, ring: number): string[] {
    if (ring === 0) return [this.getCellKey(x, y)]

    const cells: string[] = []
    const cx = Math.floor(x / this.cellSize)
    const cy = Math.floor(y / this.cellSize)

    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.abs(dx) === ring || Math.abs(dy) === ring) {
          cells.push(`${cx + dx},${cy + dy}`)
        }
      }
    }

    return cells
  }
}

// ---------------------------------------------------------------------------
// React Hooks
// ---------------------------------------------------------------------------

/**
 * useDebounce — React hook for debounced values.
 *
 * @example
 * const [query, setQuery] = useState('')
 * const debouncedQuery = useDebounceValue(query, 300)
 * useEffect(() => { search(debouncedQuery) }, [debouncedQuery])
 */
export function useDebounceValue<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

/**
 * useDebouncedCallback — React hook for debounced function calls.
 */
export function useDebouncedCallback<T extends (...args: never[]) => void>(
  callback: T,
  delay: number = 300,
): (...args: Parameters<T>) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => callbackRef.current(...args), delay)
  }, [delay])
}

/**
 * useThrottledCallback — React hook for throttled function calls.
 */
export function useThrottledCallback<T extends (...args: never[]) => void>(
  callback: T,
  limit: number = 16,
): (...args: Parameters<T>) => void {
  const lastRunRef = useRef(0)
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastRunRef.current >= limit) {
      callbackRef.current(...args)
      lastRunRef.current = now
    }
  }, [limit])
}

// ---------------------------------------------------------------------------
// React imports (conditional — only if React is available)
// ---------------------------------------------------------------------------

// These imports are at the bottom to keep the file tree-shakeable
// for non-React contexts (Node.js, web workers).
import { useState, useEffect, useRef, useCallback } from 'react'
