'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  buildTINSurface,
  interpolateElevation,
  computeVolumeBetweenSurfaces,
  type SpotHeight,
  type TINSurface,
} from '@/lib/engine/contours';
import {
  surfaceCutFillVolumeGrid,
  type SurfacePoint,
  type SurfaceVolumeGridInput,
  type SurfaceVolumeGridResult,
} from '@/lib/engine/volume';
import { useLanguage } from '@/lib/i18n/LanguageContext'

// ─── Type conversions ────────────────────────────────────────────────────────

const toSpotHeights = (pts: { easting: number; northing: number; elevation: number }[]): SpotHeight[] =>
  pts.map((p, i) => ({ name: `P${i + 1}`, ...p }));

// ─── CSV / text parsing ─────────────────────────────────────────────────────

function detectDelimiter(text: string): string {
  const firstLine = text.trim().split('\n')[0] ?? '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const spaceCount = (firstLine.match(/  +/g) || []).length;
  if (tabCount >= 2) return '\t';
  if (commaCount >= 2) return ',';
  if (semiCount >= 2) return ';';
  if (spaceCount >= 2) return '  ';
  return ',';
}

function parsePointData(text: string): { points: SurfacePoint[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
  if (lines.length === 0) return { points: [], errors: ['No data rows found.'] };

  const delim = detectDelimiter(text);
  const points: SurfacePoint[] = [];
  let startIndex = 0;

  // Check if first line is a header
  const firstLine = lines[0].trim().toLowerCase();
  if (firstLine.includes('easting') || firstLine.includes('name') || firstLine.includes('point') || firstLine.includes('x')) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].trim().split(delim).map(s => s.trim()).filter(Boolean);
    // Try to handle multi-space delimiters
    const fields = parts.length >= 3 ? parts : lines[i].trim().split(/\s+/).map(s => s.trim()).filter(Boolean);
    if (fields.length < 3) { errors.push(`Row ${i + 1}: fewer than 3 fields`); continue; }

    const nameIdx = fields.length >= 4 ? (isNaN(Number(fields[0])) ? 0 : -1) : -1;
    const numericStart = nameIdx === 0 ? 1 : 0;

    const e = Number(fields[numericStart]);
    const n = Number(fields[numericStart + 1]);
    const z = Number(fields[numericStart + 2]);

    if (isNaN(e) || isNaN(n) || isNaN(z)) {
      errors.push(`Row ${i + 1}: non-numeric values`);
      continue;
    }
    points.push({ easting: e, northing: n, elevation: z });
  }

  return { points, errors };
}

// ─── Bounding box helpers ────────────────────────────────────────────────────

interface BBox {
  minE: number; maxE: number; minN: number; maxN: number;
}

function computeBBox(points: SurfacePoint[]): BBox {
  let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
  for (const p of points) {
    if (p.easting < minE) minE = p.easting;
    if (p.easting > maxE) maxE = p.easting;
    if (p.northing < minN) minN = p.northing;
    if (p.northing > maxN) maxN = p.northing;
  }
  return { minE, maxE, minN, maxN };
}

function bboxOverlap(a: BBox, b: BBox): BBox | null {
  const minE = Math.max(a.minE, b.minE);
  const maxE = Math.min(a.maxE, b.maxE);
  const minN = Math.max(a.minN, b.minN);
  const maxN = Math.min(a.maxN, b.maxN);
  if (maxE <= minE || maxN <= minN) return null;
  return { minE, maxE, minN, maxN };
}

function overlapPercent(a: BBox, b: BBox): number {
  const overlap = bboxOverlap(a, b);
  if (!overlap) return 0;
  const aArea = (a.maxE - a.minE) * (a.maxN - a.minN);
  const oArea = (overlap.maxE - overlap.minE) * (overlap.maxN - overlap.minN);
  return (oArea / aArea) * 100;
}

// ─── Demo data generators ────────────────────────────────────────────────────

function generateDemoA(): SurfacePoint[] {
  const points: SurfacePoint[] = [];
  const gridSize = 25;
  const spacing = 2;
  const centerE = 484600;
  const centerN = 9863100;
  const halfGrid = (gridSize * spacing) / 2;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const e = centerE - halfGrid + col * spacing;
      const n = centerN - halfGrid + row * spacing;
      // Base elevation 120m with gentle sine wave slopes
      const dx = (e - centerE) / halfGrid;
      const dy = (n - centerN) / halfGrid;
      const z = 120 + 3 * Math.sin(dx * Math.PI) + 2 * Math.cos(dy * Math.PI) + 0.5 * Math.sin(dx * dy * Math.PI * 2);
      points.push({ easting: Math.round(e * 100) / 100, northing: Math.round(n * 100) / 100, elevation: Math.round(z * 1000) / 1000 });
    }
  }
  return points;
}

function generateDemoB(demoA: SurfacePoint[]): SurfacePoint[] {
  const centerE = 484600;
  const centerN = 9863100;

  return demoA.map(p => {
    const dx = p.easting - centerE;
    const dy = p.northing - centerN;
    let mod = 0;

    // Excavation pit: -5m depression in a 20×20m area (bottom-left quadrant)
    if (dx < 0 && dy < 0 && Math.abs(dx) <= 10 && Math.abs(dy) <= 10) {
      const r = Math.sqrt(dx * dx + dy * dy) / 10;
      mod -= 5 * Math.cos(r * Math.PI / 2); // Bowl shape
    }

    // Embankment: +3m mound in a 15×15m area (right-center)
    const ex = dx - 8;
    if (Math.abs(ex) <= 7.5 && Math.abs(dy) <= 7.5) {
      const r = Math.sqrt(ex * ex + dy * dy) / 7.5;
      mod += 3 * Math.cos(r * Math.PI / 2); // Dome shape
    }

    return { ...p, elevation: p.elevation + mod };
  });
}

