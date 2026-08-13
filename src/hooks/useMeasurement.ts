'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type Map from 'ol/Map';
import type VectorSource from 'ol/source/Vector';
import type VectorLayer from 'ol/layer/Vector';
import type { FeatureLike } from 'ol/Feature';
import {
  calculateDistance,
  calculateArea,
  calculateBearing,
  formatBearingWCB,
  formatDistance,
  formatArea,
  type Point,
} from '@/lib/map/measurements';

export type MeasurementMode = 'none' | 'distance' | 'area' | 'bearing' | 'coordinate';

export interface MeasurementState {
  mode: MeasurementMode;
  points: Point[];
  result: {
    distance?: number;
    area?: number;
    bearing?: number;
    coordinate?: Point;
  } | null;
  isActive: boolean;
}

export interface FormattedResult {
  type: string;
  raw: number;
  formatted: string;
}

export function useMeasurement(map: Map | null) {
  const [state, setState] = useState<MeasurementState>({
    mode: 'none',
    points: [],
    result: null,
    isActive: false,
  });
  
  const sourceRef = useRef<VectorSource | null>(null);
  const layerRef = useRef<VectorLayer | null>(null);
  const clickHandlerRef = useRef<((evt: import('ol/MapBrowserEvent').default) => void) | null>(null);
  const ctorsRef = useRef<{
    VectorSource: typeof VectorSource
    VectorLayer: typeof VectorLayer
    Feature: typeof import('ol/Feature').default
    OlPoint: typeof import('ol/geom/Point').default
    OlLineString: typeof import('ol/geom/LineString').default
    OlPolygon: typeof import('ol/geom/Polygon').default
  } | null>(null);

  const createLayer = useCallback(async () => {
    if (!map) return null;

    // Dynamic OL imports for SSR safety
    const [
      VectorSourceMod, VectorLayerMod, StyleMod, StrokeMod,
      FillMod, CircleMod, LineStringMod, PolygonMod, PointMod,
    ] = await Promise.all([
      import('ol/source/Vector'), import('ol/layer/Vector'),
      import('ol/style/Style'), import('ol/style/Stroke'),
      import('ol/style/Fill'), import('ol/style/Circle'),
      import('ol/geom/LineString'), import('ol/geom/Polygon'),
      import('ol/geom/Point'),
    ]);

    const VectorSource = VectorSourceMod.default;
    const VectorLayer = VectorLayerMod.default;
    const Style = StyleMod.default;
    const Stroke = StrokeMod.default;
    const Fill = FillMod.default;
    const Circle = CircleMod.default;
    const OlLineString = LineStringMod.default;
    const OlPolygon = PolygonMod.default;
    const OlPoint = PointMod.default;
    
    const source = new VectorSource();
    const layer = new VectorLayer({
      source,
      style: (feature: FeatureLike) => {
        const geometry = feature.getGeometry();
        
        if (geometry instanceof OlPoint) {
          return new Style({
            image: new Circle({
              radius: 6,
              fill: new Fill({ color: '#1B3A5C' }),
              stroke: new Stroke({ color: '#FFFFFF', width: 2 }),
            }),
          });
        } else if (geometry instanceof OlLineString) {
          return new Style({
            stroke: new Stroke({
              color: '#1B3A5C',
              width: 2,
            }),
          });
        } else if (geometry instanceof OlPolygon) {
          return new Style({
            stroke: new Stroke({
              color: '#1B3A5C',
              width: 2,
            }),
            fill: new Fill({
              color: 'rgba(27, 58, 92, 0.1)',
            }),
          });
        }
        
        return new Style({});
      },
      zIndex: 100,
    });
    
    map.addLayer(layer);
    sourceRef.current = source;
    layerRef.current = layer;

    // Store constructors for later use
    ctorsRef.current = { VectorSource, VectorLayer, Feature: (await import('ol/Feature')).default, OlPoint, OlLineString, OlPolygon };
    
    return { source, layer };
  }, [map]);

  const clearSource = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.clear();
    }
  }, []);

  const addPointToMap = useCallback(async (point: Point) => {
    if (!sourceRef.current) return;
    const { Feature, OlPoint } = ctorsRef.current || {};
    if (!Feature || !OlPoint) return;
    const feature = new Feature(new OlPoint([point.easting, point.northing]));
    feature.set('type', 'vertex');
    sourceRef.current.addFeature(feature);
  }, []);

  const addLineToMap = useCallback(async (points: Point[]) => {
    if (!sourceRef.current || points.length < 2) return;
    const { Feature, OlLineString } = ctorsRef.current || {};
    if (!Feature || !OlLineString) return;
    const coords = points.map(p => [p.easting, p.northing] as [number, number]);
    const feature = new Feature(new OlLineString(coords));
    feature.set('type', 'line');
    sourceRef.current.addFeature(feature);
  }, []);

  const addPolygonToMap = useCallback(async (points: Point[]) => {
    if (!sourceRef.current || points.length < 3) return;
    const { Feature, OlPolygon } = ctorsRef.current || {};
    if (!Feature || !OlPolygon) return;
    const coords = [...points.map(p => [p.easting, p.northing] as [number, number]), [points[0].easting, points[0].northing] as [number, number]];
    const feature = new Feature(new OlPolygon([coords]));
    feature.set('type', 'polygon');
    sourceRef.current.addFeature(feature);
  }, []);

  const handlePointClick = useCallback((point: Point, mode: MeasurementMode) => {
    setState((prev) => {
      const newPoints = [...prev.points, point];
      
      addPointToMap(point);
      
      let result: MeasurementState['result'] = null;
      
      if (mode === 'distance' && newPoints.length === 2) {
        const distance = calculateDistance(newPoints[0], newPoints[1]);
        result = { distance };
        addLineToMap(newPoints);
      } else if (mode === 'bearing' && newPoints.length === 2) {
        const bearing = calculateBearing(newPoints[0], newPoints[1]);
        result = { bearing };
        addLineToMap(newPoints);
      } else if (mode === 'coordinate') {
        result = { coordinate: point };
      } else if (mode === 'area' && newPoints.length >= 3) {
        addPolygonToMap(newPoints);
      }
      
      const isFinished = mode !== 'area' && newPoints.length >= 2;
      
      return {
        ...prev,
        points: newPoints,
        result: result || (mode === 'area' && newPoints.length >= 3 ? { area: calculateArea(newPoints) } : null),
        isActive: mode === 'area' || !isFinished,
      };
    });
  }, [addPointToMap, addLineToMap, addPolygonToMap]);

  const startMeasurement = useCallback(async (mode: MeasurementMode) => {
    if (!map) return;
    
    if (!sourceRef.current) {
      await createLayer();
    }
    
    clearSource();
    
    setState({
      mode,
      points: [],
      result: null,
      isActive: true,
    });

    const handleClick = (evt: import('ol/MapBrowserEvent').default) => {
      const coord = evt.coordinate;
      
      const point: Point = {
        easting: coord[0],
        northing: coord[1],
      };
      
      handlePointClick(point, mode);
    };
    
    clickHandlerRef.current = handleClick;
    map.on('click', handleClick);
  }, [map, createLayer, clearSource, handlePointClick]);

  const finishAreaMeasurement = useCallback(() => {
    if (state.points.length < 3) return;
    
    const area = calculateArea(state.points);
    addPolygonToMap(state.points);
    
    setState((prev) => ({
      ...prev,
      result: { area },
      isActive: false,
    }));
  }, [state.points, addPolygonToMap]);

  const cancelMeasurement = useCallback(() => {
    clearSource();
    
    if (map && clickHandlerRef.current) {
      map.un('click', clickHandlerRef.current);
      clickHandlerRef.current = null;
    }
    
    setState({
      mode: 'none',
      points: [],
      result: null,
      isActive: false,
    });
  }, [map, clearSource]);

  const clearMeasurement = useCallback(() => {
    clearSource();
    setState((prev) => ({
      ...prev,
      points: [],
      result: null,
    }));
  }, [clearSource]);

  const getFormattedResult = useCallback((): FormattedResult | null => {
    if (!state.result) return null;
    
    if (state.result.distance !== undefined) {
      return {
        type: 'distance',
        raw: state.result.distance,
        formatted: formatDistance(state.result.distance),
      };
    }
    
    if (state.result.area !== undefined) {
      return {
        type: 'area',
        raw: state.result.area,
        formatted: formatArea(state.result.area),
      };
    }
    
    if (state.result.bearing !== undefined) {
      return {
        type: 'bearing',
        raw: state.result.bearing,
        formatted: formatBearingWCB(state.result.bearing),
      };
    }
    
    if (state.result.coordinate) {
      return {
        type: 'coordinate',
        raw: 0,
        formatted: `E ${state.result.coordinate.easting.toFixed(3)}  N ${state.result.coordinate.northing.toFixed(3)}`,
      };
    }
    
    return null;
  }, [state.result]);

  // Clean up on unmount: remove layer and click handler from map
  useEffect(() => {
    return () => {
      if (map) {
        if (clickHandlerRef.current) {
          map.un('click', clickHandlerRef.current);
          clickHandlerRef.current = null;
        }
        if (layerRef.current) {
          map.removeLayer(layerRef.current);
          layerRef.current = null;
        }
        sourceRef.current = null;
      }
    };
  }, [map]);

  return {
    state,
    startMeasurement,
    finishAreaMeasurement,
    cancelMeasurement,
    clearMeasurement,
    getFormattedResult,
  };
}
