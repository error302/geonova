/**
 * Sanitize HTML content using DOMPurify to prevent XSS attacks.
 * Safe for use with dangerouslySetInnerHTML.
 *
 * NOTE (2026-08-30): The whitelist previously allowed `<svg>` but none of its
 * child drawing elements (path, rect, line, circle, text, g, polygon…), so
 * DOMPurify stripped the entire plan/symbol geometry and rendered an empty
 * `<svg>` shell — the survey plan viewer showed a blank canvas and beacon
 * symbols in BeaconPicker were invisible. The SVG vocabulary below is the
 * exact inert set emitted by SurveyPlanRenderer, FormNo4Renderer and
 * beaconSymbols (audited via scripts/audit-svg-vocab.ts /
 * scripts/audit-beacon-vocab.ts), plus a small margin of standard
 * presentation attributes.
 *
 * Deliberately NOT allowed (XSS / SSRF vectors even under DOMPurify):
 *   script, foreignObject, use, image, animate, set, animateTransform,
 *   handler, iframe, object, embed — and no href/xlink:href on SVG elements
 *   (external references). DOMPurify additionally strips all on* event
 *   handlers regardless of this list.
 */
const ALLOWED_HTML_TAGS = [
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'ul', 'ol', 'li', 'a', 'strong', 'em', 'b', 'i', 'u',
  'br', 'hr', 'img', 'style', 'blockquote', 'pre', 'code',
  'sub', 'sup', 'section', 'article', 'header', 'footer', 'nav',
  // ─── Inert SVG drawing vocabulary (see note above) ───
  'svg', 'g', 'defs', 'title', 'desc',
  'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan',
]

const ALLOWED_ATTRS = [
  'class', 'id', 'style', 'href', 'src', 'alt', 'title',
  'border', 'cellpadding', 'cellspacing', 'colspan', 'rowspan',
  'text-align', 'font-size', 'font-weight', 'font-style',
  'background', 'color', 'padding', 'margin', 'vertical-align',
  // ─── SVG geometry & presentation (no href/xlink:href, no on*) ───
  'viewBox', 'xmlns', 'preserveAspectRatio',
  'd', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width',
  'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'transform', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'dx', 'dy',
  'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'points',
  'opacity', 'font-family', 'text-anchor', 'dominant-baseline',
  'gradientUnits', 'offset', 'stop-color', 'stop-opacity',
  'patternUnits', 'marker-start', 'marker-mid', 'marker-end',
  'role', 'aria-label', 'aria-hidden', 'focusable',
]

export function sanitizeHtml(dirty: string): string {
  // DOMPurify requires `window` — use synchronous client-side loading
  if (typeof window !== 'undefined') {
    // DOMPurify requires window; guarded client-side load.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const createDOMPurify = require('dompurify') as unknown as typeof import('dompurify') & { default?: typeof import('dompurify') };
    const DOMPurify = createDOMPurify.default || createDOMPurify;
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: ALLOWED_HTML_TAGS,
      ALLOWED_ATTR: ALLOWED_ATTRS,
    });
  }
  // Server-side fallback: strip all tags
  return dirty.replace(/<[^>]*>/g, '');
}

export function sanitizeText(input: string): string {
  return input
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .substring(0, 500)
}

export function sanitizeNumber(
  input: string | number, 
  min?: number, 
  max?: number
): number | null {
  const num = parseFloat(String(input))
  if (isNaN(num)) return null
  if (min !== undefined && num < min) return null
  if (max !== undefined && num > max) return null
  return num
}

export function sanitizeCoordinate(
  easting: string | number, 
  northing: string | number
): { easting: number; northing: number } | null {
  const e = sanitizeNumber(easting, 100000, 900000)
  const n = sanitizeNumber(northing, 0, 10000000)
  if (e === null || n === null) return null
  return { easting: e, northing: n }
}

export function sanitizeBearing(input: string): string | null {
  const cleaned = String(input).trim().replace(/\s/g, '')
  const dmsMatch = cleaned.match(/^(\d{1,3})°?(\d{1,2})'?(\d{1,2}(?:\.\d+)?)"?$/)
  if (dmsMatch) {
    const degrees = parseInt(dmsMatch[1])
    const minutes = parseInt(dmsMatch[2])
    const seconds = parseFloat(dmsMatch[3])
    if (degrees >= 0 && degrees <= 360 && minutes < 60 && seconds < 60) {
      return `${degrees}°${minutes}'${seconds}"`
    }
  }
  const decMatch = cleaned.match(/^(\d+(?:\.\d+)?)$/)
  if (decMatch) {
    const dec = parseFloat(decMatch[1])
    if (dec >= 0 && dec <= 360) {
      return String(dec)
    }
  }
  return null
}

export function sanitizeEmail(input: string): string | null {
  const cleaned = sanitizeText(input).toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (emailRegex.test(cleaned)) {
    return cleaned
  }
  return null
}

export function sanitizePointName(input: string): string {
  return sanitizeText(input).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50)
}
