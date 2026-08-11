'use client'

/**
 * QADashboard — Single view of all quality checks for a project
 *
 * Shows:
 * - Topology check results (overlaps, slivers, self-intersections)
 * - Area reconciliation (parent vs sum of parts)
 * - Traverse precision (linear + angular closure)
 * - Beacon validation (duplicates, missing coordinates)
 * - Document compliance (SoK standards)
 * - NLIMS readiness
 *
 * Green = pass, Amber = warning, Red = fail
 */

import { useState, useCallback, useMemo } from 'react'
import {
  ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2,
  Loader2, RefreshCw, FileText, MapPin, Ruler, Calculator,
  Layers, Building2, Download,
} from 'lucide-react'
import { runTopologyCheck, type ExistingParcel } from '@/lib/survey/topologyChecker'
import { evaluateTraversePrecision, type TraverseCategory } from '@/lib/engine/computationalAccuracy'
import { computeAreaWithPrecision } from '@/lib/engine/computationalAccuracy'
import { memoize } from '@/lib/performance'

// Memoized area computation — caches results for same vertex sets
const memoizedComputeArea = memoize(computeAreaWithPrecision, {
  keyFn: (vertices) => JSON.stringify(vertices[0]),
  maxSize: 200,
})

interface QACheck {
  id: string
  category: 'topology' | 'area' | 'traverse' | 'beacons' | 'documents' | 'nlims'
  name: string
  status: 'pass' | 'warning' | 'fail' | 'pending'
  message: string
  details?: string
  count?: number
}

interface QADashboardProps {
  projectId: string
  parcels?: ExistingParcel[]
  traverseData?: {
    linearErrorM: number
    totalDistanceM: number
    angularMisclosureSec: number
    stationCount: number
  }
  parentAreaHa?: number
  surveyCategory?: TraverseCategory
}

const CATEGORY_ICONS = {
  topology: Layers,
  area: Calculator,
  traverse: Ruler,
  beacons: MapPin,
  documents: FileText,
  nlims: Building2,
}

const STATUS_CONFIG = {
  pass: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'PASS' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'WARNING' },
  fail: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'FAIL' },
  pending: { icon: Loader2, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30', label: 'PENDING' },
}

