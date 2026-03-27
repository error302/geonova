'use client'

import { AlertTriangle, CheckCircle, XCircle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { SafetyScanResult, SafetyHazard } from '@/lib/compute/safety'

interface RiskAnalyzerProps {
  scanResult: SafetyScanResult
}

export default function RiskAnalyzer({ scanResult }: RiskAnalyzerProps) {
  const [expandedHazard, setExpandedHazard] = useState<string | null>(null)

  const severityConfig: Record<string, { color: string; bg: string; icon: typeof AlertTriangle }> = {
    critical: { color: 'text-red-500', bg: 'bg-red-500', icon: XCircle },
    high: { color: 'text-orange-500', bg: 'bg-orange-500', icon: AlertTriangle },
    medium: { color: 'text-yellow-500', bg: 'bg-yellow-500', icon: Info },
    low: { color: 'text-green-500', bg: 'bg-green-500', icon: CheckCircle }
  }

  const getRiskLevel = (score: number) => {
    if (score >= 75) return 'critical'
    if (score >= 50) return 'high'
    if (score >= 25) return 'medium'
    return 'low'
  }

  const riskLevel = getRiskLevel(scanResult.risk_score)
  const config = severityConfig[riskLevel]

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Risk Assessment</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.color} ${config.bg}/10 border ${config.color.replace('text', 'border')}`}>
            {riskLevel.toUpperCase()}
          </span>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--text-muted)]">Risk Score</span>
            <span className={`text-2xl font-bold ${config.color}`}>{scanResult.risk_score}</span>
          </div>
          <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div
              className={`h-full ${config.bg} transition-all duration-500`}
              style={{ width: `${scanResult.risk_score}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-[var(--text-muted)]">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>

        <div className="text-sm">
          <p className="text-[var(--text-muted)] mb-2">Scan Type: <span className="capitalize text-[var(--text-primary)]">{scanResult.scan_type}</span></p>
          <p className="text-[var(--text-muted)]">Scanned: <span className="text-[var(--text-primary)]">{new Date(scanResult.scanned_at).toLocaleString()}</span></p>
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-4">Detected Hazards ({scanResult.hazards.length})</h3>
        
        {scanResult.hazards.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
            <p className="text-sm text-[var(--text-muted)]">No hazards detected</p>
          </div>
        ) : (
          <div className="space-y-2">
            {scanResult.hazards.map((hazard) => (
              <HazardItem
                key={hazard.id}
                hazard={hazard}
                isExpanded={expandedHazard === hazard.id}
                onToggle={() => setExpandedHazard(expandedHazard === hazard.id ? null : hazard.id)}
              />
            ))}
          </div>
        )}
      </div>

      {scanResult.recommendations.length > 0 && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-4">Recommendations</h3>
          <ul className="space-y-2">
            {scanResult.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

interface HazardItemProps {
  hazard: SafetyHazard
  isExpanded: boolean
  onToggle: () => void
}

function HazardItem({ hazard, isExpanded, onToggle }: HazardItemProps) {
  const severityConfig: Record<string, { color: string; bg: string; icon: typeof AlertTriangle }> = {
    critical: { color: 'text-red-500', bg: 'bg-red-500', icon: XCircle },
    high: { color: 'text-orange-500', bg: 'bg-orange-500', icon: AlertTriangle },
    medium: { color: 'text-yellow-500', bg: 'bg-yellow-500', icon: Info },
    low: { color: 'text-green-500', bg: 'bg-green-500', icon: CheckCircle }
  }

  const config = severityConfig[hazard.severity] || severityConfig.low
  const Icon = config.icon

  return (
    <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 ${config.color}`} />
          <div className="text-left">
            <p className="text-sm font-medium capitalize">{hazard.type}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {(hazard.confidence * 100).toFixed(0)}% confidence
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-[var(--border-color)]">
          <p className="mt-3 text-sm">{hazard.description}</p>
          {hazard.location && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Location: E {hazard.location.easting.toFixed(2)}, N {hazard.location.northing.toFixed(2)}
            </p>
          )}
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Detected: {new Date(hazard.detected_at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
}