// ─── Grid cell for visualization ────────────────────────────────────────────

interface GridCell {
  easting: number;
  northing: number;
  diff: number;
  type: 'cut' | 'fill' | 'none';
}

// ─── Balance point computation ──────────────────────────────────────────────

function computeBalancePoint(surface1: TINSurface, surface2: TINSurface, gridSpacing: number): number | null {
  const minE = Math.max(surface1.bounds.minE, surface2.bounds.minE);
  const maxE = Math.min(surface1.bounds.maxE, surface2.bounds.maxE);
  const minN = Math.max(surface1.bounds.minN, surface2.bounds.minN);
  const maxN = Math.min(surface1.bounds.maxN, surface2.bounds.maxN);
  if (minE >= maxE || minN >= maxN) return null;

  // Get elevation range from both surfaces
  const allElevs = [
    ...surface1.points.map(p => p.elevation),
    ...surface2.points.map(p => p.elevation),
  ];
  const minZ = Math.min(...allElevs);
  const maxZ = Math.max(...allElevs);
  const padding = (maxZ - minZ) * 0.1;
  let lo = minZ - padding;
  let hi = maxZ + padding;

  // Binary search for datum where cut = fill
  for (let iter = 0; iter < 64; iter++) {
    const mid = (lo + hi) / 2;
    let cut = 0;
    let fill = 0;
    const cellArea = gridSpacing * gridSpacing;

    for (let e = minE; e <= maxE; e += gridSpacing) {
      for (let n = minN; n <= maxN; n += gridSpacing) {
        const z1 = interpolateElevation(surface1, e, n);
        const z2 = interpolateElevation(surface2, e, n);
        if (z1 === null || z2 === null) continue;

        const diff1 = z1 - mid;
        const diff2 = z2 - mid;
        if (diff1 > 0) cut += diff1 * cellArea;
        else fill += -diff1 * cellArea;
        if (diff2 > 0) cut += diff2 * cellArea;
        else fill += -diff2 * cellArea;
      }
    }

    if (cut > fill) hi = mid;
    else lo = mid;
  }

  return (lo + hi) / 2;
}

// ─── Compute per-cell analysis grid ─────────────────────────────────────────

function computeGridCells(
  method: 'tin' | 'idw',
  surface1: TINSurface | null,
  surface2: TINSurface | null,
  surveyA: SurfacePoint[],
  surveyB: SurfacePoint[],
  gridSpacing: number
): { cells: GridCell[]; bbox: BBox } {
  const bboxA = computeBBox(surveyA);
  const bboxB = computeBBox(surveyB);
  const overlap = bboxOverlap(bboxA, bboxB);
  if (!overlap) return { cells: [], bbox: { minE: 0, maxE: 0, minN: 0, maxN: 0 } };

  const startE = Math.ceil(overlap.minE / gridSpacing) * gridSpacing;
  const startN = Math.ceil(overlap.minN / gridSpacing) * gridSpacing;
  const endE = Math.floor(overlap.maxE / gridSpacing) * gridSpacing;
  const endN = Math.floor(overlap.maxN / gridSpacing) * gridSpacing;

  const cells: GridCell[] = [];

  for (let e = startE; e <= endE; e += gridSpacing) {
    for (let n = startN; n <= endN; n += gridSpacing) {
      const x = e + gridSpacing / 2;
      const y = n + gridSpacing / 2;

      let z1: number | null = null;
      let z2: number | null = null;

      if (method === 'tin' && surface1 && surface2) {
        z1 = interpolateElevation(surface1, x, y);
        z2 = interpolateElevation(surface2, x, y);
      } else {
        // IDW fallback
        z1 = idwInterp(surveyA, x, y, 2, gridSpacing * 3);
        z2 = idwInterp(surveyB, x, y, 2, gridSpacing * 3);
      }

      if (z1 === null || z2 === null) continue;

      const diff = z1 - z2;
      cells.push({
        easting: e,
        northing: n,
        diff,
        type: diff > 0.001 ? 'cut' : diff < -0.001 ? 'fill' : 'none',
      });
    }
  }

  return { cells, bbox: overlap };
}

function idwInterp(points: SurfacePoint[], x: number, y: number, power: number, maxDist: number): number | null {
  let wSum = 0, wzSum = 0, nearestD2 = Infinity, nearestZ = 0;
  const maxD2 = maxDist * maxDist;
  for (const p of points) {
    const dx = p.easting - x, dy = p.northing - y;
    const d2 = dx * dx + dy * dy;
    if (d2 === 0) return p.elevation;
    if (d2 < nearestD2) { nearestD2 = d2; nearestZ = p.elevation; }
    if (d2 > maxD2) continue;
    const d = Math.sqrt(d2);
    const w = 1 / Math.pow(d, power);
    wSum += w;
    wzSum += w * p.elevation;
  }
  if (wSum > 0) return wzSum / wSum;
  if (nearestD2 < Infinity) return nearestZ;
  return null;
}

