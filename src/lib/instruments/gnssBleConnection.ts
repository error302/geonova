/**
 * @module gnssBleConnection
 *
 * Web Bluetooth API integration for GNSS rover connections.
 *
 * Connects to GNSS rovers (Emlid Reach, Topcon HiPer, Leica GS18, etc.)
 * via Bluetooth Low Energy (BLE). Streams RTCM3 correction messages
 * from an NTRIP caster to the rover, and receives NMEA position data
 * back for real-time display on the map.
 *
 * Protocol flow:
 *   1. User selects a BLE device (navigator.bluetooth.requestDevice)
 *   2. Connect to the GATT server
 *   3. Subscribe to NMEA position notifications (RX characteristic)
 *   4. Send RTCM3 corrections to the rover (TX characteristic)
 *   5. Parse NMEA sentences → position updates
 *
 * Browser support:
 *   - Chrome/Edge 56+ (full support)
 *   - Safari 16+ (partial)
 *   - Firefox: NOT supported (use Capacitor mobile app)
 *   - On Android (Capacitor): uses @capacitor-community/bluetooth-le
 */

export interface GNSSPosition {
  latitude: number
  longitude: number
  elevation: number
  /** Horizontal accuracy in metres (CEP) */
  accuracy: number
  /** Fix quality: 0=invalid, 1=GPS fix, 2=DGPS, 4=RTK fixed, 5=RTK float */
  fixQuality: number
  /** Fix quality as human-readable string */
  fixLabel: string
  /** Number of satellites used */
  satellites: number
  /** HDOP (horizontal dilution of precision) */
  hdop: number
  /** Timestamp of the position */
  timestamp: string
}

export interface GNSSConnectionState {
  connected: boolean
  deviceName?: string
  receivingData: boolean
  positionsReceived: number
  lastPosition?: GNSSPosition
  correctionsSent: number
}

// BLE UUIDs for common GNSS receivers
// These are the standard NMEA-over-BLE service/characteristic UUIDs
const BLE_SERVICE_NMEA = '0000ffe0-0000-1000-8000-00805f9b34fb' // common HM-10 UART service
const BLE_CHAR_NMEA_RX = '0000ffe1-0000-1000-8000-00805f9b34fb' // receive NMEA
const BLE_CHAR_NMEA_TX = '0000ffe2-0000-1000-8000-00805f9b34fb' // send RTCM3

// Emlid Reach specific UUIDs
const EMLID_SERVICE = '0000ee01-0000-1000-8000-00805f9b34fb'
const EMLID_CHAR_POSITION = '0000ee02-0000-1000-8000-00805f9b34fb'
const EMLID_CHAR_CORRECTIONS = '0000ee03-0000-1000-8000-00805f9b34fb'

export class GNSSBleConnection {
  private device: any = null
  private server: any = null
  private rxCharacteristic: any = null
  private txCharacteristic: any = null
  private connected = false
  private state: GNSSConnectionState = {
    connected: false,
    receivingData: false,
    positionsReceived: 0,
    correctionsSent: 0,
  }
  private nmeaBuffer = ''
  private onPosition?: (pos: GNSSPosition) => void
  private onStateChange?: (state: GNSSConnectionState) => void
  private decoder = new TextDecoder()

  constructor(
    onPosition?: (pos: GNSSPosition) => void,
    onStateChange?: (state: GNSSConnectionState) => void,
  ) {
    this.onPosition = onPosition
    this.onStateChange = onStateChange
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  }

