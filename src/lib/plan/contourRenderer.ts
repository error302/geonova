/**
 * METARDU — Contour SVG Renderer
 * Renders contour lines from Python engine output (/api/compute/contours)
 * into SVG elements for the topographic plan.
 *
 * Source: Ghilani & Wolf, Elementary Surveying 16th Ed. (Pearson 2021), Chapter 17
 *         Survey of Kenya — Standard Symbols for Topographic Plans
 *
 * Line weight levels (Brief 12):
 *   INDEX contour   → 0.35mm stroke (heavy)
 *   FORM contour    → 0.18mm stroke (light)
 *   Spot heights    → 0.13mm text
 *   Formline        → 0.13mm dashed (supplementary half-interval)
 */

import type { ContourResult, ContourLine, SpotHeight } from '@/lib/compute/pythonService';

// ─────────────────────────────────────────────────────────────────────────────
// LINE WEIGHT CONSTANTS — Brief 12
// Source: Survey of Kenya Topographic Plan Standards
// Four levels as specified
// ─────────────────────────────────────────────────────────────────────────────

export const LINE_WEIGHTS = {
  INDEX_CONTOUR:  0.35,   // mm — every 5th contour, labelled
  FORM_CONTOUR:   0.18,   // mm — intermediate contours
  FORMLINE:       0.13,   // mm — supplementary (dashed, half-interval)
  SPOT_HEIGHT:    0.13,   // mm — spot height text and tick mark
  BOUNDARY:       0.50,   // mm — survey/property boundary
  ROAD:           0.25,   // mm — road/track
  WATER:          0.20,   // mm — watercourse / drainage
  BUILDING:       0.25,   // mm — structure outline
} as const;

