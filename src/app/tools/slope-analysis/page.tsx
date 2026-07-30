'use client';

import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import SlopeAnalysisPanel from '@/components/engineering/SlopeAnalysisPanel'
import { useLanguage } from '@/lib/i18n/LanguageContext'

function SlopeAnalysisPage() {
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project') || undefined

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title={t('tools.slopeAnalysis')}
        subtitle={t('tools.slopeAnalysisDesc')}
      />
      <SlopeAnalysisPanel projectId={projectId} />
    </div>
  )
}

// P0-2 (2026-07-24): Wrap in <ToolGate> so direct-URL access can't
// bypass the plan check. The catalog page (/tools) shows lock badges,
// but those are display-only — this gate enforces the same check at
// the page level. Server-side enforcement for any export API this
// tool calls happens via the requirePlan() decorator on the route.
import { ToolGate } from '@/components/shared/ToolGate'

export default function SlopeAnalysisPageGated() {
  return (
    <ToolGate toolPath="/tools/slope-analysis">
      <SlopeAnalysisPage />
    </ToolGate>
  )
}
