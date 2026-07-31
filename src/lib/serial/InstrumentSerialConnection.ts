/**
 * METARDU Instrument Serial Connection Manager
 * =============================================
 * Manages direct serial connections to surveying instruments
 * via the Web Serial API (Chrome/Edge desktop browsers).
 *
 * Supported instruments:
 * - Leica TS16 / TS60 / Viva series (GSI format, 9600-115200 baud)
 * - Trimble R10 / R12i / S7 (SSV/NMEA, 9600-38400 baud)
 * - Topcon OS / DS series (TOPCON, 9600 baud)
 * - Sokkia CX / FX series (SDR, 9600-115200 baud)
 * - Generic GNSS receivers (NMEA 0183, 4800-115200 baud)
 *
 * Features:
 * - Auto-detection of instrument protocol (NMEA vs GSI)
 * - Real-time coordinate streaming
 * - Configurable baud rate, parity, stop bits
 * - Connection health monitoring
 * - Automatic reconnection attempts
 */

import { Capacitor } from '@capacitor/core'
import { UsbSerial } from '@leeskies/capacitor-usb-serial'
import { createStreamParser, type ParsedInstrumentData, type InstrumentStreamParser } from './protocolParsers'

// ─── Types ────────────────────────────────────────────────────────────────

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'streaming' | 'error' | 'reconnecting'

export interface SerialConnectionConfig {
  /** Baud rate (default: 9600) */
  baudRate: number
  /** Data bits (default: 8) */
  dataBits: 7 | 8
  /** Stop bits (default: 1) */
  stopBits: 1 | 2
  /** Parity (default: 'none') */
  parity: 'none' | 'even' | 'odd'
  /** Flow control (default: 'none') */
  flowControl: 'none' | 'hardware'
  /** Read timeout in ms (default: 5000) */
  readTimeout?: number
}

export interface InstrumentInfo {
  manufacturer: string
  model?: string
  protocol: 'nmea' | 'gsi' | 'topcon' | 'trimble' | 'sokkia' | 'unknown'
  detectedAt: Date
}

export interface ConnectionStats {
  bytesReceived: number
  messagesParsed: number
  errors: number
  connectedAt: Date
  lastDataAt: Date
}

type DataCallback = (data: ParsedInstrumentData) => void
type StatusCallback = (status: ConnectionStatus) => void
type ErrorCallback = (error: Error) => void

// ─── Default Configuration ───────────────────────────────────────────────

const DEFAULT_CONFIG: SerialConnectionConfig = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
  readTimeout: 5000,
}

// ─── Preset Configurations ──────────────────────────────────────────────

