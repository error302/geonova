'use client';

import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Draw } from 'ol/interaction';
import { fromLonLat, toLonLat } from 'ol/proj';
import { getArea } from 'ol/sphere';
import type { Polygon } from 'ol/geom';

interface BoundarySelectorMapProps {
  onBoundaryChange: (polygonCoordinates: number[][], areaSqm: number, centerLonLat: [number, number]) => void;
  className?: string;
}

export function BoundarySelectorMap({ onBoundaryChange, className = '' }: BoundarySelectorMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapObj, setMapObj] = useState<Map | null>(null);

  // Inject OpenLayers CSS dynamically (a static `import 'ol/ol.css'` breaks
  // Next.js static export — same pattern as src/components/field/MapViewer.tsx).
  useEffect(() => {
    if (!document.querySelector('link[href*="ol/ol.css"]')) {
      try {
        void import('ol/ol.css' as any)
      } catch {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://cdn.jsdelivr.net/npm/ol@10.8.0/ol.css'
        document.head.appendChild(link)
      }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || mapObj) return;

    // Source for drawn polygon
    const source = new VectorSource({ wrapX: false });
    
    // Vector layer for polygon
    const vector = new VectorLayer({
      source: source,
      style: {
        'fill-color': 'rgba(255, 165, 0, 0.2)',
        'stroke-color': '#ff9800',
        'stroke-width': 2,
        'circle-radius': 5,
        'circle-fill-color': '#ff9800',
      },
    });

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        vector,
      ],
      view: new View({
        center: fromLonLat([36.8219, -1.2921]), // Default to Nairobi
        zoom: 12,
      }),
    });

    // Drawing interaction
    const draw = new Draw({
      source: source,
      type: 'Polygon',
    });

    draw.on('drawstart', () => {
      // Clear previous drawing
      source.clear();
    });

    draw.on('drawend', (e) => {
      const geometry = e.feature.getGeometry() as Polygon;
      
      // Calculate area in square meters (geodesic)
      const areaSqm = getArea(geometry);

      // Get center point (for UTM zone extraction)
      const extent = geometry.getExtent();
      const center = [
        (extent[0] + extent[2]) / 2,
        (extent[1] + extent[3]) / 2
      ];
      
      const centerLonLat = toLonLat(center);
      
      // Convert boundary points to EPSG:4326
      const coords = geometry.getCoordinates()[0].map(pt => toLonLat(pt));
      
      onBoundaryChange(coords, areaSqm, centerLonLat as [number, number]);
    });

    map.addInteraction(draw);
    setMapObj(map);

    return () => {
      map.setTarget(undefined);
    };
  }, [mapObj, onBoundaryChange]);

  // Handle getting user location to center map initially
  useEffect(() => {
    if (navigator.geolocation && mapObj) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords = fromLonLat([pos.coords.longitude, pos.coords.latitude]);
        mapObj.getView().animate({ center: coords, zoom: 15 });
      });
    }
  }, [mapObj]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="absolute inset-0 rounded-lg overflow-hidden border border-[var(--border-color)]" />
      <div className="absolute top-2 left-2 z-10 bg-white/90 dark:bg-black/90 p-2 rounded shadow-md text-xs font-semibold backdrop-blur pointer-events-none">
        Draw a boundary around your project site
      </div>
    </div>
  );
}
