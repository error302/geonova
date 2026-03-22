/**
 * METARDU — Plan Line Weights
 * Four line weight levels for topographic plans.
 *
 * Source: Survey of Kenya — Standard Topographic Plan Conventions
 *         Survey Act Cap 299, Survey Regulations 1994
 *
 * The four levels (Brief 12):
 *   Level 1 (HEAVY)   — 0.50mm — boundaries, title block border
 *   Level 2 (MEDIUM)  — 0.35mm — index contours, road edges, structures
 *   Level 3 (LIGHT)   — 0.18mm — form contours, dimension lines
 *   Level 4 (HAIRLINE)— 0.13mm — spot heights, grid lines, leader lines
 */

// ─────────────────────────────────────────────────────────────────────────────
// LINE WEIGHT LEVELS
// ─────────────────────────────────────────────────────────────────────────────

export type LineWeightLevel = 1 | 2 | 3 | 4;

export const LINE_WEIGHT_MM: Record<LineWeightLevel, number> = {
  1: 0.50,   // HEAVY     — survey boundary, title block border
  2: 0.35,   // MEDIUM    — index contour, roads, buildings
  3: 0.18,   // LIGHT     — form contour, dimension lines, secondary features
  4: 0.13,   // HAIRLINE  — spot heights, grid lines, leader lines, text elements
};

// px per mm (at 96 dpi): 1mm = 3.7795px
const MM_TO_PX = 3.7795275591;

