'use client';
/**
 * METARDU Layer Control Panel
 *
 * UI panel for managing map layers:
 * - Basemap toggle (OSM / Satellite / Blank)
 * - Custom XYZ orthophoto layer
 * - Kenya Grid overlay with configurable intervals
 * - Opacity control for tile overlays
 * - Active layer list with visibility toggles
 *
 * Follows the SubdivisionPanel collapsible panel pattern.
 * Style: Tailwind CSS, #1B3A5C primary, Calibri font.
 */


import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Layers,
  ChevronDown,
  MapIcon,
  Satellite,
  Square,
  Plus,
  Eye,
  EyeOff,
  Grid3X3,
  Link2,
  Trash2,
  AlertCircle,
  SlidersHorizontal,
} from 'lucide-react';
import {
  createOSMLayer,
  createSatelliteLayer,
  createBlankLayer,
  createCustomXYZLayer,
  createWMSLayer,
} from '@/lib/map/basemaps';
import {
  createGridOverlayLayer,
  updateGridOverlay,
  GRID_LAYER_ID,
  type GridInterval,
} from '@/lib/map/gridOverlay';
import type Map from 'ol/Map';

interface LayerControlProps {
  map: Map | null;
  /** Callback when basemap changes, for external state sync */
  onBasemapChange?: (basemap: 'osm' | 'satellite' | 'blank') => void;
  /** Hide the basemap selector section (when parent already manages basemaps) */
  hideBasemap?: boolean;
  /** Start collapsed (default false) */
  defaultCollapsed?: boolean;
  className?: string;
}

interface CustomLayerEntry {
  id: string;
  label: string;
  url: string;
  type?: 'xyz' | 'wms';
}

const CUSTOM_LAYERS_STORAGE_KEY = 'metardu-custom-layers';

