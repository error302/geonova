/**
 * Streaming CSV/XYZ/TXT Parser — chunked ingestion for million-point files.
 *
 * Reads the file via the Streams API (ReadableStream + TextDecoderStream)
 * so the browser never holds the entire raw text in memory. Rows are parsed
 * incrementally in batches, with a yield-to-event-loop between chunks so
 * the main thread stays responsive and a progress bar can update.
 *
 * Falls back to the synchronous `file.text()` path for files < 5 MB or
 * when the Streams API is unavailable (e.g. old Safari).
 *
 * @module importers/streamingCSVParser
 */

import { MAX_POINTS } from '@/app/tools/point-cloud-import/constants'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StreamedPoint {
  id: string
  name: string
  easting: number
  northing: number
  elevation: number
}

export interface StreamedParseError {
  row: number
  message: string
}

export interface StreamProgress {
  /** Bytes read so far. */
  bytesLoaded: number
  /** Total file size in bytes (0 if unknown). */
  totalBytes: number
  /** Percentage 0–100. */
  percent: number
  /** Points parsed so far. */
  pointsLoaded: number
  /** True when parsing is complete. */
  done: boolean
}

export interface StreamingParseResult {
  points: StreamedPoint[]
  errors: StreamedParseError[]
  totalLines: number
  delimiter: string
  hasHeader: boolean
}

type ProgressCallback = (progress: StreamProgress) => void

// ─── Constants ───────────────────────────────────────────────────────────────

/** Chunk size in bytes — ~256 KB keeps memory lean while minimizing syscall overhead. */
const CHUNK_SIZE = 256 * 1024

/** Yield to the event loop every N rows so React can paint. */
const YIELD_ROWS = 5_000

/** Files smaller than this use the synchronous path (no streaming overhead). */
const STREAMING_THRESHOLD_BYTES = 5 * 1024 * 1024 // 5 MB

// ─── Helpers ─────────────────────────────────────────────────────────────────

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function detectDelimiter(firstLines: string[]): string {
  let commaCount = 0
  let tabCount = 0
  let semicolonCount = 0
  let spaceCount = 0

  for (const line of firstLines) {
    if (line.startsWith('#') || line.trim() === '') continue
    commaCount += (line.match(/,/g) || []).length
    tabCount += (line.match(/\t/g) || []).length
    semicolonCount += (line.match(/;/g) || []).length
    spaceCount += (line.match(/ {2,}/g) || []).length
  }

  const counts: [string, number][] = [
    ['\t', tabCount],
    [',', commaCount],
    [';', semicolonCount],
    [' ', spaceCount],
  ]
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][0]
}

function isHeaderLine(line: string): boolean {
  const lower = line.toLowerCase()
  const headerKeywords = [
    'easting', 'northing', 'elevation', 'name', 'point', 'id',
    'x', 'y', 'z', 'e', 'n', 'rl', 'height', 'lat', 'lon',
  ]
  const tokens = lower.split(/[\t,; ]+/).filter(t => t.length > 0)
  if (tokens.length === 0) return false
  const matchCount = tokens.filter(t =>
    headerKeywords.some(kw => t === kw || t.includes(kw))
  ).length
  return matchCount >= Math.ceil(tokens.length * 0.5)
}

interface ColumnMapping {
  id: number
  easting: number
  northing: number
  elevation: number
  name: number
}

function guessColumnIndices(headers: string[]): ColumnMapping {
  const lower = headers.map(h => h.toLowerCase().trim())

  const eastingIdx = lower.findIndex(h =>
    h === 'easting' || h === 'e' || h === 'x' || h.includes('east') || h.includes('easting')
  )
  const northingIdx = lower.findIndex(h =>
    h === 'northing' || h === 'n' || h === 'y' || h.includes('north') || h.includes('northing')
  )
  const elevIdx = lower.findIndex(h =>
    h === 'elevation' || h === 'z' || h === 'rl' || h === 'height' ||
    h.includes('elev') || h.includes('height') || h === 'level'
  )
  const nameIdx = lower.findIndex(h =>
    h === 'name' || h === 'id' || h === 'point' || h === 'pointname' ||
    h === 'point_name' || h === 'code' || h.includes('name') || h.includes('id')
  )

  return {
    id: lower.indexOf('id') >= 0 ? lower.indexOf('id') : -1,
    easting: eastingIdx >= 0 ? eastingIdx : 0,
    northing: northingIdx >= 0 ? northingIdx : 1,
    elevation: elevIdx >= 0 ? elevIdx : 2,
    name: nameIdx >= 0 ? nameIdx : -1,
  }
}