// ─── Main Page Component ────────────────────────────────────────────────────

type TabId = 'surveyA' | 'surveyB' | 'analysis' | 'export';

export default function VolumeComparisonPage() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<TabId>('surveyA');

  // Survey A state
  const [surveyAPoints, setSurveyAPoints] = useState<SurfacePoint[]>([]);
  const [surveyAText, setSurveyAText] = useState('');
  const [surveyAErrors, setSurveyAErrors] = useState<string[]>([]);

  // Survey B state
  const [surveyBPoints, setSurveyBPoints] = useState<SurfacePoint[]>([]);
  const [surveyBText, setSurveyBText] = useState('');
  const [surveyBErrors, setSurveyBErrors] = useState<string[]>([]);

  // Analysis state
  const [gridSpacing, setGridSpacing] = useState(1.0);
  const [method, setMethod] = useState<'tin' | 'idw'>('tin');
  const [computing, setComputing] = useState(false);
  const [computeErrors, setComputeErrors] = useState<string[]>([]);
  const [computeWarnings, setComputeWarnings] = useState<string[]>([]);
  const [cutVolume, setCutVolume] = useState<number | null>(null);
  const [fillVolume, setFillVolume] = useState<number | null>(null);
  const [netVolume, setNetVolume] = useState<number | null>(null);
  const [overlapArea, setOverlapArea] = useState<number | null>(null);
  const [balancePoint, setBalancePoint] = useState<number | null>(null);
  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [gridBBox, setGridBBox] = useState<BBox>({ minE: 0, maxE: 0, minN: 0, maxN: 0 });
  const [showGrid, setShowGrid] = useState(false);
  const hasComputed = useRef(false);

  // File input refs
  const fileInputARef = useRef<HTMLInputElement>(null);
  const fileInputBRef = useRef<HTMLInputElement>(null);

  // ─── Computed bounding boxes ───────────────────────────────────────────

  const bboxA = useMemo(() => (surveyAPoints.length > 0 ? computeBBox(surveyAPoints) : null), [surveyAPoints]);
  const bboxB = useMemo(() => (surveyBPoints.length > 0 ? computeBBox(surveyBPoints) : null), [surveyBPoints]);

  const overlapBBox = useMemo(() => {
    if (!bboxA || !bboxB) return null;
    return bboxOverlap(bboxA, bboxB);
  }, [bboxA, bboxB]);

  const overlapPct = useMemo(() => {
    if (!bboxA || !bboxB) return 0;
    return overlapPercent(bboxA, bboxB);
  }, [bboxA, bboxB]);

  // ─── Data loading handlers ─────────────────────────────────────────────

  const handleLoadFromText = useCallback((text: string, survey: 'A' | 'B') => {
    const { points, errors } = parsePointData(text);
    if (survey === 'A') {
      setSurveyAPoints(points);
      setSurveyAErrors(errors);
    } else {
      setSurveyBPoints(points);
      setSurveyBErrors(errors);
    }
  }, []);

  const handleFileUpload = useCallback((file: File, survey: 'A' | 'B') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (survey === 'A') {
        setSurveyAText(text);
        handleLoadFromText(text, 'A');
      } else {
        setSurveyBText(text);
        handleLoadFromText(text, 'B');
      }
    };
    reader.readAsText(file);
  }, [handleLoadFromText]);

  const handleLoadDemoA = useCallback(() => {
    const points = generateDemoA();
    setSurveyAPoints(points);
    setSurveyAErrors([]);
    // Generate a CSV preview for the textarea
    const lines = ['Name,Easting,Northing,Elevation'];
    points.forEach((p, i) => lines.push(`P${i + 1},${p.easting},${p.northing},${p.elevation}`));
    setSurveyAText(lines.slice(0, 20).join('\n') + `\n... (${points.length} total points)`);
  }, []);

  const handleLoadDemoB = useCallback(() => {
    const demoA = generateDemoA();
    const points = generateDemoB(demoA);
    setSurveyBPoints(points);
    setSurveyBErrors([]);
    const lines = ['Name,Easting,Northing,Elevation'];
    points.forEach((p, i) => lines.push(`P${i + 1},${p.easting},${p.northing},${p.elevation}`));
    setSurveyBText(lines.slice(0, 20).join('\n') + `\n... (${points.length} total points)`);
  }, []);

  const clearSurvey = useCallback((survey: 'A' | 'B') => {
    if (survey === 'A') {
      setSurveyAPoints([]);
      setSurveyAText('');
      setSurveyAErrors([]);
    } else {
      setSurveyBPoints([]);
      setSurveyBText('');
      setSurveyBErrors([]);
    }
  }, []);

  // ─── Volume computation ───────────────────────────────────────────────

  const handleCompute = useCallback(() => {
    setComputing(true);
    setComputeErrors([]);
    setComputeWarnings([]);

    try {
      if (surveyAPoints.length < 3) {
        setComputeErrors(['Survey A requires at least 3 points.']);
        setComputing(false);
        return;
      }
      if (surveyBPoints.length < 3) {
        setComputeErrors(['Survey B requires at least 3 points.']);
        setComputing(false);
        return;
      }
      if (!overlapBBox) {
        setComputeErrors(['Survey extents do not overlap. Cannot compute volume.']);
        setComputing(false);
        return;
      }

      const spacing = Math.max(0.1, Math.min(5.0, gridSpacing));
      const oArea = (overlapBBox.maxE - overlapBBox.minE) * (overlapBBox.maxN - overlapBBox.minN);

      if (method === 'tin') {
        const spotsA = toSpotHeights(surveyAPoints);
        const spotsB = toSpotHeights(surveyBPoints);
        const tinA = buildTINSurface(spotsA);
        const tinB = buildTINSurface(spotsB);

        if (tinA.triangles.length === 0) {
          setComputeErrors(['Survey A: TIN triangulation failed (possibly collinear points).']);
          setComputing(false);
          return;
        }
        if (tinB.triangles.length === 0) {
          setComputeErrors(['Survey B: TIN triangulation failed (possibly collinear points).']);
          setComputing(false);
          return;
        }

        const result = computeVolumeBetweenSurfaces(tinA, tinB, spacing);
        setCutVolume(result.cut);
        setFillVolume(result.fill);
        setNetVolume(result.net);
        setOverlapArea(oArea);

        // Compute balance point
        const bp = computeBalancePoint(tinA, tinB, spacing);
        setBalancePoint(bp);

        // Compute grid cells
        const grid = computeGridCells('tin', tinA, tinB, surveyAPoints, surveyBPoints, spacing);
        setGridCells(grid.cells);
        setGridBBox(grid.bbox);
      } else {
        const input: SurfaceVolumeGridInput = {
          existing: surveyAPoints,
          design: surveyBPoints,
          gridSpacing: spacing,
          power: 2,
        };
        const result: SurfaceVolumeGridResult = surfaceCutFillVolumeGrid(input);
        setCutVolume(result.cutVolume);
        setFillVolume(result.fillVolume);
        setNetVolume(result.netVolume);
        setOverlapArea(oArea);
        setComputeWarnings(result.warnings);
        setBalancePoint(null);

        // Compute grid cells for visualization
        const spotsA = toSpotHeights(surveyAPoints);
        const spotsB = toSpotHeights(surveyBPoints);
        const tinA = buildTINSurface(spotsA);
        const tinB = buildTINSurface(spotsB);
        const grid = computeGridCells('idw', tinA, tinB, surveyAPoints, surveyBPoints, spacing);
        setGridCells(grid.cells);
        setGridBBox(grid.bbox);
      }

      hasComputed.current = true;
    } catch (err: unknown) {
      setComputeErrors([(err as Error).message || 'An unknown error occurred during computation.']);
    } finally {
      setComputing(false);
    }
  }, [surveyAPoints, surveyBPoints, method, gridSpacing, overlapBBox]);

  // ─── Export functions ───────────────────────────────────────────────────

  const exportResultsCSV = useCallback(() => {
    if (cutVolume === null || fillVolume === null || netVolume === null) return;
    const now = new Date().toISOString();
    const header = [
      'Volume Comparison Report',
      `Generated: ${now}`,
      `Method: ${method === 'tin' ? 'TIN Interpolation' : 'IDW Grid'}`,
      `Grid Spacing: ${gridSpacing}m`,
      '',
      'Survey A Points,Count',
      `${surveyAPoints.length}`,
      `Survey A BBox,MinE,${bboxA?.minE ?? ''},MaxE,${bboxA?.maxE ?? ''},MinN,${bboxA?.minN ?? ''},MaxN,${bboxA?.maxN ?? ''}`,
      '',
      'Survey B Points,Count',
      `${surveyBPoints.length}`,
      `Survey B BBox,MinE,${bboxB?.minE ?? ''},MaxE,${bboxB?.maxE ?? ''},MinN,${bboxB?.minN ?? ''},MaxN,${bboxB?.maxN ?? ''}`,
      '',
      'Volume Results',
      `Cut Volume (m³),${cutVolume.toFixed(3)}`,
      `Fill Volume (m³),${fillVolume.toFixed(3)}`,
      `Net Volume (m³),${netVolume.toFixed(3)}`,
      `Overlap Area (m²),${overlapArea?.toFixed(3) ?? ''}`,
      `Cut/Fill Ratio,${fillVolume > 0 ? (cutVolume / fillVolume).toFixed(3) : 'N/A'}`,
      `Balance Point (m),${balancePoint !== null ? balancePoint.toFixed(3) : 'N/A'}`,
    ];
    const csv = header.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'volume_comparison_report.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [cutVolume, fillVolume, netVolume, method, gridSpacing, surveyAPoints, surveyBPoints, bboxA, bboxB, overlapArea, balancePoint]);

  const exportGridCSV = useCallback(() => {
    if (gridCells.length === 0) return;
    const header = 'Easting,Northing,Difference (m),Type';
    const rows = gridCells.map(c =>
      `${c.easting},${c.northing},${c.diff.toFixed(4)},${c.type}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cut_fill_grid.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [gridCells]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ─── CSS classes ────────────────────────────────────────────────────────

  const inputClass = 'w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition-colors';

  const tabs: { id: TabId; label: string; badge?: string }[] = [
    { id: 'surveyA', label: 'Survey A (Existing)', badge: surveyAPoints.length > 0 ? `${surveyAPoints.length} pts` : undefined },
    { id: 'surveyB', label: 'Survey B (As-Built)', badge: surveyBPoints.length > 0 ? `${surveyBPoints.length} pts` : undefined },
    { id: 'analysis', label: 'Analysis Results' },
    { id: 'export', label: 'Export' },
  ];

  // ─── Render helpers ────────────────────────────────────────────────────

  const renderSurveyImport = (survey: 'A' | 'B') => {
    const points = survey === 'A' ? surveyAPoints : surveyBPoints;
    const text = survey === 'A' ? surveyAText : surveyBText;
    const setText = survey === 'A' ? setSurveyAText : setSurveyBText;
    const errors = survey === 'A' ? surveyAErrors : surveyBErrors;
    const bbox = survey === 'A' ? bboxA : bboxB;
    const fileRef = survey === 'A' ? fileInputARef : fileInputBRef;

    const elevations = points.map(p => p.elevation);
    const minElev = elevations.length > 0 ? Math.min(...elevations) : 0;
    const maxElev = elevations.length > 0 ? Math.max(...elevations) : 0;

    return (
      <div className="space-y-6">
        {/* File upload */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              Import {survey === 'A' ? 'Survey A' : 'Survey B'} Point Data
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                Upload File (CSV/TXT/XYZ)
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,.xyz"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, survey);
                }}
              />
              <button
                onClick={() => survey === 'A' ? handleLoadDemoA() : handleLoadDemoB()}
                className="px-3 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Load Demo {survey}
              </button>
            </div>
          </div>

          <p className="text-sm text-[var(--text-secondary)] mb-3">
            Paste point data below or upload a file. Expected columns: <span className="font-mono text-[var(--text-primary)]">Name, Easting, Northing, Elevation</span> (or just 3 numeric columns: E, N, Z). Auto-detects comma, tab, semicolon, or space delimiters.
          </p>

          <textarea
            className={inputClass}
            rows={10}
            placeholder={`Name,Easting,Northing,Elevation\nP1,484575.00,9863075.00,121.500\nP2,484577.00,9863075.00,121.350\n...`}
            value={text}
            onChange={e => setText(e.target.value)}
          />

          <div className="flex gap-3 mt-3">
            <button
              onClick={() => handleLoadFromText(text, survey)}
              className="px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Parse Data
            </button>
            <button
              onClick={() => clearSurvey(survey)}
              className="px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg text-sm hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          </div>

          {errors.length > 0 && (
            <div className="mt-3 p-3 bg-red-900/20 border border-red-800/30 rounded-lg">
              <h4 className="text-sm font-medium text-red-400 mb-1">Parse Errors</h4>
              <ul className="text-xs text-red-300/80 space-y-0.5">
                {errors.map((err, i) => <li key={`${err}-${i}`}>{err}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Stats panel */}
        {points.length > 0 && bbox && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Survey {survey} Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <div className="text-xs text-[var(--text-secondary)] mb-1">Point Count</div>
                <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{points.length}</div>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <div className="text-xs text-[var(--text-secondary)] mb-1">Elevation Range</div>
                <div className="text-lg font-bold font-mono text-[var(--text-primary)]">
                  {minElev.toFixed(1)} — {maxElev.toFixed(1)} m
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">Δ = {(maxElev - minElev).toFixed(2)} m</div>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <div className="text-xs text-[var(--text-secondary)] mb-1">Easting Range</div>
                <div className="text-sm font-mono text-[var(--text-primary)]">
                  {bbox.minE.toFixed(1)} — {bbox.maxE.toFixed(1)}
                </div>
                <div className="text-xs text-[var(--text-muted)]">Width: {(bbox.maxE - bbox.minE).toFixed(1)} m</div>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <div className="text-xs text-[var(--text-secondary)] mb-1">Northing Range</div>
                <div className="text-sm font-mono text-[var(--text-primary)]">
                  {bbox.minN.toFixed(1)} — {bbox.maxN.toFixed(1)}
                </div>
                <div className="text-xs text-[var(--text-muted)]">Height: {(bbox.maxN - bbox.minN).toFixed(1)} m</div>
              </div>
            </div>

            {/* Overlap indicator for Survey B */}
            {survey === 'B' && bboxA && overlapBBox && (
              <div className={`mt-4 p-4 rounded-lg border ${overlapPct > 50 ? 'bg-emerald-900/20 border-emerald-800/30' : overlapPct > 10 ? 'bg-amber-900/20 border-amber-800/30' : 'bg-red-900/20 border-red-800/30'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Overlap with Survey A</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      ({overlapBBox.minE.toFixed(1)}, {overlapBBox.minN.toFixed(1)}) to ({overlapBBox.maxE.toFixed(1)}, {overlapBBox.maxN.toFixed(1)})
                    </div>
                  </div>
                  <div className={`text-2xl font-bold font-mono ${overlapPct > 50 ? 'text-emerald-400' : overlapPct > 10 ? 'text-amber-400' : 'text-red-400'}`}>
                    {overlapPct.toFixed(1)}%
                  </div>
                </div>
              </div>
            )}

            {/* Point preview table */}
            <div className="mt-4">
              <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">
                Point Preview (first 10 of {points.length})
              </h4>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                      <th className="text-left py-1.5 px-2">#</th>
                      <th className="text-right py-1.5 px-2">Easting</th>
                      <th className="text-right py-1.5 px-2">Northing</th>
                      <th className="text-right py-1.5 px-2">Elevation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.slice(0, 10).map((p, i) => (
                      <tr key={`${p}-${i}`} className="border-b border-[color-mix(in_srgb,var(--border-color)_30%,transparent)]">
                        <td className="py-1.5 px-2 text-[var(--text-muted)]">{i + 1}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{p.easting.toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{p.northing.toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{p.elevation.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {points.length === 0 && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-12 text-center">
            <div className="text-4xl mb-3 opacity-40">[Compass]</div>
            <p className="text-[var(--text-secondary)]">
              No data loaded for Survey {survey}.
            </p>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Upload a CSV/TXT/XYZ file, paste data, or load demo data.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderAnalysis = () => {
    const total = (cutVolume ?? 0) + (fillVolume ?? 0);
    const cutPct = total > 0 ? ((cutVolume ?? 0) / total) * 100 : 0;
    const fillPct = total > 0 ? ((fillVolume ?? 0) / total) * 100 : 0;
    const maxAbsDiff = gridCells.length > 0 ? Math.max(...gridCells.map(c => Math.abs(c.diff)), 0.001) : 1;

    return (
      <div className="space-y-6">
        {/* Configuration panel */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Computation Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2" htmlFor="grid-spacing-m">Grid Spacing (m)</label>
              <input id="grid-spacing-m" aria-label="Grid Spacing (m)"
                type="number"
                min={0.1}
                max={5.0}
                step={0.1}
                value={gridSpacing}
                onChange={e => setGridSpacing(Math.max(0.1, Math.min(5.0, Number(e.target.value))))}
                className={inputClass}
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">Range: 0.1 — 5.0 m (default: 1.0)</p>
            </div>
            <div>
              <div className="block text-sm text-[var(--text-secondary)] mb-2">Method</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setMethod('tin')}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${method === 'tin' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)]'}`}
                >
                  TIN Interpolation
                </button>
                <button
                  onClick={() => setMethod('idw')}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${method === 'idw' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)]'}`}
                >
                  IDW Grid
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {method === 'tin' ? 'Delaunay TIN with barycentric interpolation' : 'Inverse Distance Weighting (power=2)'}
              </p>
            </div>
            <div>
              <button
                onClick={handleCompute}
                disabled={computing || surveyAPoints.length < 3 || surveyBPoints.length < 3 || !overlapBBox}
                className="w-full px-4 py-3 bg-[var(--accent)] text-black rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {computing ? 'Computing...' : 'Compute Volume'}
              </button>
              {!overlapBBox && surveyAPoints.length >= 3 && surveyBPoints.length >= 3 && (
                <p className="text-xs text-red-400 mt-1">Surveys do not overlap.</p>
              )}
            </div>
          </div>
        </div>

        {/* Errors */}
        {computeErrors.length > 0 && (
          <div className="p-4 bg-red-900/20 border border-red-800/30 rounded-lg">
            <h4 className="text-sm font-medium text-red-400 mb-1">Computation Errors</h4>
            <ul className="text-xs text-red-300/80 space-y-0.5">
              {computeErrors.map((err, i) => <li key={`${err}-${i}`}>{err}</li>)}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {computeWarnings.length > 0 && (
          <div className="p-4 bg-amber-900/20 border border-amber-800/30 rounded-lg">
            <h4 className="text-sm font-medium text-amber-400 mb-1">Warnings</h4>
            <ul className="text-xs text-amber-300/80 space-y-0.5">
              {computeWarnings.map((w, i) => <li key={`${w}-${i}`}>{w}</li>)}
            </ul>
          </div>
        )}

        {/* Results */}
        {cutVolume !== null && fillVolume !== null && netVolume !== null && (
          <>
            {/* Volume Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[#8B4513]/15 border border-[#8B4513]/40 rounded-lg">
                <div className="text-xs text-[#D2691E] mb-1">Cut Volume</div>
                <div className="text-2xl font-bold font-mono text-[#D2691E]">{cutVolume.toFixed(2)} m³</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  Material removed ({cutPct.toFixed(1)}%)
                </div>
              </div>
              <div className="p-4 bg-[#4169E1]/15 border border-[#4169E1]/40 rounded-lg">
                <div className="text-xs text-[#6495ED] mb-1">Fill Volume</div>
                <div className="text-2xl font-bold font-mono text-[#6495ED]">{fillVolume.toFixed(2)} m³</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  Material added ({fillPct.toFixed(1)}%)
                </div>
              </div>
              <div className={`p-4 border rounded-lg ${netVolume >= 0 ? 'bg-amber-900/20 border-amber-800/30' : 'bg-blue-900/20 border-blue-800/30'}`}>
                <div className={`text-xs mb-1 ${netVolume >= 0 ? 'text-amber-400' : 'text-blue-400'}`}>Net Volume</div>
                <div className={`text-2xl font-bold font-mono ${netVolume >= 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                  {netVolume >= 0 ? '+' : ''}{netVolume.toFixed(2)} m³
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {netVolume >= 0 ? 'Cut dominant — surplus material' : 'Fill dominant — borrow needed'}
                </div>
              </div>
              <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg">
                <div className="text-xs text-[var(--text-secondary)] mb-1">Area Overlap</div>
                <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{overlapArea?.toFixed(2)} m²</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  Grid: {gridSpacing}m spacing
                </div>
              </div>
            </div>

            {/* Cut/Fill Bar */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Cut / Fill Balance</h3>
              <div className="relative h-12 rounded-lg overflow-hidden flex">
                {cutPct > 0 && (
                  <div
                    className="flex items-center justify-center transition-all duration-500"
                    style={{
                      width: `${cutPct}%`,
                      backgroundColor: '#8B4513',
                      minWidth: cutVolume > 0 ? '40px' : '0',
                    }}
                  >
                    <span className="text-white text-xs font-mono font-bold drop-shadow">
                      Cut {cutPct.toFixed(0)}%
                    </span>
                  </div>
                )}
                {fillPct > 0 && (
                  <div
                    className="flex items-center justify-center transition-all duration-500"
                    style={{
                      width: `${fillPct}%`,
                      backgroundColor: '#4169E1',
                      minWidth: fillVolume > 0 ? '40px' : '0',
                    }}
                  >
                    <span className="text-white text-xs font-mono font-bold drop-shadow">
                      Fill {fillPct.toFixed(0)}%
                    </span>
                  </div>
                )}
                {total === 0 && (
                  <div className="w-full flex items-center justify-center bg-gray-600">
                    <span className="text-white text-xs">No volume</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between mt-2 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#8B4513' }} />
                  Cut (Survey A &gt; B)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#4169E1' }} />
                  Fill (Survey B &gt; A)
                </span>
              </div>
            </div>

            {/* Additional metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fillVolume > 0 && (
                <div className="p-4 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
                  <div className="text-xs text-[var(--text-secondary)] mb-1">Cut/Fill Ratio</div>
                  <div className="text-xl font-bold font-mono text-[var(--text-primary)]">{(cutVolume / fillVolume).toFixed(3)}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    {Math.abs(cutVolume / fillVolume - 1) < 0.05
                      ? 'Nearly balanced — minimal import/export'
                      : cutVolume / fillVolume > 1
                        ? 'Cut surplus — export material needed'
                        : 'Fill deficit — import material needed'}
                  </div>
                </div>
              )}
              {balancePoint !== null && (
                <div className="p-4 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
                  <div className="text-xs text-[var(--text-secondary)] mb-1">Balance Point (Datum)</div>
                  <div className="text-xl font-bold font-mono text-[var(--text-primary)]">{balancePoint.toFixed(3)} m</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    Elevation where cut = fill
                  </div>
                </div>
              )}
              <div className="p-4 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)]">
                <div className="text-xs text-[var(--text-secondary)] mb-1">Computation Method</div>
                <div className="text-xl font-bold font-mono text-[var(--text-primary)]">
                  {method === 'tin' ? 'TIN' : 'IDW'}
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  Grid spacing: {gridSpacing}m | {gridCells.length} cells evaluated
                </div>
              </div>
            </div>

            {/* Per-cell grid visualization */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Per-Cell Analysis Grid</h3>
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg text-xs hover:border-[var(--accent)] transition-colors"
                >
                  {showGrid ? 'Hide Grid' : 'Show Grid'}
                </button>
              </div>

              {showGrid && gridCells.length > 0 && (
                <div className="overflow-x-auto">
                  <svg
                    viewBox={`${gridBBox.minE} ${gridBBox.minN} ${gridBBox.maxE - gridBBox.minE} ${gridBBox.maxN - gridBBox.minN}`}
                    className="w-full border border-[var(--border-color)] rounded bg-[#1a1a1a]"
                    style={{ minHeight: 300, maxHeight: 600 }}
                  >
                    {gridCells.map((cell, i) => {
                      const opacity = Math.min(1, (Math.abs(cell.diff) / maxAbsDiff) * 0.85 + 0.15);
                      let color: string;
                      if (cell.type === 'cut') color = `rgba(139, 69, 19, ${opacity})`;
                      else if (cell.type === 'fill') color = `rgba(65, 105, 225, ${opacity})`;
                      else color = `rgba(128, 128, 128, 0.15)`;

                      return (
                        <g key={`${cell}-${i}`}>
                          <rect
                            x={cell.easting}
                            y={cell.northing}
                            width={gridSpacing}
                            height={gridSpacing}
                            fill={color}
                            stroke="#333"
                            strokeWidth={0.5}
                          />
                        </g>
                      );
                    })}
                    {/* Scale reference */}
                    <rect
                      x={gridBBox.minE + 2}
                      y={gridBBox.minN + 2}
                      width={10 * gridSpacing}
                      height={5 * gridSpacing}
                      fill="none"
                      stroke="#fff"
                      strokeWidth={1}
                      rx={2}
                    />
                    <text
                      x={gridBBox.minE + 2 + 5 * gridSpacing}
                      y={gridBBox.minN + 2 + 5 * gridSpacing + 4}
                      fill="#fff"
                      fontSize={gridSpacing * 2}
                      textAnchor="middle"
                    >
                      {10 * gridSpacing}m
                    </text>
                  </svg>

                  {/* Legend */}
                  <div className="flex items-center gap-6 mt-3 text-xs text-[var(--text-muted)] justify-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#8B4513' }} />
                      <span>Cut (A higher)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#4169E1' }} />
                      <span>Fill (B higher)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-sm" style={{ backgroundColor: 'rgba(128, 128, 128, 0.15)', border: '1px solid #555' }} />
                      <span>No change</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[var(--text-secondary)]">Opacity ∝ magnitude</span>
                    </div>
                  </div>

                  {/* Grid stats */}
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="p-3 bg-[var(--bg-tertiary)] rounded text-center">
                      <div className="text-xs text-[var(--text-muted)]">Cut Cells</div>
                      <div className="text-lg font-bold font-mono text-[#D2691E]">
                        {gridCells.filter(c => c.type === 'cut').length}
                      </div>
                    </div>
                    <div className="p-3 bg-[var(--bg-tertiary)] rounded text-center">
                      <div className="text-xs text-[var(--text-muted)]">Fill Cells</div>
                      <div className="text-lg font-bold font-mono text-[#6495ED]">
                        {gridCells.filter(c => c.type === 'fill').length}
                      </div>
                    </div>
                    <div className="p-3 bg-[var(--bg-tertiary)] rounded text-center">
                      <div className="text-xs text-[var(--text-muted)]">No Change</div>
                      <div className="text-lg font-bold font-mono text-[var(--text-secondary)]">
                        {gridCells.filter(c => c.type === 'none').length}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!showGrid && gridCells.length > 0 && (
                <p className="text-sm text-[var(--text-secondary)]">
                  Click &quot;Show Grid&quot; to display {gridCells.length} color-coded cells.
                </p>
              )}

              {gridCells.length === 0 && hasComputed.current && (
                <p className="text-sm text-[var(--text-muted)]">
                  No grid cells were computed. Ensure both surveys have overlapping extents.
                </p>
              )}
            </div>
          </>
        )}

        {/* Not yet computed */}
        {cutVolume === null && computeErrors.length === 0 && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-12 text-center">
            <div className="text-4xl mb-3 opacity-40">[Chart]</div>
            <p className="text-[var(--text-secondary)]">
              Configure settings and click &quot;Compute Volume&quot; to see results.
            </p>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Load data for both Survey A and Survey B first.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderExport = () => {
    const canExport = cutVolume !== null && fillVolume !== null;

    return (
      <div className="space-y-6">
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Export Options</h3>

          {!canExport && (
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Run the volume computation first before exporting results.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Export results CSV */}
            <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl"></span>
                <div>
                  <h4 className="font-medium text-sm">Results Summary (CSV)</h4>
                  <p className="text-xs text-[var(--text-muted)]">Volume metadata + statistics</p>
                </div>
              </div>
              <button
                onClick={exportResultsCSV}
                disabled={!canExport}
                className="w-full px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Export Results CSV
              </button>
            </div>

            {/* Export grid CSV */}
            <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">[Compass]</span>
                <div>
                  <h4 className="font-medium text-sm">Cut/Fill Grid (CSV)</h4>
                  <p className="text-xs text-[var(--text-muted)]">Per-cell easting, northing, diff, type</p>
                </div>
              </div>
              <button
                onClick={exportGridCSV}
                disabled={gridCells.length === 0}
                className="w-full px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Export Grid CSV ({gridCells.length} cells)
              </button>
            </div>

            {/* Print report */}
            <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl"></span>
                <div>
                  <h4 className="font-medium text-sm">Print-Friendly Report</h4>
                  <p className="text-xs text-[var(--text-muted)]">Browser print dialog</p>
                </div>
              </div>
              <button
                onClick={handlePrint}
                disabled={!canExport}
                className="w-full px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Print Report
              </button>
            </div>
          </div>
        </div>

        {/* Print preview (visible only during print) */}
        {canExport && (
          <div className="print:block hidden">
            <h1 className="text-2xl font-bold mb-4">Volume Comparison Report</h1>
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <div className="font-medium">Survey A: {surveyAPoints.length} points</div>
                {bboxA && <div>BBox: E {bboxA.minE.toFixed(1)}–{bboxA.maxE.toFixed(1)}, N {bboxA.minN.toFixed(1)}–{bboxA.maxN.toFixed(1)}</div>}
              </div>
              <div>
                <div className="font-medium">Survey B: {surveyBPoints.length} points</div>
                {bboxB && <div>BBox: E {bboxB.minE.toFixed(1)}–{bboxB.maxE.toFixed(1)}, N {bboxB.minN.toFixed(1)}–{bboxB.maxN.toFixed(1)}</div>}
              </div>
            </div>
            <div className="border-t border-b py-4 mb-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-gray-500">Cut Volume</div>
                  <div className="text-xl font-bold">{cutVolume?.toFixed(2)} m³</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Fill Volume</div>
                  <div className="text-xl font-bold">{fillVolume?.toFixed(2)} m³</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Net Volume</div>
                  <div className="text-xl font-bold">{netVolume?.toFixed(2)} m³</div>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Method: {method === 'tin' ? 'TIN Interpolation' : 'IDW Grid'} | Grid Spacing: {gridSpacing}m | Balance Point: {balancePoint !== null ? `${balancePoint.toFixed(3)}m` : 'N/A'}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Main render ────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title={t('tools.volumeComparison')}
        subtitle={t('tools.volumeComparisonDesc')}
      />

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-[var(--accent)] text-black'
                : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[color-mix(in_srgb,var(--accent)_50%,transparent)]'
            }`}
          >
            {tab.label}
            {tab.badge && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id
                  ? 'bg-black/20 text-black'
                  : 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'surveyA' && renderSurveyImport('A')}
      {activeTab === 'surveyB' && renderSurveyImport('B')}
      {activeTab === 'analysis' && renderAnalysis()}
      {activeTab === 'export' && renderExport()}
    </div>
  );
}
