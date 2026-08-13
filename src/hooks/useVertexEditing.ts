/**
 * METARDU useVertexEditing Hook
 *
 * React hook for managing vertex editing on the survey map.
 * Provides OpenLayers Modify, Snap interactions, vertex insertion (dblclick),
 * vertex removal (right-click), and coordinate readback in EPSG:21037.
 *
 * All OL imports are dynamic (await import()) to match existing patterns.
 * Coordinate math in EPSG:21037, rendering in EPSG:3857.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type Map from 'ol/Map';
import type { Feature } from 'ol';
import type { Polygon as OlPolygon } from 'ol/geom';
import { to21037, arrayTo3857 } from '@/lib/map/projection';

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export interface VertexPoint {
  easting: number;
  northing: number;
}

export interface VertexEditingOptions {
  /** OpenLayers map instance */
  map: Map | null;
  /** Current parcel vertices in EPSG:21037 (used to initialise the editable polygon) */
  vertices: VertexPoint[];
  /** Whether editing interactions are active */
  enabled: boolean;
  /** Callback with updated vertices after every edit */
  onVerticesChange: (updated: VertexPoint[]) => void;
  /** Snap tolerance in pixels (default 10) */
  snapTolerance?: number;
  /** Whether magnetic snap is on (default true) */
  snapEnabled?: boolean;
}

export interface VertexEditingState {
  vertexCount: number;
  hoveredVertex: { easting: number; northing: number; index: number } | null;
  lastEditedVertex: { easting: number; northing: number; index: number } | null;
}

/* ------------------------------------------------------------------ */
/*  Geometry helpers (all in map projection – EPSG:3857)              */
/* ------------------------------------------------------------------ */

function pointToSegmentDist(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0)
    return Math.sqrt((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2);
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)
  );
  return Math.sqrt((p[0] - (a[0] + t * dx)) ** 2 + (p[1] - (a[1] + t * dy)) ** 2);
}

function nearestPointOnSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): [number, number] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return [a[0], a[1]];
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)
  );
  return [a[0] + t * dx, a[1] + t * dy];
}

