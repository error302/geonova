'use client';

/**
 * ProjectPicker — project selection screen for field tools
 *
 * Shows a list of the user's projects and lets them pick one
 * to start a field session. Also lets them pick the survey type.
 */

import { useState, useEffect } from 'react'
import { FolderKanban, ChevronRight, Loader2, MapPin } from 'lucide-react'
import { createClient } from '@/lib/api-client/client'

interface Project {
  id: string
  name: string
  survey_type?: string
  county?: string
  created_at?: string
}

interface ProjectPickerProps {
  onPick: (projectId: string, surveyType?: string) => void
  title: string
  subtitle: string
}

export function ProjectPicker({ onPick, title, subtitle }: ProjectPickerProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProjects() {
      try {
        const db = createClient()
        const { data, error } = await db
          .from('projects')
          .select('id, name, survey_type, county, created_at')
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) throw error
        setProjects(data || [])
      } catch (err) {
        console.error('[project-picker] Failed to load projects:', err)
        setError('Failed to load projects. Check your connection.')
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Header */}
      <div className="px-4 py-6 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="w-5 h-5 text-[var(--accent)]" />
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{title}</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm text-[var(--error)]">{error}</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <FolderKanban className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-muted)]">No projects yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Create a project from the dashboard first
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onPick(project.id, project.survey_type)}
                className="w-full flex items-center gap-3 p-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent)]/30 hover:bg-[var(--bg-secondary)] transition-all text-left"
              >
                <FolderKanban className="w-5 h-5 text-[var(--accent)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[var(--text-primary)] truncate">
                    {project.name}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] flex items-center gap-2 mt-0.5">
                    {project.survey_type && (
                      <span className="capitalize">{project.survey_type}</span>
                    )}
                    {project.county && <span>· {project.county}</span>}
                    {project.created_at && (
                      <span>· {new Date(project.created_at).toLocaleDateString('en-KE')}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
