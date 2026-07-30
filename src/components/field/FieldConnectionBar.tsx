'use client';

/**
 * FieldConnectionBar — top bar showing instrument connection status
 *
 * Shows:
 *   - Connection status (disconnected/connecting/connected/streaming)
 *   - Instrument type (total station / GNSS rover)
 *   - Battery/signal strength (if available)
 *   - Fix quality (for GNSS: fixed/float/dgps/single)
 *   - Online/offline sync indicator
 *
 * Designed for field use: large text, high contrast, sunlight-readable.
 */

import { memo } from 'react'
import { Wifi, WifiOff, Bluetooth, Usb, Satellite, Battery, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { useInstrumentStore } from '@/stores/instrumentStore'

interface FieldConnectionBarProps {
  isOnline: boolean
  isSyncing: boolean
  pendingSyncCount: number
  onSyncClick?: () => void
}

export const FieldConnectionBar = memo(function FieldConnectionBar({
  isOnline,
  isSyncing,
  pendingSyncCount,
  onSyncClick,
}: FieldConnectionBarProps) {
  const { status, transport, device, instrumentInfo, latestPoint } = useInstrumentStore()

  const isConnected = status === 'connected' || status === 'streaming'
  const isStreaming = status === 'streaming'

  // Status colors
  const statusColor = !isConnected
    ? 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/30'
    : isStreaming
      ? 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30'
      : 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/30'

  const TransportIcon = transport === 'web-bluetooth' ? Bluetooth : transport === 'web-serial' ? Usb : Satellite

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
      {/* Connection Status */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${statusColor}`}>
        {status === 'connecting' || status === 'reconnecting' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isConnected ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <AlertCircle className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">
          {!isConnected ? 'Disconnected' : isStreaming ? 'Streaming' : 'Connected'}
        </span>
      </div>

      {/* Transport + Device */}
      {isConnected && (
        <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
          <TransportIcon className="w-4 h-4 text-[var(--accent)]" />
          <span>{device?.name || instrumentInfo?.model || 'Instrument'}</span>
        </div>
      )}

      {/* GNSS Fix Quality */}
      {isConnected && latestPoint?.source === 'nmea' && (
        <div className="flex items-center gap-2 text-sm">
          <span className={`px-2 py-0.5 rounded font-mono text-xs ${
            (latestPoint.quality ?? 0) >= 4
              ? 'bg-[var(--success)]/20 text-[var(--success)]'
              : (latestPoint.quality ?? 0) >= 2
                ? 'bg-[var(--warning)]/20 text-[var(--warning)]'
                : 'bg-[var(--error)]/20 text-[var(--error)]'
          }`}>
            {(latestPoint.quality ?? 0) >= 4 ? 'FIXED' : (latestPoint.quality ?? 0) >= 2 ? 'FLOAT' : 'NO FIX'}
          </span>
          {latestPoint.satellites != null && (
            <span className="text-[var(--text-muted)] font-mono text-xs">
              🛰 {latestPoint.satellites}
            </span>
          )}
          {latestPoint.hdop != null && (
            <span className="text-[var(--text-muted)] font-mono text-xs">
              HDOP {latestPoint.hdop.toFixed(1)}
            </span>
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sync Status */}
      <button
        onClick={onSyncClick}
        disabled={!isOnline || isSyncing || pendingSyncCount === 0}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={isOnline ? 'Sync now' : 'Offline — will sync when online'}
      >
        {isSyncing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
        ) : isOnline ? (
          <Wifi className="w-3.5 h-3.5 text-[var(--success)]" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-[var(--error)]" />
        )}
        <span className={isOnline ? 'text-[var(--text-secondary)]' : 'text-[var(--error)]'}>
          {isSyncing ? 'Syncing…' : isOnline ? 'Online' : 'Offline'}
        </span>
        {pendingSyncCount > 0 && (
          <span className="bg-[var(--accent)]/20 text-[var(--accent)] px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold">
            {pendingSyncCount}
          </span>
        )}
      </button>
    </div>
  )
})
