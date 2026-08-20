'use client';

import { useState, useMemo } from 'react';
import {
  FileUp, Plus, Trash2, Eye, Download, Printer,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  MapPinned, FileText, AlertCircle, CheckCircle
} from 'lucide-react';
import { renderFormNo3 } from '@/lib/reports/surveyPlan/formNo3Renderer';
import { shoelaceArea } from '@/lib/reports/surveyPlan/geometry';
import { generateMutationPlanDXF } from '@/lib/generators/mutationPlanDXF';
import { sanitizeHtml } from '@/lib/security/sanitize';
// XSS guard (2026-08-03): projectInfo.name is user-entered and lands in the
// print document's <title> (RCDATA breakout) — escape before interpolation.
import { escapeXml } from '@/lib/xml/escape';
import type {
  MutationPlanData, MutationPlot, RoadCorridor,
  SurveyMonument, BearingScheduleEntry,
} from '@/lib/reports/surveyPlan/formNo3Types';

/* ═══════════════════════════════════════════════════════════════════════
 *  DEFAULTS & SAMPLE DATA
 * ═══════════════════════════════════════════════════════════════════════ */

const DEFAULT_PROJECT = {
  name: '',
  location: '',
  locality: '',
  registrationDistrict: '',
  cadastralSheet: '',
  rimReference: '',
  folioNumber: '',
  registerNumber: '',
  scale: 1000,
  datum: 'ARC1960' as const,
  utmZone: 37,
  hemisphere: 'S' as const,
  surveyor_name: '',
  surveyor_licence: '',
  date: new Date().toISOString().split('T')[0],
  transactions: '',
};

function makeSampleData(): {
  plots: MutationPlot[];
  roads: RoadCorridor[];
  monuments: SurveyMonument[];
  bearingSchedule: BearingScheduleEntry[];
  grid: MutationPlanData['grid'];
  schemeBoundary: MutationPlanData['schemeBoundary'];
} {
  // 12 plots in a 3×4 grid with roads
  const baseE = 114300;
  const baseN = -3700;
  const fw = 22.24;  // frontage width
  const fd = 45.50;  // frontage depth
  const roadW = 15;   // main road width
  const roadW2 = 9;   // secondary road width

  const plots: MutationPlot[] = [];
  const series = ['a', 'b', 'c', 'd'];

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col + 1;
      const s = series[row];
      const e1 = baseE + col * (fw + roadW2) + roadW;
      const n1 = baseN + row * (fd + roadW);
      const e2 = e1 + fw;
      const n2 = n1 + fd;
      const area = ((fw * fd) / 10000); // approx ha

      plots.push({
        id: `${s}${idx}`,
        parentId: undefined,
        boundaryPoints: [
          { easting: e1, northing: n1 },
          { easting: e2, northing: n1 },
          { easting: e2, northing: n2 },
          { easting: e1, northing: n2 },
        ],
        area_ha: parseFloat(area.toFixed(4)),
        isApprox: true,
        seriesLabel: s,
      });
    }
  }

  // Main road (horizontal through the middle)
  const roadCL: RoadCorridor = {
    id: 'road_15m_main',
    width_m: 15,
    label: '15M WIDE ROAD',
    bearing_dms: "12' 35\"",
    centerline: [
      { easting: baseE - 20, northing: baseN + fd + 7.5 },
      { easting: baseE + 3 * fw + 2 * roadW2 + 20, northing: baseN + fd + 7.5 },
    ],
  };

  // Secondary road (vertical)
  const road2CL: RoadCorridor = {
    id: 'road_9m_sec',
    width_m: 9,
    label: '9M WIDE ROAD',
    bearing_dms: "40' 35\"",
    centerline: [
      { easting: baseE + fw + roadW2 / 2, northing: baseN - 10 },
      { easting: baseE + fw + roadW2 / 2, northing: baseN + 4 * fd + 3 * roadW + 10 },
    ],
  };

  const monuments: SurveyMonument[] = [
    { id: 'M1', easting: baseE - 5, northing: baseN - 5, type: 'control' },
    { id: 'M2', easting: baseE + 3 * fw + 2 * roadW2 + 5, northing: baseN - 5, type: 'control' },
    { id: 'M3', easting: baseE + 3 * fw + 2 * roadW2 + 5, northing: baseN + 4 * fd + 3 * roadW + 5, type: 'control' },
    { id: 'M4', easting: baseE - 5, northing: baseN + 4 * fd + 3 * roadW + 5, type: 'control' },
  ];

  // Generate bearing schedule from plot boundaries
  const bearingSchedule: BearingScheduleEntry[] = [];
  plots.forEach((plot) => {
    const pts = plot.boundaryPoints;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const dE = p2.easting - p1.easting;
      const dN = p2.northing - p1.northing;
      const dist = Math.sqrt(dE * dE + dN * dN);
      let bearing = Math.atan2(dE, dN) * 180 / Math.PI;
      if (bearing < 0) bearing += 360;
      const d = Math.floor(bearing);
      const mFloat = (bearing - d) * 60;
      const m = Math.floor(mFloat);
      const s = (mFloat - m) * 60;
      bearingSchedule.push({
        lineId: `${plot.id}-${i + 1}`,
        from: `${plot.id}.${i + 1}`,
        to: `${plot.id}.${i + 2 > pts.length ? 1 : i + 2}`,
        bearing_dms: `${d}\u00B0${String(m).padStart(2, '0')}'${s.toFixed(1)}"`,
        distance_m: parseFloat(dist.toFixed(2)),
      });
    }
  });

  const grid = {
    minE: baseE - 50,
    maxE: baseE + 3 * fw + 2 * roadW2 + 50,
    minN: baseN - 50,
    maxN: baseN + 4 * fd + 3 * roadW + 50,
    intervalE: 200,
    intervalN: 200,
  };

  const schemeBoundary = [
    { easting: grid.minE + 10, northing: grid.minN + 10 },
    { easting: grid.maxE - 10, northing: grid.minN + 10 },
    { easting: grid.maxE - 10, northing: grid.maxN - 10 },
    { easting: grid.minE + 10, northing: grid.maxN - 10 },
  ];

  return { plots, roads: [roadCL, road2CL], monuments, bearingSchedule, grid, schemeBoundary };
}

/* ═══════════════════════════════════════════════════════════════════════
 *  CSV PARSING
 * ═══════════════════════════════════════════════════════════════════════ */

function parsePlotsCSV(csvText: string): MutationPlot[] {
  const lines = csvText.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV must have a header row and at least 1 data row');

  const plots: MutationPlot[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    if (cols.length < 4) continue;

    const id = cols[0];
    const eastings = cols[1].split(';').map(Number);
    const northings = cols[2].split(';').map(Number);
    const areaHa = parseFloat(cols[3]);

    if (eastings.length !== northings.length || eastings.length < 3) continue;
    if (isNaN(areaHa)) continue;

    const seriesMatch = id.match(/^([a-zA-Z]+)/);
    const seriesLabel = seriesMatch ? seriesMatch[1].toLowerCase() : 'a';

    plots.push({
      id,
      boundaryPoints: eastings.map((e, j) => ({ easting: e, northing: northings[j] })),
      area_ha: areaHa,
      isApprox: true,
      seriesLabel,
    });
  }

  return plots;
}

