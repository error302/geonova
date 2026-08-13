/**
 * Location Plan Inset — Server-side renderer for cadastral PDF documents
 *
 * Generates a small overview map (PNG) showing the survey area's position
 * within a wider county/district context. The inset is rendered with the
 * `canvas` (node-canvas) npm package and can be embedded into a jsPDF
 * document via the companion `embedInsetInPdf` helper.
 *
 * Coordinate system: Arc 1960 / UTM Zone 37S (EPSG:21037) — the Kenyan
 * cadastral standard per the Survey Act Cap 299 & Kenya Survey Regulations 1994.
 */

import { createCanvas } from 'canvas';
import type { CanvasRenderingContext2D as CanvasCtx } from 'canvas';
import proj4 from 'proj4';
import type { jsPDF as JsPDF } from 'jspdf';
import { SRID_21037 } from '@/lib/map/projection'

// ─── PROJ Definition (SRID 21037) ───────────────────────────────────────────

const WGS84 = 'EPSG:4326';
const ARC1960_UTM37S =
  '+proj=utm +zone=37 +south +ellps=clrk80 +towgs84=-160,-6,-302,-0.807,0.339,-1.619,-2.554 +units=m +no_defs +type=crs';

// Register once so proj4 can resolve by name if needed elsewhere
proj4.defs(SRID_21037, ARC1960_UTM37S);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LocationPlanParams {
  /** Survey area centre in WGS84 geographic coordinates */
  centroid: { lat: number; lng: number };
  /** Survey boundary vertices in local (UTM 37S / Arc 1960) metres */
  boundaryPoints: Array<{ x: number; y: number }>;
  /** Optional county name shown as a label */
  county?: string;
  /** Inset pixel dimensions (default 300×200) */
  size?: { width: number; height: number };
  /** Map scale denominator (e.g. 50000). Auto-calculated when omitted. */
  scale?: number;
  /** Show north arrow (default true) */
  northArrow?: boolean;
  /** Show scale bar (default true) */
  scaleBar?: boolean;
}

// ─── Colour palette ─────────────────────────────────────────────────────────

const COLOUR = {
  background:      '#FFFFFF',
  frame:           '#1B3A5C',
  gridLine:        '#E2E6EA',
  gridLabel:       '#8A9BAE',
  boundaryFill:    '#FFE8CC',
  boundaryStroke:  '#6B3A00',
  centroidMarker:  '#D32F2F',
  northArrow:      '#1B3A5C',
  northArrowFill:  '#1B3A5C',
  scaleBarFill:    '#1B3A5C',
  scaleBarText:    '#333333',
  countyLabel:     '#1B3A5C',
  crosshair:       '#B0BEC5',
};

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Project WGS84 lat/lng to Arc 1960 / UTM Zone 37S easting/northing (metres) */
function wgs84ToUtm37S(lat: number, lng: number): { easting: number; northing: number } {
  const [easting, northing] = proj4(WGS84, ARC1960_UTM37S, [lng, lat]);
  return { easting, northing };
}

/**
 * Pick a "nice" round scale denominator that fits the data extent inside the
 * drawing area with at least `paddingFraction` (0–1) of whitespace on each side.
 */
function computeNiceScale(
  extentE: number,
  extentN: number,
  drawWidthPx: number,
  drawHeightPx: number,
  paddingFraction: number = 0.20,
): number {
  const usableW = drawWidthPx * (1 - 2 * paddingFraction);
  const usableH = drawHeightPx * (1 - 2 * paddingFraction);

  // metres per pixel at scale 1
  const scaleFromE = extentE / usableW;
  const scaleFromN = extentN / usableH;
  const rawScale = Math.max(scaleFromE, scaleFromN);

  // Round up to a "standard" cadastral scale
  const standardScales = [
    200, 500, 1000, 2000, 2500, 5000,
    10000, 20000, 25000, 50000, 100000,
    200000, 500000, 1000000,
  ];

  return standardScales.find((s) => s >= rawScale) ?? Math.ceil(rawScale / 100000) * 100000;
}

/** Format ground distance for the scale bar label */
function formatGroundDist(metres: number): string {
  if (metres >= 1000 && metres % 1000 === 0) return `${metres / 1000} km`;
  return `${metres.toFixed(0)} m`;
}

