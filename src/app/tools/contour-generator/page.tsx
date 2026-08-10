'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Mountain } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import {
  generateContours,
  buildTINSurface,
  computeVolumeFromTIN,
  type SpotHeight,
  type ContourLine,
  type TINSurface,
  type Breakline,
} from '@/lib/engine/contours';
import {
  generateContoursAsync,
  buildTINSurfaceAsync,
  isWorkerAvailable,
} from '@/lib/workers/tinWorkerClient';

import type { TabId, Bounds, ImportStats, ParseError, VolumeResult } from './types';
import { MARGIN, SVG_HEIGHT, SVG_WIDTH } from './constants';
import {
  fmt,
  parseXYZText,
  generateDemoData,
  downloadBlob,
} from './helpers';
import {
  generateDXF,
  generateSVGExport,
  generateContourCSV,
  generateGeoJSON,
} from './generators';
import { ImportTab } from './ImportTab';
import { SettingsTab } from './SettingsTab';
import { MapTab, type SvgElements } from './MapTab';
import { ExportTab } from './ExportTab';
import { BreaklineTab } from './BreaklineTab';
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { ComputeLimitNotice } from '@/components/tools/ComputeLimitNotice'

// ─── Project point row shape (from /api/project/[id]/points) ───────────────
interface ProjectPointRow {
  id: string
  point_name?: string | null
  easting: number
  northing: number
  elevation: number | null
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ContourGeneratorPage() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<TabId>('import');

