const DEFAULT_SITE_URL = 'https://metardu.space'

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

export function getPublicAppUrl(): string {
  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const vercelPreviewUrl = process.env.VERCEL_URL

  return (
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeUrl(process.env.APP_URL) ??
    normalizeUrl(vercelProductionUrl) ??
    normalizeUrl(vercelPreviewUrl) ??
    DEFAULT_SITE_URL
  )
}

export function getPublicAppHost(): string {
  return getPublicAppUrl().replace(/^https?:\/\//i, '')
}
