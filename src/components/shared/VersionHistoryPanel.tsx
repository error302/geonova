'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Clock,
  ChevronDown,
  RotateCcw,
  User,
  FileText,
  AlertTriangle,
  Loader2,
} from 'lucide-react'

/* ────────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────────── */

interface VersionEntry {
  id: string
  entity_type: string
  entity_id: string
  version: number
  snapshot: Record<string, unknown>
  delta: Record<string, { old: unknown; new: unknown }> | null
  change_summary: string | null
  created_by: string | null
  created_at: string
}

interface DiffChange {
  field: string
  old_value: unknown
  new_value: unknown
}

interface DiffResponse {
  entity_type: string
  entity_id: string
  from_version: number
  to_version: number
  from_date: string
  to_date: string
  changes: DiffChange[]
  change_count: number
}

interface VersionHistoryPanelProps {
  /** Entity table name, e.g. 'projects', 'parcels' */
  entityType: string
  /** UUID of the entity */
  entityId: string
  /** Optional: max height of the timeline before scrolling */
  maxHeight?: string
  /** Optional: callback after a successful restore */
  onRestored?: () => void
}

/* ────────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

const ENTITY_LABELS: Record<string, string> = {
  parcels: 'Parcel',
  blocks: 'Block',
  projects: 'Project',
  traverse_results: 'Traverse Result',
  traverse_history: 'Traverse History',
  traverse_observations: 'Traverse Observation',
  project_fieldbook_entries: 'Fieldbook Entry',
  survey_points: 'Survey Point',
}

/* ────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

export function VersionHistoryPanel({
  entityType,
  entityId,
  maxHeight = '24rem',
  onRestored,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<VersionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Expanded version diff
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [diffData, setDiffData] = useState<DiffResponse | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  // Restore dialog
  const [restoreTarget, setRestoreTarget] = useState<VersionEntry | null>(null)
  const [restoring, setRestoring] = useState(false)

  /* ── Fetch version history ── */
  const fetchVersions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        entity_type: entityType,
        entity_id: entityId,
        limit: '50',
      })
      const res = await fetch(`/api/versions?${params}`)
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `Failed to load versions (${res.status})`)
      }
      const json = (await res.json()) as { data?: VersionEntry[] }
      setVersions(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  /* ── Fetch diff on expand ── */
  const handleToggle = useCallback(
    async (versionId: string) => {
      if (expandedId === versionId) {
        setExpandedId(null)
        setDiffData(null)
        return
      }

      setExpandedId(versionId)
      setDiffData(null)
      setDiffLoading(true)

      try {
        const entry = versions.find((v) => v.id === versionId)
        if (!entry || entry.version <= 1) {
          // Version 1 has no previous version to diff against
          setDiffLoading(false)
          return
        }
        const params = new URLSearchParams({
          compare_with: String(entry.version - 1),
        })
        const res = await fetch(`/api/versions/${versionId}/diff?${params}`)
        if (!res.ok) {
          setDiffLoading(false)
          return
        }
        const json = (await res.json()) as DiffResponse
        setDiffData(json)
      } catch {
        // silently fail — diff is non-critical
      } finally {
        setDiffLoading(false)
      }
    },
    [expandedId, versions]
  )

  /* ── Restore ── */
  const handleRestore = useCallback(async () => {
    if (!restoreTarget) return
    setRestoring(true)
    try {
      const res = await fetch(`/api/versions/${restoreTarget.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: restoreTarget.id }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `Restore failed (${res.status})`)
      }
      setRestoreTarget(null)
      // Refresh the version list after restore
      await fetchVersions()
      onRestored?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed')
    } finally {
      setRestoring(false)
    }
  }, [restoreTarget, fetchVersions, onRestored])

  /* ────────────────────────────────────────────────────────────────────────
     Render
     ──────────────────────────────────────────────────────────────────────── */

  const entityLabel = ENTITY_LABELS[entityType] ?? entityType

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
      {/* Header */}
      <div className="card-header">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <Clock className="h-4 w-4 text-[var(--accent)]" />
          Version History
          <span className="text-[var(--text-muted)] font-normal">
            — {entityLabel}
          </span>
        </div>
        <Badge variant="outline" className="text-[var(--text-muted)]">
          {versions.length} {versions.length === 1 ? 'revision' : 'revisions'}
        </Badge>
      </div>

      {/* Body */}
      <div className="card-body p-0">
        {loading && (
          <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading history…
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--error)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && versions.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
            No version history recorded yet.
          </div>
        )}

        {!loading && !error && versions.length > 0 && (
          <ScrollArea style={{ maxHeight }}>
            <div className="divide-y divide-[var(--border-color)]">
              {versions.map((v) => {
                const isExpanded = expandedId === v.id
                const isDeleted = v.change_summary === 'DELETED'

                return (
                  <Collapsible
                    key={v.id}
                    open={isExpanded}
                    onOpenChange={() => handleToggle(v.id)}
                  >
                    {/* Timeline entry trigger */}
                    <CollapsibleTrigger asChild>
                      <button
                        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[var(--glass-bg)] transition-colors duration-150 focus-ring"
                        aria-label={`Version ${v.version} — ${v.change_summary || 'No summary'}`}
                      >
                        {/* Timeline dot */}
                        <div className="mt-1 shrink-0">
                          <span
                            className={`block h-2.5 w-2.5 rounded-full ${
                              isDeleted
                                ? 'bg-[var(--error)]'
                                : v.version === 1
                                ? 'bg-[var(--success)]'
                                : 'bg-[var(--accent)]'
                            }`}
                          />
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className="text-xs font-mono"
                            >
                              v{v.version}
                            </Badge>
                            {isDeleted && (
                              <Badge
                                variant="destructive"
                                className="text-xs"
                              >
                                Deleted
                              </Badge>
                            )}
                            {v.version === 1 && !isDeleted && (
                              <Badge className="text-xs bg-[color-mix(in_srgb,var(--success)_20%,transparent)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_30%,transparent)]">
                                Created
                              </Badge>
                            )}
                            <span className="text-xs text-[var(--text-muted)]">
                              {formatDate(v.created_at)}
                            </span>
                          </div>

                          {/* Summary line */}
                          <p className="mt-1 text-sm text-[var(--text-secondary)] truncate">
                            {v.change_summary ||
                              (v.version === 1
                                ? 'Initial version'
                                : `Revision ${v.version}`)}
                          </p>

                          {/* Who changed it */}
                          {v.created_by && (
                            <p className="mt-0.5 text-xs text-[var(--text-muted)] flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {v.created_by.slice(0, 8)}…
                            </p>
                          )}
                        </div>

                        {/* Expand chevron */}
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </CollapsibleTrigger>

                    {/* Expanded diff content */}
                    <CollapsibleContent>
                      <div className="px-4 pb-3 pl-10">
                        {diffLoading && (
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] py-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading diff…
                          </div>
                        )}

                        {isExpanded && !diffLoading && v.version === 1 && (
                          <div className="text-xs text-[var(--text-muted)] py-2 flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Initial creation — no previous version to compare.
                          </div>
                        )}

                        {isExpanded &&
                          !diffLoading &&
                          diffData &&
                          v.version > 1 && (
                            <div className="space-y-2">
                              {diffData.changes.length === 0 ? (
                                <p className="text-xs text-[var(--text-muted)] py-1">
                                  No field-level changes detected.
                                </p>
                              ) : (
                                <div className="rounded border border-[var(--border-color)] bg-[var(--bg-tertiary)] overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="table-header">
                                        <th className="px-3 py-2 text-left">
                                          Field
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                          Before
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                          After
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {diffData.changes.map((c) => (
                                        <tr
                                          key={c.field}
                                          className="table-row"
                                        >
                                          <td className="table-cell font-mono font-medium text-[var(--text-primary)]">
                                            {c.field}
                                          </td>
                                          <td className="table-cell text-[color-mix(in_srgb,var(--error)_80%,transparent)]">
                                            <span className="line-through opacity-70">
                                              {formatValue(c.old_value)}
                                            </span>
                                          </td>
                                          <td className="table-cell text-[var(--success)]">
                                            {formatValue(c.new_value)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Restore button — not shown for version 1 or deleted entries */}
                              {!isDeleted && v.version > 1 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2 text-xs border-[color-mix(in_srgb,var(--accent)_40%,transparent)] text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] hover:text-[var(--accent)]"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setRestoreTarget(v)
                                  }}
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  Restore this version
                                </Button>
                              )}
                            </div>
                          )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* ── Restore confirmation dialog ── */}
      <Dialog
        open={!!restoreTarget}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
      >
        <DialogContent className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">
              Restore to Version {restoreTarget?.version}?
            </DialogTitle>
            <DialogDescription className="text-[var(--text-secondary)]">
              This will revert the {entityLabel} back to the state it was in on{' '}
              {restoreTarget ? formatDate(restoreTarget.created_at) : ''}. A new
              version snapshot will be created for full traceability — no history
              will be lost.
            </DialogDescription>
          </DialogHeader>

          {restoreTarget?.change_summary && (
            <div className="rounded border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3 text-sm text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text-primary)]">
                Summary:
              </span>{' '}
              {restoreTarget.change_summary}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRestoreTarget(null)}
              disabled={restoring}
              className="text-[var(--text-secondary)]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestore}
              disabled={restoring}
              className="bg-[var(--accent)] text-black hover:bg-[var(--accent-dim)]"
            >
              {restoring && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <RotateCcw className="h-4 w-4 mr-2" />
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
