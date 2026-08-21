'use client';

import { useState, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader';
import { ComputeLimitNotice } from '@/components/tools/ComputeLimitNotice';
import {
  analyzeSlopeFromPoints,
  slopeAnalysisToCSV,
  type DTMPoint,
  type SlopeAnalysisResult,
} from '@/lib/engineering/slopeAnalysis';
// tin types now managed internally by TinTab
import { parseCSVStreamed, type StreamProgress } from '@/lib/importers/streamingCSVParser';
import { parsePLYStreamed } from '@/lib/importers/streamingPLYParser';
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { VolumeTab } from './VolumeTab';
import TinTab from './TinTab';
import { autoClassifyPoint } from '@/lib/topo/featureCodeAutomation';
import { MAX_POINTS } from './constants';
import { SURFACE_WORKER_HEAVY_THRESHOLD } from '@/lib/compute/surfaceService';

// ─── Constants ──────────────────────────────────────────────────────────────
const SLOPE_CLASS_LABELS: Record<string, { label: string; range: string; color: string }> = {
  flat: { label: 'Flat', range: '0–2%', color: '#22c55e' },
  gentle: { label: 'Gentle', range: '2–5%', color: '#86efac' },
  moderate: { label: 'Moderate', range: '5–15%', color: '#eab308' },
  steep: { label: 'Steep', range: '15–35%', color: '#f97316' },
  very_steep: { label: 'Very Steep', range: '35–60%', color: '#ef4444' },
  cliff: { label: 'Cliff', range: '>60%', color: '#7f1d1d' },
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface ImportedPoint {
  id: string;
  name: string;
  easting: number;
  northing: number;
  elevation: number;
}

interface ParseError {
  row: number;
  message: string;
}

interface ColumnMapping {
  id: number;    // column index
  easting: number;
  northing: number;
  elevation: number;
  name: number;
}

type TabId = 'import' | 'statistics' | 'slope' | 'tin' | 'volume';
type SortColumn = 'name' | 'easting' | 'northing' | 'elevation';
type SortDir = 'asc' | 'desc';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, d: number = 4): string {
  return n.toFixed(d);
}

function detectDelimiter(text: string): string {
  const firstLines = text.split('\n').slice(0, 5);
  let commaCount = 0;
  let tabCount = 0;
  let semicolonCount = 0;
  let spaceCount = 0;

  for (const line of firstLines) {
    if (line.startsWith('#') || line.trim() === '') continue;
    commaCount += (line.match(/,/g) || []).length;
    tabCount += (line.match(/\t/g) || []).length;
    semicolonCount += (line.match(/;/g) || []).length;
    spaceCount += (line.match(/ {2,}/g) || []).length;
  }

  const counts: [string, number][] = [
    ['\t', tabCount],
    [',', commaCount],
    [';', semicolonCount],
    [' ', spaceCount],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][0];
}

function isHeaderLine(line: string): boolean {
  const lower = line.toLowerCase();
  const headerKeywords = [
    'easting', 'northing', 'elevation', 'name', 'point', 'id',
    'x', 'y', 'z', 'e', 'n', 'rl', 'height', 'lat', 'lon',
  ];
  const tokens = lower.split(/[\t,; ]+/).filter(t => t.length > 0);
  if (tokens.length === 0) return false;

  // If more than half the tokens are header-like keywords, it's a header
  const matchCount = tokens.filter(t =>
    headerKeywords.some(kw => t === kw || t.includes(kw))
  ).length;
  return matchCount >= Math.ceil(tokens.length * 0.5);
}

function guessColumnIndices(headers: string[]): ColumnMapping {
  const lower = headers.map(h => h.toLowerCase().trim());

  const eastingIdx = lower.findIndex(h =>
    h === 'easting' || h === 'e' || h === 'x' || h.includes('east') || h.includes('easting')
  );
  const northingIdx = lower.findIndex(h =>
    h === 'northing' || h === 'n' || h === 'y' || h.includes('north') || h.includes('northing')
  );
  const elevIdx = lower.findIndex(h =>
    h === 'elevation' || h === 'z' || h === 'rl' || h === 'height' ||
    h.includes('elev') || h.includes('height') || h === 'level'
  );
  const nameIdx = lower.findIndex(h =>
    h === 'name' || h === 'id' || h === 'point' || h === 'pointname' ||
    h === 'point_name' || h === 'code' || h.includes('name') || h.includes('id')
  );

  return {
    id: lower.indexOf('id') >= 0 ? lower.indexOf('id') : -1,
    easting: eastingIdx >= 0 ? eastingIdx : 0,
    northing: northingIdx >= 0 ? northingIdx : 1,
    elevation: elevIdx >= 0 ? elevIdx : 2,
    name: nameIdx >= 0 ? nameIdx : -1,
  };
}

function parseXYZText(text: string): {
  points: ImportedPoint[];
  errors: ParseError[];
  totalLines: number;
  delimiter: string;
  hasHeader: boolean;
} {
  const delimiter = detectDelimiter(text);
  const lines = text.split('\n');
  const errors: ParseError[] = [];
  const points: ImportedPoint[] = [];
  const splitRe = delimiter === ' ' ? /\s+/ : new RegExp(`(?:${delimiter === '\t' ? '\\t' : delimiter})+`);
  let startIdx = 0;
  let hasHeader = false;

  // Detect header
  if (lines.length > 0 && isHeaderLine(lines[0])) {
    hasHeader = true;
    startIdx = 1;
  }

  // Detect comment lines
  while (startIdx < lines.length && lines[startIdx].trim().startsWith('#')) {
    startIdx++;
  }

  let colMapping: ColumnMapping | null = null;
  if (hasHeader) {
    const headers = lines[0].split(splitRe).map(h => h.trim());
    colMapping = guessColumnIndices(headers);
  }

  // Check the first data row to determine column count
  let colCount = 3;
  for (let i = startIdx; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(splitRe);
    if (parts.length >= 3) {
      colCount = parts.length;
      break;
    }
  }

  // Default column mapping for 3-column data
  if (!colMapping) {
    if (colCount === 3) {
      colMapping = { id: -1, easting: 0, northing: 1, elevation: 2, name: -1 };
    } else if (colCount >= 4) {
      colMapping = { id: -1, easting: 1, northing: 2, elevation: 3, name: 0 };
    }
  }

  for (let i = startIdx; i < lines.length && points.length < MAX_POINTS; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(splitRe).map(s => s.trim());

    if (parts.length < 3) {
      errors.push({ row: i + 1, message: `Too few columns (${parts.length})` });
      continue;
    }

    if (!colMapping) continue
    const mapping = colMapping
    const eIdx = mapping.easting;
    const nIdx = mapping.northing;
    const zIdx = mapping.elevation;
    const nameIdx = mapping.name;

    const easting = parseFloat(parts[eIdx]);
    const northing = parseFloat(parts[nIdx]);
    const elevation = parseFloat(parts[zIdx]);

    if (isNaN(easting) || isNaN(northing) || isNaN(elevation)) {
      errors.push({ row: i + 1, message: 'Non-numeric coordinate value' });
      continue;
    }

    const pointName = nameIdx >= 0 && nameIdx < parts.length
      ? parts[nameIdx]
      : `P${points.length + 1}`;

    points.push({
      id: `pt-${points.length}`,
      name: pointName,
      easting,
      northing,
      elevation,
    });
  }

  return {
    points,
    errors: errors.slice(0, 50), // Cap displayed errors
    totalLines: lines.length,
    delimiter,
    hasHeader,
  };
}

function downloadCSV(filename: string, csvString: string) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PointCloudImportPage() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<TabId>('import');

  // Import state
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [points, setPoints] = useState<ImportedPoint[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [importStats, setImportStats] = useState<{
    totalLines: number;
    delimiter: string;
    hasHeader: boolean;
    pointCount: number;
  } | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [warningMsg, setWarningMsg] = useState('');
  const [ingestProgress, setIngestProgress] = useState<StreamProgress | null>(null);

  // Statistics state
  const [sortCol, setSortCol] = useState<SortColumn>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterMinElev, setFilterMinElev] = useState('');
  const [filterMaxElev, setFilterMaxElev] = useState('');

  // Slope analysis state
  const [slopeResult, setSlopeResult] = useState<SlopeAnalysisResult | null>(null);
  const [slopeError, setSlopeError] = useState('');
  const [isSlopeRunning, setIsSlopeRunning] = useState(false);
  const [slopeGridRes, setSlopeGridRes] = useState('');

  // TIN state

  // Cut/fill state

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── File upload handler ─────────────────────────────────────────────────

  const processText = useCallback((text: string) => {
    setIsParsing(true);
    setParseErrors([]);
    setSlopeResult(null);
    setWarningMsg('');

    try {
      const result = parseXYZText(text);
      setPoints(result.points);
      setParseErrors(result.errors);
      setImportStats({
        totalLines: result.totalLines,
        delimiter: result.delimiter === '\t' ? 'tab' : result.delimiter === ',' ? 'comma' : result.delimiter === ';' ? 'semicolon' : 'space',
        hasHeader: result.hasHeader,
        pointCount: result.points.length,
      });

      if (result.points.length === 0 && text.trim().length > 0) {
        setWarningMsg('No valid points parsed. Check your data format and column mapping.');
      }

      // Count skipped lines
      const skippedComment = text.split('\n').filter(l => l.trim().startsWith('#')).length;
      const skippedEmpty = text.split('\n').filter(l => l.trim() === '').length;
      if ((skippedComment > 0 || skippedEmpty > 0) && result.points.length > 0) {
        const extras: string[] = [];
        if (skippedComment > 0) extras.push(`${skippedComment} comment line(s)`);
        if (skippedEmpty > 0) extras.push(`${skippedEmpty} empty line(s)`);
      }
    } catch (err) {
      setParseErrors([{ row: 0, message: `Parse error: ${err instanceof Error ? err.message : 'Unknown error'}` }]);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    setFileName(file.name);
    setIsParsing(true);
    setWarningMsg('');
    setParseErrors([]);
    setSlopeResult(null);
    setIngestProgress({ bytesLoaded: 0, totalBytes: file.size, percent: 0, pointsLoaded: 0, done: false });

    try {
      const ext = file.name.toLowerCase().split('.').pop();

      if (ext === 'ply') {
        // Streaming PLY parser — chunked ingestion for large clouds
        const result = await parsePLYStreamed(file, setIngestProgress);
        const imported: ImportedPoint[] = result.points.map((p, i) => {
          const classification = p.code ? autoClassifyPoint(p.code) : null
          return {
            id: `pt-${i}`,
            name: p.code || classification?.matchedCode?.code || `P${i + 1}`,
            easting: p.easting,
            northing: p.northing,
            elevation: p.elevation,
          }
        });
        if (result.totalVertices > MAX_POINTS) {
          setWarningMsg(`PLY file contains ${result.totalVertices.toLocaleString()} points. Only the first ${MAX_POINTS.toLocaleString()} will be processed.`);
        }
        setPoints(imported);
        setImportStats({
          totalLines: result.totalVertices,
          delimiter: 'space',
          hasHeader: false,
          pointCount: imported.length,
        });
        setRawText(`[PLY format: ${result.totalVertices.toLocaleString()} vertices — ${imported.length.toLocaleString()} loaded]`);
      } else {
        // Streaming CSV/TXT/XYZ parser — chunked ingestion
        const result = await parseCSVStreamed(file, setIngestProgress);
        const imported: ImportedPoint[] = result.points;

        if (result.points.length >= MAX_POINTS) {
          setWarningMsg(`File exceeded ${MAX_POINTS.toLocaleString()} points. Only the first ${MAX_POINTS.toLocaleString()} were loaded.`);
        } else if (result.points.length === 0 && file.size > 0) {
          setWarningMsg('No valid points parsed. Check your data format and column mapping.');
        }

        setPoints(imported);
        setParseErrors(result.errors);
        setImportStats({
          totalLines: result.totalLines,
          delimiter: result.delimiter === '	' ? 'tab' : result.delimiter === ',' ? 'comma' : result.delimiter === ';' ? 'semicolon' : 'space',
          hasHeader: result.hasHeader,
          pointCount: imported.length,
        });
        setRawText(result.totalLines > 0 ? `[${result.totalLines.toLocaleString()} lines — ${imported.length.toLocaleString()} points loaded]` : '');
      }
    } catch (err) {
      setParseErrors([{ row: 0, message: `Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}` }]);
    } finally {
      setIsParsing(false);
      setTimeout(() => setIngestProgress(null), 2000);
    }
  }, []);

  const handleDropZone = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handlePasteParse = useCallback(() => {
    if (!rawText.trim()) return;
    processText(rawText);
  }, [rawText, processText]);

  // ─── Computed statistics ─────────────────────────────────────────────────

  // Loop-based extents: spread (Math.min(...points.map())) throws a RangeError
  // past ~125k elements, so it breaks at the 1M-point cap.
  const boundingBox = (() => {
    if (points.length === 0) return null;
    let minE = Infinity, maxE = -Infinity;
    let minN = Infinity, maxN = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.easting < minE) minE = p.easting;
      if (p.easting > maxE) maxE = p.easting;
      if (p.northing < minN) minN = p.northing;
      if (p.northing > maxN) maxN = p.northing;
      if (p.elevation < minZ) minZ = p.elevation;
      if (p.elevation > maxZ) maxZ = p.elevation;
    }
    return { minE, maxE, minN, maxN, minZ, maxZ };
  })();

  const avgSpacing = (() => {
    if (points.length < 2) return 0;
    const sampleSize = Math.min(points.length, 200);
    const step = Math.max(1, Math.floor(points.length / sampleSize));
    let totalDist = 0;
    let count = 0;
    const sampled: ImportedPoint[] = [];
    for (let i = 0; i < points.length && sampled.length < sampleSize; i += step) {
      sampled.push(points[i]);
    }
    for (let i = 1; i < sampled.length; i++) {
      const dx = sampled[i].easting - sampled[i - 1].easting;
      const dy = sampled[i].northing - sampled[i - 1].northing;
      totalDist += Math.sqrt(dx * dx + dy * dy);
      count++;
    }
    return count > 0 ? totalDist / count : 0;
  })();

  // ─── Filtered & sorted points for Statistics table ────────────────────────

  const filteredPoints = (() => {
    let result = [...points];

    const minE = filterMinElev !== '' ? parseFloat(filterMinElev) : -Infinity;
    const maxE = filterMaxElev !== '' ? parseFloat(filterMaxElev) : Infinity;
    if (!isNaN(minE) && minE !== -Infinity) {
      result = result.filter(p => p.elevation >= minE);
    }
    if (!isNaN(maxE) && maxE !== Infinity) {
      result = result.filter(p => p.elevation <= maxE);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'easting': cmp = a.easting - b.easting; break;
        case 'northing': cmp = a.northing - b.northing; break;
        case 'elevation': cmp = a.elevation - b.elevation; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result.slice(0, 50);
  })();

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortIndicator = (col: SortColumn) => {
    if (sortCol !== col) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  // ─── Slope analysis ──────────────────────────────────────────────────────

  const runSlopeAnalysis = useCallback(() => {
    if (points.length < 3) {
      setSlopeError('At least 3 points are required for slope analysis.');
      return;
    }
    setIsSlopeRunning(true);
    setSlopeError('');

    // Use setTimeout to avoid blocking the UI for large datasets
    setTimeout(() => {
      try {
        const dtmPoints: DTMPoint[] = points.map(p => ({
          easting: p.easting,
          northing: p.northing,
          elevation: p.elevation,
        }));
        const gridRes = slopeGridRes !== '' ? parseFloat(slopeGridRes) : undefined;
        if (slopeGridRes !== '' && isNaN(gridRes ?? NaN)) {
          setSlopeError('Invalid grid resolution value.');
          setIsSlopeRunning(false);
          return;
        }
        const result = analyzeSlopeFromPoints(dtmPoints, gridRes);
        setSlopeResult(result);
      } catch (err) {
        setSlopeError(err instanceof Error ? err.message : 'Slope analysis failed.');
      } finally {
        setIsSlopeRunning(false);
      }
    }, 50);
  }, [points, slopeGridRes]);

  const exportSlopeCSV = useCallback(() => {
    if (!slopeResult) return;
    const csv = slopeAnalysisToCSV(slopeResult);
    downloadCSV('slope_analysis.csv', csv);
  }, [slopeResult]);

  // ─── TIN & Volume ──────────────────────────────────────────────────────────





  // ─── Render helpers ────────────────────────────────────────────────────────

  const previewRows = points.slice(0, 5);

  const tabs: { id: TabId; label: string; disabled?: boolean }[] = [
    { id: 'import', label: 'Import' },
    { id: 'statistics', label: 'Statistics & Preview', disabled: points.length === 0 },
    { id: 'slope', label: 'Slope Analysis', disabled: points.length < 3 },
    { id: 'tin', label: 'TIN & Volume', disabled: points.length < 3 },
    { id: 'volume', label: 'Volume (Cut/Fill)', disabled: points.length < 3 },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title={t('tools.pointCloudImport')}
        subtitle={t('tools.pointCloudImportDesc')}
      />

      <ComputeLimitNotice
        maxPoints={MAX_POINTS}
        tool="Point cloud import"
        message={`The web importer keeps the first ${MAX_POINTS.toLocaleString()} points. Clouds above ${SURFACE_WORKER_HEAVY_THRESHOLD.toLocaleString()} points compute TIN/cut-fill in the Python sidecar when available, falling back to the local engine. For truly massive scans, the METARDU desktop app runs the full engine locally — no caps, no uploads.`}
      />

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            disabled={tab.disabled}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              tab.disabled
                ? 'opacity-40 cursor-not-allowed bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                : activeTab === tab.id
                  ? 'bg-[var(--accent)] text-black'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════ TAB 1: Import ═══════════════════ */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* File upload zone */}
          <div className="card">
            <div className="card-header">
              <span className="label">Upload Point Cloud File</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Accepts CSV, TXT, XYZ, and PLY files from CloudCompare, Agisoft Metashape, or manual exports.
              Maximum {MAX_POINTS.toLocaleString()} points.
            </p>
            <div
              onDrop={handleDropZone}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-8 text-center hover:border-[var(--accent)] transition-colors cursor-pointer mb-4"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-3xl mb-2">[Folder]</div>
              <p className="text-[var(--text-secondary)]">
                Drag & drop a file here, or click to browse
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                .csv .txt .xyz .ply — max {MAX_POINTS.toLocaleString()} points
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.xyz,.ply"
                aria-label="Upload point cloud file (CSV, TXT, XYZ, PLY)"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
            {fileName && (
              <div className="text-sm text-[var(--text-secondary)]">
                File: <span className="font-mono text-[var(--accent)]">{fileName}</span>
              </div>
            )}

            {/* Ingestion progress bar */}
            {ingestProgress && !ingestProgress.done && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1">
                  <span>Reading {ingestProgress.bytesLoaded > 1024 * 1024
                    ? `${(ingestProgress.bytesLoaded / (1024 * 1024)).toFixed(1)} MB`
                    : `${(ingestProgress.bytesLoaded / 1024).toFixed(0)} KB`
                  } of {ingestProgress.totalBytes > 1024 * 1024
                    ? `${(ingestProgress.totalBytes / (1024 * 1024)).toFixed(1)} MB`
                    : `${(ingestProgress.totalBytes / 1024).toFixed(0)} KB`
                  }...</span>
                  <span>{ingestProgress.pointsLoaded.toLocaleString()} points parsed</span>
                </div>
                <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(2, ingestProgress.percent)}%` }}
                  />
                </div>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  Streaming ingestion — UI stays responsive
                </p>
              </div>
            )}

            {/* Completion summary */}
            {ingestProgress && ingestProgress.done && (
              <div className="mt-3 text-xs text-[var(--text-secondary)]">
                Loaded {ingestProgress.pointsLoaded.toLocaleString()} points
                {ingestProgress.totalBytes > 1024 * 1024 && (
                  <> from {(ingestProgress.totalBytes / (1024 * 1024)).toFixed(1)} MB file</>
                )}
              </div>
            )}
          </div>

          {/* Text paste area */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <span className="label">Paste Data Directly</span>
              <button
                onClick={handlePasteParse}
                disabled={isParsing || !rawText.trim()}
                className="btn btn-primary text-sm"
              >
                {isParsing ? 'Parsing...' : 'Parse Data'}
              </button>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              Paste tab-separated, comma-separated, or space-separated XYZ data. Auto-detects delimiters and headers.
              Comment lines starting with <code className="font-mono bg-[var(--bg-tertiary)] px-1 rounded">#</code> are skipped.
            </p>
            <textarea
              className="input w-full font-mono text-xs"
              rows={10}
              placeholder={`Name,Easting,Northing,Elevation\nCP1,484500.0000,9863100.0000,1205.500\nCP2,484750.0000,9863250.0000,1182.250\n...`}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
            />
          </div>

          {/* Parse results */}
          {points.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="label">Import Summary</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                  <span className="text-[var(--text-secondary)] text-sm block">Points Loaded</span>
                  <span className="font-mono text-xl text-[var(--accent)]">{points.length.toLocaleString()}</span>
                </div>
                <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                  <span className="text-[var(--text-secondary)] text-sm block">Delimiter</span>
                  <span className="font-mono text-xl">{importStats?.delimiter || '—'}</span>
                </div>
                <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                  <span className="text-[var(--text-secondary)] text-sm block">Header Detected</span>
                  <span className="font-mono text-xl">{importStats?.hasHeader ? 'Yes' : 'No'}</span>
                </div>
                <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                  <span className="text-[var(--text-secondary)] text-sm block">Errors</span>
                  <span className={`font-mono text-xl ${parseErrors.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {parseErrors.length}
                  </span>
                </div>
              </div>

              {boundingBox && (
                <div className="mb-4">
                  <span className="text-sm text-[var(--text-secondary)]">Bounding Box: </span>
                  <span className="font-mono text-sm">
                    E [{fmt(boundingBox.minE, 2)}, {fmt(boundingBox.maxE, 2)}] m &nbsp;
                    N [{fmt(boundingBox.minN, 2)}, {fmt(boundingBox.maxN, 2)}] m &nbsp;
                    Z [{fmt(boundingBox.minZ, 2)}, {fmt(boundingBox.maxZ, 2)}] m
                  </span>
                </div>
              )}

              {/* Preview table */}
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Easting (m)</th>
                      <th>Northing (m)</th>
                      <th>Elevation (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map(p => (
                      <tr key={p.id}>
                        <td className="font-semibold">{p.name}</td>
                        <td className="font-mono">{fmt(p.easting)}</td>
                        <td className="font-mono">{fmt(p.northing)}</td>
                        <td className="font-mono">{fmt(p.elevation)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {points.length > 5 && (
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  Showing first 5 of {points.length.toLocaleString()} points. Go to Statistics tab for full view.
                </p>
              )}
            </div>
          )}

          {/* Warnings */}
          {warningMsg && (
            <div className="p-4 bg-yellow-900/30 border border-yellow-600 rounded text-yellow-400 text-sm">
              <AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> {warningMsg}
            </div>
          )}

          {/* Parse errors */}
          {parseErrors.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="label text-red-400">Parse Errors ({parseErrors.length})</span>
              </div>
              <div className="overflow-x-auto max-h-48">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseErrors.map((err, i) => (
                      <tr key={`${err}-${i}`}>
                        <td className="font-mono">{err.row}</td>
                        <td className="text-red-400 text-sm">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parseErrors.length >= 50 && (
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  Showing first 50 errors only.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ TAB 2: Statistics & Preview ═══════════════════ */}
      {activeTab === 'statistics' && (
        <div className="space-y-6">
          {/* Summary statistics */}
          <div className="card">
            <div className="card-header">
              <span className="label">Summary Statistics</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Point Count</span>
                <span className="font-mono text-xl">{points.length.toLocaleString()}</span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Elevation Range</span>
                <span className="font-mono text-xl">
                  {boundingBox ? `${fmt(boundingBox.minZ, 1)}–${fmt(boundingBox.maxZ, 1)}` : '—'}
                </span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Avg. Spacing</span>
                <span className="font-mono text-xl">{fmt(avgSpacing, 2)} m</span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Easting Extent</span>
                <span className="font-mono text-xl">
                  {boundingBox ? `${(boundingBox.maxE - boundingBox.minE).toFixed(1)} m` : '—'}
                </span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Northing Extent</span>
                <span className="font-mono text-xl">
                  {boundingBox ? `${(boundingBox.maxN - boundingBox.minN).toFixed(1)} m` : '—'}
                </span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Mean Elevation</span>
                <span className="font-mono text-xl">
                  {points.length > 0
                    ? fmt(points.reduce((s, p) => s + p.elevation, 0) / points.length, 2)
                    : '—'} m
                </span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">Std. Dev. (Z)</span>
                <span className="font-mono text-xl">
                  {(() => {
                    if (points.length === 0) return '—';
                    const mean = points.reduce((s, p) => s + p.elevation, 0) / points.length;
                    const variance = points.reduce((s, p) => s + (p.elevation - mean) ** 2, 0) / points.length;
                    return Math.sqrt(variance).toFixed(2);
                  })()} m
                </span>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <span className="text-[var(--text-secondary)] text-sm block">BBox SW Corner</span>
                <span className="font-mono text-sm">
                  {boundingBox ? `${fmt(boundingBox.minE, 1)}, ${fmt(boundingBox.minN, 1)}` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Point cloud scatter map preview */}
          <div className="card">
            <div className="card-header">
              <span className="label">Point Cloud Map Preview</span>
            </div>
            {boundingBox && (
              <svg viewBox="0 0 500 350" className="w-full bg-[var(--bg-secondary)] rounded" style={{ maxHeight: '350px' }}>
                <rect x="30" y="20" width="440" height="280" fill="none" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4" />
                {(() => {
                  const sampleStep = Math.max(1, Math.floor(points.length / 1000));
                  const sampledPoints = points.filter((_, i) => i % sampleStep === 0);
                  return sampledPoints.map((p, i) => {
                    const rangeE = boundingBox.maxE - boundingBox.minE || 1;
                    const rangeN = boundingBox.maxN - boundingBox.minN || 1;
                    const x = 30 + ((p.easting - boundingBox.minE) / rangeE) * 440;
                    const y = 300 - ((p.northing - boundingBox.minN) / rangeN) * 280;
                    const rangeZ = boundingBox.maxZ - boundingBox.minZ || 1;
                    const t = (p.elevation - boundingBox.minZ) / rangeZ;
                    // Color gradient: green (low) → yellow → red (high)
                    const r = Math.round(t < 0.5 ? t * 2 * 255 : 255);
                    const g = Math.round(t < 0.5 ? 255 : (1 - (t - 0.5) * 2) * 255);
                    const color = `rgb(${r},${g},0)`;
                    return <circle key={`${p}-${i}`} cx={x} cy={y} r="2" fill={color} opacity="0.7" />;
                  });
                })()}
                <text x="30" y="315" fill="var(--text-muted)" fontSize="10">E: {fmt(boundingBox.minE, 1)}</text>
                <text x="390" y="315" fill="var(--text-muted)" fontSize="10">{fmt(boundingBox.maxE, 1)}</text>
                <text x="30" y="15" fill="var(--text-muted)" fontSize="10">N: {fmt(boundingBox.maxN, 1)}</text>
                <text x="390" y="335" fill="var(--text-muted)" fontSize="10">{fmt(boundingBox.minN, 1)}</text>
              </svg>
            )}
            {boundingBox && (
              <div className="flex items-center gap-2 mt-2 justify-center">
                <span className="text-xs text-[var(--text-muted)]">Low Z</span>
                <div className="w-32 h-3 rounded" style={{ background: 'linear-gradient(to right, #00ff00, #ffff00, #ff0000)' }} />
                <span className="text-xs text-[var(--text-muted)]">High Z</span>
                {points.length > 1000 && (
                  <span className="text-xs text-[var(--text-muted)] ml-4">
                    (showing ~1,000 of {points.length.toLocaleString()} points)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Filter controls */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <span className="label">Point Data ({points.length.toLocaleString()} total, showing {filteredPoints.length})</span>
            </div>
            <div className="flex gap-4 items-end mb-4 flex-wrap">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1" htmlFor="min-elevation">Min Elevation</label>
                <input id="min-elevation"
                  className="input w-32 font-mono"
                  type="number"
                  placeholder="min Z"
                  value={filterMinElev}
                  onChange={e => setFilterMinElev(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1" htmlFor="max-elevation">Max Elevation</label>
                <input id="max-elevation"
                  className="input w-32 font-mono"
                  type="number"
                  placeholder="max Z"
                  value={filterMaxElev}
                  onChange={e => setFilterMaxElev(e.target.value)}
                />
              </div>
              <button
                onClick={() => { setFilterMinElev(''); setFilterMaxElev(''); }}
                className="btn btn-secondary text-sm"
              >
                Clear Filter
              </button>
              <button
                onClick={() => {
                  const csv = 'Name,Easting,Northing,Elevation\n' +
                    points.map(p => `${p.name},${fmt(p.easting)},${fmt(p.northing)},${fmt(p.elevation)}`).join('\n');
                  downloadCSV('point_cloud_data.csv', csv);
                }}
                className="btn btn-secondary text-sm ml-auto"
              >
                Export Points CSV
              </button>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
              <table className="table">
                <thead className="sticky top-0">
                  <tr>
                    <th className="cursor-pointer" onClick={() => handleSort('name')}>
                      Name{sortIndicator('name')}
                    </th>
                    <th className="cursor-pointer" onClick={() => handleSort('easting')}>
                      Easting (m){sortIndicator('easting')}
                    </th>
                    <th className="cursor-pointer" onClick={() => handleSort('northing')}>
                      Northing (m){sortIndicator('northing')}
                    </th>
                    <th className="cursor-pointer" onClick={() => handleSort('elevation')}>
                      Elevation (m){sortIndicator('elevation')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPoints.map(p => (
                    <tr key={p.id}>
                      <td className="font-semibold">{p.name}</td>
                      <td className="font-mono">{fmt(p.easting)}</td>
                      <td className="font-mono">{fmt(p.northing)}</td>
                      <td className="font-mono">{fmt(p.elevation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {points.length > 50 && (
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Displaying first 50 of {points.length.toLocaleString()} points (sorted).
              </p>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ TAB 3: Slope Analysis ═══════════════════ */}
      {activeTab === 'slope' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <span className="label">Slope Analysis (KENHA/RDM Standards)</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Generates an IDW-interpolated grid and computes slope using 4-neighbor finite differences.
              Classification per KENHA Design Manual 2017 and RDM 1.3 §4.
            </p>
            <div className="flex gap-4 items-end flex-wrap">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1" htmlFor="grid-resolution-m">Grid Resolution (m)</label>
                <input id="grid-resolution-m"
                  className="input w-32 font-mono"
                  type="number"
                  step="0.5"
                  min="0.5"
                  placeholder="auto"
                  value={slopeGridRes}
                  onChange={e => setSlopeGridRes(e.target.value)}
                />
              </div>
              <button
                onClick={runSlopeAnalysis}
                disabled={isSlopeRunning || points.length < 3}
                className="btn btn-primary"
              >
                {isSlopeRunning ? 'Computing...' : 'Run Slope Analysis'}
              </button>
            </div>
          </div>

          {slopeError && (
            <div className="p-4 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
              {slopeError}
            </div>
          )}

          {slopeResult && (
            <>
              {/* Slope statistics */}
              <div className="card">
                <div className="card-header flex justify-between items-center">
                  <span className="label">Slope Statistics</span>
                  <button onClick={exportSlopeCSV} className="btn btn-secondary text-sm">
                    Export CSV
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                    <span className="text-[var(--text-secondary)] text-sm block">Mean Slope</span>
                    <span className="font-mono text-xl">{fmt(slopeResult.statistics.meanSlopePercent, 2)}%</span>
                  </div>
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                    <span className="text-[var(--text-secondary)] text-sm block">Max Slope</span>
                    <span className="font-mono text-xl text-red-400">{fmt(slopeResult.statistics.maxSlopePercent, 2)}%</span>
                  </div>
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                    <span className="text-[var(--text-secondary)] text-sm block">Min Slope</span>
                    <span className="font-mono text-xl text-green-400">{fmt(slopeResult.statistics.minSlopePercent, 2)}%</span>
                  </div>
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                    <span className="text-[var(--text-secondary)] text-sm block">Grid Resolution</span>
                    <span className="font-mono text-xl">{fmt(slopeResult.gridResolution, 2)} m</span>
                  </div>
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                    <span className="text-[var(--text-secondary)] text-sm block">Total Area</span>
                    <span className="font-mono text-xl">{slopeResult.statistics.totalArea.toFixed(1)} m²</span>
                  </div>
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                    <span className="text-[var(--text-secondary)] text-sm block">Mean Slope (deg)</span>
                    <span className="font-mono text-xl">{fmt(slopeResult.statistics.meanSlopeDegrees, 2)}°</span>
                  </div>
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                    <span className="text-[var(--text-secondary)] text-sm block">Grid Points</span>
                    <span className="font-mono text-xl">{slopeResult.slopePoints.length.toLocaleString()}</span>
                  </div>
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                    <span className="text-[var(--text-secondary)] text-sm block">Total Points</span>
                    <span className="font-mono text-xl">{points.length.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Slope distribution */}
              <div className="card">
                <div className="card-header">
                  <span className="label">Slope Classification Distribution</span>
                </div>
                <div className="space-y-3">
                  {(['flat', 'gentle', 'moderate', 'steep', 'very_steep', 'cliff'] as const).map(cls => {
                    const info = SLOPE_CLASS_LABELS[cls];
                    const count = slopeResult.statistics.slopeDistribution[cls];
                    const area = slopeResult.statistics.areaByClass[cls];
                    const total = slopeResult.statistics.totalArea || 1;
                    const pct = (area / total) * 100;

                    return (
                      <div key={cls} className="flex items-center gap-3">
                        <div className="w-24 text-sm font-medium shrink-0">{info.label}</div>
                        <div className="w-16 text-xs text-[var(--text-muted)] shrink-0">{info.range}</div>
                        <div className="flex-1 bg-[var(--bg-tertiary)] rounded-full h-6 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(pct, 0.5)}%`,
                              backgroundColor: info.color,
                            }}
                          />
                        </div>
                        <div className="w-20 text-right text-sm font-mono shrink-0">{pct.toFixed(1)}%</div>
                        <div className="w-24 text-right text-sm font-mono shrink-0">{area.toFixed(0)} m²</div>
                        <div className="w-16 text-right text-sm text-[var(--text-muted)] font-mono shrink-0">{count.toLocaleString()}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="w-24 text-sm shrink-0" />
                  <div className="w-16 text-xs text-[var(--text-muted)] shrink-0" />
                  <div className="w-20 text-xs text-[var(--text-muted)] shrink-0 text-right">% Area</div>
                  <div className="w-24 text-xs text-[var(--text-muted)] shrink-0 text-right">Area</div>
                  <div className="w-16 text-xs text-[var(--text-muted)] shrink-0 text-right">Count</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════ TAB 4: TIN & Volume ═══════════════════ */}
      {activeTab === 'tin' && (
        <div className="max-w-4xl mx-auto">
          <TinTab points={points} boundingBox={boundingBox} />
        </div>
      )}


      {/* ── Volume (Cut/Fill) Tab ── */}
      {activeTab === 'volume' && (
        <div className="max-w-2xl mx-auto">
          <VolumeTab points={points.map(p => ({ easting: p.easting, northing: p.northing, elevation: p.elevation }))} />
        </div>
      )}
    </div>
  );
}
