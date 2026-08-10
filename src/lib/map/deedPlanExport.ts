'use client';

/**
 * METARDU Deed Plan Export
 *
 * Print-quality deed plan export for Survey of Kenya (SoK) compliance.
 * Renders the OpenLayers map canvas at an exact scale and DPI, then composites
 * overlays (title block, north arrow, scale bar, grid ticks) directly onto the
 * canvas for pixel-perfect PNG output.
 *
 * All OL imports are dynamic for SSR safety (Next.js requirement).
 * The map view (center, resolution, size, pixel ratio) is saved before export
 * and fully restored afterwards, regardless of success or failure.
 *
 * Scale derivation:
 *   resolution = scale × 0.0254 / DPI   [metres per pixel]
 *   where 0.0254 = 25.4 mm/in ÷ 1000 mm/m
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Paper dimensions in mm [width, height] */
const PAPER_SIZES_MM: Record<string, [number, number]> = {
  a1: [841, 594],
  a2: [594, 420],
  a3: [420, 297],
  a4: [297, 210],
};

/** Millimetres per inch */
const MM_PER_INCH = 25.4;

/** Points per inch (typographic) */
const PT_PER_INCH = 72;

/** Outer border thickness in mm */
const OUTER_BORDER_MM = 0.7;

/** Inner margin in mm (between outer border and drawing area) */
const MARGIN_MM = 10;

/** Maximum time to wait for a render in ms */
const RENDER_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options accepted by {@link exportDeedPlan} and {@link downloadDeedPlan}.
 */
interface DeedPlanExportOptions {
  /** OpenLayers map instance. */
  map: import('ol/Map').default;
  /** Target scale denominator (e.g. `1000` for 1:1000). */
  scale: number;
  /** ISO paper size. */
  paperSize: 'a1' | 'a2' | 'a3' | 'a4';
  /** Page orientation. */
  orientation: 'landscape' | 'portrait';
  /** Output resolution in dots per inch (default `300`). */
  dpi?: number;
  /** Render a north arrow in the upper-right area (default `true`). */
  includeNorthArrow?: boolean;
  /** Render a calibrated scale bar at bottom-centre (default `true`). */
  includeScaleBar?: boolean;
  /** Render E/N grid tick labels along drawing edges (default `true`). */
  includeGridTicks?: boolean;
  /** Render the SoK-style title block (default `true`). */
  includeTitleBlock?: boolean;
  /** Land Registration number (e.g. `209/3344`). */
  lrNumber?: string;
  /** Project / scheme name. */
  projectName?: string;
  /** Licensed surveyor full name. */
  surveyorName?: string;
  /** Institution of Surveyors of Kenya (ISK) licence number. */
  surveyorLicense?: string;
  /** Client / commissioning body. */
  clientName?: string;
  /** County in Kenya. */
  county?: string;
}

// ---------------------------------------------------------------------------
// Unit-conversion helpers
// ---------------------------------------------------------------------------

/** Millimetres → pixels at a given DPI. */
function mmToPx(mm: number, dpi: number): number {
  return (mm * dpi) / MM_PER_INCH;
}

