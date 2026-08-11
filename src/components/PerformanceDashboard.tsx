'use client';
/**
 * Performance Dashboard Component
 * Admin panel for monitoring and optimizing application performance
 */


import { useState, useEffect } from 'react'
import { performanceMonitor } from '@/lib/performance/monitor'
import { PERFORMANCE_BUDGETS } from '@/lib/performance/config'
import { logger } from '@/lib/logger'

interface PerformanceReport {
  webVitals?: {
    FCP?: number
    LCP?: number
    FID?: number
    CLS?: number
    TTFB?: number
  }
  customMetrics?: Record<string, number>
  errors?: { message: string; timestamp: number }[]
}

export default function PerformanceDashboard() {
  const [report, setReport] = useState<PerformanceReport | null>(null)
  const [dbStats, setDbStats] = useState<Record<string, { avg: number; count: number }>>({})
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizationResult, setOptimizationResult] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadStats = () => {
    setReport(performanceMonitor.getReport())
    // In real implementation, fetch from server
    setDbStats({})
  }

  const runOptimization = async () => {
    setIsOptimizing(true)
    try {
      const res = await fetch('/api/admin/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'full_optimization' }),
      })
      const result = (await res.json()) as Record<string, unknown>
      setOptimizationResult(result)
    } catch (error) {
      logger.error('Optimization failed:', { error: error })
    } finally {
      setIsOptimizing(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500'
    if (score >= 70) return 'text-yellow-500'
    return 'text-red-500'
  }

  const score = performanceMonitor.getScore()

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Performance Dashboard</h1>

        {/* Score Card */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Performance Score</h2>
              <p className="text-gray-400">Based on Web Vitals and custom metrics</p>
            </div>
            <div className={`text-5xl font-bold ${getScoreColor(score)}`}>
              {score}
            </div>
          </div>
        </div>

        {/* Web Vitals */}
        {report?.webVitals && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Web Vitals</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(report.webVitals).map(([name, value]) => {
                const budget = PERFORMANCE_BUDGETS[name as keyof typeof PERFORMANCE_BUDGETS]
                const isGood = budget && (value as number) < budget
                return (
                  <div key={name} className="bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-400 uppercase">{name}</p>
                    <p className={`text-2xl font-bold ${isGood ? 'text-green-400' : 'text-red-400'}`}>
                      {name === 'CLS' ? (value as number).toFixed(3) : `${(value as number).toFixed(0)}ms`}
                    </p>
                    <p className="text-xs text-gray-500">
                      Budget: {name === 'CLS' ? budget : `${budget}ms`}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Custom Metrics */}
        {report?.customMetrics && Object.keys(report.customMetrics).length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">API Performance</h2>
            <div className="space-y-2">
              {Object.entries(report.customMetrics).map(([name, value]) => (
                <div key={name} className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-300">{name}</span>
                  <span className="font-mono text-blue-400">{(value as number).toFixed(2)}ms</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Database Stats */}
        {Object.keys(dbStats).length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Database Performance</h2>
            <div className="space-y-2">
              {Object.entries(dbStats).map(([query, stats]) => (
                <div key={query} className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-300 font-mono text-sm">{query}</span>
                  <div className="text-right">
                    <span className="font-mono text-blue-400">{stats.avg.toFixed(2)}ms</span>
                    <span className="text-gray-500 text-sm ml-2">({stats.count} queries)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Optimization Actions */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Optimization Actions</h2>
          <div className="flex gap-4">
            <button
              onClick={runOptimization}
              disabled={isOptimizing}
              className="px-6 py-3 bg-blue-600 rounded-lg font-semibold disabled:opacity-50"
            >
              {isOptimizing ? 'Running...' : 'Run Full Optimization'}
            </button>
            <button
              onClick={() => performanceMonitor.clearStats()}
              className="px-6 py-3 bg-gray-700 rounded-lg font-semibold"
            >
              Clear Stats
            </button>
          </div>

          {optimizationResult && (
            <div className="mt-4 p-4 bg-gray-700 rounded-lg">
              <h3 className="font-semibold mb-2">Optimization Result</h3>
              <pre className="text-sm text-green-400 overflow-auto">
                {JSON.stringify(optimizationResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Errors */}
        {report?.errors && report.errors.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 text-red-400">Recent Errors ({report.errors.length})</h2>
            <div className="space-y-2 max-h-64 overflow-auto">
              {report.errors.map((error, idx) => (
                <div key={`${error}-${idx}`} className="p-3 bg-red-900/30 rounded-lg text-sm">
                  <p className="text-red-300">{error.message}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    {new Date(error.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
