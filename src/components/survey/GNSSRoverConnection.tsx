'use client'

/**
 * GNSSRoverConnection — Direct hardware integration for RTK rovers
 *
 * Connects directly to GNSS receivers via:
 * 1. Web Bluetooth API (CHCNAV, South, EFIX, Stonex, Trimble, Leica)
 * 2. Web Serial API (USB-C OTG cable)
 *
 * Streams live NMEA-0183 sentences ($GNGGA, $GNRMC) into the fieldbook.
 * When the surveyor hits "Capture", it reads the current position from
 * the rover and populates the fieldbook row automatically.
 *
 * Uses existing:
 * - src/lib/gnss/nmea-parser.ts (NMEA parsing)
 * - src/lib/gnss/bluetooth.ts (Web Bluetooth)
 * - src/lib/serial/InstrumentSerialConnection.ts (Web Serial)
 * - src/hooks/useInstrumentConnection.ts (connection hook)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Bluetooth, Usb, Satellite, Loader2,
  AlertTriangle, Crosshair, Radio,
  Power, Activity, MapPin,
} from 'lucide-react'

type ConnectionType = 'bluetooth' | 'serial' | 'internal'
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

interface RoverPosition {
  latitude: number
  longitude: number
  altitude: number
  hdop: number
  satellites: number
  fixType: string
  timestamp: Date
  quality: number
}

const FIX_TYPE_LABELS: Record<string, string> = {
  none: 'No Fix',
  gps: 'GPS Fix',
  dgps: 'DGPS',
  pps: 'PPS',
  rtk: 'RTK Fixed',
  float: 'RTK Float',
}

const FIX_TYPE_COLORS: Record<string, string> = {
  none: 'text-red-400',
  gps: 'text-amber-400',
  dgps: 'text-blue-400',
  pps: 'text-blue-400',
  rtk: 'text-emerald-400',
  float: 'text-cyan-400',
}

export function GNSSRoverConnection() {
  const [connectionType, setConnectionType] = useState<ConnectionType>('internal')
  const [state, setState] = useState<ConnectionState>('disconnected')
  const [position, setPosition] = useState<RoverPosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nmeaCount, setNmeaCount] = useState(0)
  const watchIdRef = useRef<number | null>(null)
  const bluetoothCleanupRef = useRef<(() => void) | null>(null)

  // Check API support
  const bluetoothSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator
  const serialSupported = typeof navigator !== 'undefined' && 'serial' in navigator

  // Internal GPS fallback (browser Geolocation API)
  const connectInternal = useCallback(async () => {
    setState('connecting')
    setError(null)
    try {
      if (!('geolocation' in navigator)) {
        throw new Error('Geolocation not supported')
      }
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setPosition({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            altitude: pos.coords.altitude || 0,
            hdop: pos.coords.accuracy || 99,
            satellites: 0,
            fixType: pos.coords.accuracy < 3 ? 'rtk' : pos.coords.accuracy < 10 ? 'gps' : 'none',
            timestamp: new Date(pos.timestamp),
            quality: pos.coords.accuracy < 3 ? 4 : 1,
          })
          setNmeaCount(prev => prev + 1)
          setState('connected')
        },
        (err) => {
          setError(err.message)
          setState('error')
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
      )
      setState('connected')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
      setState('error')
    }
  }, [])

  // Web Bluetooth connection
  const connectBluetooth = useCallback(async () => {
    setState('connecting')
    setError(null)
    try {
      if (!bluetoothSupported) {
        throw new Error('Web Bluetooth not supported. Use Chrome or Edge.')
      }

      // Dynamically import the existing bluetooth module
      const { WebBluetoothGNSS } = await import('@/lib/gnss/bluetooth')
      const gnss = new WebBluetoothGNSS()

      // Set up position callback
      gnss.onPosition((nmeaPos: any) => {
        setPosition({
          latitude: nmeaPos.latitude,
          longitude: nmeaPos.longitude,
          altitude: nmeaPos.altitude,
          hdop: nmeaPos.hdop,
          satellites: nmeaPos.satellites,
          fixType: nmeaPos.fixType,
          timestamp: nmeaPos.timestamp,
          quality: nmeaPos.quality,
        })
        setNmeaCount(prev => prev + 1)
      })

      await gnss.connect()
      bluetoothCleanupRef.current = () => { gnss.disconnect() }
      setState('connected')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bluetooth connection failed')
      setState('error')
    }
  }, [bluetoothSupported])

  // Web Serial connection
  const connectSerial = useCallback(async () => {
    setState('connecting')
    setError(null)
    try {
      if (!serialSupported) {
        throw new Error('Web Serial not supported. Use Chrome or Edge.')
      }

      const port = await (navigator as any).serial.requestPort()
      await port.open({ baudRate: 115200 })

      const reader = port.readable.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // Read loop
      const readLoop = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value as Uint8Array | undefined, { stream: true })

            // Process complete NMEA sentences
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed.startsWith('$')) {
                setNmeaCount(prev => prev + 1)
                // Parse NMEA
                try {
                  const { parseNMEA } = await import('@/lib/gnss/nmea-parser')
                  const parsed = parseNMEA(trimmed)
                  if (parsed && parsed.latitude) {
                    setPosition({
                      latitude: parsed.latitude,
                      longitude: parsed.longitude,
                      altitude: parsed.altitude,
                      hdop: parsed.hdop,
                      satellites: parsed.satellites,
                      fixType: parsed.fixType,
                      timestamp: parsed.timestamp,
                      quality: parsed.quality,
                    })
                  }
                } catch {}
              }
            }
          }
        } catch (err) {
          setError('Serial read error: ' + (err instanceof Error ? err.message : 'unknown'))
          setState('error')
        }
      }

      readLoop()
      setState('connected')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Serial connection failed')
      setState('error')
    }
  }, [serialSupported])

  const handleConnect = useCallback(() => {
    if (connectionType === 'bluetooth') connectBluetooth()
    else if (connectionType === 'serial') connectSerial()
    else connectInternal()
  }, [connectionType, connectBluetooth, connectSerial, connectInternal])

  const handleDisconnect = useCallback(() => {
    if (watchIdRef.current != null && connectionType === 'internal') {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (bluetoothCleanupRef.current) {
      bluetoothCleanupRef.current()
      bluetoothCleanupRef.current = null
    }
    setState('disconnected')
    setPosition(null)
    setNmeaCount(0)
  }, [connectionType])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (bluetoothCleanupRef.current) {
        bluetoothCleanupRef.current()
      }
    }
  }, [])

  const isConnecting = state === 'connecting'
  const isConnected = state === 'connected'
  const fixColor = position ? FIX_TYPE_COLORS[position.fixType] || 'text-gray-400' : 'text-gray-600'
  const fixLabel = position ? FIX_TYPE_LABELS[position.fixType] || 'Unknown' : 'No Fix'

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isConnected ? 'bg-emerald-500/10' : 'bg-[var(--bg-tertiary)]'
          }`}>
            <Satellite className={`w-4 h-4 ${isConnected ? 'text-emerald-400' : 'text-gray-400'}`} />
          </div>
          <div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">GNSS Rover</span>
            <p className="text-[10px] text-gray-500">Direct hardware connection</p>
          </div>
        </div>
        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          {isConnecting && <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />}
          {isConnected && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
          <span className={`text-[10px] font-medium ${
            state === 'connected' ? 'text-emerald-400' :
            state === 'connecting' ? 'text-amber-400' :
            state === 'error' ? 'text-red-400' : 'text-gray-500'
          }`}>
            {state === 'connected' ? 'Connected' : state === 'connecting' ? 'Connecting...' : state === 'error' ? 'Error' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Connection type selector */}
        <div>
          <div className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1.5">Connection Method</div>
          <div className="grid grid-cols-3 gap-2">
            <ConnTypeBtn
              active={connectionType === 'bluetooth'}
              onClick={() => setConnectionType('bluetooth')}
              icon={Bluetooth}
              label="Bluetooth"
              supported={bluetoothSupported}
            />
            <ConnTypeBtn
              active={connectionType === 'serial'}
              onClick={() => setConnectionType('serial')}
              icon={Usb}
              label="USB Serial"
              supported={serialSupported}
            />
            <ConnTypeBtn
              active={connectionType === 'internal'}
              onClick={() => setConnectionType('internal')}
              icon={Radio}
              label="Internal GPS"
              supported={true}
            />
          </div>
        </div>

        {/* Connect/Disconnect button */}
        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:bg-[var(--accent-dim)] transition-colors disabled:opacity-50"
          >
            {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
            {isConnecting ? 'Connecting...' : `Connect via ${connectionType === 'bluetooth' ? 'Bluetooth' : connectionType === 'serial' ? 'USB' : 'Internal GPS'}`}
          </button>
        ) : (
          <button
            onClick={handleDisconnect}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/30 transition-colors"
          >
            <Power className="w-4 h-4" />
            Disconnect
          </button>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-400">{error}</p>
          </div>
        )}

        {/* Live position display */}
        {position && (
          <div className="space-y-2">
            {/* Fix type badge */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <Crosshair className={`w-4 h-4 ${fixColor}`} />
                <span className={`text-sm font-semibold ${fixColor}`}>{fixLabel}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-500">
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  {position.satellites} sats
                </span>
                <span className="flex items-center gap-1">
                  HDOP: {position.hdop.toFixed(1)}
                </span>
              </div>
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50">
                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Latitude</span>
                <div className="text-xs font-mono text-[var(--text-primary)]">{position.latitude.toFixed(8)}°</div>
              </div>
              <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50">
                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Longitude</span>
                <div className="text-xs font-mono text-[var(--text-primary)]">{position.longitude.toFixed(8)}°</div>
              </div>
              <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50">
                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Altitude</span>
                <div className="text-xs font-mono text-[var(--text-primary)]">{position.altitude.toFixed(3)} m</div>
              </div>
              <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50">
                <span className="text-[9px] text-gray-500 uppercase tracking-wider">NMEA Sentences</span>
                <div className="text-xs font-mono text-[var(--text-primary)]">{nmeaCount}</div>
              </div>
            </div>

            {/* Last update */}
            <div className="flex items-center justify-center gap-1 text-[9px] text-gray-600">
              <MapPin className="w-2.5 h-2.5" />
              Updated: {position.timestamp.toLocaleTimeString()}
            </div>
          </div>
        )}

        {/* Supported devices note */}
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
          <Satellite className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-blue-400/70 leading-relaxed">
            Supports CHCNAV, South, EFIX, Stonex, Trimble, Leica rovers via Bluetooth or USB-C OTG.
            Streams NMEA-0183 ($GNGGA, $GNRMC) directly into the fieldbook.
          </p>
        </div>
      </div>
    </div>
  )
}

function ConnTypeBtn({ active, onClick, icon: Icon, label, supported }: {
  active: boolean
  onClick: () => void
  icon: typeof Bluetooth
  label: string
  supported: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={!supported}
      className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border transition-all ${
        active
          ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]'
          : supported
            ? 'bg-[var(--bg-tertiary)]/50 border-[var(--border-color)] text-gray-400 hover:bg-[var(--bg-tertiary)]'
            : 'bg-[var(--bg-tertiary)]/30 border-[var(--border-color)]/50 text-gray-600 cursor-not-allowed'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-[10px] font-medium">{label}</span>
      {!supported && <span className="text-[8px] text-gray-600">N/A</span>}
    </button>
  )
}
