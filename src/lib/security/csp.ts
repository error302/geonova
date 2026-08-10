/**
 * Content Security Policy — nonce-based CSP headers
 *
 * Generates per-request CSP with a cryptographic nonce.
 * The nonce is generated in middleware and passed to pages via
 * the <meta> tag / script tag so inline scripts can be allowed
 * selectively rather than blanket 'unsafe-inline'.
 */

/**
 * Generate a cryptographically random nonce string.
 */
export function generateNonce(): string {
  // Try Web Crypto API first (standard in browsers and Edge Runtime)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(array).toString('base64')
    }
    return typeof btoa !== 'undefined' ? btoa(String.fromCharCode(...Array.from(array))) : 'fallback-nonce-1'
  }

  // Try Node.js crypto
  try {
    // Guard require so webpack/edge compiler doesn't panic
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto')
    if (nodeCrypto && nodeCrypto.randomBytes) {
      return nodeCrypto.randomBytes(16).toString('base64')
    }
  } catch (e) {
    // Fallthrough if crypto module isn't available
  }

  // Final fallback
  const array = new Uint8Array(16)
  for (let i = 0; i < 16; i++) {
    array[i] = Math.floor(Math.random() * 256)
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(array).toString('base64')
  }
  return typeof btoa !== 'undefined' ? btoa(String.fromCharCode(...Array.from(array))) : 'fallback-nonce-2'
}

/**
 * Build CSP header value for a given nonce.
 * In development, 'unsafe-eval' is added for HMR / hot reload.
 *
 * AUDIT FIX (M10, 2026-07-02): Added 'unsafe-inline' to script-src.
 * Next.js 14 App Router generates inline RSC scripts (self.__next_f.push)
 * that don't carry the nonce attribute, so 'unsafe-inline' is required
 * for the app to function. The nonce is also included for components
 * that DO use it (via the <Script nonce={...}> tag). When upgrading to
 * Next.js 15, 'unsafe-inline' can be removed — Next.js 15 properly
 * injects nonces into all inline scripts.
 */
export function getCspHeaders(nonce: string) {
  const isDev = process.env.NODE_ENV === 'development'

  return {
    'Content-Security-Policy': [
      `default-src 'self'`,
      // 'unsafe-inline' required for Next.js 14 RSC inline scripts.
      // 'nonce-${nonce}' allows components that use <Script nonce> to
      // be more restrictive. Remove 'unsafe-inline' after Next.js 15 upgrade.
      `script-src 'self' 'unsafe-inline' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ''} 'wasm-unsafe-eval'`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net`,
      `font-src 'self' https://fonts.gstatic.com`,
      `img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://*.mapbox.com https://server.arcgisonline.com https://*.arcgisonline.com https://*.basemaps.cartocdn.com`,
      `connect-src 'self' ${isDev ? 'ws://localhost:* http://localhost:*' : ''} wss: https:`,
      // Web Bluetooth API requires bluetooth directive (Chrome 104+)
      // Needed for GNSSConnectionPanel + InstrumentConnectionPanel
      `bluetooth 'self'`,
      `worker-src 'self' blob:`,
      `frame-src 'none'`,
      `object-src 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `frame-ancestors 'none'`,
      `upgrade-insecure-requests`,
    ].join('; '),
  }
}
