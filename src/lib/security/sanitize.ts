/**
 * Sanitize HTML content using DOMPurify to prevent XSS attacks.
 * Safe for use with dangerouslySetInnerHTML.
 */
export function sanitizeHtml(dirty: string): string {
  // DOMPurify requires `window` — use synchronous client-side loading
  if (typeof window !== 'undefined') {
    // DOMPurify requires window; guarded client-side load.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const createDOMPurify = require('dompurify') as unknown as typeof import('dompurify') & { default?: typeof import('dompurify') };
    const DOMPurify = createDOMPurify.default || createDOMPurify;
    return DOMPurify.sanitize(dirty, {
      USE_PROFILES: { html: true, svg: true },
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
