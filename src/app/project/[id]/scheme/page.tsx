'use client';

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, LayoutGrid, MapPin, FileText,
  AlertCircle, CheckCircle2, Clock, BarChart3, Download, FolderArchive, Package, Map, Users
} from 'lucide-react'
import { z } from 'zod'
import { apiGet, ApiError } from '@/lib/api/client'
import MobileDesktopNotice from '@/components/MobileDesktopNotice'
import type { SchemeDetails, Block, ParcelStatus } from '@/types/scheme'
import { SCHEME_STATUS_LABELS, PARCEL_STATUS_LABELS, PARCEL_STATUS_COLORS } from '@/types/scheme'

// ponytail: response schemas — Phase 4 wave 2 will move these to src/lib/api/schemas/

// /api/project/:id may return { data: project } | { project } | bare project
const projectRowSchema = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string(),
  survey_type: z.string().optional().default(''),
  location: z.string().optional().default(''),
  project_type: z.string().optional().default(''),
  utm_zone: z.union([z.number(), z.string()]).optional().default(37),
  hemisphere: z.string().optional().default('S'),
}).passthrough()

const projectEnvelopeSchema = z.union([
  z.object({ data: projectRowSchema }).passthrough(),
  z.object({ project: projectRowSchema }).passthrough(),
  projectRowSchema,
])

const blocksResponseSchema = z.object({
  data: z.array(z.any()),
}).passthrough()

const parcelsResponseSchema = z.object({
  data: z.array(z.any()),
}).passthrough()

const traverseSummarySchema = z.object({
  data: z.array(z.any()),
  summary: z.object({
    total: z.union([z.number(), z.string()]),
    passed: z.union([z.number(), z.string()]),
    failed: z.union([z.number(), z.string()]),
  }).passthrough(),
}).passthrough()

interface ProjectRow {
  id: number
  name: string
  survey_type: string
  location: string
  project_type: string
  utm_zone: number
  hemisphere: string
}

interface BlockWithCounts extends Block {
  parcel_count: number
  completed_count: number
}

interface TraverseSummaryRow {
  accuracy_class: string
  block_number?: string | number | null
  parcel_number?: string | number | null
  accuracy_order?: string | null
  precision_ratio?: string | number | null
  computed_area_ha?: string | number | null
  status?: string | null
}

interface ParcelStatusRow {
  status: string
}