function vertexDist(
  p: [number, number],
  v: [number, number]
): number {
  return Math.sqrt((p[0] - v[0]) ** 2 + (p[1] - v[1]) ** 2);
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useVertexEditing({
  map,
  vertices,
  enabled,
  onVerticesChange,
  snapTolerance = 10,
  snapEnabled = true,
}: VertexEditingOptions) {
  const [state, setState] = useState<VertexEditingState>({
    vertexCount: 0,
    hoveredVertex: null,
    lastEditedVertex: null,
  });

  // --- Refs for OL objects ---
  const sourceRef = useRef<import('ol/source/Vector').default | null>(null);
  const layerRef = useRef<import('ol/layer/Vector').default | null>(null);
  const modifyRef = useRef<import('ol/interaction/Modify').default | null>(null);
  const snapRef = useRef<import('ol/interaction/Snap').default | null>(null);
  const featureRef = useRef<Feature<OlPolygon> | null>(null);
  const mapRef = useRef<Map | null>(null);

  // Stable function refs (avoids stale closures)
  const onVerticesChangeRef = useRef(onVerticesChange);
  const verticesRef = useRef<VertexPoint[]>(vertices);

  // Event handler refs for cleanup
  const dblClickRef = useRef<((evt: import('ol/MapBrowserEvent').default) => void) | null>(null);
  const contextMenuRef = useRef<((evt: import('ol/MapBrowserEvent').default) => void) | null>(null);
  const pointerMoveRef = useRef<((evt: import('ol/MapBrowserEvent').default) => void) | null>(null);

  // --- Keep refs in sync ---
  useEffect(() => { mapRef.current = map; }, [map]);
  useEffect(() => { verticesRef.current = vertices; }, [vertices]);
  useEffect(() => { onVerticesChangeRef.current = onVerticesChange; }, [onVerticesChange]);

  // --- Read polygon geometry → EPSG:21037 vertices ---
  const readVerticesFromFeature = useCallback(async (): Promise<VertexPoint[]> => {
    const feat = featureRef.current;
    if (!feat) return verticesRef.current;
    const geom = feat.getGeometry();
    if (!geom) return verticesRef.current;
    const ring = geom.getCoordinates()[0] as number[][];
    // Remove closing vertex (duplicate of first)
    const open = ring.slice(0, -1);
    const pts = await Promise.all(open.map(([x, y]) => to21037(x, y)));
    return pts.map(([e, n]) => ({ easting: e, northing: n }));
  }, []);

  // --- Callback after any geometry edit ---
  const syncVertices = useCallback(async () => {
    const updated = await readVerticesFromFeature();
    onVerticesChangeRef.current(updated);
    setState(prev => ({
      ...prev,
      vertexCount: updated.length,
    }));
  }, [readVerticesFromFeature]);

  // --- Full cleanup ---
  const cleanup = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;

    if (modifyRef.current) {
      m.removeInteraction(modifyRef.current);
      modifyRef.current = null;
    }
    if (snapRef.current) {
      m.removeInteraction(snapRef.current);
      snapRef.current = null;
    }
    if (dblClickRef.current) {
      m.un('dblclick', dblClickRef.current);
      dblClickRef.current = null;
    }
    if (contextMenuRef.current) {
      (m as unknown as { un(type: string, listener: (e: import('ol/MapBrowserEvent').default) => void): void }).un('contextmenu', contextMenuRef.current);
      contextMenuRef.current = null;
    }
    if (pointerMoveRef.current) {
      m.un('pointermove', pointerMoveRef.current);
      pointerMoveRef.current = null;
    }
    if (layerRef.current) {
      m.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    sourceRef.current = null;
    featureRef.current = null;

    setState({
      vertexCount: 0,
      hoveredVertex: null,
      lastEditedVertex: null,
    });
  }, []);

  // --- Main setup effect ---
  useEffect(() => {
    if (!map || !enabled) {
      cleanup();
      return;
    }

    if (vertices.length < 3) return;

    let cancelled = false;

    async function setup() {
      // Dynamic imports (must be dynamic per project rules)
      const [
        { default: VectorSource },
        { default: VectorLayer },
        { default: Feature },
        { default: Polygon },
        { default: Modify },
        { default: Snap },
        olStyle,
      ] = await Promise.all([
        import('ol/source/Vector'),
        import('ol/layer/Vector'),
        import('ol/Feature'),
        import('ol/geom/Polygon'),
        import('ol/interaction/Modify'),
        import('ol/interaction/Snap'),
        import('ol/style'),
      ]);

      const Style = olStyle.Style;
      const FillCls = olStyle.Fill;
      const StrokeCls = olStyle.Stroke;
      const CircleStyle = olStyle.Circle;
      const TextCls = olStyle.Text;

      if (cancelled || !map) return;

      // --- Vector source & layer ---
      const source = new VectorSource();
      const layer = new VectorLayer({
        source,
        style: new Style({
          fill: new FillCls({ color: 'rgba(27, 58, 92, 0.08)' }),
          stroke: new StrokeCls({ color: '#1B3A5C', width: 2.5 }),
        }),
        zIndex: 200,
      });

      // --- Convert vertices to 3857 and build closed ring ---
      const coords21037 = vertices.map(v => [v.easting, v.northing] as [number, number]);
      const coords3857 = await arrayTo3857(coords21037);
      const closedRing: number[][] = [...coords3857.map(c => [...c]), [...coords3857[0]]];

      const polygon = new Polygon([closedRing]);
      const feature = new Feature({ geometry: polygon });
      source.addFeature(feature);

      sourceRef.current = source;
      layerRef.current = layer;
      featureRef.current = feature;

      // --- Modify interaction (drag vertices) ---
      const vertexStyle = new Style({
        image: new CircleStyle({
          radius: 7,
          fill: new FillCls({ color: '#D17B47' }),
          stroke: new StrokeCls({ color: '#FFFFFF', width: 2.5 }),
        }),
        text: new TextCls({
          text: '',
          offsetY: -16,
          fill: new FillCls({ color: '#1B3A5C' }),
          stroke: new StrokeCls({ color: '#FFFFFF', width: 3 }),
          font: 'bold 11px Calibri, sans-serif',
        }),
      });

      const modify = new Modify({
        source,
        style: vertexStyle,
      });

      // Listen for modifyend
      const handleModifyEnd = async () => {
        if (cancelled) return;
        const updated = await readVerticesFromFeature();
        onVerticesChangeRef.current(updated);
        setState(prev => ({
          ...prev,
          vertexCount: updated.length,
        }));
      };
      modify.on('modifyend', handleModifyEnd);

      map.addInteraction(modify);
      modifyRef.current = modify;

      // --- Snap interaction (magnetic snap to own vertices) ---
      let snap: import('ol/interaction/Snap').default | null = null;
      if (snapEnabled) {
        snap = new Snap({
          source,
          pixelTolerance: snapTolerance,
        });
        map.addInteraction(snap);
        snapRef.current = snap;
      }

      // --- Double-click: insert vertex on nearest edge ---
      const handleDblClick = async (evt: import('ol/MapBrowserEvent').default) => {
        evt.stopPropagation();
        if (cancelled) return;

        const coord = evt.coordinate as [number, number];
        const geom = feature.getGeometry() as OlPolygon;
        const ring = geom.getCoordinates()[0] as number[][];

        // Find nearest edge
        let minDist = Infinity;
        let bestIdx = -1;
        for (let i = 0; i < ring.length - 1; i++) {
          const d = pointToSegmentDist(coord, ring[i] as [number, number], ring[i + 1] as [number, number]);
          if (d < minDist) {
            minDist = d;
            bestIdx = i + 1;
          }
        }

        // Use a generous pixel-based threshold (30 px ≈ 30 m at zoom 16-18)
        const resolution = map.getView().getResolution() ?? 1;
        const threshold = resolution * 30;
        if (minDist > threshold) return;

        // Compute insertion point
        const segStart = ring[bestIdx - 1] as [number, number];
        const segEnd = ring[bestIdx] as [number, number];
        const insertPt = nearestPointOnSegment(coord, segStart, segEnd);

        // Insert into ring (before closing vertex)
        const newRing = [...ring.slice(0, bestIdx), insertPt, ...ring.slice(bestIdx)];
        geom.setCoordinates([newRing]);

        const updated = await readVerticesFromFeature();
        onVerticesChangeRef.current(updated);
        setState(prev => ({
          ...prev,
          vertexCount: updated.length,
          lastEditedVertex: updated[bestIdx]
            ? { ...updated[bestIdx], index: bestIdx }
            : prev.lastEditedVertex,
        }));
      };

      dblClickRef.current = handleDblClick;
      map.on('dblclick', handleDblClick);

      // --- Right-click (contextmenu): remove vertex (min 3) ---
      const handleContextMenu = async (evt: import('ol/MapBrowserEvent').default) => {
        evt.preventDefault();
        evt.stopPropagation();
        if (cancelled) return;

        const coord = evt.coordinate as [number, number];
        const geom = feature.getGeometry() as OlPolygon;
        const ring = geom.getCoordinates()[0] as number[][];

        if (ring.length - 1 <= 3) return; // need at least 3 unique vertices

        // Find nearest vertex (exclude closing vertex)
        let minDist = Infinity;
        let bestIdx = -1;
        for (let i = 0; i < ring.length - 1; i++) {
          const d = vertexDist(coord, ring[i] as [number, number]);
          if (d < minDist) {
            minDist = d;
            bestIdx = i;
          }
        }

        const resolution = map.getView().getResolution() ?? 1;
        const threshold = resolution * 15;
        if (minDist > threshold) return;

        // Remove vertex at bestIdx and rebuild closed ring
        const openRing = ring.slice(0, -1);
        openRing.splice(bestIdx, 1);
        const newRing = [...openRing, [...openRing[0]]];
        geom.setCoordinates([newRing]);

        const updated = await readVerticesFromFeature();
        onVerticesChangeRef.current(updated);
        setState(prev => ({
          ...prev,
          vertexCount: updated.length,
          lastEditedVertex: null,
        }));
      };

      contextMenuRef.current = handleContextMenu;
      (map as unknown as { on(type: string, listener: (e: import('ol/MapBrowserEvent').default) => void): void }).on('contextmenu', handleContextMenu);

      // --- Pointer move: detect hovered vertex for coordinate display ---
      const handlePointerMove = async (evt: import('ol/MapBrowserEvent').default) => {
        if (cancelled) return;

        const coord = evt.coordinate as [number, number];
        const geom = feature.getGeometry() as OlPolygon;
        if (!geom) return;

        const ring = geom.getCoordinates()[0] as number[][];
        let minDist = Infinity;
        let bestIdx = -1;
        for (let i = 0; i < ring.length - 1; i++) {
          const d = vertexDist(coord, ring[i] as [number, number]);
          if (d < minDist) {
            minDist = d;
            bestIdx = i;
          }
        }

        const resolution = map.getView().getResolution() ?? 1;
        const threshold = resolution * 15;

        if (minDist <= threshold && bestIdx >= 0) {
          const [x, y] = ring[bestIdx];
          const [e, n] = await to21037(x, y);
          setState(prev => ({
            ...prev,
            hoveredVertex: { easting: e, northing: n, index: bestIdx },
          }));
        } else {
          setState(prev =>
            prev.hoveredVertex ? { ...prev, hoveredVertex: null } : prev
          );
        }
      };

      pointerMoveRef.current = handlePointerMove;
      map.on('pointermove', handlePointerMove);

      // --- Add layer to map ---
      map.addLayer(layer);

      // --- Initial state ---
      setState({
        vertexCount: vertices.length,
        hoveredVertex: null,
        lastEditedVertex: null,
      });
    }

    setup();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, enabled, snapTolerance, snapEnabled, cleanup, readVerticesFromFeature]);

  // --- Public API ---
  return {
    state,
    cleanup,
    syncVertices,
  };
}