  /**
   * Request a BLE device and connect.
   * Must be called from a user gesture (button click).
   */
  async connect(): Promise<void> {
    if (!GNSSBleConnection.isSupported()) {
      throw new Error(
        'Web Bluetooth API is not supported. Use Chrome/Edge 56+ or the METARDU mobile app.'
      )
    }

    // @ts-ignore
    this.device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: [BLE_SERVICE_NMEA] },
        { services: [EMLID_SERVICE] },
        { namePrefix: 'Reach' },     // Emlid Reach
        { namePrefix: 'HiPer' },     // Topcon HiPer
        { namePrefix: 'GS' },        // Leica GS18/GS16
        { namePrefix: 'STONEX' },    // Stonex
        { namePrefix: 'CHC' },       // CHCNAV
      ],
      optionalServices: [BLE_SERVICE_NMEA, EMLID_SERVICE, 'generic_access'],
    })

    this.device.addEventListener('gattserverdisconnected', () => {
      this.connected = false
      this.state.connected = false
      this.state.receivingData = false
      this.notifyStateChange()
    })

    this.server = await this.device.gatt.connect()

    // Try standard NMEA service first, then Emlid
    let service
    try {
      service = await this.server.getPrimaryService(BLE_SERVICE_NMEA)
      this.rxCharacteristic = await service.getCharacteristic(BLE_CHAR_NMEA_RX)
      this.txCharacteristic = await service.getCharacteristic(BLE_CHAR_NMEA_TX)
    } catch {
      service = await this.server.getPrimaryService(EMLID_SERVICE)
      this.rxCharacteristic = await service.getCharacteristic(EMLID_CHAR_POSITION)
      this.txCharacteristic = await service.getCharacteristic(EMLID_CHAR_CORRECTIONS)
    }

    // Subscribe to NMEA notifications
    await this.rxCharacteristic.startNotifications()
    this.rxCharacteristic.addEventListener('characteristicvaluechanged', (event: any) => {
      this.handleNmeaData(event.target.value)
    })

    this.connected = true
    this.state.connected = true
    this.state.deviceName = this.device.name || 'Unknown GNSS'
    this.notifyStateChange()
  }

  async disconnect(): Promise<void> {
    if (this.device && this.device.gatt.connected) {
      try { await this.rxCharacteristic?.stopNotifications() } catch {}
      this.device.gatt.disconnect()
    }
    this.connected = false
    this.state.connected = false
    this.state.receivingData = false
    this.notifyStateChange()
  }

  /**
   * Send RTCM3 correction data to the rover.
   * Called repeatedly by the NTRIP client (which receives corrections
   * from the caster and forwards them to the rover via BLE).
   *
   * @param rtcmData Raw RTCM3 bytes (from NTRIP caster)
   */
  async sendCorrections(rtcmData: Uint8Array): Promise<void> {
    if (!this.connected || !this.txCharacteristic) return

    // BLE has a max MTU of ~512 bytes. RTCM3 messages are typically
    // 100-500 bytes, but some (like MSM7) can be larger.
    // Split into chunks if needed.
    const MAX_CHUNK = 180 // safe BLE chunk size

    for (let offset = 0; offset < rtcmData.length; offset += MAX_CHUNK) {
      const chunk = rtcmData.slice(offset, offset + MAX_CHUNK)
      await this.txCharacteristic.writeValueWithoutResponse(chunk)
    }

    this.state.correctionsSent++
    // Throttle state updates (don't call on every correction)
    if (this.state.correctionsSent % 10 === 0) {
      this.notifyStateChange()
    }
  }

  isConnected(): boolean { return this.connected }
  getState(): GNSSConnectionState { return { ...this.state } }

  // ─── Private: handle incoming NMEA data ───

  private handleNmeaData(dataView: DataView) {
    const text = this.decoder.decode(dataView)
    this.nmeaBuffer += text

    // NMEA sentences end with \r\n
    const lines = this.nmeaBuffer.split(/\r\n|\n/)
    this.nmeaBuffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('$')) {
        const pos = parseNMEAPosition(line)
        if (pos) {
          this.state.positionsReceived++
          this.state.receivingData = true
          this.state.lastPosition = pos
          this.onPosition?.(pos)
          if (this.state.positionsReceived % 5 === 0) {
            this.notifyStateChange()
          }
        }
      }
    }
  }

  private notifyStateChange() {
    this.onStateChange?.({ ...this.state })
  }
}

// ─── NMEA Parser ────────────────────────────────────────────────────────────

/**
 * Parse an NMEA sentence into a GNSS position.
 * Supports: GGA, RMC, GNS sentences.
 */
export function parseNMEAPosition(sentence: string): GNSSPosition | null {
  if (!sentence.startsWith('$')) return null

  const parts = sentence.substring(1).split('*')[0].split(',')

  if (parts[0] === 'GPGGA' || parts[0] === 'GNGGA') {
    return parseGGA(parts)
  }

  return null
}

function parseGGA(parts: string[]): GNSSPosition | null {
  try {
    // $GPGGA,hhmmss.ss,llll.ll,a,yyyyy.yy,a,x,xx,x.x,x.x,M,x.x,M,x.x,xxxx*hh
    // parts[1] = UTC time
    // parts[2,3] = latitude + N/S
    // parts[4,5] = longitude + E/W
    // parts[6] = fix quality
    // parts[7] = satellites
    // parts[8] = HDOP
    // parts[9,10] = elevation + unit
    // parts[11,12] = geoid separation + unit

    if (parts.length < 10) return null

    const lat = parseNMEACoordinate(parts[2], parts[3])
    const lon = parseNMEACoordinate(parts[4], parts[5])
    if (lat == null || lon == null) return null

    const fixQuality = parseInt(parts[6], 10) || 0
    const satellites = parseInt(parts[7], 10) || 0
    const hdop = parseFloat(parts[8]) || 0
    const elevation = parseFloat(parts[9]) || 0

    // Accuracy estimate from HDOP
    // Typical GPS: ~3m * HDOP
    const accuracy = hdop * 3.0

    const fixLabels: Record<number, string> = {
      0: 'No Fix',
      1: 'GPS',
      2: 'DGPS',
      3: 'PPS',
      4: 'RTK Fixed',
      5: 'RTK Float',
      6: 'Dead Reckoning',
      7: 'Manual',
      8: 'Simulation',
    }

    return {
      latitude: lat,
      longitude: lon,
      elevation,
      accuracy,
      fixQuality,
      fixLabel: fixLabels[fixQuality] || 'Unknown',
      satellites,
      hdop,
      timestamp: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/**
 * Parse NMEA coordinate format (ddmm.mmmm + hemisphere).
 * Returns decimal degrees.
 */
function parseNMEACoordinate(value: string, hemi: string): number | null {
  if (!value || !hemi) return null

  const num = parseFloat(value)
  if (isNaN(num)) return null

  // Latitude: ddmm.mmmm (2 digits degrees)
  // Longitude: dddmm.mmmm (3 digits degrees)
  const isLat = hemi === 'N' || hemi === 'S'
  const degDigits = isLat ? 2 : 3

  const deg = Math.floor(num / Math.pow(10, degDigits))
  const min = num - deg * Math.pow(10, degDigits)
  const decimal = deg + min / 60

  return hemi === 'S' || hemi === 'W' ? -decimal : decimal
}
