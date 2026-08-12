'use client';

/**
 * GNSSConnectionPanel — Upgraded
 * ═══════════════════════════════════
 * Reactive GNSS receiver connection UI powered by the new
 * instrumentStore. Features:
 *
 * - Auto-detects platform (Capacitor native vs Web Bluetooth)
 * - Multi-device scan results with RSSI signal strength bars
 * - Auto-reconnect with exponential backoff (up to 5 attempts)
 * - Live signal quality indicators (satellites, HDOP, fix type)
 * - Coordinate system display (WGS84 → UTM/Kenya grid)
 * - Reconnection state persistence across component unmounts
 * - Integrates with instrumentStore for cross-component access
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bluetooth, BluetoothOff, BluetoothSearching, Loader2, MapPin,
  AlertTriangle, CheckCircle, Signal, RefreshCw, Wifi, WifiOff,
  ChevronDown, ChevronUp, Crosshair, Satellite,
} from 'lucide-react';
import { WebBluetoothGNSS } from '@/lib/gnss/bluetooth';
import { CapacitorBLEGNSS, type CapacitorGNSSDevice } from '@/lib/gnss/capacitor-ble';
import { parseNMEA, type NMEAPosition } from '@/lib/gnss/nmea-parser';
import { wgs84ToUTM, wgs84ToKenya } from '@/lib/gnss/coordinates';
import {
  useInstrumentStore,
  selectIsConnected,
  selectIsStreaming,
  selectCanReconnect,
  type InstrumentDevice,
  type StreamedPoint,
  type ConnectionTransport,
} from '@/stores/instrumentStore';
import { Capacitor } from '@capacitor/core';

// ─── Types ──────────────────────────────────────────────────────

interface ScannedDevice {
  id: string;
  name: string;
  kind: 'gnss' | 'total-station' | 'unknown';
  rssi?: number;
  source: 'web-bluetooth' | 'capacitor-ble';
}

type FixQualityLabel = 'No Fix' | 'GPS' | 'DGPS' | 'PPS' | 'RTK Fixed' | 'RTK Float';

function fixQualityLabel(fixType: NMEAPosition['fixType']): FixQualityLabel {
  switch (fixType) {
    case 'none': return 'No Fix';
    case 'gps': return 'GPS';
    case 'dgps': return 'DGPS';
    case 'pps': return 'PPS';
    case 'rtk': return 'RTK Fixed';
    case 'float': return 'RTK Float';
    default: return 'No Fix';
  }
}

function fixQualityColor(fixType: NMEAPosition['fixType']): string {
  switch (fixType) {
    case 'rtk': return 'text-green-400';
    case 'float': return 'text-lime-400';
    case 'dgps': return 'text-blue-400';
    case 'gps': return 'text-yellow-400';
    case 'pps': return 'text-cyan-400';
    default: return 'text-red-400';
  }
}

function rssiToBars(rssi?: number): number {
  if (rssi === undefined) return 0;
  if (rssi >= -50) return 4;
  if (rssi >= -65) return 3;
  if (rssi >= -80) return 2;
  if (rssi >= -95) return 1;
  return 0;
}

function rssiColor(rssi?: number): string {
  const bars = rssiToBars(rssi);
  if (bars >= 3) return 'text-green-400';
  if (bars >= 2) return 'text-yellow-400';
  if (bars >= 1) return 'text-orange-400';
  return 'text-red-400';
}

// ─── Component ──────────────────────────────────────────────────

interface GNSSConnectionPanelProps {
  onPosition?: (position: NMEAPosition) => void;
  onConnect?: (device: InstrumentDevice) => void;
  onDisconnect?: () => void;
  /** Show coordinate system conversion (UTM / Kenya Grid) */
  showCoordinateSystem?: boolean;
  /** Enable auto-reconnect on unexpected disconnect */
  autoReconnect?: boolean;
  className?: string;
}

