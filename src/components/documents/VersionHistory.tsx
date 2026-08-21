'use client'

/**
 * VersionHistory — Survey plan version tracking with diff viewer
 *
 * Features:
 * - Shows chronological list of document/plan versions
 * - Compare two versions side-by-side
 * - Highlights what changed (added/removed/modified fields)
 * - Restore previous version
 *
 * Each version tracks:
 * - Version number, timestamp, author
 * - What changed (area, boundaries, beacons, surveyor)
 * - PDF preview link
 */

import { useState, useMemo, useCallback } from 'react'
import {
  History, GitBranch, Clock, Check,
  RotateCcw, Eye,
  Plus, Minus, Edit3,
} from 'lucide-react'

export interface PlanVersion {
  id: string
  versionNumber: number
  timestamp: string
  author: string
  changes: string[]
  // Document data at this version
  data: {
    parcelNumber?: string
    areaHectares?: number
    surveyorName?: string
    surveyorLicense?: string
    beaconCount?: number
    boundaryLength?: number
    status?: string
  }
  pdfUrl?: string
}

interface VersionHistoryProps {
  versions: PlanVersion[]
  onRestore?: (version: PlanVersion) => void
}

export function VersionHistory({ versions, onRestore }: VersionHistoryProps) {
  const [selectedVersions, setSelectedVersions] = useState<[string | null, string | null]>([null, null])
  const [showDiff, setShowDiff] = useState(false)

  const sortedVersions = useMemo(() =>
    [...versions].sort((a, b) => b.versionNumber - a.versionNumber),
    [versions]
  )

  const handleSelect = useCallback((id: string) => {
    setSelectedVersions(prev => {
      if (prev[0] === null) return [id, null]
      if (prev[1] === null && prev[0] !== id) return [prev[0], id]
      if (prev[0] === id) return [null, prev[1]]
      if (prev[1] === id) return [prev[0], null]
      return [id, null]
    })
  }, [])

  const canCompare = selectedVersions[0] && selectedVersions[1]

  const v1 = sortedVersions.find(v => v.id === selectedVersions[0])
  const v2 = sortedVersions.find(v => v.id === selectedVersions[1])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] flex items-center justify-center">
              <History className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Version History</h2>
              <p className="text-[10px] text-gray-500">{versions.length} versions — select 2 to compare</p>
            </div>
          </div>
          {canCompare && (
            <button
              onClick={() => setShowDiff(!showDiff)}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] text-[var(--accent)] text-xs font-medium hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]"
            >
              <GitBranch className="w-3.5 h-3.5" />
              {showDiff ? 'Hide Diff' : 'Compare'}
            </button>
          )}
        </div>
      </div>

      {/* Diff viewer */}
      {showDiff && v1 && v2 && (
        <VersionDiff v1={v1} v2={v2} />
      )}

      {/* Version list */}
      <div className="card p-4">
        {sortedVersions.length === 0 ? (
          <div className="text-center py-8">
            <History className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No version history yet</p>
            <p className="text-[10px] text-gray-600 mt-1">Versions are created when you save changes to a plan.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedVersions.map((version, idx) => {
              const isSelected = selectedVersions.includes(version.id)
              const isLatest = idx === 0
              return (
                <div
                  key={version.id}
                  onClick={() => handleSelect(version.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]'
                      : 'border-[var(--border-color)] hover:border-[color-mix(in_srgb,var(--accent)_20%,transparent)]'
                  }`}
                >
                  {/* Version badge */}
                  <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    isLatest ? 'bg-emerald-500/10' : 'bg-[var(--bg-tertiary)]'
                  }`}>
                    <span className={`text-xs font-bold ${isLatest ? 'text-emerald-400' : 'text-gray-400'}`}>
                      v{version.versionNumber}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isLatest && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium uppercase">
                          Current
                        </span>
                      )}
                      <span className="text-xs font-medium text-[var(--text-primary)]">
                        {version.author}
                      </span>
                      <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(version.timestamp).toLocaleDateString('en-KE', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Changes */}
                    {version.changes.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {version.changes.map((change, i) => (
                          <div key={`${change}-${i}`} className="flex items-center gap-1 text-[10px] text-gray-500">
                            <Edit3 className="w-2.5 h-2.5 text-gray-600" />
                            {change}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Data summary */}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-600">
                      {version.data.areaHectares != null && (
                        <span>{version.data.areaHectares.toFixed(4)} ha</span>
                      )}
                      {version.data.beaconCount != null && (
                        <span>{version.data.beaconCount} beacons</span>
                      )}
                      {version.data.surveyorName && (
                        <span className="truncate">{version.data.surveyorName}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {version.pdfUrl && (
                      <a
                        href={version.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-[var(--accent)]"
                        title="View PDF"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {!isLatest && onRestore && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRestore(version) }}
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-amber-400"
                        title="Restore this version"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[var(--accent)]" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Version Diff Viewer ─────────────────────────────────────────────

function VersionDiff({ v1, v2 }: { v1: PlanVersion; v2: PlanVersion }) {
  const diffs = useMemo(() => {
    const result: Array<{
      field: string
      v1Value: string
      v2Value: string
      type: 'added' | 'removed' | 'modified'
    }> = []

    const fields: Array<{ key: keyof PlanVersion['data']; label: string; format?: (v: string | number | undefined) => string }> = [
      { key: 'parcelNumber', label: 'Parcel Number' },
      { key: 'areaHectares', label: 'Area (ha)', format: (v) => (typeof v === 'number' ? v.toFixed(4) : String(v)) },
      { key: 'surveyorName', label: 'Surveyor' },
      { key: 'surveyorLicense', label: 'License' },
      { key: 'beaconCount', label: 'Beacons' },
      { key: 'boundaryLength', label: 'Boundary Length (m)', format: (v) => (typeof v === 'number' ? v.toFixed(2) : String(v)) },
      { key: 'status', label: 'Status' },
    ]

    for (const field of fields) {
      const val1 = v1.data[field.key]
      const val2 = v2.data[field.key]
      const fmt = field.format || ((v: unknown) => String(v))

      if (val1 === val2) continue

      if (val1 == null && val2 != null) {
        result.push({ field: field.label, v1Value: '—', v2Value: fmt(val2), type: 'added' })
      } else if (val1 != null && val2 == null) {
        result.push({ field: field.label, v1Value: fmt(val1), v2Value: '—', type: 'removed' })
      } else if (val1 != null && val2 != null) {
        result.push({ field: field.label, v1Value: fmt(val1), v2Value: fmt(val2), type: 'modified' })
      }
    }

    return result
  }, [v1, v2])

  // Ensure v2 is the newer version
  const newer = v2.versionNumber > v1.versionNumber ? v2 : v1
  const older = v2.versionNumber > v1.versionNumber ? v1 : v2

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="w-4 h-4 text-[var(--accent)]" />
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          Comparing v{older.versionNumber} → v{newer.versionNumber}
        </span>
      </div>

      {diffs.length === 0 ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <Check className="w-4 h-4 text-emerald-400" />
          <p className="text-xs text-emerald-400">No differences — versions are identical</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="px-3 py-2 text-left text-[9px] text-gray-500 uppercase tracking-wider">Field</th>
                <th className="px-3 py-2 text-left text-[9px] text-gray-500 uppercase tracking-wider">v{older.versionNumber}</th>
                <th className="px-3 py-2 text-left text-[9px] text-gray-500 uppercase tracking-wider">v{newer.versionNumber}</th>
                <th className="px-3 py-2 text-center text-[9px] text-gray-500 uppercase tracking-wider">Change</th>
              </tr>
            </thead>
            <tbody>
              {diffs.map((diff) => (
                <tr key={diff.field} className="border-b border-[color-mix(in_srgb,var(--border-color)_50%,transparent)]">
                  <td className="px-3 py-2 text-xs text-[var(--text-primary)] font-medium">{diff.field}</td>
                  <td className="px-3 py-2 text-xs text-gray-400 font-mono">
                    {diff.type === 'added' ? '—' : diff.v1Value}
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--text-primary)] font-mono">
                    {diff.type === 'removed' ? '—' : diff.v2Value}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {diff.type === 'added' && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-medium">
                        <Plus className="w-2.5 h-2.5" /> Added
                      </span>
                    )}
                    {diff.type === 'removed' && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 text-[9px] font-medium">
                        <Minus className="w-2.5 h-2.5" /> Removed
                      </span>
                    )}
                    {diff.type === 'modified' && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-medium">
                        <Edit3 className="w-2.5 h-2.5" /> Modified
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
