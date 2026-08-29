import type { MetadataRoute } from 'next'
import { getPublicAppUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getPublicAppUrl()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          // AUDIT FIX (L-01, 2026-08-30): /admin removed — a robots.txt
          // Disallow entry advertises the admin path namespace to every
          // crawler and attacker who reads the file. The admin surface is
          // protected by authentication, not by obscurity, and gets no free
          // map entry.
          '/dashboard',
          '/settings',
          '/account',
          '/project/',
          '/fieldbook',
          '/map',
          '/notifications',
          '/audit-logs',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
