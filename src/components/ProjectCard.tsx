'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

export default function ProjectCard({ project, openLabel }: { project: any; openLabel: string }) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const getSurveyBadgeLabel = (type?: string): string => {
    switch ((type || '').toLowerCase()) {
      case 'road': return 'ROAD'
      case 'boundary': return 'BOUNDARY'
      case 'topographic': return 'TOPO'
      case 'control': return 'CONTROL'
      case 'hydrographic': return 'HYDRO'
      case 'mining': return 'MINING'
      case 'construction': return 'CONSTRUCTION'
      case 'leveling': return 'LEVELING'
      case 'drone': return 'DRONE'
      case 'gnss': return 'GNSS'
      default: return (type || 'TOPO').toUpperCase()
    }
  }

  const surveyType = getSurveyBadgeLabel(project.survey_type)

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
    if ((e.target as HTMLElement).closest('.menu-trigger') || (e.target as HTMLElement).closest('.menu-dropdown')) return
    router.push(`/project/${project.id}`)
  }

  const badgeColor = (() => {
    const type = project.survey_type?.toLowerCase() || 'topo'
    if (type === 'road') return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    if (type === 'boundary') return 'bg-green-500/20 text-green-400 border-green-500/30'
    if (type === 'control') return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    if (type === 'topographic') return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  })()

  return (
    <div
      onClick={handleCardClick}
      className="group block rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 hover:border-[var(--accent)]/50 hover:bg-[var(--bg-tertiary)] transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors leading-snug flex-1 truncate">
          {project.name}
        </h3>
        <span className={`badge shrink-0 text-[10px] border ${badgeColor}`}>{surveyType}</span>
      </div>

      <p className="text-sm text-[var(--text-muted)] mb-4 truncate">
        {project.location || 'No location set'}
      </p>

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
        Last edited: {project.updated_at 
          ? new Date(project.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : new Date(project.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>

      <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
        <Link
          href={`/project/${project.id}`}
          onClick={e => e.stopPropagation()}
          className="text-xs text-[var(--accent)] font-medium hover:text-[var(--accent-dim)] transition-colors"
        >
          {openLabel} →
        </Link>
        
        <div className="flex items-center gap-2 relative" ref={menuRef}>
          <Link
            href={`/project/${project.id}/generate-plan`}
            onClick={e => e.stopPropagation()}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors px-2 py-1 rounded hover:bg-[var(--bg-secondary)]"
          >
            Generate Plan
          </Link>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen(!menuOpen)
            }}
            className="menu-trigger w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            •••
          </button>
          
          {menuOpen && (
            <div className="menu-dropdown absolute right-0 top-full mt-1 z-50 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg shadow-xl py-1 min-w-[160px]">
              <Link
                href={`/project/${project.id}`}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
                className="block px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--border-hover)] transition-colors"
              >
                Open
              </Link>
              <Link
                href={`/project/${project.id}/generate-plan`}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
                className="block px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--border-hover)] transition-colors"
              >
                Generate Plan
              </Link>
              <Link
                href={`/project/${project.id}/documents`}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
                className="block px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--border-hover)] transition-colors"
              >
                Generate Report
              </Link>
              <div className="border-t border-[var(--border-color)] my-1"></div>
              <Link
                href={`/project/${project.id}/contours`}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
                className="block px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--border-hover)] transition-colors"
              >
                Contours
              </Link>
              <Link
                href={`/project/${project.id}/profiles`}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
                className="block px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--border-hover)] transition-colors"
              >
                Profiles
              </Link>
              <div className="border-t border-[var(--border-color)] my-1"></div>
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                  if (confirm(`Delete "${project.name}"? This cannot be undone.`)) {
                    const { createClient } = await import('@/lib/supabase/client')
                    const sb = createClient()
                    await sb.from('projects').delete().eq('id', project.id)
                    router.refresh()
                  }
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[var(--border-hover)] transition-colors"
              >
                Delete Project
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
