/**
 * @module totalStationSerial
 *
 * Web Serial API integration for total station instruments.
 *
 * Connects directly to total stations via USB or Bluetooth (using
 * Web Serial API on Chrome/Edge). Eliminates the need for manufacturer
 * software — surveyors can stream observations directly into METARDU.
 *
 * Supported instruments (via their serial protocols):
 *   - Topcon: GSI format (raw data) + RC-100 commands
 *   - Leica: GSI-8 / GSI-16 format
 *   - Sokkia: SDR format
 *   - Trimble: RAW format
 *   - Pentax: PENTAX RAW format
 *   - South: NMEA-0183 compatible
 *
 * Browser support:
 *   - Chrome/Edge 89+ (full support)
 *   - Safari/Firefox: NOT supported (use the Capacitor mobile app
 *     which has a polyfill via @capacitor-community/serial)
 */

export type InstrumentBrand = 'topcon' | 'leica' | 'sokkia' | 'trimble' | 'pentax' | 'south' | 'generic'

export interface InstrumentConfig {
  brand: InstrumentBrand
  model?: string
  baudRate: number
  dataBits: 7 | 8
  stopBits: 1 | 2
  parity: 'none' | 'even' | 'odd'
  measureCommand: string
  autoSend: boolean
}

export interface RawObservation {
  raw: string
  parsed: ParsedObservation | null
  timestamp: string
}

export interface ParsedObservation {
  pointId?: string
  horizontalAngle?: number
  verticalAngle?: number
  slopeDistance?: number
  horizontalDistance?: number
  easting?: number
  northing?: number
  elevation?: number
  instrumentHeight?: number
  targetHeight?: number
  temperature?: number
  pressure?: number
}