export default function SchemeWorkspacePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<ProjectRow | null>(null)
  const [schemeDetails, setSchemeDetails] = useState<SchemeDetails | null>(null)
  const [blocks, setBlocks] = useState<BlockWithCounts[]>([])
  const [parcelCounts, setParcelCounts] = useState<Record<ParcelStatus, number>>({
    pending: 0, field_complete: 0, computed: 0, plan_generated: 0, submitted: 0, approved: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchSchemeData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch project via /api/project/:id (accepts 3 envelope shapes)
      let proj: ProjectRow | null = null
      try {
        const pj = await apiGet(`/api/project/${projectId}`, projectEnvelopeSchema, { ttlMs: 30_000 })
        proj = ('data' in pj ? pj.data : 'project' in pj ? pj.project : pj) as ProjectRow
      } catch (err) {
        // 404 / not-ok → fall through to the blocks-existence fallback below
        if (err instanceof ApiError && !err.isNotFound && !err.isUnauthorized) {
          // unexpected error — surface it, but keep trying the fallback so the page can still load
          console.error('[scheme] project fetch failed:', (err as Error).message)
        }
      }

      if (!proj) {
        // Fallback: probe blocks endpoint — if it returns ok, treat projectId as a scheme project
        try {
          await apiGet(`/api/scheme/blocks?project_id=${projectId}`, blocksResponseSchema, { ttlMs: 0 })
        } catch {
          throw new Error('Failed to load project')
        }
        setProject({ id: parseInt(projectId), name: 'Scheme Project', survey_type: '', location: '', project_type: 'scheme', utm_zone: 37, hemisphere: 'S' } as ProjectRow)
      } else {
        setProject(proj)
      }

      // Fetch blocks with counts via API
      const blocksJson = await apiGet(`/api/scheme/blocks?project_id=${projectId}`, blocksResponseSchema, { ttlMs: 30_000 })
      const blks = (blocksJson.data || []) as BlockWithCounts[]
      setBlocks(blks)

      // Fetch all parcels across all blocks for status counts
      if (blks.length > 0) {
        try {
          const parcelsJson = await apiGet(`/api/scheme/parcels?project_id=${projectId}`, parcelsResponseSchema, { ttlMs: 30_000 })
          const parcels = (parcelsJson.data || []) as ParcelStatusRow[]

          const counts: Record<ParcelStatus, number> = {
            pending: 0, field_complete: 0, computed: 0, plan_generated: 0, submitted: 0, approved: 0
          }
          for (const p of parcels) {
            counts[p.status as ParcelStatus] = (counts[p.status as ParcelStatus] || 0) + 1
          }
          setParcelCounts(counts)
        } catch {
          // Non-fatal — counts just stay zeroed
        }
      }

      // Fetch scheme details (if the API existed — for now we load via blocks endpoint context)
      // The scheme details are loaded when the project was created
    } catch (err: unknown) {
      setError(err instanceof ApiError ? (err as Error).message : ((err as Error).message || 'Failed to load scheme data'))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void fetchSchemeData() }, [fetchSchemeData])

  // Fetch traverse accuracy summary
  useEffect(() => {
    if (!project?.id) return

    apiGet(`/api/scheme/traverse/summary?project_id=${project.id}`, traverseSummarySchema, { ttlMs: 0 })
      .then(result => {
        const { summary } = result
        const rows = (result.data || []) as TraverseSummaryRow[]

        // Update stat cards
        const totalEl = document.getElementById('summary-total')
        const passedEl = document.getElementById('summary-passed')
        const warningEl = document.getElementById('summary-warning')
        const failedEl = document.getElementById('summary-failed')
        if (totalEl) totalEl.textContent = String(summary.total)
        if (passedEl) passedEl.textContent = String(summary.passed)
        if (warningEl) warningEl.textContent = String(rows.filter((r) => r.accuracy_class === 'warning').length + rows.filter((r) => r.accuracy_class === 'pending').length)
        if (failedEl) failedEl.textContent = String(summary.failed)

        // Render table
        // VULN-002 FIX (security review 2026-08-03): block/parcel numbers and
        // statuses are user-entered — build the table with createElement +
        // textContent, never innerHTML (stored-XSS guard).
        const tableEl = document.getElementById('traverse-table')
        if (tableEl && rows.length > 0) {
          tableEl.replaceChildren()

          const table = document.createElement('table')
          table.className = 'w-full text-sm'

          const thead = document.createElement('thead')
          const headRow = document.createElement('tr')
          headRow.className = 'text-left text-gray-400 border-b border-gray-700'
          for (const header of ['Block', 'Parcel', 'Order', 'Precision', 'Area (ha)', 'Status']) {
            const th = document.createElement('th')
            th.className = 'pb-2'
            th.textContent = header
            headRow.append(th)
          }
          thead.append(headRow)
          table.append(thead)

          const tbody = document.createElement('tbody')
          const colorMap: Record<string, string> = { pass: 'text-green-400', warning: 'text-yellow-400', fail: 'text-red-400', pending: 'text-gray-500' }
          for (const r of rows) {
            const color = colorMap[r.accuracy_class] || 'text-gray-500'
            const tr = document.createElement('tr')
            tr.className = 'border-b border-gray-800'

            const td = (text: string, cls: string) => {
              const cell = document.createElement('td')
              cell.className = cls
              cell.textContent = text
              return cell
            }

            tr.append(td(String(r.block_number ?? ''), 'py-2 text-white'))
            tr.append(td(String(r.parcel_number ?? ''), 'py-2 text-white'))
            tr.append(td(String(r.accuracy_order || 'Not computed'), `py-2 ${color} font-medium`))
            tr.append(td(r.precision_ratio ? '1:' + Number(r.precision_ratio).toLocaleString() : '-', 'py-2 text-gray-300'))
            tr.append(td(r.computed_area_ha ? Number(r.computed_area_ha).toFixed(4) : '-', 'py-2 text-gray-300'))

            const statusTd = document.createElement('td')
            statusTd.className = 'py-2'
            const badge = document.createElement('span')
            badge.className = `px-2 py-1 rounded text-xs ${
              r.status === 'computed' ? 'bg-green-900 text-green-300'
                : r.status === 'draft' ? 'bg-gray-700 text-gray-300'
                  : 'bg-blue-900 text-blue-300'
            }`
            badge.textContent = String(r.status || 'draft')
            statusTd.append(badge)
            tr.append(statusTd)

            tbody.append(tr)
          }
          table.append(tbody)
          tableEl.append(table)
        } else if (tableEl) {
          tableEl.replaceChildren()
          const p = document.createElement('p')
          p.className = 'text-gray-500 text-sm'
          p.textContent = 'No traverses computed yet'
          tableEl.append(p)
        }
      })
      .catch(() => {
        const tableEl = document.getElementById('traverse-table')
        if (tableEl) {
          tableEl.replaceChildren()
          const p = document.createElement('p')
          p.className = 'text-red-400 text-sm'
          p.textContent = 'Failed to load traverse summary'
          tableEl.append(p)
        }
      })
  }, [project?.id])

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--text-muted)]">
          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading scheme workspace...
        </div>
      </div>
    )
  }

  if (error && !project) {
    return (
      <div className="min-h-[calc(100vh-8rem)] bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-[var(--text-secondary)]">{error}</p>
          <Link href="/dashboard" className="text-sm text-[var(--accent)] hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  const totalParcels = Object.values(parcelCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-[var(--bg-primary)]">
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-4">
          <MobileDesktopNotice>
            Scheme workspaces include block tables, parcel status review, batch deed plan ZIPs, and submission packages. Use mobile for monitoring; use desktop for final generation and review.
          </MobileDesktopNotice>
        </div>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-6">
          <Link href="/dashboard" className="hover:text-[var(--accent)] transition-colors">Dashboard</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[var(--text-primary)]">{project?.name || 'Scheme Project'}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">{project?.name}</h1>
              <span className="px-2.5 py-0.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-medium rounded-full">
                Scheme
              </span>
            </div>
            {project?.location && (
              <p className="text-sm text-[var(--text-secondary)]">{project.location}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <LayoutGrid className="w-3 h-3" />
                {blocks.length} block{blocks.length !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                {totalParcels} parcel{totalParcels !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/project/${projectId}/scheme/blocks`}
              className="px-4 py-2 text-sm bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Manage Blocks
            </Link>
            <Link
              href={`/project/${projectId}/scheme/map`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Map className="w-4 h-4" />
              View Scheme Map
            </Link>
            <Link
              href={`/project/${projectId}/scheme/team`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Users className="w-4 h-4" />
              Team & Workflow
            </Link>
            {totalParcels > 0 && (
              <div className="flex items-center gap-2">
                <a
                  href={`/api/scheme/batch?project_id=${projectId}`}
                  className="px-3 py-2 text-sm border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors flex items-center gap-2"
                  title="Download all deed plans as ZIP"
                >
                  <FolderArchive className="w-4 h-4" />
                  Batch Deed Plans
                </a>
                <a
                  href={`/api/scheme/rim?project_id=${projectId}`}
                  target="_blank"
                  className="px-3 py-2 text-sm border border-orange-500/30 text-orange-400 rounded-lg hover:bg-orange-500/5 transition-colors flex items-center gap-2"
                  title="Download Registry Index Map"
                >
                  <Download className="w-4 h-4" />
                  RIM
                </a>
                <a
                  href={`/api/scheme/submission?project_id=${projectId}`}
                  className="px-3 py-2 text-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center gap-2"
                  title="Download complete submission package (ZIP with all deed plans, forms, RIM, summary)"
                >
                  <Package className="w-4 h-4" />
                  Full Submission
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          <StatCard
            label="Blocks"
            value={String(blocks.length)}
            icon={<LayoutGrid className="w-4 h-4" />}
            color="text-blue-400"
          />
          <StatCard
            label="Total Parcels"
            value={String(totalParcels)}
            icon={<BarChart3 className="w-4 h-4" />}
            color="text-[var(--accent)]"
          />
          {(Object.entries(PARCEL_STATUS_LABELS) as [ParcelStatus, string][]).map(([status, label]) => {
            if (parcelCounts[status] === 0) return null
            return (
              <StatCard
                key={status}
                label={label}
                value={String(parcelCounts[status])}
                icon={<CheckCircle2 className="w-4 h-4" />}
                color={status === 'approved' ? 'text-emerald-400' : status === 'submitted' ? 'text-purple-400' : status === 'plan_generated' ? 'text-green-400' : status === 'computed' ? 'text-yellow-400' : 'text-[var(--text-secondary)]'}
              />
            )
          })}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-3.5 bg-red-900/20 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {/* Traverse Accuracy Summary */}
        {blocks.length > 0 && (
          <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Traverse Accuracy Summary</h3>
            <div id="traverse-summary" className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-400" id="summary-total">--</div>
                <div className="text-sm text-gray-400">Total Parcels</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-400" id="summary-passed">--</div>
                <div className="text-sm text-gray-400">Passed</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-400" id="summary-warning">--</div>
                <div className="text-sm text-gray-400">Review Needed</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-400" id="summary-failed">--</div>
                <div className="text-sm text-gray-400">Failed</div>
              </div>
            </div>
            <div id="traverse-table" className="mt-4 overflow-x-auto">
              <p className="text-gray-500 text-sm">Loading traverse summary...</p>
            </div>
          </div>
        )}

        {/* Blocks Table */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-orange-400" />
              Blocks
            </h2>
            {blocks.length === 0 ? (
              <Link
                href={`/project/${projectId}/scheme/blocks`}
                className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add First Block
              </Link>
            ) : (
              <Link
                href={`/project/${projectId}/scheme/blocks`}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                Manage All
              </Link>
            )}
          </div>

          {blocks.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <LayoutGrid className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
              <p className="text-sm text-[var(--text-secondary)] mb-1">No blocks created yet</p>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Blocks group parcels together. Start by creating your first block.
              </p>
              <Link
                href={`/project/${projectId}/scheme/blocks`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black text-sm font-semibold rounded-lg transition-all"
              >
                <Plus className="w-4 h-4" />
                Create Block
              </Link>
            </div>
          ) : (
            <>
            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {blocks.map((block) => {
                const progress = block.parcel_count > 0
                  ? Math.round((block.completed_count / block.parcel_count) * 100)
                  : 0
                return (
                  <div key={block.id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[var(--accent)] text-sm font-bold">{block.block_number}</span>
                      <span className="text-xs text-[var(--text-muted)]">{block.parcel_count} parcels</span>
                    </div>
                    <div className="text-sm text-[var(--text-primary)] mb-2">{block.block_name || '—'}</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs text-[var(--text-muted)] tabular-nums">{progress}%</span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Link href={`/project/${projectId}/scheme/blocks/${block.id}`} className="text-xs text-[var(--accent)] hover:underline">Open →</Link>
                      <Link href={`/project/${projectId}/scheme/blocks`} className="text-xs text-[var(--text-muted)] hover:underline">All blocks</Link>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border-color)]">
                    <th className="px-5 py-3 font-medium">Block</th>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Parcels</th>
                    <th className="px-5 py-3 font-medium">Progress</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((block) => {
                    const progress = block.parcel_count > 0
                      ? Math.round((block.completed_count / block.parcel_count) * 100)
                      : 0

                    return (
                      <tr key={block.id} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-secondary)] transition-colors">
                        <td className="px-5 py-3 font-mono text-[var(--accent)]">{block.block_number}</td>
                        <td className="px-5 py-3 text-[var(--text-primary)]">{block.block_name || '—'}</td>
                        <td className="px-5 py-3 text-[var(--text-secondary)]">{block.parcel_count}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-400 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-[var(--text-muted)]">{progress}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={`/project/${projectId}/scheme/blocks/${block.id}`}
                            className="text-xs text-[var(--accent)] hover:underline"
                          >
                            Manage Parcels
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value, icon, color }: {
  label: string
  value: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
      </div>
      <p className="text-xl font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  )
}