/* ═══════════════════════════════════════════════════════════════════════
 *  COMPONENT
 * ═══════════════════════════════════════════════════════════════════════ */

type Step = 1 | 2 | 3 | 4;

export interface MutationPlanGeneratorProps {
  /**
   * Optional pre-loaded plot(s) to seed the generator with. Used by the
   * project integration (`ProjectMutationPlan`) to inject a parent
   * parcel's boundary directly from the project's most recent deed plan,
   * avoiding the sessionStorage bridge that was previously used.
   *
   * When supplied, the generator initialises with these plots on step 2
   * (Plot Definition) so the surveyor can immediately subdivide or
   * amalgamate them.
   */
  initialPlots?: MutationPlot[];
}

export default function MutationPlanGenerator({
  initialPlots,
}: MutationPlanGeneratorProps = {}) {
  const [step, setStep] = useState<Step>(initialPlots && initialPlots.length > 0 ? 2 : 1);
  const [projectInfo, setProjectInfo] = useState(DEFAULT_PROJECT);
  const [plots, setPlots] = useState<MutationPlot[]>(initialPlots ?? []);
  const [roads, setRoads] = useState<RoadCorridor[]>([]);
  const [monuments, setMonuments] = useState<SurveyMonument[]>([]);
  const [, setBearingSchedule] = useState<BearingScheduleEntry[]>([]);
  const [schemeBoundary, setSchemeBoundary] = useState<MutationPlanData['schemeBoundary']>([]);
  const [grid, setGrid] = useState<MutationPlanData['grid']>({ minE: 0, maxE: 1000, minN: 0, maxN: 1000, intervalE: 200, intervalN: 200 });
  const [svgOutput, setSvgOutput] = useState('');
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccess, setCsvSuccess] = useState('');
  const [bearingScheduleOpen, setBearingScheduleOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // ── Computed bearing schedule from plot boundaries ──
  const computedBearingSchedule = useMemo(() => {
    const entries: BearingScheduleEntry[] = [];
    plots.forEach((plot) => {
      const pts = plot.boundaryPoints;
      for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        const dE = p2.easting - p1.easting;
        const dN = p2.northing - p1.northing;
        const dist = Math.sqrt(dE * dE + dN * dN);
        let bearing = Math.atan2(dE, dN) * 180 / Math.PI;
        if (bearing < 0) bearing += 360;
        const d = Math.floor(bearing);
        const mFloat = (bearing - d) * 60;
        const m = Math.floor(mFloat);
        const s = (mFloat - m) * 60;
        entries.push({
          lineId: `${plot.id}-${i + 1}`,
          from: `${plot.id}.${i + 1}`,
          to: `${plot.id}.${(i + 2) > pts.length ? 1 : i + 2}`,
          bearing_dms: `${d}\u00B0${String(m).padStart(2, '0')}'${s.toFixed(1)}"`,
          distance_m: parseFloat(dist.toFixed(2)),
        });
      }
    });
    return entries;
  }, [plots]);

  // ── Computed grid bounds from all geometry ──
  const computedGrid = useMemo(() => {
    const allPts: Array<{easting: number; northing: number}> = [
      ...schemeBoundary,
      ...plots.flatMap((p) => p.boundaryPoints),
      ...monuments.map((m) => ({ easting: m.easting, northing: m.northing })),
    ];
    if (allPts.length < 2) return grid;
    const minE = Math.min(...allPts.map((p) => p.easting));
    const maxE = Math.max(...allPts.map((p) => p.easting));
    const minN = Math.min(...allPts.map((p) => p.northing));
    const maxN = Math.max(...allPts.map((p) => p.northing));
    const rangeE = maxE - minE || 200;
    const rangeN = maxN - minN || 200;
    const intE = rangeE > 1000 ? 200 : rangeE > 400 ? 100 : 50;
    const intN = rangeN > 1000 ? 200 : rangeN > 400 ? 100 : 50;
    return { minE, maxE, minN, maxN, intervalE: intE, intervalN: intN };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- grid is stable-by-construction; memoizing on its identity would recompute every render
  }, [schemeBoundary, plots, monuments]);

  // ── Auto-computed plot areas from boundary points (Shoelace formula) ──
  const computedPlotAreas = useMemo(() => {
    const map = new Map<string, number>();
    plots.forEach((plot) => {
      if (plot.boundaryPoints.length >= 3) {
        const areaSqm = shoelaceArea(plot.boundaryPoints);
        map.set(plot.id, parseFloat((areaSqm / 10000).toFixed(6)));
      }
    });
    return map;
  }, [plots]);

  // ── Generate SVG ──
  const handleGenerate = () => {
    if (plots.length === 0) return;
    const data: MutationPlanData = {
      project: projectInfo as MutationPlanData['project'],
      schemeBoundary: schemeBoundary.length >= 3 ? schemeBoundary : computedSchemeBoundary(),
      plots,
      roads,
      monuments,
      bearingSchedule: computedBearingSchedule,
      grid: computedGrid,
    };
    try {
      const svg = renderFormNo3(data);
      setSvgOutput(svg);
      setStep(4);
    } catch (err) {
      // eslint-disable-next-line no-console -- client error surface
      console.error('Render error:', err);
    }
  };

  const computedSchemeBoundary = (): MutationPlanData['schemeBoundary'] => {
    const allPts = plots.flatMap((p) => p.boundaryPoints);
    if (allPts.length < 3) return [];
    // Simple convex hull approximation — just use bounding box
    const minE = Math.min(...allPts.map((p) => p.easting));
    const maxE = Math.max(...allPts.map((p) => p.easting));
    const minN = Math.min(...allPts.map((p) => p.northing));
    const maxN = Math.max(...allPts.map((p) => p.northing));
    return [
      { easting: minE, northing: minN },
      { easting: maxE, northing: minN },
      { easting: maxE, northing: maxN },
      { easting: minE, northing: maxN },
    ];
  };

  // ── Load sample data ──
  const handleLoadSample = () => {
    const sample = makeSampleData();
    setPlots(sample.plots);
    setRoads(sample.roads);
    setMonuments(sample.monuments);
    setBearingSchedule(sample.bearingSchedule);
    setSchemeBoundary(sample.schemeBoundary);
    setGrid(sample.grid);
    setProjectInfo({
      ...DEFAULT_PROJECT,
      name: 'SAMPLE SUBDIVISION SCHEME',
      location: 'Kajiado County',
      locality: 'Kitengela',
      registrationDistrict: 'Kaputiei North',
      cadastralSheet: 'Sheet 123/4',
      rimReference: 'RIM Ref: KJ/KN/123',
      surveyor_name: 'Samuel K. Muriithi',
      surveyor_licence: 'ISK-1402',
    });
  };

  // ── CSV import ──
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError(null);
    setCsvSuccess('');
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parsed = parsePlotsCSV(text);
        if (parsed.length === 0) {
          setCsvError('No valid plots found in CSV. Expected columns: id, eastings(;), northings(;), area_ha');
          return;
        }
        setPlots(parsed);
        setCsvSuccess(`Imported ${parsed.length} plots successfully`);
      } catch (err) {
        setCsvError(err instanceof Error ? err.message : 'Failed to parse CSV');
      }
    };
    reader.readAsText(file);
  };

  // ── Add/remove plot ──
  const addPlot = () => {
    const series = ['a', 'b', 'c', 'd'];
    const lastSeries = plots.length > 0 ? plots[plots.length - 1].seriesLabel : 'a';
    const sIdx = series.indexOf(lastSeries);
    const nextSeries = sIdx >= 0 ? series[sIdx] : 'a';
    const count = plots.filter((p) => p.seriesLabel === nextSeries).length + 1;
    setPlots([
      ...plots,
      {
        id: `${nextSeries}${count}`,
        boundaryPoints: [
          { easting: 0, northing: 0 },
          { easting: 20, northing: 0 },
          { easting: 20, northing: 40 },
          { easting: 0, northing: 40 },
        ],
        area_ha: 0.08,
        isApprox: true,
        seriesLabel: nextSeries,
      },
    ]);
  };

  const removePlot = (index: number) => setPlots(plots.filter((_, i) => i !== index));

  // ── Add/remove road ──
  const addRoad = () => {
    setRoads([
      ...roads,
      {
        id: `road_${Date.now()}`,
        width_m: 9,
        label: '9M WIDE ROAD',
        centerline: [
          { easting: 0, northing: 0 },
          { easting: 100, northing: 0 },
        ],
      },
    ]);
  };

  const removeRoad = (index: number) => setRoads(roads.filter((_, i) => i !== index));

  // ── Add/remove monument ──
  const addMonument = () => {
    const num = monuments.length + 1;
    setMonuments([
      ...monuments,
      { id: `M${num}`, easting: 0, northing: 0, type: num <= 2 ? 'control' as const : 'intermediate' as const },
    ]);
  };

  const removeMonument = (index: number) => setMonuments(monuments.filter((_, i) => i !== index));

  // ── Export handlers ──
  const handleDownloadSVG = () => {
    if (!svgOutput) return;
    const blob = new Blob([svgOutput], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectInfo.name || 'mutation-plan'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPNG = () => {
    if (!svgOutput) return;
    const SCALE = 12;
    const svgW = 841;
    const svgH = 594;
    const imgW = svgW * SCALE;
    const imgH = svgH * SCALE;
    const svgBlob = new Blob([svgOutput], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = imgW;
      canvas.height = imgH;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); return; }
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, imgW, imgH);
      const svgAspect = svgW / svgH;
      const canvasAspect = imgW / imgH;
      let drawW: number, drawH: number, drawX: number, drawY: number;
      if (canvasAspect > svgAspect) {
        drawH = imgH; drawW = imgH * svgAspect;
        drawX = (imgW - drawW) / 2; drawY = 0;
      } else {
        drawW = imgW; drawH = imgW / svgAspect;
        drawX = 0; drawY = (imgH - drawH) / 2;
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${projectInfo.name || 'mutation-plan'}_A1_300dpi.png`;
        a.click();
        URL.revokeObjectURL(pngUrl);
      }, 'image/png', 1.0);
    };
    img.src = url;
  };

  // ── DXF export (bridge from wizard data → DXF generator) ──
  const handleDownloadDXF = () => {
    if (plots.length === 0) return;
    try {
      const children = plots.map((plot) => {
        const pts = plot.boundaryPoints;
        return {
          id: plot.id,
          label: plot.id.toUpperCase(),
          points: pts.map((p, idx) => ({ ...p, beacon: `${plot.id}.${idx + 1}` })),
          areaSqm: plot.area_ha * 10000,
          areaHa: plot.area_ha,
        };
      });

      const parentBoundary = schemeBoundary.length >= 3
        ? schemeBoundary
        : (() => {
            const allPts = plots.flatMap((p) => p.boundaryPoints);
            if (allPts.length < 3) return allPts;
            const minE = Math.min(...allPts.map((p) => p.easting));
            const maxE = Math.max(...allPts.map((p) => p.easting));
            const minN = Math.min(...allPts.map((p) => p.northing));
            const maxN = Math.max(...allPts.map((p) => p.northing));
            return [
              { easting: minE, northing: minN },
              { easting: maxE, northing: minN },
              { easting: maxE, northing: maxN },
              { easting: minE, northing: maxN },
            ];
          })();

      const parent = {
        id: 'PARENT',
        label: projectInfo.name || 'Parent Parcel',
        points: parentBoundary,
        areaSqm: children.reduce((s, c) => s + c.areaSqm, 0),
        areaHa: children.reduce((s, c) => s + c.areaHa, 0),
      };

      const dxfContent = generateMutationPlanDXF({
        parent,
        children,
        projectTitle: projectInfo.name,
        schemeNumber: projectInfo.rimReference || '',
        surveyorName: projectInfo.surveyor_name || '',
        surveyorRegistration: projectInfo.surveyor_licence || '',
        firmName: '',
        date: projectInfo.date || '',
        scale: `1:${projectInfo.scale}`,
      });

      const blob = new Blob([dxfContent], { type: 'application/dxf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectInfo.name || 'mutation-plan'}.dxf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      // eslint-disable-next-line no-console -- client error surface
      console.error('DXF generation error:', err);
    }
  };

  // ── PDF export via print API ──
  const handleDownloadPDF = () => {
    if (!svgOutput) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head>
  <title>${escapeXml(projectInfo.name || 'Mutation Plan')}</title>
  <style>
    @page { size: A1 landscape; margin: 10mm; }
    body { margin: 0; padding: 0; background: white; }
    svg { width: 100%; height: auto; max-height: 100vh; }
  </style>
</head><body>
  ${svgOutput}
  <script>window.onload = () => window.print();</script>
</body></html>`);
    win.document.close();
  };

  // ── Update helpers ──
  const updatePlot = (index: number, field: keyof MutationPlot, value: string | number | boolean) => {
    const updated = [...plots];
    (updated[index] as unknown as Record<keyof MutationPlot, string | number | boolean>)[field] = value;
    setPlots(updated);
  };

  const updatePlotPoint = (plotIdx: number, ptIdx: number, axis: 'easting' | 'northing', value: number) => {
    const updated = [...plots];
    (updated[plotIdx].boundaryPoints[ptIdx] as Record<string, string | number | boolean>)[axis] = value;
    setPlots(updated);
  };

  const updateRoad = (index: number, field: keyof RoadCorridor, value: string | number) => {
    const updated = [...roads];
    (updated[index] as unknown as Record<keyof RoadCorridor, string | number | boolean>)[field] = value;
    setRoads(updated);
  };

  const updateRoadCenterlinePoint = (roadIdx: number, ptIdx: number, axis: 'easting' | 'northing', value: number) => {
    const updated = [...roads];
    (updated[roadIdx].centerline[ptIdx] as Record<string, string | number | boolean>)[axis] = value;
    setRoads(updated);
  };

  const addRoadCenterlinePoint = (roadIdx: number) => {
    const updated = [...roads];
    const cl = updated[roadIdx].centerline;
    const lastPt = cl[cl.length - 1] || { easting: 0, northing: 0 };
    updated[roadIdx].centerline = [...cl, { easting: lastPt.easting + 50, northing: lastPt.northing }];
    setRoads(updated);
  };

  const removeRoadCenterlinePoint = (roadIdx: number, ptIdx: number) => {
    const updated = [...roads];
    if (updated[roadIdx].centerline.length <= 2) return; // need at least 2 points
    updated[roadIdx].centerline = updated[roadIdx].centerline.filter((_, i) => i !== ptIdx);
    setRoads(updated);
  };

  const updateMonument = (index: number, field: keyof SurveyMonument, value: string | number) => {
    const updated = [...monuments];
    (updated[index] as unknown as Record<keyof SurveyMonument, string | number | boolean>)[field] = value;
    setMonuments(updated);
  };

  const totalArea = plots.reduce((sum, p) => sum + p.area_ha, 0);

  // ── Series color map for SVG mini map ──
  const SERIES_COLORS: Record<string, { fill: string; stroke: string }> = {
    a: { fill: 'rgba(59,130,246,0.25)', stroke: '#3b82f6' },
    b: { fill: 'rgba(34,197,94,0.25)', stroke: '#22c55e' },
    c: { fill: 'rgba(245,158,11,0.25)', stroke: '#f59e0b' },
    d: { fill: 'rgba(239,68,68,0.25)', stroke: '#ef4444' },
  };

  // ── Plot bounding box for mini map ──
  const plotBounds = useMemo(() => {
    const allPts = [
      ...plots.flatMap((p) => p.boundaryPoints),
      ...roads.flatMap((r) => r.centerline),
    ];
    if (allPts.length < 2) return null;
    const minE = Math.min(...allPts.map((p) => p.easting));
    const maxE = Math.max(...allPts.map((p) => p.easting));
    const minN = Math.min(...allPts.map((p) => p.northing));
    const maxN = Math.max(...allPts.map((p) => p.northing));
    const rangeE = maxE - minE || 200;
    const rangeN = maxN - minN || 200;
    const pad = Math.max(rangeE, rangeN) * 0.08;
    const intE = rangeE > 1000 ? 200 : rangeE > 400 ? 100 : 50;
    const intN = rangeN > 1000 ? 200 : rangeN > 400 ? 100 : 50;
    return { minE: minE - pad, maxE: maxE + pad, minN: minN - pad, maxN: maxN + pad, rangeE: rangeE + 2 * pad, rangeN: rangeN + 2 * pad, intervalE: intE, intervalN: intN };
  }, [plots, roads]);

  // ── Road corridor polygons (perpendicular offset from centerline) ──
  const roadCorridorPolygons = useMemo(() => {
    return roads.map((road) => {
      const hw = road.width_m / 2;
      if (road.centerline.length < 2) return { points: [] as Array<{ easting: number; northing: number }>, id: road.id, width_m: road.width_m };
      const pts: Array<{ easting: number; northing: number }> = [];
      // Left side (forward along centerline)
      for (let i = 0; i < road.centerline.length; i++) {
        let dx = 0, dy = 0;
        if (i < road.centerline.length - 1) {
          dx = road.centerline[i + 1].easting - road.centerline[i].easting;
          dy = road.centerline[i + 1].northing - road.centerline[i].northing;
        } else {
          dx = road.centerline[i].easting - road.centerline[i - 1].easting;
          dy = road.centerline[i].northing - road.centerline[i - 1].northing;
        }
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        pts.push({ easting: road.centerline[i].easting + (-dy / len) * hw, northing: road.centerline[i].northing + (dx / len) * hw });
      }
      // Right side (reverse along centerline)
      for (let i = road.centerline.length - 1; i >= 0; i--) {
        let dx = 0, dy = 0;
        if (i < road.centerline.length - 1) {
          dx = road.centerline[i + 1].easting - road.centerline[i].easting;
          dy = road.centerline[i + 1].northing - road.centerline[i].northing;
        } else {
          dx = road.centerline[i].easting - road.centerline[i - 1].easting;
          dy = road.centerline[i].northing - road.centerline[i - 1].northing;
        }
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        pts.push({ easting: road.centerline[i].easting + (dy / len) * hw, northing: road.centerline[i].northing + (-dx / len) * hw });
      }
      return { points: pts, id: road.id, width_m: road.width_m };
    });
  }, [roads]);

  // ── Road area estimate (Shoelace on corridor polygons) ──
  const roadAreaHa = useMemo(() => {
    let total = 0;
    roadCorridorPolygons.forEach((rc) => {
      if (rc.points.length >= 3) total += shoelaceArea(rc.points);
    });
    return total / 10000;
  }, [roadCorridorPolygons]);

  // ── Full reconciliation data ──
  const reconciliation = useMemo(() => {
    let computedTotal = 0;
    const seriesMap = new Map<string, { count: number; computedArea: number; declaredArea: number }>();
    plots.forEach((plot) => {
      const computed = computedPlotAreas.get(plot.id) || plot.area_ha;
      computedTotal += computed;
      const existing = seriesMap.get(plot.seriesLabel) || { count: 0, computedArea: 0, declaredArea: 0 };
      existing.count++;
      existing.computedArea += computed;
      existing.declaredArea += plot.area_ha;
      seriesMap.set(plot.seriesLabel, existing);
    });
    const declaredTotal = plots.reduce((s, p) => s + p.area_ha, 0);
    const discrepancy = computedTotal - declaredTotal;
    const discrepancyPct = declaredTotal > 0 ? (Math.abs(discrepancy) / declaredTotal) * 100 : 0;
    const boundary = schemeBoundary.length >= 3 ? schemeBoundary : computedSchemeBoundary();
    const parentAreaHa = boundary.length >= 3 ? shoelaceArea(boundary) / 10000 : 0;
    const availableArea = parentAreaHa - roadAreaHa;
    const plotsExceed = availableArea > 0 && computedTotal > availableArea;
    return {
      computedTotal,
      declaredTotal,
      discrepancy,
      discrepancyPct,
      roadArea: roadAreaHa,
      parentArea: parentAreaHa,
      availableArea,
      plotsExceed,
      seriesEntries: Array.from(seriesMap.entries()).sort(([a], [b]) => a.localeCompare(b)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- computedSchemeBoundary is a stable-by-construction helper recreated each render; memoizing on its identity would recompute every render
  }, [plots, computedPlotAreas, roadAreaHa, schemeBoundary]);

  // ── Step navigation ──
  const canGoNext = (): boolean => {
    switch (step) {
      case 1: return !!projectInfo.name && !!projectInfo.surveyor_name;
      case 2: return plots.length >= 1;
      case 3: return true;
      default: return false;
    }
  };

  const nextStep = () => { if (step < 4 && canGoNext()) setStep((step + 1) as Step); };
  const prevStep = () => { if (step > 1) setStep((step - 1) as Step); };

  return (
    <div className="space-y-6">
      {/* ── Step Tabs ── */}
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((s) => (
          <button
            key={s}
            onClick={() => (s === 4 && !svgOutput ? handleGenerate() : s <= step || canGoNext() ? setStep(s as Step) : null)}
            disabled={s > step + 1 && !canGoNext()}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              step === s
                ? 'bg-[var(--accent)] text-black'
                : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50'
            } ${s > step + 1 && !canGoNext() ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <span className={`flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold ${
              step >= s ? 'bg-[var(--accent)] text-black' : 'bg-zinc-700 text-zinc-400'
            }`}>
              {step > s ? '\u2713' : s}
            </span>
            {['Scheme Info', 'Import Plots', 'Roads & Monuments', 'Review & Export'][s - 1]}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════
       *  STEP 1: SCHEME INFO
       * ══════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--accent)]" />
              Project Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'name', label: 'Scheme Name', required: true },
                { key: 'location', label: 'Location' },
                { key: 'locality', label: 'Locality' },
                { key: 'registrationDistrict', label: 'Registration District' },
                { key: 'cadastralSheet', label: 'Cadastral Sheet' },
                { key: 'rimReference', label: 'RIM Reference' },
                { key: 'folioNumber', label: 'Folio Number' },
                { key: 'registerNumber', label: 'Register Number' },
              ].map((f) => (
                <div key={f.key}>
                  <label htmlFor={`mp-${f.key}`} className="block text-xs font-medium text-zinc-400 mb-1">
                    {f.label} {f.required && <span className="text-red-400">*</span>}
                  </label>
                  <input id={`mp-${f.key}`}
                    type="text"
                    value={(projectInfo as Record<string, string | number>)[f.key]}
                    onChange={(e) => setProjectInfo({ ...projectInfo, [f.key]: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[var(--accent)]"
                    placeholder={f.label}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--accent)]" />
              Surveyor & Technical
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="mp-surveyor-name" className="block text-xs font-medium text-zinc-400 mb-1">Surveyor Name <span className="text-red-400">*</span></label>
                <input
                  id="mp-surveyor-name"
                  type="text"
                  value={projectInfo.surveyor_name}
                  onChange={(e) => setProjectInfo({ ...projectInfo, surveyor_name: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[var(--accent)]"
                  placeholder="Licensed Surveyor"
                />
              </div>
              <div>
                <label htmlFor="mp-isk-licence" className="block text-xs font-medium text-zinc-400 mb-1">ISK Licence Number</label>
                <input
                  id="mp-isk-licence"
                  type="text"
                  value={projectInfo.surveyor_licence}
                  onChange={(e) => setProjectInfo({ ...projectInfo, surveyor_licence: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[var(--accent)]"
                  placeholder="ISK-0000"
                />
              </div>
              <div>
                <label htmlFor="mp-scale" className="block text-xs font-medium text-zinc-400 mb-1">Scale</label>
                <select
                  id="mp-scale"
                  value={projectInfo.scale}
                  onChange={(e) => setProjectInfo({ ...projectInfo, scale: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value={500}>1 : 500</option>
                  <option value={1000}>1 : 1,000</option>
                  <option value={2500}>1 : 2,500</option>
                  <option value={5000}>1 : 5,000</option>
                </select>
              </div>
              <div>
                <label htmlFor="mp-datum" className="block text-xs font-medium text-zinc-400 mb-1">Datum</label>
                <select
                  id="mp-datum"
                  value={projectInfo.datum}
                  onChange={(e) => setProjectInfo({ ...projectInfo, datum: e.target.value as 'ARC1960' })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="ARC1960">ARC 1960</option>
                  <option value="WGS84">WGS 84</option>
                </select>
              </div>
              <div>
                <label htmlFor="mp-survey-date" className="block text-xs font-medium text-zinc-400 mb-1">Survey Date</label>
                <input id="mp-survey-date"
                  type="date"
                  value={projectInfo.date}
                  onChange={(e) => setProjectInfo({ ...projectInfo, date: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label htmlFor="mp-transactions" className="block text-xs font-medium text-zinc-400 mb-1">Transactions</label>
                <input
                  id="mp-transactions"
                  type="text"
                  value={projectInfo.transactions || ''}
                  onChange={(e) => setProjectInfo({ ...projectInfo, transactions: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[var(--accent)]"
                  placeholder="Transaction reference"
                />
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              onClick={nextStep}
              disabled={!canGoNext()}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-black rounded-lg hover:bg-[var(--accent-dim)] font-semibold disabled:opacity-40"
            >
              Next: Import Plots
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
       *  STEP 2: IMPORT PLOTS
       * ══════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <MapPinned className="h-5 w-5 text-[var(--accent)]" />
                Plot Data ({plots.length} plots, Total Area: {totalArea.toFixed(4)} Ha)
              </h2>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent)]/50 text-sm text-zinc-300 cursor-pointer">
                  <FileUp className="h-4 w-4" />
                  Import CSV
                  <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
                </label>
                <button
                  onClick={handleLoadSample}
                  className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm hover:bg-amber-500/20"
                >
                  Load 12-Plot Sample
                </button>
                <button
                  onClick={addPlot}
                  className="flex items-center gap-2 px-3 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-semibold"
                >
                  <Plus className="h-4 w-4" />
                  Add Plot
                </button>
              </div>
            </div>

            {csvError && (
              <div className="mb-4 p-3 border border-red-800/60 bg-red-950/30 text-red-300 rounded-lg flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4" />
                {csvError}
              </div>
            )}
            {csvSuccess && (
              <div className="mb-4 p-3 border border-green-800/60 bg-green-950/30 text-green-300 rounded-lg flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4" />
                {csvSuccess}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left py-2 px-2 text-zinc-400 text-xs">ID</th>
                    <th className="text-left py-2 px-2 text-zinc-400 text-xs">Series</th>
                    <th className="text-left py-2 px-2 text-zinc-400 text-xs">Points</th>
                    <th className="text-right py-2 px-2 text-zinc-400 text-xs">Area (Ha)</th>
                    <th className="text-center py-2 px-2 text-zinc-400 text-xs">Approx</th>
                    <th className="w-12 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {plots.map((plot, i) => (
                    <tr key={plot.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                      <td className="py-2 px-2">
                        <input aria-label="Id"
                          type="text"
                          value={plot.id}
                          onChange={(e) => updatePlot(i, 'id', e.target.value)}
                          className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-white"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <span className="text-xs font-mono text-amber-400">{plot.seriesLabel}</span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-xs text-zinc-400">
                          {plot.boundaryPoints.length} pts
                          <button
                            onClick={() => {
                              const updated = [...plots];
                              updated[i].boundaryPoints = [...updated[i].boundaryPoints, { easting: 0, northing: 0 }];
                              setPlots(updated);
                            }}
                            className="ml-1 text-[var(--accent)] hover:underline"
                          >
                            +pt
                          </button>
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {plot.boundaryPoints.map((pt, j) => (
                            <div key={j} className="flex gap-1">
                              <input
                                type="number"
                                value={pt.easting}
                                onChange={(e) => updatePlotPoint(i, j, 'easting', parseFloat(e.target.value) || 0)}
                                className="w-24 px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white"
                                aria-label="Easting" placeholder="E"
                              />
                              <input
                                type="number"
                                value={pt.northing}
                                onChange={(e) => updatePlotPoint(i, j, 'northing', parseFloat(e.target.value) || 0)}
                                className="w-24 px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white"
                                aria-label="Northing" placeholder="N"
                              />
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <input aria-label="Area ha"
                            type="number"
                            step="0.0001"
                            value={plot.area_ha}
                            onChange={(e) => updatePlot(i, 'area_ha', parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-white text-right"
                          />
                          {computedPlotAreas.has(plot.id) && (
                            <span
                              title={`Computed: ${(computedPlotAreas.get(plot.id) ?? 0).toFixed(4)} Ha`}
                              className={`text-[9px] px-1 py-0.5 rounded font-mono ${
                                Math.abs(plot.area_ha - (computedPlotAreas.get(plot.id) ?? 0)) < 0.0001
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {Math.abs(plot.area_ha - (computedPlotAreas.get(plot.id) ?? 0)) < 0.0001 ? 'auto' : `${(computedPlotAreas.get(plot.id) ?? 0).toFixed(3)}`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input aria-label="Isapprox"
                          type="checkbox"
                          checked={plot.isApprox}
                          onChange={(e) => updatePlot(i, 'isApprox', e.target.checked)}
                          className="rounded border-zinc-600"
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={() => removePlot(i)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {plots.length === 0 && (
              <div className="text-center py-12 text-zinc-500">
                <MapPinned className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No plots imported yet. Upload a CSV or load sample data.</p>
                <p className="text-xs mt-2 text-zinc-600">
                  CSV format: id, eastings (; separated), northings (; separated), area_ha
                </p>
              </div>
            )}
          </div>

          {/* ── Mini Map Preview (collapsible) ── */}
          {plots.length > 0 && plotBounds && (
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center justify-between w-full text-left mb-3"
              >
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <MapPinned className="h-4 w-4 text-[var(--accent)]" />
                  Layout Preview
                  <span className="text-xs text-zinc-500 font-normal">
                    ({plots.length} plots, {roads.length} roads)
                  </span>
                </h3>
                {showPreview ? (
                  <ChevronUp className="h-4 w-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-zinc-400" />
                )}
              </button>
              {showPreview && (
                <>
                  <svg
                    viewBox={`${plotBounds.minE} ${plotBounds.minN} ${plotBounds.rangeE} ${plotBounds.rangeN}`}
                    className="w-full h-72 bg-zinc-900 rounded border border-zinc-700"
                  >
                    {/* Grid lines — Easting (vertical) */}
                    {Array.from({ length: Math.ceil(plotBounds.rangeE / plotBounds.intervalE) + 1 }, (_, i) => {
                      const startX = Math.ceil(plotBounds.minE / plotBounds.intervalE) * plotBounds.intervalE;
                      const x = startX + i * plotBounds.intervalE;
                      if (x > plotBounds.maxE) return null;
                      return (
                        <g key={`ge-${i}`}>
                          <line x1={x} y1={plotBounds.minN} x2={x} y2={plotBounds.maxN} stroke="#334155" strokeWidth={0.4} />
                          <text x={x} y={plotBounds.minN + plotBounds.rangeN * 0.02} fill="#6b7280" fontSize={Math.max(plotBounds.rangeE * 0.012, 1.5)} textAnchor="middle">
                            {x.toFixed(0)}
                          </text>
                        </g>
                      );
                    })}
                    {/* Grid lines — Northing (horizontal) */}
                    {Array.from({ length: Math.ceil(plotBounds.rangeN / plotBounds.intervalN) + 1 }, (_, i) => {
                      const startY = Math.ceil(plotBounds.minN / plotBounds.intervalN) * plotBounds.intervalN;
                      const y = startY + i * plotBounds.intervalN;
                      if (y > plotBounds.maxN) return null;
                      return (
                        <g key={`gn-${i}`}>
                          <line x1={plotBounds.minE} y1={y} x2={plotBounds.maxE} y2={y} stroke="#334155" strokeWidth={0.4} />
                          <text x={plotBounds.minE + plotBounds.rangeE * 0.01} y={y - plotBounds.rangeN * 0.005} fill="#6b7280" fontSize={Math.max(plotBounds.rangeE * 0.012, 1.5)}>
                            {y.toFixed(0)}
                          </text>
                        </g>
                      );
                    })}
                    {/* Road corridors */}
                    {roadCorridorPolygons.map((rc) =>
                      rc.points.length >= 3 ? (
                        <polygon
                          key={`road-${rc.id}`}
                          points={rc.points.map((p) => `${p.easting},${p.northing}`).join(' ')}
                          fill="rgba(161,161,170,0.2)"
                          stroke="#71717a"
                          strokeWidth={0.5}
                        />
                      ) : null
                    )}
                    {/* Plot polygons */}
                    {plots.map((plot) => {
                      const color = SERIES_COLORS[plot.seriesLabel] || SERIES_COLORS.a;
                      return (
                        <polygon
                          key={plot.id}
                          points={plot.boundaryPoints.map((p) => `${p.easting},${p.northing}`).join(' ')}
                          fill={color.fill}
                          stroke={color.stroke}
                          strokeWidth={0.8}
                        />
                      );
                    })}
                    {/* Plot labels at centroids */}
                    {plots.map((plot) => {
                      const pts = plot.boundaryPoints;
                      if (pts.length === 0) return null;
                      const cx = pts.reduce((s, p) => s + p.easting, 0) / pts.length;
                      const cy = pts.reduce((s, p) => s + p.northing, 0) / pts.length;
                      return (
                        <text
                          key={`lbl-${plot.id}`}
                          x={cx} y={cy}
                          textAnchor="middle" dominantBaseline="central"
                          fill="white" fontSize={Math.max(plotBounds.rangeE * 0.02, 2)} fontWeight="bold"
                          style={{ pointerEvents: 'none', userSelect: 'none' }}
                        >
                          {plot.id}
                        </text>
                      );
                    })}
                  </svg>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 mt-3">
                    {Object.entries(SERIES_COLORS).map(([key, color]) => (
                      <div key={key} className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color.stroke }} />
                        Series {key.toUpperCase()}
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <span className="inline-block w-3 h-3 rounded-sm bg-zinc-500" />
                      Roads
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={prevStep}
              className="flex items-center gap-2 px-6 py-3 border border-[var(--border-color)] rounded-lg text-zinc-300 hover:border-[var(--accent)]/50"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={nextStep}
              disabled={plots.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-black rounded-lg font-semibold disabled:opacity-40"
            >
              Next: Roads & Monuments
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
       *  STEP 3: ROADS & MONUMENTS
       * ══════════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Roads */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Road Corridors ({roads.length})</h2>
              <button
                onClick={addRoad}
                className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-black rounded-lg text-sm font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Add Road
              </button>
            </div>
            <div className="space-y-3">
              {roads.map((road, i) => (
                <div key={road.id} className="p-3 bg-zinc-800 rounded-lg border border-zinc-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-amber-400">{road.id}</span>
                    <button onClick={() => removeRoad(i)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor={`mp-road-width-${i}`} className="block text-xs text-zinc-500 mb-0.5">Width (m)</label>
                      <select
                        id={`mp-road-width-${i}`}
                        value={road.width_m}
                        onChange={(e) => {
                          const w = Number(e.target.value);
                          updateRoad(i, 'width_m', w);
                          updateRoad(i, 'label', `${w}M WIDE ROAD`);
                        }}
                        className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                      >
                        <option value={9}>9m</option>
                        <option value={12}>12m</option>
                        <option value={15}>15m</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`mp-road-bearing-${i}`} className="block text-xs text-zinc-500 mb-0.5">Bearing</label>
                      <input
                        id={`mp-road-bearing-${i}`}
                        type="text"
                        value={road.bearing_dms || ''}
                        onChange={(e) => updateRoad(i, 'bearing_dms', e.target.value)}
                        className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                        placeholder="12' 35&quot;"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">
                    Centerline: {road.centerline.length} points
                    <button
                      onClick={() => addRoadCenterlinePoint(i)}
                      className="ml-1 text-[var(--accent)] hover:underline"
                    >
                      +pt
                    </button>
                  </div>
                  {/* Centerline point editing */}
                  <div className="space-y-1">
                    {road.centerline.map((pt, j) => (
                      <div key={j} className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-600 w-4">{j + 1}</span>
                        <input
                          type="number"
                          value={pt.easting}
                          onChange={(e) => updateRoadCenterlinePoint(i, j, 'easting', parseFloat(e.target.value) || 0)}
                          className="w-24 px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white"
                          aria-label="Easting" placeholder="E"
                        />
                        <input
                          type="number"
                          value={pt.northing}
                          onChange={(e) => updateRoadCenterlinePoint(i, j, 'northing', parseFloat(e.target.value) || 0)}
                          className="w-24 px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white"
                          aria-label="Northing" placeholder="N"
                        />
                        {road.centerline.length > 2 && (
                          <button
                            onClick={() => removeRoadCenterlinePoint(i, j)}
                            className="text-red-500 hover:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {roads.length === 0 && (
                <p className="text-sm text-zinc-500 text-center py-4">No roads defined. Click Add Road to create one.</p>
              )}
            </div>
          </div>

          {/* Monuments */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Survey Monuments ({monuments.length})</h2>
              <button
                onClick={addMonument}
                className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-black rounded-lg text-sm font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left py-2 px-2 text-zinc-400 text-xs">ID</th>
                    <th className="text-left py-2 px-2 text-zinc-400 text-xs">Easting</th>
                    <th className="text-left py-2 px-2 text-zinc-400 text-xs">Northing</th>
                    <th className="text-left py-2 px-2 text-zinc-400 text-xs">Type</th>
                    <th className="w-10 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {monuments.map((mon, i) => (
                    <tr key={mon.id} className="border-b border-zinc-800">
                      <td className="py-2 px-2">
                        <input aria-label="Id"
                          type="text"
                          value={mon.id}
                          onChange={(e) => updateMonument(i, 'id', e.target.value)}
                          className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-white"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input aria-label="Easting"
                          type="number"
                          value={mon.easting}
                          onChange={(e) => updateMonument(i, 'easting', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-white"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input aria-label="Northing"
                          type="number"
                          value={mon.northing}
                          onChange={(e) => updateMonument(i, 'northing', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-white"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={mon.type}
                          onChange={(e) => updateMonument(i, 'type', e.target.value)}
                          className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm text-white"
                        >
                          <option value="control">Control</option>
                          <option value="intermediate">Intermediate</option>
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <button onClick={() => removeMonument(i)} className="text-red-400 hover:text-red-300">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {monuments.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-4">No monuments defined.</p>
            )}
          </div>

          {/* Bearing Schedule Preview (collapsible) */}
          <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
            <button
              onClick={() => setBearingScheduleOpen(!bearingScheduleOpen)}
              className="flex items-center justify-between w-full text-left"
            >
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-[var(--accent)]" />
                Bearing Schedule Preview
                <span className="text-xs text-zinc-500 font-normal">
                  ({computedBearingSchedule.length} lines)
                </span>
              </h3>
              {bearingScheduleOpen ? (
                <ChevronUp className="h-4 w-4 text-zinc-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              )}
            </button>
            {bearingScheduleOpen && computedBearingSchedule.length > 0 && (
              <div className="mt-4 overflow-x-auto max-h-72">
                <table className="w-full text-sm min-w-[500px]">
                  <thead className="sticky top-0 bg-zinc-900">
                    <tr className="border-b border-zinc-700">
                      <th className="text-left py-2 px-2 text-zinc-400 text-xs">Line</th>
                      <th className="text-left py-2 px-2 text-zinc-400 text-xs">From</th>
                      <th className="text-left py-2 px-2 text-zinc-400 text-xs">To</th>
                      <th className="text-left py-2 px-2 text-zinc-400 text-xs">Bearing</th>
                      <th className="text-right py-2 px-2 text-zinc-400 text-xs">Distance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedBearingSchedule.slice(0, 30).map((entry, i) => (
                      <tr key={`${entry}-${i}`} className="border-b border-zinc-800/50">
                        <td className="py-1.5 px-2 text-xs">{entry.lineId}</td>
                        <td className="py-1.5 px-2 text-xs">{entry.from}</td>
                        <td className="py-1.5 px-2 text-xs">{entry.to}</td>
                        <td className="py-1.5 px-2 text-xs font-mono">{entry.bearing_dms}</td>
                        <td className="py-1.5 px-2 text-xs text-right">{entry.distance_m.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {computedBearingSchedule.length > 30 && (
                  <p className="text-xs text-zinc-500 mt-2 text-center">
                    Showing 30 of {computedBearingSchedule.length} entries. Full schedule available in Step 4.
                  </p>
                )}
              </div>
            )}
            {bearingScheduleOpen && computedBearingSchedule.length === 0 && (
              <p className="text-sm text-zinc-500 mt-4 text-center py-4">
                No bearing schedule entries yet. Add plots with boundary points to generate entries.
              </p>
            )}
          </div>

          <div className="lg:col-span-2 flex justify-between">
            <button
              onClick={prevStep}
              className="flex items-center gap-2 px-6 py-3 border border-[var(--border-color)] rounded-lg text-zinc-300 hover:border-[var(--accent)]/50"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={() => { handleGenerate(); }}
              disabled={plots.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--accent)] text-black rounded-lg font-semibold disabled:opacity-40"
            >
              <Eye className="h-4 w-4" />
              Generate Plan
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
       *  STEP 4: REVIEW & EXPORT
       * ══════════════════════════════════════════════════════════════ */}
      {step === 4 && (
        <div className="space-y-6">
          {/* ── Area Reconciliation Report ── */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              Area Reconciliation Report
            </h3>
            {/* Top-level stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
              <div className="bg-zinc-800 rounded-lg p-3 text-center">
                <div className="text-xs text-zinc-400 mb-1">Total Plots</div>
                <div className="text-xl font-bold text-[var(--accent)]">{plots.length}</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3 text-center">
                <div className="text-xs text-zinc-400 mb-1">Declared Area</div>
                <div className="text-lg font-mono font-bold text-[var(--accent)]">{reconciliation.declaredTotal.toFixed(4)} Ha</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3 text-center">
                <div className="text-xs text-zinc-400 mb-1">Computed Area</div>
                <div className="text-lg font-mono font-bold text-[var(--accent)]">{reconciliation.computedTotal.toFixed(4)} Ha</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3 text-center">
                <div className="text-xs text-zinc-400 mb-1">Road Area</div>
                <div className="text-lg font-mono font-bold text-zinc-300">{reconciliation.roadArea.toFixed(4)} Ha</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3 text-center">
                <div className="text-xs text-zinc-400 mb-1">Monuments</div>
                <div className="text-xl font-bold text-[var(--accent)]">{monuments.length}</div>
              </div>
            </div>
            {/* Computed vs Declared comparison */}
            <div className="bg-zinc-800/60 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-xs text-zinc-400">Computed Total</span>
                  <div className="font-mono text-lg">{reconciliation.computedTotal.toFixed(4)} Ha</div>
                </div>
                <div>
                  <span className="text-xs text-zinc-400">Declared Total</span>
                  <div className="font-mono text-lg">{reconciliation.declaredTotal.toFixed(4)} Ha</div>
                </div>
                <div>
                  <span className="text-xs text-zinc-400">Discrepancy</span>
                  <div className={`font-mono text-lg ${reconciliation.discrepancyPct > 2 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {reconciliation.discrepancy >= 0 ? '+' : ''}{reconciliation.discrepancy.toFixed(4)} Ha ({reconciliation.discrepancyPct.toFixed(2)}%)
                  </div>
                </div>
                <div>
                  <span className="text-xs text-zinc-400">Road Area (Est.)</span>
                  <div className="font-mono text-lg">{reconciliation.roadArea.toFixed(4)} Ha</div>
                </div>
              </div>
              {/* Parent parcel area breakdown */}
              {reconciliation.parentArea > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-700">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-zinc-400">Parent Parcel Area</span>
                      <div className="font-mono">{reconciliation.parentArea.toFixed(4)} Ha</div>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-400">Available (Parent − Roads)</span>
                      <div className="font-mono">{reconciliation.availableArea.toFixed(4)} Ha</div>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-400">Plots vs Available</span>
                      <div className={`font-mono ${reconciliation.plotsExceed ? 'text-red-400' : 'text-emerald-400'}`}>
                        {reconciliation.plotsExceed
                          ? `Exceeds by ${(reconciliation.computedTotal - reconciliation.availableArea).toFixed(4)} Ha`
                          : `Within by ${(reconciliation.availableArea - reconciliation.computedTotal).toFixed(4)} Ha`}
                      </div>
                    </div>
                  </div>
                  {reconciliation.plotsExceed && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800/60 rounded-lg px-3 py-2">
                      <AlertCircle className="h-4 w-4" />
                      Total plot area ({reconciliation.computedTotal.toFixed(4)} Ha) exceeds available area ({reconciliation.availableArea.toFixed(4)} Ha) after deducting roads.
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Per-series area breakdown table */}
            {reconciliation.seriesEntries.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-zinc-300 mb-2">Per-Series Breakdown</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-700">
                        <th className="text-left py-2 px-3 text-zinc-400 text-xs">Series</th>
                        <th className="text-center py-2 px-3 text-zinc-400 text-xs">Plots</th>
                        <th className="text-right py-2 px-3 text-zinc-400 text-xs">Computed (Ha)</th>
                        <th className="text-right py-2 px-3 text-zinc-400 text-xs">Declared (Ha)</th>
                        <th className="text-right py-2 px-3 text-zinc-400 text-xs">Diff (Ha)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliation.seriesEntries.map(([series, data]) => {
                        const diff = data.computedArea - data.declaredArea;
                        return (
                          <tr key={series} className="border-b border-zinc-800/50">
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: (SERIES_COLORS[series] || SERIES_COLORS.a).stroke }} />
                                <span className="font-medium">Series {series.toUpperCase()}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center">{data.count}</td>
                            <td className="py-2 px-3 text-right font-mono">{data.computedArea.toFixed(4)}</td>
                            <td className="py-2 px-3 text-right font-mono">{data.declaredArea.toFixed(4)}</td>
                            <td className={`py-2 px-3 text-right font-mono ${Math.abs(diff) < 0.0001 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {diff >= 0 ? '+' : ''}{diff.toFixed(4)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t border-zinc-600 font-semibold">
                        <td className="py-2 px-3">Total</td>
                        <td className="py-2 px-3 text-center">{plots.length}</td>
                        <td className="py-2 px-3 text-right font-mono">{reconciliation.computedTotal.toFixed(4)}</td>
                        <td className="py-2 px-3 text-right font-mono">{reconciliation.declaredTotal.toFixed(4)}</td>
                        <td className={`py-2 px-3 text-right font-mono ${reconciliation.discrepancyPct > 2 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {reconciliation.discrepancy >= 0 ? '+' : ''}{reconciliation.discrepancy.toFixed(4)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* SVG Preview */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg overflow-auto">
            <div className="p-2">
              {svgOutput ? (
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(svgOutput) }} />
              ) : (
                <div className="text-center py-12 text-zinc-500">
                  <Eye className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Click Generate Plan to create the SVG preview</p>
                </div>
              )}
            </div>
          </div>

          {/* Export buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <button
              onClick={handleDownloadSVG}
              disabled={!svgOutput}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-[var(--accent)] text-black rounded-lg font-semibold disabled:opacity-40"
            >
              <Download className="h-5 w-5" />
              Download SVG
            </button>
            <button
              onClick={handleDownloadPNG}
              disabled={!svgOutput}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-[var(--accent)] text-black rounded-lg font-semibold disabled:opacity-40"
            >
              <Download className="h-5 w-5" />
              Download PNG (A1 300dpi)
            </button>
            <button
              onClick={handleDownloadDXF}
              disabled={plots.length === 0}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-[var(--accent)] text-black rounded-lg font-semibold disabled:opacity-40"
            >
              <Download className="h-5 w-5" />
              Download DXF
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={!svgOutput}
              className="flex items-center justify-center gap-2 px-6 py-4 border border-[var(--border-color)] rounded-lg text-zinc-300 hover:border-[var(--accent)]/50 disabled:opacity-40"
            >
              <Printer className="h-5 w-5" />
              Download PDF (Print)
            </button>
            <button
              onClick={() => { const w = window.open('', '_blank'); if (w) { w.document.write(svgOutput); w.document.close(); } }}
              disabled={!svgOutput}
              className="flex items-center justify-center gap-2 px-6 py-4 border border-[var(--border-color)] rounded-lg text-zinc-300 hover:border-[var(--accent)]/50 disabled:opacity-40"
            >
              <Eye className="h-5 w-5" />
              Open in New Tab
            </button>
          </div>

          {/* Bearing schedule */}
          {computedBearingSchedule.length > 0 && (
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Bearing Schedule ({computedBearingSchedule.length} lines)</h3>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm min-w-[500px]">
                  <thead className="sticky top-0 bg-zinc-900">
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Line</th>
                      <th className="text-left py-2 px-2">From</th>
                      <th className="text-left py-2 px-2">To</th>
                      <th className="text-left py-2 px-2">Bearing</th>
                      <th className="text-right py-2 px-2">Distance (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedBearingSchedule.slice(0, 80).map((entry, i) => (
                      <tr key={`${entry}-${i}`} className="border-b border-zinc-800/50">
                        <td className="py-1.5 px-2 text-xs">{entry.lineId}</td>
                        <td className="py-1.5 px-2 text-xs">{entry.from}</td>
                        <td className="py-1.5 px-2 text-xs">{entry.to}</td>
                        <td className="py-1.5 px-2 text-xs font-mono">{entry.bearing_dms}</td>
                        <td className="py-1.5 px-2 text-xs text-right">{entry.distance_m.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {computedBearingSchedule.length > 80 && (
                  <p className="text-xs text-zinc-500 mt-2 text-center">
                    Showing 80 of {computedBearingSchedule.length} entries
                  </p>
                )}
              </div>
            </div>
          )}

          <button
            onClick={prevStep}
            className="flex items-center gap-2 px-6 py-3 border border-[var(--border-color)] rounded-lg text-zinc-300 hover:border-[var(--accent)]/50"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Edit
          </button>
        </div>
      )}
    </div>
  );
}
