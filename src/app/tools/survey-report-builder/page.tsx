'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SurveyReportBuilder from '@/components/surveyreport/SurveyReportBuilder'

interface Project {
  id: string
  name: string
  location: string | null
}

export default function SurveyReportBuilderPage() {
  const params = useSearchParams()
  const projectId = params.get('projectId') || ''
  const reportId = params.get('reportId') || undefined
  
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [loading, setLoading] = useState(true)
  
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        window.location.href = '/login'
        return
      }

      const { data } = await supabase
        .from('projects')
        .select('id, name, location')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      setProjects(data || [])
      setLoading(false)
    }

    load()
  }, [supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!projectId) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Survey Report Builder</h1>
          <p className="text-[var(--text-muted)] mb-6">
            Select a project to create a new RDM 1.1 Table 5.4 compliant survey report.
          </p>
          
          {projects.length === 0 ? (
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-8 text-center">
              <p className="text-[var(--text-muted)] mb-4">No projects found.</p>
              <a
                href="/project/new"
                className="inline-block px-6 py-2.5 bg-[var(--accent)] text-black font-semibold rounded-lg text-sm"
              >
                Create New Project
              </a>
            </div>
          ) : (
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Select Project</h2>
              <div className="space-y-2">
                {projects.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProjectId(p.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                      selectedProjectId === p.id
                        ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                        : 'border-[var(--border-color)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{p.location || 'No location'}</div>
                  </button>
                ))}
              </div>
              <div className="flex justify-end mt-6">
                <a
                  href={`/tools/survey-report-builder?projectId=${selectedProjectId}`}
                  className={`px-6 py-2.5 bg-[var(--accent)] text-black font-semibold rounded-lg text-sm ${
                    !selectedProjectId ? 'opacity-40 pointer-events-none' : ''
                  }`}
                >
                  Continue →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return <SurveyReportBuilder projectId={projectId} existingReportId={reportId} />
}
