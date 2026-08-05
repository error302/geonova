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
          '/admin/',
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