export const INSTRUMENT_PRESETS: Record<string, { name: string; config: SerialConnectionConfig; protocol: 'nmea' | 'gsi' | 'topcon' | 'trimble' | 'sokkia' }> = {
  'leica-ts16': {
    name: 'Leica TS16 / TS60 / Viva',
    config: { baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' },
    protocol: 'gsi',
  },
  'leica-ts15': {
    name: 'Leica TS15 / TS11',
    config: { baudRate: 19200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' },
    protocol: 'gsi',
  },
  'trimble-r10': {
    name: 'Trimble R10 / R12i (GNSS)',
    config: { baudRate: 38400, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'hardware' },
    protocol: 'nmea',
  },
  'trimble-s7': {
    name: 'Trimble S7 / S9 (Total Station)',
    config: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' },
    protocol: 'trimble',
  },
  'topcon-os': {
    name: 'Topcon OS / DS / GM',
    config: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' },
    protocol: 'topcon',
  },
  'sokkia-cx': {
    name: 'Sokkia CX / FX',
    config: { baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' },
    protocol: 'sokkia',
  },
  'generic-gnss': {
    name: 'Generic GNSS Receiver',
    config: { baudRate: 4800, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' },
    protocol: 'nmea',
  },
}

// ─── Serial Connection Manager ──────────────────────────────────────────

export class InstrumentSerialConnection {
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private parser: InstrumentStreamParser | null = null
  private readLoopActive = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null

  // State
  private _status: ConnectionStatus = 'disconnected'
  private _config: SerialConnectionConfig
  private _instrumentInfo: InstrumentInfo | null = null
  private _stats: ConnectionStats | null = null

  // Callbacks
  private onDataCallbacks: Set<DataCallback> = new Set()
  private onStatusCallbacks: Set<StatusCallback> = new Set()
  private onErrorCallbacks: Set<ErrorCallback> = new Set()
  
  // Capacitor Native
  private nativePortId: string | null = null
  private nativeDataListener: any = null

  constructor(config: Partial<SerialConnectionConfig> = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config }
  }

  // ─── Getters ─────────────────────────────────────────────────────────

  get status(): ConnectionStatus { return this._status }
  get config(): SerialConnectionConfig { return this._config }
  get instrumentInfo(): InstrumentInfo | null { return this._instrumentInfo }
  get stats(): ConnectionStats | null { return this._stats }
  get isConnected(): boolean {
    return this._status === 'connected' || this._status === 'streaming'
  }

  // ─── Event Handlers ─────────────────────────────────────────────────

  onData(callback: DataCallback): () => void {
    this.onDataCallbacks.add(callback)
    return () => this.onDataCallbacks.delete(callback)
  }

  onStatus(callback: StatusCallback): () => void {
    this.onStatusCallbacks.add(callback)
    return () => this.onStatusCallbacks.delete(callback)
  }

  onError(callback: ErrorCallback): () => void {
    this.onErrorCallbacks.add(callback)
    return () => this.onErrorCallbacks.delete(callback)
  }

  // ─── Connection Lifecycle ───────────────────────────────────────────

  async connect(): Promise<void> {
    this.setStatus('connecting')

    try {
      if (Capacitor.isNativePlatform()) {
        // --- NATIVE ANDROID MODE ---
        const devicesResult = await UsbSerial.listDevices()
        const devices = devicesResult.devices
        
        if (!devices || devices.length === 0) {
          throw new Error('No USB serial devices found. Please connect an instrument via OTG.')
        }

        const deviceId = devices[0].deviceId
        await UsbSerial.requestPermission({ deviceId })

        const openResult = await UsbSerial.open({ deviceId })
        this.nativePortId = openResult.portId

        // Note: The plugin types use DataBits, StopBits, Parity enums
        // For simplicity we cast our numbers to any/expected types if needed
        await UsbSerial.setParameters({
          portId: this.nativePortId,
          baudRate: this._config.baudRate,
          dataBits: this._config.dataBits as any,
          stopBits: this._config.stopBits as any,
          parity: (this._config.parity === 'none' ? 0 : this._config.parity === 'odd' ? 1 : 2) as any,
        })

        // Ensure DTR/RTS is active
        await UsbSerial.setDTR({ portId: this.nativePortId, value: true }).catch(() => {})
        await UsbSerial.setRTS({ portId: this.nativePortId, value: true }).catch(() => {})

        this.parser = createStreamParser()
        this._stats = {
          bytesReceived: 0,
          messagesParsed: 0,
          errors: 0,
          connectedAt: new Date(),
          lastDataAt: new Date(),
        }

        this.setStatus('connected')
        this.reconnectAttempts = 0
        this.startHealthCheck()
        
        // Listen for data natively
        this.nativeDataListener = await UsbSerial.addListener('data', (data: any) => {
          if (!this.parser || !this.readLoopActive) return
          // Native plugin returns base64
          const text = atob(data.data)
          
          if (this._stats) {
            this._stats.bytesReceived += text.length
            this._stats.lastDataAt = new Date()
          }
          
          const results = this.parser.feed(text)
          for (const result of results) {
            this.processParsedResult(result)
          }
        })

        await UsbSerial.startReading({ portId: this.nativePortId })
        this.readLoopActive = true
        this.setStatus('streaming')
        
      } else {
        // --- WEB BROWSER MODE ---
        if (!('serial' in navigator)) {
          throw new Error('Web Serial API is not supported in this browser. Please use Chrome or Edge.')
        }

        const serial = (navigator as any).serial as Serial
        this.port = await serial.requestPort()

        await this.port.open({
          baudRate: this._config.baudRate,
          dataBits: this._config.dataBits,
          stopBits: this._config.stopBits,
          parity: this._config.parity,
          flowControl: this._config.flowControl,
        })

        this.parser = createStreamParser()
        this._stats = {
          bytesReceived: 0,
          messagesParsed: 0,
          errors: 0,
          connectedAt: new Date(),
          lastDataAt: new Date(),
        }

        if (this.port.writable) {
          this.writer = this.port.writable.getWriter()
        }

        this.setStatus('connected')
        this.reconnectAttempts = 0
        this.startReadLoop()
        this.startHealthCheck()
      }

    } catch (error) {
      if ((error as Error).name === 'NotFoundError') {
        // User cancelled port selection
        this.setStatus('disconnected')
        return
      }
      this.setStatus('error')
      const err = error instanceof Error ? error : new Error(String(error))
      this.emitError(err)
      throw err
    }
  }

  /**
   * Disconnect from the instrument
   */
  async disconnect(): Promise<void> {
    this.stopReadLoop()
    this.stopHealthCheck()
    this.stopReconnect()

    try {
      if (Capacitor.isNativePlatform() && this.nativePortId) {
        if (this.nativeDataListener) {
          await this.nativeDataListener.remove().catch(() => {})
          this.nativeDataListener = null
        }
        await UsbSerial.stopReading({ portId: this.nativePortId }).catch(() => {})
        await UsbSerial.close({ portId: this.nativePortId }).catch(() => {})
        this.nativePortId = null
      } else {
        if (this.writer) {
          await this.writer.close().catch(() => {})
          this.writer = null
        }
        if (this.reader) {
          await this.reader.cancel().catch(() => {})
          this.reader = null
        }
        if (this.port) {
          await this.port.close().catch(() => {})
          this.port = null
        }
      }
    } catch {
      // Ignore close errors
    }

    this._instrumentInfo = null
    this.parser = null
    this.setStatus('disconnected')
  }

  /**
   * Update connection configuration (must reconnect)
   */
  updateConfig(config: Partial<SerialConnectionConfig>): void {
    this._config = { ...this._config, ...config }
  }

  /**
   * Connect using a preset instrument configuration
   */
  async connectWithPreset(presetKey: string): Promise<void> {
    const preset = INSTRUMENT_PRESETS[presetKey]
    if (!preset) throw new Error(`Unknown instrument preset: ${presetKey}`)
    this._config = { ...preset.config }
    await this.connect()
  }

  // ─── Data Transmission ─────────────────────────────────────────────

  async send(data: Uint8Array): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      if (!this.nativePortId) throw new Error('Not connected natively')
      const b64 = btoa(String.fromCharCode.apply(null, Array.from(data)))
      await UsbSerial.write({ portId: this.nativePortId, data: b64 })
    } else {
      if (!this.writer) throw new Error('Not connected')
      await this.writer.write(data)
    }
  }

  /**
   * Send a string command to the instrument
   */
  async sendCommand(command: string): Promise<void> {
    const encoder = new TextEncoder()
    await this.send(encoder.encode(command + '\r\n'))
  }

  /**
   * Request measurement from Leica total station (legacy convenience method)
   */
  async requestLeicaMeasurement(): Promise<void> {
    // Standard Leica GSI measurement trigger commands
    const commands = [
      '%R1Q,5002:1,0,0,0,0\r\n',  // Request distance + angle
      '%R1Q,2008:1,0\r\n',         // Trigger measurement
    ]
    for (const cmd of commands) {
      await this.sendCommand(cmd)
    }
  }

  /**
   * Send a brand-specific instrument command
   * Uses the multi-brand command protocol system (Leica, Topcon, Trimble, Sokkia)
   *
   * @example
   * // Measure with a Topcon total station
   * await connection.sendInstrumentCommand('topcon', 'measureAndRecord')
   *
   * // Set prism target on a Trimble S7
   * await connection.sendInstrumentCommand('trimble', 'setPrismTarget', 0)
   *
   * // Set station on a Sokkia CX
   * await connection.sendInstrumentCommand('sokkia', 'setStation', stationSetup)
   */
  async sendInstrumentCommand(
    brand: 'leica' | 'topcon' | 'trimble' | 'sokkia',
    commandType: string,
    ...args: unknown[]
  ): Promise<void> {
    // Dynamic import to avoid circular dependency
    const { getInstrumentCommand } = await import('./instrumentCommands')
    const cmd = getInstrumentCommand(brand, commandType as any, ...args)
    await this.sendCommand(cmd.command)
  }

  /**
   * Get the brand for the currently connected instrument based on preset
   */
  getCurrentBrand(): 'leica' | 'topcon' | 'trimble' | 'sokkia' | null {
    // Try to determine from detected protocol and preset
    if (this._instrumentInfo) {
      if (this._instrumentInfo.manufacturer?.toLowerCase().includes('leica')) return 'leica'
      if (this._instrumentInfo.manufacturer?.toLowerCase().includes('topcon')) return 'topcon'
      if (this._instrumentInfo.manufacturer?.toLowerCase().includes('trimble')) return 'trimble'
      if (this._instrumentInfo.manufacturer?.toLowerCase().includes('sokkia')) return 'sokkia'
    }
    return null
  }

  // ─── Private Methods ───────────────────────────────────────────────

  private setStatus(status: ConnectionStatus) {
    this._status = status
    this.onStatusCallbacks.forEach(cb => {
      try { cb(status) } catch { /* ignore callback errors */ }
    })
  }

  private emitError(error: Error) {
    this.onErrorCallbacks.forEach(cb => {
      try { cb(error) } catch { /* ignore callback errors */ }
    })
  }

  private emitData(data: ParsedInstrumentData) {
    this.onDataCallbacks.forEach(cb => {
      try { cb(data) } catch { /* ignore callback errors */ }
    })
  }

  private async startReadLoop(): Promise<void> {
    if (!this.port?.readable || this.readLoopActive) return
    this.readLoopActive = true

    this.setStatus('streaming')

    while (this.readLoopActive && this.port.readable) {
      try {
        this.reader = this.port.readable.getReader()

        while (this.readLoopActive && this.reader) {
          const { value, done } = await this.reader.read()

          if (done) break
          if (!value || !this.parser) continue

          // Update stats
          if (this._stats) {
            this._stats.bytesReceived += value.length
            this._stats.lastDataAt = new Date()
          }

          // Decode bytes to string and feed to parser
          const decoder = new TextDecoder()
          const text = decoder.decode(value, { stream: true })
          const results = this.parser.feed(text)

          // Emit parsed data
          for (const result of results) {
            this.processParsedResult(result)
          }
        }
      } catch (error) {
        if (this.readLoopActive) {
          if (this._stats) { this._stats.errors++ }

          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.setStatus('reconnecting')
            this.reconnectAttempts++
            this.scheduleReconnect()
          } else {
            this.setStatus('error')
            this.emitError(error instanceof Error ? error : new Error(String(error)))
          }
        }
      } finally {
        if (this.reader) {
          try { this.reader.releaseLock() } catch { /* ignore */ }
          this.reader = null
        }
      }
    }

    this.readLoopActive = false
  }

  private stopReadLoop() {
    this.readLoopActive = false
    if (this.reader) {
      try { this.reader.cancel() } catch { /* ignore */ }
      try { this.reader.releaseLock() } catch { /* ignore */ }
      this.reader = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000)

    this.reconnectTimer = setTimeout(async () => {
      try {
        // Try to reopen the port
        if (this.port) {
          await this.port.open({
            baudRate: this._config.baudRate,
            dataBits: this._config.dataBits,
            stopBits: this._config.stopBits,
            parity: this._config.parity,
            flowControl: this._config.flowControl,
          })

          if (this.port.writable) {
            this.writer = this.port.writable.getWriter()
          }

          this.parser = createStreamParser()
          this.startReadLoop()
        }
      } catch {
        this.setStatus('error')
      }
    }, delay)
  }

  private stopReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private startHealthCheck() {
    this.stopHealthCheck()
    this.healthCheckTimer = setInterval(() => {
      if (this._stats) {
        const timeSinceData = Date.now() - this._stats.lastDataAt.getTime()
        // If no data for 30 seconds, consider connection stale
        if (timeSinceData > 30000 && this._status === 'streaming') {
          this._stats.errors++
        }
      }
    }, 10000)
  }

  private stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }
  }

  private processParsedResult(result: ParsedInstrumentData) {
    if (result.type !== 'unknown') {
      if (this._stats) this._stats.messagesParsed++
      this.emitData(result)

      if (!this._instrumentInfo) {
        this._instrumentInfo = {
          manufacturer: 'Unknown',
          protocol: result.type,
          detectedAt: new Date(),
        }

        if (result.type === 'gsi') {
          this._instrumentInfo.manufacturer = 'Leica / Leica Geosystems'
        } else if (result.type === 'nmea') {
          this._instrumentInfo.manufacturer = 'GNSS Receiver'
        } else if (result.type === 'topcon') {
          this._instrumentInfo.manufacturer = 'Topcon'
        } else if (result.type === 'trimble') {
          this._instrumentInfo.manufacturer = 'Trimble'
        } else if (result.type === 'sokkia') {
          this._instrumentInfo.manufacturer = 'Sokkia'
        }
      }
    }
  }
}

// ─── Helper: Check Web Serial Support ───────────────────────────────────

export function isSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator
}

// ─── Helper: Get Available Ports (if previously granted) ─────────────────

export async function getPreviouslyAuthorizedPorts(): Promise<SerialPort[]> {
  if (!isSerialSupported()) return []
  try {
    return await ((navigator as any).serial as Serial).getPorts()
  } catch {
    return []
  }
}
