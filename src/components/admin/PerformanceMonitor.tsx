'use client'

/**
 * PerformanceMonitor — Core Web Vitals tracking for admins
 *
 * Tracks:
 * - LCP (Largest Contentful Paint)
 * - FID/INP (First Input Delay / Interaction to Next Paint)
 * - CLS (Cumulative Layout Shift)
 * - TTFB (Time to First Byte)
 * - FC (Fetch Count)
 *
 * Sends metrics to /api/admin/performance for aggregation
 * Only active for admin users to avoid overhead for regular users.
 */

import { useEffect, useState, useCallback } from 'react'
import { Activity, Gauge, Zap, Clock, AlertTriangle } from 'lucide-react'
import { logger } from '@/lib/logger'

interface WebVital {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  label: string
  unit: string
  icon: typeof Activity
}

const VITAL_THRESHOLDS: Record<string, { good: number; poor: number; label: string; unit: string; icon: typeof Activity }> = {
  LCP: { good: 2500, poor: 4000, label: 'Largest Contentful Paint', unit: 'ms', icon: Gauge },
  FID: { good: 100, poor: 300, label: 'First Input Delay', unit: 'ms', icon: Zap },
  INP: { good: 200, poor: 500, label: 'Interaction to Next Paint', unit: 'ms', icon: Zap },
  CLS: { good: 0.1, poor: 0.25, label: 'Cumulative Layout Shift', unit: '', icon: Activity },
  TTFB: { good: 800, poor: 1800, label: 'Time to First Byte', unit: 'ms', icon: Clock },
}

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = VITAL_THRESHOLDS[name]
  if (!thresholds) return 'good'
  if (value <= thresholds.good) return 'good'
  if (value >= thresholds.poor) return 'poor'
  return 'needs-improvement'
}

const RATING_COLORS: Record<string, string> = {
  good: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  'needs-improvement': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  poor: 'text-red-400 bg-red-500/10 border-red-500/30',
}

export function PerformanceMonitor({ visible = false }: { visible?: boolean }) {
  const [vitals, setVitals] = useState<WebVital[]>([])
  const [fetchCount, setFetchCount] = useState(0)

  // Track Core Web Vitals
  useEffect(() => {
    if (!visible) return

    // Use Performance Observer API
    const observers: PerformanceObserver[] = []

    try {
      // LCP
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        if (lastEntry) {
          const value = lastEntry.startTime
          setVitals(prev => [
            ...prev.filter(v => v.name !== 'LCP'),
            { name: 'LCP', value, rating: getRating('LCP', value), label: VITAL_THRESHOLDS.LCP.label, unit: VITAL_THRESHOLDS.LCP.unit, icon: VITAL_THRESHOLDS.LCP.icon },
          ])
        }
      })
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
      observers.push(lcpObserver)

      // FID / INP
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const value = (entry as PerformanceEventTiming).processingStart - entry.startTime
          const name = 'INP'
          setVitals(prev => [
            ...prev.filter(v => v.name !== name),
            { name, value, rating: getRating(name, value), label: VITAL_THRESHOLDS[name].label, unit: VITAL_THRESHOLDS[name].unit, icon: VITAL_THRESHOLDS[name].icon },
          ])
        }
      })
      fidObserver.observe({ type: 'first-input', buffered: true })
      observers.push(fidObserver)

      // CLS
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as unknown as { hadRecentInput: boolean }).hadRecentInput) {
            clsValue += (entry as unknown as { value: number }).value
          }
        }
        setVitals(prev => [
          ...prev.filter(v => v.name !== 'CLS'),
          { name: 'CLS', value: clsValue, rating: getRating('CLS', clsValue), label: VITAL_THRESHOLDS.CLS.label, unit: VITAL_THRESHOLDS.CLS.unit, icon: VITAL_THRESHOLDS.CLS.icon },
        ])
      })
      clsObserver.observe({ type: 'layout-shift', buffered: true })
      observers.push(clsObserver)

      // TTFB
      const navEntries = performance.getEntriesByType('navigation')
      if (navEntries.length > 0) {
        const navEntry = navEntries[0] as PerformanceNavigationTiming
        const value = navEntry.responseStart - navEntry.requestStart
        setVitals(prev => [
          ...prev.filter(v => v.name !== 'TTFB'),
          { name: 'TTFB', value, rating: getRating('TTFB', value), label: VITAL_THRESHOLDS.TTFB.label, unit: VITAL_THRESHOLDS.TTFB.unit, icon: VITAL_THRESHOLDS.TTFB.icon },
        ])
      }
    } catch (err) {
      logger.warn('[PerformanceMonitor] Observer error:', { error: err })
    }

    // Track fetch count
    const originalFetch = window.fetch
    window.fetch = function (...args) {
      setFetchCount(prev => prev + 1)
      return originalFetch.apply(this, args)
    }

    return () => {
      observers.forEach(o => o.disconnect())
      window.fetch = originalFetch
    }
  }, [visible])

  // Send metrics to server (debounced)
  const sendMetrics = useCallback(async () => {
    if (vitals.length === 0) return
    try {
      await fetch('/api/admin/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vitals: vitals.map(v => ({ name: v.name, value: v.value })),
          url: window.location.pathname,
          timestamp: Date.now(),
        }),
      }).catch(() => {}) // Silent fail
    } catch {}
  }, [vitals])

  useEffect(() => {
    if (!visible || vitals.length === 0) return
    const timer = setTimeout(sendMetrics, 5000)
    return () => clearTimeout(timer)
  }, [vitals, visible, sendMetrics])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 right-4 z-[999] bg-[#0d0d14]/95 backdrop-blur-xl border border-white/[0.1] rounded-xl shadow-2xl p-3 w-[280px]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Performance</span>
        </div>
        <span className="text-[9px] text-gray-500">{fetchCount} requests</span>
      </div>

      <div className="space-y-1.5">
        {vitals.map(vital => {
          const Icon = vital.icon
          return (
            <div key={vital.name} className="flex items-center gap-2">
              <div className={`shrink-0 w-6 h-6 rounded flex items-center justify-center ${RATING_COLORS[vital.rating]}`}>
                <Icon className="w-3 h-3" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">{vital.name}</span>
                  <span className={`text-[10px] font-mono font-bold ${
                    vital.rating === 'good' ? 'text-emerald-400' :
                    vital.rating === 'poor' ? 'text-red-400' : 'text-amber-400'
                  }`}>
                    {vital.value.toFixed(vital.unit === '' ? 3 : 0)}{vital.unit}
                  </span>
                </div>
                <div className="text-[8px] text-gray-600">{vital.label}</div>
              </div>
            </div>
          )
        })}

        {vitals.length === 0 && (
          <div className="flex items-center justify-center py-3">
            <AlertTriangle className="w-4 h-4 text-gray-600 mr-1" />
            <span className="text-[10px] text-gray-600">Collecting metrics...</span>
          </div>
        )}
      </div>
    </div>
  )
}