/** Compute a nice grid spacing (in metres) for the current scale */
function computeGridSpacing(scale: number): number {
  const targetPixelGap = 50; // aim for ~50 px between grid lines
  const metresPerPixel = scale; // at 1:1, 1 px = scale metres
  const rawMetres = targetPixelGap * metresPerPixel;

  const niceSteps = [
    10, 20, 50, 100, 200, 500,
    1000, 2000, 5000, 10000, 20000, 50000,
    100000, 200000, 500000,
  ];

  return niceSteps.find((s) => s >= rawMetres) ?? Math.ceil(rawMetres / 50000) * 50000;
}

// ─── Drawing primitives ──────────────────────────────────────────────────────

function drawFrame(ctx: CanvasCtx, w: number, h: number): void {
  // Outer border
  ctx.strokeStyle = COLOUR.frame;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);

  // Inner border
  ctx.lineWidth = 0.5;
  ctx.strokeRect(4, 4, w - 8, h - 8);
}

function drawGridLines(
  ctx: CanvasCtx,
  drawX: number,
  drawY: number,
  drawW: number,
  drawH: number,
  centreE: number,
  centreN: number,
  scale: number,
  metresPerPixel: number,
): void {
  const gridSpacing = computeGridSpacing(scale);
  const gridPx = gridSpacing / metresPerPixel;

  ctx.strokeStyle = COLOUR.gridLine;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([4, 4]);

  // Vertical lines (easting)
  const startEOffset = -Math.ceil((drawW / 2) / gridPx) * gridPx;
  for (let dx = startEOffset; dx <= drawW / 2; dx += gridPx) {
    const px = drawX + drawW / 2 + dx;
    if (px < drawX || px > drawX + drawW) continue;
    ctx.beginPath();
    ctx.moveTo(px, drawY);
    ctx.lineTo(px, drawY + drawH);
    ctx.stroke();
  }

  // Horizontal lines (northing)
  const startNOffset = -Math.ceil((drawH / 2) / gridPx) * gridPx;
  for (let dy = startNOffset; dy <= drawH / 2; dy += gridPx) {
    const py = drawY + drawH / 2 + dy;
    if (py < drawY || py > drawY + drawH) continue;
    ctx.beginPath();
    ctx.moveTo(drawX, py);
    ctx.lineTo(drawX + drawW, py);
    ctx.stroke();
  }

  ctx.setLineDash([]);

  // Grid labels along edges
  ctx.fillStyle = COLOUR.gridLabel;
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (let dx = startEOffset; dx <= drawW / 2; dx += gridPx) {
    const px = drawX + drawW / 2 + dx;
    if (px < drawX + 15 || px > drawX + drawW - 15) continue;
    const easting = centreE + (dx * metresPerPixel);
    ctx.fillText(easting.toFixed(0), px, drawY + drawH + 2);
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let dy = startNOffset; dy <= drawH / 2; dy += gridPx) {
    const py = drawY + drawH / 2 + dy;
    if (py < drawY + 10 || py > drawY + drawH - 10) continue;
    // Note: canvas Y increases downward, but northing increases upward
    const northing = centreN - (dy * metresPerPixel);
    ctx.fillText(northing.toFixed(0), drawX - 3, py);
  }
}

function drawBoundary(
  ctx: CanvasCtx,
  boundaryPoints: Array<{ x: number; y: number }>,
  centreE: number,
  centreN: number,
  metresPerPixel: number,
  drawX: number,
  drawY: number,
  drawW: number,
  drawH: number,
): void {
  if (boundaryPoints.length < 2) return;

  // Transform each boundary point to pixel coords
  const toPixel = (easting: number, northing: number): { px: number; py: number } => {
    const dxMetres = easting - centreE;
    const dyMetres = northing - centreN;
    return {
      px: drawX + drawW / 2 + dxMetres / metresPerPixel,
      py: drawY + drawH / 2 - dyMetres / metresPerPixel, // Y flipped
    };
  };

  // Fill
  ctx.beginPath();
  const first = toPixel(boundaryPoints[0].x, boundaryPoints[0].y);
  ctx.moveTo(first.px, first.py);
  for (let i = 1; i < boundaryPoints.length; i++) {
    const p = toPixel(boundaryPoints[i].x, boundaryPoints[i].y);
    ctx.lineTo(p.px, p.py);
  }
  ctx.closePath();
  ctx.fillStyle = COLOUR.boundaryFill;
  ctx.fill();

  // Stroke
  ctx.strokeStyle = COLOUR.boundaryStroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawCentroidMarker(
  ctx: CanvasCtx,
  cx: number,
  cy: number,
): void {
  // Cross / + marker
  const arm = 8;
  ctx.strokeStyle = COLOUR.centroidMarker;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy);
  ctx.lineTo(cx + arm, cy);
  ctx.moveTo(cx, cy - arm);
  ctx.lineTo(cx, cy + arm);
  ctx.stroke();

  // Small circle at centre
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = COLOUR.centroidMarker;
  ctx.fill();
}

