import type { MetadataRoute } from 'next'
import { getPublicAppUrl } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getPublicAppUrl()

  // NOTE: keep this list aligned with app/robots.ts — any route listed here
  // must NOT be disallowed there (Google ignores them, but it's inconsistent).
  const routes = [
    '',
    '/login',
    '/register',
    '/pricing',
    '/community',
    '/help',
    '/cadastral-workflow',
    '/tools/topology-check',
    '/tools/subdivision-generator',
    '/tools/cogo-reconstruct',
    '/tools/as-built-deviation',
    '/tools/scale-factor',
    '/tools/site-calibration',
    '/tools/orthometric-height',
    '/tools/volume-comparison',
    '/tools/lsa',
    '/tools/road-design',
    '/tools/cut-fill',
    '/tools/pile-grid',
    '/tools/machine-control',
    '/tools/progress-monitor',
    '/tools/statutory-workbook',
    '/tools/survey-plan-demo',
    '/tools/billable-documents',
    '/tools/cassini-utm',
    '/tools/level-book',
    '/tools/traverse-field-book',
    '/tools/point-cloud-import',
    '/tools/orthophoto-viewer',
    '/engineering-workflow',
    '/topographic-workflow',
    '/tools/all',
    '/tools/cogo',
    '/tools/traverse',
    '/tools/leveling',
    '/tools/coordinates',
    '/tools/area',
    '/tools/distance',
    '/tools/bearing',
    '/tools/curves',
    '/tools/deformation',
    '/tools/gcp-optimizer',
    '/field-records',
    '/report-templates',
    '/sectional',
    '/marketplace',
    '/beacons',
    '/analytics',
    '/docs',
    '/docs/quick-start',
    '/docs/first-plan',
  ]

  const seen = new Set<string>()
  const uniqueRoutes = routes.filter(route => {
    if (seen.has(route)) return false
    seen.add(route)
    return true
  })

  return uniqueRoutes.map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'daily' : 'weekly',
    priority: route === '' ? 1.0 : route.startsWith('/tools') ? 0.7 : 0.8,
  }))
}
