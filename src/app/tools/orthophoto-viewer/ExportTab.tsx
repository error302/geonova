'use client';

import { Download } from 'lucide-react';
import type { TracedPolygon } from './types';
import { formatArea } from './generators';

interface ExportTabProps {
  polygons: TracedPolygon[];
  exportAll: () => void;
  exportDXF: () => void;
  exportKML: () => void;
  exportGeoJSONFile: () => void;
  exportCSV: () => void;
}

export default function ExportTab({
  polygons,
  exportAll,
  exportDXF,
  exportKML,
  exportGeoJSONFile,
  exportCSV,
}: ExportTabProps) {
  return (
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
            ].map((item: { key: string; title: string; desc: string; format: string; icon: string; action: () => void }) => (
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
  );
}