// px per mm at standard plan scale (1:1000 default, 96 dpi)
// Adjust scaleFactor when rendering at different plan scales
function mmToPx(mm: number, scaleFactor = 1): number {
  return mm * 3.7795275591 * scaleFactor;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORLD → SVG COORDINATE TRANSFORM
// ─────────────────────────────────────────────────────────────────────────────

export interface ViewTransform {
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
  svg_width: number;
  svg_height: number;
  margin: number;
}

export function worldToSvg(
  wx: number,
  wy: number,
  t: ViewTransform
): [number, number] {
  const usable_w = t.svg_width  - 2 * t.margin;
  const usable_h = t.svg_height - 2 * t.margin;
  const world_w  = t.x_max - t.x_min;
  const world_h  = t.y_max - t.y_min;

  const sx = t.margin + ((wx - t.x_min) / world_w) * usable_w;
  // SVG Y-axis is inverted relative to survey Y (North = up)
  const sy = t.margin + ((t.y_max - wy) / world_h) * usable_h;

  return [sx, sy];
}

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENT CHAIN BUILDER
// Joins adjacent segments into polylines (chains) for cleaner SVG output
// and correct label placement.
// ─────────────────────────────────────────────────────────────────────────────

type Segment = [[number, number], [number, number]];
type Chain   = [number, number][];

function buildChains(segments: Segment[]): Chain[] {
  if (!segments.length) return [];

  // Build adjacency: endpoint → segment index
  const tolerance = 1e-4;

  const chains: Chain[] = [];
  const used = new Set<number>();

  for (let start = 0; start < segments.length; start++) {
    if (used.has(start)) continue;

    const chain: Chain = [...segments[start]];
    used.add(start);

    let extended = true;
    while (extended) {
      extended = false;
      const tail = chain[chain.length - 1];

      for (let i = 0; i < segments.length; i++) {
        if (used.has(i)) continue;
        const [a, b] = segments[i];

        if (Math.abs(a[0] - tail[0]) < tolerance && Math.abs(a[1] - tail[1]) < tolerance) {
          chain.push(b);
          used.add(i);
          extended = true;
          break;
        }
        if (Math.abs(b[0] - tail[0]) < tolerance && Math.abs(b[1] - tail[1]) < tolerance) {
          chain.push(a);
          used.add(i);
          extended = true;
          break;
        }
      }
    }
    chains.push(chain);
  }

  return chains;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTOUR LABEL PLACEMENT
// Places elevation label at the midpoint of the longest chain segment.
// Source: Ghilani & Wolf Ch.17 — contour labelling conventions
// ─────────────────────────────────────────────────────────────────────────────

function contourLabelPath(chain: Chain, t: ViewTransform): { x: number; y: number; angle: number } | null {
  if (chain.length < 2) return null;

  // Find the longest segment in the chain for label placement
  let maxLen = 0;
  let bestIdx = 0;

  for (let i = 0; i < chain.length - 1; i++) {
    const [ax, ay] = worldToSvg(chain[i][0],   chain[i][1],   t);
    const [bx, by] = worldToSvg(chain[i+1][0], chain[i+1][1], t);
    const len = Math.hypot(bx - ax, by - ay);
    if (len > maxLen) { maxLen = len; bestIdx = i; }
  }

  if (maxLen < 40) return null; // Too short to label

  const [ax, ay] = worldToSvg(chain[bestIdx][0],   chain[bestIdx][1],   t);
  const [bx, by] = worldToSvg(chain[bestIdx+1][0], chain[bestIdx+1][1], t);

  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  let angle = Math.atan2(by - ay, bx - ax) * (180 / Math.PI);

  // Keep text readable (never upside down)
  if (angle > 90 || angle < -90) angle += 180;

  return { x: mx, y: my, angle };
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER CONTOUR LINES TO SVG STRING
// ─────────────────────────────────────────────────────────────────────────────

export interface ContourRenderOptions {
  transform: ViewTransform;
  scaleFactor?: number;
  labelIndexContours?: boolean;
  contourColor?: string;
  indexContourColor?: string;
}

export function renderContoursToSvg(
  data: ContourResult,
  options: ContourRenderOptions
): string {
  const {
    transform: t,
    scaleFactor = 1,
    labelIndexContours = true,
    contourColor = '#8B7355',
    indexContourColor = '#5C4A2A',
  } = options;

  const lines: string[] = [];
  const labels: string[] = [];

  lines.push(`<g id="contours" data-interval="${data.interval_m}">`);

  for (const contour of data.contours) {
    const isIndex    = contour.is_index;
    const strokeW    = mmToPx(isIndex ? LINE_WEIGHTS.INDEX_CONTOUR : LINE_WEIGHTS.FORM_CONTOUR, scaleFactor);
    const stroke     = isIndex ? indexContourColor : contourColor;
    const opacity    = isIndex ? '0.9' : '0.65';

    const chains = buildChains(contour.segments as Segment[]);

    for (const chain of chains) {
      if (chain.length < 2) continue;

      // Build SVG polyline points
      const pts = chain
        .map(([wx, wy]) => {
          const [sx, sy] = worldToSvg(wx, wy, t);
          return `${sx.toFixed(2)},${sy.toFixed(2)}`;
        })
        .join(' ');

      lines.push(
        `<polyline points="${pts}" fill="none" stroke="${stroke}" ` +
        `stroke-width="${strokeW.toFixed(3)}" opacity="${opacity}" ` +
        `stroke-linecap="round" stroke-linejoin="round"/>`
      );

      // Label index contours
      if (isIndex && labelIndexContours) {
        const labelPos = contourLabelPath(chain, t);
        if (labelPos) {
          const fontSize = mmToPx(1.4, scaleFactor);
          labels.push(
            `<text x="${labelPos.x.toFixed(2)}" y="${labelPos.y.toFixed(2)}" ` +
            `transform="rotate(${labelPos.angle.toFixed(1)},${labelPos.x.toFixed(2)},${labelPos.y.toFixed(2)})" ` +
            `text-anchor="middle" dominant-baseline="middle" ` +
            `font-family="Arial Narrow,Arial,sans-serif" font-size="${fontSize.toFixed(2)}" ` +
            `fill="${indexContourColor}" stroke="white" stroke-width="${(fontSize * 0.25).toFixed(2)}" ` +
            `paint-order="stroke fill">${contour.elevation.toFixed(1)}</text>`
          );
        }
      }
    }
  }

  lines.push('</g>');
  if (labels.length) {
    lines.push('<g id="contour-labels">');
    lines.push(...labels);
    lines.push('</g>');
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER SPOT HEIGHTS TO SVG
// Source: Ghilani & Wolf Ch.17 — spot height symbols on plans
// Symbol: small cross (+) with elevation label to the right
// ─────────────────────────────────────────────────────────────────────────────

export function renderSpotHeightsToSvg(
  points: SpotHeight[],
  transform: ViewTransform,
  scaleFactor = 1,
  color = '#3A3A3A'
): string {
  const lines: string[] = ['<g id="spot-heights">'];
  const tickSize  = mmToPx(1.0, scaleFactor);
  const fontSize  = mmToPx(1.2, scaleFactor);
  const strokeW   = mmToPx(LINE_WEIGHTS.SPOT_HEIGHT, scaleFactor);

  for (const pt of points) {
    const [sx, sy] = worldToSvg(pt.x, pt.y, transform);
    const label = pt.label ? `${pt.label} (${pt.z.toFixed(3)}m)` : `${pt.z.toFixed(3)}`;

    // Cross symbol
    lines.push(
      `<line x1="${(sx - tickSize).toFixed(2)}" y1="${sy.toFixed(2)}" ` +
      `x2="${(sx + tickSize).toFixed(2)}" y2="${sy.toFixed(2)}" ` +
      `stroke="${color}" stroke-width="${strokeW.toFixed(3)}"/>`,

      `<line x1="${sx.toFixed(2)}" y1="${(sy - tickSize).toFixed(2)}" ` +
      `x2="${sx.toFixed(2)}" y2="${(sy + tickSize).toFixed(2)}" ` +
      `stroke="${color}" stroke-width="${strokeW.toFixed(3)}"/>`,

      // Elevation label to the right and slightly above
      `<text x="${(sx + tickSize + 1.5).toFixed(2)}" y="${(sy - 1.5).toFixed(2)}" ` +
      `font-family="Arial Narrow,Arial,sans-serif" font-size="${fontSize.toFixed(2)}" ` +
      `fill="${color}" dominant-baseline="auto">${label}</text>`
    );
  }

  lines.push('</g>');
  return lines.join('\n');
}
