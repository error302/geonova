'use client'

import { AlertTriangle, Shield, Eye, TrendingUp, Clock, MapPin } from 'lucide-react'
import type { SafetyScanResult, SafetyStats } from '@/lib/compute/safety'

interface SafetyDashboardProps {
  stats: SafetyStats
  recentScans: SafetyScanResult[]
}

export default function SafetyDashboard({ stats, recentScans }: SafetyDashboardProps) {
  const riskColor = (score: number) => {
    if (score >= 75) return 'text-red-500'
    if (score >= 50) return 'text-orange-500'
    if (score >= 25) return 'text-yellow-500'
    return 'text-green-500'
  }

  const riskBg = (score: number) => {
    if (score >= 75) return 'bg-red-500'
    if (score >= 50) return 'bg-orange-500'
    if (score >= 25) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-[var(--text-muted)]">Total Scans</span>
          </div>
          <p className="text-2xl font-bold">{stats.total_scans}</p>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-[var(--text-muted)]">Critical Hazards</span>
          </div>
          <p className="text-2xl font-bold text-red-500">{stats.critical_hazards}</p>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-[var(--text-muted)]">High Hazards</span>
          </div>
          <p className="text-2xl font-bold text-orange-500">{stats.high_hazards}</p>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-xs text-[var(--text-muted)]">Avg Risk Score</span>
          </div>
          <p className={`text-2xl font-bold ${riskColor(stats.avg_risk_score)}`}>
            {stats.avg_risk_score.toFixed(1)}
          </p>
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-4">Hazard Distribution</h3>
        <div className="flex gap-2">
          <div className="flex-1 bg-red-500/20 rounded p-2 text-center">
            <p className="text-lg font-bold text-red-500">{stats.critical_hazards}</p>
            <p className="text-xs text-[var(--text-muted)]">Critical</p>
          </div>
          <div className="flex-1 bg-orange-500/20 rounded p-2 text-center">
            <p className="text-lg font-bold text-orange-500">{stats.high_hazards}</p>
            <p className="text-xs text-[var(--text-muted)]">High</p>
          </div>
          <div className="flex-1 bg-yellow-500/20 rounded p-2 text-center">
            <p className="text-lg font-bold text-yellow-500">{stats.medium_hazards}</p>
            <p className="text-xs text-[var(--text-muted)]">Medium</p>
          </div>
          <div className="flex-1 bg-green-500/20 rounded p-2 text-center">
            <p className="text-lg font-bold text-green-500">{stats.low_hazards}</p>
            <p className="text-xs text-[var(--text-muted)]">Low</p>
          </div>
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-4">Recent Scans</h3>
        {recentScans.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">No scans yet</p>
        ) : (
          <div className="space-y-3">
            {recentScans.map((scan) => (
              <div
                key={scan.id}
                className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${riskBg(scan.risk_score)}`} />
                  <div>
                    <p className="text-sm font-medium capitalize">{scan.scan_type} Scan</p>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <Clock className="h-3 w-3" />
                      {new Date(scan.scanned_at).toLocaleString()}
                      {scan.location && (
                        <>
                          <MapPin className="h-3 w-3" />
                          {scan.location.easting.toFixed(0)}, {scan.location.northing.toFixed(0)}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${riskColor(scan.risk_score)}`}>
                    {scan.risk_score}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] capitalize">{scan.risk_level}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {stats.last_scan_at && (
        <div className="text-xs text-[var(--text-muted)]">
          Last scan: {new Date(stats.last_scan_at).toLocaleString()}
        </div>
      )}
    </div>
  )
}
