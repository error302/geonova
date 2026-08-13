'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  type DTMPoint,
  type SlopeAnalysisResult,
  type CutFillDatumResult,
  analyzeSlopeFromPoints,
  computeCutFillDatum,
  slopeAnalysisToCSV,
  computeAreaBetweenPoints,
} from '@/lib/engineering/slopeAnalysis';

// ─── Props ──────────────────────────────────────────────────────────────────

interface SlopeAnalysisPanelProps {
  projectId?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SLOPE_CLASS_COLORS: Record<string, { bg: string; fill: string; label: string; range: string }> = {
  flat: { bg: 'bg-green-500', fill: '#22c55e', label: 'Flat', range: '0 – 2%' },
  gentle: { bg: 'bg-yellow-400', fill: '#facc15', label: 'Gentle', range: '2 – 5%' },
  moderate: { bg: 'bg-orange-500', fill: '#f97316', label: 'Moderate', range: '5 – 15%' },
  steep: { bg: 'bg-red-500', fill: '#ef4444', label: 'Steep', range: '15 – 35%' },
  very_steep: { bg: 'bg-red-800', fill: '#991b1b', label: 'Very Steep', range: '35 – 60%' },
  cliff: { bg: 'bg-[#800020]', fill: '#800020', label: 'Cliff', range: '> 60%' },
};

const CLASS_ORDER = ['flat', 'gentle', 'moderate', 'steep', 'very_steep', 'cliff'] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseDTMCSV(text: string): DTMPoint[] {
  const lines = text
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('E') && !l.startsWith('Point'));

  const points: DTMPoint[] = [];
  for (const line of lines) {
    // Try comma, tab, space, semicolon separators
    const parts = line.split(/[,;\t]+/).map((s) => s.trim());
    if (parts.length < 2) continue;

    const e = parseFloat(parts[0]);
    const n = parseFloat(parts[1]);
    const z = parts.length >= 3 ? parseFloat(parts[2]) : 0;

    if (isNaN(e) || isNaN(n)) continue;

    points.push({ easting: e, northing: n, elevation: isNaN(z) ? 0 : z });
  }

  return points;
}

function parsePolygonCSV(text: string): DTMPoint[] {
  const lines = text
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('E'));

  const points: DTMPoint[] = [];
  for (const line of lines) {
    const parts = line.split(/[,;\t]+/).map((s) => s.trim());
    if (parts.length < 2) continue;

    const e = parseFloat(parts[0]);
    const n = parseFloat(parts[1]);

    if (isNaN(e) || isNaN(n)) continue;

    points.push({ easting: e, northing: n, elevation: 0 });
  }

  return points;
}

function generateDemoData(): DTMPoint[] {
  const points: DTMPoint[] = [];
  const baseE = 357600;
  const baseN = 9988200;
  const spacing = 5;

  // Create a 20×20 grid with synthetic terrain
  for (let r = 0; r < 20; r++) {
    for (let c = 0; c < 20; c++) {
      const e = baseE + c * spacing;
      const n = baseN + r * spacing;

      // Gentle slope + hill + valley

      // Gentle overall slope (north to south)
      let z = 1500 - r * 0.8;

      // Hill in the center-right area
      const hillDist = Math.sqrt(Math.pow(c - 14, 2) + Math.pow(r - 7, 2));
      z += 8 * Math.exp(-hillDist * hillDist / 25);

      // Valley running diagonally
      const valleyDist = Math.abs(2 * (c - 10) - (r - 10));
      z -= 4 * Math.exp(-valleyDist * valleyDist / 10);

      // Small random variation
      z += (Math.sin(c * 1.3) * Math.cos(r * 1.7)) * 0.5;

      points.push({ easting: e, northing: n, elevation: z });
    }
  }

  return points;
}

