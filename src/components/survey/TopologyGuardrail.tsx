'use client'

/**
 * TopologyGuardrail — Real-time topology validation UI for cadastral surveys
 *
 * Displays topology issues as they're detected during parcel drawing.
 * Shows:
 * - Error count and warning count badges
 * - Expandable list of issues with severity colors
 * - Map highlight integration (passes issue coordinates back to parent)
 *
 * Integrates with:
 * - lib/survey/topologyChecker.ts (the validation engine)
 * - Map drawing interactions (parent passes drawn vertices)
 * - Existing parcel data (parent passes neighboring parcels)
 */

import { useState, useEffect, useMemo } from 'react'
import {
  AlertTriangle, AlertCircle, Info,
  ChevronDown, ChevronUp, ShieldAlert, ShieldCheck,
} from 'lucide-react'
import {
  runTopologyCheck,
  type TopologyIssue,
  type TopologyCheckResult,
  type ExistingParcel,
  type RoadReserve,
} from '@/lib/survey/topologyChecker'
import type { SurveyPoint } from '@/lib/map/turfHelpers'
import { logger } from '@/lib/logger'

interface TopologyGuardrailProps {
  /** Vertices of the parcel currently being drawn/edited */
  vertices: SurveyPoint[]
  /** Existing neighboring parcels to check against */
  existingParcels?: ExistingParcel[]
  /** Road reserves to check encroachment against */
  roadReserves?: RoadReserve[]
  /** Beacon positions (for duplicate detection) */
  beacons?: SurveyPoint[]
  /** Called when issues are detected — parent can highlight on map */
  onIssuesChange?: (issues: TopologyIssue[]) => void
  /** Whether to show the panel expanded by default */
  defaultExpanded?: boolean
  /** Compact mode (for inline display) */
  compact?: boolean
}

const SEVERITY_CONFIG = {
  error: {
    icon: AlertCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    label: 'Error',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    label: 'Warning',
  },
  info: {
    icon: Info,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    label: 'Info',
  },
}

const ISSUE_TYPE_LABELS: Record<string, string> = {
  overlap: 'Parcel Overlap',
  sliver: 'Sliver Gap',
  self_intersection: 'Self-Intersection',
  road_encroachment: 'Road Reserve',
  duplicate_beacon: 'Duplicate Beacon',
  unclosed_polygon: 'Unclosed Polygon',
  insufficient_vertices: 'Insufficient Vertices',
}

export function TopologyGuardrail({
  vertices,
  existingParcels = [],
  roadReserves = [],
  beacons = [],
  onIssuesChange,
  defaultExpanded = true,
  compact = false,
}: TopologyGuardrailProps) {
  const [result, setResult] = useState<TopologyCheckResult | null>(null)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [checking, setChecking] = useState(false)

  // Run topology check when vertices change (debounced)
  useEffect(() => {
    if (vertices.length < 2) {
      setResult(null)
      onIssuesChange?.([])
      return
    }

    setChecking(true)
    const timer = setTimeout(async () => {
      try {
        const checkResult = await runTopologyCheck({
          newVertices: vertices,
          existingParcels,
          roadReserves,
          beacons,
        })
        setResult(checkResult)
        onIssuesChange?.(checkResult.issues)
      } catch (err) {
        logger.error('[TopologyGuardrail] Check failed:', { error: err })
      } finally {
        setChecking(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [vertices, existingParcels, roadReserves, beacons, onIssuesChange])

  const errorCount = useMemo(
    () => result?.issues.filter(i => i.severity === 'error').length ?? 0,
    [result]
  )
  const warningCount = useMemo(
    () => result?.issues.filter(i => i.severity === 'warning').length ?? 0,
    [result]
  )

  // Don't render if no vertices or all clear
  if (vertices.length < 2) {
    return null
  }

  if (result && result.issues.length === 0 && !checking) {
    return (
      <div className={`rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 ${compact ? '' : 'p-4'}`}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-sm text-emerald-400 font-medium">Topology Valid</span>
        </div>
        {!compact && (
          <p className="text-[11px] text-emerald-400/70 mt-1">
            No overlaps, slivers, or encroachments detected. Safe for registry submission.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={`rounded-xl border ${errorCount > 0 ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          {errorCount > 0 ? (
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span className={`text-sm font-medium ${errorCount > 0 ? 'text-red-400' : 'text-amber-400'}`}>
            Topology Issues
          </span>
          {checking && (
            <span className="text-[10px] text-gray-500 animate-pulse">checking...</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {errorCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/30">
              <AlertCircle className="w-3 h-3" />
              {errorCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <AlertTriangle className="w-3 h-3" />
              {warningCount}
            </span>
          )}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
        </div>
      </button>

      {/* Issue list */}
      {expanded && result && (
        <div className="border-t border-white/[0.06] max-h-[300px] overflow-y-auto">
          {result.issues.map((issue, idx) => {
            const cfg = SEVERITY_CONFIG[issue.severity]
            const Icon = cfg.icon
            return (
              <div
                key={issue.id || idx}
                className={`px-3 py-2.5 border-b border-white/[0.04] last:border-b-0 ${cfg.bg}`}
              >
                <div className="flex items-start gap-2">
                  <Icon className={`w-3.5 h-3.5 ${cfg.color} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${cfg.color}`}>
                        {ISSUE_TYPE_LABELS[issue.type] || issue.type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 mt-0.5">{issue.message}</p>
                    {issue.details && (
                      <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{issue.details}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer summary */}
      {!compact && expanded && result && (
        <div className="px-3 py-2 border-t border-white/[0.06] bg-[#0d0d14]/40">
          <p className="text-[10px] text-gray-500">
            {result.isValid
              ? 'No blocking errors — parcel can be saved.'
              : `${errorCount} error(s) must be fixed before registry submission.`}
          </p>
        </div>
      )}
    </div>
  )
}
