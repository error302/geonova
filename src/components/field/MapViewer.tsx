'use client';
import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { MapLayer, FieldBeacon, FieldParcel, GeoPDFLayer, MBTilesSession } from '@/types/field';
import { logger } from '@/lib/logger'



export interface MapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetToKenya: () => void;
  fitToData: () => void;
  getView: () => { center: number[]; zoom: number } | null;
}

interface Props {
  layers: MapLayer[];
  beacons: FieldBeacon[];
  parcels: FieldParcel[];
  geoPDFLayers?: GeoPDFLayer[];
  mbtilesSessions?: MBTilesSession[];
  onMapClick?: (lat: number, lng: number) => void;
  onGPSUpdate?: (lat: number, lng: number, accuracy: number) => void;
  onPerimeterWalk?: () => void;
  gpsLocation?: { lat: number; lng: number } | null;
  gpsAccuracy?: number | null;
}

const MapViewer = forwardRef<MapHandle, Props>(function MapViewer(
  { layers, beacons, parcels, geoPDFLayers, mbtilesSessions, onMapClick, onGPSUpdate, onPerimeterWalk, gpsLocation, gpsAccuracy },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('ol/Map').default | null>(null);
  const kenyaCenterRef = useRef<number[]>([0, 0]);
  const gpsFeatureRef = useRef<import('ol/Feature').default | null>(null);
  const olHelpersRef = useRef<{ Point: typeof import('ol/geom/Point').default; fromLonLat: typeof import('ol/proj').fromLonLat } | null>(null);


  /* ---- Expose imperative handle to parent ---- */
  useImperativeHandle(ref, () => ({
    zoomIn() {
      const map = mapRef.current;
      if (!map) return;
      const view = map.getView();
      view.animate({ zoom: (view.getZoom() ?? 0) + 1, duration: 250 });
    },
    zoomOut() {
      const map = mapRef.current;
      if (!map) return;
      const view = map.getView();
      view.animate({ zoom: (view.getZoom() ?? 0) - 1, duration: 250 });
    },
    resetToKenya() {
      const map = mapRef.current;
      if (!map) return;
      const view = map.getView();
      view.animate({ center: kenyaCenterRef.current, zoom: 6, duration: 400 });
    },
    fitToData() {
      const map = mapRef.current;
      if (!map) return;
      const layers = map.getLayers().getArray();
      // Try beacon / parcel layers first, then geojson
      for (let i = layers.length - 1; i >= 0; i--) {
        const src = (layers[i] as import('ol/layer/Layer').default).getSource() as import('ol/source/Vector').default | null;
        if (src && typeof src.getFeatures === 'function' && src.getFeatures().length > 0) {
          const ext = src.getExtent();
          if (ext && ext[0] !== Infinity && ext[1] !== Infinity) {
            map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 17, duration: 400 });
            return;
          }
        }
      }
    },
    getView() {
      const map = mapRef.current;
      if (!map) return null;
      const v = map.getView();
      return { center: v.getCenter() ?? [], zoom: v.getZoom() ?? 6 };
    },
  }), []);

  /* ---- Stable callback refs so OL event handlers stay valid ---- */
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;

    async function initMap() {
      try {
        // Inject OpenLayers CSS via link tag (dynamic import of CSS crashes in Next.js)
        if (!document.querySelector('link[href*="ol/ol.css"]')) {
          try {
            await import('ol/ol.css');
          } catch {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/ol@10.8.0/ol.css';
            document.head.appendChild(link);
          }
        }

        // Import OpenLayers modules individually
        const { default: Map } = await import('ol/Map');
        const { default: View } = await import('ol/View');
        const { default: TileLayer } = await import('ol/layer/Tile');
        const { default: VectorLayer } = await import('ol/layer/Vector');
        const { default: OSM } = await import('ol/source/OSM');
        const { default: VectorSource } = await import('ol/source/Vector');
        const { default: GeoJSONFormat } = await import('ol/format/GeoJSON');
        const { default: Feature } = await import('ol/Feature');
        const { default: Point } = await import('ol/geom/Point');
        const { default: Polygon } = await import('ol/geom/Polygon');
        const { default: Style } = await import('ol/style/Style');
        const { default: CircleStyle } = await import('ol/style/Circle');
        const { default: Fill } = await import('ol/style/Fill');
        const { default: Stroke } = await import('ol/style/Stroke');
        const { default: TextStyle } = await import('ol/style/Text');
        const { fromLonLat, toLonLat } = await import('ol/proj');
        const { default: Attribution } = await import('ol/control/Attribution');
        const olControl = await import('ol/control');
        const defaultControls = olControl.defaults;

        olHelpersRef.current = { Point, fromLonLat };

        if (!mounted || !containerRef.current) return;

        // Cleanup previous map
        if (mapRef.current) {
          mapRef.current.setTarget(undefined);
          mapRef.current = null;
        }

        // Default center at Kenya
        const kenyaCenter = fromLonLat([37.91, 0.02]);
        kenyaCenterRef.current = kenyaCenter;

        // Base OSM tile layer
        const baseLayer = new TileLayer({ source: new OSM() });

        // GeoJSON vector layers (from imported KML/KMZ)
        const vectorLayers = layers
          .filter(l => l.visible && l.geojson)
          .map(l => {
            const features = new GeoJSONFormat().readFeatures(l.geojson, {
              dataProjection: 'EPSG:4326',
              featureProjection: 'EPSG:3857',
            });
            return new VectorLayer({
              source: new VectorSource({ features }),
              style: new Style({
                stroke: new Stroke({ color: '#3b82f6', width: 2 }),
                fill: new Fill({ color: 'rgba(59,130,246,0.1)' }),
              }),
            });
          });

        // Beacon point layer
        const beaconFeatures = beacons.map(b => {
          const f = new Feature({
            geometry: new Point(fromLonLat([b.coordinate.lng, b.coordinate.lat])),
          });
          f.set('label', b.label);
          return f;
        });

        const beaconLayer = new VectorLayer({
          source: new VectorSource({ features: beaconFeatures }),
          style: (feature) => new Style({
            image: new CircleStyle({
              radius: 8,
              fill: new Fill({ color: '#f59e0b' }),
              stroke: new Stroke({ color: '#ffffff', width: 2 }),
            }),
            text: new TextStyle({
              text: (feature.get('label') as string | undefined) || '',
              offsetY: -16,
              fill: new Fill({ color: '#f59e0b' }),
              stroke: new Stroke({ color: '#000', width: 3 }),
              font: 'bold 12px monospace',
            }),
          }),
        });

        // Parcel polygon layer
        const parcelFeatures = parcels
          .filter(p => p.walkPoints.length >= 3)
          .map(p => {
            const coords = p.walkPoints.map(wp =>
              fromLonLat([wp.coordinate.lng, wp.coordinate.lat])
            );
            coords.push(coords[0]);
            const f = new Feature({ geometry: new Polygon([coords]) });
            f.set('label', p.label);
            return f;
          });

        const parcelLayer = new VectorLayer({
          source: new VectorSource({ features: parcelFeatures }),
          style: new Style({
            stroke: new Stroke({ color: '#10b981', width: 2 }),
            fill: new Fill({ color: 'rgba(16,185,129,0.08)' }),
          }),
        });

        // GPS Layer
        const gpsFeature = new Feature();
        gpsFeatureRef.current = gpsFeature;
        
        const gpsLayer = new VectorLayer({
          source: new VectorSource({ features: [gpsFeature] }),
          style: (feature) => {
            const acc = (feature.get('accuracy') as number | undefined) || 10;
            let color = 'rgba(239,68,68,0.4)'; // Red (Single) > 3m
            let strokeColor = '#ef4444';
            
            if (acc <= 0.05) {
              color = 'rgba(16,185,129,0.4)'; // Green (Fixed)
              strokeColor = '#10b981';
            } else if (acc <= 3) {
              color = 'rgba(234,179,8,0.4)'; // Yellow (Float)
              strokeColor = '#eab308';
            }
            
            // Map accuracy in meters to roughly pixels for the circle
            // OL CircleStyle radius is in pixels. For a true physical cone, we'd use a Polygon.
            // But a dynamic styled circle based on zoom is acceptable here.
            const mapObj = mapRef.current;
            let radiusPx = 10;
            if (mapObj) {
              const res = mapObj.getView().getResolution() || 1;
              radiusPx = Math.max(5, acc / res);
            }

            return new Style({
              image: new CircleStyle({
                radius: radiusPx,
                fill: new Fill({ color }),
                stroke: new Stroke({ color: strokeColor, width: 2 }),
              })
            });
          }
        });

        const map = new Map({
          target: containerRef.current,
          layers: [baseLayer, ...vectorLayers, parcelLayer, beaconLayer, gpsLayer],
          view: new View({
            center: kenyaCenter,
            zoom: 6,
            minZoom: 6,
            maxZoom: 20,
            extent: [-2.2e7, -1.2e7, 2.2e7, 1.5e7],
          }),
          controls: defaultControls({ attribution: false }),
        });

        // Fit to data extent (if we have beacons or parcels)
        if (beaconFeatures.length > 0) {
          const src = beaconLayer.getSource();
          if (src) {
            const ext = src.getExtent();
            if (ext && ext[0] !== Infinity) {
              map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 17 });
            }
          }
        } else if (parcelFeatures.length > 0) {
          const src = parcelLayer.getSource();
          if (src) {
            const ext = src.getExtent();
            if (ext && ext[0] !== Infinity) {
              map.getView().fit(ext, { padding: [80, 80, 80, 80], maxZoom: 17 });
            }
          }
        }

        // Map click handler — uses ref for stable callback
        map.on('click', (e: import('ol/MapBrowserEvent').default) => {
          const cb = onMapClickRef.current;
          if (cb) {
            const [lng, lat] = toLonLat(e.coordinate);
            cb(lat, lng);
          }
        });

        // GeoPDF layers
        if (geoPDFLayers?.length) {
          const { buildOLGeoPDFLayer } = await import('@/lib/field/geopdf');
          geoPDFLayers.filter(g => g.visible && g.gcps.length === 4).forEach(g => {
            map.addLayer(buildOLGeoPDFLayer(g));
          });
        }

        // MBTiles layers
        if (mbtilesSessions?.length) {
          const { buildOLMBTilesLayer } = await import('@/lib/field/mbtiles');
          mbtilesSessions.forEach(s => {
            map.addLayer(buildOLMBTilesLayer(s));
          });
        }

        mapRef.current = map;
      } catch (err) {
        logger.error('[MapViewer] Init error:', { error: err });
      }
    }

    initMap();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }
    };
  }, [layers, beacons, parcels, geoPDFLayers, mbtilesSessions]);

  useEffect(() => {
    // Dynamic GPS update without re-initializing the whole map
    if (gpsFeatureRef.current && olHelpersRef.current) {
      const feature = gpsFeatureRef.current;
      const { Point, fromLonLat } = olHelpersRef.current;

      if (gpsLocation) {
        feature.setGeometry(new Point(fromLonLat([gpsLocation.lng, gpsLocation.lat])));
        feature.set('accuracy', gpsAccuracy || 10);
      } else {
        feature.setGeometry(undefined);
      }
    }
  }, [gpsLocation, gpsAccuracy]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      className="absolute inset-0"
    />
  );
});

MapViewer.displayName = 'MapViewer';
export default MapViewer;
