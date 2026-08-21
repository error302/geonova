/**
 * Streaming PLY Parser — chunked ingestion for large point clouds.
 *
 * Reads the PLY header synchronously (it's tiny), then streams vertex
 * data via ReadableStream in ~256 KB chunks, parsing rows incrementally
 * with progress callbacks. Yields to the event loop between chunks so
 * the UI stays responsive.
 *
 * Falls back to the synchronous `file.text()` path for files < 5 MB.
 *
 * @module importers/streamingPLYParser
 */

import { MAX_POINTS } from '@/app/tools/point-cloud-import/constants'
import type { StreamProgress } from './streamingCSVParser'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PLYPoint {
  easting: number
  northing: number
  elevation: number
  code?: string
}

export interface StreamingPLYResult {
  points: PLYPoint[]
  totalVertices: number
  headerLines: string[]
}

type ProgressCallback = (progress: StreamProgress) => void

// ─── Constants ───────────────────────────────────────────────────────────────

const CHUNK_SIZE = 256 * 1024
const YIELD_ROWS = 5_000
const STREAMING_THRESHOLD_BYTES = 5 * 1024 * 1024

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

// ─── Synchronous fallback ────────────────────────────────────────────────────

async function parsePLYSync(file: File): Promise<StreamingPLYResult> {
  const text = await file.text()
  const lines = text.trim().split('\n')

  let headerEnd = 0
  let vertexCount = 0
  const headerLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    headerLines.push(lines[i])
    if (lines[i].startsWith('element vertex')) {
      vertexCount = parseInt(lines[i].split(' ')[2], 10)
    }
    if (lines[i].trim() === 'end_header') {
      headerEnd = i + 1
      break
    }
  }

  const maxVertices = Math.min(vertexCount, MAX_POINTS)
  const points: PLYPoint[] = []

  for (let i = headerEnd; i < headerEnd + maxVertices && i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) continue
    const cols = trimmed.split(/\s+/)
    if (cols.length >= 3) {
      points.push({
        easting: parseFloat(cols[0]) || 0,
        northing: parseFloat(cols[1]) || 0,
        elevation: parseFloat(cols[2]) || 0,
        code: cols.length >= 4 ? cols[3] : undefined,
      })
    }
  }

  return { points, totalVertices: vertexCount, headerLines }
}

// ─── Streaming parser ────────────────────────────────────────────────────────

async function parsePLYStream(
  file: File,
  onProgress: ProgressCallback,
): Promise<StreamingPLYResult> {
  const totalBytes = file.size
  const stream = file.stream()
  const decoder = new TextDecoderStream('utf-8')
  const reader = stream.pipeThrough(decoder).getReader()

  const headerLines: string[] = []
  let vertexCount = 0
  let headerParsed = false
  let headerEndFound = false
  let buffer = ''
  let bytesLoaded = 0
  const points: PLYPoint[] = []

  // Phase 1: Read header
  while (!headerParsed) {
    const { value, done } = await reader.read()
    if (done) break

    bytesLoaded += value.length
    buffer += value

    // Process header lines
    let nlIdx: number
    while ((nlIdx = buffer.indexOf('\n')) !== -1 && !headerParsed) {
      const line = buffer.slice(0, nlIdx).trimEnd()
      buffer = buffer.slice(nlIdx + 1)
      headerLines.push(line)

      if (line.startsWith('element vertex')) {
        vertexCount = parseInt(line.split(' ')[2], 10)
      }
      if (line === 'end_header') {
        headerEndFound = true
        headerParsed = true
      }
    }
  }

  if (!headerEndFound || vertexCount === 0) {
    reader.releaseLock()
    return { points: [], totalVertices: 0, headerLines }
  }

  // Phase 2: Stream vertex data
  const maxVertices = Math.min(vertexCount, MAX_POINTS)
  let lineCount = 0

  while (points.length < maxVertices) {
    const { value, done } = await reader.read()
    if (done) break

    bytesLoaded += value.length
    buffer += value

    let nlIdx: number
    while ((nlIdx = buffer.indexOf('\n')) !== -1 && points.length < maxVertices) {
      const line = buffer.slice(0, nlIdx).trim()
      buffer = buffer.slice(nlIdx + 1)
      lineCount++

      if (!line) continue

      const cols = line.split(/\s+/)
      if (cols.length >= 3) {
        points.push({
          easting: parseFloat(cols[0]) || 0,
          northing: parseFloat(cols[1]) || 0,
          elevation: parseFloat(cols[2]) || 0,
          code: cols.length >= 4 ? cols[3] : undefined,
        })
      }

      if (points.length % YIELD_ROWS === 0 && points.length > 0) {
        onProgress({
          bytesLoaded,
          totalBytes,
          percent: totalBytes > 0 ? Math.min(99, (bytesLoaded / totalBytes) * 100) : 0,
          pointsLoaded: points.length,
          done: false,
        })
        await yieldToEventLoop()
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim() && points.length < maxVertices) {
    const cols = buffer.trim().split(/\s+/)
    if (cols.length >= 3) {
      points.push({
        easting: parseFloat(cols[0]) || 0,
        northing: parseFloat(cols[1]) || 0,
        elevation: parseFloat(cols[2]) || 0,
        code: cols.length >= 4 ? cols[3] : undefined,
      })
    }
  }

  reader.releaseLock()

  onProgress({
    bytesLoaded: totalBytes,
    totalBytes,
    percent: 100,
    pointsLoaded: points.length,
    done: true,
  })

  return { points, totalVertices: vertexCount, headerLines }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse a PLY file with progressive loading.
 *
 * For files < 5 MB, uses the synchronous path.
 * For files >= 5 MB, streams vertex data in chunks with progress callbacks.
 */
export async function parsePLYStreamed(
  file: File,
  onProgress?: ProgressCallback,
): Promise<StreamingPLYResult> {
  if (file.size < STREAMING_THRESHOLD_BYTES) {
    const result = await parsePLYSync(file)
    onProgress?.({
      bytesLoaded: file.size,
      totalBytes: file.size,
      percent: 100,
      pointsLoaded: result.points.length,
      done: true,
    })
    return result
  }

  return parsePLYStream(file, onProgress ?? (() => {}))
}
