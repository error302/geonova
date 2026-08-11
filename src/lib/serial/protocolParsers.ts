/**
 * METARDU Serial Protocol Parsers
 * ================================
 * Parses real-time data streams from surveying instruments:
 *
 * - **NMEA 0183**: Standard GPS/GNSS sentences ($GPGGA, $GPRMC, etc.)
 * - **Leica GSI**: Geo Serial Interface format (Leica total stations)
 * - **Trimble**: DC/SSV format (Trimble total stations)
 * - **Topcon**: TOPCON proprietary format
 * - **Sokkia**: SDR33 format
 */

// ─── NMEA 0183 Parser ───────────────────────────────────────────────────

export interface NMEAPosition {
  /** Fix quality: 0=invalid, 1=GPS, 2=DGPS, 4=RTK Fixed, 5=RTK Float */
  fixQuality: number
  /** Number of satellites in use */
  satellites: number
  /** Horizontal dilution of precision */
  hdop: number
  /** Latitude in decimal degrees */
  latitude: number
  /** Longitude in decimal degrees */
  longitude: number
  /** Altitude above geoid (meters) */
  altitude: number
  /** Geoidal separation (meters) */
  geoidSep: number
  /** Age of differential corrections (seconds) */
  ageOfDGPS?: number
  /** Differential reference station ID */
  dgpsStationId?: number
  /** UTC timestamp of fix */
  timestamp: Date
  /** Raw sentence */
  raw: string
}

export interface NMEARMC {
  /** Status: A=active/valid, V=void */
  status: 'A' | 'V'
  /** Latitude */
  latitude: number
  /** Longitude */
  longitude: number
  /** Speed over ground (knots) */
  speedKnots: number
  /** Course over ground (degrees true) */
  courseTrue: number
  /** Magnetic variation */
  magVariation?: number
  /** Date and time */
  timestamp: Date
  raw: string
}

/**
 * Parse NMEA coordinate from DDDMM.MMMM format to decimal degrees
 * N/S and E/W hemispheres are handled
 */
function parseNMEACoordinate(value: string, hemisphere: string): number {
  if (!value || value.length < 4) return 0
  const dotIndex = value.indexOf('.')
  if (dotIndex < 3) return 0

  const degrees = parseInt(value.substring(0, dotIndex - 2), 10)
  const minutes = parseFloat(value.substring(dotIndex - 2))
  let decimal = degrees + minutes / 60

  if (hemisphere === 'S' || hemisphere === 'W') decimal = -decimal
  return decimal
}

/**
 * Parse a NMEA time string (HHMMSS.SSS) into a Date
 */
function parseNMEATime(timeStr: string, dateStr?: string): Date {
  if (!timeStr || timeStr.length < 6) return new Date()
  const hours = parseInt(timeStr.substring(0, 2), 10)
  const minutes = parseInt(timeStr.substring(2, 4), 10)
  const seconds = parseFloat(timeStr.substring(4))

  const now = new Date()
  let year = now.getUTCFullYear()
  let month = now.getUTCMonth()
  let day = now.getUTCDate()

  if (dateStr && dateStr.length >= 6) {
    day = parseInt(dateStr.substring(0, 2), 10)
    month = parseInt(dateStr.substring(2, 4), 10) - 1
    year = 2000 + parseInt(dateStr.substring(4, 6), 10)
  }

  return new Date(Date.UTC(year, month, day, hours, minutes, seconds))
}

/**
 * Validate NMEA checksum
 */
function validateNMEAChecksum(sentence: string): boolean {
  const starIndex = sentence.indexOf('*')
  if (starIndex < 0 || starIndex + 3 > sentence.length) return false

  const data = sentence.substring(1, starIndex)
  const checksum = parseInt(sentence.substring(starIndex + 1, starIndex + 3), 16)

  let computed = 0
  for (let i = 0; i < data.length; i++) {
    computed ^= data.charCodeAt(i)
  }

  return (computed & 0xFF) === checksum
}

/**
 * Parse a $GPGGA sentence (Global Positioning System Fix Data)
 */
