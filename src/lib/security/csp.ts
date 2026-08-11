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
 * Uses Web Crypto (globalThis.crypto.getRandomValues) instead of Node's
 * crypto.randomBytes so this module also works in the Edge runtime —
 * middleware.ts runs in Edge where `node:crypto` is unavailable.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  // Base64-encode without Buffer (also unavailable in Edge).
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
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
      // Web Bluetooth is gated by Permissions-Policy (set in middleware), NOT
      // a CSP directive — 'bluetooth' is not a valid CSP source and Chrome
      // logs "Unrecognized Content-Security-Policy directive" for it.
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
