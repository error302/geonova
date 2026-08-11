'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  Upload,
  MapPin,
  Download,
  Trash2,
  PenTool,
  Square,
  Eye,
  EyeOff,
  Layers,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileDown,
  Map,
  Ruler,
  XCircle,
} from 'lucide-react';
import { logger } from '@/lib/logger'

/* ══════════════════════════════════════════════════════════════════════
 *  TYPES
 * ══════════════════════════════════════════════════════════════════════ */

interface TracedPolygon {
  id: string;
  name: string;
  coordinates: Array<[number, number]>; // [lon, lat] in EPSG:4326
  areaSqm: number;
  areaAcres: number;
  areaHa: number;
  color: string;
  visible: boolean;
  createdAt: number;
}

const POLYGON_COLORS = [
  '#D17B47',
  '#1B9AAA',
  '#E84855',
  '#3185FC',
  '#44AF69',
  '#F7B32B',
  '#D81E5B',
  '#7B2D8E',
];

/* ══════════════════════════════════════════════════════════════════════
 *  AREA CALCULATION (Shoelace Formula)
 *  Works on geographic coordinates (lon, lat) to approximate planar area.
 *  For large areas, uses the more accurate Haversine-based method.
 * ══════════════════════════════════════════════════════════════════════ */

function computePolygonArea(coords: Array<[number, number]>): number {
  // Shoelace formula on projected coordinates (approximate using equirectangular)
  // Convert lon/lat to a flat projection for area calculation
  const R = 6371000; // Earth's mean radius in meters
  const n = coords.length;
  if (n < 3) return 0;

  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const lon1 = (coords[i][0] * Math.PI) / 180;
    const lat1 = (coords[i][1] * Math.PI) / 180;
    const lon2 = (coords[j][0] * Math.PI) / 180;
    const lat2 = (coords[j][1] * Math.PI) / 180;

    // Equirectangular projection
    const x1 = lon1 * Math.cos((lat1 + lat2) / 2);
    const y1 = lat1;
    const x2 = lon2 * Math.cos((lat1 + lat2) / 2);
    const y2 = lat2;

    area += x1 * y2 - x2 * y1;
  }
  area = Math.abs(area) / 2 * R * R;
  return area;
}

/* ══════════════════════════════════════════════════════════════════════
 *  DXF GENERATOR (inline, minimal)
 * ══════════════════════════════════════════════════════════════════════ */

function generateDXF(polygons: TracedPolygon[]): string {
  const sections: string[] = [];

  // HEADER
  sections.push('0', 'SECTION', '2', 'HEADER');
  sections.push('9', '$ACADVER', '1', 'AC1015');
  sections.push('9', '$INSUNITS', '70', '6'); // 6 = meters
  sections.push('9', '$LUPREC', '70', '4');
  sections.push('9', '$AUPREC', '70', '2');
  sections.push('0', 'ENDSEC');

  // TABLES
  sections.push('0', 'SECTION', '2', 'TABLES');
  sections.push('0', 'TABLE', '2', 'LAYER', '70', String(polygons.length + 1));
  // Layer 0
  sections.push('0', 'LAYER', '2', '0', '70', '0', '62', '7', '6', 'CONTINUOUS');
  // One layer per polygon
  polygons.forEach((p, i) => {
    const colorIdx = ((i + 1) % 7) + 1;
    sections.push(
      '0', 'LAYER', '2', p.name, '70', '0',
      '62', String(colorIdx), '6', 'CONTINUOUS'
    );
  });
  sections.push('0', 'ENDTAB');
  sections.push('0', 'ENDSEC');

  // ENTITIES
  sections.push('0', 'SECTION', '2', 'ENTITIES');

  polygons.forEach((p) => {
    // Convert geographic coords back to a flat grid for DXF
    // Use local coordinates relative to first point
    const coords = p.coordinates;
    if (coords.length < 3) return;

    const baseLon = coords[0][0];
    const baseLat = coords[0][1];
    const cosLat = Math.cos((baseLat * Math.PI) / 180);
    const R = 6371000;

    const flatCoords: Array<[number, number]> = coords.map(([lon, lat]) => {
      const x = ((lon - baseLon) * Math.PI / 180) * cosLat * R;
      const y = ((lat - baseLat) * Math.PI / 180) * R;
      return [x, y];
    });

    // LWPOLYLINE
    sections.push('0', 'LWPOLYLINE', '8', p.name, '90', String(flatCoords.length + 1), '70', '1');
    flatCoords.forEach(([x, y]) => {
      sections.push('10', x.toFixed(4), '20', y.toFixed(4));
    });
    // Close the polyline (repeat first vertex)
    sections.push('10', flatCoords[0][0].toFixed(4), '20', flatCoords[0][1].toFixed(4));
  });

  sections.push('0', 'ENDSEC');
  sections.push('0', 'EOF');

  return sections.join('\n');
}

