/**
 * METARDU — Instrument Connection Panel
 * =======================================
 * React component providing a UI to connect to surveying instruments
 * via Web Serial API or Bluetooth LE. Includes:
 *
 * - Transport selector (USB Serial / Bluetooth LE)
 * - Instrument preset selector (Leica, Trimble, Topcon, etc.)
 * - Custom baud rate / serial config
 * - Connection status indicator with live stats
 * - Real-time streaming point display
 * - Points table with count
 * - Import streamed points to current project
 *
 * The BLE path uses @capacitor-community/bluetooth-le on native
 * and Web Bluetooth API in the browser, with NUS + Location+NMEA
 * service support for surveying instruments.
 */

'use client'

import { useState, useCallback } from 'react'
import { useInstrumentConnection, type StreamedPoint } from '@/hooks/useInstrumentConnection'
import { INSTRUMENT_PRESETS, BRAND_INFO, type InstrumentBrand } from '@/lib/serial'
import {
  Cable,
  Wifi,
  WifiOff,
  Radio,
  Circle,
  Download,
  Settings,
  Trash2,
  Satellite,
  Crosshair,
  Activity,
  ChevronDown,
  ChevronUp,
  Target,
  RotateCcw,
  Ruler,
  Play,
  Square,
  Bluetooth,
  BluetoothOff,
  Usb,
} from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { WebBluetoothGNSS } from '@/lib/gnss/bluetooth'
import { CapacitorBLEGNSS, type CapacitorGNSSDevice } from '@/lib/gnss/capacitor-ble'
import { useInstrumentStore, type InstrumentDevice, type ConnectionTransport } from '@/stores/instrumentStore'
import type { NMEAPosition } from '@/lib/gnss/nmea-parser'

type TransportMode = 'serial' | 'ble'

interface InstrumentConnectionPanelProps {
  /** Called when user clicks "Import Points" to add streamed points to the project */
  onImportPoints?: (points: StreamedPoint[]) => void
  /** Called when a new point is received in real-time */
  onPointReceived?: (point: StreamedPoint) => void
  /** Default transport mode (auto-detected if not specified) */
  defaultTransport?: TransportMode
  className?: string
}

