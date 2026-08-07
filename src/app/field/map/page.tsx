'use client';
import { useState, useRef, useCallback } from 'react';
import { MapLayer, GeoPDFLayer, MBTilesSession } from '@/types/field';
import { parseKML, parseKMZ } from '@/lib/field/kml';
import { uploadMBTiles } from '@/lib/field/mbtiles';
import type { MapHandle } from '@/components/field/MapViewer';
import {
  ArrowLeft,
  Plus,
  Minus,
  MapPin,
  Navigation,
  Upload,
  FileText,
  Database,
  Eye,
  EyeOff,
  Download,
  X,
  ChevronLeft,
  Layers,
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

import MapViewer from '@/components/field/MapViewer';

/* ── Non-OL imports (safe to import at module level) ──────────────── */
const GeoPDFImport = dynamic(() => import('@/components/field/GeoPDFImport'), {
  ssr: false,
  loading: () => (
    <div className="p-4 text-white/50 text-sm">Loading GeoPDF importer…</div>
  ),
});

/* ================================================================== */
/*  FIELD MAP PAGE — Full-bleed map with zero-obstruction overlays      */
/* ================================================================== */

export default function FieldMapPage() {
  /* ── State ──────────────────────────────────────────────────────── */
  const mapRef = useRef<MapHandle>(null);
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [geoPDFLayers, setGeoPDFLayers] = useState<GeoPDFLayer[]>([]);
  const [mbtilesSessions, setMBTilesSessions] = useState<MBTilesSession[]>([]);
  const [mbtilesLoading, setMBTilesLoading] = useState(false);
  const [geoPDFOpen, setGeoPDFOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsLocation, setGpsLocation] = useState<{lat: number, lng: number} | null>(null);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const kmlInputRef = useRef<HTMLInputElement>(null);
  const drawerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── KML / KMZ import handler ──────────────────────────────────── */
  const handleKMLImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      let geojson: GeoJSON.FeatureCollection;
      if (ext === 'kml') geojson = await parseKML(await file.text());
      else if (ext === 'kmz') geojson = await parseKMZ(await file.arrayBuffer());
      else return;
      setLayers(prev => [...prev, {
        id: `layer_${Date.now()}`, name: file.name,
        type: ext as 'kml' | 'kmz', geojson, visible: true, loadedAt: Date.now(),
      }]);
    } catch (err) {
      alert(`Parse error: ${(err as Error).message}`);
    }
    // Reset input so same file can be re-imported
    e.target.value = '';
  }, []);

  /* ── MBTiles import handler ─────────────────────────────────────── */
  const handleMBTilesImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMBTilesLoading(true);
    try {
      const session = await uploadMBTiles(file);
      setMBTilesSessions(prev => [...prev, session]);
    } catch (err) {
      alert(`MBTiles error: ${(err as Error).message}`);
    } finally {
      setMBTilesLoading(false);
    }
    e.target.value = '';
  }, []);

  /* ── GeoPDF layer ready callback ───────────────────────────────── */
  const handleGeoPDFReady = useCallback((layer: GeoPDFLayer) => {
    setGeoPDFLayers(prev => [...prev, layer]);
    setGeoPDFOpen(false);
  }, []);

  /* ── Layer visibility toggle ────────────────────────────────────── */
  const toggleLayer = useCallback((id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  }, []);

  /* ── Export handlers ───────────────────────────────────────────── */
  const exportKML = useCallback(() => {
    const visibleLayers = layers.filter(l => l.visible && l.geojson);
    if (visibleLayers.length === 0) { alert('No visible layers to export.'); return; }
    const geojson = visibleLayers[0].geojson!;
    const kmlContent = jsonToKML(geojson);
    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
    downloadBlob(blob, 'metardu-export.kml');
    setDrawerOpen(false);
  }, [layers]);

  const exportCSV = useCallback(() => {
    const visibleLayers = layers.filter(l => l.visible && l.geojson);
    if (visibleLayers.length === 0) { alert('No visible layers to export.'); return; }
    const features = visibleLayers[0].geojson!.features;
    const header = 'name,latitude,longitude\n';
    const rows = features.map((f: GeoJSON.Feature) => {
      const coords = f.geometry && f.geometry.type === 'Point' ? (f.geometry as GeoJSON.Point).coordinates : null;
      const props = (f.properties || {}) as Record<string, unknown>;
      const name = String(props.name || props.Name || '');
      return coords ? `${name},${coords[1]?.toFixed(8)},${coords[0]?.toFixed(8)}` : '';
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    downloadBlob(blob, 'metardu-export.csv');
    setDrawerOpen(false);
  }, [layers]);

  /* ── GPS toggle ────────────────────────────────────────────────── */
  const toggleGPS = useCallback(() => {
    if (gpsActive && gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      setGpsWatchId(null);
      setGpsActive(false);
      setGpsAccuracy(null);
      return;
    }
    if (!navigator.geolocation) { alert('Geolocation not available.'); return; }
    setGpsActive(true);
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsAccuracy(pos.coords.accuracy);
        setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => { setGpsActive(false); setGpsAccuracy(null); setGpsLocation(null); },
      { enableHighAccuracy: true, maximumAge: 2000 },
    );
    setGpsWatchId(id);
  }, [gpsActive, gpsWatchId]);

  /* ── Cleanup GPS on unmount ───────────────────────────────────── */
  useState(() => {
    return () => {
      if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
    };
  });

  /* ── Tooltip helpers (accessible: hover + long-press fallback) ───── */
  const showTooltip = useCallback((label: string) => setTooltip(label), []);
  const hideTooltip = useCallback(() => setTooltip(null), []);

  /* ── Drawer open/close with safe timeout ───────────────────────── */
  const openDrawer = useCallback(() => {
    if (drawerTimeoutRef.current) clearTimeout(drawerTimeoutRef.current);
    setDrawerOpen(true);
  }, []);
  const closeDrawer = useCallback(() => {
    if (drawerTimeoutRef.current) clearTimeout(drawerTimeoutRef.current);
    drawerTimeoutRef.current = setTimeout(() => setDrawerOpen(false), 220);
  }, []);

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="relative w-full overflow-hidden bg-[var(--bg-primary)]" style={{ height: '100dvh' }}>
      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  MAP — FULL BLEED (absolute, no padding)                    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="absolute inset-0">
        <MapViewer
          ref={mapRef}
          layers={layers}
          beacons={[]}
          parcels={[]}
          geoPDFLayers={geoPDFLayers}
          mbtilesSessions={mbtilesSessions}
          gpsLocation={gpsLocation}
          gpsAccuracy={gpsAccuracy}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  TOP-LEFT — Project title bar (max 48px, semi-transparent)   */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div
        className="absolute top-0 left-0 z-10 flex items-center gap-2 px-3 text-white"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          height: 'calc(48px + env(safe-area-inset-top, 0px))',
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <Link href="/field" aria-label="Back to Field Hub">
          <ArrowLeft className="w-5 h-5 text-white/80 hover:text-white transition-colors" />
        </Link>
        <span className="text-sm font-semibold truncate max-w-[200px]">Field Map</span>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  TOP-RIGHT — Zoom controls + Kenya reset                    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div
        className="absolute z-10 flex flex-col items-center gap-1.5"
        style={{
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          right: 16,
        }}
      >
        {/* Zoom In */}
        <button
          onClick={() => mapRef.current?.zoomIn()}
          onMouseEnter={() => showTooltip('Zoom In')}
          onMouseLeave={hideTooltip}
          onTouchStart={() => showTooltip('Zoom In')}
          onTouchEnd={() => { hideTooltip(); }}
          className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all shadow-md"
          aria-label="Zoom In"
        >
          <Plus className="w-5 h-5" />
        </button>
        {/* Zoom Out */}
        <button
          onClick={() => mapRef.current?.zoomOut()}
          onMouseEnter={() => showTooltip('Zoom Out')}
          onMouseLeave={hideTooltip}
          className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all shadow-md"
          aria-label="Zoom Out"
        >
          <Minus className="w-5 h-5" />
        </button>
        {/* Kenya Reset */}
        <button
          onClick={() => mapRef.current?.resetToKenya()}
          onMouseEnter={() => showTooltip('Reset to Kenya')}
          onMouseLeave={hideTooltip}
          onTouchStart={() => showTooltip('Reset to Kenya')}
          onTouchEnd={() => { hideTooltip(); }}
          className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#D17B47] text-white hover:bg-[#b06335] active:scale-95 transition-all font-bold text-xs shadow-md"
          aria-label="Reset to Kenya view"
        >
          KEN
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  BOTTOM-LEFT — GPS status badge                              */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {gpsActive && gpsAccuracy !== null && (
        <div
          className="absolute z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-mono shadow-md"
          style={{
            bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            left: 16,
          }}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
          </span>
          GPS &plusmn;{gpsAccuracy.toFixed(1)}m
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  BOTTOM-RIGHT — FAB stack: Perimeter → GPS Beacon → Import   */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div
        className="absolute z-10 flex flex-col items-center gap-3"
        style={{
          bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          right: 16,
        }}
      >
        {/* Perimeter Walk */}
        <button
          onClick={() => {
            /* Navigate to the walk page */
            window.location.href = '/field/walk';
          }}
          onMouseEnter={() => showTooltip('Perimeter Walk')}
          onMouseLeave={hideTooltip}
          onTouchStart={() => showTooltip('Perimeter Walk')}
          onTouchEnd={() => { hideTooltip(); }}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-[#D17B47] text-white shadow-lg shadow-orange-900/30 hover:shadow-orange-800/40 active:scale-95 transition-all"
          aria-label="Perimeter Walk"
        >
          <MapPin className="w-5 h-5" />
        </button>
        {/* GPS Beacon */}
        <button
          onClick={toggleGPS}
          onMouseEnter={() => showTooltip(gpsActive ? 'Stop GPS' : 'GPS Beacon')}
          onMouseLeave={hideTooltip}
          onTouchStart={() => showTooltip(gpsActive ? 'Stop GPS' : 'GPS Beacon')}
          onTouchEnd={() => { hideTooltip(); }}
          className={`w-12 h-12 flex items-center justify-center rounded-full shadow-lg transition-all active:scale-95 ${
            gpsActive
              ? 'bg-green-600 text-white shadow-green-900/30'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
          aria-label={gpsActive ? 'Stop GPS' : 'Start GPS'}
        >
          <Navigation className="w-5 h-5" />
        </button>
        {/* Import KML */}
        <button
          onClick={() => kmlInputRef.current?.click()}
          onMouseEnter={() => showTooltip('Import KML')}
          onMouseLeave={hideTooltip}
          onTouchStart={() => showTooltip('Import KML')}
          onTouchEnd={() => { hideTooltip(); }}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-800 shadow-lg active:scale-95 transition-all"
          aria-label="Import KML"
        >
          <Upload className="w-5 h-5" />
        </button>
        {/* Hidden file input for KML */}
        <input
          ref={kmlInputRef}
          type="file"
          accept=".kml,.kmz"
          className="hidden"
          onChange={handleKMLImport}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  LEFT EDGE — Export drawer (24px tab → 240px panel)          */}
      {/* ═══════════════════════════════════════════════════════════ */}

      {/* Backdrop — only visible when drawer is open */}
      {drawerOpen && (
        <div
          className="absolute inset-0 z-20"
          style={{ backgroundColor: 'transparent' }}
          onClick={closeDrawer}
        />
      )}

      {/* Drawer panel */}
      <div
        className="absolute z-30 top-0 left-0 h-full transition-transform duration-300 ease-out"
        style={{
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-240px)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Drawer body */}
        <div
          className="h-full flex flex-col bg-slate-900 border-r border-white/[0.08] text-white"
          style={{ width: 'min(240px, 65vw)' }}
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.08]">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Export &amp; Layers</span>
            <button
              onClick={closeDrawer}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Export section */}
            <div>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Export</p>
              <button
                onClick={exportKML}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-sm text-white/80 hover:text-white transition-colors"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <span>Export as KML</span>
              </button>
              <button
                onClick={exportCSV}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-sm text-white/80 hover:text-white transition-colors mt-1"
              >
                <Download className="w-4 h-4 text-green-400" />
                <span>Export as CSV</span>
              </button>
            </div>

            {/* Import section */}
            <div>
              <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Import</p>
              <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-sm text-white/80 hover:text-white cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-orange-400" />
                <span>Import MBTiles</span>
                <input type="file" accept=".mbtiles" className="hidden" onChange={handleMBTilesImport} disabled={mbtilesLoading} />
              </label>
              <button
                onClick={() => { setGeoPDFOpen(true); setDrawerOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-sm text-white/80 hover:text-white transition-colors mt-1"
              >
                <FileText className="w-4 h-4 text-purple-400" />
                <span>Import GeoPDF</span>
              </button>
            </div>

            {/* Layer list */}
            {layers.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Layers ({layers.length})</p>
                <div className="space-y-1">
                  {layers.map(l => (
                    <button
                      key={l.id}
                      onClick={() => toggleLayer(l.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors ${
                        l.visible
                          ? 'bg-blue-500/10 text-blue-300'
                          : 'bg-white/[0.02] text-white/40'
                      }`}
                    >
                      {l.visible ? <Eye className="w-3.5 h-3.5 flex-shrink-0" /> : <EyeOff className="w-3.5 h-3.5 flex-shrink-0" />}
                      <span className="truncate">{l.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* MBTiles sessions */}
            {mbtilesSessions.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Tile Sessions</p>
                <div className="space-y-1">
                  {mbtilesSessions.map(s => (
                    <div key={s.key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 text-orange-300 text-xs">
                      <Database className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* GeoPDF sessions */}
            {geoPDFLayers.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">GeoPDF Layers</p>
                <div className="space-y-1">
                  {geoPDFLayers.map(g => (
                    <div key={g.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 text-purple-300 text-xs">
                      <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{g.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collapsed drawer tab — visible when drawer is closed */}
      {!drawerOpen && (
        <button
          onClick={openDrawer}
          className="absolute z-10 top-1/2 -translate-y-1/2 w-10 flex items-center justify-center rounded-r-lg bg-slate-900 hover:bg-slate-800 text-white/60 hover:text-white transition-all py-4 shadow-md"
          style={{ left: 0 }}
          aria-label="Open export drawer"
        >
          <ChevronLeft className="w-4 h-4 rotate-180" />
        </button>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  GEOPDF PANEL — slim banner, NOT a full-width bottom sheet    */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {geoPDFOpen && (
        <div
          className="absolute z-20 left-0 right-0 bg-slate-900 border-t border-white/[0.08]"
          style={{ bottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex items-center gap-2 px-3 py-2">
            <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <span className="text-xs text-white/80 flex-1">GeoPDF Import</span>
            <button
              onClick={() => setGeoPDFOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
              aria-label="Close GeoPDF import"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <GeoPDFImport onLayerReady={handleGeoPDFReady} />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  TOOLTIP — accessible, positioned near FAB stack               */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {tooltip && (
        <div
          className="absolute z-40 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-medium pointer-events-none whitespace-nowrap shadow-md"
          style={{ bottom: 'calc(200px + env(safe-area-inset-bottom, 0px))', right: 72 }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function jsonToKML(geojson: GeoJSON.FeatureCollection): string {
  const pts = geojson.features
    .filter((f): f is GeoJSON.Feature<GeoJSON.Point> => f.geometry?.type === 'Point')
    .map((f) => {
      const [lng, lat] = f.geometry.coordinates;
      const props = (f.properties || {}) as Record<string, unknown>;
      const name = String(props.name || props.Name || 'Point');
      return `  <Placemark><name>${escapeXml(name)}</name><Point><coordinates>${lng},${lat},0</coordinates></Point></Placemark>`;
    })
    .join('\n');

  const lines = geojson.features
    .filter((f): f is GeoJSON.Feature<GeoJSON.LineString> => f.geometry?.type === 'LineString')
    .map((f) => {
      const coords = f.geometry.coordinates.map((c: number[]) => `${c[0]},${c[1]},0`).join(' ');
      const props = (f.properties || {}) as Record<string, unknown>;
      const name = String(props.name || props.Name || 'Line');
      return `  <Placemark><name>${escapeXml(name)}</name><LineString><coordinates>${coords}</coordinates></LineString></Placemark>`;
    })
    .join('\n');

  const polys = geojson.features
    .filter((f): f is GeoJSON.Feature<GeoJSON.Polygon> => f.geometry?.type === 'Polygon')
    .map((f) => {
      const rings = f.geometry.coordinates.map(
        (ring: number[][]) => ring.map((c: number[]) => `${c[0]},${c[1]},0`).join(' ')
      ).join(' ');
      const props = (f.properties || {}) as Record<string, unknown>;
      const name = String(props.name || props.Name || 'Polygon');
      return `  <Placemark><name>${escapeXml(name)}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${rings}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>Metardu Export</name>
${pts}${lines}${polys}
</Document>
</kml>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
