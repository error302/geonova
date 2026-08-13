'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { PlanGeometry } from '@/lib/engine/planGeometry';
import { to21037 } from '@/lib/map/projection';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SheetLayoutProps {
  show: boolean;
  map: import('ol/Map').default | null;
  planGeometry: PlanGeometry | null;
  lrNumber?: string;
  projectName?: string;
  surveyorName?: string;
  surveyorLicense?: string; // ISK number
  clientName?: string;
  county?: string;
}

interface GridTick {
  /** Pixel offset from left edge (for vertical ticks on left/right) or top edge (for horizontal ticks on top/bottom) */
  px: number;
  value: number;
  label: string;
}

interface ScaleBarInfo {
  /** Length of the bar in map meters */
  mapMeters: number;
  /** Length of the bar in CSS pixels */
  pxLength: number;
  /** Label like "50 m" or "1 km" */
  label: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Nice step values for grid ticks (in EPSG:21037 metres) */
const NICE_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

function niceStep(rangeM: number, maxTicks: number): number {
  const raw = rangeM / maxTicks;
  for (const s of NICE_STEPS) {
    if (s >= raw) return s;
  }
  return NICE_STEPS[NICE_STEPS.length - 1];
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function formatCoord(value: number): string {
  return value.toLocaleString('en-KE', { maximumFractionDigits: 0 });
}

function niceScaleBar(resolution: number, maxPx: number): ScaleBarInfo {
  // resolution = meters per pixel (approx for Web Mercator at the equator region)
  const targetMapMeters = maxPx * resolution;

  // Choose a nice round map distance
  const NICE_DISTANCES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  let mapMeters = 100;
  for (const d of NICE_DISTANCES) {
    if (d >= targetMapMeters * 0.4 && d <= targetMapMeters * 2.5) {
      mapMeters = d;
      break;
    }
  }

  const pxLength = mapMeters / resolution;
  const label = mapMeters >= 1000 ? `${mapMeters / 1000} km` : `${mapMeters} m`;

  return { mapMeters, pxLength, label };
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/** North arrow — styled SVG overlay in top-right area */
function NorthArrow({ rotation = 0 }: { rotation?: number }) {
  return (
    <div
      className="absolute top-6 right-6 flex flex-col items-center select-none pointer-events-none"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <svg width="48" height="64" viewBox="0 0 48 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Main arrow shaft */}
        <line x1="24" y1="56" x2="24" y2="12" stroke="#1B3A5C" strokeWidth="2.5" />
        {/* Arrow head - filled triangle */}
        <polygon points="24,2 16,18 24,14 32,18" fill="#1B3A5C" />
        {/* Arrow tail - open */}
        <polygon points="24,60 18,48 24,52 30,48" fill="none" stroke="#1B3A5C" strokeWidth="1.5" />
        {/* East tick */}
        <line x1="24" y1="36" x2="34" y2="36" stroke="#1B3A5C" strokeWidth="1" />
        {/* West tick */}
        <line x1="14" y1="36" x2="24" y2="36" stroke="#1B3A5C" strokeWidth="1" />
        {/* N label */}
        <text x="24" y="0" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1B3A5C" fontFamily="Calibri, sans-serif">
          N
        </text>
      </svg>
    </div>
  );
}

/** Scale bar — bottom-center */
function ScaleBar({ info }: { info: ScaleBarInfo }) {
  const clampedPx = Math.min(Math.max(info.pxLength, 40), 280);
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center select-none pointer-events-none">
      {/* Bar */}
      <div className="flex" style={{ width: clampedPx, height: 8 }}>
        {/* Left half (filled) */}
        <div className="w-1/2 h-full bg-[#1B3A5C]" />
        {/* Right half (outline only) */}
        <div className="w-1/2 h-full border-2 border-t-[#1B3A5C] border-r-[#1B3A5C] border-b-[#1B3A5C] border-l-0 bg-white" />
      </div>
      {/* Labels */}
      <div className="flex justify-between mt-1 text-[10px] font-medium text-[#1B3A5C]" style={{ width: clampedPx }}>
        <span>0</span>
        <span>{(info.mapMeters / 2 >= 1000 ? `${info.mapMeters / 2000} km` : `${info.mapMeters / 2} m`)}</span>
        <span>{info.label}</span>
      </div>
    </div>
  );
}

/** Grid ticks along map edges */
function GridTicks({
  ticksTop,
  ticksBottom,
  ticksLeft,
  ticksRight,
}: {
  ticksTop: GridTick[];
  ticksBottom: GridTick[];
  ticksLeft: GridTick[];
  ticksRight: GridTick[];
}) {
  return (
    <>
      {/* Bottom ticks — E coordinate */}
      {ticksBottom.map((t, i) => (
        <div
          key={`b${i}`}
          className="absolute bottom-0 flex flex-col items-center pointer-events-none select-none"
          style={{ left: t.px, transform: 'translateX(-50%)' }}
        >
          {/* Tick mark */}
          <div className="w-px h-3 bg-[#1B3A5C]" />
          {/* Label */}
          <span
            className="text-[9px] text-[#1B3A5C] font-medium bg-white/80 px-0.5 -mb-0.5 whitespace-nowrap"
            style={{ fontFamily: 'Calibri, sans-serif' }}
          >
            {t.label}
          </span>
        </div>
      ))}

      {/* Top ticks — E coordinate */}
      {ticksTop.map((t, i) => (
        <div
          key={`t${i}`}
          className="absolute top-0 flex flex-col items-center pointer-events-none select-none"
          style={{ left: t.px, transform: 'translateY(-100%)' }}
        >
          <span
            className="text-[9px] text-[#1B3A5C] font-medium bg-white/80 px-0.5 -mt-0.5 whitespace-nowrap"
            style={{ fontFamily: 'Calibri, sans-serif' }}
          >
            {t.label}
          </span>
          <div className="w-px h-3 bg-[#1B3A5C]" />
        </div>
      ))}

      {/* Left ticks — N coordinate */}
      {ticksLeft.map((t, i) => (
        <div
          key={`l${i}`}
          className="absolute left-0 flex items-center pointer-events-none select-none"
          style={{ top: t.px, transform: 'translate(-100%, -50%)' }}
        >
          <span
            className="text-[9px] text-[#1B3A5C] font-medium bg-white/80 px-0.5 -mr-0.5 whitespace-nowrap"
            style={{ fontFamily: 'Calibri, sans-serif' }}
          >
            {t.label}
          </span>
          <div className="h-px w-3 bg-[#1B3A5C]" />
        </div>
      ))}

      {/* Right ticks — N coordinate */}
      {ticksRight.map((t, i) => (
        <div
          key={`r${i}`}
          className="absolute right-0 flex items-center pointer-events-none select-none"
          style={{ top: t.px, transform: 'translate(100%, -50%)' }}
        >
          <div className="h-px w-3 bg-[#1B3A5C]" />
          <span
            className="text-[9px] text-[#1B3A5C] font-medium bg-white/80 px-0.5 -ml-0.5 whitespace-nowrap"
            style={{ fontFamily: 'Calibri, sans-serif' }}
          >
            {t.label}
          </span>
        </div>
      ))}

      {/* Border lines */}
      <div className="absolute inset-0 border border-[#1B3A5C] pointer-events-none" />
    </>
  );
}

/** Title block — bottom-right white box */
function TitleBlock({
  lrNumber,
  projectName,
  surveyorName,
  surveyorLicense,
  clientName,
  county,
  scale,
  date,
}: {
  lrNumber?: string;
  projectName?: string;
  surveyorName?: string;
  surveyorLicense?: string;
  clientName?: string;
  county?: string;
  scale?: string;
  date?: string;
}) {
  const formattedDate = date ?? new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      className="absolute bottom-3 right-3 bg-white border-2 border-[#1B3A5C] rounded-sm shadow-md select-none pointer-events-none sheet-title-block"
      style={{ fontFamily: 'Calibri, sans-serif', width: 280, fontSize: 11, lineHeight: 1.4 }}
    >
      {/* Header */}
      <div className="bg-[#1B3A5C] text-white text-center py-1 px-2">
        <div className="text-xs font-bold tracking-wide">REPUBLIC OF KENYA</div>
      </div>

      {/* Content rows */}
      <div className="px-2.5 py-1.5 space-y-0.5 text-[10px]">
        {/* Horizontal line under header */}
        <div className="border-b border-[#1B3A5C] pb-1 mb-1 text-[10px] font-bold text-[#1B3A5C] text-center tracking-wide">
          SURVEY PLAN
        </div>

        <Row label="LR No." value={lrNumber ?? 'N/A'} />
        <Row label="Project" value={projectName ?? 'N/A'} />
        <Row label="Surveyor" value={surveyorName ?? 'N/A'} />
        <Row label="ISK No." value={surveyorLicense ?? 'N/A'} />
        <Row label="Client" value={clientName ?? 'N/A'} />
        <Row label="County" value={county ?? 'N/A'} />
        <Row label="Scale" value={scale ?? 'As Noted'} />
        <Row label="Date" value={formattedDate} />

        {/* Drawing number */}
        <div className="border-t border-[#1B3A5C] pt-1 mt-1 flex justify-between text-[9px] text-gray-500">
          <span>Dwg No: MET-{String(Date.now()).slice(-6)}</span>
          <span>Sheet 1 of 1</span>
        </div>

        {/* Generated by */}
        <div className="text-center text-[9px] text-gray-400 mt-0.5">
          Generated by METARDU
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="text-[#1B3A5C] font-semibold w-16 shrink-0">{label}</span>
      <span className="text-gray-700 truncate">{value}</span>
    </div>
  );
}

/** Surveyor's certificate */
function SurveyorsCertificate({
  surveyorName,
  surveyorLicense,
  date,
}: {
  surveyorName?: string;
  surveyorLicense?: string;
  date?: string;
}) {
  const formattedDate = date ?? new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      className="absolute bottom-3 left-3 bg-white/95 border border-[#1B3A5C] rounded-sm shadow-md select-none pointer-events-none sheet-certificate"
      style={{ fontFamily: 'Calibri, sans-serif', maxWidth: 320, fontSize: 10, lineHeight: 1.5, padding: '8px 10px' }}
    >
      <div className="font-bold text-[10px] text-[#1B3A5C] mb-1">SURVEYOR&apos;S CERTIFICATE</div>
      <p className="text-[9px] text-gray-700 leading-relaxed">
        I certify that this plan was prepared by me, or under my direct personal supervision,
        and that all bearings and distances shown are correctly reduced to the
        Clarke 1880 (Arc) Spheroid (International foot) and the projected coordinates
        are on Arc 1950 / UTM Zone 37 South.
      </p>
      <p className="text-[9px] text-gray-700 mt-1">
        I further certify that this plan is correct and is in accordance with the
        provisions of the Survey Act (Cap 299) of the Laws of Kenya.
      </p>
      <div className="mt-2 flex justify-between text-[9px]">
        <span className="text-[#1B3A5C] font-semibold">{surveyorName ?? '_________________________'}</span>
        <span>{formattedDate}</span>
      </div>
      <div className="text-[8px] text-gray-500">
        Licensed Surveyor — ISK No. {surveyorLicense ?? '___________'}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main SheetLayout component                                         */
/* ------------------------------------------------------------------ */

export default function SheetLayout({
  show,
  map,
  planGeometry,
  lrNumber,
  projectName,
  surveyorName,
  surveyorLicense,
  clientName,
  county,
}: SheetLayoutProps) {
  const [resolution, setResolution] = useState(0);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [gridTicks, setGridTicks] = useState<{
    top: GridTick[];
    bottom: GridTick[];
    left: GridTick[];
    right: GridTick[];
  }>({ top: [], bottom: [], left: [], right: [] });
  const [, setViewExtent21037] = useState<{
    minE: number;
    maxE: number;
    minN: number;
    maxN: number;
  } | null>(null);

  /* ── Observe map size and resolution ────────────────────────────── */
  useEffect(() => {
    if (!map || !show) return;

    const updateSize = () => {
      const target = map.getTargetElement();
      if (target) {
        setContainerSize({ w: target.clientWidth, h: target.clientHeight });
      }
    };

    const updateResolution = () => {
      const view = map.getView();
      setResolution(view.getResolution() ?? 0);
    };

    // Observe map target resize
    const resizeObserver = new ResizeObserver(() => updateSize());
    const target = map.getTargetElement();
    if (target) {
      resizeObserver.observe(target);
      updateSize();
    }

    // Observe view changes (zoom/pan)
    const view = map.getView();
    view.on('change:resolution', updateResolution);
    view.on('change:center', () => {
      updateResolution();
    });

    updateResolution();

    return () => {
      resizeObserver.disconnect();
      view.un('change:resolution', updateResolution);
      view.un('change:center', updateResolution);
    };
  }, [map, show]);

  /* ── Compute grid ticks when view changes ──────────────────────── */
  const computeGridTicks = useCallback(async () => {
    if (!map || !show || containerSize.w === 0) return;

    const view = map.getView();
    const extent3857 = view.calculateExtent(map.getSize());
    const [x1, y1, x2, y2] = extent3857;

    // Convert corners to EPSG:21037
    const [[e1, n1], [e2, n2]] = await Promise.all([
      to21037(x1, y1),
      to21037(x2, y2),
    ]);

    const minE = Math.min(e1, e2);
    const maxE = Math.max(e1, e2);
    const minN = Math.min(n1, n2);
    const maxN = Math.max(n1, n2);

    setViewExtent21037({ minE, maxE, minN, maxN });

    const rangeE = maxE - minE;
    const rangeN = maxN - minN;

    const stepE = niceStep(rangeE, 6);
    const stepN = niceStep(rangeN, 6);

    const startE = roundTo(minE, stepE);
    const startN = roundTo(minN, stepN);

    // Horizontal ticks (bottom/top — E values)
    const ticksH: GridTick[] = [];
    for (let e = startE; e <= maxE + stepE * 0.01; e += stepE) {
      const frac = (e - minE) / rangeE;
      const px = frac * containerSize.w;
      if (px >= -5 && px <= containerSize.w + 5) {
        ticksH.push({ px, value: e, label: `E ${formatCoord(e)}` });
      }
    }

    // Vertical ticks (left/right — N values)
    const ticksV: GridTick[] = [];
    for (let n = startN; n <= maxN + stepN * 0.01; n += stepN) {
      const frac = 1 - (n - minN) / rangeN; // Invert because screen Y is down
      const px = frac * containerSize.h;
      if (px >= -5 && px <= containerSize.h + 5) {
        ticksV.push({ px, value: n, label: `N ${formatCoord(n)}` });
      }
    }

    setGridTicks({
      top: ticksH,
      bottom: ticksH,
      left: ticksV,
      right: ticksV,
    });
  }, [map, show, containerSize]);

  useEffect(() => {
    computeGridTicks();
  }, [computeGridTicks]);

  /* ── Scale bar ──────────────────────────────────────────────────── */
  const scaleBar = useMemo(() => {
    if (resolution <= 0) return { mapMeters: 0, pxLength: 0, label: '' };
    return niceScaleBar(resolution, 200);
  }, [resolution]);

  /* ── Scale label (e.g. "1:1000") ───────────────────────────────── */
  const scaleLabel = planGeometry ? `1:${planGeometry.scale.toLocaleString()}` : 'As Noted';

  /* ── Don't render when hidden ───────────────────────────────────── */
  if (!show) return null;

  return (
    <div
      className="absolute inset-0 overflow-hidden sheet-layout-overlay"
      style={{ zIndex: 20 }}
    >
      {/* North Arrow */}
      <NorthArrow />

      {/* Scale Bar */}
      <ScaleBar info={scaleBar} />

      {/* Grid Ticks */}
      <GridTicks
        ticksTop={gridTicks.top}
        ticksBottom={gridTicks.bottom}
        ticksLeft={gridTicks.left}
        ticksRight={gridTicks.right}
      />

      {/* Title Block */}
      <TitleBlock
        lrNumber={lrNumber}
        projectName={projectName}
        surveyorName={surveyorName}
        surveyorLicense={surveyorLicense}
        clientName={clientName}
        county={county}
        scale={scaleLabel}
      />

      {/* Surveyor's Certificate */}
      <SurveyorsCertificate
        surveyorName={surveyorName}
        surveyorLicense={surveyorLicense}
      />
    </div>
  );
}
