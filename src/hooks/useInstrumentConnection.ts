/**
 * METARDU — useInstrumentConnection Hook
 * ========================================
 * React hook for managing serial instrument connections.
 * Provides real-time data stream from Total Stations and GNSS receivers.
 *
 * Usage:
 * ```tsx
 * const { connect, disconnect, status, lastPoint, isStreaming } = useInstrumentConnection()
 *
 * // Connect to a Leica TS16
 * await connect({ baudRate: 115200 })
 *
 * // Or use a preset
 * await connectWithPreset('leica-ts16')
 * ```
 */

'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  InstrumentSerialConnection,
  isSerialSupported,
  type ConnectionStatus,
  type SerialConnectionConfig,
  type ParsedInstrumentData,
  type InstrumentInfo,
  type NMEAPosition,
} from '@/lib/serial'

export interface StreamedPoint {
  id: string
  pointName: string
  latitude: number
  longitude: number
  northing: number
  easting: number
  elevation: number | null
  timestamp: Date
  source: 'nmea' | 'gsi'
  quality?: number     // Fix quality (NMEA)
  satellites?: number  // Number of satellites (NMEA)
  hdop?: number        // Horizontal dilution of precision
  raw: any
}

export interface UseInstrumentConnectionReturn {
  /** Connect to an instrument (triggers port selection dialog) */
  connect: (config?: Partial<SerialConnectionConfig>) => Promise<void>
  /** Connect using a named preset */
  connectWithPreset: (presetKey: string) => Promise<void>
  /** Disconnect from instrument */
  disconnect: () => Promise<void>
  /** Current connection status */
  status: ConnectionStatus
  /** Whether data is actively streaming */
  isStreaming: boolean
  /** Whether the Web Serial API is available */
  isSupported: boolean
  /** Instrument info (detected manufacturer, protocol) */
  instrumentInfo: InstrumentInfo | null
  /** All points received during this session */
  points: StreamedPoint[]
  /** Most recently received point */
  lastPoint: StreamedPoint | null
  /** Total bytes received */
  bytesReceived: number
  /** Total messages parsed */
  messagesParsed: number
  /** Total errors */
  errorCount: number
  /** Clear all received points */
  clearPoints: () => void
  /** Send an instrument command */
  sendCommand: (commandType: string, ...args: unknown[]) => Promise<void>
  /** Error message if connection failed */
  error: string | null
}

let pointCounter = 0

