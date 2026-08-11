'use client';

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { createClient } from '@/lib/api-client/client'
import SurveyReportBuilder from '@/components/surveyreport/SurveyReportBuilder'
import MobileDesktopNotice from '@/components/MobileDesktopNotice'
import { PageHeader } from '@/components/shared/PageHeader'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Project {
  id: string
  name: string
  location: string | null
}

function SurveyReportBuilderContent() {
  const params = useSearchParams()
  const projectId = params.get('projectId') || ''
  const reportId = params.get('reportId') || undefined
  const { data: session, status: sessionStatus } = useSession()
  const { t } = useLanguage()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [loading, setLoading] = useState(true)

  // AUDIT FIX (H-007, 2026-07-27): useMemo prevents infinite loop.
  const dbClient = useMemo(() => createClient(), [])

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!session?.user) {
      setLoading(false)
      return
    }

    async function load() {
      const { data } = await dbClient
        .from('projects')
        .select('id, name, location')
        .order('created_at', { ascending: false })
                .limit(50) as unknown as { data: Project[] | null }

      setProjects((data as Project[] | null) || [])
      setLoading(false)
    }

    load()
  }, [session, sessionStatus, dbClient])

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Sign in Required</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            You need to be signed in to create survey reports.
          </p>
          <a
            href="/login"
            className="inline-block px-6 py-2.5 bg-[var(--accent)] text-black font-semibold rounded-lg text-sm hover:bg-[var(--accent-dim)] transition-colors"
          >
            Sign In
          </a>
        </div>
      </div>
    )
  }

  if (!projectId) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] p-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-4">
            <MobileDesktopNotice>
              Report assembly has long forms, tables, previews, and export checks. Mobile is fine for selecting a project, but desktop is recommended before generating final documents.
            </MobileDesktopNotice>
          </div>
          <PageHeader
            title={t('tools.surveyReportBuilder')}
            subtitle={t('tools.surveyReportBuilderDesc')}
          />
          
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
                {projects.map((p) => (
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

  return (
    <div className="space-y-4">
      <div className="px-4 pt-4">
        <MobileDesktopNotice>
          Report assembly has long forms, tables, previews, and export checks. Use desktop before issuing final documents.
        </MobileDesktopNotice>
      </div>
      <SurveyReportBuilder projectId={projectId} existingReportId={reportId} />
    </div>
  )
}

export default function SurveyReportBuilderPage() {
  const { t } = useLanguage()
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SurveyReportBuilderContent />
    </Suspense>
  )
}
