/**
 * Shared XML escaping utility.
 *
 * Previously duplicated in 8+ files across the codebase. This is the
 * canonical implementation — all other copies should be replaced with
 * an import from here.
 *
 * Escapes the 5 XML special characters: & < > " '
 * Per XML 1.0 spec: https://www.w3.org/TR/xml/#syntax
 */

/**
 * Escape a string for safe interpolation into XML/SVG content.
 *
 * Handles null/undefined by returning empty string (defensive —
 * prevents 'undefined' or 'null' appearing in output).
 */
export function escapeXml(s: string | null | undefined): string {
  if (s == null || typeof s !== 'string') return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Escape a string for use as an XML attribute value.
 * Same as escapeXml but emphasizes the attribute context.
 */
export function escapeXmlAttr(s: string | null | undefined): string {
  return escapeXml(s)
}