function drawNorthArrow(
  ctx: CanvasCtx,
  cx: number,
  cy: number,
  size: number = 18,
): void {
  const h = size;
  const w = size * 0.35;

  // Arrow body (filled triangle)
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);          // tip
  ctx.lineTo(cx - w, cy + h / 2);      // bottom-left
  ctx.lineTo(cx + w, cy + h / 2);      // bottom-right
  ctx.closePath();
  ctx.fillStyle = COLOUR.northArrowFill;
  ctx.fill();

  // Right half in lighter shade for 3-D effect
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx, cy + h / 2);
  ctx.lineTo(cx + w, cy + h / 2);
  ctx.closePath();
  ctx.fillStyle = '#3A5A7C';
  ctx.fill();

  // "N" label
  ctx.fillStyle = COLOUR.northArrow;
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('N', cx, cy - h / 2 - 2);
}

function drawScaleBar(
  ctx: CanvasCtx,
  x: number,
  y: number,
  scale: number,
  barWidthPx: number = 60,
): void {
  const groundDist = (barWidthPx * scale); // metres (1 px = scale metres)

  // Round ground distance to a nice number
  const niceSteps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  const niceDist = niceSteps.find((s) => s >= groundDist) ?? Math.ceil(groundDist / 10000) * 10000;
  const actualBarPx = niceDist / scale;

  // Bar (alternating fill)
  const barH = 4;
  const halfPx = actualBarPx / 2;

  // Left half — dark
  ctx.fillStyle = COLOUR.scaleBarFill;
  ctx.fillRect(x, y, halfPx, barH);

  // Right half — white with border
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x + halfPx, y, halfPx, barH);
  ctx.strokeStyle = COLOUR.scaleBarFill;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, actualBarPx, barH);

  // Labels
  ctx.fillStyle = COLOUR.scaleBarText;
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('0', x, y + barH + 1);
  ctx.fillText(formatGroundDist(niceDist / 2), x + halfPx, y + barH + 1);
  ctx.fillText(formatGroundDist(niceDist), x + actualBarPx, y + barH + 1);

  // Scale text
  ctx.font = '6px sans-serif';
  ctx.fillText(`1 : ${scale.toLocaleString()}`, x + actualBarPx / 2, y + barH + 10);
}

function drawCountyLabel(
  ctx: CanvasCtx,
  county: string,
  drawX: number,
  drawY: number,
  drawW: number,
): void {
  ctx.fillStyle = COLOUR.countyLabel;
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(county.toUpperCase(), drawX + drawW / 2, drawY + 4);
}

function drawCrosshair(
  ctx: CanvasCtx,
  drawX: number,
  drawY: number,
  drawW: number,
  drawH: number,
): void {
  // Faint crosshair through the centre
  ctx.strokeStyle = COLOUR.crosshair;
  ctx.lineWidth = 0.4;
  ctx.setLineDash([2, 4]);

  ctx.beginPath();
  ctx.moveTo(drawX + drawW / 2, drawY);
  ctx.lineTo(drawX + drawW / 2, drawY + drawH);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(drawX, drawY + drawH / 2);
  ctx.lineTo(drawX + drawW, drawY + drawH / 2);
  ctx.stroke();

  ctx.setLineDash([]);
}

// ─── Main renderer ───────────────────────────────────────────────────────────

/**
 * Render a location plan inset as a PNG buffer.
 *
 * The inset shows the survey boundary within a wider context, with a north
 * arrow, scale bar, grid references and optional county label — suitable for
 * embedding in a cadastral deed plan or survey report PDF.
 */