export function lineWeightPx(level: LineWeightLevel, scaleFactor = 1): number {
  return LINE_WEIGHT_MM[level] * MM_TO_PX * scaleFactor;
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE TYPE ASSIGNMENTS
// Maps each plan feature category to a weight level + stroke dash pattern
// ─────────────────────────────────────────────────────────────────────────────

export interface LineStyle {
  weight:      LineWeightLevel;
  dash?:       string;     // SVG stroke-dasharray value (undefined = solid)
  color:       string;
  linecap?:    'butt' | 'round' | 'square';
  linejoin?:   'miter' | 'round' | 'bevel';
  description: string;
}

export const LINE_STYLES: Record<string, LineStyle> = {

  // Level 1 — HEAVY (0.50mm)
  survey_boundary:   { weight: 1, color: '#000000', linecap: 'square', linejoin: 'miter', description: 'Survey / cadastral boundary' },
  title_block:       { weight: 1, color: '#000000', linecap: 'square', linejoin: 'miter', description: 'Title block outer border' },

  // Level 2 — MEDIUM (0.35mm)
  index_contour:     { weight: 2, color: '#5C4A2A', linecap: 'round', linejoin: 'round', description: 'Index contour (every 5th)' },
  road_edge:         { weight: 2, color: '#000000', linecap: 'butt',  linejoin: 'miter', description: 'Road / carriageway edge' },
  building_outline:  { weight: 2, color: '#000000', linecap: 'square', linejoin: 'miter', description: 'Permanent building outline' },
  watercourse_major: { weight: 2, color: '#0066BB', linecap: 'round', linejoin: 'round', description: 'Major watercourse' },
  fence_boundary:    { weight: 2, color: '#333333', linecap: 'butt',  linejoin: 'miter', description: 'Fenced boundary' },

  // Level 3 — LIGHT (0.18mm)
  form_contour:      { weight: 3, color: '#8B7355', linecap: 'round', linejoin: 'round', description: 'Form (intermediate) contour' },
  formline:          { weight: 3, color: '#8B7355', dash: '3,2',       linecap: 'round', linejoin: 'round', description: 'Supplementary formline (dashed, half-interval)' },
  dimension_line:    { weight: 3, color: '#000000', linecap: 'butt',  linejoin: 'miter', description: 'Dimension line' },
  extension_line:    { weight: 3, color: '#000000', linecap: 'butt',  linejoin: 'miter', description: 'Extension line for dimensions' },
  road_centre:       { weight: 3, color: '#000000', dash: '6,3',       linecap: 'butt',  description: 'Road centre line (dashed)' },
  track:             { weight: 3, color: '#555555', dash: '4,2',       linecap: 'round', description: 'Track / unsurfaced road' },
  power_line:        { weight: 3, color: '#333333', linecap: 'butt',  linejoin: 'miter', description: 'Overhead power line' },
  watercourse_minor: { weight: 3, color: '#0077CC', linecap: 'round', linejoin: 'round', description: 'Minor stream / drainage' },

  // Level 4 — HAIRLINE (0.13mm)
  spot_height:       { weight: 4, color: '#3A3A3A', linecap: 'butt',  description: 'Spot height cross mark' },
  grid_line:         { weight: 4, color: '#AAAAAA', dash: '1,4',       linecap: 'round', description: 'Grid / graticule line' },
  leader_line:       { weight: 4, color: '#000000', linecap: 'round', linejoin: 'round', description: 'Dimension leader line' },
  north_arrow_shaft: { weight: 4, color: '#000000', linecap: 'round', description: 'North arrow shaft' },
  table_grid:        { weight: 4, color: '#888888', linecap: 'butt',  linejoin: 'miter', description: 'Table / schedule grid line' },
};

// ─────────────────────────────────────────────────────────────────────────────
// SVG ATTRIBUTE BUILDER
// Returns SVG stroke attribute string for a named line style
// ─────────────────────────────────────────────────────────────────────────────

export function svgStrokeAttrs(
  styleKey: keyof typeof LINE_STYLES,
  scaleFactor = 1
): string {
  const style = LINE_STYLES[styleKey];
  if (!style) return `stroke="black" stroke-width="1"`;

  const w = lineWeightPx(style.weight, scaleFactor).toFixed(3);
  const attrs: string[] = [
    `stroke="${style.color}"`,
    `stroke-width="${w}"`,
  ];

  if (style.dash)     attrs.push(`stroke-dasharray="${style.dash}"`);
  if (style.linecap)  attrs.push(`stroke-linecap="${style.linecap}"`);
  if (style.linejoin) attrs.push(`stroke-linejoin="${style.linejoin}"`);

  return attrs.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGEND GENERATOR
// Produces an SVG line weight legend block for insertion in plan
// ─────────────────────────────────────────────────────────────────────────────

export function buildLineWeightLegend(
  x: number,
  y: number,
  scaleFactor = 1
): string {
  const rowH  = 5 * scaleFactor;
  const lineL = 20 * scaleFactor;
  const fontSize = 3.2 * scaleFactor;
  const lines: string[] = [`<g id="line-weight-legend" transform="translate(${x},${y})">`];

  lines.push(
    `<text x="0" y="-3" font-family="Arial,sans-serif" font-size="${(fontSize * 1.1).toFixed(1)}" font-weight="bold" fill="#000">Line Weights</text>`
  );

  const entries: [LineWeightLevel, string, string][] = [
    [1, 'Heavy (0.50mm)',    'survey_boundary'],
    [2, 'Medium (0.35mm)',   'index_contour'],
    [3, 'Light (0.18mm)',    'form_contour'],
    [4, 'Hairline (0.13mm)', 'leader_line'],
  ];

  entries.forEach(([level, label, styleKey], i) => {
    const rowY = i * rowH;
    const w = lineWeightPx(level, scaleFactor).toFixed(3);
    const style = LINE_STYLES[styleKey];

    lines.push(
      `<line x1="0" y1="${rowY}" x2="${lineL}" y2="${rowY}" ` +
      `stroke="${style?.color ?? '#000'}" stroke-width="${w}"` +
      (style?.dash ? ` stroke-dasharray="${style.dash}"` : '') +
      `/>`,
      `<text x="${lineL + 3}" y="${rowY + 1}" ` +
      `font-family="Arial,sans-serif" font-size="${fontSize.toFixed(1)}" ` +
      `dominant-baseline="middle" fill="#333">${label}</text>`
    );
  });

  lines.push('</g>');
  return lines.join('\n');
}