/** Typographic points → pixels at a given DPI. */
function ptToPx(pt: number, dpi: number): number {
  return (pt * dpi) / PT_PER_INCH;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Return paper dimensions in mm, swapped when landscape is requested.
 *
 * @returns `[width, height]` in mm
 */
function getPaperDimensions(
  paperSize: string,
  orientation: 'landscape' | 'portrait',
): [number, number] {
  const [w, h] = PAPER_SIZES_MM[paperSize] ?? PAPER_SIZES_MM.a4;
  return orientation === 'landscape' ? [Math.max(w, h), Math.min(w, h)]
                                   : [Math.min(w, h), Math.max(w, h)];
}

/**
 * Calculate the map resolution (metres / CSS pixel) required to render at
 * the requested scale and DPI.
 *
 * Derivation
 * ----------
 *   scale  = ground_m / paper_m
 *   paper_m = paper_mm / 1000
 *   pixels  = paper_mm × (DPI / 25.4)
 *   ground_m = scale × paper_mm / 1000
 *   resolution = ground_m / pixels
 *              = (scale × paper_mm / 1000) / (paper_mm × DPI / 25.4)
 *              = scale × 25.4 / (1000 × DPI)
 *              = scale × 0.0254 / DPI
 */
function calculateResolution(scale: number, dpi: number): number {
  return (scale * MM_PER_INCH) / (dpi * 1000);
}

/**
 * Compute a "nice" grid interval (round number) that yields approximately
 * `targetLines` lines across `extentWidth` metres.
 *
 * Returns values like 1, 2, 5, 10, 20, 50, 100, 200, 500 …
 */
function niceGridInterval(extentWidth: number, targetLines: number = 8): number {
  const rough = extentWidth / targetLines;
  if (rough <= 0) return 1;

  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;

  const nice = norm < 1.5 ? 1
             : norm < 3.5 ? 2
             : norm < 7.5 ? 5
             :             10;

  return nice * mag;
}

/**
 * Format a projected coordinate for grid-tick labels.
 * Shows an integer when possible, otherwise one decimal place.
 */
function formatCoord(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
}

/** Return today's date as `DD MMM YYYY` (e.g. `15 Jan 2025`). */
function getFormattedDate(): string {
  const d = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Overlay: Border
// ---------------------------------------------------------------------------

/**
 * Draw the deed-plan border frame.
 *
 * ┌─ thick outer line (0.7 mm)
 * │  ┌─ thin inner line (0.25 mm) with 10 mm margin
 * │  │
 * │  │   drawing area
 * │  │
 * │  └─
 * └─
 */
function drawBorder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpi: number,
): void {
  const outer = mmToPx(OUTER_BORDER_MM, dpi);
  const margin = mmToPx(MARGIN_MM, dpi);

  // Outer border
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = outer;
  ctx.strokeRect(outer / 2, outer / 2, width - outer, height - outer);

  // Inner border
  ctx.lineWidth = mmToPx(0.25, dpi);
  ctx.strokeRect(margin, margin, width - 2 * margin, height - 2 * margin);
}

// ---------------------------------------------------------------------------
// Overlay: Title Block
// ---------------------------------------------------------------------------

/**
 * Draw the SoK-style title block in the bottom-right corner.
 *
 * Layout (proportional):
 * ```
 * ┌─────────────────────────────┐
 * │       REPUBLIC OF KENYA     │
 * │          SURVEY PLAN        │
 * │─────────────────────────────│
 * │  LR No:       209/3344     │
 * │  Project:     Metardu P2    │
 * │  Surveyor:    J. Mwangi     │
 * │  ISK No:      2847          │
 * │  Client:      Kenya Rail    │
 * │  County:      Nairobi       │
 * │  Scale:       1:1000        │
 * │  Date:        15 Jan 2025   │
 * │─────────────────────────────│
 * │  Drawing No: DWG-001        │
 * │  Sheet:       1 of 1        │
 * └─────────────────────────────┘
 * ```
 */
function drawTitleBlock(
  ctx: CanvasRenderingContext2D,
  opts: DeedPlanExportOptions,
  cw: number,
  ch: number,
  dpi: number,
): void {
  const outer = mmToPx(OUTER_BORDER_MM, dpi);
  const tbW = Math.round(cw * 0.28);
  const tbH = Math.round(ch * 0.46);
  const x = cw - tbW - outer;
  const y = ch - tbH - outer;

  // ── White background ────────────────────────────────────────────────────
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, tbW, tbH);

  // ── Outer frame ─────────────────────────────────────────────────────────
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = mmToPx(0.5, dpi);
  ctx.strokeRect(x, y, tbW, tbH);

  // ── Font sizes ──────────────────────────────────────────────────────────
  const headerFont = `bold ${ptToPx(16, dpi)}px "Arial", "Helvetica", sans-serif`;
  const subFont    = `bold ${ptToPx(12, dpi)}px "Arial", "Helvetica", sans-serif`;
  const labelFont  = `${ptToPx(9, dpi)}px "Arial", "Helvetica", sans-serif`;
  const valueFont  = `bold ${ptToPx(10, dpi)}px "Arial", "Helvetica", sans-serif`;

  const pad = mmToPx(4, dpi);
  const rowH = ptToPx(15, dpi);

  // ── "REPUBLIC OF KENYA" ─────────────────────────────────────────────────
  let cy = y + pad + ptToPx(16, dpi);
  ctx.fillStyle = '#000000';
  ctx.font = headerFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('REPUBLIC OF KENYA', x + tbW / 2, cy);

  // ── "SURVEY PLAN" ───────────────────────────────────────────────────────
  cy += rowH + ptToPx(2, dpi);
  ctx.font = subFont;
  ctx.fillText('SURVEY PLAN', x + tbW / 2, cy);

  // ── Divider ─────────────────────────────────────────────────────────────
  cy += rowH;
  const divL = x + pad;
  const divR = x + tbW - pad;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = mmToPx(0.3, dpi);
  ctx.beginPath();
  ctx.moveTo(divL, cy);
  ctx.lineTo(divR, cy);
  ctx.stroke();
  cy += rowH;

  // ── Info rows ───────────────────────────────────────────────────────────
  const labelX = x + pad;
  const valueX = x + tbW - pad;

  const rows: Array<[string, string]> = [
    ['LR No:',     opts.lrNumber ?? ''],
    ['Project:',   opts.projectName ?? ''],
    ['Surveyor:',  opts.surveyorName ?? ''],
    ['ISK No:',    opts.surveyorLicense ?? ''],
    ['Client:',    opts.clientName ?? ''],
    ['County:',    opts.county ?? ''],
    ['Scale:',     `1:${opts.scale}`],
    ['Date:',      getFormattedDate()],
  ];

  for (const [label, value] of rows) {
    ctx.font = labelFont;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, labelX, cy);

    ctx.font = valueFont;
    ctx.textAlign = 'right';
    ctx.fillText(value, valueX, cy);

    cy += rowH;
  }

  // ── Second divider ──────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(divL, cy);
  ctx.lineTo(divR, cy);
  ctx.stroke();
  cy += rowH;

  // ── Drawing / sheet info ────────────────────────────────────────────────
  const dwgNo = opts.projectName
    ? `${opts.projectName.replace(/\s+/g, '-')}-001`
    : 'DWG-001';

  const footerRows: Array<[string, string]> = [
    ['Drawing No:', dwgNo],
    ['Sheet:',      '1 of 1'],
  ];

  for (const [label, value] of footerRows) {
    ctx.font = labelFont;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, labelX, cy);

    ctx.font = valueFont;
    ctx.textAlign = 'right';
    ctx.fillText(value, valueX, cy);

    cy += rowH;
  }
}

