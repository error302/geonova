'use client'

import { useSearchParams } from 'next/navigation'
import MutationPlanGenerator from '@/components/mutationplan/MutationPlanGenerator'
import ProjectMutationPlan from '@/components/mutationplan/ProjectMutationPlan'
import { MapPinned } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function MutationPlanPage() {
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project')

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] rounded-md">
          <MapPinned className="h-6 w-6 text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="font-display text-2xl text-[var(--text-primary)] tracking-[-0.02em]">{t('tools.mutationPlan')}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {t('tools.mutationPlanDesc')}
          </p>
        </div>
      </div>
      {projectId && projectId !== 'new' ? (
        <ProjectMutationPlan projectId={projectId} />
      ) : (
        <MutationPlanGenerator />
      )}
    </div>
  )
}
