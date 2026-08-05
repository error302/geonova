'use client';

import type React from 'react';
import { Upload, AlertCircle, FileDown } from 'lucide-react';

interface UploadTabProps {
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  tiffLoading: boolean;
  tiffError: string;
  tiffFileName: string;
  geoTIFFLoaded: boolean;
}

export default function UploadTab({
  handleFileUpload,
  tiffLoading,
  tiffError,
  tiffFileName,
  geoTIFFLoaded,
}: UploadTabProps) {
  return (
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
  );
}
