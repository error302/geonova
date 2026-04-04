/**
 * METARDU — Topographic Plan Renderer
 * Master renderer for Brief 12 topographic plan improvements.
 *
 * Composes:
 *   - Contour lines (from Python engine output)
 *   - Spot height labels
 *   - Survey of Kenya standard feature symbols
 *   - Four line weight levels
 *   - Dimension leader lines for internal measurements
 *   - Grid / graticule
 *   - North arrow
 *   - Title block (Survey Act Cap 299 compliant)
 *   - Digital signature verification block (Phase 2)
 *
 * Source: Ghilani & Wolf, Elementary Surveying 16th Ed., Ch.17
 *         Survey of Kenya Standard Symbols
 *         Survey Act Cap 299 (Revised 2022)
 *         Survey Regulations 1994
 */

import type { ContourResult, SpotHeight }    from './contourRenderer';
import { renderContoursToSvg, renderSpotHeightsToSvg, type ViewTransform } from './contourRenderer';
import { buildSymbolDefs, renderSymbol, type SurveySymbol }                from './surveySymbols';
import { buildLineWeightLegend, LINE_STYLES, svgStrokeAttrs, lineWeightPx } from './lineWeights';
import { buildArrowDefs, renderLinearDimension, renderLeaderLine }          from './dimensionLeaders';
import type { SignatureRecord }               from '@/lib/integrations/digitalSignature';
import { buildVerificationBlock }             from '@/lib/integrations/digitalSignature';

const MM_TO_PX = 3.7795275591;
function mm(val: number, sf = 1): number { return val * MM_TO_PX * sf; }

// ─────────────────────────────────────────────────────────────────────────────
// PLAN OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface TopographicPlanOptions {
  // Plan metadata
  title:            string;
  drawnBy:          string;
  checkedBy?:       string;
  scale:            string;          // e.g. '1:1000'
  date:             string;
  drawingNo?:       string;
  client?:          string;
  project?:         string;
  datum:            string;          // e.g. 'ARC1960 / UTM Zone 37S (EPSG:21037)'
  county?:          string;

  // SVG canvas
  svgWidth?:        number;          // px
  svgHeight?:       number;          // px
  margin?:          number;          // px
  scaleFactor?:     number;

  // Data layers (all optional)
  contours?:        ContourResult;
  spotHeights?:     SpotHeight[];
  featurePoints?:   FeaturePoint[];
  dimensions?:      DimensionSpec[];
  leaders?:         LeaderSpec[];
  boundaries?:      BoundaryChain[];

  // Signature (Phase 2)
  signature?:       SignatureRecord;

  // Display options
  showGrid?:        boolean;
  showNorthArrow?:  boolean;
  showLegend?:      boolean;
  showScaleBar?:    boolean;
  contourInterval?: number;
}

export interface FeaturePoint {
  x: number; y: number;
  symbolId: string;
  label?: string;
  rotation?: number;
}

export interface DimensionSpec {
  x1: number; y1: number;
  x2: number; y2: number;
  label?: string;
  offset?: number;
}

export interface LeaderSpec {
  featureX: number; featureY: number;
  labelX: number;   labelY: number;
  label: string;
  subLabel?: string;
}