function loadPersistedLayers(): CustomLayerEntry[] {
  try {
    const raw = localStorage.getItem(CUSTOM_LAYERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistLayers(entries: CustomLayerEntry[]) {
  try {
    localStorage.setItem(CUSTOM_LAYERS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage may be full or unavailable
  }
}

type BasemapType = 'osm' | 'satellite' | 'blank';

export function LayerControl({ map, onBasemapChange, hideBasemap = false, defaultCollapsed = false, className = '' }: LayerControlProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [activeBasemap, setActiveBasemap] = useState<BasemapType>('osm');
  const [gridEnabled, setGridEnabled] = useState(false);
  const [gridInterval, setGridInterval] = useState<GridInterval>('auto');
  const [overlayOpacity, setOverlayOpacity] = useState(80);
  const [customLayers, setCustomLayers] = useState<CustomLayerEntry[]>([]);
  const [customUrl, setCustomUrl] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customError, setCustomError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // WMS layer state
  const [wmsUrl, setWmsUrl] = useState('');
  const [wmsLayerName, setWmsLayerName] = useState('');
  const [wmsLabel, setWmsLabel] = useState('');
  const [wmsError, setWmsError] = useState('');
  const [isAddingWms, setIsAddingWms] = useState(false);
  const [tileLayerVisibility, setTileLayerVisibility] = useState<Record<string, boolean>>({});

  // Store cleanup for the async init effect
  const moveendCleanupRef = useRef<(() => void) | null>(null);

  // ─── Initialize basemap layers on map ─────────────────────────────────
  useEffect(() => {
    if (!map || initialized) return;
    const mapInstance = map; // non-null capture for async closure
    let cancelled = false;

    async function init() {
      // Check if layers already exist (from parent map init)
      const existingLayers = mapInstance.getLayers().getArray();
      const hasExistingOSM = existingLayers.some((l: any) => l.get('basemapId') === 'osm');
      const hasExistingSatellite = existingLayers.some((l: any) => l.get('basemapId') === 'satellite');
      const hasExistingBlank = existingLayers.some((l: any) => l.get('basemapId') === 'blank');
      const hasExistingGrid = existingLayers.some((l: any) => l.get('layerId') === GRID_LAYER_ID);

      // Only create basemap layers that don't already exist
      let osmLayer: Awaited<ReturnType<typeof createOSMLayer>> | null = null;
      let satelliteLayer: Awaited<ReturnType<typeof createSatelliteLayer>> | null = null;
      let blankLayer: Awaited<ReturnType<typeof createBlankLayer>> | null = null;

      const layerPromises: Promise<any>[] = [];
      const layerNames: string[] = [];

      if (!hasExistingOSM) { layerPromises.push(createOSMLayer()); layerNames.push('osm'); }
      if (!hasExistingSatellite) { layerPromises.push(createSatelliteLayer()); layerNames.push('satellite'); }
      if (!hasExistingBlank) { layerPromises.push(createBlankLayer()); layerNames.push('blank'); }

      const createdLayers = await Promise.all(layerPromises);
      if (cancelled) return;

      for (let i = 0; i < createdLayers.length; i++) {
        if (layerNames[i] === 'osm') osmLayer = createdLayers[i];
        if (layerNames[i] === 'satellite') satelliteLayer = createdLayers[i];
        if (layerNames[i] === 'blank') blankLayer = createdLayers[i];
      }

      let gridLayer: Awaited<ReturnType<typeof createGridOverlayLayer>> | null = null;
      if (!hasExistingGrid) {
        gridLayer = await createGridOverlayLayer();
      }

      // Insert new basemap layers at the beginning
      const layers = mapInstance.getLayers();
      if (blankLayer) {
        layers.insertAt(0, blankLayer);
        blankLayer.setVisible(false);
      }
      if (satelliteLayer) {
        layers.insertAt(layers.getLength() > 0 ? 1 : 0, satelliteLayer);
        satelliteLayer.setVisible(false);
      }
      if (osmLayer) {
        layers.insertAt(layers.getLength() > 0 ? 2 : 0, osmLayer);
        osmLayer.setVisible(true);
      }

      if (gridLayer) {
        layers.push(gridLayer);
      }

      setInitialized(true);

      // ── Restore persisted custom layers from localStorage ──
      const persisted = loadPersistedLayers();
      if (persisted.length > 0) {
        const restored: CustomLayerEntry[] = [];
        for (const entry of persisted) {
          try {
            let layer: any = null;
            if (entry.type === 'wms') {
              // WMS layers need a layer name which we stored in the url field
              // Format: url|layerName  (we stored it combined)
              const parts = entry.url.split('|');
              if (parts.length >= 2) {
                layer = await createWMSLayer(parts[0], parts[1], entry.label);
              }
            } else {
              layer = await createCustomXYZLayer(entry.url, entry.label);
            }
            if (layer) {
              (layer as any).setOpacity(overlayOpacity / 100);
              mapInstance.addLayer(layer);
              const id = layer.get('basemapId') as string;
              restored.push({ id, label: entry.label, url: entry.url, type: entry.type });
            }
          } catch {
            // Skip layers that fail to restore
          }
        }
        if (restored.length > 0) {
          setCustomLayers(restored);
          const visibilityMap: Record<string, boolean> = {};
          restored.forEach((e) => { visibilityMap[e.id] = true; });
          setTileLayerVisibility((prev) => ({ ...prev, ...visibilityMap }));
        }
      }

      // Update grid on view changes (debounced)
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const onMoveEnd = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          if (gridEnabled) {
            await updateGridOverlay(mapInstance, gridInterval);
          }
        }, 150);
      };
      mapInstance.on('moveend', onMoveEnd);

      // Store cleanup for later use
      moveendCleanupRef.current = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        mapInstance.un('moveend', onMoveEnd);
      };

      // Initial grid update if enabled
      if (gridEnabled) {
        await updateGridOverlay(mapInstance, gridInterval);
      }
    }

    init();

    return () => {
      cancelled = true;
      moveendCleanupRef.current?.();
      moveendCleanupRef.current = null;
    };
  }, [map, initialized, gridEnabled, gridInterval, overlayOpacity]);

  // ─── Sync overlay opacity to layers ───────────────────────────────────
  useEffect(() => {
    if (!map) return;

    const layers = map.getLayers().getArray();
    for (const layer of layers) {
      const basemapId = layer.get('basemapId');
      if (basemapId === 'satellite' || basemapId?.startsWith('custom-')) {
        (layer as any).setOpacity(overlayOpacity / 100);
      }
    }
  }, [map, overlayOpacity]);

  // ─── Switch basemap ───────────────────────────────────────────────────
  const switchBasemap = useCallback(
    (target: BasemapType) => {
      if (!map) return;
      setActiveBasemap(target);
      onBasemapChange?.(target);

      const layers = map.getLayers().getArray();
      for (const layer of layers) {
        const basemapId = layer.get('basemapId');
        if (basemapId === 'osm') {
          layer.setVisible(target === 'osm');
        } else if (basemapId === 'satellite') {
          layer.setVisible(target === 'satellite');
          (layer as any).setOpacity(overlayOpacity / 100);
        } else if (basemapId === 'blank') {
          layer.setVisible(target === 'blank');
        }
      }
    },
    [map, onBasemapChange, overlayOpacity]
  );

  // ─── Toggle grid overlay ──────────────────────────────────────────────
  const toggleGrid = useCallback(async () => {
    if (!map) return;

    const newEnabled = !gridEnabled;
    setGridEnabled(newEnabled);

    const layers = map.getLayers().getArray();
    for (const layer of layers) {
      if (layer.get('layerId') === GRID_LAYER_ID) {
        layer.setVisible(newEnabled);
        if (newEnabled) {
          await updateGridOverlay(map, gridInterval);
        }
        break;
      }
    }
  }, [map, gridEnabled, gridInterval]);

  // ─── Change grid interval ─────────────────────────────────────────────
  const changeGridInterval = useCallback(
    async (newInterval: GridInterval) => {
      setGridInterval(newInterval);
      if (!map || !gridEnabled) return;
      await updateGridOverlay(map, newInterval);
    },
    [map, gridEnabled]
  );

  // ─── Add custom XYZ layer ─────────────────────────────────────────────
  const addCustomLayer = useCallback(async () => {
    if (!map || !customUrl.trim()) return;

    setCustomError('');
    setIsAdding(true);

    try {
      const label = customLabel.trim() || `Orthophoto ${customLayers.length + 1}`;
      const layer = await createCustomXYZLayer(customUrl.trim(), label);
      (layer as any).setOpacity(overlayOpacity / 100);

      map.addLayer(layer);
      const id = layer.get('basemapId') as string;
      const newEntry = { id, label, url: customUrl.trim(), type: 'xyz' as const };
      setCustomLayers((prev) => {
        const updated = [...prev, newEntry];
        persistLayers(updated);
        return updated;
      });
      setTileLayerVisibility((prev) => ({ ...prev, [id]: true }));
      setCustomUrl('');
      setCustomLabel('');
    } catch (err: unknown) {
      setCustomError(((err as Error)?.message) || 'Failed to add layer');
    } finally {
      setIsAdding(false);
    }
  }, [map, customUrl, customLabel, customLayers.length, overlayOpacity]);

  // ─── Add WMS layer (GeoServer / MapServer) ──────────────────────────
  const addWmsLayer = useCallback(async () => {
    if (!map || !wmsUrl.trim() || !wmsLayerName.trim()) return;

    setWmsError('');
    setIsAddingWms(true);

    try {
      const label = wmsLabel.trim() || wmsLayerName.trim();
      const layer = await createWMSLayer(wmsUrl.trim(), wmsLayerName.trim(), label);
      (layer as any).setOpacity(overlayOpacity / 100);

      map.addLayer(layer);
      const id = layer.get('basemapId') as string;
      const newEntry = { id, label, url: `${wmsUrl.trim()}|${wmsLayerName.trim()}`, type: 'wms' as const };
      setCustomLayers((prev) => {
        const updated = [...prev, newEntry];
        persistLayers(updated);
        return updated;
      });
      setTileLayerVisibility((prev) => ({ ...prev, [id]: true }));
      setWmsUrl('');
      setWmsLayerName('');
      setWmsLabel('');
    } catch (err: unknown) {
      setWmsError(((err as Error)?.message) || 'Failed to add WMS layer');
    } finally {
      setIsAddingWms(false);
    }
  }, [map, wmsUrl, wmsLayerName, wmsLabel, overlayOpacity]);

  // ─── Remove custom layer ──────────────────────────────────────────────
  const removeCustomLayer = useCallback(
    (id: string) => {
      if (!map) return;

      const layers = map.getLayers().getArray();
      for (let i = 0; i < layers.length; i++) {
        if (layers[i].get('basemapId') === id) {
          map.getLayers().removeAt(i);
          break;
        }
      }
      setCustomLayers((prev) => {
        const updated = prev.filter((l) => l.id !== id);
        persistLayers(updated);
        return updated;
      });
      setTileLayerVisibility((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [map]
  );

  // ─── Toggle custom layer visibility ───────────────────────────────────
  const toggleCustomLayerVisibility = useCallback(
    (id: string) => {
      if (!map) return;

      const layers = map.getLayers().getArray();
      for (const layer of layers) {
        if (layer.get('basemapId') === id) {
          const current = layer.getVisible();
          layer.setVisible(!current);
          setTileLayerVisibility((prev) => ({ ...prev, [id]: !current }));
          break;
        }
      }
    },
    [map]
  );

  const basemapOptions: Array<{
    id: BasemapType;
    icon: React.ReactNode;
    label: string;
  }> = [
    { id: 'osm', icon: <MapIcon className="w-4 h-4" />, label: 'OSM' },
    { id: 'satellite', icon: <Satellite className="w-4 h-4" />, label: 'Satellite' },
    { id: 'blank', icon: <Square className="w-4 h-4" />, label: 'Blank' },
  ];

  const gridIntervals: Array<{ value: GridInterval; label: string }> = [
    { value: 'auto', label: 'Auto' },
    { value: 100, label: '100m' },
    { value: 500, label: '500m' },
    { value: 1000, label: '1km' },
  ];

  return (
    <div
      className={`bg-white rounded-lg shadow-lg border border-gray-200 w-64 ${className}`}
    >
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 cursor-pointer select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#1B3A5C] flex items-center justify-center text-white">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Layers</div>
            <div className="text-[10px] text-gray-500">
              {!hideBasemap ? `${activeBasemap === 'osm' ? 'Street Map' : activeBasemap === 'satellite' ? 'Satellite' : 'Blank'} · ` : ''}
              {customLayers.length} overlay{customLayers.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
        />
      </div>

      {isCollapsed ? null : (
        <div className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
          {/* ─── Basemap Selector ──────────────────────────────────────── */}
          {!hideBasemap && (
          <div className="p-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2 block">
              <MapIcon className="w-3 h-3 inline mr-1" />
              Basemap
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {basemapOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => switchBasemap(opt.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                    activeBasemap === opt.id
                      ? 'bg-[#1B3A5C] text-white shadow-sm'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
          )}

          {/* ─── Grid Overlay ──────────────────────────────────────────── */}
          <div className="p-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2 block">
              <Grid3X3 className="w-3 h-3 inline mr-1" />
              Kenya Grid Overlay
            </div>

            <div className="flex items-center justify-between mb-2">
              <button
                onClick={toggleGrid}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                  gridEnabled
                    ? 'bg-[#1B3A5C] text-white shadow-sm'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {gridEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {gridEnabled ? 'Grid On' : 'Grid Off'}
              </button>

              <div className="flex items-center gap-1">
                {gridIntervals.map((gi) => (
                  <button
                    key={String(gi.value)}
                    onClick={() => changeGridInterval(gi.value)}
                    disabled={!gridEnabled}
                    className={`px-2 py-1 text-[10px] rounded transition-colors ${
                      gridInterval === gi.value
                        ? 'bg-[#1B3A5C] text-white'
                        : gridEnabled
                          ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          : 'bg-gray-50 text-gray-300'
                    }`}
                  >
                    {gi.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Custom XYZ / Orthophoto ───────────────────────────────── */}
          <div className="p-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2 block">
              <Link2 className="w-3 h-3 inline mr-1" />
              Custom Orthophoto / XYZ Tiles
            </div>

            <div className="space-y-2">
              <input
                type="text"
                aria-label="Tile URL (XYZ template)" placeholder="https://.../{z}/{x}/{y}.png"
                value={customUrl}
                onChange={(e) => {
                  setCustomUrl(e.target.value);
                  setCustomError('');
                }}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#1B3A5C] focus:border-[#1B3A5C] outline-none font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCustomLayer();
                }}
              />
              <input
                type="text"
                aria-label="Layer label" placeholder="Layer label (optional)"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#1B3A5C] focus:border-[#1B3A5C] outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCustomLayer();
                }}
              />
              <button
                onClick={addCustomLayer}
                disabled={!customUrl.trim() || isAdding}
                className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 text-xs bg-[#1B3A5C] text-white rounded-md hover:bg-[#142d49] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isAdding ? (
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Add Layer
              </button>
            </div>

            {customError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                <span className="text-[10px] text-red-700">{customError}</span>
              </div>
            )}
          </div>

          {/* ─── WMS / GeoServer Overlay ───────────────────────────────── */}
          <div className="p-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2 block">
              <Link2 className="w-3 h-3 inline mr-1" />
              WMS / GeoServer Overlay
            </div>

            <div className="space-y-2">
              <input
                type="text"
                aria-label="WMS URL" placeholder="e.g. https://geoserver.example.com/wms"
                value={wmsUrl}
                onChange={(e) => {
                  setWmsUrl(e.target.value);
                  setWmsError('');
                }}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#1B3A5C] focus:border-[#1B3A5C] outline-none font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addWmsLayer();
                }}
              />
              <input
                type="text"
                aria-label="WMS layer name" placeholder="e.g. workspace:parcels"
                value={wmsLayerName}
                onChange={(e) => {
                  setWmsLayerName(e.target.value);
                  setWmsError('');
                }}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#1B3A5C] focus:border-[#1B3A5C] outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addWmsLayer();
                }}
              />
              <input
                type="text"
                aria-label="WMS layer label" placeholder="Label (optional)"
                value={wmsLabel}
                onChange={(e) => setWmsLabel(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-[#1B3A5C] focus:border-[#1B3A5C] outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addWmsLayer();
                }}
              />
              <button
                onClick={addWmsLayer}
                disabled={!wmsUrl.trim() || !wmsLayerName.trim() || isAddingWms}
                className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 text-xs bg-[#1B3A5C] text-white rounded-md hover:bg-[#142d49] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isAddingWms ? (
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Add WMS Layer
              </button>
              <p className="text-[10px] text-gray-400">
                Paste a WMS endpoint URL and layer name from your GeoServer or MapServer to overlay parcels on the map.
              </p>
            </div>

            {wmsError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                <span className="text-[10px] text-red-700">{wmsError}</span>
              </div>
            )}
          </div>

          {/* ─── Opacity Control ───────────────────────────────────────── */}
          <div className="px-3 py-2.5">
            <label htmlFor="lc-opacity" className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" />
              Overlay Opacity
            </label>
            <div className="flex items-center gap-2">
              <input id="lc-opacity"
                type="range"
                min={0}
                max={100}
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseInt(e.target.value))}
                className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#1B3A5C]"
              />
              <span className="text-xs font-mono text-gray-600 w-9 text-right">
                {overlayOpacity}%
              </span>
            </div>
          </div>

          {/* ─── Active Layers List ────────────────────────────────────── */}
          <div className="px-3 pb-3">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-2 block">
              Active Layers
            </div>

            <div className="space-y-1">
              {/* Basemap entry */}
              {!hideBasemap && (
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 rounded-md text-xs">
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-green-600" />
                  <span className="font-medium text-gray-700">
                    {activeBasemap === 'osm' ? 'Street Map' : activeBasemap === 'satellite' ? 'Satellite' : 'Blank'}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">basemap</span>
              </div>
              )}

              {/* Grid entry */}
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 rounded-md text-xs">
                <div className="flex items-center gap-2">
                  {gridEnabled ? (
                    <Eye className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                  )}
                  <span className={`font-medium ${gridEnabled ? 'text-gray-700' : 'text-gray-400'}`}>
                    Kenya Grid
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">
                  {gridInterval === 'auto' ? 'auto' : gridInterval >= 1000 ? `${gridInterval / 1000}km` : `${gridInterval}m`}
                </span>
              </div>

              {/* Custom layer entries */}
              {customLayers.map((cl) => (
                <div
                  key={cl.id}
                  className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 rounded-md text-xs group"
                >
                  <button
                    onClick={() => toggleCustomLayerVisibility(cl.id)}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    {tileLayerVisibility[cl.id] !== false ? (
                      <Eye className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="font-medium text-gray-700 truncate">{cl.label}</span>
                  </button>
                  <button
                    onClick={() => removeCustomLayer(cl.id)}
                    className="p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove layer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {customLayers.length === 0 && (
                <div className="text-[10px] text-gray-400 text-center py-2">
                  No custom layers added
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
