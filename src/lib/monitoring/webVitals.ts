/**
 * Web Vitals Monitoring for METARDU
 *
 * Reports Core Web Vitals (LCP, FID, CLS, TTFB, INP) using the
 * Next.js `useReportWebVitals` hook. Metrics are:
 *  - Logged to console in development
 *  - Sent to Sentry as breadcrumbs in production
 *  - Tracked with custom survey-specific metrics (map load, compute time)
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import { addBreadcrumb } from '@/lib/monitoring/sentry'
import { performanceMonitor } from '@/lib/performance/monitor'

// Define a local Metric type since next/web-vitals may not export it
export interface WebVitalMetric {
  id: string
  name: string
  value: number
  rating: string
  startTime: number
  navigationType?: string
}

// ─── Core Web Vital Reporting ──────────────────────────────────────────

const CORE_VITALS = new Set(['LCP', 'FID', 'CLS', 'TTFB', 'INP'])

/**
 * Process a Web Vital metric from Next.js's useReportWebVitals.
 *
 * - Core Web Vitals (LCP, FID, CLS, TTFB, INP) are reported to Sentry
 *   as breadcrumbs and logged in development.
 * - Custom metrics are also supported (see reportCustomMetric).
 */
export function reportWebVital(metric: WebVitalMetric): void {
  const { name, value, rating } = metric

  const isCoreVital = CORE_VITALS.has(name)

  // Console logging in development
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log(
      `[WebVitals] ${name}: ${value.toFixed(2)}ms (${rating})`
    )
  }

  // Send to Sentry as a breadcrumb (production only — addBreadcrumb
  // already guards internally, but we keep the conditional for clarity)
  if (isCoreVital) {
    addBreadcrumb({
      category: 'web-vital',
      message: `${name}: ${value.toFixed(2)}ms (${rating})`,
      level: rating === 'good' ? 'info' : rating === 'needs-improvement' ? 'warning' : 'error',
      data: {
        metricName: name,
        metricValue: Math.round(value * 100) / 100,
        metricRating: rating,
        url: typeof window !== 'undefined' ? window.location.href : '',
      },
    })
  }

  // Also store in the performance monitor for the in-app dashboard
  performanceMonitor.record(name, value, { rating: rating ?? 'unknown' })
}

// ─── Survey-Specific Custom Metrics ────────────────────────────────────

/**
 * Report a custom survey-specific metric (e.g., map load time, compute time).
 * These are tracked alongside Core Web Vitals for METARDU-specific
 * performance monitoring.
 */
export function reportCustomMetric(
  name: string,
  value: number,
  extra?: Record<string, string>
): void {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log(`[CustomMetric] ${name}: ${value.toFixed(2)}ms`, extra ?? '')
  }

  addBreadcrumb({
    category: 'custom-metric',
    message: `${name}: ${value.toFixed(2)}ms`,
    level: 'info',
    data: {
      metricName: name,
      metricValue: Math.round(value * 100) / 100,
      ...extra,
    },
  })

  // Store in performance monitor
  performanceMonitor.record(name, value, extra)
}

// ─── Metric Constants ──────────────────────────────────────────────────

/** Custom metric names for survey-specific operations */
export const SurveyMetrics = {
  /** Time to load the map tile layer and render initial viewport */
  MAP_LOAD: 'survey:map_load',
  /** Time to complete a traverse adjustment computation */
  COMPUTE_TRAVERSE: 'survey:compute_traverse',
  /** Time to complete a leveling computation */
  COMPUTE_LEVELING: 'survey:compute_leveling',
  /** Time to generate a PDF report */
  PDF_GENERATION: 'survey:pdf_generation',
  /** Time to export data to CSV/JSON/DXF */
  DATA_EXPORT: 'survey:data_export',
  /** Time for an instrument reading pull (Bluetooth/Serial) */
  INSTRUMENT_READ: 'survey:instrument_read',
  /** Time for offline sync of fieldbook data */
  OFFLINE_SYNC: 'survey:offline_sync',
  /** Time to process OCR import of field observations */
  OCR_IMPORT: 'survey:ocr_import',
} as const

export type SurveyMetricName = (typeof SurveyMetrics)[keyof typeof SurveyMetrics]

// ─── Timing Helper ─────────────────────────────────────────────────────

/**
 * Measure the duration of an async operation and report it as a custom metric.
 *
 * @example
 * ```ts
 * const result = await measureMetric(SurveyMetrics.COMPUTE_TRAVERSE, async () => {
 *   return bowditchAdjustment(observations)
 * })
 * ```
 */
export async function measureMetric<T>(
  metricName: string,
  fn: () => Promise<T>,
  extra?: Record<string, string>
): Promise<T> {
  const start = performance.now()
  try {
    const result = await fn()
    const duration = performance.now() - start
    reportCustomMetric(metricName, duration, extra)
    return result
  } catch (error) {
    const duration = performance.now() - start
    reportCustomMetric(`${metricName}:error`, duration, {
      ...extra,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Measure the duration of a synchronous operation and report it as a custom metric.
 */
export function measureMetricSync<T>(
  metricName: string,
  fn: () => T,
  extra?: Record<string, string>
): T {
  const start = performance.now()
  try {
    const result = fn()
    const duration = performance.now() - start
    reportCustomMetric(metricName, duration, extra)
    return result
  } catch (error) {
    const duration = performance.now() - start
    reportCustomMetric(`${metricName}:error`, duration, {
      ...extra,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