  // Tab 1: Import state
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [points, setPoints] = useState<SpotHeight[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab 2: Settings state
  const [contourInterval, setContourInterval] = useState(1.0);
  const [indexMultiplier, setIndexMultiplier] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [generateProgress, setGenerateProgress] = useState(0);
  const [usingWorker, setUsingWorker] = useState(false);

  // Breaklines (AUDIT FIX 2026-07-03: expose engine's breakline support in UI)
  const [breaklines, setBreaklines] = useState<Breakline[]>([]);

  // Results
  const [contours, setContours] = useState<ContourLine[]>([]);
  const [tinSurface, setTinSurface] = useState<TINSurface | null>(null);
  const [volumeResult, setVolumeResult] = useState<VolumeResult | null>(null);

  // ─── Project integration: auto-load points from project survey data ──────
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');
  const [projectLoaded, setProjectLoaded] = useState(false);

  useEffect(() => {
    if (!projectId || projectLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/project/${projectId}/points`)
        if (!res.ok) return
        const json = await res.json() as { data?: ProjectPointRow[] }
        const pts: SpotHeight[] = (json.data || [])
          .filter((p): p is ProjectPointRow & { elevation: number } => p.elevation != null)
          .map((p) => ({
            name: p.point_name || p.id,
            easting: p.easting,
            northing: p.northing,
            elevation: p.elevation,
          }))
        if (!cancelled && pts.length > 0) {
          setPoints(pts)
          setImportStats({
            delimiter: 'auto',
            hasHeader: false,
          })
        }
      } catch {
        // silent fail — user can import manually
      } finally {
        if (!cancelled) setProjectLoaded(true)
      }
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projectLoaded])

  // ─── Bounding box computation ────────────────────────────────────────────

  const bounds = useMemo<Bounds | null>(() => {
    if (points.length === 0) return null;
    let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of points) {
      if (p.easting < minE) minE = p.easting;
      if (p.easting > maxE) maxE = p.easting;
      if (p.northing < minN) minN = p.northing;
      if (p.northing > maxN) maxN = p.northing;
      if (p.elevation < minZ) minZ = p.elevation;
      if (p.elevation > maxZ) maxZ = p.elevation;
    }
    return { minE, maxE, minN, maxN, minZ, maxZ };
  }, [points]);

  // ─── File upload handler ──────────────────────────────────────────────────

  const handleFileUpload = useCallback(async (file: File) => {
    setFileName(file.name);
    setIsParsing(true);
    setParseErrors([]);
    setContours([]);
    setTinSurface(null);
    setVolumeResult(null);

    try {
      const text = await file.text();
      setRawText(text);
      processText(text);
    } catch (err) {
      setParseErrors([{ row: 0, message: `Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}` }]);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const processText = useCallback((text: string) => {
    setIsParsing(true);
    setParseErrors([]);
    setContours([]);
    setTinSurface(null);
    setVolumeResult(null);

    try {
      const result = parseXYZText(text);
      const spotHeights: SpotHeight[] = result.points.map(p => ({
        name: p.name,
        easting: p.easting,
        northing: p.northing,
        elevation: p.elevation,
      }));
      setPoints(spotHeights);
      setParseErrors(result.errors);
      setImportStats({
        delimiter: result.delimiter === '\t' ? 'tab' : result.delimiter === ',' ? 'comma' : result.delimiter === ';' ? 'semicolon' : 'space',
        hasHeader: result.hasHeader,
      });
    } catch (err) {
      setParseErrors([{ row: 0, message: `Parse error: ${err instanceof Error ? err.message : 'Unknown error'}` }]);
    } finally {
      setIsParsing(false);
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

  const handleLoadDemo = useCallback(() => {
    const demoPoints = generateDemoData();
    setPoints(demoPoints);
    setContours([]);
    setTinSurface(null);
    setVolumeResult(null);
    setParseErrors([]);
    setFileName('demo_terrain.csv');
    setImportStats({ delimiter: 'comma', hasHeader: true });
    // Build a demo CSV text for display
    const csvLines = ['Name,Easting,Northing,Elevation'];
    for (const p of demoPoints.slice(0, 10)) {
      csvLines.push(`${p.name},${fmt(p.easting, 3)},${fmt(p.northing, 3)},${fmt(p.elevation, 2)}`);
    }
    csvLines.push(`... (${demoPoints.length} points total)`);
    setRawText(csvLines.join('\n'));
  }, []);

  // ─── Generate contours ───────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (points.length < 3) {
      setGenerateError('At least 3 points are required to generate contours.');
      return;
    }
    if (contourInterval <= 0) {
      setGenerateError('Contour interval must be positive.');
      return;
    }

    setIsGenerating(true);
    setGenerateError('');
    setGenerateProgress(0);
    setUsingWorker(isWorkerAvailable());

    try {
      const indexInterval = contourInterval * indexMultiplier;

      // Use Web Worker with auto-fallback to sync engine.
      // For large datasets (≥ 5000 pts) this keeps the UI responsive;
      // for small datasets the worker overhead is negligible thanks to
      // the 30 s timeout + sync fallback in tinWorkerClient.
      //
      // AUDIT FIX (2026-07-05): DTM filtering — classify ground vs non-ground
      // before contour generation. Vegetation and buildings distort contours
      // if not filtered. Uses CSF algorithm (only if enough points).
      let groundPoints = points;
      try {
        if (points.length >= 20) {
          const { classifyPointCloud, extractGroundPoints } = await import('@/lib/topo/pointCloudClassification');
          const classified = classifyPointCloud(points.map(p => ({
            x: p.easting, y: p.northing, z: p.elevation,
          })));
          const ground = extractGroundPoints(classified);
          if (ground.length >= 3) {
            groundPoints = ground.map((p, i) => ({
              name: `G${i}`,
              easting: p.x, northing: p.y, elevation: p.z,
            }));
          }
        }
      } catch {
        // DTM filtering failed — use all points
      }

      // AUDIT FIX (2026-07-03): Pass breaklines to both the contour
      // generator and the TIN builder so triangles don't cross terrain
      // discontinuities.
      const result = await generateContoursAsync(groundPoints, contourInterval, {
        indexInterval,
        breaklines: breaklines.length > 0 ? breaklines : undefined,
        onProgress: p => setGenerateProgress(p),
      });
      setContours(result);

      const surface = await buildTINSurfaceAsync(
        groundPoints,
        breaklines.length > 0 ? breaklines : undefined,
        {
          onProgress: p => setGenerateProgress(p),
        },
      );
      setTinSurface(surface);

      // Compute volume relative to minimum elevation
      const minElev = Math.min(...groundPoints.map(p => p.elevation));
      const vol = computeVolumeFromTIN(surface, minElev);
      setVolumeResult(vol);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Contour generation failed.');
    } finally {
      setIsGenerating(false);
      setGenerateProgress(1);
      setUsingWorker(false);
    }
  }, [points, contourInterval, indexMultiplier, breaklines]);

  // ─── Export handlers ─────────────────────────────────────────────────────

  const exportDXF = useCallback(() => {
    if (!contours.length || !bounds) return;
    const dxf = generateDXF(contours, bounds);
    downloadBlob(dxf, 'contours.dxf', 'application/dxf');
  }, [contours, bounds]);

  const exportSVG = useCallback(() => {
    if (!contours.length || !bounds) return;
    const svg = generateSVGExport(contours, bounds, points);
    downloadBlob(svg, 'contours.svg', 'image/svg+xml');
  }, [contours, bounds, points]);

  const exportCSV = useCallback(() => {
    if (!contours.length) return;
    const csv = generateContourCSV(contours);
    downloadBlob(csv, 'contours.csv', 'text/csv');
  }, [contours]);

  const exportGeoJSON = useCallback(() => {
    if (!contours.length) return;
    const geojson = generateGeoJSON(contours);
    downloadBlob(geojson, 'contours.geojson', 'application/geo+json');
  }, [contours]);

  // ─── SVG rendering computations ──────────────────────────────────────────

  const svgElements = useMemo<SvgElements | null>(() => {
    if (!contours.length || !bounds) return null;

    const usableW = SVG_WIDTH - 2 * MARGIN;
    const usableH = SVG_HEIGHT - 2 * MARGIN;
    const minE = bounds.minE;
    const maxE = bounds.maxE;
    const minN = bounds.minN;
    const maxN = bounds.maxN;
    const rangeE = maxE - minE || 1;
    const rangeN = maxN - minN || 1;

    const contourElevations = contours.map(c => c.elevation);
    const minElev = Math.min(...contourElevations);
    const maxElev = Math.max(...contourElevations);

    function toSvgX(e: number) { return MARGIN + ((e - minE) / rangeE) * usableW; }
    function toSvgY(n: number) { return MARGIN + ((maxN - n) / rangeN) * usableH; }

    // Subsample spot height points for rendering if too many
    const spotStep = Math.max(1, Math.floor(points.length / 2000));
    const spotSampled = points.filter((_, i) => i % spotStep === 0);

    return {
      usableW, usableH, rangeE, rangeN, minElev, maxElev, toSvgX, toSvgY, spotSampled,
      viewBox: `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`,
    };
  }, [contours, bounds, points]);

  // ─── Tab definitions ──────────────────────────────────────────────────────

  const tabs: { id: TabId; label: string; disabled?: boolean }[] = [
    { id: 'import', label: 'Import Points' },
    { id: 'breaklines', label: `Breaklines${breaklines.length > 0 ? ` (${breaklines.length})` : ''}`, disabled: points.length < 3 },
    { id: 'settings', label: 'Settings & Generate', disabled: points.length < 3 },
    { id: 'map', label: 'Contour Map', disabled: contours.length === 0 },
    { id: 'export', label: 'Export', disabled: contours.length === 0 },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Custom header (mutation-plan pattern) */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-emerald-500/10 rounded-lg">
          <Mountain className="h-6 w-6 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('tools.contourGenerator')}</h1>
          <p className="text-sm text-zinc-400">
            {t('tools.contourGeneratorDesc')}
          </p>
        </div>
      </div>

      <ComputeLimitNotice
        tool="Contour generation"
        message="The web contour engine runs in a browser worker and is tuned for typical field datasets. For very large point clouds, dense contours, or batch terrain processing, the METARDU desktop app runs the full engine locally — no size limits, no uploads."
      />

      {/* Tab bar */}
      <div className="flex gap-2 mt-6 mb-6 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            disabled={tab.disabled}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              tab.disabled
                ? 'opacity-40 cursor-not-allowed bg-[var(--bg-tertiary)] text-zinc-600'
                : activeTab === tab.id
                  ? 'bg-[var(--accent)] text-black'
                  : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════ TAB 1: Import Points ═══════════════════ */}
      {activeTab === 'import' && (
        <ImportTab
          rawText={rawText}
          setRawText={setRawText}
          fileName={fileName}
          points={points}
          parseErrors={parseErrors}
          importStats={importStats}
          isParsing={isParsing}
          bounds={bounds}
          fileInputRef={fileInputRef}
          handleDropZone={handleDropZone}
          handleFileInput={handleFileInput}
          handlePasteParse={handlePasteParse}
          handleLoadDemo={handleLoadDemo}
        />
      )}

      {/* ═══════════════════ TAB 1.5: Breaklines ═══════════════════ */}
      {activeTab === 'breaklines' && (
        <BreaklineTab
          points={points}
          breaklines={breaklines}
          setBreaklines={setBreaklines}
        />
      )}

      {/* ═══════════════════ TAB 2: Settings & Generate ═══════════════════ */}
      {activeTab === 'settings' && (
        <SettingsTab
          contourInterval={contourInterval}
          setContourInterval={setContourInterval}
          indexMultiplier={indexMultiplier}
          setIndexMultiplier={setIndexMultiplier}
          points={points}
          bounds={bounds}
          isGenerating={isGenerating}
          generateError={generateError}
          handleGenerate={handleGenerate}
          contours={contours}
          tinSurface={tinSurface}
          volumeResult={volumeResult}
          generateProgress={generateProgress}
          usingWorker={usingWorker}
          breaklineCount={breaklines.length}
        />
      )}

      {/* ═══════════════════ TAB 3: Contour Map ═══════════════════ */}
      {activeTab === 'map' && svgElements && bounds && (
        <MapTab
          contours={contours}
          bounds={bounds}
          points={points}
          contourInterval={contourInterval}
          svgElements={svgElements}
        />
      )}

      {/* ═══════════════════ TAB 4: Export ═══════════════════ */}
      {activeTab === 'export' && (
        <ExportTab
          exportDXF={exportDXF}
          exportSVG={exportSVG}
          exportCSV={exportCSV}
          exportGeoJSON={exportGeoJSON}
          volumeResult={volumeResult}
          bounds={bounds}
        />
      )}
    </div>
  );
}
