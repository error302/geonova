'use client'

import { useReportWebVitals } from 'next/web-vitals'
import { reportWebVital, type WebVitalMetric } from '@/lib/monitoring/webVitals'

/**
 * WebVitals Reporter Component
 *
 * Next.js convention: place this file as `web-vitals.tsx` in the app
 * directory and import it from the root layout. The `useReportWebVitals`
 * hook automatically captures Core Web Vitals metrics as the user
 * navigates the application.
 *
 * This component renders nothing — it only captures and reports metrics.
 */
export function WebVitals() {
  useReportWebVitals((metric: WebVitalMetric) => {
    reportWebVital(metric)
  })

  return null
}

export default WebVitals
