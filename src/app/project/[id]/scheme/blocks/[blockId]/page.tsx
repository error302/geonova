'use client';

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, Edit3, Check, X, FileText,
  AlertCircle, Loader2, Download
} from 'lucide-react'
import { z } from 'zod'
import { apiGet, apiPost, apiPatch, apiDelete, apiInvalidate, ApiError } from '@/lib/api/client'
import { PARCEL_STATUS_LABELS, PARCEL_STATUS_COLORS, type ParcelStatus } from '@/types/scheme'
import TraverseComputePanel from '@/components/scheme/TraverseComputePanel'
import CsvImportPanel from '@/components/scheme/CsvImportPanel'

// ponytail: response schemas — Phase 4 wave 2 will move these to src/lib/api/schemas/

const blocksListResponseSchema = z.object({
  data: z.array(z.any()),
}).passthrough()

const parcelsResponseSchema = z.object({
  data: z.array(z.any()),
}).passthrough()

const parcelMutationResponseSchema = z.object({
  data: z.any().optional(),
}).passthrough()

interface ParcelRow {
  id: number
  project_id: number
  block_id: number
  parcel_number: string
  lr_number_proposed: string | null
  lr_number_confirmed: string | null
  area_ha: number | null
  status: ParcelStatus
  assigned_surveyor: number | null
  notes: string | null
  block_number?: string
  block_name?: string
}

interface BlockInfo {
  id: number
  block_number: string
  block_name: string | null
  description: string | null
}