export function parseGPGGA(sentence: string): NMEAPosition | null {
  const fields = sentence.split(',')
  if (fields[0] !== '$GPGGA' && fields[0] !== '$GNGGA') return null

  return {
    fixQuality: parseInt(fields[6] || '0', 10),
    satellites: parseInt(fields[7] || '0', 10),
    hdop: parseFloat(fields[8] || '0'),
    latitude: parseNMEACoordinate(fields[2] || '', fields[3] || 'N'),
    longitude: parseNMEACoordinate(fields[4] || '', fields[5] || 'E'),
    altitude: parseFloat(fields[9] || '0'),
    geoidSep: parseFloat(fields[11] || '0'),
    ageOfDGPS: fields[13] ? parseFloat(fields[13]) : undefined,
    dgpsStationId: fields[14] ? parseInt(fields[14], 10) : undefined,
    timestamp: parseNMEATime(fields[1] || ''),
    raw: sentence,
  }
}

/**
 * Parse a $GPRMC sentence (Recommended Minimum)
 */
export function parseGPRMC(sentence: string): NMEARMC | null {
  const fields = sentence.split(',')
  if (fields[0] !== '$GPRMC' && fields[0] !== '$GNRMC') return null

  return {
    status: (fields[2] || 'V') as 'A' | 'V',
    latitude: parseNMEACoordinate(fields[3] || '', fields[4] || 'N'),
    longitude: parseNMEACoordinate(fields[5] || '', fields[6] || 'E'),
    speedKnots: parseFloat(fields[7] || '0'),
    courseTrue: parseFloat(fields[8] || '0'),
    magVariation: fields[10] ? parseFloat(fields[10]) : undefined,
    timestamp: parseNMEATime(fields[1] || '', fields[9]),
    raw: sentence,
  }
}

/**
 * Parse any NMEA sentence and return structured data
 */
export function parseNMEA(sentence: string): NMEAPosition | NMEARMC | null {
  if (!sentence.startsWith('$')) return null
  if (!validateNMEAChecksum(sentence)) return null

  if (sentence.includes('GGA')) return parseGPGGA(sentence)
  if (sentence.includes('RMC')) return parseGPRMC(sentence)
  return null
}

// ─── Leica GSI Parser ───────────────────────────────────────────────────

export interface GSIWord {
  /** Word index (11-81) */
  index: number
  /** Measurement type code */
  code: string
  /** Value */
  value: number
  /** Additional info */
  info?: string
}

export interface GSIMeasurement {
  /** Point number */
  pointNumber: number
  /** Easting / horizontal coordinate */
  easting?: number
  /** Northing / vertical coordinate */
  northing?: number
  /** Height / elevation */
  height?: number
  /** Horizontal angle (decimal degrees) */
  horizontalAngle?: number
  /** Vertical angle (decimal degrees) */
  verticalAngle?: number
  /** Slope distance (meters) */
  slopeDistance?: number
  /** Instrument height (meters) */
  instrumentHeight?: number
  /** Reflector height (meters) */
  reflectorHeight?: number
  /** Station/Target ID */
  stationId?: string
  /** Attribute code */
  attributeCode?: string
  /** All raw GSI words */
  words: GSIWord[]
}

/**
 * Parse a single GSI word (format: Wi...value...info)
 * GSI-8:  7-char value (6 digits + sign) + optional info
 * GSI-16: 15-char value (14 digits + sign) + optional info
 */
function parseGSIWord(token: string): GSIWord | null {
  if (token.length < 6) return null

  const indexChar = token[0]
  if (indexChar !== 'W' && indexChar !== 'w') return null

  const wordIndex = parseInt(token.substring(1, 3), 10)
  if (isNaN(wordIndex)) return null

  // Determine format from 4th character
  const formatChar = token[3]
  const is16Bit = formatChar === ' ' // Space = GSI-16, digit = GSI-8

  let valueStr: string
  let infoStr: string

  if (is16Bit) {
    // GSI-16: W + index + space + 14-digit value + optional info
    valueStr = token.substring(4, 18)
    infoStr = token.length > 18 ? token.substring(18) : ''
  } else {
    // GSI-8: W + index + format(1) + 6-digit value + optional info
    valueStr = token.substring(3, 9)
    infoStr = token.length > 9 ? token.substring(9) : ''
  }

  // First digit of value is the measurement code
  const code = valueStr[0]
  const numericValue = parseInt(valueStr.substring(1), 10)

  return {
    index: wordIndex,
    code,
    value: isNaN(numericValue) ? 0 : numericValue / (is16Bit ? 100000 : 1000),
    info: infoStr || undefined,
  }
}

