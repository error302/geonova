'use client';

// Tab 1: Known GCP Coordinates
//
// Extracted from src/app/tools/gcp-validation/page.tsx.

import type { RefObject } from 'react';
import type { KnownGCP } from './types';

interface GcpTabProps {
  knownGCPs: KnownGCP[];
  addGCP: () => void;
  removeGCP: (id: number) => void;
  updateGCP: (id: number, field: keyof KnownGCP, value: string) => void;
  clearGCPs: () => void;
  loadSampleGCPs: () => void;
  csvInputRef: RefObject<HTMLInputElement | null>;
  handleCSVFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleGeoJSONUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function GcpTab({
  knownGCPs,
  addGCP,
  removeGCP,
  updateGCP,
  clearGCPs,
  loadSampleGCPs,
  csvInputRef,
  handleCSVFileUpload,
  fileInputRef,
  handleGeoJSONUpload,
}: GcpTabProps) {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header flex justify-between items-center flex-wrap gap-2">
          <span className="label">Known GCP Coordinates ({knownGCPs.length} points)</span>
          <div className="flex gap-2 flex-wrap">
            <button onClick={loadSampleGCPs} className="btn btn-secondary text-sm">Load Sample</button>
            <button onClick={clearGCPs} className="btn btn-secondary text-sm">Clear</button>
            <button
              onClick={() => csvInputRef.current?.click()}
              className="btn btn-secondary text-sm"
            >
              Import CSV
            </button>
            <input
              ref={csvInputRef as unknown as React.RefObject<HTMLInputElement>}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleCSVFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary text-sm"
            >
              Import GeoJSON
            </button>
            <input
              ref={fileInputRef as unknown as React.RefObject<HTMLInputElement>}
              type="file"
              accept=".geojson,.json"
              className="hidden"
              onChange={handleGeoJSONUpload}
            />
            <button onClick={addGCP} className="btn btn-primary text-sm">+ Add GCP</button>
          </div>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Enter known ground-surveyed GCP coordinates. These will be compared against the photogrammetry
          software output residuals. Names must match between this table and the residual table.
        </p>

        {knownGCPs.length > 0 ? (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="table">
              <thead className="sticky top-0">
                <tr>
                  <th className="w-12">#</th>
                  <th>Name</th>
                  <th>Easting (m)</th>
                  <th>Northing (m)</th>
                  <th>Elevation (m)</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {knownGCPs.map((g, idx) => (
                  <tr key={g.id}>
                    <td className="text-[var(--text-muted)] text-sm">{idx + 1}</td>
                    <td>
                      <input
                        className="input w-28 font-mono"
                        value={g.name}
                        onChange={e => updateGCP(g.id, 'name', e.target.value)}
                        aria-label="GCP name" placeholder="GCP-01"
                      />
                    </td>
                    <td>
                      <input
                        className="input w-36 font-mono"
                        value={g.easting}
                        onChange={e => updateGCP(g.id, 'easting', e.target.value)}
                        aria-label="Easting (m)" placeholder="484500.0000"
                      />
                    </td>
                    <td>
                      <input
                        className="input w-36 font-mono"
                        value={g.northing}
                        onChange={e => updateGCP(g.id, 'northing', e.target.value)}
                        aria-label="Northing (m)" placeholder="9863100.0000"
                      />
                    </td>
                    <td>
                      <input
                        className="input w-32 font-mono"
                        value={g.elevation}
                        onChange={e => updateGCP(g.id, 'elevation', e.target.value)}
                        aria-label="Elevation (m)" placeholder="120.5000"
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => removeGCP(g.id)}
                        className="text-red-400 hover:text-red-300 text-sm inline-flex items-center justify-center min-w-6 min-h-6 px-1"
                        title="Remove"
                        aria-label={`Remove GCP ${g.id}`}
                      >
                        [x]
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <p className="text-lg mb-2">No known GCP coordinates entered</p>
            <p className="text-sm">Add GCPs manually, import from CSV/GeoJSON, or load sample data.</p>
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button onClick={addGCP} className="btn btn-secondary text-sm">+ Add Row</button>
        </div>

        {/* CSV format hint */}
        <div className="mt-4 p-3 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-muted)]">
          <strong>CSV format:</strong> <code className="font-mono">Name,Easting,Northing,Elevation</code><br />
          <strong>GeoJSON:</strong> FeatureCollection with Point features having properties: name, easting, northing, elevation
        </div>
      </div>
    </div>
  );
}
