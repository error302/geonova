/**
 * Canonical public site URL / host.
 *
 * Production runs on `https://metardu.space` (Cloudflare → Nginx → Next.js).
 * These helpers are used by layout metadata, sitemap, robots, payments,
 * QR codes and email templates — so the value must NEVER be localhost or a
 * private host, or Google rejects every URL in the sitemap ("This URL is
 * not allowed for a Sitemap at this location").
 *
 * The docker-compose files default NEXT_PUBLIC_APP_URL to
 * http://localhost:3000, so we guard against that class of misconfiguration
 * and fall back to the canonical production domain.
 */

const DEFAULT_SITE_URL = 'https://metardu.space'

// Known-stale hosts that have leaked into env/build output and made Google
// reject the sitemap ("This URL is not allowed for a Sitemap at this
// location"). If any of these appear in env, treat them as misconfiguration
// and fall back to the canonical domain.
//
// EXACT match only — `staging.metardu.duckdns.org` is a live deployment
// (deploy-staging.yml) and must NOT be treated as stale; a subdomain suffix
// check would break staging the same way the stale host broke production.
const STALE_HOSTS = ['metardu.duckdns.org', 'geonova-henna.vercel.app', 'metardu.vercel.app']

function normalizeUrl(value?: string | null): string | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    return new URL(withProtocol).toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

/**
 * Only accept public https URLs — never localhost or private/loopback hosts —
 * so sitemap/robots/email output never emits a URL a crawler rejects.
 */
function isPublicHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.localhost')) return false
    if (host === '127.0.0.1' || host === '::1' || host.startsWith('10.')) return false
    if (/^192\.168\./.test(host)) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
    // Stale/legacy hosts from earlier deployments — never canonical.
    if (STALE_HOSTS.includes(host)) return false
    return true
  } catch {
    return false
  }
}

export function getPublicAppUrl(): string {
  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const vercelPreviewUrl = process.env.VERCEL_URL

  const candidate =
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeUrl(process.env.APP_URL) ??
    normalizeUrl(vercelProductionUrl) ??
    normalizeUrl(vercelPreviewUrl)

  return candidate && isPublicHttpsUrl(candidate) ? candidate : DEFAULT_SITE_URL
}

export function getPublicAppHost(): string {
  return getPublicAppUrl().replace(/^https?:\/\//i, '')
}