/**
 * GSI word index to measurement mapping (Leica standard)
 */
const GSI_CODE_MAP: Record<string, keyof GSIMeasurement> = {
  '11': 'pointNumber',
  '21': 'easting',
  '22': 'northing',
  '31': 'height',
  '32': 'height',
  '41': 'attributeCode',
  '42': 'attributeCode',
  '51': 'stationId',
  '52': 'stationId',
  '71': 'horizontalAngle',
  '72': 'horizontalAngle',
  '81': 'verticalAngle',
  '82': 'verticalAngle',
  '84': 'slopeDistance',
  '85': 'slopeDistance',
  '86': 'slopeDistance',
  '87': 'instrumentHeight',
  '88': 'reflectorHeight',
}

/**
 * Parse a GSI data block (multiple lines of GSI words)
 * Each line represents one measurement record
 */
export function parseGSIBlock(block: string): GSIMeasurement[] {
  const lines = block.trim().split(/\r?\n/)
  const measurements: GSIMeasurement[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const tokens = trimmed.split(/\s+/).filter(t => t.startsWith('W') || t.startsWith('w'))
    if (tokens.length === 0) continue

    const measurement: GSIMeasurement = { pointNumber: 0, words: [] }

    for (const token of tokens) {
      const word = parseGSIWord(token)
      if (!word) continue

      measurement.words.push(word)

      // Map word to measurement field
      const indexStr = String(word.index)
      if (GSI_CODE_MAP[indexStr]) {
        const key = GSI_CODE_MAP[indexStr]
        ;(measurement as unknown as Record<string, number>)[key] = word.value
      }
    }

    if (measurement.pointNumber > 0 || measurement.words.length > 0) {
      measurements.push(measurement)
    }
  }

  return measurements
}

/**
 * Parse a single GSI line (incremental parse for streaming)
 */
export function parseGSILine(line: string): GSIMeasurement | null {
  const measurements = parseGSIBlock(line)
  return measurements.length > 0 ? measurements[0] : null
}

// ─── Topcon Parser ───────────────────────────────────────────────────

export interface TopconMeasurement {
  /** Point number (if available) */
  pointNumber?: number
  /** Easting */
  easting?: number
  /** Northing */
  northing?: number
  /** Elevation */
  elevation?: number
  /** Horizontal angle (decimal degrees) */
  horizontalAngle?: number
  /** Vertical angle (decimal degrees) */
  verticalAngle?: number
  /** Slope distance (meters) */
  slopeDistance?: number
  /** Raw response code */
  responseCode: string
  /** Raw line */
  raw: string
}

/**
 * Parse Topcon RC-232 response lines.
 *
 * Response formats:
 * - CO,<E>,<N>,<Elev>,<code>  — Coordinate output
 * - MD,<sd>,<HA>,<VA>,<code> — Measure distance result
 * - VA,<HA>,<VA>             — Angle reading
 * - ID,<model>,<sn>          — Instrument ID
 * - SP                       — Station set acknowledgement
 * - RM                       — Reflector mode acknowledgement
 */
export function parseTopconLine(line: string): TopconMeasurement | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Coordinate output: CO,E,N,Elev,code
  if (trimmed.startsWith('CO,')) {
    const parts = trimmed.split(',')
    if (parts.length >= 4) {
      return {
        easting: parseFloat(parts[1]) || undefined,
        northing: parseFloat(parts[2]) || undefined,
        elevation: parseFloat(parts[3]) || undefined,
        responseCode: 'CO',
        raw: trimmed,
      }
    }
  }

  // Measure distance result: MD,sd,HA,VA,code
  if (trimmed.startsWith('MD,')) {
    const parts = trimmed.split(',')
    if (parts.length >= 4) {
      return {
        slopeDistance: parseFloat(parts[1]) || undefined,
        horizontalAngle: parseFloat(parts[2]) || undefined,
        verticalAngle: parseFloat(parts[3]) || undefined,
        responseCode: 'MD',
        raw: trimmed,
      }
    }
  }

  // Angle reading: VA,HA,VA
  if (trimmed.startsWith('VA,')) {
    const parts = trimmed.split(',')
    if (parts.length >= 3) {
      return {
        horizontalAngle: parseFloat(parts[1]) || undefined,
        verticalAngle: parseFloat(parts[2]) || undefined,
        responseCode: 'VA',
        raw: trimmed,
      }
    }
  }

  // Acknowledgement responses (SP, RM, SO, PI, PII, ID)
  const ackPrefixes = ['SP', 'RM', 'SO', 'PI', 'PII', 'MD0']
  for (const prefix of ackPrefixes) {
    if (trimmed.startsWith(prefix)) {
      return {
        responseCode: prefix,
        raw: trimmed,
      }
    }
  }

  // ID response: ID,model,serial
  if (trimmed.startsWith('ID,')) {
    return {
      responseCode: 'ID',
      raw: trimmed,
    }
  }

  return null
}