export function GNSSConnectionPanel({
  onPosition,
  onConnect,
  onDisconnect,
  showCoordinateSystem = true,
  autoReconnect = true,
  className = '',
}: GNSSConnectionPanelProps) {
  // Zustand store
  const store = useInstrumentStore();
  const isConnected = useInstrumentStore(selectIsConnected);
  const isStreaming = useInstrumentStore(selectIsStreaming);
  const canReconnect = useInstrumentStore(selectCanReconnect);

  // Local UI state
  const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const [position, setPosition] = useState<NMEAPosition | null>(null);
  const [utmCoord, setUtmCoord] = useState<{ zone: string; easting: number; northing: number } | null>(null);
  const [kenyaCoord, setKenyaCoord] = useState<{ easting: number; northing: string } | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  // Service refs — survive re-renders without state churn
  const webBluetoothRef = useRef<WebBluetoothGNSS | null>(null);
  const capacitorBLERef = useRef<CapacitorBLEGNSS | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  // ─── Initialize service instances ─────────────────────────
  useEffect(() => {
    if (isNative) {
      capacitorBLERef.current = new CapacitorBLEGNSS();
    } else {
      webBluetoothRef.current = new WebBluetoothGNSS();
    }
    store.setAutoReconnect(autoReconnect);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Auto-reconnect with exponential backoff ─────────────
  const attemptReconnect = useCallback(async () => {
    const { lastDeviceId, metrics } = useInstrumentStore.getState();
    const maxAttempts = useInstrumentStore.getState().maxReconnectAttempts;

    if (!lastDeviceId || metrics.reconnectAttempts >= maxAttempts) {
      setReconnecting(false);
      return;
    }

    store.recordReconnectAttempt();
    const attempt = metrics.reconnectAttempts + 1;
    const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000); // 2s → 4s → 8s → 16s → 30s

    setReconnecting(true);
    store.setError(`Reconnecting (attempt ${attempt}/${maxAttempts})…`);

    await new Promise((r) => setTimeout(r, delay));

    try {
      if (isNative && capacitorBLERef.current) {
        await capacitorBLERef.current.connect(lastDeviceId);
      } else if (webBluetoothRef.current) {
        await webBluetoothRef.current.connect(lastDeviceId);
      }
      store.resetReconnectAttempts();
      store.setConnected(
        { id: lastDeviceId, name: 'Reconnected Device', kind: 'gnss-receiver', transport: isNative ? 'capacitor-ble' : 'web-bluetooth' },
        isNative ? 'capacitor-ble' : 'web-bluetooth'
      );
      setReconnecting(false);
    } catch {
      // Schedule next attempt
      reconnectTimerRef.current = setTimeout(() => attemptReconnect(), 0);
    }
  }, [isNative, store]);

  // ─── Connection change handler ───────────────────────────
  useEffect(() => {
    const service = isNative ? capacitorBLERef.current : webBluetoothRef.current;
    if (!service) return;

    const unsubConn = service.onConnectionChange((connected, err) => {
      if (connected) {
        // Already handled in connect flow
      } else {
        store.setDisconnected();
        onDisconnect?.();

        // Trigger auto-reconnect if enabled
        if (autoReconnect && canReconnect) {
          reconnectTimerRef.current = setTimeout(() => attemptReconnect(), 1000);
        }
      }
    });

    const unsubPos = service.onPosition((pos) => {
      setPosition(pos);
      onPosition?.(pos);

      // Convert to UTM / Kenya Grid
      if (showCoordinateSystem && pos.latitude && pos.longitude) {
        try {
          const utm = wgs84ToUTM(pos.latitude, pos.longitude);
          setUtmCoord({ zone: `${utm.zone}${utm.hemisphere}`, easting: utm.easting, northing: utm.northing });
        } catch { /* UTM conversion failed — out of range */ }

        try {
          const kenya = wgs84ToKenya({ latitude: pos.latitude, longitude: pos.longitude, altitude: pos.altitude });
          setKenyaCoord({ easting: kenya.easting, northing: kenya.northing?.toFixed(3) || '0' });
        } catch { /* Kenya grid conversion failed */ }
      }

      // Push to instrumentStore
      const point: StreamedPoint = {
        id: `gnss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        pointName: `PT${store.points.length + 1}`,
        latitude: pos.latitude,
        longitude: pos.longitude,
        northing: 0,
        easting: 0,
        elevation: pos.altitude,
        timestamp: pos.timestamp,
        source: 'nmea',
        quality: pos.quality,
        satellites: pos.satellites,
        hdop: pos.hdop,
      };
      store.addPoint(point);
    });

    return () => {
      unsubConn();
      unsubPos();
    };
  }, [isNative, autoReconnect, canReconnect, showCoordinateSystem, onPosition, onDisconnect, attemptReconnect, store]);

  // ─── Scan ────────────────────────────────────────────────
  const handleScan = useCallback(async () => {
    setIsScanning(true);
    store.setStatus('scanning');
    store.setError(null);
    setScannedDevices([]);

    try {
      if (isNative && capacitorBLERef.current) {
        const devices = await capacitorBLERef.current.scanForDevices(5000);
        setScannedDevices(
          devices.map((d: CapacitorGNSSDevice) => ({
            id: d.deviceId,
            name: d.name,
            kind: d.type ?? 'unknown',
            rssi: d.rssi,
            source: 'capacitor-ble' as const,
          }))
        );
      } else if (webBluetoothRef.current) {
        const devices = await webBluetoothRef.current.scanForDevices();
        setScannedDevices(
          devices.map((d) => ({
            id: d.id,
            name: d.name,
            kind: (d.type === 'generic' ? 'unknown' : d.type) as ScannedDevice['kind'],
            source: 'web-bluetooth' as const,
          }))
        );
      }

      setShowDeviceList(true);
      store.setStatus('disconnected');
    } catch (err) {
      store.setError((err as Error).message);
    } finally {
      setIsScanning(false);
    }
  }, [isNative, store]);

  // ─── Connect ─────────────────────────────────────────────
  const handleConnect = useCallback(async (deviceId?: string) => {
    const targetId = deviceId || selectedDeviceId;
    if (!targetId) return;

    store.setStatus('connecting');
    store.setError(null);

    try {
      if (isNative && capacitorBLERef.current) {
        await capacitorBLERef.current.connect(targetId);
      } else if (webBluetoothRef.current) {
        await webBluetoothRef.current.connect(targetId);
      }

      const scannedDevice = scannedDevices.find((d) => d.id === targetId);
      const transport: ConnectionTransport = isNative ? 'capacitor-ble' : 'web-bluetooth';
      const device: InstrumentDevice = {
        id: targetId,
        name: scannedDevice?.name || 'Unknown GNSS',
        kind: scannedDevice?.kind === 'total-station' ? 'total-station' : 'gnss-receiver',
        transport,
        rssi: scannedDevice?.rssi,
      };

      store.setConnected(device, transport);
      store.setInstrumentInfo({
        manufacturer: scannedDevice?.name?.split(' ')[0] || 'Unknown',
        protocol: 'nmea',
      });
      onConnect?.(device);
    } catch (err) {
      store.setError((err as Error).message);
    }
  }, [isNative, selectedDeviceId, scannedDevices, onConnect, store]);

  // ─── Disconnect ──────────────────────────────────────────
  const handleDisconnect = useCallback(async () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    try {
      if (isNative && capacitorBLERef.current) {
        await capacitorBLERef.current.disconnect();
      } else if (webBluetoothRef.current) {
        await webBluetoothRef.current.disconnect();
      }
    } catch {
      // Ignore disconnect errors
    }

    store.setDisconnected();
    store.resetReconnectAttempts();
    setReconnecting(false);
    setPosition(null);
    setUtmCoord(null);
    setKenyaCoord(null);
    onDisconnect?.();
  }, [isNative, onDisconnect, store]);

  // ─── Render ──────────────────────────────────────────────

  const statusBadge = () => {
    const cfg: Record<string, { label: string; color: string; icon: typeof Bluetooth }> = {
      disconnected: { label: 'Disconnected', color: 'text-gray-400', icon: BluetoothOff },
      scanning: { label: 'Scanning…', color: 'text-blue-400', icon: BluetoothSearching },
      connecting: { label: 'Connecting…', color: 'text-yellow-400', icon: Loader2 },
      connected: { label: 'Connected', color: 'text-blue-400', icon: Bluetooth },
      streaming: { label: 'Live', color: 'text-green-400', icon: Satellite },
      reconnecting: { label: 'Reconnecting…', color: 'text-orange-400', icon: RefreshCw },
      error: { label: 'Error', color: 'text-red-400', icon: AlertTriangle },
    };
    const { label, color, icon: Icon } = cfg[store.status] || cfg.disconnected;
    return (
      <span className={`flex items-center gap-1.5 text-sm ${color}`}>
        <Icon className={`w-4 h-4 ${store.status === 'scanning' || store.status === 'connecting' || store.status === 'reconnecting' ? 'animate-spin' : ''}`} />
        {label}
      </span>
    );
  };

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Satellite className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">GNSS Receiver</h3>
          {store.device && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              {store.transport === 'capacitor-ble' ? 'BLE' : 'Web BT'}
            </span>
          )}
        </div>
        {statusBadge()}
      </div>

      {/* Error banner */}
      {store.error && !reconnecting && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{store.error}</span>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* ── Disconnected state: scan & connect ── */}
        {!isConnected && !isStreaming && !reconnecting && (
          <>
            {/* Scan button */}
            {!showDeviceList && (
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Scanning for instruments…
                  </>
                ) : (
                  <>
                    <BluetoothSearching className="w-5 h-5" />
                    Scan for GNSS Receivers
                  </>
                )}
              </button>
            )}

            {/* Device list */}
            {showDeviceList && scannedDevices.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                    Found {scannedDevices.length} device{scannedDevices.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={handleScan}
                    disabled={isScanning}
                    className="text-xs text-blue-600 hover:text-blue-500 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                    Rescan
                  </button>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {scannedDevices.map((device) => (
                    <button
                      key={device.id}
                      onClick={() => setSelectedDeviceId(device.id)}
                      className={[
                        'w-full p-3 rounded-lg text-left transition-all border',
                        selectedDeviceId === device.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Crosshair className={`w-4 h-4 ${device.kind === 'gnss' ? 'text-blue-500' : device.kind === 'total-station' ? 'text-purple-500' : 'text-gray-400'}`} />
                          <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{device.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* RSSI signal bars */}
                          {device.rssi !== undefined && (
                            <div className="flex items-end gap-0.5 h-4" title={`RSSI: ${device.rssi} dBm`}>
                              {[1, 2, 3, 4].map((bar) => (
                                <div
                                  key={bar}
                                  className={`w-1 rounded-sm ${
                                    bar <= rssiToBars(device.rssi)
                                      ? rssiColor(device.rssi)
                                      : 'bg-gray-300 dark:bg-gray-600'
                                  }`}
                                  style={{ height: `${bar * 25}%` }}
                                />
                              ))}
                            </div>
                          )}
                          <span className="text-xs text-gray-400 capitalize">{device.kind.replace('-', ' ')}</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        ID: {device.id.slice(0, 12)}… • {device.source === 'capacitor-ble' ? 'BLE' : 'Bluetooth'}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleConnect()}
                    disabled={!selectedDeviceId}
                    className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-lg font-medium text-sm transition-colors disabled:cursor-not-allowed"
                  >
                    Connect
                  </button>
                  <button
                    onClick={() => { setShowDeviceList(false); setScannedDevices([]); setSelectedDeviceId(null); }}
                    className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* No devices found */}
            {showDeviceList && scannedDevices.length === 0 && (
              <div className="text-center py-4">
                <BluetoothOff className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No instruments found</p>
                <p className="text-xs text-gray-400 mt-1">Make sure Bluetooth is enabled and your instrument is powered on</p>
                <button
                  onClick={handleScan}
                  disabled={isScanning}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-500"
                >
                  Try again
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Reconnecting state ── */}
        {reconnecting && (
          <div className="text-center py-6 space-y-3">
            <RefreshCw className="w-8 h-8 text-orange-500 mx-auto animate-spin" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Reconnecting… (attempt {store.metrics.reconnectAttempts}/{store.maxReconnectAttempts})
            </p>
            <button
              onClick={handleDisconnect}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Cancel reconnection
            </button>
          </div>
        )}

        {/* ── Connected / Streaming state ── */}
        {(isConnected || isStreaming) && !reconnecting && (
          <>
            {/* Device info */}
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-green-800 dark:text-green-300">{store.device?.name}</div>
                  <div className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                    {store.transport === 'capacitor-ble' ? 'BLE (Native)' : 'Web Bluetooth'} • Connected {store.metrics.connectedAt ? formatTimeSince(store.metrics.connectedAt) : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isStreaming && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                  {store.device?.rssi !== undefined && (
                    <div className="flex items-end gap-0.5 h-4 ml-2" title={`RSSI: ${store.device.rssi} dBm`}>
                      {[1, 2, 3, 4].map((bar) => (
                        <div
                          key={bar}
                          className={`w-1.5 rounded-sm ${
                            bar <= rssiToBars(store.device?.rssi ?? 0)
                              ? rssiColor(store.device?.rssi ?? 0)
                              : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                          style={{ height: `${bar * 25}%` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Live position */}
            {position && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-blue-900 dark:text-blue-200">Current Position</span>
                  <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
                    position.fixType === 'rtk' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' :
                    position.fixType === 'float' ? 'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300' :
                    position.fixType === 'dgps' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                  }`}>
                    {fixQualityLabel(position.fixType)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Lat:</span>
                    <span className="font-mono ml-1 text-gray-800 dark:text-gray-200">{position.latitude.toFixed(7)}°</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Lon:</span>
                    <span className="font-mono ml-1 text-gray-800 dark:text-gray-200">{position.longitude.toFixed(7)}°</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Alt:</span>
                    <span className="font-mono ml-1 text-gray-800 dark:text-gray-200">{position.altitude.toFixed(3)}m</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Sats:</span>
                    <span className="font-mono ml-1 text-gray-800 dark:text-gray-200">{position.satellites}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">HDOP:</span>
                    <span className={`font-mono ml-1 ${position.hdop <= 1 ? 'text-green-600' : position.hdop <= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {position.hdop.toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Quality:</span>
                    <span className={`font-mono ml-1 ${fixQualityColor(position.fixType)}`}>
                      {position.quality}
                    </span>
                  </div>
                </div>

                {/* Coordinate system conversions */}
                {showCoordinateSystem && (utmCoord || kenyaCoord) && (
                  <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 space-y-2">
                    {utmCoord && (
                      <div className="text-xs">
                        <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">UTM {utmCoord.zone}</span>
                        <div className="font-mono text-gray-700 dark:text-gray-300 mt-0.5">
                          E {utmCoord.easting.toFixed(3)} N {utmCoord.northing.toFixed(3)}
                        </div>
                      </div>
                    )}
                    {kenyaCoord && (
                      <div className="text-xs">
                        <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">Kenya Grid</span>
                        <div className="font-mono text-gray-700 dark:text-gray-300 mt-0.5">
                          E {kenyaCoord.easting.toFixed(3)} N {kenyaCoord.northing}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-2">
                <div className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400">{store.points.length}</div>
                <div className="text-[10px] text-gray-500 uppercase">Points</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-2">
                <div className="text-lg font-mono font-bold text-green-600 dark:text-green-400">{store.metrics.messagesParsed}</div>
                <div className="text-[10px] text-gray-500 uppercase">Messages</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-2">
                <div className="text-lg font-mono font-bold text-orange-600 dark:text-orange-400">{store.metrics.errorsCount}</div>
                <div className="text-[10px] text-gray-500 uppercase">Errors</div>
              </div>
            </div>

            {/* Disconnect button */}
            <button
              onClick={handleDisconnect}
              className="w-full py-2 px-4 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <BluetoothOff className="w-4 h-4 inline mr-2" />
              Disconnect
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Utilities ──────────────────────────────────────────────────

function formatTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}