export default function BlockDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const blockId = params.blockId as string

  const [block, setBlock] = useState<BlockInfo | null>(null)
  const [parcels, setParcels] = useState<ParcelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateParcel, setShowCreateParcel] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [selectedParcelId, setSelectedParcelId] = useState<number | null>(null)

  // Create form
  const [newParcel, setNewParcel] = useState({
    parcel_number: '', lr_number_proposed: '', area_ha: '', notes: ''
  })
  const [creating, setCreating] = useState(false)

  // Edit form
  const [editForm, setEditForm] = useState({
    parcel_number: '', lr_number_proposed: '', lr_number_confirmed: '',
    area_ha: '', status: 'pending' as ParcelStatus, notes: ''
  })
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [blocksJson, parcelJson] = await Promise.all([
        apiGet(`/api/scheme/blocks?project_id=${projectId}`, blocksListResponseSchema, { ttlMs: 30_000 }),
        apiGet(`/api/scheme/parcels?block_id=${blockId}`, parcelsResponseSchema, { ttlMs: 0 }),
      ])

      const found = blocksJson.data.find((b: any) => String(b.id) === String(blockId))
      if (found) setBlock(found)

      setParcels(parcelJson.data || [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load block data')
    } finally {
      setLoading(false)
    }
  }, [projectId, blockId])

  useEffect(() => { void fetchData() }, [fetchData])

  const handleCreateParcel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newParcel.parcel_number.trim()) return
    setCreating(true)
    setError('')
    try {
      await apiPost(
        '/api/scheme/parcels',
        parcelMutationResponseSchema,
        {
          project_id: parseInt(projectId),
          block_id: parseInt(blockId),
          parcel_number: newParcel.parcel_number,
          lr_number_proposed: newParcel.lr_number_proposed || null,
          area_ha: newParcel.area_ha ? parseFloat(newParcel.area_ha) : null,
          notes: newParcel.notes || null,
        },
      )
      apiInvalidate(`/api/scheme/parcels?block_id=${blockId}`)
      setNewParcel({ parcel_number: '', lr_number_proposed: '', area_ha: '', notes: '' })
      setShowCreateParcel(false)
      void fetchData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create parcel')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateParcel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId === null) return
    setUpdating(true)
    setError('')
    try {
      await apiPatch(
        `/api/scheme/parcels/${editingId}`,
        parcelMutationResponseSchema,
        {
          ...editForm,
          lr_number_proposed: editForm.lr_number_proposed || null,
          lr_number_confirmed: editForm.lr_number_confirmed || null,
          area_ha: editForm.area_ha ? parseFloat(editForm.area_ha) : null,
          notes: editForm.notes || null,
        },
      )
      apiInvalidate(`/api/scheme/parcels?block_id=${blockId}`)
      setEditingId(null)
      void fetchData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update parcel')
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteParcel = async (parcelId: number, parcelNumber: string) => {
    if (!confirm(`Delete Parcel "${parcelNumber}"? This cannot be undone.`)) return
    setDeleting(parcelId)
    try {
      await apiDelete(`/api/scheme/parcels/${parcelId}`)
      apiInvalidate(`/api/scheme/parcels?block_id=${blockId}`)
      void fetchData()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete parcel')
    } finally {
      setDeleting(null)
    }
  }

  const startEdit = (parcel: ParcelRow) => {
    setEditingId(parcel.id)
    setEditForm({
      parcel_number: parcel.parcel_number,
      lr_number_proposed: parcel.lr_number_proposed || '',
      lr_number_confirmed: parcel.lr_number_confirmed || '',
      area_ha: parcel.area_ha ? String(parcel.area_ha) : '',
      status: parcel.status,
      notes: parcel.notes || '',
    })
  }

  const nextParcelSuggestion = parcels.length > 0
    ? String(parseInt(parcels[parcels.length - 1].parcel_number) + 1 || parcels.length + 1)
    : '1'

  const totalArea = parcels.reduce((sum, p) => sum + (parseFloat(String(p.area_ha)) || 0), 0)
  const completedCount = parcels.filter(p => ['approved', 'submitted'].includes(p.status)).length

  const inputClass = 'w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-colors'
  const labelClass = 'block text-xs font-medium text-[var(--text-secondary)] mb-1'

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-[var(--bg-primary)]">
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-6">
          <Link href="/dashboard" className="hover:text-[var(--accent)] transition-colors">Dashboard</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link href={`/project/${projectId}/scheme`} className="hover:text-[var(--accent)] transition-colors">Scheme</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link href={`/project/${projectId}/scheme/blocks`} className="hover:text-[var(--accent)] transition-colors">Blocks</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[var(--text-primary)]">{block?.block_number || blockId}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/project/${projectId}/scheme/blocks`)}
              className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="px-3 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 font-mono font-bold text-sm rounded-lg">
                  {block?.block_number || '...'}
                </span>
                <h1 className="text-xl font-bold text-[var(--text-primary)]">
                  {block?.block_name || `Block ${block?.block_number || ''}`}
                </h1>
              </div>
              {block?.description && (
                <p className="text-sm text-[var(--text-muted)]">{block.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)]">
                <span>{parcels.length} parcel{parcels.length !== 1 ? 's' : ''}</span>
                <span>{totalArea.toFixed(4)} ha total</span>
                <span className="text-emerald-400">{completedCount} done</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowCreateParcel(true)}
            className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black text-sm font-semibold rounded-lg transition-all flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Parcel
          </button>
        </div>

        {/* Traverse compute panel — shown when a parcel is selected */}
        {selectedParcelId && (
          <div className="mb-6">
            <TraverseComputePanel parcelId={selectedParcelId} />
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-3.5 bg-red-900/20 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
            <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Create Parcel Form */}
        {showCreateParcel && (
          <div className="mb-6 p-5 bg-[var(--bg-card)] rounded-xl border border-[var(--accent)]/30 space-y-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--accent)]" />
              New Parcel
            </h3>
            <form onSubmit={handleCreateParcel} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="new-parcel-number" className={labelClass}>Parcel Number <span className="text-orange-400">*</span></label>
                <input id="new-parcel-number"
                  type="text"
                  value={newParcel.parcel_number}
                  onChange={e => setNewParcel(prev => ({ ...prev, parcel_number: e.target.value }))}
                  className={inputClass}
                  placeholder={nextParcelSuggestion}
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- focus into the revealed create form (WCAG 2.4.3)
                  autoFocus
                  required
                />
              </div>
              <div>
                <label htmlFor="new-parcel-lr" className={labelClass}>Proposed LR No.</label>
                <input
                  id="new-parcel-lr"
                  type="text"
                  value={newParcel.lr_number_proposed}
                  onChange={e => setNewParcel(prev => ({ ...prev, lr_number_proposed: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g., MN/III/1234"
                />
              </div>
              <div>
                <label htmlFor="new-parcel-area" className={labelClass}>Area (ha)</label>
                <input
                  id="new-parcel-area"
                  type="number"
                  step="0.0001"
                  value={newParcel.area_ha}
                  onChange={e => setNewParcel(prev => ({ ...prev, area_ha: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g., 0.0625"
                />
              </div>
              <div>
                <label htmlFor="new-parcel-notes" className={labelClass}>Notes</label>
                <input
                  id="new-parcel-notes"
                  type="text"
                  value={newParcel.notes}
                  onChange={e => setNewParcel(prev => ({ ...prev, notes: e.target.value }))}
                  className={inputClass}
                  placeholder="Optional"
                />
              </div>
            </form>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowCreateParcel(false); setNewParcel({ parcel_number: '', lr_number_proposed: '', area_ha: '', notes: '' }) }}
                className="px-4 py-2 text-xs border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateParcel}
                disabled={creating || !newParcel.parcel_number.trim()}
                className="px-4 py-2 text-xs bg-[var(--accent)] text-black font-semibold rounded-lg hover:bg-[var(--accent-dim)] transition-all disabled:opacity-40 flex items-center gap-1"
              >
                {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Add Parcel
              </button>
            </div>
          </div>
        )}

        {/* Parcels Table or Empty State */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : parcels.length === 0 && !showCreateParcel ? (
          <div className="space-y-4">
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4 opacity-20" />
              <p className="text-[var(--text-secondary)] mb-1">No parcels yet</p>
              <p className="text-xs text-[var(--text-muted)] mb-4">Add parcels individually or import from CSV.</p>
              <button
                onClick={() => setShowCreateParcel(true)}
                className="px-4 py-2 bg-[var(--accent)] text-black text-sm font-semibold rounded-lg hover:bg-[var(--accent-dim)] transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add First Parcel
              </button>
            </div>
            {/* CSV Import — shown even on empty state */}
            <CsvImportPanel
              projectId={projectId}
              blockId={blockId}
              blockName={block?.block_number || ''}
              onImportComplete={fetchData}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border-color)]">
                      <th className="px-4 py-3 font-medium">Parcel #</th>
                      <th className="px-4 py-3 font-medium">Proposed LR</th>
                      <th className="px-4 py-3 font-medium">Confirmed LR</th>
                      <th className="px-4 py-3 font-medium">Area (ha)</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcels.map((parcel) => (
                      <tr key={parcel.id} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-secondary)] transition-colors">
                        {editingId === parcel.id ? (
                          <>
                            <td className="px-4 py-2">
                              <input aria-label="Parcel number" type="text" value={editForm.parcel_number}
                                onChange={e => setEditForm(p => ({ ...p, parcel_number: e.target.value }))}
                                className={inputClass} required />
                            </td>
                            <td className="px-4 py-2">
                              <input aria-label="Lr number proposed" type="text" value={editForm.lr_number_proposed}
                                onChange={e => setEditForm(p => ({ ...p, lr_number_proposed: e.target.value }))}
                                className={inputClass} />
                            </td>
                            <td className="px-4 py-2">
                              <input aria-label="Lr number confirmed" type="text" value={editForm.lr_number_confirmed}
                                onChange={e => setEditForm(p => ({ ...p, lr_number_confirmed: e.target.value }))}
                                className={inputClass} />
                            </td>
                            <td className="px-4 py-2">
                              <input aria-label="Area ha" type="number" step="0.0001" value={editForm.area_ha}
                                onChange={e => setEditForm(p => ({ ...p, area_ha: e.target.value }))}
                                className={inputClass} />
                            </td>
                            <td className="px-4 py-2">
                              <select value={editForm.status}
                                onChange={e => setEditForm(p => ({ ...p, status: e.target.value as ParcelStatus }))}
                                className={inputClass}>
                                {(Object.entries(PARCEL_STATUS_LABELS) as [ParcelStatus, string][]).map(
                                  ([val, label]) => <option key={val} value={val}>{label}</option>
                                )}
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex justify-end gap-1">
                                <button onClick={handleUpdateParcel} disabled={updating}
                                  className="p-1.5 bg-[var(--accent)] text-black rounded-lg hover:bg-[var(--accent-dim)] transition-colors">
                                  {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                </button>
                                <button onClick={() => setEditingId(null)}
                                  className="p-1.5 border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 font-mono text-[var(--accent)] font-medium">{parcel.parcel_number}</td>
                            <td className="px-4 py-3 text-[var(--text-primary)] font-mono text-xs">{parcel.lr_number_proposed || '—'}</td>
                            <td className="px-4 py-3 text-[var(--text-primary)] font-mono text-xs">{parcel.lr_number_confirmed || '—'}</td>
                            <td className="px-4 py-3 text-[var(--text-secondary)]">{parcel.area_ha ? Number(parcel.area_ha).toFixed(4) : '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${PARCEL_STATUS_COLORS[parcel.status]}`}>
                                {PARCEL_STATUS_LABELS[parcel.status]}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => setSelectedParcelId(selectedParcelId === parcel.id ? null : parcel.id)}
                                  className={`p-1.5 rounded-lg transition-colors text-[var(--text-muted)] ${selectedParcelId === parcel.id ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'hover:bg-[var(--bg-tertiary)] hover:text-[var(--accent)]'}`}
                                  title="Compute Traverse"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                                <a
                                  href={`/api/scheme/deed-plan?parcel_id=${parcel.id}`}
                                  target="_blank"
                                  className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-[var(--text-muted)] hover:text-emerald-400"
                                  title="Download Deed Plan"
                                  onClick={e => {
                                    if (parcel.status === 'pending') {
                                      e.preventDefault()
                                      alert('Compute traverse first before generating a deed plan.')
                                    }
                                  }}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                                <button onClick={() => startEdit(parcel)}
                                  className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                  title="Edit">
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteParcel(parcel.id, parcel.parcel_number)}
                                  disabled={deleting === parcel.id}
                                  className="p-1.5 hover:bg-red-900/20 rounded-lg transition-colors text-[var(--text-muted)] hover:text-red-400"
                                  title="Delete">
                                  {deleting === parcel.id
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  {parcels.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-[var(--border-color)]">
                        <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-[var(--text-secondary)]">
                          {parcels.length} parcel{parcels.length !== 1 ? 's' : ''}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-[var(--text-primary)]">
                          {totalArea.toFixed(4)}
                        </td>
                        <td colSpan={2} className="px-4 py-3 text-xs font-medium text-emerald-400">
                          {completedCount} completed
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* CSV Import always available when there are existing parcels too */}
            <CsvImportPanel
              projectId={projectId}
              blockId={blockId}
              blockName={block?.block_number || ''}
              onImportComplete={fetchData}
            />
          </div>
        )}
      </main>
    </div>
  )
}