// ---------------------------------------------------------------------------
// Overlay: North Arrow
// ---------------------------------------------------------------------------

/**
 * Draw a north arrow centred at `(cx, cy)`.
 *
 * The arrow points to true north in the map's projection.  Pass the negative
 * of `view.getRotation()` so that the arrow compensates for any map rotation.
 *
 * @param size     - Total height of the arrow in pixels.
 * @param rotation - Rotation to apply (radians, canvas convention: +cw).
 */
function drawNorthArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  rotation: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  const half = size / 2;
  const arrowW = size * 0.25;

  // ── Filled arrow body ───────────────────────────────────────────────────
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(0, -half);                    // tip (north)
  ctx.lineTo(arrowW, half * 0.3);          // bottom-right
  ctx.lineTo(0, half * 0.05);              // centre notch
  ctx.lineTo(-arrowW, half * 0.3);         // bottom-left
  ctx.closePath();
  ctx.fill();

  // ── Half-circle at base ─────────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(0, half * 0.18, size * 0.045, 0, Math.PI * 2);
  ctx.fill();

  // ── "N" label above tip ─────────────────────────────────────────────────
  const fontSize = Math.round(size * 0.28);
  ctx.font = `bold ${fontSize}px "Arial", "Helvetica", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('N', 0, -half - size * 0.06);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Overlay: Scale Bar
// ---------------------------------------------------------------------------

/**
 * Draw a calibrated, alternating-fill scale bar.
 *
 * A "nice" ground distance is chosen so that the bar fits within `maxWidth`.
 * The bar is divided into four sections, each half-filled.
 *
 * @param cx       - Centre X of the bar.
 * @param y        - Top Y of the bar.
 * @param scale    - Scale denominator.
 * @param dpi      - Output DPI.
 * @param maxWidth - Maximum allowed width in pixels.
 */
function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  scale: number,
  dpi: number,
  maxWidth: number,
): void {
  const mPerPx = calculateResolution(scale, dpi);

  // Pick a nice total ground distance that fits
  const maxM = maxWidth * mPerPx;
  const interval = niceGridInterval(maxM, 4);

  const divisions = 4;
  const divM = interval / divisions;
  const divPx = divM / mPerPx;
  const totalPx = interval / mPerPx;

  const barX = cx - totalPx / 2;
  const barH = Math.max(mmToPx(2.5, dpi), 8);
  const fontSize = Math.max(ptToPx(8, dpi), 10);
  const gap = mmToPx(1, dpi);

  ctx.lineWidth = 1;

  // ── Alternating filled / empty divisions ─────────────────────────────────
  for (let i = 0; i < divisions; i++) {
    const dx = barX + i * divPx;
    ctx.fillStyle = i % 2 === 0 ? '#000000' : '#FFFFFF';
    ctx.fillRect(dx, y, divPx, barH);
    ctx.strokeStyle = '#000000';
    ctx.strokeRect(dx, y, divPx, barH);
  }

  // ── Overall border ──────────────────────────────────────────────────────
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(barX, y, totalPx, barH);

  // ── Tick labels below ───────────────────────────────────────────────────
  ctx.fillStyle = '#000000';
  ctx.font = `${fontSize}px "Arial", "Helvetica", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (let i = 0; i <= divisions; i++) {
    const tx = barX + i * divPx;
    const m = i * divM;
    const label = m >= 1000
      ? `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)} km`
      : `${m.toFixed(0)} m`;
    ctx.fillText(label, tx, y + barH + gap);
  }
}