// ─── Trimble Parser ───────────────────────────────────────────────────

export interface TrimbleMeasurement {
  /** Point number */
  pointNumber?: number
  /** Easting */
  easting?: number
  /** Northing */
  northing?: number
  /** Elevation */
  elevation?: number
  /** Horizontal angle (decimal degrees) */
  horizontalAngle?: number
  /** Vertical angle (decimal degrees) */
  verticalAngle?: number
  /** Slope distance (meters) */
  slopeDistance?: number
  /** Response code */
  responseCode: string
  /** Raw line */
  raw: string
}

/**
 * Parse Trimble SSV/TCP response lines.
 *
 * Response formats:
 * - %C,E,N,Elev   — Coordinate output
 * - %M,pt,E,N,Elev — Measure and record result
 * - %D,sd,HA,VA   — Distance measurement result
 * - %A,HA,VA      — Angle reading
 * - %I,model,sn   — Instrument info
 * - %S, %T, %F, %O, %K — Acknowledgements
 */
export function parseTrimbleLine(line: string): TrimbleMeasurement | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Coordinate output: %C,E,N,Elev
  if (trimmed.startsWith('%C,')) {
    const parts = trimmed.split(',')
    if (parts.length >= 4) {
      return {
        easting: parseFloat(parts[1]) || undefined,
        northing: parseFloat(parts[2]) || undefined,
        elevation: parseFloat(parts[3]) || undefined,
        responseCode: '%C',
        raw: trimmed,
      }
    }
  }

  // Measure and record: %M,pt,E,N,Elev
  if (trimmed.startsWith('%M,')) {
    const parts = trimmed.split(',')
    if (parts.length >= 5) {
      return {
        pointNumber: parseInt(parts[1]) || undefined,
        easting: parseFloat(parts[2]) || undefined,
        northing: parseFloat(parts[3]) || undefined,
        elevation: parseFloat(parts[4]) || undefined,
        responseCode: '%M',
        raw: trimmed,
      }
    }
  }

  // Distance result: %D,sd,HA,VA
  if (trimmed.startsWith('%D,')) {
    const parts = trimmed.split(',')
    if (parts.length >= 4) {
      return {
        slopeDistance: parseFloat(parts[1]) || undefined,
        horizontalAngle: parseFloat(parts[2]) || undefined,
        verticalAngle: parseFloat(parts[3]) || undefined,
        responseCode: '%D',
        raw: trimmed,
      }
    }
  }

  // Angle reading: %A,HA,VA
  if (trimmed.startsWith('%A,')) {
    const parts = trimmed.split(',')
    if (parts.length >= 3) {
      return {
        horizontalAngle: parseFloat(parts[1]) || undefined,
        verticalAngle: parseFloat(parts[2]) || undefined,
        responseCode: '%A',
        raw: trimmed,
      }
    }
  }

  // Acknowledgement responses (%S, %T, %F, %O, %K, %I)
  const ackPrefixes = ['%S', '%T', '%F', '%O', '%K', '%I']
  for (const prefix of ackPrefixes) {
    if (trimmed.startsWith(prefix)) {
      return {
        responseCode: prefix,
        raw: trimmed,
      }
    }
  }

  return null
}

// ─── Sokkia Parser ───────────────────────────────────────────────────

