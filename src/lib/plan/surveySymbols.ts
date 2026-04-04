/**
 * METARDU — Survey of Kenya Standard Feature Symbols
 * SVG symbol definitions for topographic plans.
 *
 * Source: Survey of Kenya — Standard Symbols for Topographic Surveys
 *         Survey Act Cap 299 (Revised 2022)
 *         Survey Regulations 1994
 *
 * Symbol categories:
 *   - Boundary markers (beacons, reference marks)
 *   - Buildings and structures
 *   - Roads and tracks
 *   - Water features
 *   - Vegetation
 *   - Utilities
 *   - Control points
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SurveySymbol {
  id:          string;
  name:        string;
  category:    SymbolCategory;
  svgDef:      string;    // <symbol> element (referenced by <use>)
  defaultSize: number;    // mm — nominal symbol size at 1:1000
  color:       string;    // default stroke/fill
  description: string;
}

export type SymbolCategory =
  | 'boundary'
  | 'control'
  | 'building'
  | 'road'
  | 'water'
  | 'vegetation'
  | 'utility'
  | 'relief';

// ─────────────────────────────────────────────────────────────────────────────
// SYMBOL DEFINITIONS
// All symbols defined in a 20×20 viewBox, centred at (10,10)
// Scaled to defaultSize mm when rendered
// ─────────────────────────────────────────────────────────────────────────────

export const SURVEY_SYMBOLS: SurveySymbol[] = [

  // ── BOUNDARY / CONTROL ────────────────────────────────────────────────────

  {
    id: 'beacon',
    name: 'Survey Beacon',
    category: 'boundary',
    defaultSize: 3,
    color: '#000000',
    description: 'Survey beacon / boundary mark — Survey Act Cap 299',
    svgDef: `<symbol id="sym-beacon" viewBox="0 0 20 20" overflow="visible">
      <!-- Solid triangle — standard Kenya beacon symbol -->
      <polygon points="10,2 18,18 2,18" fill="black" stroke="none"/>
      <!-- Centre dot -->
      <circle cx="10" cy="13" r="1.5" fill="white"/>
    </symbol>`,
  },

  {
    id: 'reference-mark',
    name: 'Reference Mark',
    category: 'control',
    defaultSize: 3.5,
    color: '#000000',
    description: 'Permanent reference mark / BM',
    svgDef: `<symbol id="sym-reference-mark" viewBox="0 0 20 20" overflow="visible">
      <!-- Square with central dot -->
      <rect x="3" y="3" width="14" height="14" fill="none" stroke="black" stroke-width="1.5"/>
      <circle cx="10" cy="10" r="2" fill="black"/>
    </symbol>`,
  },

  {
    id: 'trig-beacon',
    name: 'Trigonometric Beacon',
    category: 'control',
    defaultSize: 4,
    color: '#000000',
    description: 'Trig beacon / primary control point',
    svgDef: `<symbol id="sym-trig-beacon" viewBox="0 0 20 20" overflow="visible">
      <!-- Triangle outline with inner triangle -->
      <polygon points="10,1 19,18 1,18" fill="none" stroke="black" stroke-width="1.5"/>
      <polygon points="10,6 15,16 5,16" fill="black" stroke="none"/>
      <circle cx="10" cy="12" r="1.2" fill="white"/>
    </symbol>`,
  },

  {
    id: 'bench-mark',
    name: 'Bench Mark',
    category: 'control',
    defaultSize: 3,
    color: '#000000',
    description: 'Levelling bench mark (BM)',
    svgDef: `<symbol id="sym-bench-mark" viewBox="0 0 20 20" overflow="visible">
      <!-- Arrow pointing up with horizontal base bar -->
      <line x1="10" y1="16" x2="10" y2="4" stroke="black" stroke-width="1.5"/>
      <polygon points="10,2 14,8 6,8" fill="black"/>
      <line x1="4" y1="16" x2="16" y2="16" stroke="black" stroke-width="2"/>
    </symbol>`,
  },

  // ── BUILDINGS ─────────────────────────────────────────────────────────────

  {
    id: 'building',
    name: 'Building (Permanent)',
    category: 'building',
    defaultSize: 4,
    color: '#000000',
    description: 'Permanent building — solid outline',
    svgDef: `<symbol id="sym-building" viewBox="0 0 20 20" overflow="visible">
      <rect x="2" y="5" width="16" height="12" fill="#CCCCCC" stroke="black" stroke-width="1.5"/>
    </symbol>`,
  },

  {
    id: 'building-temporary',
    name: 'Building (Temporary)',
    category: 'building',
    defaultSize: 4,
    color: '#000000',
    description: 'Temporary structure — dashed outline',
    svgDef: `<symbol id="sym-building-temporary" viewBox="0 0 20 20" overflow="visible">
      <rect x="2" y="5" width="16" height="12" fill="none" stroke="black" stroke-width="1.5" stroke-dasharray="2,1.5"/>
    </symbol>`,
  },

  // ── ROADS AND TRACKS ──────────────────────────────────────────────────────

  {
    id: 'road-paved',
    name: 'Paved Road',
    category: 'road',
    defaultSize: 3,
    color: '#000000',
    description: 'Paved / sealed road — double solid line',
    svgDef: `<symbol id="sym-road-paved" viewBox="0 0 20 4" overflow="visible">
      <!-- Two parallel lines representing road edges -->
      <line x1="0" y1="0.5" x2="20" y2="0.5" stroke="black" stroke-width="0.8"/>
      <line x1="0" y1="3.5" x2="20" y2="3.5" stroke="black" stroke-width="0.8"/>
    </symbol>`,
  },

  {
    id: 'track',
    name: 'Track / Murram Road',
    category: 'road',
    defaultSize: 3,
    color: '#000000',
    description: 'Unsurfaced track — dashed double line',
    svgDef: `<symbol id="sym-track" viewBox="0 0 20 4" overflow="visible">
      <line x1="0" y1="0.5" x2="20" y2="0.5" stroke="black" stroke-width="0.8" stroke-dasharray="4,2"/>
      <line x1="0" y1="3.5" x2="20" y2="3.5" stroke="black" stroke-width="0.8" stroke-dasharray="4,2"/>
    </symbol>`,
  },

  // ── WATER FEATURES ────────────────────────────────────────────────────────

  {
    id: 'stream',
    name: 'Stream / Watercourse',
    category: 'water',
    defaultSize: 2,
    color: '#0077CC',
    description: 'Watercourse — thin blue line, flow arrow optional',
    svgDef: `<symbol id="sym-stream" viewBox="0 0 20 6" overflow="visible">
      <!-- Wavy blue line -->
      <path d="M0,3 Q5,1 10,3 Q15,5 20,3" fill="none" stroke="#0077CC" stroke-width="1"/>
    </symbol>`,
  },

  {
    id: 'well',
    name: 'Well / Borehole',
    category: 'water',
    defaultSize: 3,
    color: '#0077CC',
    description: 'Well or borehole — circle with centre dot',
    svgDef: `<symbol id="sym-well" viewBox="0 0 20 20" overflow="visible">
      <circle cx="10" cy="10" r="7" fill="none" stroke="#0077CC" stroke-width="1.5"/>
      <circle cx="10" cy="10" r="2" fill="#0077CC"/>
    </symbol>`,
  },

  // ── VEGETATION ────────────────────────────────────────────────────────────

  {
    id: 'tree',
    name: 'Individual Tree',
    category: 'vegetation',
    defaultSize: 3,
    color: '#228B22',
    description: 'Individual tree — circle with stem',
    svgDef: `<symbol id="sym-tree" viewBox="0 0 20 20" overflow="visible">
      <line x1="10" y1="18" x2="10" y2="12" stroke="#228B22" stroke-width="1.5"/>
      <circle cx="10" cy="8" r="6" fill="none" stroke="#228B22" stroke-width="1"/>
    </symbol>`,
  },

  {
    id: 'scrub',
    name: 'Scrub / Bush',
    category: 'vegetation',
    defaultSize: 3,
    color: '#228B22',
    description: 'Scrub / bush — irregular circle cluster',
    svgDef: `<symbol id="sym-scrub" viewBox="0 0 20 20" overflow="visible">
      <circle cx="7"  cy="12" r="4.5" fill="none" stroke="#228B22" stroke-width="0.9"/>
      <circle cx="13" cy="12" r="4.5" fill="none" stroke="#228B22" stroke-width="0.9"/>
      <circle cx="10" cy="8"  r="4.5" fill="none" stroke="#228B22" stroke-width="0.9"/>
    </symbol>`,
  },

  // ── UTILITIES ─────────────────────────────────────────────────────────────

  {
    id: 'power-line',
    name: 'Power Line',
    category: 'utility',
    defaultSize: 2,
    color: '#333333',
    description: 'Overhead power line — line with pylon marks',
    svgDef: `<symbol id="sym-power-line" viewBox="0 0 20 8" overflow="visible">
      <line x1="0" y1="4" x2="20" y2="4" stroke="#333" stroke-width="0.8"/>
      <line x1="5"  y1="2" x2="5"  y2="6" stroke="#333" stroke-width="1"/>
      <line x1="15" y1="2" x2="15" y2="6" stroke="#333" stroke-width="1"/>
    </symbol>`,
  },

  {
    id: 'fence',
    name: 'Fence',
    category: 'boundary',
    defaultSize: 2,
    color: '#555555',
    description: 'Fence — line with tick marks',
    svgDef: `<symbol id="sym-fence" viewBox="0 0 20 6" overflow="visible">
      <line x1="0" y1="3" x2="20" y2="3" stroke="#555" stroke-width="0.8"/>
      <line x1="4"  y1="1" x2="4"  y2="5" stroke="#555" stroke-width="0.8"/>
      <line x1="10" y1="1" x2="10" y2="5" stroke="#555" stroke-width="0.8"/>
      <line x1="16" y1="1" x2="16" y2="5" stroke="#555" stroke-width="0.8"/>
    </symbol>`,
  },

];

// ─────────────────────────────────────────────────────────────────────────────
// SYMBOL REGISTRY — lookup by id
// ─────────────────────────────────────────────────────────────────────────────

export const SYMBOL_REGISTRY = Object.fromEntries(
  SURVEY_SYMBOLS.map((s: any) => [s.id, s])
) as Record<string, SurveySymbol>;

// ─────────────────────────────────────────────────────────────────────────────
// SVG DEFS BLOCK
// Inject into <defs> at the top of the plan SVG
// ─────────────────────────────────────────────────────────────────────────────

export function buildSymbolDefs(symbolIds?: string[]): string {
  const symbols = symbolIds
    ? SURVEY_SYMBOLS.filter((s: any) => symbolIds.includes(s.id))
    : SURVEY_SYMBOLS;

  return `<defs>\n${symbols.map((s: any) => s.svgDef).join('\n')}\n</defs>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER SYMBOL AT POSITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render a symbol instance at (sx, sy) in SVG coordinates.
 * size_mm controls the rendered size — defaults to symbol's defaultSize.
 */