// ---------------------------------------------------------------------------
// Overlay: Grid Ticks
// ---------------------------------------------------------------------------

/**
 * Draw E (easting) and N (northing) tick labels along the four edges of the
 * drawing area.
 *
 * Grid intervals are "nice" round numbers chosen from the map extent.
 *
 * @param extent   - `[minX, minY, maxX, maxY]` in map projection units (m).
 * @param cw       - Total canvas width in px.
 * @param ch       - Total canvas height in px.
 * @param insetPx  - Inset from canvas edge (outer border + margin) in px.
 * @param dpi      - Output DPI.
 */
function drawGridTicks(
  ctx: CanvasRenderingContext2D,
  extent: [number, number, number, number],
  cw: number,
  ch: number,
  insetPx: number,
  dpi: number,
): void {
  const [minX, minY, maxX, maxY] = extent;
  const extW = maxX - minX;
  const extH = maxY - minY;
  if (extW <= 0 || extH <= 0) return;

  const interval = niceGridInterval(Math.max(extW, extH), 8);

  // Drawing-area boundaries
  const left = insetPx;
  const top  = insetPx;
  const right  = cw - insetPx;
  const bottom = ch - insetPx;
  const mapW = right - left;
  const mapH = bottom - top;

  const tickLen = mmToPx(5, dpi);
  const fontSize = Math.max(ptToPx(7, dpi), 9);

  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.8;
  ctx.font = `${fontSize}px "Arial", "Helvetica", sans-serif`;

  // ── Vertical ticks (constant easting) ───────────────────────────────────
  const startX = Math.ceil(minX / interval) * interval;
  for (let e = startX; e <= maxX; e += interval) {
    const px = left + ((e - minX) / extW) * mapW;
    if (px < left - 1 || px > right + 1) continue;

    const label = formatCoord(e);

    // Bottom tick + label
    ctx.beginPath();
    ctx.moveTo(px, bottom);
    ctx.lineTo(px, bottom + tickLen);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, px, bottom + tickLen + 1);

    // Top tick + label
    ctx.beginPath();
    ctx.moveTo(px, top);
    ctx.lineTo(px, top - tickLen);
    ctx.stroke();
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, px, top - tickLen - 1);
  }

  // ── Horizontal ticks (constant northing) ────────────────────────────────
  const startY = Math.ceil(minY / interval) * interval;
  for (let n = startY; n <= maxY; n += interval) {
    const py = bottom - ((n - minY) / extH) * mapH;
    if (py < top - 1 || py > bottom + 1) continue;

    const label = formatCoord(n);

    // Left tick + label
    ctx.beginPath();
    ctx.moveTo(left, py);
    ctx.lineTo(left - tickLen, py);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, left - tickLen - 2, py);

    // Right tick + label
    ctx.beginPath();
    ctx.moveTo(right, py);
    ctx.lineTo(right + tickLen, py);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillText(label, right + tickLen + 2, py);
  }
}

// ---------------------------------------------------------------------------
// Core: exportDeedPlan
// ---------------------------------------------------------------------------