function fmt(val: number, decimals = 2): string {
  return val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtShort(val: number): string {
  if (Math.abs(val) >= 1_000_000) return (val / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(val) >= 1_000) return (val / 1_000).toFixed(1) + 'K';
  return fmt(val, 1);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SlopeAnalysisPanel({ projectId }: SlopeAnalysisPanelProps) {
  // Data state
  const [rawText, setRawText] = useState('');
  const [points, setPoints] = useState<DTMPoint[]>([]);
  const [pointCount, setPointCount] = useState(0);

  // Settings
  const [gridRes, setGridRes] = useState<string>('auto');
  const [minElev, setMinElev] = useState<string>('');
  const [maxElev, setMaxElev] = useState<string>('');

  // Analysis results
  const [slopeResult, setSlopeResult] = useState<SlopeAnalysisResult | null>(null);
  const [cutFillResult, setCutFillResult] = useState<CutFillDatumResult | null>(null);
  const [cutFillDatum, setCutFillDatum] = useState<string>('1500');
  const [areaResult, setAreaResult] = useState<number | null>(null);

  // Polygon area
  const [polyText, setPolyText] = useState('');
  const [polyPoints, setPolyPoints] = useState<DTMPoint[]>([]);

  // Loading
  const [analyzing, setAnalyzing] = useState(false);
  const [cutFillLoading, setCutFillLoading] = useState(false);

  // Error
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Point extent ──

  const extent = useMemo(() => {
    if (points.length === 0) return null;
    let minE = Infinity, minN = Infinity, maxE = -Infinity, maxN = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const p of points) {
      if (p.easting < minE) minE = p.easting;
      if (p.northing < minN) minN = p.northing;
      if (p.easting > maxE) maxE = p.easting;
      if (p.northing > maxN) maxN = p.northing;
      if (p.elevation < minZ) minZ = p.elevation;
      if (p.elevation > maxZ) maxZ = p.elevation;
    }
    return { minE, minN, maxE, maxN, minZ, maxZ };
  }, [points]);

  // ── Filter points by elevation ──

  const filteredPoints = useMemo(() => {
    let pts = points;
    const minE = minElev !== '' ? parseFloat(minElev) : null;
    const maxE = maxElev !== '' ? parseFloat(maxElev) : null;
    if (minE !== null && !isNaN(minE)) pts = pts.filter((p) => p.elevation >= minE);
    if (maxE !== null && !isNaN(maxE)) pts = pts.filter((p) => p.elevation <= maxE);
    return pts;
  }, [points, minElev, maxElev]);

  // ── CSV file import ──

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRawText(text);
      const pts = parseDTMCSV(text);
      setPoints(pts);
      setPointCount(pts.length);
      setError(null);
      setSlopeResult(null);
      setCutFillResult(null);
    };
    reader.readAsText(file);
    // Reset the input so the same file can be re-selected
    e.target.value = '';
  }, []);

  // ── Parse textarea ──

  const handleParseText = useCallback(() => {
    const pts = parseDTMCSV(rawText);
    setPoints(pts);
    setPointCount(pts.length);
    setError(null);
    setSlopeResult(null);
    setCutFillResult(null);
  }, [rawText]);

  // ── Load demo data ──

  const handleLoadDemo = useCallback(() => {
    const demo = generateDemoData();
    const csvLines = ['Easting,Northing,Elevation', ...demo.map((p) => `${p.easting},${p.northing},${p.elevation.toFixed(3)}`)];
    const csv = csvLines.join('\n');
    setRawText(csv);
    setPoints(demo);
    setPointCount(demo.length);
    setError(null);
    setSlopeResult(null);
    setCutFillResult(null);
  }, []);

  // ── Slope Analysis ──

  const handleSlopeAnalysis = useCallback(() => {
    if (filteredPoints.length < 3) {
      setError('At least 3 DTM points are required for slope analysis.');
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const res = gridRes === 'auto' || isNaN(parseFloat(gridRes))
        ? analyzeSlopeFromPoints(filteredPoints)
        : analyzeSlopeFromPoints(filteredPoints, parseFloat(gridRes));
      setSlopeResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? (err as Error).message : 'Slope analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  }, [filteredPoints, gridRes]);

  // ── Cut/Fill Analysis ──

  const handleCutFill = useCallback(() => {
    const datum = parseFloat(cutFillDatum);
    if (isNaN(datum)) {
      setError('Please enter a valid datum RL.');
      return;
    }
    if (filteredPoints.length < 3) {
      setError('At least 3 DTM points are required for cut/fill analysis.');
      return;
    }
    setCutFillLoading(true);
    setError(null);
    try {
      const res = gridRes === 'auto' || isNaN(parseFloat(gridRes))
        ? computeCutFillDatum(filteredPoints, datum)
        : computeCutFillDatum(filteredPoints, datum, parseFloat(gridRes));
      setCutFillResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? (err as Error).message : 'Cut/fill analysis failed.');
    } finally {
      setCutFillLoading(false);
    }
  }, [filteredPoints, cutFillDatum, gridRes]);

  // ── Area Computation ──

  const handleAreaCompute = useCallback(() => {
    const pts = parsePolygonCSV(polyText);
    if (pts.length < 3) {
      setError('At least 3 polygon points are required for area computation.');
      return;
    }
    setPolyPoints(pts);
    const area = computeAreaBetweenPoints(pts);
    setAreaResult(area);
    setError(null);
  }, [polyText]);

  // ── Export CSVs ──

  const handleExportSlopeCSV = useCallback(() => {
    if (!slopeResult) return;
    const csv = slopeAnalysisToCSV(slopeResult);
    downloadBlob(csv, `slope_analysis_${projectId || 'export'}.csv`, 'text/csv');
  }, [slopeResult, projectId]);

  const handleExportCutFillCSV = useCallback(() => {
    if (!cutFillResult) return;
    const lines: string[] = [
      'Easting,Northing,Existing RL,Design RL,Difference,Classification',
      ...cutFillResult.points.map((p) => {
        const cls = p.difference > 0 ? 'Cut' : p.difference < 0 ? 'Fill' : 'On Grade';
        return `${p.easting.toFixed(4)},${p.northing.toFixed(4)},${p.existingRL.toFixed(4)},${p.designRL.toFixed(4)},${p.difference.toFixed(4)},${cls}`;
      }),
      '',
      'SUMMARY',
      `Cut Volume (m³),${cutFillResult.totalCutVolume.toFixed(3)}`,
      `Fill Volume (m³),${cutFillResult.totalFillVolume.toFixed(3)}`,
      `Net Volume (m³),${cutFillResult.netVolume.toFixed(3)}`,
      `Cut Area (m²),${cutFillResult.cutArea.toFixed(2)}`,
      `Fill Area (m²),${cutFillResult.fillArea.toFixed(2)}`,
      `Balance Point RL,${cutFillResult.balancePoint.toFixed(3)}`,
    ];
    downloadBlob(lines.join('\n'), `cutfill_analysis_${projectId || 'export'}.csv`, 'text/csv');
  }, [cutFillResult, projectId]);

  // ── SVG Slope Heatmap ──

  const slopeHeatmapSVG = useMemo(() => {
    if (!slopeResult || slopeResult.slopePoints.length === 0) return null;

    const bb = slopeResult.boundingBox;
    const rangeE = bb.maxE - bb.minE || 1;
    const rangeN = bb.maxN - bb.minN || 1;

    // Determine grid dimensions from unique E/N values
    const eValues = Array.from(new Set(slopeResult.slopePoints.map((p) => p.easting))).sort((a, b) => a - b);
    const nValues = Array.from(new Set(slopeResult.slopePoints.map((p) => p.northing))).sort((a, b) => b - a);

    const cols = eValues.length;
    const rows = nValues.length;
    if (rows < 2 || cols < 2) return null;

    const svgW = 600;
    const svgH = Math.min(400, (rows / cols) * 600);
    const pad = 40;
    const cellW = (svgW - pad * 2) / (cols - 1 || 1);
    const cellH = (svgH - pad * 2) / (rows - 1 || 1);

    const mapE = (v: number) => pad + ((v - bb.minE) / rangeE) * (svgW - pad * 2);
    const mapN = (v: number) => pad + ((bb.maxN - v) / rangeN) * (svgH - pad * 2);

    // Build a lookup map for fast access
    const pointMap = new Map<string, typeof slopeResult.slopePoints[0]>();
    for (const sp of slopeResult.slopePoints) {
      const key = `${sp.easting.toFixed(3)},${sp.northing.toFixed(3)}`;
      pointMap.set(key, sp);
    }

    const rects: React.ReactNode[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const e = eValues[c];
        const n = nValues[r];
        const key = `${e.toFixed(3)},${n.toFixed(3)}`;
        const sp = pointMap.get(key);
        if (!sp) continue;

        const color = SLOPE_CLASS_COLORS[sp.slopeClass]?.fill || '#666';
        const x = mapE(e) - cellW / 2;
        const y = mapN(n) - cellH / 2;

        rects.push(
          <rect
            key={`${r}-${c}`}
            x={x}
            y={y}
            width={cellW + 0.5}
            height={cellH + 0.5}
            fill={color}
            opacity={0.85}
            stroke="#1a1a2e"
            strokeWidth={0.3}
          />
        );
      }
    }

    return (
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full max-w-2xl mx-auto rounded-lg border border-zinc-700 bg-zinc-900"
        role="img"
        aria-label="Slope classification heatmap"
      >
        {/* Grid border */}
        <rect
          x={pad - cellW / 2}
          y={pad - cellH / 2}
          width={svgW - pad * 2 + cellW}
          height={svgH - pad * 2 + cellH}
          fill="none"
          stroke="#444"
          strokeWidth={1}
        />

        {/* Heatmap cells */}
        {rects}

        {/* Legend */}
        <g transform={`translate(${svgW - 160}, ${svgH - 30})`}>
          <text x="0" y="0" fill="#aaa" fontSize="10" fontFamily="monospace">0%</text>
          <rect x="25" y="-8" width="20" height="10" fill={SLOPE_CLASS_COLORS.flat.fill} />
          <rect x="45" y="-8" width="20" height="10" fill={SLOPE_CLASS_COLORS.gentle.fill} />
          <rect x="65" y="-8" width="20" height="10" fill={SLOPE_CLASS_COLORS.moderate.fill} />
          <rect x="85" y="-8" width="20" height="10" fill={SLOPE_CLASS_COLORS.steep.fill} />
          <rect x="105" y="-8" width="20" height="10" fill={SLOPE_CLASS_COLORS.very_steep.fill} />
          <rect x="125" y="-8" width="20" height="10" fill={SLOPE_CLASS_COLORS.cliff.fill} />
          <text x="148" y="0" fill="#aaa" fontSize="10" fontFamily="monospace">&gt;60%</text>
        </g>

        {/* Grid resolution label */}
        <text x="pad" y={svgH - 8} fill="#666" fontSize="9" fontFamily="monospace">
          Grid: {slopeResult.gridResolution.toFixed(1)} m
        </text>
      </svg>
    );
  }, [slopeResult]);

  // ── Slope distribution for stacked bar ──

  const slopeDistribution = useMemo(() => {
    if (!slopeResult) return null;
    const dist = slopeResult.statistics.slopeDistribution;
    const areas = slopeResult.statistics.areaByClass;
    const total = slopeResult.statistics.totalArea || 1;

    return CLASS_ORDER.map((cls) => ({
      cls,
      count: dist[cls],
      area: areas[cls],
      pct: ((areas[cls] / total) * 100),
    }));
  }, [slopeResult]);

  // ── Cut/fill table sample ──

  const cutFillSample = useMemo(() => {
    if (!cutFillResult) return [];
    // Show a subset of points (max 50)
    const pts = cutFillResult.points;
    if (pts.length <= 50) return pts;
    const step = Math.ceil(pts.length / 50);
    return pts.filter((_, i) => i % step === 0);
  }, [cutFillResult]);

  // ── Area conversions ──

  const areaConversions = useMemo(() => {
    if (areaResult === null) return null;
    return {
      sqm: areaResult,
      hectares: areaResult / 10000,
      acres: areaResult / 4046.8564224,
    };
  }, [areaResult]);

  // ══════════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">
            Slope &amp; Area Analysis
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            DTM slope classification, cut/fill volumes, and area computation
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadDemo}
          className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:text-blue-400 w-fit"
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 11h4l3-8 3 5 2-3h2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Load Demo Data
        </Button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Data Input ── */}
      <Card className="border-zinc-700 bg-zinc-800/50">
        <CardHeader>
          <CardTitle className="text-zinc-100 text-base">Data Input</CardTitle>
          <CardDescription className="text-zinc-400">
            Import DTM points via CSV or paste coordinates (Easting,Northing,Elevation)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xyz"
              onChange={handleFileImport}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:text-blue-400 w-fit"
            >
              <svg viewBox="0 0 16 16" className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 2v8m0 0l-3-3m3 3l3-3M2 12v2h12v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Import CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleParseText}
              disabled={!rawText.trim()}
              className="border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:text-blue-400 w-fit"
            >
              Parse Text
            </Button>
            <div className="flex-1" />
            <Badge variant="secondary" className="font-mono text-xs bg-zinc-700 text-zinc-300 border-zinc-600">
              {pointCount} points loaded
            </Badge>
          </div>

          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Easting,Northing,Elevation&#10;357600.0,9988200.0,1500.5&#10;357605.0,9988205.0,1501.2&#10;..."
            className="font-mono text-xs bg-zinc-900 border-zinc-600 text-zinc-300 min-h-[120px] max-h-[200px]"
          />

          {/* Extent info */}
          {extent && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs font-mono">
              <div className="bg-zinc-900/60 rounded px-2 py-1.5 border border-zinc-700">
                <span className="text-zinc-500">E min: </span>
                <span className="text-zinc-300">{fmt(extent.minE, 2)}</span>
              </div>
              <div className="bg-zinc-900/60 rounded px-2 py-1.5 border border-zinc-700">
                <span className="text-zinc-500">E max: </span>
                <span className="text-zinc-300">{fmt(extent.maxE, 2)}</span>
              </div>
              <div className="bg-zinc-900/60 rounded px-2 py-1.5 border border-zinc-700">
                <span className="text-zinc-500">N min: </span>
                <span className="text-zinc-300">{fmt(extent.minN, 2)}</span>
              </div>
              <div className="bg-zinc-900/60 rounded px-2 py-1.5 border border-zinc-700">
                <span className="text-zinc-500">N max: </span>
                <span className="text-zinc-300">{fmt(extent.maxN, 2)}</span>
              </div>
              <div className="bg-zinc-900/60 rounded px-2 py-1.5 border border-zinc-700">
                <span className="text-zinc-500">Z min: </span>
                <span className="text-blue-400">{fmt(extent.minZ, 2)}</span>
              </div>
              <div className="bg-zinc-900/60 rounded px-2 py-1.5 border border-zinc-700">
                <span className="text-zinc-500">Z max: </span>
                <span className="text-blue-400">{fmt(extent.maxZ, 2)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Settings ── */}
      <Card className="border-zinc-700 bg-zinc-800/50">
        <CardHeader>
          <CardTitle className="text-zinc-100 text-base">Analysis Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">Grid Resolution (m)</Label>
              <Input
                value={gridRes}
                onChange={(e) => setGridRes(e.target.value)}
                placeholder="auto"
                className="font-mono text-sm bg-zinc-900 border-zinc-600 text-zinc-300"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">Min Elevation Filter</Label>
              <Input
                value={minElev}
                onChange={(e) => setMinElev(e.target.value)}
                placeholder="(none)"
                type="number"
                className="font-mono text-sm bg-zinc-900 border-zinc-600 text-zinc-300"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs">Max Elevation Filter</Label>
              <Input
                value={maxElev}
                onChange={(e) => setMaxElev(e.target.value)}
                placeholder="(none)"
                type="number"
                className="font-mono text-sm bg-zinc-900 border-zinc-600 text-zinc-300"
              />
            </div>
          </div>
          {minElev !== '' || maxElev !== '' ? (
            <p className="text-xs text-zinc-500 mt-2">
              Using {filteredPoints.length} of {points.length} points after elevation filter
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Main Tabs ── */}
      <Tabs defaultValue="slope" className="space-y-4">
        <TabsList className="bg-zinc-800 border border-zinc-700">
          <TabsTrigger value="slope" className="data-[state=active]:bg-zinc-700 data-[state=active]:text-blue-400 text-zinc-400">
            Slope Analysis
          </TabsTrigger>
          <TabsTrigger value="cutfill" className="data-[state=active]:bg-zinc-700 data-[state=active]:text-blue-400 text-zinc-400">
            Cut / Fill
          </TabsTrigger>
          <TabsTrigger value="area" className="data-[state=active]:bg-zinc-700 data-[state=active]:text-blue-400 text-zinc-400">
            Area Computation
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/*  TAB 1: SLOPE ANALYSIS                                           */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="slope" className="space-y-6">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSlopeAnalysis}
              disabled={filteredPoints.length < 3 || analyzing}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {analyzing ? (
                <>
                  <svg className="animate-spin w-4 h-4 mr-1.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
                    <path d="M14 8a6 6 0 01-6 6" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 14l4-8 4 5 4-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Run Analysis
                </>
              )}
            </Button>
            {slopeResult && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSlopeCSV}
                className="border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:text-blue-400"
              >
                <svg viewBox="0 0 16 16" className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 2v8m0 0l-3-3m3 3l3-3M2 12v2h12v-2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Export CSV
              </Button>
            )}
          </div>

          {slopeResult && (
            <>
              {/* ── Summary Cards ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard label="Mean Slope" value={`${fmt(slopeResult.statistics.meanSlopePercent)}%`} accent />
                <SummaryCard label="Max Slope" value={`${fmt(slopeResult.statistics.maxSlopePercent)}%`} accent />
                <SummaryCard label="Min Slope" value={`${fmt(slopeResult.statistics.minSlopePercent)}%`} accent />
                <SummaryCard label="Total Area" value={`${fmtShort(slopeResult.statistics.totalArea)} m²`} accent />
              </div>

              {/* ── Slope Classification Distribution ── */}
              <Card className="border-zinc-700 bg-zinc-800/50">
                <CardHeader>
                  <CardTitle className="text-zinc-100 text-sm">Slope Classification Distribution</CardTitle>
                  <CardDescription className="text-zinc-500 text-xs">
                    Horizontal stacked bar — per KENHA / RDM 1.3 standards
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stacked bar */}
                  {slopeDistribution && (
                    <div className="space-y-3">
                      {/* Full bar */}
                      <div className="flex rounded-full overflow-hidden h-8 w-full">
                        {slopeDistribution.map((item) => (
                          <div
                            key={item.cls}
                            className="flex items-center justify-center transition-all"
                            style={{
                              width: `${item.pct}%`,
                              backgroundColor: SLOPE_CLASS_COLORS[item.cls]?.fill,
                              minWidth: item.pct > 0 ? '2px' : '0px',
                            }}
                            title={`${SLOPE_CLASS_COLORS[item.cls]?.label}: ${fmt(item.area)} m² (${item.pct.toFixed(1)}%)`}
                          >
                            {item.pct > 5 && (
                              <span className="text-[10px] font-mono text-white font-semibold drop-shadow">
                                {item.pct.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Legend */}
                      <div className="flex flex-wrap gap-3">
                        {slopeDistribution.map((item) => (
                          <div key={item.cls} className="flex items-center gap-1.5">
                            <div
                              className="w-3 h-3 rounded-sm"
                              style={{ backgroundColor: SLOPE_CLASS_COLORS[item.cls]?.fill }}
                            />
                            <span className="text-xs text-zinc-400">
                              {SLOPE_CLASS_COLORS[item.cls]?.label} ({item.pct.toFixed(1)}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Area by Class Table ── */}
              <Card className="border-zinc-700 bg-zinc-800/50">
                <CardHeader>
                  <CardTitle className="text-zinc-100 text-sm">Area by Class</CardTitle>
                </CardHeader>
                <CardContent className="max-h-72 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-700 hover:bg-transparent">
                        <TableHead className="text-zinc-400 text-xs">Class</TableHead>
                        <TableHead className="text-zinc-400 text-xs">Range</TableHead>
                        <TableHead className="text-zinc-400 text-xs text-right">Points</TableHead>
                        <TableHead className="text-zinc-400 text-xs text-right">Area (m²)</TableHead>
                        <TableHead className="text-zinc-400 text-xs text-right">Percentage</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slopeDistribution?.map((item) => (
                        <TableRow key={item.cls} className="border-zinc-700/50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2.5 h-2.5 rounded-sm"
                                style={{ backgroundColor: SLOPE_CLASS_COLORS[item.cls]?.fill }}
                              />
                              <span className="font-mono text-sm text-zinc-200">
                                {SLOPE_CLASS_COLORS[item.cls]?.label}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-zinc-400">
                            {SLOPE_CLASS_COLORS[item.cls]?.range}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-zinc-300 text-right">
                            {item.count}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-zinc-300 text-right">
                            {fmt(item.area)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-blue-400 text-right">
                            {item.pct.toFixed(2)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* ── Slope Heatmap Visualization ── */}
              <Card className="border-zinc-700 bg-zinc-800/50">
                <CardHeader>
                  <CardTitle className="text-zinc-100 text-sm">Slope Classification Map</CardTitle>
                  <CardDescription className="text-zinc-500 text-xs">
                    Color-coded grid cells per slope class — North is up
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {slopeHeatmapSVG || (
                    <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
                      Insufficient data for heatmap visualization
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {!slopeResult && !analyzing && (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
              <svg viewBox="0 0 48 48" className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 36L18 12l12 18 12-6" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="18" cy="12" r="2" fill="currentColor" />
                <circle cx="30" cy="30" r="2" fill="currentColor" />
              </svg>
              <p className="text-sm">Load DTM points and run analysis to view results</p>
            </div>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/*  TAB 2: CUT / FILL                                              */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="cutfill" className="space-y-6">
          <Card className="border-zinc-700 bg-zinc-800/50">
            <CardHeader>
              <CardTitle className="text-zinc-100 text-base">Datum Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs">Datum RL (m)</Label>
                  <Input
                    value={cutFillDatum}
                    onChange={(e) => setCutFillDatum(e.target.value)}
                    type="number"
                    step="0.01"
                    placeholder="e.g. 1500.00"
                    className="font-mono text-sm bg-zinc-900 border-zinc-600 text-zinc-300 w-40"
                  />
                </div>
                <Button
                  onClick={handleCutFill}
                  disabled={filteredPoints.length < 3 || cutFillLoading || isNaN(parseFloat(cutFillDatum))}
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {cutFillLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4 mr-1.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
                        <path d="M14 8a6 6 0 01-6 6" />
                      </svg>
                      Computing...
                    </>
                  ) : (
                    'Run Cut/Fill Analysis'
                  )}
                </Button>
                {cutFillResult && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCutFillCSV}
                    className="border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:text-blue-400"
                  >
                    Export CSV
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {cutFillResult && (
            <>
              {/* ── Summary Cards ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard
                  label="Cut Volume"
                  value={`${fmtShort(cutFillResult.totalCutVolume)} m³`}
                  accent
                />
                <SummaryCard
                  label="Fill Volume"
                  value={`${fmtShort(cutFillResult.totalFillVolume)} m³`}
                  accent
                />
                <SummaryCard
                  label="Net Volume"
                  value={`${fmtShort(cutFillResult.netVolume)} m³`}
                  accent
                  valueColor={cutFillResult.netVolume > 0 ? 'text-green-400' : cutFillResult.netVolume < 0 ? 'text-red-400' : 'text-zinc-200'}
                />
                <SummaryCard
                  label="Balance Point"
                  value={`${fmt(cutFillResult.balancePoint, 3)} m`}
                  accent
                />
              </div>

              {/* ── Area Breakdown ── */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-zinc-700 bg-zinc-800/50">
                  <CardContent className="p-4">
                    <p className="text-xs text-zinc-500 mb-1">Cut Area</p>
                    <p className="text-lg font-bold font-mono text-amber-400">
                      {fmt(cutFillResult.cutArea)} m²
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-zinc-700 bg-zinc-800/50">
                  <CardContent className="p-4">
                    <p className="text-xs text-zinc-500 mb-1">Fill Area</p>
                    <p className="text-lg font-bold font-mono text-blue-400">
                      {fmt(cutFillResult.fillArea)} m²
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* ── Sample Points Table ── */}
              <Card className="border-zinc-700 bg-zinc-800/50">
                <CardHeader>
                  <CardTitle className="text-zinc-100 text-sm">
                    Grid Points ({cutFillResult.points.length} total{cutFillSample.length < cutFillResult.points.length ? `, showing ${cutFillSample.length}` : ''})
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-700 hover:bg-transparent">
                        <TableHead className="text-zinc-400 text-xs">Easting</TableHead>
                        <TableHead className="text-zinc-400 text-xs">Northing</TableHead>
                        <TableHead className="text-zinc-400 text-xs text-right">Existing RL</TableHead>
                        <TableHead className="text-zinc-400 text-xs text-right">Design RL</TableHead>
                        <TableHead className="text-zinc-400 text-xs text-right">Difference</TableHead>
                        <TableHead className="text-zinc-400 text-xs">Class</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cutFillSample.map((p, i) => {
                        const cls = p.difference > 0 ? 'Cut' : p.difference < 0 ? 'Fill' : 'On Grade';
                        return (
                          <TableRow key={`${p}-${i}`} className="border-zinc-700/50">
                            <TableCell className="font-mono text-xs text-zinc-300">
                              {p.easting.toFixed(3)}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-zinc-300">
                              {p.northing.toFixed(3)}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-zinc-300 text-right">
                              {p.existingRL.toFixed(3)}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-zinc-300 text-right">
                              {p.designRL.toFixed(3)}
                            </TableCell>
                            <TableCell className={`font-mono text-xs text-right font-semibold ${p.difference > 0 ? 'text-amber-400' : p.difference < 0 ? 'text-blue-400' : 'text-zinc-400'}`}>
                              {p.difference > 0 ? '+' : ''}{p.difference.toFixed(3)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-mono ${
                                  cls === 'Cut'
                                    ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                                    : cls === 'Fill'
                                    ? 'border-blue-500/40 text-blue-400 bg-blue-500/10'
                                    : 'border-zinc-600 text-zinc-400'
                                }`}
                              >
                                {cls}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}

          {!cutFillResult && !cutFillLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
              <svg viewBox="0 0 48 48" className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="8" y="12" width="32" height="24" rx="2" />
                <line x1="8" y1="24" x2="40" y2="24" strokeDasharray="4 2" />
                <path d="M8 24l6-6 4 4 4-8 6 10 14-10" strokeLinejoin="round" />
              </svg>
              <p className="text-sm">Enter a datum RL and run analysis to view cut/fill results</p>
            </div>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/*  TAB 3: AREA COMPUTATION                                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="area" className="space-y-6">
          <Card className="border-zinc-700 bg-zinc-800/50">
            <CardHeader>
              <CardTitle className="text-zinc-100 text-base">Polygon Points</CardTitle>
              <CardDescription className="text-zinc-400">
                Paste or import polygon vertices (Easting,Northing) — minimum 3 points
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => setPolyText(ev.target?.result as string || '');
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                  className="hidden"
                  id="poly-file"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('poly-file')?.click()}
                  className="border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:text-blue-400"
                >
                  Import Polygon CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAreaCompute}
                  disabled={!polyText.trim()}
                  className="border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:text-blue-400"
                >
                  Compute Area
                </Button>
              </div>
              <Textarea
                value={polyText}
                onChange={(e) => setPolyText(e.target.value)}
                placeholder="Easting,Northing&#10;100.0,100.0&#10;200.0,100.0&#10;200.0,200.0&#10;100.0,200.0"
                className="font-mono text-xs bg-zinc-900 border-zinc-600 text-zinc-300 min-h-[120px] max-h-[200px]"
              />
            </CardContent>
          </Card>

          {areaConversions && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SummaryCard label="Area" value={`${fmt(areaConversions.sqm, 2)} m²`} accent />
                <SummaryCard label="Area" value={`${fmt(areaConversions.hectares, 4)} ha`} accent />
                <SummaryCard label="Area" value={`${fmt(areaConversions.acres, 4)} acres`} accent />
              </div>

              <Card className="border-zinc-700 bg-zinc-800/50">
                <CardHeader>
                  <CardTitle className="text-zinc-100 text-sm">
                    Polygon Vertices ({polyPoints.length} points)
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-700 hover:bg-transparent">
                        <TableHead className="text-zinc-400 text-xs w-12">#</TableHead>
                        <TableHead className="text-zinc-400 text-xs">Easting</TableHead>
                        <TableHead className="text-zinc-400 text-xs">Northing</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {polyPoints.map((p, i) => (
                        <TableRow key={`${p}-${i}`} className="border-zinc-700/50">
                          <TableCell className="font-mono text-xs text-zinc-500">{i + 1}</TableCell>
                          <TableCell className="font-mono text-xs text-zinc-300">{p.easting.toFixed(4)}</TableCell>
                          <TableCell className="font-mono text-xs text-zinc-300">{p.northing.toFixed(4)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}

          {!areaConversions && (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
              <svg viewBox="0 0 48 48" className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="24,6 42,16 38,38 10,38 6,16" />
                <text x="24" y="26" textAnchor="middle" fontSize="10" fill="currentColor" stroke="none">m²</text>
              </svg>
              <p className="text-sm">Enter polygon points and compute area to see results</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  accent?: boolean;
  valueColor?: string;
}

function SummaryCard({ label, value, accent, valueColor }: SummaryCardProps) {
  return (
    <Card className="border-zinc-700 bg-zinc-800/50">
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
        <p className={`text-lg font-bold font-mono ${valueColor || (accent ? 'text-blue-400' : 'text-zinc-200')}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
