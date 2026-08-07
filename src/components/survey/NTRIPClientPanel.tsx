'use client'

/**
 * NTRIPClientPanel — UI for connecting to NTRIP CORS networks
 *
 * Lets surveyors:
 * - Select a Kenya CORS preset (MUYA, AGL, KENCORS, KPLC)
 * - Or enter custom NTRIP caster details
 * - Connect and receive RTCM3 corrections
 * - Stream corrections to connected GNSS rover via Bluetooth
 * - Send GGA position to caster for VRS
 * - Monitor connection quality
 *
 * Uses existing:
 * - src/lib/gnss/ntrip-client.ts (NTRIPClient class)
 * - src/lib/gnss/bluetooth.ts (WebBluetoothGNSS)
 * - ntrip-proxy.js (WebSocket bridge)
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Radio, Wifi, WifiOff, Loader2, Satellite,
  CheckCircle2, AlertTriangle, Settings2, ChevronDown,
} from 'lucide-react'

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

interface NTRIPConfig {
  host: string
  port: number
  mountpoint: string
  username: string
  password: string
}

const KENYA_PRESETS: Array<{
  id: string
  name: string
  host: string
  port: number
  mountpoint: string
  notes: string
}> = [
  {
    id: 'MUYA',
    name: 'Muya CORS',
    host: 'muya-cors.com',
    port: 2101,
    mountpoint: 'RTCM32_NR_MUYA',
    notes: 'RTCM 3.2 — Measurement Systems Ltd. (subscription required)',
  },
  {
    id: 'AGL',
    name: 'AGL CORS',
    host: 'aglcors.com',
    port: 2101,
    mountpoint: 'RTCM3_AGL',
    notes: 'RTCM 3.x — Africa Geonetwork Ltd. (subscription required)',
  },
  {
    id: 'KENCORS',
    name: 'Kenya CORS (KENCORS)',
    host: 'kencors.go.ke',
    port: 2101,
    mountpoint: 'KENCORS_RTCM3',
    notes: 'Government CORS network — free for licensed surveyors',
  },
  {
    id: 'KPLC',
    name: 'KPLC CORS',
    host: 'kplc.co.ke',
    port: 2101,
    mountpoint: 'RTCM3_KPLC',
    notes: 'Kenya Power network — limited access',
  },
  {
    id: 'CUSTOM',
    name: 'Custom Caster',
    host: '',
    port: 2101,
    mountpoint: '',
    notes: 'Enter your own NTRIP caster details',
  },
]

export function NTRIPClientPanel() {
  const [selectedPreset, setSelectedPreset] = useState('KENCORS')
  const [config, setConfig] = useState<NTRIPConfig>({
    host: 'kencors.go.ke',
    port: 2101,
    mountpoint: 'KENCORS_RTCM3',
    username: '',
    password: '',
  })
  const [state, setState] = useState<ConnectionState>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [rtcmMessages, setRtcmMessages] = useState(0)
  const [lastGgaSent, setLastGgaSent] = useState<Date | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const ntripClientRef = useRef<import('@/lib/gnss/ntrip-client').NTRIPClient | null>(null)

  // Update config when preset changes
  const handlePresetChange = useCallback((presetId: string) => {
    setSelectedPreset(presetId)
    const preset = KENYA_PRESETS.find(p => p.id === presetId)
    if (preset && presetId !== 'CUSTOM') {
      setConfig(prev => ({
        ...prev,
        host: preset.host,
        port: preset.port,
        mountpoint: preset.mountpoint,
      }))
    }
  }, [])

  const handleConnect = useCallback(async () => {
    setState('connecting')
    setError(null)
    setRtcmMessages(0)

    try {
      // Dynamic import to avoid SSR issues
      const { NTRIPClient } = await import('@/lib/gnss/ntrip-client')

      const client = new NTRIPClient({
        host: config.host,
        port: config.port,
        mountpoint: config.mountpoint,
        username: config.username || undefined,
        password: config.password || undefined,
        version: 2,
      } as any)

      client.onCorrection((data: Uint8Array) => {
        setRtcmMessages(prev => prev + 1)
      })

      client.onStatus((status: string) => {
        if (status === 'connected') setState('connected')
        if (status === 'error') setState('error')
        if (status === 'disconnected') setState('disconnected')
      })

      await client.connect()
      ntripClientRef.current = client
      setState('connected')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
      setState('error')
    }
  }, [config])

  const handleDisconnect = useCallback(() => {
    if (ntripClientRef.current) {
      ntripClientRef.current.disconnect()
      ntripClientRef.current = null
    }
    setState('disconnected')
    setRtcmMessages(0)
  }, [])

  // Send GGA position to caster (for VRS)
  const sendGGA = useCallback(async (lat: number, lng: number) => {
    if (!ntripClientRef.current || state !== 'connected') return

    // Format NMEA GGA sentence
    const now = new Date()
    const hh = now.getUTCHours().toString().padStart(2, '0')
    const mm = now.getUTCMinutes().toString().padStart(2, '0')
    const ss = now.getUTCSeconds().toString().padStart(2, '0')

    const latDeg = Math.floor(Math.abs(lat))
    const latMin = (Math.abs(lat) - latDeg) * 60
    const latDir = lat >= 0 ? 'N' : 'S'
    const lngDeg = Math.floor(Math.abs(lng))
    const lngMin = (Math.abs(lng) - lngDeg) * 60
    const lngDir = lng >= 0 ? 'E' : 'W'

    const gga = `GPGGA,${hh}${mm}${ss},${latDeg.toString().padStart(2, '0')}${latMin.toFixed(4)},${latDir},${lngDeg.toString().padStart(3, '0')}${lngMin.toFixed(4)},${lngDir},1,08,1.0,0,M,0,M,,*`

    // Calculate checksum
    let checksum = 0
    for (let i = 0; i < gga.length; i++) {
      checksum ^= gga.charCodeAt(i)
    }

    const sentence = `$${gga}${checksum.toString(16).toUpperCase().padStart(2, '0')}`

    try {
      ntripClientRef.current.sendGGA(sentence)
      setLastGgaSent(new Date())
    } catch (err) {
      // Silent fail
    }
  }, [state])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ntripClientRef.current) {
        ntripClientRef.current.disconnect()
      }
    }
  }, [])

  const selectedPresetData = KENYA_PRESETS.find(p => p.id === selectedPreset)
  const isConnected = state === 'connected'
  const isConnecting = state === 'connecting'

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isConnected ? 'bg-emerald-500/10' : 'bg-[var(--bg-tertiary)]'
          }`}>
            <Radio className={`w-4 h-4 ${isConnected ? 'text-emerald-400' : 'text-gray-400'}`} />
          </div>
          <div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">NTRIP Corrections</span>
            <p className="text-[10px] text-gray-500">RTK correction stream from CORS network</p>
          </div>
        </div>
        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          {isConnecting && <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />}
          {isConnected && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
          <span className={`text-[10px] font-medium ${
            isConnected ? 'text-emerald-400' :
            isConnecting ? 'text-amber-400' :
            state === 'error' ? 'text-red-400' : 'text-gray-500'
          }`}>
            {isConnected ? 'Streaming' : isConnecting ? 'Connecting...' : state === 'error' ? 'Error' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Preset selector */}
        <div>
          <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1.5" htmlFor="cors-network">CORS Network</label>
          <select id="cors-network"
            value={selectedPreset}
            onChange={e => handlePresetChange(e.target.value)}
            disabled={isConnected}
            className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] disabled:opacity-50"
          >
            {KENYA_PRESETS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {selectedPresetData && (
            <p className="text-[9px] text-gray-600 mt-1">{selectedPresetData.notes}</p>
          )}
        </div>

        {/* Advanced settings */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300"
        >
          <Settings2 className="w-3 h-3" />
          Advanced Settings
          <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {showAdvanced && (
          <div className="space-y-2 p-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-color)]">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] text-gray-500 uppercase mb-0.5" htmlFor="host">Host</label>
                <input id="host" aria-label="Host"
                  type="text"
                  value={config.host}
                  onChange={e => setConfig(prev => ({ ...prev, host: e.target.value }))}
                  disabled={isConnected}
                  className="w-full h-7 px-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[10px] text-white font-mono disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[8px] text-gray-500 uppercase mb-0.5" htmlFor="port">Port</label>
                <input id="port" aria-label="Port"
                  type="number"
                  value={config.port}
                  onChange={e => setConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 2101 }))}
                  disabled={isConnected}
                  className="w-full h-7 px-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[10px] text-white font-mono disabled:opacity-50"
                />
              </div>
            </div>
            <div>
              <label className="block text-[8px] text-gray-500 uppercase mb-0.5" htmlFor="mountpoint">Mountpoint</label>
              <input id="mountpoint" aria-label="Mountpoint"
                type="text"
                value={config.mountpoint}
                onChange={e => setConfig(prev => ({ ...prev, mountpoint: e.target.value }))}
                disabled={isConnected}
                className="w-full h-7 px-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[10px] text-white font-mono disabled:opacity-50"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] text-gray-500 uppercase mb-0.5" htmlFor="username">Username</label>
                <input id="username" aria-label="Username"
                  type="text"
                  value={config.username}
                  onChange={e => setConfig(prev => ({ ...prev, username: e.target.value }))}
                  disabled={isConnected}
                  className="w-full h-7 px-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[10px] text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[8px] text-gray-500 uppercase mb-0.5" htmlFor="password">Password</label>
                <input  id="password" aria-label="Password"
                  type="password"
                  value={config.password}
                  onChange={e => setConfig(prev => ({ ...prev, password: e.target.value }))}
                  disabled={isConnected}
                  className="w-full h-7 px-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[10px] text-white disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/5 border border-red-500/20">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-400">{error}</p>
          </div>
        )}

        {/* Connection stats */}
        {isConnected && (
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50">
              <span className="text-[9px] text-gray-500 uppercase tracking-wider">RTCM Messages</span>
              <div className="text-sm font-mono text-emerald-400">{rtcmMessages}</div>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50">
              <span className="text-[9px] text-gray-500 uppercase tracking-wider">Last GGA Sent</span>
              <div className="text-sm font-mono text-gray-300">
                {lastGgaSent ? lastGgaSent.toLocaleTimeString() : '—'}
              </div>
            </div>
          </div>
        )}

        {/* Connect/Disconnect button */}
        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={isConnecting || !config.host || !config.mountpoint}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:bg-[var(--accent-dim)] disabled:opacity-50"
          >
            {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            {isConnecting ? 'Connecting...' : 'Connect to CORS'}
          </button>
        ) : (
          <button
            onClick={handleDisconnect}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/30"
          >
            <WifiOff className="w-4 h-4" />
            Disconnect
          </button>
        )}

        {/* Info */}
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
          <Satellite className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-blue-400/70 leading-relaxed">
            NTRIP streams RTCM3 corrections from CORS stations to your rover via Bluetooth.
            VRS mode sends your position to the caster for a virtual reference station.
            Requires an active CORS subscription (except KENCORS for licensed surveyors).
          </p>
        </div>
      </div>
    </div>
  )
}
