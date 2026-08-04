'use client';

import type React from 'react';
import { Map, Layers, Square, XCircle } from 'lucide-react';
import type { BasemapType, TabId } from './types';

interface MapPanelProps {
  mapRef: React.RefObject<HTMLDivElement>;
  activeTab: TabId;
  basemapType: BasemapType;
  setBasemapType: (t: BasemapType) => void;
  isDrawing: boolean;
  startDrawing: () => void;
  stopDrawing: () => void;
  geoTIFFLoaded: boolean;
  orthoOpacity: number;
  setOrthoOpacity: (n: number) => void;
}

export default function MapPanel({
  mapRef,
  activeTab,
  basemapType,
  setBasemapType,
  isDrawing,
  startDrawing,
  stopDrawing,
  geoTIFFLoaded,
  orthoOpacity,
  setOrthoOpacity,
}: MapPanelProps) {
  return (
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
  );
}