export interface BoundaryChain {
  points: [number, number][];  // world coords (E, N)
  closed?: boolean;
  styleKey?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// NORTH ARROW
// ─────────────────────────────────────────────────────────────────────────────

function renderNorthArrow(x: number, y: number, sf = 1): string {
  const h  = mm(12, sf);
  const hw = mm(3,  sf);
  const fontSize = mm(3, sf).toFixed(2);

  return `
<g id="north-arrow" transform="translate(${x},${y})">
  <!-- Arrow shaft -->
  <line x1="0" y1="${h/2}" x2="0" y2="${-h/2}" stroke="#000" stroke-width="${lineWeightPx(4, sf).toFixed(3)}"/>
  <!-- North half (filled) -->
  <polygon points="0,${-h/2} ${-hw},0 ${hw},0" fill="#000"/>
  <!-- South half (outline) -->
  <polygon points="0,${h/2} ${-hw},0 ${hw},0" fill="white" stroke="#000" stroke-width="${lineWeightPx(4, sf).toFixed(3)}"/>
  <!-- N label -->
  <text x="0" y="${(-h/2 - mm(2, sf))}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="#000">N</text>
</g>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCALE BAR
// ─────────────────────────────────────────────────────────────────────────────

function renderScaleBar(x: number, y: number, scaleString: string, sf = 1): string {
  const barW  = mm(40, sf);
  const barH  = mm(2.5, sf);
  const ticks = 4;
  const tickW = barW / ticks;
  const fontSize = mm(2.2, sf).toFixed(2);
  const sw = lineWeightPx(4, sf).toFixed(3);

  const parts: string[] = [`<g id="scale-bar" transform="translate(${x},${y})">`];

  for (let i = 0; i < ticks; i++) {
    const fill = i % 2 === 0 ? '#000' : '#fff';
    parts.push(
      `<rect x="${(i * tickW).toFixed(2)}" y="0" width="${tickW.toFixed(2)}" height="${barH.toFixed(2)}" fill="${fill}" stroke="#000" stroke-width="${sw}"/>`
    );
  }

  // Scale label
  parts.push(
    `<text x="${(barW / 2).toFixed(2)}" y="${(barH + mm(4, sf)).toFixed(2)}" text-anchor="middle" ` +
    `font-family="Arial,sans-serif" font-size="${fontSize}" fill="#000">Scale ${scaleString}</text>`
  );

  parts.push('</g>');
  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// TITLE BLOCK
// Survey Act Cap 299 compliant
// ─────────────────────────────────────────────────────────────────────────────

function renderTitleBlock(opts: TopographicPlanOptions, svgW: number, svgH: number, sf = 1): string {
  const margin    = opts.margin ?? mm(10, sf);
  const tbH       = mm(40, sf);
  const tbW       = svgW - 2 * margin;
  const tbY       = svgH - margin - tbH;
  const tbX       = margin;
  const bw        = lineWeightPx(1, sf).toFixed(3);
  const lw        = lineWeightPx(4, sf).toFixed(3);
  const titleSize = mm(5, sf).toFixed(2);
  const bodySize  = mm(2.8, sf).toFixed(2);
  const labelSize = mm(2.0, sf).toFixed(2);

  const col2X = tbX + mm(80, sf);
  const col3X = tbX + mm(140, sf);

  return `
<g id="title-block">
  <!-- Outer border -->
  <rect x="${tbX.toFixed(2)}" y="${tbY.toFixed(2)}" width="${tbW.toFixed(2)}" height="${tbH.toFixed(2)}" fill="white" stroke="#000" stroke-width="${bw}"/>
  
  <!-- Vertical dividers -->
  <line x1="${col2X.toFixed(2)}" y1="${tbY.toFixed(2)}" x2="${col2X.toFixed(2)}" y2="${(tbY + tbH).toFixed(2)}" stroke="#000" stroke-width="${lw}"/>
  <line x1="${col3X.toFixed(2)}" y1="${tbY.toFixed(2)}" x2="${col3X.toFixed(2)}" y2="${(tbY + tbH).toFixed(2)}" stroke="#000" stroke-width="${lw}"/>

  <!-- Column 1: Title, Client, Project -->
  <text x="${(tbX + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(10, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${titleSize}" font-weight="bold" fill="#000">${opts.title}</text>
  <text x="${(tbX + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(17, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${labelSize}" fill="#666">CLIENT</text>
  <text x="${(tbX + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(21, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${bodySize}" fill="#000">${opts.client ?? '—'}</text>
  <text x="${(tbX + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(27, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${labelSize}" fill="#666">PROJECT</text>
  <text x="${(tbX + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(31, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${bodySize}" fill="#000">${opts.project ?? '—'}</text>
  <text x="${(tbX + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(38, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${labelSize}" fill="#666">${opts.datum}</text>

  <!-- Column 2: Drawing details -->
  <text x="${(col2X + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(8, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${labelSize}" fill="#666">DRAWN BY</text>
  <text x="${(col2X + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(12, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${bodySize}" fill="#000">${opts.drawnBy}</text>
  <text x="${(col2X + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(18, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${labelSize}" fill="#666">CHECKED BY</text>
  <text x="${(col2X + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(22, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${bodySize}" fill="#000">${opts.checkedBy ?? '—'}</text>
  <text x="${(col2X + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(28, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${labelSize}" fill="#666">DATE</text>
  <text x="${(col2X + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(32, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${bodySize}" fill="#000">${opts.date}</text>
  <text x="${(col2X + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(38, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${labelSize}" fill="#666">COUNTY: ${opts.county ?? '—'}</text>

  <!-- Column 3: Scale, Drawing No -->
  <text x="${(col3X + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(8, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${labelSize}" fill="#666">SCALE</text>
  <text x="${(col3X + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(13, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${(mm(4.5, sf)).toFixed(2)}" font-weight="bold" fill="#000">${opts.scale}</text>
  <text x="${(col3X + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(20, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${labelSize}" fill="#666">DRAWING NO.</text>
  <text x="${(col3X + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(25, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${bodySize}" fill="#000">${opts.drawingNo ?? '—'}</text>
  <text x="${(col3X + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(32, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${labelSize}" fill="#555">Prepared by METARDU</text>
  <text x="${(col3X + mm(4, sf)).toFixed(2)}" y="${(tbY + mm(37, sf)).toFixed(2)}" font-family="Arial,sans-serif" font-size="${labelSize}" fill="#777">Survey Act Cap 299 | Regs 1994</text>

</g>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GRID
// ─────────────────────────────────────────────────────────────────────────────

function renderGrid(t: ViewTransform, sf = 1): string {
  const strokeAttr = svgStrokeAttrs('grid_line', sf);
  const lines: string[] = ['<g id="grid" opacity="0.4">'];

  const usableW = t.svg_width  - 2 * t.margin;
  const usableH = t.svg_height - 2 * t.margin;
  const gridPx  = mm(20, sf); // grid spacing in px

  for (let x = t.margin; x <= t.margin + usableW; x += gridPx) {
    lines.push(`<line x1="${x.toFixed(1)}" y1="${t.margin}" x2="${x.toFixed(1)}" y2="${(t.margin + usableH).toFixed(1)}" ${strokeAttr}/>`);
  }
  for (let y = t.margin; y <= t.margin + usableH; y += gridPx) {
    lines.push(`<line x1="${t.margin}" y1="${y.toFixed(1)}" x2="${(t.margin + usableW).toFixed(1)}" y2="${y.toFixed(1)}" ${strokeAttr}/>`);
  }

  lines.push('</g>');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER RENDER FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

export function renderTopographicPlan(opts: TopographicPlanOptions): string {
  const sf         = opts.scaleFactor ?? 1;
  const svgW       = opts.svgWidth    ?? mm(297, sf);   // A4 landscape width
  const svgH       = opts.svgHeight   ?? mm(210, sf);   // A4 landscape height
  const margin     = opts.margin      ?? mm(12, sf);

  const titleBlockH = mm(42, sf);
  const drawAreaH   = svgH - margin - titleBlockH - margin;

  // Build view transform
  const contourExtent = opts.contours?.extent
  const t: ViewTransform = {
    x_min:      contourExtent?.x_min ?? 0,
    x_max:      contourExtent?.x_max ?? 1000,
    y_min:      contourExtent?.y_min ?? 0,
    y_max:      contourExtent?.y_max ?? 1000,
    svg_width:  svgW,
    svg_height: svgH - titleBlockH,
    margin,
  };

  // Expand extent from spot heights if no contours
  if (!opts.contours && opts.spotHeights?.length) {
    t.x_min = Math.min(...opts.spotHeights.map((p: any) => p.x));
    t.x_max = Math.max(...opts.spotHeights.map((p: any) => p.x));
    t.y_min = Math.min(...opts.spotHeights.map((p: any) => p.y));
    t.y_max = Math.max(...opts.spotHeights.map((p: any) => p.y));
  }

  const parts: string[] = [];

  // SVG header
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`
  );

  // Defs
  parts.push('<defs>');
  parts.push(buildSymbolDefs());
  parts.push(buildArrowDefs(sf));
  parts.push('</defs>');

  // Background
  parts.push(`<rect width="${svgW}" height="${svgH}" fill="white"/>`);

  // Plan border
  const bw = lineWeightPx(1, sf).toFixed(3);
  parts.push(`<rect x="${margin}" y="${margin}" width="${(svgW - 2*margin).toFixed(2)}" height="${(svgH - 2*margin).toFixed(2)}" fill="none" stroke="#000" stroke-width="${bw}"/>`);

  // Drawing area clip
  const clipId = 'drawing-area-clip';
  parts.push(`<clipPath id="${clipId}"><rect x="${margin}" y="${margin}" width="${(svgW-2*margin).toFixed(2)}" height="${drawAreaH.toFixed(2)}"/></clipPath>`);
  parts.push(`<g clip-path="url(#${clipId})">`);

  // Grid
  if (opts.showGrid !== false) {
    parts.push(renderGrid(t, sf));
  }

  // Contour lines
  if (opts.contours) {
    parts.push(renderContoursToSvg(opts.contours, {
      transform: t,
      scaleFactor: sf,
      labelIndexContours: true,
    }));
  }

  // Spot heights
  if (opts.spotHeights?.length) {
    parts.push(renderSpotHeightsToSvg(opts.spotHeights, t, sf));
  }

  // Feature symbols
  if (opts.featurePoints?.length) {
    const symbolGroup: string[] = ['<g id="features">'];
    for (const fp of opts.featurePoints) {
      const [sx, sy] = [fp.x, fp.y]; // caller provides SVG coords for features
      symbolGroup.push(renderSymbol(fp.symbolId, sx, sy, {
        scaleFactor: sf,
        rotation: fp.rotation,
        label: fp.label,
      }));
    }
    symbolGroup.push('</g>');
    parts.push(symbolGroup.join('\n'));
  }

  // Boundaries
  if (opts.boundaries?.length) {
    const boundaryGroup: string[] = ['<g id="boundaries">'];
    for (const b of opts.boundaries) {
      if (b.points.length < 2) continue;
      const styleKey = (b.styleKey as keyof typeof LINE_STYLES) ?? 'survey_boundary';
      const strokeAttr = svgStrokeAttrs(styleKey, sf);
      const pts = b.points.map(([wx, wy]) => {
        const [sx, sy] = [wx, wy]; // world to SVG conversion handled upstream
        return `${sx.toFixed(2)},${sy.toFixed(2)}`;
      }).join(' ');
      const tag = b.closed ? 'polygon' : 'polyline';
      boundaryGroup.push(`<${tag} points="${pts}" fill="none" ${strokeAttr}/>`);
    }
    boundaryGroup.push('</g>');
    parts.push(boundaryGroup.join('\n'));
  }

  // Dimensions
  if (opts.dimensions?.length) {
    const dimGroup: string[] = ['<g id="dimensions">'];
    for (const d of opts.dimensions) {
      dimGroup.push(renderLinearDimension({ ...d, scaleFactor: sf }));
    }
    dimGroup.push('</g>');
    parts.push(dimGroup.join('\n'));
  }

  // Leader lines
  if (opts.leaders?.length) {
    const leaderGroup: string[] = ['<g id="leaders">'];
    for (const l of opts.leaders) {
      leaderGroup.push(renderLeaderLine({ ...l, scaleFactor: sf }));
    }
    leaderGroup.push('</g>');
    parts.push(leaderGroup.join('\n'));
  }

  parts.push('</g>'); // end clip

  // North arrow
  if (opts.showNorthArrow !== false) {
    parts.push(renderNorthArrow(svgW - margin - mm(15, sf), margin + mm(18, sf), sf));
  }

  // Scale bar
  if (opts.showScaleBar !== false) {
    parts.push(renderScaleBar(margin + mm(5, sf), svgH - margin - titleBlockH - mm(12, sf), opts.scale, sf));
  }

  // Line weight legend
  if (opts.showLegend !== false) {
    parts.push(buildLineWeightLegend(svgW - margin - mm(55, sf), margin + mm(5, sf), sf));
  }

  // Title block
  parts.push(renderTitleBlock(opts, svgW, svgH, sf));

  // Digital signature verification block (Phase 2) — below title block
  if (opts.signature) {
    const sigY = svgH - margin - mm(5, sf);
    const sigX = margin;
    parts.push(`<g transform="translate(${sigX},${sigY})">`);
    parts.push(buildVerificationBlock(opts.signature));
    parts.push('</g>');
  }

  parts.push('</svg>');
  return parts.join('\n');
}