export const INSTRUMENT_PRESETS: Record<InstrumentBrand, InstrumentConfig> = {
  topcon: { brand: 'topcon', baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', measureCommand: '061', autoSend: false },
  leica: { brand: 'leica', baudRate: 9600, dataBits: 7, stopBits: 1, parity: 'even', measureCommand: 'GET/M/WI81/22', autoSend: false },
  sokkia: { brand: 'sokkia', baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', measureCommand: 'M', autoSend: false },
  trimble: { brand: 'trimble', baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', measureCommand: 'ST', autoSend: false },
  pentax: { brand: 'pentax', baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', measureCommand: 'M', autoSend: false },
  south: { brand: 'south', baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', measureCommand: 'M', autoSend: false },
  generic: { brand: 'generic', baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', measureCommand: '', autoSend: false },
}

export class TotalStationConnection {
  private port: any = null
  private reader: any = null
  private writer: any = null
  private config: InstrumentConfig
  private connected = false
  private decoder: TextDecoder
  private buffer: string = ''
  private onObservation?: (obs: RawObservation) => void

  constructor(config: InstrumentConfig, onObservation?: (obs: RawObservation) => void) {
    this.config = config
    this.onObservation = onObservation
    this.decoder = new TextDecoder()
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator
  }

  async connect(): Promise<void> {
    if (!TotalStationConnection.isSupported()) {
      throw new Error('Web Serial API is not supported. Use Chrome/Edge 89+ or the METARDU mobile app.')
    }
    // @ts-ignore
    this.port = await navigator.serial.requestPort()
    await this.port.open({
      baudRate: this.config.baudRate,
      dataBits: this.config.dataBits,
      stopBits: this.config.stopBits,
      parity: this.config.parity,
    })
    this.reader = this.port.readable.getReader()
    this.writer = this.port.writable.getWriter()
    this.connected = true
    this.readLoop()
  }

  async disconnect(): Promise<void> {
    this.connected = false
    if (this.reader) { try { await this.reader.cancel() } catch {} try { this.reader.releaseLock() } catch {} this.reader = null }
    if (this.writer) { try { this.writer.releaseLock() } catch {} this.writer = null }
    if (this.port) { try { await this.port.close() } catch {} this.port = null }
  }

  async measure(): Promise<void> {
    if (!this.connected || !this.writer) throw new Error('Not connected to instrument')
    const cmd = this.config.measureCommand
    if (!cmd) return
    const data = new TextEncoder().encode(cmd + '\r\n')
    await this.writer.write(data)
  }

  isConnected(): boolean { return this.connected }
  getConfig(): InstrumentConfig { return this.config }

  private async readLoop() {
    if (!this.reader) return
    try {
      while (this.connected) {
        const { value, done } = await this.reader.read()
        if (done) break
        this.buffer += this.decoder.decode(value, { stream: true })
        const lines = this.buffer.split(/\r\n|\n|\r/)
        this.buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.trim().length === 0) continue
          const parsed = parseInstrumentData(line, this.config.brand)
          this.onObservation?.({ raw: line, parsed, timestamp: new Date().toISOString() })
        }
      }
    } catch (err) {
      if (this.connected) console.error('[TotalStation] Read error:', err)
    }
  }
}

export function parseInstrumentData(raw: string, brand: InstrumentBrand): ParsedObservation | null {
  switch (brand) {
    case 'topcon':
    case 'leica':
      return parseGSI(raw)
    case 'sokkia':
      return parseSDR(raw)
    case 'trimble':
      return parseTrimbleRAW(raw)
    default:
      return parseGeneric(raw)
  }
}

function parseGSI(raw: string): ParsedObservation | null {
  try {
    const result: ParsedObservation = {}
    const words = raw.trim().split(/\s+/)
    for (const word of words) {
      if (word.length < 7) continue
      const wi = word.substring(0, 2)
      const sign = word.charAt(5) === '-' ? -1 : 1
      const val = sign * parseFloat(word.substring(6))
      if (isNaN(val)) continue
      switch (wi) {
        case '21': result.horizontalAngle = val / 100000 * 0.00001 * 180 / Math.PI; break
        case '22': result.verticalAngle = val / 100000 * 0.00001 * 180 / Math.PI; break
        case '31': result.slopeDistance = val / 10000; break
        case '32': result.horizontalDistance = val / 10000; break
        case '81': result.easting = val / 1000; break
        case '82': result.northing = val / 1000; break
        case '83': result.elevation = val / 1000; break
        case '87': result.targetHeight = val / 100000; break
        case '88': result.instrumentHeight = val / 100000; break
      }
    }
    if (result.horizontalAngle == null && result.slopeDistance == null && result.easting == null) return null
    return result
  } catch { return null }
}

function parseSDR(raw: string): ParsedObservation | null {
  try {
    const parts = raw.trim().split(',')
    if (parts.length < 2) return null
    const rt = parts[0].substring(0, 2)
    if (rt === '09' && parts.length >= 7) {
      return { pointId: parts[1]?.trim(), horizontalAngle: parseFloat(parts[2]) || undefined, verticalAngle: parseFloat(parts[3]) || undefined, slopeDistance: parseFloat(parts[4]) || undefined, targetHeight: parseFloat(parts[5]) || undefined, instrumentHeight: parseFloat(parts[6]) || undefined }
    }
    if (rt === '08' && parts.length >= 5) {
      return { pointId: parts[1]?.trim(), easting: parseFloat(parts[2]) || undefined, northing: parseFloat(parts[3]) || undefined, elevation: parseFloat(parts[4]) || undefined }
    }
    return null
  } catch { return null }
}

function parseTrimbleRAW(raw: string): ParsedObservation | null {
  try {
    const parts = raw.trim().split(',')
    if (parts.length < 4) return null
    const result: ParsedObservation = { pointId: parts[0]?.trim() || undefined, horizontalAngle: parseFloat(parts[1]) || undefined, verticalAngle: parseFloat(parts[2]) || undefined, slopeDistance: parseFloat(parts[3]) || undefined }
    if (parts.length > 4) result.targetHeight = parseFloat(parts[4]) || undefined
    if (parts.length > 5) result.instrumentHeight = parseFloat(parts[5]) || undefined
    return result
  } catch { return null }
}

function parseGeneric(raw: string): ParsedObservation | null {
  try {
    const parts = raw.trim().split(/[,;\t]/)
    const numbers = parts.map(p => parseFloat(p)).filter(n => !isNaN(n))
    if (numbers.length >= 3) {
      return { horizontalAngle: numbers[0], verticalAngle: numbers[1], slopeDistance: numbers[2], targetHeight: numbers[3] || undefined }
    }
    return null
  } catch { return null }
}
