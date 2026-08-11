/**
 * Performance Monitoring for METARDU
 * Track and report performance metrics
 */

interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  tags?: Record<string, string>
}

interface PerformanceReport {
  webVitals: WebVitalsReport
  customMetrics: Record<string, number>
  errors: ErrorReport[]
}

interface WebVitalsReport {
  FCP?: number // First Contentful Paint
  LCP?: number // Largest Contentful Paint
  FID?: number // First Input Delay
  CLS?: number // Cumulative Layout Shift
  TTFB?: number // Time to First Byte
}

interface ErrorReport {
  message: string
  stack?: string
  timestamp: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private errors: ErrorReport[] = []
  private isReporting = false
  private reportInterval: NodeJS.Timeout | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.initWebVitals()
      this.initErrorTracking()
    }
  }

  private initWebVitals(): void {
    // Listen for web vitals
    if ('PerformanceObserver' in window) {
      // LCP
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        this.record('LCP', lastEntry.startTime)
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

      // FID
      const fidObserver = new PerformanceObserver((list) => {
        const firstEntry = list.getEntries()[0]
        if (firstEntry) {
          this.record('FID', (firstEntry as PerformanceEventTiming).processingStart - firstEntry.startTime)
        }
      })
      fidObserver.observe({ entryTypes: ['first-input'] })

      // CLS
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const clsEntry = entry as { hadRecentInput?: boolean; value?: number }
          if (!clsEntry.hadRecentInput) {
            clsValue += clsEntry.value ?? 0
          }
        }
        this.record('CLS', clsValue)
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })
    }

    // FCP from timing API
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByName('first-contentful-paint')[0] as PerformanceEntry
        if (perfData) {
          this.record('FCP', perfData.startTime)
        }

        // TTFB
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        if (navigation) {
          this.record('TTFB', navigation.responseStart - navigation.startTime)
        }
      }, 0)
    })
  }

  private initErrorTracking(): void {
    window.addEventListener('error', (e) => {
      this.trackError(e.message, e.error instanceof Error ? e.error.stack : undefined)
    })

    window.addEventListener('unhandledrejection', (e) => {
      this.trackError(String(e.reason), undefined)
    })
  }

  // Record a metric
  record(name: string, value: number, tags?: Record<string, string>): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      tags,
    })

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }

    // Log slow metrics in development
    if (process.env.NODE_ENV === 'development' && value > 1000) {
      console.warn(`[Performance] Slow ${name}: ${value.toFixed(2)}ms`)
    }
  }

  // Track API call performance
  async trackApiCall<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    try {
      const result = await fn()
      this.record(`api.${name}`, performance.now() - start)
      return result
    } catch (error) {
      this.record(`api.${name}.error`, performance.now() - start)
      throw error
    }
  }

  // Track component render time
  trackRender(componentName: string): () => void {
    const start = performance.now()
    return () => {
      this.record(`render.${componentName}`, performance.now() - start)
    }
  }

  // Track error
  trackError(message: string, stack?: string): void {
    this.errors.push({
      message,
      stack,
      timestamp: Date.now(),
    })

    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100)
    }
  }

  // Get current metrics
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  // Get errors
  getErrors(): ErrorReport[] {
    return [...this.errors]
  }

  // Get summary report
  getReport(): PerformanceReport {
    const webVitals: WebVitalsReport = {}
    const customMetrics: Record<string, number> = {}

    // Group metrics by name and get average
    const grouped = this.groupByName(this.metrics)
    
    for (const [name, values] of Object.entries(grouped)) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      
      if (['FCP', 'LCP', 'FID', 'CLS', 'TTFB'].includes(name)) {
        webVitals[name as keyof WebVitalsReport] = avg
      } else {
        customMetrics[name] = avg
      }
    }

    return {
      webVitals,
      customMetrics,
      errors: this.errors.slice(-10), // Last 10 errors
    }
  }

  private groupByName(metrics: PerformanceMetric[]): Record<string, number[]> {
    return metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) acc[metric.name] = []
      acc[metric.name].push(metric.value)
      return acc
    }, {} as Record<string, number[]>)
  }

  // Start auto-reporting
  startReporting(intervalMs = 60000): void {
    if (this.reportInterval) return

    this.reportInterval = setInterval(() => {
      this.sendReport()
    }, intervalMs)
  }

  // Stop auto-reporting
  stopReporting(): void {
    if (this.reportInterval) {
      clearInterval(this.reportInterval)
      this.reportInterval = null
    }
  }

  // Send report to analytics
  private async sendReport(): Promise<void> {
    if (this.isReporting) return
    this.isReporting = true

    try {
      const report = this.getReport()
      
      // Send to analytics endpoint
      await fetch('/api/analytics/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      })

      // Clear sent metrics
      this.metrics = []
      this.errors = []
    } catch {
      // Silently fail
    } finally {
      this.isReporting = false
    }
  }

  // Get performance score
  getScore(): number {
    const report = this.getReport()
    let score = 100

    // Deduct for poor web vitals
    if (report.webVitals.LCP && report.webVitals.LCP > 2500) score -= 20
    if (report.webVitals.FID && report.webVitals.FID > 100) score -= 20
    if (report.webVitals.CLS && report.webVitals.CLS > 0.1) score -= 20
    if (report.webVitals.FCP && report.webVitals.FCP > 1800) score -= 10
    if (report.webVitals.TTFB && report.webVitals.TTFB > 600) score -= 10

    // Deduct for errors
    score -= Math.min(20, this.errors.length * 2)

    return Math.max(0, score)
  }

  // Clear all collected stats
  clearStats(): void {
    this.metrics = []
    this.errors = []
  }
}

// Hook for React components
export function usePerformanceTrack(componentName: string): void {
  if (typeof window === 'undefined') return

  const endTrack = performanceMonitor.trackRender(componentName)

  try {
    // Schedule cleanup — this is a best-effort hook without useEffect
    // Consumers should call endTrack() manually or wrap in useEffect
  } catch {
    endTrack()
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()
export default performanceMonitor
