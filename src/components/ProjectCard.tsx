'use client';

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import ProjectWorkflowBadge from '@/components/shared/ProjectWorkflowBadge'

/* ── Delete Confirmation Modal ──────────────────────────────────────────── */
function DeleteConfirmModal({
  projectName,
  pointCount,
  parcelCount,
  onConfirm,
  onCancel,
  isDeleting,
  deleteError,
}: {
  projectName: string
  pointCount: number
  parcelCount: number
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
  deleteError: string
}) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div ref={modalRef}
        className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with warning */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Delete Project</h3>
              <p className="text-sm text-[var(--text-muted)]">This action cannot be undone</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-4">
          <div className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg p-4 mb-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Are you sure you want to permanently delete{' '}
              <span className="font-semibold text-[var(--text-primary)]">"{projectName}"</span>?
            </p>
            {(pointCount > 0 || parcelCount > 0) && (
              <div className="mt-3 pt-3 border-t border-[var(--border-color)] space-y-1">
                {pointCount > 0 && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span><strong>{pointCount}</strong> survey point{pointCount > 1 ? 's' : ''} will be permanently deleted</span>
                  </p>
                )}
                {parcelCount > 0 && (
                  <p className="text-xs text-red-400 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span><strong>{parcelCount}</strong> parcel{parcelCount > 1 ? 's' : ''} will be permanently deleted</span>
                  </p>
                )}
              </div>
            )}
            <p className="text-xs text-[var(--text-muted)] mt-2">
              All associated data including points, parcels, alignments, chainage data, and submissions will be removed.
            </p>
          </div>

          {/* Error display */}
          {deleteError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c-.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374L10.051 3.378c.866-1.5 3.032-1.5 3.898 0l7.354 13.122zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span>{deleteError}</span>
            </div>
          )}
        </div>

        {/* Footer with actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Deleting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Yes, Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── ProjectCard ─────────────────────────────────────────────────────────── */
export interface ProjectCardProject {
  id: string
  name: string | null
  location?: string | null
  survey_type?: string | null
  utm_zone?: number | null
  hemisphere?: string | null
  created_at: string
  point_count?: number
  parcel_count?: number
  _pointCount?: number
  _parcelCount?: number
}

export default function ProjectCard({ project, openLabel }: { project: ProjectCardProject; openLabel: string }) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  const getSurveyBadgeLabel = (type?: string): string => {
    switch ((type || '').toLowerCase()) {
      case 'road': return 'ROAD'
      case 'boundary': return 'BOUNDARY'
      case 'topographic': return 'TOPO'
      case 'control': return 'CONTROL'
      case 'construction': return 'CONSTRUCTION'
      case 'leveling': return 'LEVELING'
      case 'drone': return 'DRONE'
      case 'gnss': return 'GNSS'
      default: return (type || 'TOPO').toUpperCase()
    }
  }

  const surveyType = getSurveyBadgeLabel(project.survey_type ?? undefined)

  const pointCount = project.point_count ?? project._pointCount ?? 0
  const parcelCount = project.parcel_count ?? project._parcelCount ?? 0

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCardClick = (e: React.MouseEvent) => {
    // Ignore clicks on any interactive element: menu, delete, links, buttons
    const target = e.target as HTMLElement
    if (
      target.closest('.menu-trigger') ||
      target.closest('.menu-dropdown') ||
      target.closest('.delete-trigger') ||
      target.closest('a') ||
      target.closest('button')
    ) return
    router.push(`/project/${project.id}`)
  }

  const handleDelete = useCallback(async () => {
    setIsDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/project/${project.id}`, { method: 'DELETE' })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setDeleteError(data.error || 'Failed to delete project')
        setIsDeleting(false)
      } else {
        setShowDeleteModal(false)
        // Force a full page reload to guarantee the deleted project disappears
        // router.refresh() alone is unreliable for Server Component data
        window.location.href = window.location.pathname
      }
    } catch (err: unknown) {
      setDeleteError((err as Error).message || 'Failed to delete project — check your connection and try again')
      setIsDeleting(false)
    }
  }, [project.id])

  const badgeColor = (() => {
    const type = project.survey_type?.toLowerCase() || 'topo'
    if (type === 'road') return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    if (type === 'boundary') return 'bg-green-500/20 text-green-400 border-green-500/30'
    if (type === 'control') return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    if (type === 'topographic') return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  })()

  return (
    <>
      <div
        onClick={handleCardClick}
        className="group block h-full card p-6 hover:border-[var(--border-hover)] hover:bg-[var(--bg-tertiary)] transition-premium cursor-pointer relative"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors leading-snug flex-1 truncate">
            {project.name}
          </h3>
          <span className={`badge shrink-0 text-[10px] border ${badgeColor}`}>{surveyType}</span>
        </div>

        <p className="text-sm text-[var(--text-muted)] mb-3 truncate">
          {project.location || 'No location set'}
        </p>

        {/* Workflow badge */}
        <div className="mb-3">
          <ProjectWorkflowBadge project={project} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs text-[var(--text-secondary)] mb-3">
          <div>
            <span className="text-[var(--text-muted)]">Points:</span>{' '}
            <span className="font-mono text-[var(--text-primary)]">{pointCount}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">Parcels:</span>{' '}
            <span className="font-mono text-[var(--text-primary)]">{parcelCount}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)]">UTM</span>{' '}
            <span className="font-mono text-[var(--text-primary)]">{project.utm_zone}{project.hemisphere}</span>
          </div>
        </div>

        <div className="text-xs text-[var(--text-muted)] mb-4">
          Created: {new Date(project.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>

        <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
          <Link
            href={`/project/${project.id}`}
            prefetch={false}
            onClick={e => e.stopPropagation()}
            className="text-xs text-[var(--accent)] font-medium hover:text-[var(--accent-dim)] transition-colors"
          >
            {openLabel} →
          </Link>

          <div className="flex items-center gap-2 relative" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setMenuOpen(false)
                setShowDeleteModal(true)
              }}
              className="delete-trigger w-9 h-9 flex items-center justify-center rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors"
              title="Delete project"
              aria-label="Delete project"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <Link
              href={`/project/${project.id}/generate-plan`}
              prefetch={false}
              onClick={e => e.stopPropagation()}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors px-2 py-2 rounded hover:bg-[var(--bg-secondary)]"
            >
              Generate Plan
            </Link>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setMenuOpen(!menuOpen)
              }}
              className="menu-trigger w-9 h-9 flex items-center justify-center rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="More options"
            >
              •••
            </button>

            {menuOpen && (
              <div className="menu-dropdown absolute right-0 top-full mt-1 z-50 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg shadow-xl py-1 min-w-[160px]">
                <Link
                  href={`/project/${project.id}`}
                  prefetch={false}
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
                  className="block px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--border-hover)] transition-colors"
                >
                  Open
                </Link>
                <Link
                  href={`/project/${project.id}/generate-plan`}
                  prefetch={false}
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
                  className="block px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--border-hover)] transition-colors"
                >
                  Generate Plan
                </Link>
                <Link
                  href={`/project/${project.id}/documents`}
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
                  className="block px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--border-hover)] transition-colors"
                >
                  Generate Report
                </Link>
                <div className="border-t border-[var(--border-color)] my-1"></div>
                <Link
                  href={`/project/${project.id}/contours`}
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
                  className="block px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--border-hover)] transition-colors"
                >
                  Contours
                </Link>
                <Link
                  href={`/project/${project.id}/profiles`}
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
                  className="block px-4 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--border-hover)] transition-colors"
                >
                  Profiles
                </Link>
                <div className="border-t border-[var(--border-color)] my-1"></div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    setShowDeleteModal(true)
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Project
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          projectName={project.name ?? ''}
          pointCount={pointCount}
          parcelCount={parcelCount}
          onConfirm={handleDelete}
          onCancel={() => { setShowDeleteModal(false); setDeleteError('') }}
          isDeleting={isDeleting}
          deleteError={deleteError}
        />
      )}
    </>
  )
}