export async function renderLocationPlanInset(params: LocationPlanParams): Promise<Buffer> {
  const {
    centroid,
    boundaryPoints,
    county,
    size = { width: 300, height: 200 },
    northArrow = true,
    scaleBar = true,
  } = params;

  const { width, height } = size;

  // ── Project centroid to UTM 37S ──────────────────────────────────────────
  const centroidUTM = wgs84ToUtm37S(centroid.lat, centroid.lng);

  // ── Determine extent from boundary points ────────────────────────────────
  let minE = centroidUTM.easting;
  let maxE = centroidUTM.easting;
  let minN = centroidUTM.northing;
  let maxN = centroidUTM.northing;

  for (const pt of boundaryPoints) {
    if (pt.x < minE) minE = pt.x;
    if (pt.x > maxE) maxE = pt.x;
    if (pt.y < minN) minN = pt.y;
    if (pt.y > maxN) maxN = pt.y;
  }

  const extentE = maxE - minE || 100;   // fallback 100 m
  const extentN = maxN - minN || 100;

  // ── Drawing area (inner margin) ──────────────────────────────────────────
  const marginFrame = 6;
  const marginTop = county ? 20 : 10;
  const marginBottom = scaleBar ? 28 : 10;
  const marginSide = 30; // room for northing labels

  const drawX = marginFrame + marginSide;
  const drawY = marginFrame + marginTop;
  const drawW = width - marginFrame * 2 - marginSide * 2;
  const drawH = height - marginFrame * 2 - marginTop - marginBottom;

  // ── Scale ────────────────────────────────────────────────────────────────
  const scale = params.scale ?? computeNiceScale(extentE, extentN, drawW, drawH);
  const metresPerPixel = scale; // at scale 1:N, 1 pixel represents N metres

  // Use centroid as the drawing centre
  const centreE = centroidUTM.easting;
  const centreN = centroidUTM.northing;

  // ── Create canvas ────────────────────────────────────────────────────────
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = COLOUR.background;
  ctx.fillRect(0, 0, width, height);

  // Crosshair guides
  drawCrosshair(ctx, drawX, drawY, drawW, drawH);

  // Grid lines and labels
  drawGridLines(ctx, drawX, drawY, drawW, drawH, centreE, centreN, scale, metresPerPixel);

  // Boundary polygon
  drawBoundary(ctx, boundaryPoints, centreE, centreN, metresPerPixel, drawX, drawY, drawW, drawH);

  // Centroid marker (always at canvas centre of drawing area)
  const cpx = drawX + drawW / 2;
  const cpy = drawY + drawH / 2;
  drawCentroidMarker(ctx, cpx, cpy);

  // County label
  if (county) {
    drawCountyLabel(ctx, county, drawX, drawY, drawW);
  }

  // North arrow (top-right inside drawing area)
  if (northArrow) {
    const arrowX = drawX + drawW - 16;
    const arrowY = drawY + 20;
    drawNorthArrow(ctx, arrowX, arrowY);
  }

  // Scale bar (bottom-centre inside drawing area)
  if (scaleBar) {
    const barWidth = Math.min(60, drawW * 0.4);
    const sbx = drawX + (drawW - barWidth) / 2;
    const sby = drawY + drawH + 12;
    drawScaleBar(ctx, sbx, sby, scale, barWidth);
  }

  // Frame (drawn last so it's on top)
  drawFrame(ctx, width, height);

  // ── Export PNG buffer ────────────────────────────────────────────────────
  return canvas.toBuffer('image/png') as Buffer;
}

// ─── jsPDF embedding helper ─────────────────────────────────────────────────

/**
 * Render the location plan inset and embed it into a jsPDF document at the
 * given page coordinates.
 *
 * @param doc   - jsPDF document instance
 * @param params - Location plan parameters
 * @param x     - Left-edge X position in jsPDF units (mm)
 * @param y     - Top-edge Y position in jsPDF units (mm)
 */
export async function embedInsetInPdf(
  doc: JsPDF,
  params: LocationPlanParams,
  x: number,
  y: number,
): Promise<void> {
  const pngBuffer = await renderLocationPlanInset(params);
  const { width, height } = params.size ?? { width: 300, height: 200 };

  // Convert pixel dimensions to mm at 96 DPI (1 in = 25.4 mm)
  const pxToMm = 25.4 / 96;
  const wMm = width * pxToMm;
  const hMm = height * pxToMm;

  // jsPDF addImage accepts a base64 data URL or ArrayBuffer
  const base64 = pngBuffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;

  doc.addImage(dataUrl, 'PNG', x, y, wMm, hMm);
}
