/**
 * getPublicAppUrl() guards — the sitemap/robots/email canonical URL.
 *
 * Google rejects sitemap URLs that are "not allowed for a Sitemap at this
 * location" (different host). This test pins the guards that prevent
 * localhost/private/stale-hosts from ever leaking into the sitemap.
 */
import { getPublicAppUrl, getPublicAppHost } from '../src/lib/site'

const ORIG_ENV = { ...process.env }

function withEnv(overrides: Record<string, string | undefined>) {
  // Scrub all URL-ish vars so only the override is considered.
  for (const key of Object.keys(process.env)) {
    if (/^(NEXT_PUBLIC_APP_URL|APP_URL|VERCEL_.*URL)$/.test(key)) delete process.env[key]
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

afterEach(() => {
  process.env = { ...ORIG_ENV }
})

describe('getPublicAppUrl', () => {
  it('falls back to the canonical metardu.space when no env is set', () => {
    withEnv({})
    expect(getPublicAppUrl()).toBe('https://metardu.space')
    expect(getPublicAppHost()).toBe('metardu.space')
  })

  it('accepts an explicit public https NEXT_PUBLIC_APP_URL', () => {
    withEnv({ NEXT_PUBLIC_APP_URL: 'https://app.example.com' })
    expect(getPublicAppUrl()).toBe('https://app.example.com')
  })

  it('rejects localhost and falls back to canonical', () => {
    withEnv({ NEXT_PUBLIC_APP_URL: 'http://localhost:3000' })
    expect(getPublicAppUrl()).toBe('https://metardu.space')
  })

  it('rejects private/loopback hosts and falls back to canonical', () => {
    withEnv({ NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3000' })
    expect(getPublicAppUrl()).toBe('https://metardu.space')
    withEnv({ NEXT_PUBLIC_APP_URL: 'http://192.168.1.10:3000' })
    expect(getPublicAppUrl()).toBe('https://metardu.space')
    withEnv({ NEXT_PUBLIC_APP_URL: 'http://10.0.0.5' })
    expect(getPublicAppUrl()).toBe('https://metardu.space')
  })

  it('rejects non-https URLs and falls back to canonical', () => {
    withEnv({ NEXT_PUBLIC_APP_URL: 'http://metardu.space' })
    expect(getPublicAppUrl()).toBe('https://metardu.space')
  })

  it('rejects stale legacy hosts (duckdns / old vercel) that broke the sitemap', () => {
    withEnv({ NEXT_PUBLIC_APP_URL: 'https://metardu.duckdns.org' })
    expect(getPublicAppUrl()).toBe('https://metardu.space')
    withEnv({ NEXT_PUBLIC_APP_URL: 'https://geonova-henna.vercel.app' })
    expect(getPublicAppUrl()).toBe('https://metardu.space')
    withEnv({ NEXT_PUBLIC_APP_URL: 'https://metardu.vercel.app' })
    expect(getPublicAppUrl()).toBe('https://metardu.space')
  })

  it('does NOT reject live subdomains like staging.metardu.duckdns.org (exact-match only)', () => {
    // deploy-staging.yml deploys here — a subdomain-suffix check would break
    // staging exactly the way the stale host broke production.
    withEnv({ NEXT_PUBLIC_APP_URL: 'https://staging.metardu.duckdns.org' })
    expect(getPublicAppUrl()).toBe('https://staging.metardu.duckdns.org')
  })

  it('rejects VERCEL preview/production URLs when they are stale hosts', () => {
    withEnv({ VERCEL_URL: 'geonova-henna.vercel.app' })
    expect(getPublicAppUrl()).toBe('https://metardu.space')
  })

  it('normalizes a bare hostname to https and strips a trailing slash', () => {
    withEnv({ NEXT_PUBLIC_APP_URL: 'metardu.space/' })
    expect(getPublicAppUrl()).toBe('https://metardu.space')
  })
})