/**
 * Export the current map view as a print-quality deed-plan PNG blob.
 *
 * The function temporarily resizes the map to the target paper dimensions at
 * the requested DPI, adjusts the view resolution to match the exact scale, and
 * composites SoK-compliant overlays (title block, north arrow, scale bar, grid
 * ticks) directly onto the output canvas.
 *
 * **The original map state (centre, resolution, rotation, size, pixel ratio)
 * is always restored**, even if the export fails or times out.
 *
 * @param options - Full export configuration.
 * @returns A `Blob` containing the PNG image data.
 *
 * @example
 * ```ts
 * const blob = await exportDeedPlan({
 *   map,
 *   scale: 1000,
 *   paperSize: 'a3',
 *   orientation: 'landscape',
 *   dpi: 300,
 *   lrNumber: '209/3344',
 *   projectName: 'Moi Avenue Phase 2',
 *   surveyorName: 'J. Mwangi',
 *   surveyorLicense: '2847',
 *   clientName: 'Nairobi County',
 *   county: 'Nairobi',
 * });
 * ```
 */
export async function exportDeedPlan(options: DeedPlanExportOptions): Promise<Blob> {
  const {
    map,
    scale,
    paperSize,
    orientation,
    dpi = 300,
    includeNorthArrow = true,
    includeScaleBar  = true,
    includeGridTicks = true,
    includeTitleBlock = true,
  } = options;

  // ── Validate ────────────────────────────────────────────────────────────
  if (!PAPER_SIZES_MM[paperSize]) {
    throw new Error(
      `Unsupported paper size: "${paperSize}". ` +
      `Supported: ${Object.keys(PAPER_SIZES_MM).join(', ')}`,
    );
  }
  if (scale <= 0) {
    throw new Error(`Invalid scale: ${scale}. Must be a positive number.`);
  }

  // ── Compute pixel dimensions & resolution ───────────────────────────────
  const [paperWmm, paperHmm] = getPaperDimensions(paperSize, orientation);
  const targetW = Math.round(mmToPx(paperWmm, dpi));
  const targetH = Math.round(mmToPx(paperHmm, dpi));
  const targetRes = calculateResolution(scale, dpi);

  // ── Save original map state ─────────────────────────────────────────────
  const origSize = map.getSize();
  const origCenter = map.getView().getCenter();
  const origRes = map.getView().getResolution();
  const origRot = map.getView().getRotation();

  // Temporarily override getPixelRatio so OL renders at 1:1 (native pixels).
  // This ensures internal canvases are sized exactly to our target dimensions
  // without an additional device-pixel-ratio multiplier.
  const mapAny = map as unknown as { getPixelRatio: () => number };
  const origGetPixelRatio: () => number = mapAny.getPixelRatio;
  mapAny.getPixelRatio = () => 1;

  // ── Build the Promise that resolves after rendering ─────────────────────
  return new Promise<Blob>((resolve, reject) => {
    let settled = false;

    const timeoutId = setTimeout(() => {
      if (!settled) { settled = true; restore(); reject(new Error('Deed plan export timed out.')); }
    }, RENDER_TIMEOUT_MS);

    /**
     * Restore the map to its pre-export state.
     * Safe to call multiple times (idempotent).
     */
    function restore(): void {
      clearTimeout(timeoutId);
      mapAny.getPixelRatio = origGetPixelRatio;
      if (origSize) map.setSize(origSize);
      const view = map.getView();
      if (origCenter) view.setCenter(origCenter);
      if (origRes != null) view.setResolution(origRes);
      view.setRotation(origRot);
    }

    // ── Listen for render completion ───────────────────────────────────────
    map.once('rendercomplete', () => {
      if (settled) return; // timeout already fired
      settled = true;

      try {
        // Create the output canvas
        const canvas = document.createElement('canvas');
        canvas.width  = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) { restore(); reject(new Error('Failed to acquire 2-D context.')); return; }

        // White background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);

        // ── Composite layer canvases ───────────────────────────────────────
        const viewport = map.getViewport();
        const layerCanvases = viewport.querySelectorAll(
          '.ol-layer canvas, canvas.ol-layer',
        );

        for (let i = 0; i < layerCanvases.length; i++) {
          const lc = layerCanvases[i] as HTMLCanvasElement;
          if (!lc || lc.width === 0 || lc.height === 0) continue;

          // Layer / parent opacity
          const opStr = lc.style.opacity
            || (lc.parentElement && lc.parentElement.style.opacity)
            || '1';
          const op = parseFloat(opStr);
          if (isNaN(op)) continue;

          ctx.globalAlpha = op;
          ctx.setTransform(1, 0, 0, 1, 0, 0); // identity — draw at native px

          // Draw at native pixel resolution; scale preserving aspect ratio when dims differ
          if (lc.width === targetW && lc.height === targetH) {
            ctx.drawImage(lc, 0, 0);
          } else {
            // Preserve aspect ratio to prevent distortion
            const scaleX = targetW / lc.width;
            const scaleY = targetH / lc.height;
            const drawScale = Math.min(scaleX, scaleY);
            const dw = lc.width * drawScale;
            const dh = lc.height * drawScale;
            const dx = (targetW - dw) / 2;
            const dy = (targetH - dh) / 2;
            ctx.drawImage(lc, dx, dy, dw, dh);
          }
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;

        // ── Draw overlays ──────────────────────────────────────────────────
        const outerPx = mmToPx(OUTER_BORDER_MM, dpi);
        const marginPx = mmToPx(MARGIN_MM, dpi);
        const inset = outerPx + marginPx;

        // 1. Border frame
        drawBorder(ctx, targetW, targetH, dpi);

        // 2. Grid ticks (drawn first so title block can overlap them)
        if (includeGridTicks) {
          const extent = map.getView().calculateExtent(
            [targetW, targetH],
          ) as [number, number, number, number];
          drawGridTicks(ctx, extent, targetW, targetH, inset, dpi);
        }

        // 3. Title block — bottom-right
        if (includeTitleBlock) {
          drawTitleBlock(ctx, options, targetW, targetH, dpi);
        }

        // 4. North arrow — upper-right area (above the title block)
        if (includeNorthArrow) {
          const tbW = includeTitleBlock ? Math.round(targetW * 0.28) : 0;
          const arrowSize = Math.min(targetW * 0.055, targetH * 0.08);
          // Centre the arrow horizontally within the title-block column
          const arrowCx = targetW - outerPx - tbW / 2;
          const arrowCy = inset + arrowSize * 0.7;

          drawNorthArrow(ctx, arrowCx, arrowCy, arrowSize, -(origRot ?? 0));
        }

        // 5. Scale bar — bottom-centre (left of title block)
        if (includeScaleBar) {
          const tbW = includeTitleBlock ? Math.round(targetW * 0.28) : 0;
          const barMaxW = targetW - tbW - 2 * inset;
          const barCx = inset + barMaxW / 2;
          const barY = targetH - inset - mmToPx(14, dpi);

          drawScaleBar(ctx, barCx, barY, scale, dpi, barMaxW);
        }

        // ── Convert to PNG Blob ────────────────────────────────────────────
        canvas.toBlob(
          (blob: Blob | null) => {
            restore();
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob returned null.'));
          },
          'image/png',
        );
      } catch (err) {
        restore();
        reject(err);
      }
    });

    // ── Apply export parameters & trigger render ──────────────────────────
    map.setSize([targetW, targetH]);
    map.getView().setResolution(targetRes);
  });
}

// ---------------------------------------------------------------------------
// Core: downloadDeedPlan
// ---------------------------------------------------------------------------

/**
 * Export a deed plan and immediately trigger a browser download of the PNG.
 *
 * This is a convenience wrapper around {@link exportDeedPlan} that creates a
 * temporary `<a>` element with a `blob:` URL and programmatically clicks it.
 *
 * @param options  - Export configuration (see {@link DeedPlanExportOptions}).
 * @param filename - Download filename (default `'deed-plan.png'`).
 *
 * @example
 * ```ts
 * await downloadDeedPlan(
 *   {
 *     map,
 *     scale: 1000,
 *     paperSize: 'a3',
 *     orientation: 'landscape',
 *     lrNumber: '209/3344',
 *   },
 *   'LR209-3344-deed-plan.png',
 * );
 * ```
 */
export async function downloadDeedPlan(
  options: DeedPlanExportOptions,
  filename: string = 'deed-plan.png',
): Promise<void> {
  const blob = await exportDeedPlan(options);

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  // Cleanup after a short delay to ensure the download starts
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 200);
}