export function useInstrumentConnection(): UseInstrumentConnectionReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [isStreaming, setIsStreaming] = useState(false)
  const [instrumentInfo, setInstrumentInfo] = useState<InstrumentInfo | null>(null)
  const [points, setPoints] = useState<StreamedPoint[]>([])
  const [lastPoint, setLastPoint] = useState<StreamedPoint | null>(null)
  const [bytesReceived, setBytesReceived] = useState(0)
  const [messagesParsed, setMessagesParsed] = useState(0)
  const [errorCount, setErrorCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const connectionRef = useRef<InstrumentSerialConnection | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        connectionRef.current.disconnect()
      }
    }
  }, [])

  const connect = useCallback(async (config?: Partial<SerialConnectionConfig>) => {
    setError(null)

    const connection = new InstrumentSerialConnection(config)

    // Wire up event handlers
    connection.onStatus((newStatus) => {
      setStatus(newStatus)
      setIsStreaming(newStatus === 'streaming')
    })

    connection.onError((err) => {
      setError(err.message)
    })

    connection.onData((data: ParsedInstrumentData) => {
      setMessagesParsed(prev => prev + 1)

      let point: StreamedPoint | null = null

      if (data.type === 'nmea') {
        const nmea = data.data as NMEAPosition
        if (nmea.latitude && nmea.longitude) {
          point = {
            id: `stream-${Date.now()}-${pointCounter++}`,
            pointName: `GNSS-${pointCounter}`,
            latitude: nmea.latitude,
            longitude: nmea.longitude,
            northing: 0,
            easting: 0,
            elevation: nmea.altitude || null,
            timestamp: nmea.timestamp || new Date(),
            source: 'nmea',
            quality: nmea.fixQuality,
            satellites: nmea.satellites,
            hdop: nmea.hdop,
            raw: nmea,
          }
        }
      } else if (data.type === 'gsi') {
        const gsi = data.data
        if (gsi.easting !== undefined && gsi.northing !== undefined) {
          point = {
            id: `stream-${Date.now()}-${pointCounter++}`,
            pointName: gsi.stationId || `TS-${gsi.pointNumber || pointCounter}`,
            latitude: 0,
            longitude: 0,
            northing: gsi.northing,
            easting: gsi.easting,
            elevation: gsi.height || null,
            timestamp: new Date(),
            source: 'gsi',
            raw: gsi,
          }
        }
      } else if (data.type === 'topcon') {
        const topcon = data.data
        if (topcon.easting !== undefined && topcon.northing !== undefined) {
          point = {
            id: `stream-${Date.now()}-${pointCounter++}`,
            pointName: `TS-${topcon.pointNumber || pointCounter}`,
            latitude: 0,
            longitude: 0,
            northing: topcon.northing,
            easting: topcon.easting,
            elevation: topcon.elevation || null,
            timestamp: new Date(),
            source: 'gsi', // Treat all total stations similarly in UI for now
            raw: topcon,
          }
        }
      } else if (data.type === 'trimble') {
        const trimble = data.data
        if (trimble.easting !== undefined && trimble.northing !== undefined) {
          point = {
            id: `stream-${Date.now()}-${pointCounter++}`,
            pointName: `TS-${trimble.pointNumber || pointCounter}`,
            latitude: 0,
            longitude: 0,
            northing: trimble.northing,
            easting: trimble.easting,
            elevation: trimble.elevation || null,
            timestamp: new Date(),
            source: 'gsi',
            raw: trimble,
          }
        }
      } else if (data.type === 'sokkia') {
        const sokkia = data.data
        if (sokkia.easting !== undefined && sokkia.northing !== undefined) {
          point = {
            id: `stream-${Date.now()}-${pointCounter++}`,
            pointName: `TS-${sokkia.pointNumber || pointCounter}`,
            latitude: 0,
            longitude: 0,
            northing: sokkia.northing,
            easting: sokkia.easting,
            elevation: sokkia.elevation || null,
            timestamp: new Date(),
            source: 'gsi',
            raw: sokkia,
          }
        }
      }

      if (point) {
        setLastPoint(point)
        setPoints(prev => [...prev, point!])
        // Expose the latest reading globally so other components (e.g.
        // the mobile fieldbook's "Pull from instrument" button) can
        // read it without re-instantiating the connection.
        if (typeof window !== 'undefined') {
          ;(window as unknown as { __metarduLastInstrumentReading?: unknown }).__metarduLastInstrumentReading = {
            easting: point.easting,
            northing: point.northing,
            elevation: point.elevation,
            pointName: point.pointName,
            timestamp: point.timestamp.toISOString(),
          }
        }
      }
    })

    connectionRef.current = connection

    try {
      await connection.connect()
      setInstrumentInfo(connection.instrumentInfo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
      throw err
    }
  }, [])

  const connectWithPreset = useCallback(async (presetKey: string) => {
    setError(null)

    const connection = new InstrumentSerialConnection()

    connection.onStatus((newStatus) => {
      setStatus(newStatus)
      setIsStreaming(newStatus === 'streaming')
    })

    connection.onError((err) => {
      setError(err.message)
    })

    connection.onData((data: ParsedInstrumentData) => {
      setMessagesParsed(prev => prev + 1)
      // Same parsing logic as connect()
      let point: StreamedPoint | null = null
      if (data.type === 'nmea') {
        const nmea = data.data as NMEAPosition
        if (nmea.latitude && nmea.longitude) {
          point = {
            id: `stream-${Date.now()}-${pointCounter++}`,
            pointName: `GNSS-${pointCounter}`,
            latitude: nmea.latitude,
            longitude: nmea.longitude,
            northing: 0,
            easting: 0,
            elevation: nmea.altitude || null,
            timestamp: nmea.timestamp || new Date(),
            source: 'nmea',
            quality: nmea.fixQuality,
            satellites: nmea.satellites,
            hdop: nmea.hdop,
            raw: nmea,
          }
        }
      } else if (data.type === 'gsi') {
        const gsi = data.data
        if (gsi.easting !== undefined && gsi.northing !== undefined) {
          point = {
            id: `stream-${Date.now()}-${pointCounter++}`,
            pointName: gsi.stationId || `TS-${gsi.pointNumber || pointCounter}`,
            latitude: 0,
            longitude: 0,
            northing: gsi.northing,
            easting: gsi.easting,
            elevation: gsi.height || null,
            timestamp: new Date(),
            source: 'gsi',
            raw: gsi,
          }
        }
      } else if (data.type === 'topcon') {
        const topcon = data.data
        if (topcon.easting !== undefined && topcon.northing !== undefined) {
          point = {
            id: `stream-${Date.now()}-${pointCounter++}`,
            pointName: `TS-${topcon.pointNumber || pointCounter}`,
            latitude: 0,
            longitude: 0,
            northing: topcon.northing,
            easting: topcon.easting,
            elevation: topcon.elevation || null,
            timestamp: new Date(),
            source: 'gsi', // Treat all total stations similarly in UI for now
            raw: topcon,
          }
        }
      } else if (data.type === 'trimble') {
        const trimble = data.data
        if (trimble.easting !== undefined && trimble.northing !== undefined) {
          point = {
            id: `stream-${Date.now()}-${pointCounter++}`,
            pointName: `TS-${trimble.pointNumber || pointCounter}`,
            latitude: 0,
            longitude: 0,
            northing: trimble.northing,
            easting: trimble.easting,
            elevation: trimble.elevation || null,
            timestamp: new Date(),
            source: 'gsi',
            raw: trimble,
          }
        }
      } else if (data.type === 'sokkia') {
        const sokkia = data.data
        if (sokkia.easting !== undefined && sokkia.northing !== undefined) {
          point = {
            id: `stream-${Date.now()}-${pointCounter++}`,
            pointName: `TS-${sokkia.pointNumber || pointCounter}`,
            latitude: 0,
            longitude: 0,
            northing: sokkia.northing,
            easting: sokkia.easting,
            elevation: sokkia.elevation || null,
            timestamp: new Date(),
            source: 'gsi',
            raw: sokkia,
          }
        }
      }
      if (point) {
        setLastPoint(point)
        setPoints(prev => [...prev, point!])
        if (typeof window !== 'undefined') {
          ;(window as unknown as { __metarduLastInstrumentReading?: unknown }).__metarduLastInstrumentReading = {
            easting: point.easting,
            northing: point.northing,
            elevation: point.elevation,
            pointName: point.pointName,
            timestamp: point.timestamp.toISOString(),
          }
        }
      }
    })

    connectionRef.current = connection

    try {
      await connection.connectWithPreset(presetKey)
      setInstrumentInfo(connection.instrumentInfo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
      throw err
    }
  }, [])

  const disconnect = useCallback(async () => {
    if (connectionRef.current) {
      await connectionRef.current.disconnect()
      connectionRef.current = null
    }
  }, [])

  const clearPoints = useCallback(() => {
    setPoints([])
    setLastPoint(null)
    if (typeof window !== 'undefined') {
      try {
        delete (window as unknown as { __metarduLastInstrumentReading?: unknown }).__metarduLastInstrumentReading
      } catch { /* ignore */ }
    }
  }, [])

  const sendCommand = useCallback(async (commandType: string, ...args: unknown[]) => {
    if (!connectionRef.current) return
    const brand = connectionRef.current.getCurrentBrand()
    if (!brand) return
    try {
      await connectionRef.current.sendInstrumentCommand(brand, commandType, ...args)
    } catch (err) {
      console.error('Failed to send instrument command:', err)
      setError(err instanceof Error ? err.message : 'Command failed')
    }
  }, [])

  return {
    connect,
    connectWithPreset,
    disconnect,
    status,
    isStreaming,
    isSupported: isSerialSupported(),
    instrumentInfo,
    points,
    lastPoint,
    bytesReceived,
    messagesParsed,
    errorCount,
    clearPoints,
    sendCommand,
    error,
  }
}