export function InstrumentConnectionPanel({
  onImportPoints,
  onPointReceived,
  defaultTransport,
  className = '',
}: InstrumentConnectionPanelProps) {
  const {
    connect,
    connectWithPreset,
    disconnect,
    status,
    isStreaming,
    isSupported: isSerialSupported,
    instrumentInfo,
    points,
    lastPoint,
    messagesParsed,
    errorCount,
    clearPoints,
    sendCommand: hookSendCommand,
    error,
  } = useInstrumentConnection()

  // Instrument store for BLE state
  const instrumentStore = useInstrumentStore()

  // Transport mode
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()
  const [transportMode, setTransportMode] = useState<TransportMode>(
    defaultTransport || (isNative ? 'ble' : 'serial')
  )
  const [bleConnecting, setBleConnecting] = useState(false)
  const [bleError, setBleError] = useState<string | null>(null)
  const [bleScannedDevices, setBleScannedDevices] = useState<CapacitorGNSSDevice[]>([])
  const [bleSelectedDevice, setBleSelectedDevice] = useState<string | null>(null)
  const [bleService, setBleService] = useState<CapacitorBLEGNSS | WebBluetoothGNSS | null>(null)

  const isSupported = transportMode === 'ble' ? true : isSerialSupported

  const [showConfig, setShowConfig] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState('generic-gnss')
  const [customBaud, setCustomBaud] = useState('9600')
  const [connecting, setConnecting] = useState(false)
  const [isTracking, setIsTracking] = useState(false)

  // Determine brand from preset key
  const getBrandFromPresetKey = (key: string): InstrumentBrand => {
    if (key.startsWith('leica')) return 'leica'
    if (key.startsWith('topcon')) return 'topcon'
    if (key.startsWith('trimble')) return 'trimble'
    if (key.startsWith('sokkia')) return 'sokkia'
    return 'leica'
  }

  // Send a brand-specific instrument command
  const sendCommand = useCallback(async (commandType: string, ...args: unknown[]) => {
    try {
      await hookSendCommand(commandType, ...args)
    } catch (err) {
      console.error('Command failed:', err)
    }
  }, [hookSendCommand])

  const toggleTracking = useCallback(async () => {
    const commandType = isTracking ? 'stopTracking' : 'startTracking'
    await sendCommand(commandType)
    setIsTracking(!isTracking)
  }, [isTracking, sendCommand])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      await connectWithPreset(selectedPreset)
    } catch {
      // Error is handled by the hook
    } finally {
      setConnecting(false)
    }
  }

  const handleCustomConnect = async () => {
    setConnecting(true)
    try {
      await connect({ baudRate: parseInt(customBaud, 10) || 9600 })
    } catch {
      // Error is handled by the hook
    } finally {
      setConnecting(false)
    }
  }

  const handleImport = () => {
    if (points.length > 0 && onImportPoints) {
      onImportPoints(points)
    }
  }

  // Status color mapping
  const statusColors: Record<string, string> = {
    disconnected: 'text-gray-400',
    connecting: 'text-yellow-400',
    connected: 'text-blue-400',
    streaming: 'text-green-400',
    error: 'text-red-400',
    reconnecting: 'text-orange-400',
  }

  const statusBgColors: Record<string, string> = {
    disconnected: 'bg-gray-500/20 border-gray-600/30',
    connecting: 'bg-yellow-500/10 border-yellow-500/30',
    connected: 'bg-blue-500/10 border-blue-500/30',
    streaming: 'bg-green-500/10 border-green-500/30',
    error: 'bg-red-500/10 border-red-500/30',
    reconnecting: 'bg-orange-500/10 border-orange-500/30',
  }

  // ─── BLE connection handlers ──────────────────────────
  const handleBleScan = useCallback(async () => {
    setBleError(null)
    try {
      let service: CapacitorBLEGNSS | WebBluetoothGNSS
      if (isNative) {
        const ble = new CapacitorBLEGNSS()
        await ble.initialize()
        service = ble
      } else {
        service = new WebBluetoothGNSS()
      }
      setBleService(service)

      if (isNative && service instanceof CapacitorBLEGNSS) {
        const devices = await service.scanForDevices(5000)
        setBleScannedDevices(devices)
      } else if (service instanceof WebBluetoothGNSS) {
        const devices = await service.scanForDevices()
        setBleScannedDevices(
          devices.map((d) => ({
            deviceId: d.id,
            name: d.name,
            type: d.type === 'generic' ? 'unknown' as const : undefined,
          }))
        )
      }
    } catch (err) {
      setBleError((err as Error).message)
    }
  }, [isNative])

  const handleBleConnect = useCallback(async () => {
    if (!bleService || !bleSelectedDevice) return
    setBleConnecting(true)
    setBleError(null)
    try {
      // Set up position + connection callbacks before connecting
      bleService.onPosition((pos: NMEAPosition) => {
        instrumentStore.addPoint({
          id: `ble-${Date.now()}`,
          pointName: `PT${instrumentStore.points.length + 1}`,
          latitude: pos.latitude,
          longitude: pos.longitude,
          northing: 0,
          easting: 0,
          elevation: pos.altitude,
          timestamp: pos.timestamp,
          source: pos.quality >= 4 ? 'nmea' : 'nmea',
          quality: pos.quality,
          satellites: pos.satellites,
          hdop: pos.hdop,
        })
      })

      bleService.onConnectionChange((connected, err) => {
        if (connected) {
          const transport: ConnectionTransport = isNative ? 'capacitor-ble' : 'web-bluetooth'
          const device: InstrumentDevice = {
            id: bleSelectedDevice,
            name: bleScannedDevices.find(d => d.deviceId === bleSelectedDevice)?.name || 'Unknown',
            kind: 'gnss-receiver',
            transport,
          }
          instrumentStore.setConnected(device, transport)
          instrumentStore.setInstrumentInfo({
            manufacturer: device.name.split(' ')[0],
            protocol: 'nmea',
          })
        } else {
          instrumentStore.setDisconnected()
          if (err) setBleError(err)
        }
      })

      await bleService.connect(bleSelectedDevice)
    } catch (err) {
      setBleError((err as Error).message)
    } finally {
      setBleConnecting(false)
    }
  }, [bleService, bleSelectedDevice, bleScannedDevices, isNative, instrumentStore])

  const handleBleDisconnect = useCallback(async () => {
    if (bleService) {
      try {
        await bleService.disconnect()
      } catch { /* ignore */ }
    }
    instrumentStore.setDisconnected()
    setBleScannedDevices([])
    setBleSelectedDevice(null)
    setBleError(null)
  }, [bleService, instrumentStore])

  if (!isSupported && transportMode === 'serial') {
    return (
      <div className={`rounded-lg border border-yellow-600/30 bg-yellow-900/10 p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <WifiOff className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium text-yellow-300">Browser Not Supported</span>
        </div>
        <p className="text-xs text-yellow-200/70">
          The Web Serial API requires Google Chrome or Microsoft Edge.
          Switch to Bluetooth LE mode or use a supported browser.
        </p>
        <button
          onClick={() => setTransportMode('ble')}
          className="mt-2 text-xs text-blue-400 hover:text-blue-300"
        >
          Switch to Bluetooth LE →
        </button>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border ${statusBgColors[status] || 'bg-gray-900/50 border-gray-700/50'} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          {transportMode === 'serial' ? (
            <Cable className="w-4 h-4 text-blue-400" />
          ) : (
            <Bluetooth className="w-4 h-4 text-blue-400" />
          )}
          <span className="text-sm font-medium">Instrument Connection</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Transport toggle */}
          <div className="flex bg-black/20 rounded-md p-0.5">
            <button
              onClick={() => setTransportMode('serial')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
                transportMode === 'serial'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              title="USB Serial"
            >
              <Usb className="w-3 h-3" />
              Serial
            </button>
            <button
              onClick={() => setTransportMode('ble')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
                transportMode === 'ble'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              title="Bluetooth LE"
            >
              <Bluetooth className="w-3 h-3" />
              BLE
            </button>
          </div>
          <Circle
            className={`w-2 h-2 ${isStreaming ? 'fill-green-400 text-green-400 animate-pulse' : statusColors[status]}`}
          />
          <span className={`text-xs capitalize ${statusColors[status]}`}>
            {status === 'streaming' ? 'Live' : status}
          </span>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* BLE Error */}
        {bleError && transportMode === 'ble' && (
          <p className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">
            {bleError}
          </p>
        )}

        {/* ── BLE Mode ── */}
        {transportMode === 'ble' && status === 'disconnected' && (
          <>
            {!bleSelectedDevice && bleScannedDevices.length === 0 && (
              <button
                onClick={handleBleScan}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md px-4 py-2.5 transition-colors"
              >
                <Bluetooth className="w-3 h-3" />
                Scan for BLE Instruments
              </button>
            )}

            {bleScannedDevices.length > 0 && !bleSelectedDevice && (
              <div className="space-y-1.5">
                <div className="text-[9px] text-gray-400 uppercase tracking-wider">
                  Found {bleScannedDevices.length} device{bleScannedDevices.length !== 1 ? 's' : ''}
                </div>
                {bleScannedDevices.map((device) => (
                  <button
                    key={device.deviceId}
                    onClick={() => setBleSelectedDevice(device.deviceId)}
                    className="w-full p-2 text-left bg-black/20 border border-white/5 rounded-md hover:border-blue-500/30 transition-colors"
                  >
                    <div className="text-xs font-medium">{device.name}</div>
                    <div className="text-[9px] text-gray-400">
                      {device.deviceId.slice(0, 12)}… • {device.type || 'unknown'} • RSSI: {device.rssi ?? '—'}
                    </div>
                  </button>
                ))}
                <button
                  onClick={handleBleScan}
                  className="text-[9px] text-blue-400 hover:text-blue-300"
                >
                  Rescan
                </button>
              </div>
            )}

            {bleSelectedDevice && (
              <div className="space-y-2">
                <div className="p-2 bg-black/20 rounded-md">
                  <div className="text-xs font-medium">
                    {bleScannedDevices.find(d => d.deviceId === bleSelectedDevice)?.name || 'Unknown'}
                  </div>
                  <div className="text-[9px] text-gray-400">{bleSelectedDevice.slice(0, 16)}…</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleBleConnect}
                    disabled={bleConnecting}
                    className="flex-1 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-500 disabled:bg-green-600/50 text-white text-xs font-medium rounded-md px-3 py-2 transition-colors"
                  >
                    {bleConnecting ? (
                      <><Activity className="w-3 h-3 animate-spin" /> Connecting…</>
                    ) : (
                      <><Bluetooth className="w-3 h-3" /> Connect</>
                    )}
                  </button>
                  <button
                    onClick={() => setBleSelectedDevice(null)}
                    className="px-3 py-2 text-xs text-gray-400 border border-white/10 rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* BLE Connected State */}
        {transportMode === 'ble' && (status === 'connected' || status === 'streaming') && instrumentStore.device && (
          <>
            <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-md">
              <div className="flex items-center gap-2">
                <Bluetooth className="w-3 h-3 text-green-400" />
                <span className="text-xs font-medium text-green-300">{instrumentStore.device.name}</span>
                <span className="text-[9px] text-gray-400 ml-auto">BLE</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-black/20 rounded-md p-2 text-center">
                <div className="text-lg font-mono font-bold text-blue-300">{instrumentStore.points.length}</div>
                <div className="text-[9px] text-gray-400 uppercase">Points</div>
              </div>
              <div className="bg-black/20 rounded-md p-2 text-center">
                <div className="text-lg font-mono font-bold text-green-300">{instrumentStore.metrics.messagesParsed}</div>
                <div className="text-[9px] text-gray-400 uppercase">Messages</div>
              </div>
              <div className="bg-black/20 rounded-md p-2 text-center">
                <div className="text-lg font-mono font-bold text-orange-300">{instrumentStore.metrics.errorsCount}</div>
                <div className="text-[9px] text-gray-400 uppercase">Errors</div>
              </div>
            </div>
            {instrumentStore.latestPoint && (
              <div className="bg-black/20 rounded-md p-2 border border-green-500/20">
                <div className="flex items-center gap-1 mb-1">
                  <Crosshair className="w-3 h-3 text-green-400" />
                  <span className="text-xs font-medium text-green-300">Latest Reading</span>
                </div>
                <div className="text-[9px] font-mono text-gray-300">
                  Lat: {instrumentStore.latestPoint.latitude.toFixed(7)} Lon: {instrumentStore.latestPoint.longitude.toFixed(7)}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => handleBleDisconnect()}
                className="flex-1 flex items-center justify-center gap-1 bg-red-900/30 hover:bg-red-900/50 border border-red-700/30 text-red-300 text-xs rounded-md px-3 py-2 transition-colors"
              >
                <BluetoothOff className="w-3 h-3" />
                Disconnect
              </button>
              <button
                onClick={handleImport}
                disabled={instrumentStore.points.length === 0}
                className="flex-1 flex items-center justify-center gap-1 bg-green-900/30 hover:bg-green-900/50 border border-green-700/30 disabled:opacity-40 text-green-300 text-xs rounded-md px-3 py-2 transition-colors"
              >
                <Download className="w-3 h-3" />
                Import ({instrumentStore.points.length})
              </button>
            </div>
          </>
        )}

        {/* ── Serial Mode (existing UI) ── */}
        {transportMode === 'serial' && status === 'disconnected' && (
          <>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">
                Instrument Preset
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-xs focus:outline-none focus:border-blue-500/50"
              >
                {Object.entries(INSTRUMENT_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.name} ({preset.config.baudRate} baud)
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Config Toggle */}
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
            >
              <Settings className="w-3 h-3" />
              Advanced Configuration
              {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showConfig && (
              <div className="space-y-2 p-2 rounded-md bg-black/20 border border-white/5">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Baud Rate</label>
                  <select
                    value={customBaud}
                    onChange={(e) => setCustomBaud(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-xs"
                  >
                    {[4800, 9600, 19200, 38400, 57600, 115200].map(rate => (
                      <option key={rate} value={rate}>{rate}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleCustomConnect}
                  disabled={connecting}
                  className="w-full text-xs text-blue-400 hover:text-blue-300 py-1"
                >
                  Connect with Custom Settings
                </button>
              </div>
            )}

            {/* Connect Button */}
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-xs font-medium rounded-md px-4 py-2.5 transition-colors"
            >
              {connecting ? (
                <>
                  <Activity className="w-3 h-3 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Cable className="w-3 h-3" />
                  Connect Instrument
                </>
              )}
            </button>

            {error && (
              <p className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">
                {error}
              </p>
            )}
          </>
        )}

        {/* Connected / Streaming State — Serial mode only (BLE has its own above) */}
        {transportMode === 'serial' && (status === 'connected' || status === 'streaming') && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-black/20 rounded-md p-2 text-center">
                <div className="text-lg font-mono font-bold text-blue-300">{points.length}</div>
                <div className="text-[9px] text-gray-400 uppercase">Points</div>
              </div>
              <div className="bg-black/20 rounded-md p-2 text-center">
                <div className="text-lg font-mono font-bold text-green-300">{messagesParsed}</div>
                <div className="text-[9px] text-gray-400 uppercase">Messages</div>
              </div>
              <div className="bg-black/20 rounded-md p-2 text-center">
                <div className="text-lg font-mono font-bold text-orange-300">{errorCount}</div>
                <div className="text-[9px] text-gray-400 uppercase">Errors</div>
              </div>
            </div>

            {/* Instrument Info */}
            {instrumentInfo && (
              <div className="flex items-center gap-2 bg-black/20 rounded-md px-3 py-2">
                <Satellite className="w-3 h-3 text-purple-400" />
                <div>
                  <div className="text-xs font-medium">{instrumentInfo.manufacturer}</div>
                  <div className="text-[9px] text-gray-400">
                    Protocol: {instrumentInfo.protocol.toUpperCase()}
                    {instrumentInfo.model && ` / ${instrumentInfo.model}`}
                  </div>
                </div>
              </div>
            )}

            {/* Last Point Preview */}
            {lastPoint && (
              <div className="bg-black/20 rounded-md p-2 border border-green-500/20">
                <div className="flex items-center gap-1 mb-1">
                  <Crosshair className="w-3 h-3 text-green-400" />
                  <span className="text-xs font-medium text-green-300">
                    Latest: {lastPoint.pointName}
                  </span>
                </div>
                {lastPoint.source === 'nmea' ? (
                  <div className="text-[9px] font-mono text-gray-300 space-y-0.5">
                    <div>Lat: {lastPoint.latitude.toFixed(8)}&deg; Lng: {lastPoint.longitude.toFixed(8)}&deg;</div>
                    <div>Elev: {lastPoint.elevation !== null ? `${lastPoint.elevation.toFixed(3)}m` : 'N/A'}</div>
                    <div className="text-gray-400">
                      Quality: {lastPoint.quality} / Satellites: {lastPoint.satellites} / HDOP: {lastPoint.hdop?.toFixed(1)}
                    </div>
                  </div>
                ) : (
                  <div className="text-[9px] font-mono text-gray-300 space-y-0.5">
                    <div>N: {lastPoint.northing.toFixed(4)} E: {lastPoint.easting.toFixed(4)}</div>
                    {lastPoint.elevation !== null && <div>Elev: {lastPoint.elevation.toFixed(4)}m</div>}
                  </div>
                )}
              </div>
            )}

            {/* Instrument Commands */}
            <div className="space-y-1.5">
              <div className="text-[9px] text-gray-400 uppercase tracking-wider">Quick Commands</div>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={() => sendCommand('measureAndRecord')}
                  className="flex flex-col items-center gap-0.5 bg-blue-900/20 hover:bg-blue-900/40 border border-blue-700/20 text-blue-300 rounded-md px-2 py-1.5 text-[9px] transition-colors"
                  title="Measure and Record"
                >
                  <Target className="w-3.5 h-3.5" />
                  Measure
                </button>
                <button
                  onClick={() => sendCommand('getAngles')}
                  className="flex flex-col items-center gap-0.5 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-700/20 text-purple-300 rounded-md px-2 py-1.5 text-[9px] transition-colors"
                  title="Read Angles"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Angles
                </button>
                <button
                  onClick={() => sendCommand('getCoordinate')}
                  className="flex flex-col items-center gap-0.5 bg-green-900/20 hover:bg-green-900/40 border border-green-700/20 text-green-300 rounded-md px-2 py-1.5 text-[9px] transition-colors"
                  title="Get Coordinate"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  Coord
                </button>
                <button
                  onClick={() => toggleTracking()}
                  className={`flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[9px] transition-colors ${
                    isTracking
                      ? 'bg-orange-900/30 border border-orange-500/30 text-orange-300'
                      : 'bg-gray-800/40 border border-gray-600/20 text-gray-300'
                  }`}
                  title={isTracking ? 'Stop Tracking' : 'Start Tracking'}
                >
                  {isTracking ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isTracking ? 'Stop' : 'Track'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => sendCommand('setPrismTarget', 0)}
                  className="bg-gray-800/30 hover:bg-gray-700/40 border border-gray-600/20 text-gray-300 rounded-md px-2 py-1 text-[9px] transition-colors"
                >
                  Prism Target
                </button>
                <button
                  onClick={() => sendCommand('setRLTarget')}
                  className="bg-gray-800/30 hover:bg-gray-700/40 border border-gray-600/20 text-gray-300 rounded-md px-2 py-1 text-[9px] transition-colors"
                >
                  Reflectorless
                </button>
              </div>
              {selectedPreset && (
                <div className="text-[8px] text-gray-500">
                  {BRAND_INFO[getBrandFromPresetKey(selectedPreset)]?.protocol || 'Auto-detect'}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={disconnect}
                className="flex-1 flex items-center justify-center gap-1 bg-red-900/30 hover:bg-red-900/50 border border-red-700/30 text-red-300 text-xs rounded-md px-3 py-2 transition-colors"
              >
                <WifiOff className="w-3 h-3" />
                Disconnect
              </button>
              <button
                onClick={handleImport}
                disabled={points.length === 0}
                className="flex-1 flex items-center justify-center gap-1 bg-green-900/30 hover:bg-green-900/50 border border-green-700/30 disabled:opacity-40 text-green-300 text-xs rounded-md px-3 py-2 transition-colors"
              >
                <Download className="w-3 h-3" />
                Import ({points.length})
              </button>
              <button
                onClick={clearPoints}
                disabled={points.length === 0}
                className="flex items-center justify-center bg-gray-800 hover:bg-gray-700 border border-gray-600/30 disabled:opacity-40 text-gray-300 text-xs rounded-md px-2 py-2 transition-colors"
                title="Clear points"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