export interface SokkiaMeasurement {
  /** Point number */
  pointNumber?: number
  /** Easting */
  easting?: number
  /** Northing */
  northing?: number
  /** Elevation */
  elevation?: number
  /** Horizontal angle (DDDMMSS) */
  horizontalAngle?: number
  /** Vertical angle (DDDMMSS) */
  verticalAngle?: number
  /** Slope distance (meters) */
  slopeDistance?: number
  /** Response code */
  responseCode: string
  /** Raw line */
  raw: string
}

/**
 * Convert DDDMMSS angle format to decimal degrees
 */
function dddmmssToDecimal(dddmmss: number): number {
  const abs = Math.abs(dddmmss)
  const ddd = Math.floor(abs / 10000)
  const mm = Math.floor((abs % 10000) / 100)
  const ss = abs % 100
  const decimal = ddd + mm / 60 + ss / 3600
  return dddmmss < 0 ? -decimal : decimal
}

/**
 * Parse Sokkia SDR33 response lines.
 *
 * Response formats:
 * - 08/pt,E,N,Elev,code    — Coordinate output
 * - 02/pt,sd,HA(VA),VA     — Measurement result
 * - 03/HA,VA               — Angle reading
 * - 01/model,sn            — Instrument ID
 * - 07/, 09/, 10/, 11/      — Acknowledgements
 *
 * Fields in SDR33 are comma-separated after the record type prefix.
 */
export function parseSokkiaLine(line: string): SokkiaMeasurement | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Coordinate output: 08/pt,E,N,Elev,code
  if (trimmed.startsWith('08/')) {
    const data = trimmed.substring(3)
    const parts = data.split(',')
    if (parts.length >= 3) {
      return {
        pointNumber: parseInt(parts[0]) || undefined,
        easting: parseFloat(parts[1]) || undefined,
        northing: parseFloat(parts[2]) || undefined,
        elevation: parts[3] ? parseFloat(parts[3]) : undefined,
        responseCode: '08/',
        raw: trimmed,
      }
    }
  }

  // Measurement result: 02/pt,sd,HA,VA
  if (trimmed.startsWith('02/')) {
    const data = trimmed.substring(3)
    const parts = data.split(',')
    if (parts.length >= 4) {
      const ha = parseFloat(parts[2])
      const va = parseFloat(parts[3])
      return {
        pointNumber: parseInt(parts[0]) || undefined,
        slopeDistance: parseFloat(parts[1]) || undefined,
        horizontalAngle: ha > 360 ? dddmmssToDecimal(ha) : ha || undefined,
        verticalAngle: va > 360 ? dddmmssToDecimal(va) : va || undefined,
        responseCode: '02/',
        raw: trimmed,
      }
    }
  }

  // Angle reading: 03/HA,VA
  if (trimmed.startsWith('03/')) {
    const data = trimmed.substring(3)
    const parts = data.split(',')
    if (parts.length >= 2) {
      const ha = parseFloat(parts[0])
      const va = parseFloat(parts[1])
      return {
        horizontalAngle: ha > 360 ? dddmmssToDecimal(ha) : ha || undefined,
        verticalAngle: va > 360 ? dddmmssToDecimal(va) : va || undefined,
        responseCode: '03/',
        raw: trimmed,
      }
    }
  }

  // Acknowledgement responses (07/, 09/, 10/, 11/, 06/, 04/, 01/)
  const ackPrefixes = ['07/', '09/', '10/', '11/', '06/', '04/', '01/']
  for (const prefix of ackPrefixes) {
    if (trimmed.startsWith(prefix)) {
      return {
        responseCode: prefix,
        raw: trimmed,
      }
    }
  }

  return null
}

// ─── Stream Parser (for real-time serial input) ─────────────────────────

export type ParsedInstrumentData =
  | { type: 'nmea'; data: NMEAPosition | NMEARMC }
  | { type: 'gsi'; data: GSIMeasurement }
  | { type: 'topcon'; data: TopconMeasurement }
  | { type: 'trimble'; data: TrimbleMeasurement }
  | { type: 'sokkia'; data: SokkiaMeasurement }
  | { type: 'unknown'; data: string }

export interface InstrumentStreamParser {
  /** Push raw bytes/string into the parser */
  feed(data: string): ParsedInstrumentData[]
  /** Reset internal buffer */
  reset(): void
  /** Get current detection state */
  readonly detectedProtocol: 'nmea' | 'gsi' | 'topcon' | 'trimble' | 'sokkia' | 'unknown'
}