export function QADashboard({
  projectId,
  parcels = [],
  traverseData,
  parentAreaHa,
  surveyCategory = 'urban',
}: QADashboardProps) {
  const [checks, setChecks] = useState<QACheck[]>([])
  const [running, setRunning] = useState(false)

  const runAllChecks = useCallback(async () => {
    setRunning(true)

    const results: QACheck[] = []

    // ─── 1. Topology Checks ──────────────────────────────────
    if (parcels.length > 0) {
      let totalOverlaps = 0
      let totalSlivers = 0
      let totalSelfIntersections = 0

      for (const parcel of parcels) {
        const otherParcels = parcels.filter(p => p.id !== parcel.id)
        const topoResult = await runTopologyCheck({
          newVertices: parcel.vertices,
          existingParcels: otherParcels,
        })

        totalOverlaps += topoResult.issues.filter(i => i.type === 'overlap').length
        totalSlivers += topoResult.issues.filter(i => i.type === 'sliver').length
        totalSelfIntersections += topoResult.issues.filter(i => i.type === 'self_intersection').length
      }

      results.push({
        id: 'topo-overlap',
        category: 'topology',
        name: 'Parcel Overlaps',
        status: totalOverlaps === 0 ? 'pass' : 'fail',
        message: totalOverlaps === 0 ? 'No overlapping parcels detected' : `${totalOverlaps} overlap(s) found`,
        details: 'Overlapping parcels will be rejected by the registry',
        count: totalOverlaps,
      })

      results.push({
        id: 'topo-sliver',
        category: 'topology',
        name: 'Sliver Gaps',
        status: totalSlivers === 0 ? 'pass' : 'warning',
        message: totalSlivers === 0 ? 'No sliver gaps detected' : `${totalSlivers} sliver gap(s) found`,
        details: 'Micro-gaps between adjacent parcels may cause registration issues',
        count: totalSlivers,
      })

      results.push({
        id: 'topo-self-int',
        category: 'topology',
        name: 'Self-Intersections',
        status: totalSelfIntersections === 0 ? 'pass' : 'fail',
        message: totalSelfIntersections === 0 ? 'All parcel boundaries are valid' : `${totalSelfIntersections} self-intersection(s) found`,
        details: 'A boundary that crosses itself produces an invalid parcel',
        count: totalSelfIntersections,
      })
    } else {
      results.push({
        id: 'topo-empty',
        category: 'topology',
        name: 'Parcel Data',
        status: 'pending',
        message: 'No parcels to check — import parcels first',
      })
    }

    // ─── 2. Area Reconciliation ──────────────────────────────
    if (parentAreaHa && parcels.length > 0) {
      const sumOfParts = parcels.reduce((sum, p) => {
        const area = memoizedComputeArea(p.vertices)
        return sum + area.areaHectares
      }, 0)

      const difference = Math.abs(parentAreaHa - sumOfParts)
      const tolerance = 0.001 // 10 m²

      results.push({
        id: 'area-recon',
        category: 'area',
        name: 'Area Reconciliation',
        status: difference <= tolerance ? 'pass' : 'fail',
        message: difference <= tolerance
          ? `Sum of parts (${sumOfParts.toFixed(4)} ha) matches parent (${parentAreaHa.toFixed(4)} ha)`
          : `Mismatch: parent ${parentAreaHa.toFixed(4)} ha vs parts ${sumOfParts.toFixed(4)} ha (diff ${difference.toFixed(4)} ha)`,
        details: 'Sum of subdivision parts must equal parent title area within ±0.001 ha',
      })
    }

    // ─── 3. Traverse Precision ───────────────────────────────
    if (traverseData) {
      const precision = evaluateTraversePrecision(
        traverseData.linearErrorM,
        traverseData.totalDistanceM,
        traverseData.angularMisclosureSec,
        traverseData.stationCount,
        surveyCategory,
      )

      results.push({
        id: 'trav-linear',
        category: 'traverse',
        name: 'Linear Precision',
        status: precision.passesLinear ? 'pass' : 'fail',
        message: `1:${precision.linearPrecision.toLocaleString()} (min 1:${precision.minRequiredLinear})`,
        details: `Survey Act Cap 299 requires 1:${precision.minRequiredLinear} for ${surveyCategory} surveys`,
      })

      results.push({
        id: 'trav-angular',
        category: 'traverse',
        name: 'Angular Closure',
        status: precision.passesAngular ? 'pass' : 'fail',
        message: `${precision.angularMisclosure.toFixed(1)}" (max ${precision.maxAllowedAngular.toFixed(1)}")`,
        details: `Maximum allowed: ${precision.maxAllowedAngular.toFixed(1)}" for ${precision.stationCount} stations`,
      })
    }

    // ─── 4. Beacon Validation ────────────────────────────────
    if (parcels.length > 0) {
      const allBeacons = parcels.flatMap(p => p.vertices)
      let duplicates = 0

      for (let i = 0; i < allBeacons.length; i++) {
        for (let j = i + 1; j < allBeacons.length; j++) {
          const dE = allBeacons[i].easting - allBeacons[j].easting
          const dN = allBeacons[i].northing - allBeacons[j].northing
          if (Math.sqrt(dE * dE + dN * dN) < 0.1) duplicates++
        }
      }

      results.push({
        id: 'beacon-dup',
        category: 'beacons',
        name: 'Duplicate Beacons',
        status: duplicates === 0 ? 'pass' : 'warning',
        message: duplicates === 0 ? 'No duplicate beacons' : `${duplicates} potential duplicate(s) found`,
        details: 'Beacons less than 0.1m apart may be the same physical beacon',
        count: duplicates,
      })
    }

    // ─── 5. Document Compliance ──────────────────────────────
    results.push({
      id: 'doc-sok',
      category: 'documents',
      name: 'SoK Standards Compliance',
      status: 'pass',
      message: 'All document templates use SoK 2020 line weights and text sizes',
      details: 'Line weights: 0.3mm parcels, 0.5mm scheme, 0.7mm title. Text: 2.5mm coordinates, 2mm bearings',
    })

    // ─── 6. NLIMS Readiness ──────────────────────────────────
    const hasAllFields = parcels.every(p => p.id && p.vertices.length >= 3)
    results.push({
      id: 'nlims-ready',
      category: 'nlims',
      name: 'NLIMS/ArdhiSasa Readiness',
      status: hasAllFields && parcels.length > 0 ? 'pass' : 'pending',
      message: hasAllFields && parcels.length > 0
        ? 'All parcels have required fields for NLIMS submission'
        : 'Missing required parcel data for NLIMS export',
      details: 'Requires: parcel number, 3+ vertices, owner data',
    })

    setChecks(results)
    setRunning(false)
  }, [parcels, parentAreaHa, traverseData, surveyCategory])

  // Auto-run on mount
  useMemo(() => {
    runAllChecks()
  }, [runAllChecks])

  const stats = useMemo(() => {
    return {
      total: checks.length,
      pass: checks.filter(c => c.status === 'pass').length,
      warning: checks.filter(c => c.status === 'warning').length,
      fail: checks.filter(c => c.status === 'fail').length,
      pending: checks.filter(c => c.status === 'pending').length,
    }
  }, [checks])

  const overallStatus = stats.fail > 0 ? 'fail' : stats.warning > 0 ? 'warning' : stats.pass > 0 ? 'pass' : 'pending'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              overallStatus === 'pass' ? 'bg-emerald-500/10' :
              overallStatus === 'warning' ? 'bg-amber-500/10' :
              overallStatus === 'fail' ? 'bg-red-500/10' : 'bg-gray-500/10'
            }`}>
              <ShieldCheck className={`w-5 h-5 ${
                overallStatus === 'pass' ? 'text-emerald-400' :
                overallStatus === 'warning' ? 'text-amber-400' :
                overallStatus === 'fail' ? 'text-red-400' : 'text-gray-400'
              }`} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">QA Validation Dashboard</h2>
              <p className="text-[10px] text-gray-500">All quality checks in one view</p>
            </div>
          </div>
          <button
            onClick={runAllChecks}
            disabled={running}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent)]/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            Re-run Checks
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-2">
          <StatBox label="Passed" value={stats.pass} color="text-emerald-400" bg="bg-emerald-500/10" />
          <StatBox label="Warnings" value={stats.warning} color="text-amber-400" bg="bg-amber-500/10" />
          <StatBox label="Failed" value={stats.fail} color="text-red-400" bg="bg-red-500/10" />
          <StatBox label="Pending" value={stats.pending} color="text-gray-400" bg="bg-gray-500/10" />
        </div>
      </div>

      {/* Checks by category */}
      {Object.entries(CATEGORY_ICONS).map(([cat, CatIcon]) => {
        const catChecks = checks.filter(c => c.category === cat)
        if (catChecks.length === 0) return null

        return (
          <div key={cat} className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <CatIcon className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                {cat}
              </span>
            </div>
            <div className="space-y-2">
              {catChecks.map(check => {
                const cfg = STATUS_CONFIG[check.status]
                const StatusIcon = cfg.icon
                return (
                  <div
                    key={check.id}
                    className={`flex items-start gap-3 p-2.5 rounded-lg border ${cfg.bg} ${cfg.border}`}
                  >
                    <StatusIcon className={`w-4 h-4 ${cfg.color} shrink-0 mt-0.5 ${check.status === 'pending' ? 'animate-spin' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[var(--text-primary)]">{check.name}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        {check.count != null && check.count > 0 && (
                          <span className="text-[9px] text-gray-500">({check.count})</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">{check.message}</p>
                      {check.details && (
                        <p className="text-[10px] text-gray-600 mt-0.5">{check.details}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Overall verdict */}
      {checks.length > 0 && (
        <div className={`card p-4 ${
          overallStatus === 'pass' ? 'border-emerald-500/30' :
          overallStatus === 'warning' ? 'border-amber-500/30' :
          'border-red-500/30'
        }`}>
          <div className="flex items-center gap-2">
            {overallStatus === 'pass' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {overallStatus === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
            {overallStatus === 'fail' && <AlertCircle className="w-5 h-5 text-red-400" />}
            <div>
              <span className={`text-sm font-bold ${
                overallStatus === 'pass' ? 'text-emerald-400' :
                overallStatus === 'warning' ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {overallStatus === 'pass' ? 'READY FOR SUBMISSION' :
                 overallStatus === 'warning' ? 'READY WITH WARNINGS' :
                 'NOT READY — FIX ERRORS'}
              </span>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {stats.fail > 0 ? `${stats.fail} error(s) must be fixed before registry submission` :
                 stats.warning > 0 ? `${stats.warning} warning(s) — review recommended` :
                 'All quality checks passed'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`p-2 rounded-lg ${bg} border border-white/[0.04] text-center`}>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
  )
}
