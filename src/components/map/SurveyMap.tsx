'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { registerProjections, arrayTo3857, to21037, SRID_3857 } from '@/lib/map/projection';
import { nearestKenCORSStations, type KenCORSStation } from '@/lib/map/kencors';
import type { AdjustedStation, PlanGeometry } from '@/lib/engine/planGeometry';
import { computePlanGeometry } from '@/lib/engine/planGeometry';
import { createAnnotationLayer } from '@/lib/map/annotations';
import { MeasurementTool } from './MeasurementTool';
import { VertexEditToolbar } from './VertexEditToolbar';
import MapAccessibility from './MapAccessibility';
import { useVertexEditing } from '@/hooks/useVertexEditing';
import { LayerControl } from './LayerControl';
import { exportMapPDF } from '@/lib/export/exportMapPDF';

interface SurveyMapProps {
  projectId: string;
  adjustedStations: AdjustedStation[];
  centroidEasting: number;
  centroidNorthing: number;
  onBeaconClick?: (label: string, easting: number, northing: number) => void;
  readOnly?: boolean;
  /** Enable the vertex editing toolbar and interactions */
  enableEditing?: boolean;
  /** Callback with updated vertices (EPSG:21037) after each edit */
  onVerticesChange?: (updated: Array<{ easting: number; northing: number }>) => void;
  /** Sheet layout props */
  lrNumber?: string;
  projectName?: string;
  surveyorName?: string;
  surveyorLicense?: string;
  clientName?: string;
  county?: string;
  /** Unique container ID for PDF print targeting */
  mapContainerId?: string;
  /** T1.5 FIX (2026-07-09): UTM EPSG for coordinate transforms (default 'EPSG:21037') */
  epsg?: string;
}

interface NearestStation extends KenCORSStation {
  distanceKm: number;
}