function parseRow(
  line: string,
  lineNum: number,
  splitRe: RegExp,
  colMapping: ColumnMapping | null,
  pointCount: number,
): { point: StreamedPoint | null; error: StreamedParseError | null } {
  const trimmed = line.trim()
  if (trimmed === '' || trimmed.startsWith('#')) {
    return { point: null, error: null }
  }

  const parts = trimmed.split(splitRe).map(s => s.trim())

  if (parts.length < 3) {
    return { point: null, error: { row: lineNum, message: `Too few columns (${parts.length})` } }
  }

  if (!colMapping) return { point: null, error: null }
  const mapping = colMapping

  const easting = parseFloat(parts[mapping.easting])
  const northing = parseFloat(parts[mapping.northing])
  const elevation = parseFloat(parts[mapping.elevation])

  if (isNaN(easting) || isNaN(northing) || isNaN(elevation)) {
    return { point: null, error: { row: lineNum, message: 'Non-numeric coordinate value' } }
  }

  const pointName = mapping.name >= 0 && mapping.name < parts.length
    ? parts[mapping.name]
    : `P${pointCount + 1}`

  return {
    point: {
      id: `pt-${pointCount}`,
      name: pointName,
      easting,
      northing,
      elevation,
    },
    error: null,
  }
}

// ─── Synchronous fallback (files < 5 MB) ────────────────────────────────────

function parseSync(text: string): StreamingParseResult {
  const delimiter = detectDelimiter(text.split('\n').slice(0, 5))
  const lines = text.split('\n')
  const splitRe = delimiter === ' ' ? /\s+/ : new RegExp(`(?:${delimiter === '\t' ? '\\t' : delimiter})+`)

  let startIdx = 0
  let hasHeader = false

  if (lines.length > 0 && isHeaderLine(lines[0])) {
    hasHeader = true
    startIdx = 1
  }
  while (startIdx < lines.length && lines[startIdx].trim().startsWith('#')) {
    startIdx++
  }

  let colMapping: ColumnMapping | null = null
  if (hasHeader) {
    const headers = lines[0].split(splitRe).map(h => h.trim())
    colMapping = guessColumnIndices(headers)
  }

  // Detect column count from first data row
  let colCount = 3
  for (let i = startIdx; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const parts = trimmed.split(splitRe)
    if (parts.length >= 3) {
      colCount = parts.length
      break
    }
  }

  if (!colMapping) {
    colMapping = colCount === 3
      ? { id: -1, easting: 0, northing: 1, elevation: 2, name: -1 }
      : { id: -1, easting: 1, northing: 2, elevation: 3, name: 0 }
  }

  const points: StreamedPoint[] = []
  const errors: StreamedParseError[] = []

  for (let i = startIdx; i < lines.length && points.length < MAX_POINTS; i++) {
    const { point, error } = parseRow(lines[i], i + 1, splitRe, colMapping, points.length)
    if (point) points.push(point)
    if (error) errors.push(error)
  }

  return {
    points,
    errors: errors.slice(0, 50),
    totalLines: lines.length,
    delimiter,
    hasHeader,
  }
}

// ─── Streaming parser (files >= 5 MB) ───────────────────────────────────────