/**
 * Auto-detecting stream parser that handles NMEA, GSI, Topcon, Trimble, and Sokkia protocols.
 * Maintains an internal line buffer for incomplete lines.
 *
 * Detection heuristics:
 * - Lines starting with '$' → NMEA
 * - Lines containing 'W' prefix with word indices → GSI (Leica)
 * - Lines starting with CO/MD/VA/ID/SP/RM → Topcon
 * - Lines starting with %C/%M/%D/%A/%S/%T/%F/%O/%K/%I → Trimble
 * - Lines starting with 01/-11/ → Sokkia SDR33
 */
export function createStreamParser(): InstrumentStreamParser {
  let buffer = ''
  let protocol: 'nmea' | 'gsi' | 'topcon' | 'trimble' | 'sokkia' | 'unknown' = 'unknown'
  let sampleCount = 0

  /**
   * Heuristic protocol detection from a single line
   */
  function detectProtocolFromLine(line: string): 'nmea' | 'gsi' | 'topcon' | 'trimble' | 'sokkia' | 'unknown' {
    // NMEA: starts with $ and has a known talker ID
    if (/^\$[A-Z]{2,3}/.test(line)) return 'nmea'

    // Trimble: starts with % followed by a command letter
    if (/^%[A-Z]/.test(line)) return 'trimble'

    // Topcon: starts with known Topcon response codes
    if (/^(CO|MD|VA|ID|SP|RM|SO|PI|PII)[,\r\n]/.test(line)) return 'topcon'

    // Sokkia: starts with two-digit record type followed by /
    if (/^\d{2}\//.test(line)) return 'sokkia'

    // GSI: contains W prefix words with numeric indices
    if (/^W\d{2}/.test(line) || /\sW\d{2}/.test(line)) return 'gsi'

    return 'unknown'
  }

  return {
    get detectedProtocol() { return protocol },

    feed(data: string): ParsedInstrumentData[] {
      buffer += data
      const results: ParsedInstrumentData[] = []

      // Split into lines
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || '' // Keep incomplete last line

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        // Auto-detect protocol from first few lines
        if (protocol === 'unknown') {
          sampleCount++
          const detected = detectProtocolFromLine(trimmed)
          if (detected !== 'unknown') {
            protocol = detected
          } else if (sampleCount > 10) {
            // Give up detection after 10 samples
          }
        }

        // Parse based on detected protocol (with per-line override for mixed streams)
        const effectiveProtocol = protocol !== 'unknown' ? protocol : detectProtocolFromLine(trimmed)

        if (effectiveProtocol === 'nmea' || trimmed.startsWith('$')) {
          const parsed = parseNMEA(trimmed)
          if (parsed) {
            results.push({ type: 'nmea', data: parsed })
          } else {
            results.push({ type: 'unknown', data: trimmed })
          }
        } else if (effectiveProtocol === 'gsi') {
          const measurement = parseGSILine(trimmed)
          if (measurement) {
            results.push({ type: 'gsi', data: measurement })
          } else {
            results.push({ type: 'unknown', data: trimmed })
          }
        } else if (effectiveProtocol === 'topcon') {
          const measurement = parseTopconLine(trimmed)
          if (measurement) {
            results.push({ type: 'topcon', data: measurement })
          } else {
            results.push({ type: 'unknown', data: trimmed })
          }
        } else if (effectiveProtocol === 'trimble') {
          const measurement = parseTrimbleLine(trimmed)
          if (measurement) {
            results.push({ type: 'trimble', data: measurement })
          } else {
            results.push({ type: 'unknown', data: trimmed })
          }
        } else if (effectiveProtocol === 'sokkia') {
          const measurement = parseSokkiaLine(trimmed)
          if (measurement) {
            results.push({ type: 'sokkia', data: measurement })
          } else {
            results.push({ type: 'unknown', data: trimmed })
          }
        } else {
          results.push({ type: 'unknown', data: trimmed })
        }
      }

      return results
    },

    reset() {
      buffer = ''
      protocol = 'unknown'
      sampleCount = 0
    }
  }
}