export default function SurveyMap({
  projectId,
  adjustedStations,
  centroidEasting,
  centroidNorthing,
  onBeaconClick,
  readOnly: _readOnly = true,
  enableEditing = false,
  onVerticesChange,
  lrNumber,
  projectName,
  surveyorName,
  surveyorLicense,
  clientName,
  county,
  mapContainerId = 'metardu-map-container',
  epsg = 'EPSG:21037',
}: SurveyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import('ol/Map').default | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [nearestStations, setNearestStations] = useState<NearestStation[]>([]);
  const [clickedCoord, setClickedCoord] = useState<{ easting: number; northing: number } | null>(null);
  const [_basemap, setBasemap] = useState<'osm' | 'satellite' | 'blank'>('osm');

  // ── Sheet layout state ────────────────────────────────────────
  const [showSheetLayout, setShowSheetLayout] = useState(false);
  const [sheetLayoutReady, setSheetLayoutReady] = useState(false);

  // ── Compute plan geometry for sheet layout ─────────────────────
  const planGeometry: PlanGeometry | null = useMemo(() => {
    if (adjustedStations.length < 3) return null;
    return computePlanGeometry(adjustedStations);
  }, [adjustedStations]);

  // ── Dynamically import SheetLayout to avoid SSR issues ─────────
  const [SheetLayoutComponent, setSheetLayoutComponent] = useState<React.ComponentType<import('./SheetLayout').SheetLayoutProps> | null>(null);

  useEffect(() => {
    import('./SheetLayout').then((mod) => {
      setSheetLayoutComponent(() => mod.default);
      setSheetLayoutReady(true);
    });
  }, []);

  // ── Vertex editing state ──────────────────────────────────────
  const [vertexEditingEnabled, setVertexEditingEnabled] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapTolerance, setSnapTolerance] = useState(10);

  // Derive the editable vertices from adjustedStations
  const editableVertices = adjustedStations.map(s => ({
    easting: s.adjustedEasting,
    northing: s.adjustedNorthing,
  }));

  const { state: vertexEditState } = useVertexEditing({
    map: mapInstanceRef.current,
    vertices: editableVertices,
    enabled: enableEditing && vertexEditingEnabled,
    onVerticesChange: onVerticesChange ?? (() => {}),
    snapTolerance,
    snapEnabled,
  });

  async function to3857Single(e: number, n: number): Promise<[number, number]> {
    const { transform } = await import('ol/proj');
    return transform([e, n], epsg, SRID_3857) as [number, number];
  }

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let map: import('ol/Map').default;
    let cancelled = false;

    // Store handler references for cleanup
    let viewChangeHandler: (() => void) | null = null;
    let mapClickHandler: ((evt: { pixel: number[]; coordinate: number[] }) => void) | null = null;

    async function initMap() {
      await registerProjections();

      const { default: Map }  = await import('ol/Map');
      const { default: View } = await import('ol/View');
      const { transform }     = await import('ol/proj');

      if (cancelled) return;

      const storageKey = `metardu_map_${projectId}`;
      const saved = localStorage.getItem(storageKey);
      const savedState = saved ? (JSON.parse(saved) as { center?: number[]; zoom?: number }) : null;

      const center3857 = transform(
        [centroidEasting, centroidNorthing],
        epsg,
        SRID_3857
      ) as [number, number];

      const { createOSMLayer, createParcelLayer, createBeaconLayer, createKenCORSLayer }
        = await import('@/lib/map/layers');

      if (cancelled) return;

      const closed = [...adjustedStations, adjustedStations[0]];
      const coords3857 = await arrayTo3857(
        closed.map(s => [s.adjustedEasting, s.adjustedNorthing] as [number, number])
      );

      const beaconCoords = await Promise.all(
        adjustedStations.map(async s => ({
          label: s.pointName,
          coord3857: await to3857Single(s.adjustedEasting, s.adjustedNorthing),
        }))
      );

      const nearest = nearestKenCORSStations(centroidEasting, centroidNorthing, 3);
      setNearestStations(nearest);

      const kenCORSWithCoords = await Promise.all(
        nearest.map(async st => ({
          ...st,
          coord3857: await to3857Single(st.easting, st.northing),
        }))
      );

      if (cancelled) return;

      const [osmLayer, parcelLayer, beaconLayer, kenCORSLayer] = await Promise.all([
        createOSMLayer(),
        createParcelLayer(coords3857),
        createBeaconLayer(beaconCoords),
        createKenCORSLayer(kenCORSWithCoords),
      ]);

      // Tag the OSM layer so LayerControl can find it
      osmLayer.set('basemapId', 'osm');

      // Create annotation layer with bearings, distances, and area
      const stations21037 = adjustedStations.map(s => ({
        pointName: s.pointName,
        easting: s.adjustedEasting,
        northing: s.adjustedNorthing,
      }));
      const annotationLayer = await createAnnotationLayer({
        coords3857,
        stations21037,
      });

      if (cancelled) return;

      const target = mapRef.current;
      if (!target) return;

      map = new Map({
        target,
        layers: [osmLayer, kenCORSLayer, parcelLayer, beaconLayer, annotationLayer],
        view: new View({
          center: savedState?.center ?? center3857,
          zoom: savedState?.zoom ?? 16,
          projection: SRID_3857,
        }),
        controls: [],
      });

      viewChangeHandler = () => {
        const state = {
          center: map.getView().getCenter(),
          zoom: map.getView().getZoom(),
        };
        localStorage.setItem(storageKey, JSON.stringify(state));
      };
      map.getView().on('change', viewChangeHandler);

      mapClickHandler = async (evt: { pixel: number[]; coordinate: number[] }) => {
        const [x, y] = evt.coordinate as [number, number];
        const [e, n] = await to21037(x, y);
        setClickedCoord({ easting: e, northing: n });

        // ── Check if a beacon feature was clicked ─────────────────
        if (onBeaconClick) {
          const hitFeature = map.forEachFeatureAtPixel(evt.pixel, (f) => f as import('ol/Feature').default, {
            hitTolerance: 8,
          });
          if (hitFeature) {
                        const label: unknown = hitFeature.get('label') || hitFeature.get('name') || hitFeature.get('stationName');
            if (label) {
              const geom = hitFeature.getGeometry();
              if (geom && geom.getType() === 'Point') {
                const coord = (geom as import('ol/geom/Point').default).getCoordinates();
                const [be, bn] = await to21037(coord[0], coord[1]);
                onBeaconClick(String(label), be, bn);
              }
            }
          }
        }
      };
      map.on('click', mapClickHandler);

      mapInstanceRef.current = map;
      setMapReady(true);
    }

    initMap();

    return () => {
      cancelled = true;
      const instance = mapInstanceRef.current;
      if (instance) {
        // Remove event listeners before destroying
        try {
          const view = instance.getView();
          if (view && viewChangeHandler) {
            view.un('change', viewChangeHandler);
          }
        } catch { /* ignore */ }
        try {
          if (mapClickHandler) {
            instance.un('click', mapClickHandler);
          }
        } catch { /* ignore */ }
        instance.setTarget(undefined);
        mapInstanceRef.current = null;
      }
    };
    // One-shot map initializer: identity is project+centroid; adjustedStations/epsg/
    // onBeaconClick/to3857Single are captured for the initial build only (re-running
    // would tear down the live map and drop in-progress user edits).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, centroidEasting, centroidNorthing]);

  const fitToParcel = useCallback(async () => {
    if (!mapInstanceRef.current || adjustedStations.length < 3) return;
    const { transform } = await import('ol/proj');
    const coords = adjustedStations.map(s =>
      transform([s.adjustedEasting, s.adjustedNorthing], epsg, SRID_3857)
    );
    const xs = coords.map(c => c[0]);
    const ys = coords.map(c => c[1]);
    const extent = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number];
    mapInstanceRef.current.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 400 });
  }, [adjustedStations, epsg]);

  const handlePrint = useCallback(() => {
    if (!showSheetLayout) {
      setShowSheetLayout(true);
    }
    // Small delay to ensure sheet layout renders before print
    setTimeout(() => {
      exportMapPDF(mapContainerId, { paperSize: 'a3', orientation: 'landscape' });
    }, 500);
  }, [showSheetLayout, mapContainerId]);

  return (
    <div id={mapContainerId} className="flex flex-col h-full" role="application" aria-label="Cadastral survey map">
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 text-sm">
        <button
          onClick={fitToParcel}
          className="px-3 py-1.5 bg-[#1B3A5C] text-white rounded text-xs font-medium hover:bg-[#142d49]"
        >
          Fit to Parcel
        </button>
        <button
          onClick={() => setShowSheetLayout(v => !v)}
          className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
            showSheetLayout
              ? 'bg-[#1B3A5C] text-white border-[#1B3A5C]'
              : 'bg-white text-[#1B3A5C] border-[#1B3A5C] hover:bg-[#1B3A5C]/5'
          }`}
          title="Toggle sheet layout overlay (north arrow, scale bar, grid ticks, title block)"
        >
          {showSheetLayout ? ' Sheet Layout On' : ' Sheet Layout'}
        </button>
        <button
          onClick={handlePrint}
          className="px-3 py-1.5 bg-white text-[#1B3A5C] border border-[#1B3A5C] rounded text-xs font-medium hover:bg-[#1B3A5C]/5 transition-colors"
          title="Export current map view to PDF (A3 landscape)"
        >
          ⎙ Print / PDF
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="font-medium">Nearest KenCORS:</span>
          {nearestStations.map(st => (
            <span key={st.id} className={st.status === 'active' ? 'text-green-700' : 'text-gray-400'}>
              {st.id} ({st.distanceKm.toFixed(0)} km)
            </span>
          ))}
        </div>
      </div>

      <div className="relative flex-1">
        <div ref={mapRef} className="w-full h-full" />

        {/* Screen reader live region for map state changes */}
        <MapAccessibility mapReady={mapReady} schemeDataLoaded={mapReady && adjustedStations.length > 0} />

        <div className="absolute top-3 right-3 z-10 flex flex-col gap-3 items-end">
          {enableEditing && (
            <VertexEditToolbar
              enabled={vertexEditingEnabled}
              onToggle={() => setVertexEditingEnabled(v => !v)}
              snapEnabled={snapEnabled}
              onSnapToggle={() => setSnapEnabled(v => !v)}
              snapTolerance={snapTolerance}
              onToleranceChange={setSnapTolerance}
              editState={vertexEditState}
            />
          )}
          <MeasurementTool map={mapInstanceRef.current} />
          <LayerControl
            map={mapInstanceRef.current}
            onBasemapChange={setBasemap}
          />
        </div>

        {clickedCoord && (
          <div className="absolute bottom-3 left-3 bg-white border border-gray-200 rounded px-3 py-2 text-xs font-mono shadow">
            <span className="text-gray-500 mr-1">E</span>
            <span className="font-semibold">{clickedCoord.easting.toFixed(3)}</span>
            <span className="text-gray-300 mx-2">|</span>
            <span className="text-gray-500 mr-1">N</span>
            <span className="font-semibold">{clickedCoord.northing.toFixed(3)}</span>
            <span className="ml-2 text-gray-400">SRID 21037</span>
          </div>
        )}

        {/* Sheet Layout Overlay */}
        {showSheetLayout && sheetLayoutReady && SheetLayoutComponent && (
          <SheetLayoutComponent
            show={true}
            map={mapInstanceRef.current}
            planGeometry={planGeometry}
            lrNumber={lrNumber}
            projectName={projectName}
            surveyorName={surveyorName}
            surveyorLicense={surveyorLicense}
            clientName={clientName}
            county={county}
          />
        )}

        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-sm text-gray-500">Loading map...</div>
          </div>
        )}
      </div>
    </div>
  );
}