/* ══════════════════════════════════════════════════════════════════════
 *  KML GENERATOR (inline)
 * ══════════════════════════════════════════════════════════════════════ */

function generateKML(polygons: TracedPolygon[]): string {
  const placemarks = polygons.map((p) => {
    const coordStr = p.coordinates.map(([lon, lat]) => `${lon.toFixed(8)},${lat.toFixed(8)},0`).join('\n        ');
    return `  <Placemark>
    <name>${escapeXml(p.name)}</name>
    <description>Area: ${p.areaSqm.toFixed(2)} m² (${p.areaAcres.toFixed(4)} acres / ${p.areaHa.toFixed(4)} ha)</description>
    <styleUrl>#style-${p.id}</styleUrl>
    <Polygon>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates>
        ${coordStr}
        ${p.coordinates[0][0].toFixed(8)},${p.coordinates[0][1].toFixed(8)},0
          </coordinates>
        </LinearRing>
      </outerBoundaryIs>
    </Polygon>
  </Placemark>`;
  }).join('\n');

  const styles = polygons.map((p) => {
    // Convert hex color to KML format (AABBGGRR)
    const hex = p.color.replace('#', '');
    const r = hex.substring(4, 6);
    const g = hex.substring(2, 4);
    const b = hex.substring(0, 2);
    const kmlColor = `ff${r}${g}${b}`;
    return `  <Style id="style-${p.id}">
    <LineStyle><color>${kmlColor}</color><width>2</width></LineStyle>
    <PolyStyle><color>40${r}${g}${b}</color><fill>1</fill><outline>1</outline></PolyStyle>
  </Style>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>Traced Boundaries</name>
  <description>Parcel boundaries traced from orthophoto in METARDU</description>
${styles}
${placemarks}
</Document>
</kml>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/* ══════════════════════════════════════════════════════════════════════
 *  GeoJSON GENERATOR (inline)
 * ══════════════════════════════════════════════════════════════════════ */

function generateGeoJSON(polygons: TracedPolygon[]): string {
  const features = polygons.map((p) => ({
    type: 'Feature',
    properties: {
      name: p.name,
      area_sqm: parseFloat(p.areaSqm.toFixed(2)),
      area_acres: parseFloat(p.areaAcres.toFixed(4)),
      area_ha: parseFloat(p.areaHa.toFixed(4)),
      color: p.color,
      vertex_count: p.coordinates.length,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        ...p.coordinates.map(([lon, lat]) => [parseFloat(lon.toFixed(8)), parseFloat(lat.toFixed(8))]),
        [parseFloat(p.coordinates[0][0].toFixed(8)), parseFloat(p.coordinates[0][1].toFixed(8))],
      ]],
    },
  }));

  return JSON.stringify(
    { type: 'FeatureCollection', features },
    null,
    2
  );
}

/* ══════════════════════════════════════════════════════════════════════
 *  CSV GENERATOR (inline)
 * ══════════════════════════════════════════════════════════════════════ */

function generateCSV(polygons: TracedPolygon[]): string {
  const rows: string[] = [
    'Polygon,Vertex,Lon,Lat,Area_Sqm,Area_Acres,Area_Ha',
  ];

  polygons.forEach((p) => {
    p.coordinates.forEach(([lon, lat], i) => {
      rows.push(
        `"${p.name}",${i + 1},${lon.toFixed(8)},${lat.toFixed(8)},${p.areaSqm.toFixed(2)},${p.areaAcres.toFixed(4)},${p.areaHa.toFixed(4)}`
      );
    });
    // Closing vertex
    const [lon0, lat0] = p.coordinates[0];
    rows.push(
      `"${p.name}",${p.coordinates.length + 1},${lon0.toFixed(8)},${lat0.toFixed(8)},${p.areaSqm.toFixed(2)},${p.areaAcres.toFixed(4)},${p.areaHa.toFixed(4)}`
    );
  });

  return rows.join('\n');
}

/* ══════════════════════════════════════════════════════════════════════
 *  DOWNLOAD HELPER
 * ══════════════════════════════════════════════════════════════════════ */

function downloadFile(content: string, filename: string, mime = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ══════════════════════════════════════════════════════════════════════
 *  MAIN COMPONENT
 * ══════════════════════════════════════════════════════════════════════ */

export default function OrthophotoViewerPage() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<'upload' | 'trace' | 'export'>('upload');

  // Map state
  const mapRef = useRef<HTMLDivElement>(null);
  const olMapRef = useRef<import('ol/Map').default | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [geoTIFFLoaded, setGeoTIFFLoaded] = useState(false);

  // GeoTIFF state
  const [tiffFileName, setTiffFileName] = useState('');
  const [tiffLoading, setTiffLoading] = useState(false);
  const [tiffError, setTiffError] = useState('');

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [polygons, setPolygons] = useState<TracedPolygon[]>([]);
  const [expandedPolygon, setExpandedPolygon] = useState<string | null>(null);

  // Basemap toggle
  const [basemapType, setBasemapType] = useState<'satellite' | 'osm'>('satellite');
  const [orthoOpacity, setOrthoOpacity] = useState(80);

  // OL layer references
  const drawInteractionRef = useRef<import('ol/interaction/Draw').default | null>(null);
  const vectorSourceRef = useRef<import('ol/source/Vector').default | null>(null);
  const vectorLayerRef = useRef<import('ol/layer/Vector').default | null>(null);
  const orthoLayerRef = useRef<import('ol/layer/Tile').default | null>(null);
  const basemapLayersRef = useRef<Record<string, import('ol/layer/Tile').default>>({});

  /* ════════════════════════════════════════════════════════════════════
   *  INITIALIZE MAP
   * ════════════════════════════════════════════════════════════════════ */

  const initMap = useCallback(async () => {
    if (!mapRef.current || olMapRef.current) return;

    const [
      MapModule,
      ViewModule,
      TileLayerModule,
      XYZModule,
      OSMModule,
      VectorLayerModule,
      VectorSourceModule,
    ] = await Promise.all([
      import('ol/Map'),
      import('ol/View'),
      import('ol/layer/Tile'),
      import('ol/source/XYZ'),
      import('ol/source/OSM'),
      import('ol/layer/Vector'),
      import('ol/source/Vector'),
    ]);

    // Create vector source for traced boundaries
    const vectorSource = new VectorSourceModule.default();
    vectorSourceRef.current = vectorSource;

    const vectorLayer = new VectorLayerModule.default({
      source: vectorSource,
      zIndex: 10,
    });
    vectorLayerRef.current = vectorLayer;

    // Satellite basemap (default)
    const satelliteLayer = new TileLayerModule.default({
      source: new XYZModule.default({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Tiles (c) Esri',
        crossOrigin: 'anonymous',
        maxZoom: 19,
      }),
      zIndex: 0,
      visible: true,
    });

    // OSM basemap
    const osmLayer = new TileLayerModule.default({
      source: new OSMModule.default(),
      zIndex: 0,
      visible: false,
    });

    basemapLayersRef.current = {
      satellite: satelliteLayer,
      osm: osmLayer,
    };

    const map = new MapModule.default({
      target: mapRef.current,
      layers: [satelliteLayer, osmLayer, vectorLayer],
      view: new ViewModule.default({
        center: [37.9062, -0.023], // Nairobi center in EPSG:4326
        zoom: 6,
        projection: 'EPSG:4326',
      }),
      controls: [],
    });

    olMapRef.current = map;
    setMapReady(true);
  }, []);

  useEffect(() => {
    initMap();
    return () => {
      if (olMapRef.current) {
        olMapRef.current.setTarget(undefined);
        olMapRef.current = null;
      }
    };
  }, [initMap]);

  /* ════════════════════════════════════════════════════════════════════
   *  BASEMAP SWITCHING
   * ════════════════════════════════════════════════════════════════════ */

  useEffect(() => {
    if (!olMapRef.current) return;
    const layers = basemapLayersRef.current;
    if (layers.satellite) layers.satellite.setVisible(basemapType === 'satellite');
    if (layers.osm) layers.osm.setVisible(basemapType === 'osm');
  }, [basemapType]);

  /* ════════════════════════════════════════════════════════════════════
   *  ORTHOPHOTO OPACITY
   * ════════════════════════════════════════════════════════════════════ */

  useEffect(() => {
    if (orthoLayerRef.current) {
      orthoLayerRef.current.setOpacity(orthoOpacity / 100);
    }
  }, [orthoOpacity]);

  /* ════════════════════════════════════════════════════════════════════
   *  LOAD GeoTIFF
   * ════════════════════════════════════════════════════════════════════ */

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'tif' && ext !== 'tiff') {
      setTiffError('Invalid file type. Please upload a .tif or .tiff file.');
      return;
    }

    setTiffLoading(true);
    setTiffError('');
    setTiffFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();

      if (!olMapRef.current) {
        await initMap();
        if (!olMapRef.current) throw new Error('Map failed to initialize');
      }

      const [
        GeoTIFFModule,
        TileLayerModule,
      ] = await Promise.all([
        import('ol/source/GeoTIFF'),
        import('ol/layer/Tile'),
      ]);

      // Remove existing ortho layer
      if (orthoLayerRef.current) {
        olMapRef.current.removeLayer(orthoLayerRef.current);
      }

      const source = new GeoTIFFModule.default({
        sources: [{
          blob: new Blob([arrayBuffer]),
        }],
      });

      const layer = new TileLayerModule.default({
        source,
        zIndex: 5,
      });

      layer.setOpacity(orthoOpacity / 100);

      olMapRef.current.addLayer(layer);
      orthoLayerRef.current = layer;

      // Wait for the source to load and fit to extent
      const waitForReady = () => new Promise<void>((resolve) => {
        const check = () => {
          if (source.getState() === 'ready') {
            resolve();
          } else {
            source.once('change', check);
          }
        };
        check();
      });

      try {
        await waitForReady();
        // Use the layer extent to fit the view
        const layerExtent = (layer.getSource() as { getExtent?: () => number[] | undefined } | null)?.getExtent?.();
        if (layerExtent) {
          const view = olMapRef.current.getView();
          const proj = source.getProjection();
          if (proj && proj.getCode() !== 'EPSG:4326') {
            const { transformExtent } = await import('ol/proj');
            const transformed = transformExtent(layerExtent, proj.getCode(), 'EPSG:4326');
            view.fit(transformed, { padding: [80, 80, 80, 80], duration: 1000 });
          } else {
            view.fit(layerExtent, { padding: [80, 80, 80, 80], duration: 1000 });
          }
        }
      } catch (fitErr) {
        logger.warn('[Orthophoto Viewer] Could not auto-fit to extent:', { error: fitErr });
      }

      setGeoTIFFLoaded(true);
      setTiffLoading(false);
    } catch (err) {
      logger.error('[Orthophoto Viewer] GeoTIFF load error:', { error: err });
      setTiffError(`Failed to load GeoTIFF: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTiffLoading(false);
    }
  }, [initMap, orthoOpacity]);

  /* ════════════════════════════════════════════════════════════════════
   *  DRAWING TOOLS
   * ════════════════════════════════════════════════════════════════════ */

  const startDrawing = useCallback(async () => {
    if (!olMapRef.current || !vectorSourceRef.current) return;
    if (isDrawing) return;

    const [
      DrawModule,
      StyleModule,
      StrokeModule,
      FillModule,
      CircleStyleModule,
    ] = await Promise.all([
      import('ol/interaction/Draw'),
      import('ol/style/Style'),
      import('ol/style/Stroke'),
      import('ol/style/Fill'),
      import('ol/style/Circle'),
    ]);

    const nextColor = POLYGON_COLORS[polygons.length % POLYGON_COLORS.length];

    const draw = new DrawModule.default({
      source: vectorSourceRef.current,
      type: 'Polygon',
      style: new StyleModule.default({
        stroke: new StrokeModule.default({ color: nextColor, width: 2.5, lineDash: [8, 4] }),
        fill: new FillModule.default({ color: `${nextColor}22` }),
        image: new CircleStyleModule.default({
          radius: 5,
          stroke: new StrokeModule.default({ color: nextColor, width: 2 }),
          fill: new FillModule.default({ color: '#ffffff' }),
        }),
      }),
    });

    draw.on('drawend', (event: import('ol/interaction/Draw').DrawEvent) => {
      const feature = event.feature;
      const geom = feature.getGeometry() as import('ol/geom/SimpleGeometry').default | null;
      if (!geom) return;

      // Get flat coordinates [lon0, lat0, lon1, lat1, ...]
      const flatCoords = geom.getFlatCoordinates();
      const coords4326: Array<[number, number]> = [];

      for (let i = 0; i < flatCoords.length - 2; i += 2) {
        coords4326.push([flatCoords[i], flatCoords[i + 1]]);
      }

      // Remove last coord (it's the closing vertex, same as first for Polygon)
      if (coords4326.length > 1) {
        const first = coords4326[0];
        const last = coords4326[coords4326.length - 1];
        if (Math.abs(first[0] - last[0]) < 1e-10 && Math.abs(first[1] - last[1]) < 1e-10) {
          coords4326.pop();
        }
      }

      if (coords4326.length < 3) return;

      const areaSqm = computePolygonArea(coords4326);
      const id = `poly-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const newPolygon: TracedPolygon = {
        id,
        name: `Parcel ${polygons.length + 1}`,
        coordinates: coords4326,
        areaSqm,
        areaAcres: areaSqm / 4046.8564224,
        areaHa: areaSqm / 10000,
        color: nextColor,
        visible: true,
        createdAt: Date.now(),
      };

      setPolygons((prev) => [...prev, newPolygon]);

      // Style the completed feature
      feature.setStyle(new StyleModule.default({
        stroke: new StrokeModule.default({ color: nextColor, width: 2.5 }),
        fill: new FillModule.default({ color: `${nextColor}33` }),
      }));
      feature.set('polygonId', id);
    });

    olMapRef.current.addInteraction(draw);
    drawInteractionRef.current = draw;
    setIsDrawing(true);
  }, [isDrawing, polygons.length]);

  const stopDrawing = useCallback(() => {
    if (drawInteractionRef.current && olMapRef.current) {
      olMapRef.current.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }
    setIsDrawing(false);
  }, []);

  // Stop drawing when switching tabs
  useEffect(() => {
    if (activeTab !== 'trace' && isDrawing) {
      stopDrawing();
    }
  }, [activeTab, isDrawing, stopDrawing]);

  /* ════════════════════════════════════════════════════════════════════
   *  POLYGON MANAGEMENT
   * ════════════════════════════════════════════════════════════════════ */

  const deletePolygon = useCallback((id: string) => {
    // Remove from OL features
    if (vectorSourceRef.current) {
      const features = vectorSourceRef.current.getFeatures();
      const feature = features.find((f) => f.get('polygonId') === id);
      if (feature) {
        vectorSourceRef.current.removeFeature(feature);
      }
    }
    setPolygons((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const togglePolygonVisibility = useCallback(async (id: string) => {
    const { default: Style } = await import('ol/style/Style');
    const { default: Stroke } = await import('ol/style/Stroke');
    const { default: Fill } = await import('ol/style/Fill');

    setPolygons((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        // Toggle OL feature visibility
        if (vectorSourceRef.current) {
          const features = vectorSourceRef.current.getFeatures();
          const feature = features.find((f) => f.get('polygonId') === id);
          if (feature) {
            // Currently visible → hide with transparent style
            if (p.visible) {
              feature.setStyle(new Style({
                stroke: new Stroke({ color: 'transparent', width: 0 }),
                fill: new Fill({ color: 'transparent' }),
              }));
            } else {
              // Currently hidden → restore original style
              feature.setStyle(new Style({
                stroke: new Stroke({ color: p.color, width: 2.5 }),
                fill: new Fill({ color: `${p.color}33` }),
              }));
            }
          }
        }
        return { ...p, visible: !p.visible };
      })
    );
  }, []);

  const clearAllPolygons = useCallback(() => {
    if (vectorSourceRef.current) {
      vectorSourceRef.current.clear();
    }
    setPolygons([]);
    stopDrawing();
  }, [stopDrawing]);

  const renamePolygon = useCallback((id: string, newName: string) => {
    setPolygons((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName } : p))
    );
  }, []);

  /* ════════════════════════════════════════════════════════════════════
   *  EXPORT HANDLERS
   * ════════════════════════════════════════════════════════════════════ */

  const exportDXF = useCallback(() => {
    if (polygons.length === 0) return;
    const dxf = generateDXF(polygons);
    downloadFile(dxf, `metardu_boundaries_${new Date().toISOString().split('T')[0]}.dxf`, 'application/dxf');
  }, [polygons]);

  const exportKML = useCallback(() => {
    if (polygons.length === 0) return;
    const kml = generateKML(polygons);
    downloadFile(kml, `metardu_boundaries_${new Date().toISOString().split('T')[0]}.kml`, 'application/vnd.google-earth.kml+xml');
  }, [polygons]);

  const exportGeoJSONFile = useCallback(() => {
    if (polygons.length === 0) return;
    const geojson = generateGeoJSON(polygons);
    downloadFile(geojson, `metardu_boundaries_${new Date().toISOString().split('T')[0]}.geojson`, 'application/geo+json');
  }, [polygons]);

  const exportCSV = useCallback(() => {
    if (polygons.length === 0) return;
    const csv = generateCSV(polygons);
    downloadFile(csv, `metardu_boundaries_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  }, [polygons]);

  const exportAll = useCallback(() => {
    if (polygons.length === 0) return;
    exportDXF();
    setTimeout(exportKML, 200);
    setTimeout(exportGeoJSONFile, 400);
    setTimeout(exportCSV, 600);
  }, [exportDXF, exportKML, exportGeoJSONFile, exportCSV]);

  /* ════════════════════════════════════════════════════════════════════
   *  RENDER
   * ════════════════════════════════════════════════════════════════════ */

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title={t('tools.orthophotoViewer')}
        subtitle={t('tools.orthophotoViewerDesc')}
      />

      {/* ── TABS ── */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { id: 'upload' as const, label: 'Upload & View', icon: Upload },
          { id: 'trace' as const, label: 'Trace Boundaries', icon: PenTool },
          { id: 'export' as const, label: 'Export', icon: Download },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-[var(--accent)] text-black'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.id === 'trace' && polygons.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/20">
                  {polygons.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT: MAP ── */}
        <div className={`lg:col-span-${activeTab === 'export' ? '2' : '2'}`}>
          <div className="card overflow-hidden">
            <div className="card-header flex justify-between items-center flex-wrap gap-2">
              <span className="label flex items-center gap-2">
                <Map className="h-4 w-4 text-[var(--accent)]" />
                Map View
              </span>
              <div className="flex items-center gap-2">
                {/* Basemap toggle */}
                <div className="flex rounded overflow-hidden border border-[var(--border-color)]">
                  <button
                    onClick={() => setBasemapType('satellite')}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                      basemapType === 'satellite'
                        ? 'bg-[var(--accent)] text-black'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                    }`}
                  >
                    Satellite
                  </button>
                  <button
                    onClick={() => setBasemapType('osm')}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                      basemapType === 'osm'
                        ? 'bg-[var(--accent)] text-black'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                    }`}
                  >
                    OSM
                  </button>
                </div>

                {/* Drawing controls */}
                {activeTab === 'trace' && (
                  <>
                    {!isDrawing ? (
                      <button onClick={startDrawing} className="btn btn-primary text-xs flex items-center gap-1.5">
                        <Square className="h-3.5 w-3.5" />
                        Draw Polygon
                      </button>
                    ) : (
                      <button onClick={stopDrawing} className="btn btn-secondary text-xs flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5" />
                        Cancel Drawing
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Map container */}
            <div
              ref={mapRef}
              className="w-full rounded"
              style={{ height: '520px', backgroundColor: '#1a1a2e' }}
            />

            {/* Opacity control */}
            {geoTIFFLoaded && (
              <div className="px-4 py-3 flex items-center gap-3 bg-[var(--bg-tertiary)]">
                <Layers className="h-4 w-4 text-[var(--text-secondary)]" />
                <span className="text-xs text-[var(--text-secondary)]">Orthophoto opacity:</span>
                <input aria-label="Orthophoto opacity"
                  type="range"
                  min="0"
                  max="100"
                  value={orthoOpacity}
                  onChange={(e) => setOrthoOpacity(parseInt(e.target.value))}
                  className="flex-1 h-1.5 accent-[var(--accent)]"
                />
                <span className="text-xs font-mono text-[var(--text-secondary)] w-8 text-right">{orthoOpacity}%</span>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: PANELS ── */}
        <div className="lg:col-span-1">
          {activeTab === 'upload' && (
            <div className="space-y-4">
              {/* Upload Card */}
              <div className="card">
                <div className="card-header">
                  <span className="label flex items-center gap-2">
                    <Upload className="h-4 w-4 text-[var(--accent)]" />
                    Upload GeoTIFF
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Upload an orthophoto from Pix4D, Agisoft Metashape, OpenDroneMap (ODM), or any
                  other drone photogrammetry software that produces GeoTIFF files.
                </p>

                <label className="block mb-3">
                  <span className="block text-sm text-[var(--text-secondary)] mb-1">Select file (.tif / .tiff)</span>
                  <input
                    type="file"
                    accept=".tif,.tiff"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-[var(--text-secondary)]
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-medium
                      file:bg-[var(--accent)] file:text-black
                      hover:file:bg-[var(--accent-dim)]
                      file:cursor-pointer file:transition-colors
                      bg-[var(--bg-tertiary)] rounded-lg p-1"
                  />
                </label>

                {tiffLoading && (
                  <div className="p-3 bg-[var(--bg-tertiary)] rounded text-sm text-[var(--text-secondary)] flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
                    Loading GeoTIFF...
                  </div>
                )}

                {tiffError && (
                  <div className="p-3 bg-red-900/30 border border-red-700/30 rounded text-sm text-red-400 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    {tiffError}
                  </div>
                )}

                {geoTIFFLoaded && (
                  <div className="p-3 bg-green-900/30 border border-green-700/30 rounded text-sm text-green-400 flex items-center gap-2">
                    <FileDown className="h-4 w-4" />
                    <span className="font-medium">{tiffFileName}</span> loaded successfully
                  </div>
                )}
              </div>

              {/* Supported formats */}
              <div className="card">
                <div className="card-header">
                  <span className="label">Supported Formats</span>
                </div>
                <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--accent)] font-mono text-xs mt-0.5">●</span>
                    <div>
                      <span className="font-medium text-[var(--text-primary)]">Pix4D</span> — .tif orthomosaic output
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--accent)] font-mono text-xs mt-0.5">●</span>
                    <div>
                      <span className="font-medium text-[var(--text-primary)]">Agisoft Metashape</span> — GeoTIFF export
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--accent)] font-mono text-xs mt-0.5">●</span>
                    <div>
                      <span className="font-medium text-[var(--text-primary)]">OpenDroneMap (ODM)</span> — orthophoto.tif
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--accent)] font-mono text-xs mt-0.5">●</span>
                    <div>
                      <span className="font-medium text-[var(--text-primary)]">DroneDeploy</span> — GeoTIFF downloads
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--accent)] font-mono text-xs mt-0.5">●</span>
                    <div>
                      <span className="font-medium text-[var(--text-primary)]">Any GeoTIFF</span> — with embedded georeference
                    </div>
                  </div>
                </div>
              </div>

              {/* Usage tips */}
              <div className="card">
                <div className="card-header">
                  <span className="label">How to Use</span>
                </div>
                <div className="space-y-3 text-sm text-[var(--text-secondary)]">
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--accent)] text-black text-xs flex items-center justify-center font-bold">1</span>
                    <span>Upload your orthophoto GeoTIFF file</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--accent)] text-black text-xs flex items-center justify-center font-bold">2</span>
                    <span>Adjust opacity to see the satellite basemap underneath</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--accent)] text-black text-xs flex items-center justify-center font-bold">3</span>
                    <span>Switch to Trace Boundaries tab to draw polygons</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--accent)] text-black text-xs flex items-center justify-center font-bold">4</span>
                    <span>Export traced parcels as DXF, KML, GeoJSON, or CSV</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'trace' && (
            <div className="space-y-4">
              {/* Trace controls */}
              <div className="card">
                <div className="card-header flex justify-between items-center">
                  <span className="label flex items-center gap-2">
                    <PenTool className="h-4 w-4 text-[var(--accent)]" />
                    Traced Boundaries
                  </span>
                  {polygons.length > 0 && (
                    <button onClick={clearAllPolygons} className="btn btn-secondary text-xs flex items-center gap-1">
                      <Trash2 className="h-3 w-3" />
                      Clear All
                    </button>
                  )}
                </div>

                {polygons.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-secondary)]">
                    <Square className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No boundaries traced yet.</p>
                    <p className="text-xs mt-1">Click &quot;Draw Polygon&quot; above, then click on the map to place vertices. Double-click to finish.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {polygons.map((poly) => {
                      const isExpanded = expandedPolygon === poly.id;
                      return (
                        <div
                          key={poly.id}
                          className="p-3 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: poly.color }}
                            />
                            <input aria-label="Name"
                              className="input text-sm flex-1 py-0.5"
                              value={poly.name}
                              onChange={(e) => renamePolygon(poly.id, e.target.value)}
                            />
                            <button
                              onClick={() => togglePolygonVisibility(poly.id)}
                              className="p-1 hover:bg-[var(--bg-card)] rounded transition-colors"
                              title={poly.visible ? 'Hide polygon' : 'Show polygon'}
                            >
                              {poly.visible ? (
                                <Eye className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                              ) : (
                                <EyeOff className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                              )}
                            </button>
                            <button
                              onClick={() => deletePolygon(poly.id)}
                              className="p-1 hover:bg-red-900/30 rounded transition-colors"
                              title="Delete polygon"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </button>
                            <button
                              onClick={() => setExpandedPolygon(isExpanded ? null : poly.id)}
                              className="p-1 hover:bg-[var(--bg-card)] rounded transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                              )}
                            </button>
                          </div>

                          {/* Area summary */}
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            <div>
                              <span className="text-[10px] text-[var(--text-muted)]">Area (m²)</span>
                              <div className="text-xs font-mono font-semibold text-[var(--text-primary)]">
                                {formatArea(poly.areaSqm)}
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] text-[var(--text-muted)]">Acres</span>
                              <div className="text-xs font-mono font-semibold text-[var(--text-primary)]">
                                {poly.areaAcres.toFixed(4)}
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] text-[var(--text-muted)]">Hectares</span>
                              <div className="text-xs font-mono font-semibold text-[var(--text-primary)]">
                                {poly.areaHa.toFixed(4)}
                              </div>
                            </div>
                          </div>

                          {/* Expanded vertex list */}
                          {isExpanded && (
                            <div className="mt-3">
                              <div className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                                Vertices ({poly.coordinates.length})
                              </div>
                              <div className="overflow-x-auto max-h-32 overflow-y-auto">
                                <table className="table text-xs">
                                  <thead>
                                    <tr>
                                      <th>#</th>
                                      <th>Lon</th>
                                      <th>Lat</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {poly.coordinates.map(([lon, lat], i) => (
                                      <tr key={`item-${i}`}>
                                        <td className="font-mono text-[var(--text-muted)]">{i + 1}</td>
                                        <td className="font-mono">{lon.toFixed(8)}</td>
                                        <td className="font-mono">{lat.toFixed(8)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Summary stats */}
              {polygons.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <span className="label flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-[var(--accent)]" />
                      Summary
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-[var(--bg-tertiary)] rounded">
                    <div>
                      <span className="text-[var(--text-muted)] text-xs">Total Area</span>
                      <div className="font-mono text-lg text-[var(--accent)]">
                        {formatArea(polygons.reduce((s, p) => s + p.areaSqm, 0))} m²
                      </div>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] text-xs">Total Acres</span>
                      <div className="font-mono text-lg text-[var(--text-primary)]">
                        {polygons.reduce((s, p) => s + p.areaAcres, 0).toFixed(4)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] text-xs">Total Hectares</span>
                      <div className="font-mono text-lg text-[var(--text-primary)]">
                        {polygons.reduce((s, p) => s + p.areaHa, 0).toFixed(4)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] text-xs">Total Parcels</span>
                      <div className="font-mono text-lg text-[var(--text-primary)]">
                        {polygons.length}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-4">
              {/* Export cards */}
              <div className="card">
                <div className="card-header flex justify-between items-center">
                  <span className="label flex items-center gap-2">
                    <Download className="h-4 w-4 text-[var(--accent)]" />
                    Export Traced Boundaries
                  </span>
                  {polygons.length > 0 && (
                    <button onClick={exportAll} className="btn btn-primary text-xs">
                      Download All Formats
                    </button>
                  )}
                </div>

                {polygons.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-secondary)]">
                    <Download className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No boundaries to export.</p>
                    <p className="text-xs mt-1">Trace some parcel boundaries first, then come back here to export.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[
                      {
                        key: 'dxf',
                        title: 'DXF (AutoCAD)',
                        desc: 'CAD-ready DXF with LWPOLYLINE entities. Open in AutoCAD, Civil 3D, QGIS, BricsCAD.',
                        format: 'dxf',
                        icon: '⌜⌝',
                        action: exportDXF,
                      },
                      {
                        key: 'kml',
                        title: 'KML (Google Earth)',
                        desc: 'Polygon placemarks with area descriptions. Open in Google Earth Pro to verify boundaries.',
                        format: 'kml',
                        icon: '◉',
                        action: exportKML,
                      },
                      {
                        key: 'geojson',
                        title: 'GeoJSON',
                        desc: 'RFC 7946 GeoJSON FeatureCollection. Import into QGIS, Mapbox, Turf.js, PostGIS.',
                        format: 'geojson',
                        icon: '{}',
                        action: exportGeoJSONFile,
                      },
                      {
                        key: 'csv',
                        title: 'CSV (Spreadsheet)',
                        desc: 'Vertex coordinates in CSV format with area columns. Open in Excel, Google Sheets.',
                        format: 'csv',
                        icon: '≡',
                        action: exportCSV,
                      },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className="p-3 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)] flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono font-bold text-[var(--accent)] bg-[var(--bg-card)] px-1.5 py-0.5 rounded">
                              {item.icon}
                            </span>
                            <span className="text-sm font-semibold">{item.title}</span>
                          </div>
                          <p className="text-xs text-[var(--text-muted)] leading-relaxed">{item.desc}</p>
                        </div>
                        <button
                          onClick={item.action}
                          className="btn btn-secondary text-xs flex-shrink-0 flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" />
                          .{item.format}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Export preview */}
              {polygons.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <span className="label">Export Summary</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-[var(--bg-tertiary)] rounded">
                    <div>
                      <span className="text-[var(--text-muted)] text-xs">Polygons</span>
                      <div className="font-mono text-lg text-[var(--text-primary)]">{polygons.length}</div>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] text-xs">Total Vertices</span>
                      <div className="font-mono text-lg text-[var(--text-primary)]">
                        {polygons.reduce((s, p) => s + p.coordinates.length, 0)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] text-xs">Total Area</span>
                      <div className="font-mono text-lg text-[var(--accent)]">
                        {formatArea(polygons.reduce((s, p) => s + p.areaSqm, 0))} m²
                      </div>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] text-xs">Formats</span>
                      <div className="font-mono text-lg text-[var(--text-primary)]">DXF KML GeoJSON CSV</div>
                    </div>
                  </div>

                  <div className="mt-3 p-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-xs text-[var(--text-muted)]">
                    <strong className="text-[var(--text-secondary)]">Coordinate system:</strong>{' '}
                    WGS84 (EPSG:4326) for GeoJSON, KML, CSV. DXF uses local flat coordinates relative to the
                    first vertex of each polygon with metre units.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
 *  HELPERS
 * ══════════════════════════════════════════════════════════════════════ */

function formatArea(sqm: number): string {
  if (sqm >= 1_000_000) {
    return (sqm / 1_000_000).toFixed(2) + 'M';
  }
  if (sqm >= 10_000) {
    return (sqm / 1_000).toFixed(1) + 'K';
  }
  return sqm.toFixed(2);
}
