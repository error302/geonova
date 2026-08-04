'use client';

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { z } from 'zod'
import {
  ArrowLeft, Plus, Trash2, Edit3, Check, X, LayoutGrid,
  AlertCircle, Loader2, ChevronRight
} from 'lucide-react'
import { apiGet, apiPost, apiPatch, apiDelete, apiInvalidate, ApiError } from '@/lib/api/client'

// ponytail: response schemas — Phase 4 wave 2 will move these to src/lib/api/schemas/

const blockRowSchema = z.object({
  id: z.union([z.number(), z.string()]),
  project_id: z.union([z.number(), z.string()]),
  block_number: z.string(),
  block_name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  parcel_count: z.union([z.number(), z.string()]).optional(),
  completed_count: z.union([z.number(), z.string()]).optional(),
  created_at: z.string().optional(),
}).passthrough()

const blocksListSchema = z.object({
  data: z.array(blockRowSchema).optional().default([]),
}).passthrough()

const blockMutationSchema = z.object({
  data: z.any().optional(),
}).passthrough()

interface BlockRow {
  id: number
  project_id: number
  block_number: string
  block_name: string | null
  description: string | null
  parcel_count: number
  completed_count: number
  created_at: string
}

export default function BlocksPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [blocks, setBlocks] = useState<BlockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Create form
  const [newBlock, setNewBlock] = useState({ block_number: '', block_name: '', description: '' })
  const [creating, setCreating] = useState(false)

  // Edit form
  const [editForm, setEditForm] = useState({ block_number: '', block_name: '', description: '' })
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const fetchBlocks = useCallback(async () => {
    try {
      setLoading(true)
      const json = await apiGet(
        `/api/scheme/blocks?project_id=${projectId}`,
        blocksListSchema,
        { ttlMs: 0 },
      )
      setBlocks((json.data ?? []) as unknown as BlockRow[])
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError((err as Error).message)
      }
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void fetchBlocks() }, [fetchBlocks])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBlock.block_number.trim()) return
    setCreating(true)
    setError('')

    try {
      await apiPost(
        '/api/scheme/blocks',
        blockMutationSchema,
        {
          project_id: parseInt(projectId),
          ...newBlock,
        },
      )

      apiInvalidate(`/api/scheme/blocks?project_id=${projectId}`)
      setNewBlock({ block_number: '', block_name: '', description: '' })
      setShowCreate(false)
      void fetchBlocks()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError((err as Error).message)
      }
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId === null) return
    setUpdating(true)
    setError('')

    try {
      await apiPatch(
        `/api/scheme/blocks/${editingId}`,
        blockMutationSchema,
        editForm,
      )

      apiInvalidate(`/api/scheme/blocks?project_id=${projectId}`)
      setEditingId(null)
      void fetchBlocks()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError((err as Error).message)
      }
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async (blockId: number, blockNumber: string) => {
    if (!confirm(`Delete Block "${blockNumber}" and all its parcels? This cannot be undone.`)) return
    setDeleting(blockId)

    try {
      await apiDelete(`/api/scheme/blocks/${blockId}`)
      apiInvalidate(`/api/scheme/blocks?project_id=${projectId}`)
      void fetchBlocks()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError((err as Error).message)
      }
    } finally {
      setDeleting(null)
    }
  }

  const startEdit = (block: BlockRow) => {
    setEditingId(block.id)
    setEditForm({
      block_number: block.block_number,
      block_name: block.block_name || '',
      description: block.description || '',
    })
  }

  const totalParcels = blocks.reduce((sum, b) => sum + (b.parcel_count || 0), 0)
  const totalCompleted = blocks.reduce((sum, b) => sum + (b.completed_count || 0), 0)

  const inputClass = 'w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-colors'
  const labelClass = 'block text-xs font-medium text-[var(--text-secondary)] mb-1'

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-[var(--bg-primary)]">
      <main className="max-w-4xl mx-auto px-4 py-8">
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
          <span className="text-[var(--text-primary)]">Blocks</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Manage Blocks</h1>
              <p className="text-sm text-[var(--text-secondary)]">
                {blocks.length} block{blocks.length !== 1 ? 's' : ''} &middot; {totalParcels} total parcels &middot; {totalCompleted} completed
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black text-sm font-semibold rounded-lg transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Block
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-3.5 bg-red-900/20 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
            <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Create Block Form */}
        {showCreate && (
          <div className="mb-6 p-5 bg-[var(--bg-card)] rounded-xl border border-orange-500/30 space-y-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-orange-400" />
              New Block
            </h3>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="new-block-number" className={labelClass}>Block Number <span className="text-orange-400">*</span></label>
                <input
                  id="new-block-number"
                  type="text"
                  value={newBlock.block_number}
                  onChange={(e) => setNewBlock(prev => ({ ...prev, block_number: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g., A, B, 1, I"
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- focus into the revealed create form (WCAG 2.4.3)
                  autoFocus
                  required
                />
              </div>
              <div>
                <label htmlFor="new-block-name" className={labelClass}>Block Name</label>
                <input
                  id="new-block-name"
                  type="text"
                  value={newBlock.block_name}
                  onChange={(e) => setNewBlock(prev => ({ ...prev, block_name: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g., Northern Section"
                />
              </div>
              <div>
                <label htmlFor="new-block-desc" className={labelClass}>Description</label>
                <input
                  id="new-block-desc"
                  type="text"
                  value={newBlock.description}
                  onChange={(e) => setNewBlock(prev => ({ ...prev, description: e.target.value }))}
                  className={inputClass}
                  placeholder="Optional description"
                />
              </div>
            </form>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setNewBlock({ block_number: '', block_name: '', description: '' }) }}
                className="px-4 py-2 text-xs border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newBlock.block_number.trim()}
                className="px-4 py-2 text-xs bg-[var(--accent)] text-black font-semibold rounded-lg hover:bg-[var(--accent-dim)] transition-all disabled:opacity-40 flex items-center gap-1"
              >
                {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Create Block
              </button>
            </div>
          </div>
        )}

        {/* Blocks List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : blocks.length === 0 && !showCreate ? (
          <div className="text-center py-16">
            <LayoutGrid className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4 opacity-20" />
            <p className="text-[var(--text-secondary)] mb-1">No blocks yet</p>
            <p className="text-xs text-[var(--text-muted)] mb-4">Create your first block to start organizing parcels.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-[var(--accent)] text-black text-sm font-semibold rounded-lg hover:bg-[var(--accent-dim)] transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create First Block
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {blocks.map((block) => (
              <div key={block.id} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 hover:border-[var(--accent)]/30 transition-colors">
                {editingId === block.id ? (
                  /* Edit Mode */
                  <form onSubmit={handleUpdate} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="edit-block-number" className={labelClass}>Block Number</label>
                        <input id="edit-block-number"
                          type="text"
                          value={editForm.block_number}
                          onChange={(e) => setEditForm(prev => ({ ...prev, block_number: e.target.value }))}
                          className={inputClass}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-block-name" className={labelClass}>Block Name</label>
                        <input id="edit-block-name"
                          type="text"
                          value={editForm.block_name}
                          onChange={(e) => setEditForm(prev => ({ ...prev, block_name: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label htmlFor="edit-block-desc" className={labelClass}>Description</label>
                        <input id="edit-block-desc"
                          type="text"
                          value={editForm.description}
                          onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={updating}
                        className="px-3 py-1.5 text-xs bg-[var(--accent)] text-black font-semibold rounded-lg hover:bg-[var(--accent-dim)] transition-all flex items-center gap-1"
                      >
                        {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Save
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Display Mode */
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/project/${projectId}/scheme/blocks/${block.id}`}
                      className="flex-1 flex items-center gap-4 group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 font-mono font-bold text-sm shrink-0">
                        {block.block_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
                          {block.block_name || `Block ${block.block_number}`}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] truncate">
                          {block.description || 'No description'}
                        </p>
                      </div>
                      <div className="hidden sm:flex items-center gap-4 text-xs text-[var(--text-muted)]">
                        <span>{block.parcel_count} parcel{block.parcel_count !== 1 ? 's' : ''}</span>
                        <span className="text-emerald-400">{block.completed_count} done</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors shrink-0" />
                    </Link>

                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => startEdit(block)}
                        className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        title="Edit block"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(block.id, block.block_number)}
                        disabled={deleting === block.id}
                        className="p-1.5 hover:bg-red-900/20 rounded-lg transition-colors text-[var(--text-muted)] hover:text-red-400"
                        title="Delete block"
                      >
                        {deleting === block.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
