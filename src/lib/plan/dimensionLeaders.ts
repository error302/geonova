/**
 * METARDU — Dimension Leader Lines
 * Dimension and leader lines for internal measurements on survey plans.
 *
 * Source: Survey of Kenya Topographic Plan Standards
 *         Survey Act Cap 299 (Revised 2022)
 *         Ghilani & Wolf, Elementary Surveying 16th Ed. — Plan Preparation
 *
 * Components:
 *   - Linear dimension line (with extension lines + arrowheads)
 *   - Angular dimension arc
 *   - Leader line with annotation
 *   - Slope annotation
 */

import { svgStrokeAttrs, lineWeightPx } from './lineWeights';

const MM_TO_PX = 3.7795275591;

function mm(val: number, sf = 1): number {
  return val * MM_TO_PX * sf;
}

// ─────────────────────────────────────────────────────────────────────────────
// ARROWHEAD MARKER DEFS
// Call buildArrowDefs() once and inject into <defs> of the plan SVG
// ─────────────────────────────────────────────────────────────────────────────

export function buildArrowDefs(scaleFactor = 1): string {
  const w = lineWeightPx(4, scaleFactor).toFixed(3);
  return `
  <marker id="arrow-start" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto" markerUnits="strokeWidth">
    <path d="M6,0 L0,2 L6,4 Z" fill="#000"/>
  </marker>
  <marker id="arrow-end" markerWidth="6" markerHeight="4" refX="0" refY="2" orient="auto" markerUnits="strokeWidth">
    <path d="M0,0 L6,2 L0,4 Z" fill="#000"/>
  </marker>
  <marker id="tick-start" markerWidth="4" markerHeight="6" refX="2" refY="3" orient="auto" markerUnits="strokeWidth">
    <line x1="3" y1="0" x2="1" y2="6" stroke="#000" stroke-width="${w}"/>
  </marker>
  <marker id="tick-end" markerWidth="4" markerHeight="6" refX="2" refY="3" orient="auto" markerUnits="strokeWidth">
    <line x1="3" y1="0" x2="1" y2="6" stroke="#000" stroke-width="${w}"/>
  </marker>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LINEAR DIMENSION
// Renders a dimension line between two points with:
//   - Extension lines from feature to dimension line
//   - Arrowheads or tick marks at ends
//   - Measurement label centred above dimension line
// ─────────────────────────────────────────────────────────────────────────────

export interface LinearDimensionOptions {
  x1: number;               // SVG coords — start point
  y1: number;
  x2: number;               // SVG coords — end point
  y2: number;
  offset?: number;          // px — how far the dimension line sits from the feature
  label?: string;           // override auto-computed distance
  unit?: string;            // 'm' (default)
  scaleFactor?: number;
  arrowStyle?: 'arrow' | 'tick' | 'dot';
  precision?: number;       // decimal places for auto label
}

export function renderLinearDimension(opts: LinearDimensionOptions): string {
  const {
    x1, y1, x2, y2,
    offset = mm(5, opts.scaleFactor ?? 1),
    scaleFactor = 1,
    arrowStyle = 'arrow',
    precision = 3,
    unit = 'm',
  } = opts;

  // Vector perpendicular to the dimension direction (for offset)
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);

  if (len < 0.1) return '<!-- Dimension: zero-length line skipped -->';

  // Unit perpendicular (rotated 90° CCW — above the line in SVG coords)
  const px = -dy / len;
  const py =  dx / len;

  // Dimension line endpoints (offset from feature)
  const d1x = x1 + px * offset;
  const d1y = y1 + py * offset;
  const d2x = x2 + px * offset;
  const d2y = y2 + py * offset;

  // Extension line gap (small gap between feature point and extension line start)
  const gap = mm(1, scaleFactor);
  const ext = mm(2, scaleFactor);  // extension line overshoot beyond dimension line

  const e1sx = x1 + px * gap;
  const e1sy = y1 + py * gap;
  const e1ex = d1x + px * ext;
  const e1ey = d1y + py * ext;

  const e2sx = x2 + px * gap;
  const e2sy = y2 + py * gap;
  const e2ex = d2x + px * ext;
  const e2ey = d2y + py * ext;

  // Label
  const distWorld = len; // px distance — caller is responsible for units
  const labelText = opts.label ?? `${distWorld.toFixed(precision)}${unit}`;
  const midX = (d1x + d2x) / 2;
  const midY = (d1y + d2y) / 2;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const textAngle = (angle > 90 || angle < -90) ? angle + 180 : angle;
  const labelOffset = mm(2.5, scaleFactor);
  const lx = midX + px * labelOffset;
  const ly = midY + py * labelOffset;
  const fontSize = mm(2.0, scaleFactor).toFixed(2);

  const strokeAttr = svgStrokeAttrs('dimension_line', scaleFactor);
  const extAttr    = svgStrokeAttrs('extension_line', scaleFactor);

  // Arrowhead markers
  const startMarker = arrowStyle === 'arrow' ? 'marker-start="url(#arrow-start)"' : '';
  const endMarker   = arrowStyle === 'arrow' ? 'marker-end="url(#arrow-end)"'     : '';

  return `
<g class="dimension-linear">
  <!-- Extension lines -->
  <line x1="${e1sx.toFixed(2)}" y1="${e1sy.toFixed(2)}" x2="${e1ex.toFixed(2)}" y2="${e1ey.toFixed(2)}" ${extAttr}/>
  <line x1="${e2sx.toFixed(2)}" y1="${e2sy.toFixed(2)}" x2="${e2ex.toFixed(2)}" y2="${e2ey.toFixed(2)}" ${extAttr}/>
  <!-- Dimension line -->
  <line x1="${d1x.toFixed(2)}" y1="${d1y.toFixed(2)}" x2="${d2x.toFixed(2)}" y2="${d2y.toFixed(2)}" ${strokeAttr} ${startMarker} ${endMarker}/>
  <!-- Label -->
  <text
    x="${lx.toFixed(2)}" y="${ly.toFixed(2)}"
    transform="rotate(${textAngle.toFixed(1)},${lx.toFixed(2)},${ly.toFixed(2)})"
    text-anchor="middle" dominant-baseline="auto"
    font-family="Arial Narrow,Arial,sans-serif" font-size="${fontSize}"
    fill="#000"
  >${labelText}</text>
</g>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEADER LINE WITH ANNOTATION
// Angled leader line from a feature to a label callout
// ─────────────────────────────────────────────────────────────────────────────

export interface LeaderLineOptions {
  featureX: number;         // SVG coords — point on the feature being annotated
  featureY: number;
  labelX: number;           // SVG coords — label anchor
  labelY: number;
  label: string;
  subLabel?: string;        // second line of text
  scaleFactor?: number;
  dotAtFeature?: boolean;   // place a small dot at the feature point
}

export function renderLeaderLine(opts: LeaderLineOptions): string {
  const {
    featureX, featureY,
    labelX, labelY,
    label,
    subLabel,
    scaleFactor = 1,
    dotAtFeature = true,
  } = opts;

  const strokeAttr = svgStrokeAttrs('leader_line', scaleFactor);
  const fontSize   = mm(2.0, scaleFactor).toFixed(2);
  const subSize    = mm(1.6, scaleFactor).toFixed(2);
  const dotR       = mm(0.6, scaleFactor).toFixed(2);

  // Horizontal shoulder at the label end
  const shoulderLen = mm(4, scaleFactor);
  const shoulderX   = labelX + shoulderLen;

  // Determine if label is to the right or left
  const textAnchor = labelX >= featureX ? 'start' : 'end';
  const textX = labelX >= featureX ? (labelX + mm(1, scaleFactor)).toFixed(2) : (labelX - mm(1, scaleFactor)).toFixed(2);

  return `
<g class="leader-line">
  <!-- Leader shaft -->
  <polyline points="${featureX.toFixed(2)},${featureY.toFixed(2)} ${labelX.toFixed(2)},${labelY.toFixed(2)} ${shoulderX.toFixed(2)},${labelY.toFixed(2)}" ${strokeAttr} fill="none" marker-end="url(#arrow-end)"/>
  ${dotAtFeature ? `<circle cx="${featureX.toFixed(2)}" cy="${featureY.toFixed(2)}" r="${dotR}" fill="#000"/>` : ''}
  <!-- Label -->
  <text x="${textX}" y="${(labelY - mm(0.8, scaleFactor)).toFixed(2)}"
    font-family="Arial Narrow,Arial,sans-serif" font-size="${fontSize}"
    text-anchor="${textAnchor}" dominant-baseline="auto" fill="#000">${label}</text>
  ${subLabel ? `<text x="${textX}" y="${(labelY + mm(1.8, scaleFactor)).toFixed(2)}"
    font-family="Arial Narrow,Arial,sans-serif" font-size="${subSize}"
    text-anchor="${textAnchor}" dominant-baseline="auto" fill="#555">${subLabel}</text>` : ''}
</g>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOPE / GRADIENT ANNOTATION
// Arrow showing direction of fall with gradient label
// Source: Ghilani & Wolf Ch.17 — slope indication on plans
// ─────────────────────────────────────────────────────────────────────────────

export interface SlopeAnnotationOptions {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  gradientPct: number;      // e.g. 3.5 for 3.5%
  scaleFactor?: number;
}

export function renderSlopeAnnotation(opts: SlopeAnnotationOptions): string {
  const { fromX, fromY, toX, toY, gradientPct, scaleFactor = 1 } = opts;
  const strokeAttr = svgStrokeAttrs('leader_line', scaleFactor);
  const fontSize = mm(2.0, scaleFactor).toFixed(2);
  const label = `${Math.abs(gradientPct).toFixed(1)}%`;
  const angle = Math.atan2(toY - fromY, toX - fromX) * (180 / Math.PI);

  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;
  const textAngle = (angle > 90 || angle < -90) ? angle + 180 : angle;
  const perpX = -(toY - fromY) / Math.hypot(toX - fromX, toY - fromY);
  const perpY =  (toX - fromX) / Math.hypot(toX - fromX, toY - fromY);
  const lx = midX + perpX * mm(3, scaleFactor);
  const ly = midY + perpY * mm(3, scaleFactor);

  return `
<g class="slope-annotation">
  <line x1="${fromX.toFixed(2)}" y1="${fromY.toFixed(2)}" x2="${toX.toFixed(2)}" y2="${toY.toFixed(2)}" ${strokeAttr} marker-end="url(#arrow-end)"/>
  <text x="${lx.toFixed(2)}" y="${ly.toFixed(2)}"
    transform="rotate(${textAngle.toFixed(1)},${lx.toFixed(2)},${ly.toFixed(2)})"
    text-anchor="middle" dominant-baseline="auto"
    font-family="Arial Narrow,Arial,sans-serif" font-size="${fontSize}" fill="#000">${label}</text>
</g>`;
}