export function renderSymbol(
  symbolId: string,
  sx: number,
  sy: number,
  options?: {
    size_mm?: number;
    rotation?: number;
    label?: string;
    labelOffsetX?: number;
    labelOffsetY?: number;
    scaleFactor?: number;
  }
): string {
  const sym = SYMBOL_REGISTRY[symbolId];
  if (!sym) return `<!-- Unknown symbol: ${symbolId} -->`;

  const {
    size_mm = sym.defaultSize,
    rotation = 0,
    label,
    labelOffsetX = 4,
    labelOffsetY = -2,
    scaleFactor = 1,
  } = options ?? {};

  const sizePx = size_mm * 3.7795275591 * scaleFactor;

  const transform = rotation !== 0
    ? `translate(${sx.toFixed(2)},${sy.toFixed(2)}) rotate(${rotation}) translate(${(-sizePx/2).toFixed(2)},${(-sizePx/2).toFixed(2)})`
    : `translate(${(sx - sizePx/2).toFixed(2)},${(sy - sizePx/2).toFixed(2)})`;

  const useEl = `<use href="#sym-${symbolId}" width="${sizePx.toFixed(2)}" height="${sizePx.toFixed(2)}" transform="${transform}"/>`;

  if (!label) return useEl;

  const fontSize = 1.4 * 3.7795275591 * scaleFactor;
  const textEl = `<text x="${(sx + labelOffsetX).toFixed(2)}" y="${(sy + labelOffsetY).toFixed(2)}" ` +
    `font-family="Arial Narrow,Arial,sans-serif" font-size="${fontSize.toFixed(2)}" fill="#333">${label}</text>`;

  return `${useEl}\n${textEl}`;
}