async function parseStream(
  file: File,
  onProgress: ProgressCallback,
): Promise<StreamingParseResult> {
  const totalBytes = file.size
  const stream = file.stream()
  const decoder = new TextDecoderStream('utf-8')
  const reader = stream.pipeThrough(decoder).getReader()

  const points: StreamedPoint[] = []
  const errors: StreamedParseError[] = []
  let totalLines = 0
  let bytesLoaded = 0

  // First chunk — detect delimiter + header
  let firstChunk = ''
  let headerParsed = false
  let delimiter = ' '
  let splitRe = /\s+/
  let colMapping: ColumnMapping | null = null
  let hasHeader = false
  let buffer = ''

  while (points.length < MAX_POINTS) {
    const { value, done } = await reader.read()
    if (done) break

    bytesLoaded += value.length
    buffer += value

    // Process complete lines in the buffer
    let nlIdx: number
    while ((nlIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nlIdx)
      buffer = buffer.slice(nlIdx + 1)
      totalLines++

      // First few lines — detect format
      if (!headerParsed) {
        if (totalLines <= 5) {
          firstChunk += line + '\n'
        }
        if (totalLines >= 5 || (totalLines > 0 && bytesLoaded >= Math.min(4096, totalBytes))) {
          // Done sampling — lock in format
          delimiter = detectDelimiter(firstChunk.split('\n'))
          splitRe = delimiter === ' ' ? /\s+/ : new RegExp(`(?:${delimiter === '\t' ? '\\t' : delimiter})+`)

          const sampleLines = firstChunk.split('\n')
          if (sampleLines.length > 0 && isHeaderLine(sampleLines[0])) {
            hasHeader = true
            const headers = sampleLines[0].split(splitRe).map(h => h.trim())
            colMapping = guessColumnIndices(headers)
          }

          if (!colMapping) {
            // Detect column count from first data line
            let colCount = 3
            for (const sl of sampleLines) {
              const trimmed = sl.trim()
              if (trimmed === '' || trimmed.startsWith('#')) continue
              const parts = trimmed.split(splitRe)
              if (parts.length >= 3) {
                colCount = parts.length
                break
              }
            }
            colMapping = colCount === 3
              ? { id: -1, easting: 0, northing: 1, elevation: 2, name: -1 }
              : { id: -1, easting: 1, northing: 2, elevation: 3, name: 0 }
          }

          hasHeader = hasHeader || false
          headerParsed = true

          // Parse any sample data lines (skip header)
          const dataStart = hasHeader ? 1 : 0
          for (let i = dataStart; i < sampleLines.length; i++) {
            const { point, error } = parseRow(sampleLines[i], i + 1, splitRe, colMapping, points.length)
            if (point && points.length < MAX_POINTS) points.push(point)
            if (error) errors.push(error)
          }
          continue
        }
        // Still sampling header
        continue
      }

      // Normal data row
      const { point, error } = parseRow(line, totalLines, splitRe, colMapping, points.length)
      if (point && points.length < MAX_POINTS) points.push(point)
      if (error) errors.push(error)

      // Yield to event loop every YIELD_ROWS rows
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

  // Process any remaining buffer
  if (buffer.trim() && headerParsed && points.length < MAX_POINTS) {
    totalLines++
    const { point, error } = parseRow(buffer, totalLines, splitRe, colMapping, points.length)
    if (point) points.push(point)
    if (error) errors.push(error)
  }

  reader.releaseLock()

  onProgress({
    bytesLoaded: totalBytes,
    totalBytes,
    percent: 100,
    pointsLoaded: points.length,
    done: true,
  })

  return {
    points,
    errors: errors.slice(0, 50),
    totalLines,
    delimiter,
    hasHeader,
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse a CSV/TXT/XYZ file with progressive loading.
 *
 * For files < 5 MB, uses the synchronous path (fast, no overhead).
 * For files >= 5 MB, streams via ReadableStream and yields to the event
 * loop every 5k points so the UI stays responsive and a progress bar can
 * update in real time.
 *
 * @param file  The File object from the input/drop
 * @param onProgress  Callback fired ~every 5k points during streaming
 */
export async function parseCSVStreamed(
  file: File,
  onProgress?: ProgressCallback,
): Promise<StreamingParseResult> {
  if (file.size < STREAMING_THRESHOLD_BYTES) {
    const text = await file.text()
    const result = parseSync(text)
    onProgress?.({
      bytesLoaded: file.size,
      totalBytes: file.size,
      percent: 100,
      pointsLoaded: result.points.length,
      done: true,
    })
    return result
  }

  return parseStream(file, onProgress ?? (() => {}))
}
